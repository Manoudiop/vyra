import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ClothingItem,
  LEARNING_MIN_SIGNALS,
  STYLE_COLORS,
  type StyleColor,
  type StyleProfile,
} from '@vyra/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, Ban, Crown, Lightbulb, Sparkles, Wand2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { FormBanner } from '@/features/auth/components';
import { styleApi, styleKeys } from '@/features/style/style-api';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  Button,
  Card,
  colors,
  colorsAlpha,
  ErrorState,
  haptics,
  IconButton,
  PressableScale,
  radii,
  Screen,
  ScreenHeader,
  Skeleton,
  spacing,
  Text,
} from '@/ui';

export default function StyleProfileScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: styleKeys.profile, queryFn: styleApi.profile });
  const analyze = useMutation({
    mutationFn: styleApi.analyze,
    onSuccess: (analysis) => {
      haptics.success();
      queryClient.setQueryData<StyleProfile>(styleKeys.profile, (current) =>
        current ? { ...current, analysis } : current,
      );
    },
    onError: () => haptics.error(),
  });

  return (
    <Screen testID="style-profile-screen">
      <View style={styles.back}>
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t('common.back')}
          onPress={() => goBackOr('/profile')}
        />
      </View>
      <ScreenHeader title={t('styleProfile.title')} subtitle={t('styleProfile.subtitle')} />

      {profile.data ? (
        <Content
          data={profile.data}
          analyzing={analyze.isPending}
          analyzeError={
            analyze.isError
              ? errorMessage(analyze.error, t, {
                  VALIDATION_ERROR: t('styleProfile.notEnough'),
                })
              : null
          }
          onAnalyze={() => analyze.mutate()}
        />
      ) : profile.isError ? (
        <ErrorState
          message={errorMessage(profile.error, t)}
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <View style={styles.loading}>
          <Skeleton height={90} radius={radii.lg} />
          <Skeleton height={160} radius={radii.lg} />
          <Skeleton height={120} radius={radii.lg} />
        </View>
      )}
    </Screen>
  );
}

function Content({
  data,
  analyzing,
  analyzeError,
  onAnalyze,
}: {
  data: StyleProfile;
  analyzing: boolean;
  analyzeError: string | null;
  onAnalyze: () => void;
}) {
  const { t } = useTranslation();
  const { learned, signals } = data;
  const total = signals.loves + signals.dislikes + signals.wears + signals.saves;
  const hasAversions = learned.avoidedColors.length > 0 || learned.avoidedPieces.length > 0;

  return (
    <View style={styles.content}>
      <Text variant="footnote" color="secondary" testID="style-signals">
        {t('styleProfile.basedOn', {
          loves: signals.loves,
          dislikes: signals.dislikes,
          wears: signals.wears,
          saves: signals.saves,
        })}
      </Text>

      {!data.ready ? (
        <Card style={styles.learning} testID="style-learning">
          <View style={styles.iconBubble}>
            <Sparkles size={18} color={colors.accent} />
          </View>
          <Text variant="title3">{t('styleProfile.learningTitle')}</Text>
          <Text variant="body" color="secondary">
            {t('styleProfile.learningBody')}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, (total / LEARNING_MIN_SIGNALS) * 100)}%` },
              ]}
            />
          </View>
          <Text variant="caption" color="secondary">
            {t('styleProfile.progress', { count: total, total: LEARNING_MIN_SIGNALS })}
          </Text>
          <Button
            label={t('styleProfile.createLook')}
            icon={Sparkles}
            variant="secondary"
            onPress={() => router.navigate('/stylist')}
          />
        </Card>
      ) : (
        <Animated.View entering={FadeInDown.duration(380)} style={styles.sections}>
          {learned.colors.length > 0 && (
            <Section title={t('styleProfile.colors')}>
              <View style={styles.colorRow} testID="style-colors">
                {learned.colors.map((entry) => (
                  <ColorChip key={entry.value} color={entry.value} weight={entry.weight} />
                ))}
              </View>
            </Section>
          )}
          {learned.styles.length > 0 && (
            <Section title={t('styleProfile.styles')}>
              {learned.styles.map((entry) => (
                <WeightRow
                  key={entry.value}
                  label={t(`styles.${entry.value}`)}
                  weight={entry.weight}
                />
              ))}
            </Section>
          )}
          {learned.occasionStyles.length > 0 && (
            <Section title={t('styleProfile.byOccasion')}>
              {learned.occasionStyles.map((entry) => (
                <View key={entry.occasion} style={styles.habit} testID={`habit-${entry.occasion}`}>
                  <Text variant="body" style={styles.flex}>
                    {t(`occasions.${entry.occasion}`)}
                  </Text>
                  <Text variant="bodyStrong">{t(`styles.${entry.style}`)}</Text>
                </View>
              ))}
            </Section>
          )}
          {learned.favoritePieces.length > 0 && (
            <Section title={t('styleProfile.favoritePieces')}>
              <Pieces items={learned.favoritePieces} testID="style-favorites" />
            </Section>
          )}
          {hasAversions && (
            <Section title={t('styleProfile.avoided')} hint={t('styleProfile.avoidedHint')}>
              {learned.avoidedColors.length > 0 && (
                <View style={styles.colorRow} testID="style-avoided-colors">
                  {learned.avoidedColors.map((entry) => (
                    <ColorChip key={entry.value} color={entry.value} avoided />
                  ))}
                </View>
              )}
              {learned.avoidedPieces.length > 0 && (
                <Pieces items={learned.avoidedPieces} avoided testID="style-avoided-pieces" />
              )}
            </Section>
          )}
        </Animated.View>
      )}

      <Card style={styles.declared}>
        <View style={styles.declaredHeader}>
          <Text variant="bodyStrong" style={styles.flex}>
            {t('styleProfile.declared')}
          </Text>
          <Button
            label={t('styleProfile.edit')}
            variant="ghost"
            size="md"
            fullWidth={false}
            onPress={() => router.push('/edit-profile')}
          />
        </View>
        <Text variant="footnote" color="secondary">
          {[
            ...data.declared.styles.map((style) => t(`styles.${style}`)),
            ...data.declared.colors.map((color) => t(`colors.${color as StyleColor}`)),
          ].join(' · ') || t('styleProfile.nothingDeclared')}
        </Text>
      </Card>

      <AnalysisCard data={data} analyzing={analyzing} error={analyzeError} onAnalyze={onAnalyze} />
    </View>
  );
}

function AnalysisCard({
  data,
  analyzing,
  error,
  onAnalyze,
}: {
  data: StyleProfile;
  analyzing: boolean;
  error: string | null;
  onAnalyze: () => void;
}) {
  const { t, i18n } = useTranslation();
  if (!data.canAnalyze) {
    return (
      <Card style={styles.premium} testID="style-analysis-locked">
        <View style={styles.iconBubble}>
          <Crown size={18} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t('styleProfile.analysisTitle')}</Text>
          <Text variant="footnote" color="secondary">
            {t('styleProfile.analysisLocked')}
          </Text>
        </View>
      </Card>
    );
  }
  const analysis = data.analysis;
  return (
    <Card style={styles.analysis} testID="style-analysis">
      <View style={styles.analysisHeader}>
        <View style={styles.iconBubble}>
          <Wand2 size={18} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t('styleProfile.analysisTitle')}</Text>
          {analysis && (
            <Text variant="caption" color="secondary">
              {t('styleProfile.analysisDate', {
                date: new Date(analysis.createdAt).toLocaleDateString(i18n.language, {
                  day: 'numeric',
                  month: 'long',
                }),
              })}
            </Text>
          )}
        </View>
      </View>
      {analysis ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.analysisBody}>
          <Text variant="body" testID="style-analysis-summary">
            {analysis.summary}
          </Text>
          {analysis.suggestions.map((suggestion) => (
            <View key={suggestion} style={styles.suggestion}>
              <Lightbulb size={16} color={colors.accent} />
              <Text variant="footnote" color="secondary" style={styles.flex}>
                {suggestion}
              </Text>
            </View>
          ))}
        </Animated.View>
      ) : (
        <Text variant="footnote" color="secondary">
          {t('styleProfile.analysisIntro')}
        </Text>
      )}
      {error && <FormBanner tone="error" message={error} />}
      <Button
        testID="style-analyze"
        label={analysis ? t('styleProfile.reanalyze') : t('styleProfile.analyze')}
        icon={Wand2}
        variant={analysis ? 'secondary' : 'accent'}
        loading={analyzing}
        onPress={onAnalyze}
      />
    </Card>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.section}>
      <Text variant="title3">{title}</Text>
      {hint && (
        <Text variant="footnote" color="secondary">
          {hint}
        </Text>
      )}
      {children}
    </Card>
  );
}

function ColorChip({
  color,
  weight,
  avoided = false,
}: {
  color: string;
  weight?: number;
  avoided?: boolean;
}) {
  const { t } = useTranslation();
  const hex = STYLE_COLORS[color as StyleColor] ?? colors.muted;
  return (
    <View style={styles.colorChip} accessibilityLabel={t(`colors.${color as StyleColor}`)}>
      <View style={[styles.swatch, { backgroundColor: hex }, avoided && styles.swatchAvoided]}>
        {avoided && <Ban size={14} color={colors.primary} />}
      </View>
      <Text variant="caption">{t(`colors.${color as StyleColor}`)}</Text>
      {weight !== undefined && <MiniBar weight={weight} />}
    </View>
  );
}

function WeightRow({ label, weight }: { label: string; weight: number }) {
  return (
    <View style={styles.weightRow}>
      <Text variant="body" style={styles.weightLabel}>
        {label}
      </Text>
      <View style={styles.weightTrack}>
        <View style={[styles.weightFill, { width: `${Math.round(weight * 100)}%` }]} />
      </View>
    </View>
  );
}

function MiniBar({ weight }: { weight: number }) {
  return (
    <View style={styles.miniTrack}>
      <View style={[styles.miniFill, { width: `${Math.round(Math.abs(weight) * 100)}%` }]} />
    </View>
  );
}

function Pieces({
  items,
  avoided = false,
  testID,
}: {
  items: ClothingItem[];
  avoided?: boolean;
  testID: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pieces}
      testID={testID}
    >
      {items.map((item) => (
        <PressableScale
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          onPress={() => router.push({ pathname: '/closet/[id]', params: { id: item.id } })}
          style={styles.piece}
        >
          <Image
            source={{ uri: item.thumbnailUrl }}
            contentFit="cover"
            style={[styles.pieceImage, avoided && styles.pieceAvoided]}
          />
          <Text variant="caption" numberOfLines={1}>
            {item.name}
          </Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const PIECE = 84;

const styles = StyleSheet.create({
  back: { paddingTop: spacing.md },
  loading: { gap: spacing.lg },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  sections: { gap: spacing.lg },
  flex: { flex: 1 },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learning: { gap: spacing.md },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  section: { gap: spacing.md },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  colorChip: { alignItems: 'center', gap: spacing.xs, width: 64 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchAvoided: { opacity: 0.55 },
  miniTrack: { width: 40, height: 3, borderRadius: 2, backgroundColor: colors.muted },
  miniFill: { height: 3, borderRadius: 2, backgroundColor: colors.accent },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weightLabel: { width: 120 },
  weightTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.muted },
  weightFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  habit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pieces: { gap: spacing.md },
  piece: { width: PIECE, gap: spacing.xs },
  pieceImage: {
    width: PIECE,
    height: PIECE * 1.2,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
  },
  pieceAvoided: { opacity: 0.5 },
  declared: { gap: spacing.sm },
  declaredHeader: { flexDirection: 'row', alignItems: 'center' },
  premium: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  analysis: { gap: spacing.md },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  analysisBody: { gap: spacing.md },
  suggestion: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
