import { type LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { haptics } from './haptics';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { colors, radii, spacing } from './theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  testID?: string;
}

/** Selectable pill used for occasions, styles, colors and filters. */
export function Chip({ label, selected = false, onPress, icon: Icon, testID }: ChipProps) {
  const fg = selected ? colors.onPrimary : colors.primary;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      style={[styles.chip, selected ? styles.selected : styles.idle]}
    >
      {Icon && <Icon size={16} color={fg} strokeWidth={2} />}
      <Text variant="callout" style={{ color: fg }}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
