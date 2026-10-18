import {
  type AvoidableKind,
  type MissingPiece,
  OCCASION_DEFAULT_STYLE,
  OCCASIONS,
  type Occasion,
  type Style,
  type StyleColor,
} from '@vyra/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Briefcase,
  CalendarDays,
  Check,
  Coffee,
  Dumbbell,
  Gem,
  Heart,
  type LucideIcon,
  PartyPopper,
  Plane,
  Shirt,
  Shuffle,
  Sparkles,
  Sun,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FormBanner } from '@/features/auth/components';
import { useDayFormat } from '@/features/calendar/hooks';
import { useWeather } from '@/features/weather/use-weather';
import { WeatherChip } from '@/features/weather/WeatherCard';
import { useClosetList } from '@/features/closet/hooks';
import { GeneratingOverlay } from '@/features/stylist/GeneratingOverlay';
import { useGenerateOutfit } from '@/features/stylist/use-generate-outfit';
import { ApiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';
import {
  Button,
  Card,
  Chip,
  colors,
  EmptyState,
  haptics,
  PressableScale,
  radii,
  Screen,
  spacing,
  Text,
} from '@/ui';

const OCCASION_ICONS: Record<Occasion, LucideIcon> = {
  WORK: Briefcase,
  DATE: Heart,
  DINNER: UtensilsCrossed,
  PARTY: PartyPopper,
  WEDDING: Gem,
  TRAVEL: Plane,
  CASUAL: Coffee,
  WORKOUT: Dumbbell,
  TRADITIONAL: Sun,
  SURPRISE: Shuffle,
};

/** The styles offered by the stylist (sport follows the workout occasion). */
const STYLIST_STYLES: Style[] = [
  'CASUAL',
  'SMART_CASUAL',
  'ELEGANT',
  'STREETWEAR',
  'FORMAL',
  'TRADITIONAL',
];

type Toggle = {
  key: string;
  labelKey: `stylist.${string}`;
  color?: StyleColor;
  kind?: AvoidableKind;
};
const CONSTRAINTS: Toggle[] = [
  { key: 'black', labelKey: 'stylist.avoidBlack', color: 'black' },
  { key: 'jeans', labelKey: 'stylist.avoidJeans', kind: 'jeans' },
  { key: 'heels', labelKey: 'stylist.noHeels', kind: 'heels' },
  { key: 'sneakers', labelKey: 'stylist.noSneakers', kind: 'sneakers' },
];

function failureOf(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  const details = error.details as { reason?: string; missing?: MissingPiece[] } | undefined;
  return details?.reason ? details : null;
}

export default function StylistScreen() {
  const { t } = useTranslation();
  // Set when coming from a calendar day: the look is for that day.
  const { date } = useLocalSearchParams<{ date?: string }>();
  const format = useDayFormat();
  const weather = useWeather(date ?? null).data?.weather;
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [style, setStyle] = useState<Style | null>(null);
  const [styleTouched, setStyleTouched] = useState(false);
  const [toggles, setToggles] = useState<string[]>([]);
  const [requiredItemId, setRequiredItemId] = useState<string | null>(null);
  const closet = useClosetList({ search: '', category: null, favorite: false });
  const generate = useGenerateOutfit();
  const pieces = closet.data?.pages.flatMap((page) => page.items) ?? [];

  const chooseOccasion = (value: Occasion) => {
    setOccasion(value);
    // Suggest the natural style for the occasion until the user picks one.
    if (!styleTouched) setStyle(OCCASION_DEFAULT_STYLE[value]);
  };

  const submit = () => {
    if (!occasion || !style) return;
    const active = CONSTRAINTS.filter((toggle) => toggles.includes(toggle.key));
    generate.mutate(
      {
        occasion,
        style,
        constraints: {
          avoidColors: active.flatMap((toggle) => (toggle.color ? [toggle.color] : [])),
          avoidKinds: active.flatMap((toggle) => (toggle.kind ? [toggle.kind] : [])),
          ...(requiredItemId ? { requiredItemId } : {}),
        },
        ...(date ? { date } : {}),
      },
      {
        onSuccess: ({ outfit }) =>
          router.push({
            pathname: '/outfit/[id]',
            params: { id: outfit.id, ...(date ? { planFor: date } : {}) },
          }),
      },
    );
  };

  const failure = generate.isError ? failureOf(generate.error) : null;

  return (
    <View style={styles.root}>
      <Screen
        testID="stylist-screen"
        footer={
          <View style={styles.footer}>
            {generate.isError && failure?.reason !== 'INCOMPLETE_CLOSET' && (
              <FormBanner
                tone="error"
                message={
                  failure?.reason === 'NO_MATCH'
                    ? t('stylist.noMatch')
                    : failure?.reason === 'REQUIRED_ITEM_UNAVAILABLE'
                      ? t('stylist.requiredUnavailable')
                      : errorMessage(generate.error, t)
                }
              />
            )}
            <Button
              testID="stylist-generate"
              label={occasion ? t('stylist.generate') : t('stylist.pickOccasion')}
              icon={Sparkles}
              variant="accent"
              onPress={submit}
              disabled={!occasion || !style}
              loading={generate.isPending}
            />
          </View>
        }
      >
        <Animated.View entering={FadeInDown.duration(380)}>
          <LinearGradient
            colors={[colors.primary, '#2B2723']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroBadge}>
              <Sparkles size={16} color={colors.primary} strokeWidth={2} />
              <Text variant="caption">AI Stylist</Text>
            </View>
            <Text variant="title1" color="onPrimary" accessibilityRole="header">
              {t('stylist.title')}
            </Text>
            <Text variant="body" style={styles.heroBody}>
              {t('stylist.subtitle')}
            </Text>
          </LinearGradient>
        </Animated.View>

        {weather && (
          <View style={styles.weather}>
            <WeatherChip
              testID="stylist-weather"
              temperatureC={weather.kind === 'CURRENT' ? weather.temperatureC : weather.maxC}
              condition={weather.condition}
              rainProbability={weather.rainProbability}
            />
            <Text variant="caption" color="secondary">
              {t('weather.takenIntoAccount', { city: weather.city })}
            </Text>
          </View>
        )}

        {date && (
          <Card style={styles.forDay} testID="stylist-for-day">
            <CalendarDays size={18} color={colors.accent} />
            <Text variant="bodyStrong" style={styles.forDayLabel}>
              {t('stylist.forDay', {
                date: format(date, { weekday: 'long', day: 'numeric', month: 'long' }),
              })}
            </Text>
            <PressableScale
              testID="stylist-for-day-clear"
              accessibilityRole="button"
              accessibilityLabel={t('stylist.forDayClear')}
              onPress={() => router.setParams({ date: undefined })}
            >
              <X size={18} color={colors.secondary} />
            </PressableScale>
          </Card>
        )}

        {failure?.reason === 'INCOMPLETE_CLOSET' && (
          <Card style={styles.incomplete} testID="stylist-incomplete">
            <EmptyState
              icon={Shirt}
              title={t('stylist.incompleteTitle')}
              body={t('stylist.incompleteBody', {
                pieces: (failure.missing ?? [])
                  .map((piece) => t(`missingPieces.${piece}`))
                  .join(', '),
              })}
              actionLabel={t('stylist.addPiece')}
              onAction={() => router.push('/closet/add')}
            />
          </Card>
        )}

        <Section title={t('stylist.occasionTitle')}>
          {OCCASIONS.map((value) => (
            <Chip
              key={value}
              testID={`occasion-${value}`}
              icon={OCCASION_ICONS[value]}
              label={t(`occasions.${value}`)}
              selected={occasion === value}
              onPress={() => chooseOccasion(value)}
            />
          ))}
        </Section>

        <Section title={t('stylist.styleTitle')}>
          {STYLIST_STYLES.map((value) => (
            <Chip
              key={value}
              testID={`style-${value}`}
              label={t(`styles.${value}`)}
              selected={style === value}
              onPress={() => {
                setStyleTouched(true);
                setStyle(value);
              }}
            />
          ))}
        </Section>

        <Section title={t('stylist.constraintsTitle')} hint={t('stylist.optional')}>
          {CONSTRAINTS.map((toggle) => (
            <Chip
              key={toggle.key}
              testID={`constraint-${toggle.key}`}
              label={t(toggle.labelKey as 'stylist.avoidBlack')}
              selected={toggles.includes(toggle.key)}
              onPress={() =>
                setToggles((current) =>
                  current.includes(toggle.key)
                    ? current.filter((key) => key !== toggle.key)
                    : [...current, toggle.key],
                )
              }
            />
          ))}
        </Section>

        {pieces.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="title3">{t('stylist.useItem')}</Text>
            </View>
            <Text variant="footnote" color="secondary">
              {t('stylist.useItemHint')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pieces}
              style={styles.piecesScroll}
            >
              {pieces.map((piece) => {
                const selected = requiredItemId === piece.id;
                return (
                  <PressableScale
                    key={piece.id}
                    testID={`use-item-${piece.id}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={piece.name}
                    onPress={() => {
                      haptics.selection();
                      setRequiredItemId(selected ? null : piece.id);
                    }}
                    style={[styles.piece, selected && styles.pieceSelected]}
                  >
                    <Image
                      source={{ uri: piece.thumbnailUrl }}
                      contentFit="cover"
                      style={styles.pieceImage}
                      recyclingKey={piece.id}
                    />
                    {selected && (
                      <View style={styles.pieceCheck}>
                        <Check size={14} color={colors.onPrimary} strokeWidth={3} />
                      </View>
                    )}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Screen>
      {generate.isPending && <GeneratingOverlay />}
    </View>
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
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text variant="title3">{title}</Text>
        {hint && (
          <Text variant="caption" color="secondary">
            {hint}
          </Text>
        )}
      </View>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const PIECE = 76;

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    marginTop: spacing.lg,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginBottom: 'auto',
  },
  heroBody: { color: 'rgba(255,255,255,0.72)' },
  incomplete: { marginTop: spacing.xl },
  weather: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  forDay: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  forDayLabel: { flex: 1 },
  section: { gap: spacing.md, marginTop: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  piecesScroll: { marginHorizontal: -spacing.xl },
  pieces: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.xs },
  piece: {
    width: PIECE,
    height: PIECE * 1.25,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.muted,
  },
  pieceSelected: { borderColor: colors.primary },
  pieceImage: { flex: 1 },
  pieceCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { gap: spacing.md },
});
