import { isRainy, type WeatherCondition, type WeatherSnapshot } from '@vyra/shared';
import { router } from 'expo-router';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  type LucideIcon,
  MapPin,
  Snowflake,
  Sun,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button, Card, colors, colorsAlpha, Skeleton, radii, spacing, Text } from '@/ui';
import { useWeather } from './use-weather';

export const WEATHER_ICONS: Record<WeatherCondition, LucideIcon> = {
  SUNNY: Sun,
  PARTLY_CLOUDY: CloudSun,
  CLOUDY: Cloud,
  FOG: CloudFog,
  RAIN: CloudRain,
  STORM: CloudLightning,
  SNOW: Snowflake,
};

/** What the weather means for today's outfit, in one line. */
export function weatherTipKey(
  weather: Pick<WeatherSnapshot, 'condition' | 'rainProbability' | 'maxC'>,
) {
  if (isRainy(weather)) return 'weather.tipRain' as const;
  if (weather.maxC >= 28) return 'weather.tipHot' as const;
  if (weather.maxC < 16) return 'weather.tipCool' as const;
  return 'weather.tipMild' as const;
}

/** Home widget: today's weather in the user's city and what it means for the look. */
export function WeatherCard() {
  const { t } = useTranslation();
  const query = useWeather();

  if (query.isPending) return <Skeleton height={132} radius={radii.lg} />;

  const weather = query.data?.weather;
  if (!weather) {
    const noCity = query.data?.reason === 'NO_CITY';
    return (
      <Card style={styles.missing} testID="weather-missing">
        <View style={styles.iconBubble}>
          <MapPin size={18} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">
            {noCity ? t('weather.noCityTitle') : t('weather.unavailableTitle')}
          </Text>
          <Text variant="footnote" color="secondary">
            {noCity ? t('weather.noCityBody') : t('weather.unavailableBody')}
          </Text>
        </View>
        {noCity && (
          <Button
            label={t('weather.addCity')}
            variant="ghost"
            size="md"
            fullWidth={false}
            onPress={() => router.push('/edit-profile')}
          />
        )}
      </Card>
    );
  }

  const Icon = WEATHER_ICONS[weather.condition];
  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <Card style={styles.card} testID="weather-card">
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="caption" color="secondary" testID="weather-city">
              {weather.city}
            </Text>
            <Text variant="display" testID="weather-temperature">
              {Math.round(weather.temperatureC)}°
            </Text>
            <Text variant="callout">{t(`weather.conditions.${weather.condition}`)}</Text>
          </View>
          <View style={styles.bigIcon}>
            <Icon size={40} color={colors.accent} strokeWidth={1.6} />
          </View>
        </View>
        <View style={styles.details}>
          <Text variant="footnote" color="secondary">
            {t('weather.range', { min: Math.round(weather.minC), max: Math.round(weather.maxC) })}
          </Text>
          <View style={styles.detail}>
            <Droplets size={14} color={colors.secondary} />
            <Text variant="footnote" color="secondary" testID="weather-rain">
              {t('weather.rain', { percent: Math.round(weather.rainProbability * 100) })}
            </Text>
          </View>
          {weather.humidity !== null && (
            <Text variant="footnote" color="secondary">
              {t('weather.humidity', { percent: weather.humidity })}
            </Text>
          )}
        </View>
        <Text variant="footnote" style={styles.tip} testID="weather-tip">
          {t(weatherTipKey(weather))}
        </Text>
      </Card>
    </Animated.View>
  );
}

/** Compact line for the stylist and outfit screens: "29 °C · Ensoleillé". */
export function WeatherChip({
  temperatureC,
  condition,
  rainProbability,
  prefix,
  testID,
}: {
  temperatureC: number;
  condition: WeatherCondition;
  rainProbability: number;
  prefix?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  const Icon = WEATHER_ICONS[condition];
  const parts = [
    `${Math.round(temperatureC)} °C`,
    t(`weather.conditions.${condition}`),
    ...(isRainy({ condition, rainProbability })
      ? [t('weather.rain', { percent: Math.round(rainProbability * 100) })]
      : []),
  ];
  return (
    <View style={styles.chip} testID={testID}>
      <Icon size={14} color={colors.accent} />
      <Text variant="caption">
        {prefix ? `${prefix} ` : ''}
        {parts.join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  bigIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tip: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  missing: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colorsAlpha.accentSoft,
  },
});
