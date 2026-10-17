import { type OutfitSummary } from '@vyra/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { colors, PressableScale, radii, spacing, Text } from '@/ui';

/** A look as a row: photo mosaic, occasion and name. Opens the outfit by default. */
export function OutfitRow({
  outfit,
  worn = false,
  onPress,
  right,
  testID,
}: {
  outfit: OutfitSummary;
  worn?: boolean;
  onPress?: () => void;
  right?: ReactNode;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <PressableScale
      testID={testID ?? `outfit-row-${outfit.id}`}
      accessibilityRole="button"
      accessibilityLabel={outfit.name}
      onPress={
        onPress ?? (() => router.push({ pathname: '/outfit/[id]', params: { id: outfit.id } }))
      }
      style={styles.row}
    >
      <View style={styles.mosaic}>
        {outfit.thumbnails.map((uri) => (
          <Image
            key={uri}
            source={{ uri }}
            contentFit="cover"
            style={[styles.tile, outfit.thumbnails.length < 3 && styles.tileTall]}
          />
        ))}
      </View>
      <View style={styles.copy}>
        <Text variant="overline" color="secondary" numberOfLines={1}>
          {t(`occasions.${outfit.occasion}`)} · {t(`styles.${outfit.style}`)}
        </Text>
        <Text variant="bodyStrong" numberOfLines={2}>
          {outfit.name}
        </Text>
      </View>
      {right}
      {worn && (
        <View style={styles.wornCheck}>
          <Check size={14} color={colors.onPrimary} strokeWidth={3} />
        </View>
      )}
    </PressableScale>
  );
}

const MOSAIC = 64;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mosaic: {
    width: MOSAIC,
    height: MOSAIC,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  tile: { width: (MOSAIC - 2) / 2, height: (MOSAIC - 2) / 2, backgroundColor: colors.muted },
  tileTall: { height: MOSAIC },
  copy: { flex: 1, gap: 2 },
  wornCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
