import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Profile } from '@vyra/shared';
import { ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';
import { FormBanner } from '@/features/auth/components';
import { profileApi, profileQueryKey } from '@/features/profile/profile-api';
import { errorMessage } from '@/lib/errors';
import { Card, colors, colorsAlpha, haptics, spacing, Text } from '@/ui';

/** Profile card: anonymous usage statistics, explained, off in one tap. */
export function PrivacyCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: profileQueryKey, queryFn: profileApi.get });
  const toggle = useMutation({
    mutationFn: (analyticsEnabled: boolean) => profileApi.update({ analyticsEnabled }),
    onMutate: async (analyticsEnabled) => {
      haptics.selection();
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previous = queryClient.getQueryData<Profile>(profileQueryKey);
      if (previous) queryClient.setQueryData(profileQueryKey, { ...previous, analyticsEnabled });
      return { previous };
    },
    onError: (_error, _value, context) => {
      haptics.error();
      if (context?.previous) queryClient.setQueryData(profileQueryKey, context.previous);
    },
    onSuccess: (updated) => queryClient.setQueryData(profileQueryKey, updated),
  });
  const enabled = profile.data?.analyticsEnabled ?? true;

  return (
    <Card style={styles.card} testID="privacy-card">
      <View style={styles.row}>
        <View style={styles.icon}>
          <ShieldCheck size={18} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t('privacy.analyticsTitle')}</Text>
          <Text variant="footnote" color="secondary">
            {t('privacy.analyticsBody')}
          </Text>
        </View>
        <Switch
          testID="privacy-analytics"
          accessibilityLabel={t('privacy.analyticsTitle')}
          value={enabled}
          disabled={!profile.data}
          onValueChange={(value) => toggle.mutate(value)}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor={colors.surface}
        />
      </View>
      {toggle.isError && <FormBanner tone="error" message={errorMessage(toggle.error, t)} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
