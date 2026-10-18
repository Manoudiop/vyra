import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type AnalyzeClothingResponse,
  LOW_CONFIDENCE,
  nearestStyleColor,
  STYLE_COLORS,
  type UploadedImage,
  type UsageLimitDetails,
} from '@vyra/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Camera, Check, ImagePlus, Lightbulb, Shirt, Sparkles, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { FormBanner } from '@/features/auth/components';
import { closetApi, closetKeys } from '@/features/closet/closet-api';
import { useClosetSummary } from '@/features/closet/hooks';
import {
  isItemFieldsComplete,
  ItemFields,
  type ItemFieldsValue,
} from '@/features/closet/ItemFields';
import { pickPhoto, type PhotoSource, preparePhoto, toUploadForm } from '@/features/closet/photo';
import { ApiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import { SeeOffers } from '@/features/subscriptions/SeeOffers';
import { usageKeys } from '@/features/usage/usage-api';
import { limitOf, useResetDate } from '@/features/usage/use-usage';
import {
  Button,
  Card,
  colors,
  colorsAlpha,
  haptics,
  IconButton,
  radii,
  Screen,
  spacing,
  Text,
} from '@/ui';

type Phase =
  | { name: 'pick' }
  | { name: 'processing'; step: 'uploading' | 'analyzing'; previewUri: string }
  | {
      name: 'details';
      previewUri: string;
      uploaded: UploadedImage;
      /** null when the analysis failed: the user fills the form by hand. */
      ai: AnalyzeClothingResponse | null;
      /** Set when the analysis was skipped because the plan's analyses are used up. */
      aiLimit: UsageLimitDetails | null;
    };

type ConfidenceField = keyof AnalyzeClothingResponse['analysis']['confidence'];

const EMPTY_FIELDS: ItemFieldsValue = {
  name: '',
  category: null,
  subcategory: '',
  color: null,
  style: null,
  season: 'ALL_SEASON',
};

export default function AddClothingItemScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const resetDate = useResetDate();
  const summary = useClosetSummary();
  const [phase, setPhase] = useState<Phase>({ name: 'pick' });
  const [fields, setFields] = useState<ItemFieldsValue>(EMPTY_FIELDS);
  const [permissionDenied, setPermissionDenied] = useState<PhotoSource | null>(null);
  // The upload that is not yet attached to an item, to clean up if the user leaves.
  const pendingUpload = useRef<UploadedImage | null>(null);

  const limit = summary.data?.limit ?? null;
  const closetFull = limit !== null && (summary.data?.total ?? 0) >= limit;

  useEffect(
    () => () => {
      // Leaving without saving: drop the orphan photo (best effort).
      const orphan = pendingUpload.current;
      if (orphan) {
        void closetApi
          .discardImage({ imageKey: orphan.imageKey, thumbnailKey: orphan.thumbnailKey })
          .catch(() => undefined);
      }
    },
    [],
  );

  const upload = useMutation({
    mutationFn: async (source: PhotoSource) => {
      const picked = await pickPhoto(source);
      if (picked.status !== 'picked') return picked;
      setPhase({ name: 'processing', step: 'uploading', previewUri: picked.photo.uri });
      const prepared = await preparePhoto(picked.photo);
      const uploaded = await closetApi.uploadImage(await toUploadForm(prepared));
      pendingUpload.current = uploaded;
      setPhase({ name: 'processing', step: 'analyzing', previewUri: picked.photo.uri });
      // The analysis only pre-fills the form: if it fails, the user simply types it in.
      let aiLimit: UsageLimitDetails | null = null;
      const ai = await closetApi.analyze(uploaded.imageKey).catch((error: unknown) => {
        aiLimit = limitOf(error, 'CLOTHING_ANALYSIS');
        return null;
      });
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
      return { status: 'uploaded' as const, uploaded, ai, aiLimit, previewUri: picked.photo.uri };
    },
    onSuccess: (result, source) => {
      if (result.status === 'denied') {
        setPermissionDenied(source);
        return;
      }
      if (result.status !== 'uploaded') return;
      haptics.success();
      const analysis = result.ai?.analysis;
      setFields(
        analysis
          ? {
              name: analysis.name,
              category: analysis.category,
              subcategory: analysis.subcategory ?? '',
              color: analysis.color,
              style: analysis.style,
              season: analysis.season,
            }
          : { ...EMPTY_FIELDS, color: nearestStyleColor(result.uploaded.dominantColorHex) },
      );
      setPhase({
        name: 'details',
        previewUri: result.previewUri,
        uploaded: result.uploaded,
        ai: result.ai,
        aiLimit: result.aiLimit,
      });
    },
    onError: () => {
      haptics.error();
      setPhase({ name: 'pick' });
    },
  });

  const save = useMutation({
    mutationFn: ({
      uploaded,
      ai,
    }: {
      uploaded: UploadedImage;
      ai: AnalyzeClothingResponse | null;
    }) => {
      const color = fields.color!;
      const analysis = ai?.analysis;
      // Which suggestions the user overrode: precious feedback for future models.
      const corrected = analysis
        ? (['name', 'category', 'color', 'style', 'season'] as const).filter(
            (field) => fields[field] !== analysis[field],
          )
        : [];
      return closetApi.create({
        name: fields.name,
        category: fields.category!,
        subcategory: fields.subcategory.trim() || undefined,
        color,
        // The photo's own shade when it is close to the chosen color family.
        colorHex:
          analysis?.color === color
            ? analysis.colorHex
            : nearestStyleColor(uploaded.dominantColorHex) === color
              ? uploaded.dominantColorHex
              : STYLE_COLORS[color],
        style: fields.style ?? undefined,
        season: fields.season,
        imageKey: uploaded.imageKey,
        thumbnailKey: uploaded.thumbnailKey,
        metadata: {
          source: 'upload',
          dominantColorHex: uploaded.dominantColorHex,
          ...(ai ? { analysis: ai.analysis, provider: ai.provider, corrected } : {}),
        },
      });
    },
    onSuccess: (item) => {
      haptics.success();
      pendingUpload.current = null; // now owned by the item
      void queryClient.invalidateQueries({ queryKey: closetKeys.all });
      router.replace({ pathname: '/closet/[id]', params: { id: item.id } });
    },
    onError: () => haptics.error(),
  });

  const start = (source: PhotoSource) => {
    setPermissionDenied(null);
    upload.mutate(source);
  };

  const retake = () => {
    const orphan = pendingUpload.current;
    pendingUpload.current = null;
    if (orphan) {
      void closetApi
        .discardImage({ imageKey: orphan.imageKey, thumbnailKey: orphan.thumbnailKey })
        .catch(() => undefined);
    }
    save.reset();
    setPhase({ name: 'pick' });
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text variant="title2" accessibilityRole="header">
          {phase.name === 'details' ? t('addItem.detailsTitle') : t('addItem.title')}
        </Text>
        <Text variant="body" color="secondary">
          {phase.name === 'details' ? t('addItem.detailsSubtitle') : t('addItem.subtitle')}
        </Text>
      </View>
      <IconButton
        icon={X}
        accessibilityLabel={t('common.cancel')}
        onPress={() => goBackOr('/closet')}
        testID="add-close"
      />
    </View>
  );

  if (phase.name === 'details') {
    const confidence = phase.ai?.analysis.confidence;
    const toCheck = confidence
      ? (Object.keys(confidence) as ConfidenceField[]).filter(
          (field) => confidence[field] < LOW_CONFIDENCE,
        )
      : [];
    return (
      <Screen
        keyboard
        edges={['top', 'bottom']}
        testID="add-details"
        footer={
          <View style={styles.footer}>
            {save.isError && <FormBanner tone="error" message={saveError(save.error, t, limit)} />}
            <Button
              testID="add-save"
              label={t('addItem.save')}
              icon={Check}
              onPress={() => save.mutate({ uploaded: phase.uploaded, ai: phase.ai })}
              loading={save.isPending}
              disabled={!isItemFieldsComplete(fields)}
            />
          </View>
        }
      >
        {header}
        <Animated.View entering={FadeIn.duration(300)} style={styles.detailsPreview}>
          <Image
            source={{ uri: phase.uploaded.thumbnailUrl }}
            placeholder={{ uri: phase.previewUri }}
            contentFit="cover"
            style={styles.detailsImage}
          />
          <View style={styles.detailsPreviewCopy}>
            {phase.ai ? (
              <View style={styles.aiNote} testID="add-ai-note">
                <View style={styles.suggestion}>
                  <Sparkles size={14} color={colors.accent} />
                  <Text variant="caption" style={styles.flex}>
                    {t('addItem.aiPrefilled')}
                  </Text>
                </View>
                {toCheck.length > 0 && (
                  <Text variant="caption" color="secondary" testID="add-ai-check">
                    {t('addItem.aiCheck', {
                      fields: toCheck.map((field) => t(`closet.${field}`).toLowerCase()).join(', '),
                    })}
                  </Text>
                )}
              </View>
            ) : phase.aiLimit ? (
              <Text variant="caption" color="secondary" testID="add-ai-limit">
                {t('usage.analysesUsedUp', {
                  count: phase.aiLimit.limit,
                  period: t(`usage.periodOf.${phase.aiLimit.period}`),
                  date: resetDate(phase.aiLimit.resetsAt),
                })}
              </Text>
            ) : (
              <Text variant="caption" color="secondary" testID="add-ai-unavailable">
                {t('addItem.aiUnavailable')}
              </Text>
            )}
            <Button
              label={t('addItem.retake')}
              variant="ghost"
              size="md"
              fullWidth={false}
              onPress={retake}
            />
          </View>
        </Animated.View>
        <ItemFields
          value={fields}
          onChange={(patch) => setFields((current) => ({ ...current, ...patch }))}
        />
      </Screen>
    );
  }

  if (phase.name === 'processing') {
    return (
      <Screen scroll={false} edges={['top', 'bottom']} testID="add-processing">
        {header}
        <ProcessingPreview uri={phase.previewUri} step={phase.step} />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['top', 'bottom']}
      testID="add-pick"
      footer={
        <View style={styles.footer}>
          {upload.isError && <FormBanner tone="error" message={errorMessage(upload.error, t)} />}
          {permissionDenied && (
            <View style={styles.permission}>
              <FormBanner
                tone="error"
                message={
                  permissionDenied === 'camera'
                    ? t('addItem.permissionCamera')
                    : t('addItem.permissionLibrary')
                }
              />
              <Button
                label={t('addItem.openSettings')}
                variant="ghost"
                size="md"
                onPress={() => void Linking.openSettings()}
              />
            </View>
          )}
          {closetFull && (
            <>
              <FormBanner tone="error" message={t('addItem.limitReached', { limit: limit ?? 0 })} />
              <SeeOffers reason="closet" />
            </>
          )}
          <Button
            testID="add-camera"
            label={t('addItem.camera')}
            icon={Camera}
            onPress={() => start('camera')}
            disabled={closetFull || upload.isPending}
          />
          <Button
            testID="add-library"
            label={t('addItem.library')}
            icon={ImagePlus}
            variant="secondary"
            onPress={() => start('library')}
            disabled={closetFull || upload.isPending}
          />
        </View>
      }
    >
      {header}
      <Animated.View entering={FadeInDown.duration(380)} style={styles.stage}>
        <View style={styles.frame}>
          <View style={styles.frameCornerTL} />
          <View style={styles.frameCornerTR} />
          <View style={styles.frameCornerBL} />
          <View style={styles.frameCornerBR} />
          <Shirt size={72} color={colors.accent} strokeWidth={1.2} />
        </View>
      </Animated.View>
      <Card style={styles.tips}>
        <View style={styles.tipsTitle}>
          <Lightbulb size={18} color={colors.accent} />
          <Text variant="bodyStrong">{t('addItem.tipsTitle')}</Text>
        </View>
        {(['tipFlat', 'tipLight', 'tipBackground'] as const).map((tip) => (
          <View key={tip} style={styles.tip}>
            <View style={styles.tipDot} />
            <Text variant="footnote" color="secondary">
              {t(`addItem.${tip}`)}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function saveError(error: unknown, t: Parameters<typeof errorMessage>[1], limit: number | null) {
  if (error instanceof ApiError && error.code === 'LIMIT_REACHED') {
    return t('addItem.limitReached', { limit: limit ?? 30 });
  }
  return errorMessage(error, t);
}

/** The picked photo with a slow scanning light while it is prepared and uploaded. */
function ProcessingPreview({ uri, step }: { uri: string; step: 'uploading' | 'analyzing' }) {
  const { t } = useTranslation();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [progress]);

  const scan = useAnimatedStyle(() => ({ top: `${progress.get() * 92}%` }));

  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.processing}>
      <View style={styles.processingFrame}>
        <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.scanLine, scan]} />
      </View>
      <View style={styles.processingLabel}>
        <Sparkles size={16} color={colors.accent} />
        <Text variant="callout" color="secondary">
          {step === 'analyzing' ? t('addItem.analyzing') : t('addItem.uploading')}
        </Text>
      </View>
    </Animated.View>
  );
}

const CORNER = 28;
const corner = {
  position: 'absolute' as const,
  width: CORNER,
  height: CORNER,
  borderColor: colors.primary,
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  flex: { flex: 1 },
  footer: { gap: spacing.md },
  permission: { gap: spacing.xs },
  stage: { alignItems: 'center', paddingVertical: spacing.xl },
  frame: {
    width: 220,
    aspectRatio: 4 / 5,
    borderRadius: radii.xl,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameCornerTL: {
    ...corner,
    top: 14,
    left: 14,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 10,
  },
  frameCornerTR: {
    ...corner,
    top: 14,
    right: 14,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 10,
  },
  frameCornerBL: {
    ...corner,
    bottom: 14,
    left: 14,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 10,
  },
  frameCornerBR: {
    ...corner,
    bottom: 14,
    right: 14,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 10,
  },
  tips: { gap: spacing.sm, marginTop: spacing.lg },
  tipsTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  processing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  processingFrame: {
    width: '78%',
    aspectRatio: 4 / 5,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  processingLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailsPreview: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  detailsImage: {
    width: 96,
    aspectRatio: 4 / 5,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  detailsPreviewCopy: { flex: 1, gap: spacing.sm, alignItems: 'flex-start' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiNote: { gap: spacing.xs },
});
