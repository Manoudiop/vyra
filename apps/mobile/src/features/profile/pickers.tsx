import {
  type GenderPreference,
  GENDER_PREFERENCES,
  ONBOARDING_OCCASIONS,
  type Occasion,
  STYLE_COLOR_NAMES,
  STYLE_COLORS,
  type Style,
  type StyleColor,
  STYLES,
} from '@vyra/shared';
import {
  Briefcase,
  Check,
  Crown,
  Dumbbell,
  Gem,
  type LucideIcon,
  Shirt,
  Sparkles,
  Sun,
  Users,
  UserRound,
  Zap,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Chip, colors, colorsAlpha, haptics, PressableScale, radii, spacing, Text } from '@/ui';

/** Toggles `value` in `list`, refusing additions beyond `max` (with a soft haptic nudge). */
export function toggleWithLimit<T>(list: readonly T[], value: T, max: number): T[] {
  if (list.includes(value)) return list.filter((item) => item !== value);
  if (list.length >= max) {
    haptics.error();
    return [...list];
  }
  return [...list, value];
}

const GENDER_ICONS: Record<GenderPreference, LucideIcon> = {
  WOMEN: Sparkles,
  MEN: UserRound,
  UNISEX: Users,
};

export function GenderPicker({
  value,
  onChange,
}: {
  value: GenderPreference | null;
  onChange: (value: GenderPreference) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.stack} accessibilityRole="radiogroup">
      {GENDER_PREFERENCES.map((option) => {
        const selected = value === option;
        const Icon = GENDER_ICONS[option];
        return (
          <PressableScale
            key={option}
            testID={`gender-${option}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={t(`gender.${option}`)}
            onPress={() => {
              haptics.selection();
              onChange(option);
            }}
            style={[styles.optionCard, selected && styles.optionCardSelected]}
          >
            <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
              <Icon
                size={22}
                color={selected ? colors.onPrimary : colors.primary}
                strokeWidth={1.8}
              />
            </View>
            <View style={styles.optionCopy}>
              <Text variant="bodyStrong">{t(`gender.${option}`)}</Text>
              <Text variant="footnote" color="secondary">
                {t(`genderHints.${option}`)}
              </Text>
            </View>
            <SelectionMark selected={selected} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const STYLE_ICONS: Record<Style, LucideIcon> = {
  CASUAL: Shirt,
  SMART_CASUAL: Briefcase,
  ELEGANT: Gem,
  STREETWEAR: Zap,
  FORMAL: Crown,
  SPORT: Dumbbell,
  TRADITIONAL: Sun,
};

export function StylePicker({
  value,
  onChange,
  max,
}: {
  value: Style[];
  onChange: (value: Style[]) => void;
  max: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.grid}>
      {STYLES.map((style) => {
        const selected = value.includes(style);
        const Icon = STYLE_ICONS[style];
        return (
          <PressableScale
            key={style}
            testID={`style-${style}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={t(`styles.${style}`)}
            accessibilityHint={t(`styleHints.${style}`)}
            onPress={() => {
              haptics.selection();
              onChange(toggleWithLimit(value, style, max));
            }}
            style={[styles.tile, selected && styles.optionCardSelected]}
          >
            <View style={styles.tileTop}>
              <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                <Icon
                  size={20}
                  color={selected ? colors.onPrimary : colors.primary}
                  strokeWidth={1.8}
                />
              </View>
              <SelectionMark selected={selected} />
            </View>
            <Text variant="bodyStrong">{t(`styles.${style}`)}</Text>
            <Text variant="caption" color="secondary">
              {t(`styleHints.${style}`)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function ColorPicker({
  value,
  onChange,
  max,
}: {
  value: StyleColor[];
  onChange: (value: StyleColor[]) => void;
  max: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.swatches}>
      {STYLE_COLOR_NAMES.map((name) => {
        const selected = value.includes(name);
        const hex = STYLE_COLORS[name];
        const light = ['white', 'cream', 'beige', 'pink', 'yellow'].includes(name);
        return (
          <PressableScale
            key={name}
            testID={`color-${name}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={t(`colors.${name}`)}
            pressedScale={0.92}
            onPress={() => {
              haptics.selection();
              onChange(toggleWithLimit(value, name, max));
            }}
            style={styles.swatchSlot}
          >
            <View style={[styles.swatchRing, selected && styles.swatchRingSelected]}>
              <View style={[styles.swatch, { backgroundColor: hex }, light && styles.swatchLight]}>
                {selected && (
                  <Check
                    size={18}
                    color={light ? colors.primary : colors.onPrimary}
                    strokeWidth={2.6}
                  />
                )}
              </View>
            </View>
            <Text variant="caption" color={selected ? 'primary' : 'secondary'} numberOfLines={1}>
              {t(`colors.${name}`)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function OccasionPicker({
  value,
  onChange,
  max,
}: {
  value: Exclude<Occasion, 'SURPRISE'>[];
  onChange: (value: Exclude<Occasion, 'SURPRISE'>[]) => void;
  max: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.chips}>
      {ONBOARDING_OCCASIONS.map((occasion) => (
        <Chip
          key={occasion}
          testID={`occasion-${occasion}`}
          label={t(`occasions.${occasion}`)}
          selected={value.includes(occasion)}
          onPress={() => onChange(toggleWithLimit(value, occasion, max))}
        />
      ))}
    </View>
  );
}

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.mark, selected && styles.markSelected]}>
      {selected && <Check size={14} color={colors.onPrimary} strokeWidth={3} />}
    </View>
  );
}

const SWATCH = 52;

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionCardSelected: { borderColor: colors.primary, backgroundColor: colors.surface },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconSelected: { backgroundColor: colors.primary },
  optionCopy: { flex: 1, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg },
  swatchSlot: { width: '25%', alignItems: 'center', gap: spacing.xs },
  swatchRing: {
    width: SWATCH + 10,
    height: SWATCH + 10,
    borderRadius: (SWATCH + 10) / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRingSelected: { borderColor: colors.primary },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLight: { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
