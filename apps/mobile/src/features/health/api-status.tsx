import { colors, fontFamily, fontSize, radii, spacing } from '@vyra/config/tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApiHealth } from './use-api-health';

/** Development indicator showing whether the app can reach the API. */
export function ApiStatus() {
  const { isPending, isError, data, refetch } = useApiHealth();

  const state = isPending ? 'pending' : isError ? 'error' : 'ok';
  const label =
    state === 'pending'
      ? 'Connexion à l’API…'
      : state === 'error'
        ? 'API injoignable — toucher pour réessayer'
        : `API connectée · v${data?.version}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={state !== 'error'}
      onPress={() => void refetch()}
      style={styles.pill}
    >
      <View
        testID={`api-status-${state}`}
        style={[
          styles.dot,
          state === 'ok' && { backgroundColor: colors.success },
          state === 'error' && { backgroundColor: colors.danger },
        ]}
      />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.footnote,
    color: colors.secondary,
  },
});
