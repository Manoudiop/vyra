import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics are a native-only nicety: never let them throw or block an interaction.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  /** Light tap: buttons, chips, tab changes. */
  selection() {
    if (enabled) void Haptics.selectionAsync().catch(() => undefined);
  },
  /** Firmer tap: primary CTAs, the central Stylist button. */
  impact() {
    if (enabled)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  },
  success() {
    if (enabled) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    }
  },
  error() {
    if (enabled) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    }
  },
};
