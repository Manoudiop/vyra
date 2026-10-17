import { router } from 'expo-router';
import { CalendarDays, type LucideIcon, Plus, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSession } from '@/features/auth/session-store';
import {
  Card,
  colors,
  colorsAlpha,
  EmptyState,
  radii,
  Screen,
  ScreenHeader,
  spacing,
  Text,
} from '@/ui';

function greetingKey(hour: number) {
  if (hour < 12) return 'home.greetingMorning' as const;
  if (hour < 18) return 'home.greetingAfternoon' as const;
  return 'home.greetingEvening' as const;
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const user = useSession((state) => state.user);
  const now = new Date();
  const dateLabel = now.toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const quickActions: { key: string; label: string; icon: LucideIcon; onPress: () => void }[] = [
    { key: 'add', label: t('home.addItem'), icon: Plus, onPress: () => router.navigate('/closet') },
    {
      key: 'style',
      label: t('home.styleMe'),
      icon: Sparkles,
      onPress: () => router.navigate('/stylist'),
    },
    {
      key: 'plan',
      label: t('home.planWeek'),
      icon: CalendarDays,
      onPress: () => router.navigate('/calendar'),
    },
  ];

  return (
    <Screen testID="home-screen">
      <ScreenHeader
        overline={dateLabel}
        title={t(greetingKey(now.getHours()), { name: user?.firstName ?? '' })}
      />

      <Text variant="overline" color="secondary" style={styles.sectionTitle}>
        {t('home.todaysLook')}
      </Text>
      <Card padded={false} style={styles.todayCard}>
        <EmptyState
          testID="home-empty"
          icon={Sparkles}
          title={t('home.emptyTitle')}
          body={t('home.emptyBody')}
          actionLabel={t('home.emptyCta')}
          onAction={() => router.navigate('/stylist')}
        />
      </Card>

      <Text variant="overline" color="secondary" style={styles.sectionTitle}>
        {t('home.quickActions')}
      </Text>
      <View style={styles.actions}>
        {quickActions.map((action, index) => (
          <Animated.View
            key={action.key}
            entering={FadeInDown.delay(80 * index).duration(320)}
            style={styles.actionSlot}
          >
            <Card
              onPress={action.onPress}
              accessibilityLabel={action.label}
              style={styles.action}
              testID={`quick-${action.key}`}
            >
              <View style={styles.actionIcon}>
                <action.icon size={20} color={colors.primary} strokeWidth={1.9} />
              </View>
              <Text variant="callout" numberOfLines={2} style={styles.actionLabel}>
                {action.label}
              </Text>
            </Card>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginBottom: spacing.md, marginTop: spacing.sm },
  todayCard: { marginBottom: spacing.xxl },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionSlot: { flex: 1 },
  action: { flex: 1, gap: spacing.md, minHeight: 104, justifyContent: 'space-between' },
  // Three across on a 375pt screen leaves ~77pt per label.
  actionLabel: { fontSize: 14 },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colorsAlpha.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
