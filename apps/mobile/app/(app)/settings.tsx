import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Profile } from '@vyra/shared';
import { ArrowLeft, Languages, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { accountApi } from '@/features/account/account-api';
import { PrivacyCard } from '@/features/analytics/PrivacyCard';
import { FormBanner } from '@/features/auth/components';
import { useSession } from '@/features/auth/session-store';
import { profileApi, profileQueryKey } from '@/features/profile/profile-api';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  Button,
  Card,
  Chip,
  colors,
  colorsAlpha,
  haptics,
  IconButton,
  Screen,
  ScreenHeader,
  spacing,
  Text,
  TextField,
} from '@/ui';

const LANGUAGE_LABELS: Record<(typeof SUPPORTED_LANGUAGES)[number], string> = {
  fr: 'Français',
  en: 'English',
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <Screen keyboard testID="settings-screen">
      <View style={styles.back}>
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t('common.back')}
          onPress={() => goBackOr('/profile')}
        />
      </View>
      <ScreenHeader title={t('settings.title')} />
      <View style={styles.content}>
        <LanguageCard />
        <PrivacyCard />
        <DeleteAccountCard />
      </View>
    </Screen>
  );
}

/** FR / EN: applied at once, saved on the account (AI texts follow it). */
function LanguageCard() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: (locale: 'fr' | 'en') => profileApi.update({ locale }),
    onMutate: async (locale) => {
      const previous = i18n.language;
      await i18n.changeLanguage(locale);
      return { previous };
    },
    onSuccess: (profile) => queryClient.setQueryData<Profile>(profileQueryKey, profile),
    onError: async (_error, _locale, context) => {
      haptics.error();
      if (context?.previous) await i18n.changeLanguage(context.previous);
    },
  });
  return (
    <Card style={styles.card} testID="settings-language">
      <View style={styles.row}>
        <View style={styles.icon}>
          <Languages size={18} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t('settings.language')}</Text>
          <Text variant="footnote" color="secondary">
            {t('settings.languageHint')}
          </Text>
        </View>
      </View>
      <View style={styles.chips}>
        {SUPPORTED_LANGUAGES.map((language) => (
          <Chip
            key={language}
            testID={`language-${language}`}
            label={LANGUAGE_LABELS[language]}
            selected={i18n.language === language}
            onPress={() => change.mutate(language)}
          />
        ))}
      </View>
      {change.isError && <FormBanner tone="error" message={errorMessage(change.error, t)} />}
    </Card>
  );
}

/**
 * Account deletion (required by the app stores, and the user's right). Says
 * exactly what goes, asks for the password, and cannot be undone.
 */
function DeleteAccountCard() {
  const { t } = useTranslation();
  const signOut = useSession((state) => state.signOut);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const remove = useMutation({
    mutationFn: () => accountApi.delete({ password }),
    onSuccess: async () => {
      haptics.success();
      // The server already revoked every session; this clears the device.
      await signOut();
    },
    onError: () => haptics.error(),
  });

  return (
    <Card style={styles.card} testID="settings-delete">
      <View style={styles.row}>
        <View style={[styles.icon, styles.dangerIcon]}>
          <Trash2 size={18} color={colors.danger} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t('settings.deleteTitle')}</Text>
          <Text variant="footnote" color="secondary">
            {t('settings.deleteHint')}
          </Text>
        </View>
      </View>
      {open ? (
        <Animated.View entering={FadeIn.duration(220)} style={styles.confirm}>
          <Text variant="body" testID="settings-delete-explain">
            {t('settings.deleteExplain')}
          </Text>
          <TextField
            testID="settings-delete-password"
            label={t('settings.deletePassword')}
            password
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
          />
          {remove.isError && (
            <FormBanner
              tone="error"
              message={errorMessage(remove.error, t, {
                FORBIDDEN: t('settings.deleteWrongPassword'),
              })}
            />
          )}
          <Button
            testID="settings-delete-confirm"
            label={t('settings.deleteConfirm')}
            variant="secondary"
            icon={Trash2}
            disabled={!password}
            loading={remove.isPending}
            onPress={() => remove.mutate()}
          />
          <Button
            testID="settings-delete-cancel"
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => {
              setOpen(false);
              setPassword('');
            }}
          />
        </Animated.View>
      ) : (
        <Button
          testID="settings-delete-open"
          label={t('settings.deleteOpen')}
          variant="ghost"
          size="md"
          fullWidth={false}
          onPress={() => setOpen(true)}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  back: { paddingTop: spacing.md },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
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
  dangerIcon: { backgroundColor: colorsAlpha.dangerSoft },
  chips: { flexDirection: 'row', gap: spacing.sm },
  confirm: { gap: spacing.md },
});
