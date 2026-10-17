import { type LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { haptics } from './haptics';
import { PressableScale } from './PressableScale';
import { colors, hitSlop } from './theme';

export interface IconButtonProps {
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'surface' | 'plain';
  /** Toggle buttons (save…): the icon fills when selected. */
  selected?: boolean;
  testID?: string;
}

export function IconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  variant = 'surface',
  selected,
  testID,
}: IconButtonProps) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={hitSlop}
      pressedScale={0.92}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[styles.base, variant === 'surface' && styles.surface]}
    >
      <Icon
        size={20}
        color={colors.primary}
        fill={selected ? colors.primary : 'none'}
        strokeWidth={2}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  surface: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
});
