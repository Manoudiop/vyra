import { useMutation, useQueryClient } from '@tanstack/react-query';
import { nearestStyleColor, STYLE_COLORS, type UploadedImage } from '@vyra/shared';
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
  | { name: 'processing'; previewUri: string }
  | { name: 'details'; previewUri: string; uploaded: UploadedImage };

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
      setPhase({ name: 'processing', previewUri: picked.photo.uri });
      const prepared = await preparePhoto(picked.photo);
      const uploaded = await closetApi.uploadImage(await toUploadForm(prepared));
      return { status: 'uploaded' as const, uploaded, previewUri: picked.photo.uri };
    },
    onSuccess: (result, source) => {
      if (result.status === 'denied') {
        setPermissionDenied(source);
        return;
      }
      if (result.status !== 'uploaded') return;
      haptics.success();
      pendingUpload.current = result.uploaded;
      setFields((current) => ({
        ...current,
        color: current.color ?? nearestStyleColor(result.uploaded.dominantColorHex),
      }));
      setPhase({ name: 'details', previewUri: result.previewUri, uploaded: result.uploaded });
    },
    onError: () => {
      haptics.error();
      setPhase({ name: 'pick' });
    },
  });

  const save = useMutation({
    mutationFn: (uploaded: UploadedImage) => {
      const color = fields.color!;
      return closetApi.create({
        name: fields.name,
        category: fields.category!,
        subcategory: fields.subcategory.trim() || undefined,
        color,
        // The photo's own shade when it is close to the chosen color family.
        colorHex:
          nearestStyleColor(uploaded.dominantColorHex) === color
            ? uploaded.dominantColorHex
            : STYLE_COLORS[color],
        style: fields.style ?? undefined,
        season: fields.season,
        imageKey: uploaded.imageKey,
        thumbnailKey: uploaded.thumbnailKey,
        metadata: { source: 'upload', dominantColorHex: uploaded.dominantColorHex },
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
    const suggested = nearestStyleColor(phase.uploaded.dominantColorHex);
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
              onPress={() => save.mutate(phase.uploaded)}
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
            {suggested && (
              <View style={styles.suggestion}>
                <View
                  style={[
                    styles.suggestionDot,
                    { backgroundColor: phase.uploaded.dominantColorHex },
                  ]}
                />
                <Text variant="caption" color="secondary" style={styles.flex}>
                  {t('addItem.colorSuggested')} · {t(`colors.${suggested}`)}
                </Text>
              </View>
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
        <ProcessingPreview uri={phase.previewUri} />
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
            <FormBanner tone="error" message={t('addItem.limitReached', { limit: limit ?? 0 })} />
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
function ProcessingPreview({ uri }: { uri: string }) {
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
          {t('addItem.uploading')}
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
  suggestionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
});
