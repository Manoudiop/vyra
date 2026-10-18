import {
  Bookmark,
  ChevronRight,
  Crown,
  LogOut,
  type LucideIcon,
  Palette,
  Settings,
  Sparkles,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { useSession } from '@/features/auth/session-store';
import { PlanUsageCard } from '@/features/usage/UsageViews';
import {
  Button,
  Card,
  colors,
  colorsAlpha,
  PressableScale,
  radii,
  Screen,
  ScreenHeader,
  spacing,
  Text,
} from '@/ui';

function confirm(message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(message) ?? true);
  return new Promise((resolve) =>
    Alert.alert(message, undefined, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

function Row({
  icon: Icon,
  label,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  /** Rows without a destination yet (phases 15, 18) are visible but inert. */
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      pressedScale={0.99}
      style={styles.row}
    >
      <View style={styles.rowIcon}>
        <Icon size={18} color={colors.primary} strokeWidth={1.9} />
      </View>
      <Text variant="callout" style={styles.rowLabel}>
        {label}
      </Text>
      <ChevronRight size={18} color={colors.secondary} />
    </PressableScale>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const signOut = useSession((state) => state.signOut);
  const [signingOut, setSigningOut] = useState(false);
  const initials = `${user?.firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const onSignOut = async () => {
    if (!(await confirm(t('profile.logoutConfirm'), t('profile.logout'), t('common.cancel'))))
      return;
    setSigningOut(true);
    await signOut();
  };

  return (
    <Screen testID="profile-screen">
      <ScreenHeader title={t('profile.title')} />

      <Card style={styles.identity}>
        <View style={styles.avatar}>
          <Text variant="title3" color="onPrimary">
            {initials}
          </Text>
        </View>
        <View style={styles.identityCopy}>
          <Text variant="title3">
            {user?.firstName} {user?.lastName ?? ''}
          </Text>
          <Text variant="footnote" color="secondary">
            {user?.email}
          </Text>
        </View>
      </Card>

      <View style={styles.plan}>
        <PlanUsageCard />
      </View>

      <Card padded={false} style={styles.list}>
        <Row
          testID="profile-my-style"
          icon={Sparkles}
          label={t('profile.myStyle')}
          onPress={() => router.push('/style-profile')}
        />
        <View style={styles.divider} />
        <Row
          testID="profile-style-preferences"
          icon={Palette}
          label={t('profile.stylePreferences')}
          onPress={() => router.push('/edit-profile')}
        />
        <View style={styles.divider} />
        <Row
          testID="profile-saved-outfits"
          icon={Bookmark}
          label={t('profile.savedOutfits')}
          onPress={() => router.push('/saved-outfits')}
        />
        <View style={styles.divider} />
        <Row
          testID="profile-subscription"
          icon={Crown}
          label={t('profile.subscription')}
          onPress={() => router.push('/subscription')}
        />
        <View style={styles.divider} />
        <Row
          testID="profile-settings"
          icon={Settings}
          label={t('profile.settings')}
          onPress={() => router.push('/settings')}
        />
      </Card>

      <Button
        testID="logout-button"
        label={t('profile.logout')}
        variant="secondary"
        icon={LogOut}
        loading={signingOut}
        onPress={onSignOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  plan: { marginBottom: spacing.lg },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: { flex: 1, gap: 2 },
  list: { marginBottom: spacing.xl, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 58,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 64 },
});
