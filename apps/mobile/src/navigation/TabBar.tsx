import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CalendarDays,
  House,
  type LucideIcon,
  Shirt,
  Sparkles,
  UserRound,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, haptics, PressableScale, spacing, Text } from '@/ui';

type TabRoute = 'index' | 'closet' | 'stylist' | 'calendar' | 'profile';

const TABS: Record<TabRoute, { icon: LucideIcon; labelKey: `tabs.${string}` }> = {
  index: { icon: House, labelKey: 'tabs.home' },
  closet: { icon: Shirt, labelKey: 'tabs.closet' },
  stylist: { icon: Sparkles, labelKey: 'tabs.stylist' },
  calendar: { icon: CalendarDays, labelKey: 'tabs.calendar' },
  profile: { icon: UserRound, labelKey: 'tabs.profile' },
};

const STYLIST_SIZE = 62;

/**
 * Custom tab bar: four quiet tabs around a raised, accent-colored AI Stylist
 * button — the product's core action is always one tap away.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {state.routes.map((route, index) => {
        const config = TABS[route.name as TabRoute];
        if (!config) return null;
        const focused = state.index === index;
        const label = t(config.labelKey as 'tabs.home');

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            if (route.name === 'stylist') haptics.impact();
            else haptics.selection();
            navigation.navigate(route.name, route.params);
          }
        };

        if (route.name === 'stylist') {
          return (
            <View key={route.key} style={styles.slot}>
              <PressableScale
                testID="tab-stylist"
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: focused }}
                onPress={onPress}
                pressedScale={0.92}
                style={styles.stylistButton}
              >
                <LinearGradient
                  colors={focused ? [colors.primary, '#2A2A2A'] : ['#C8AE86', colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.stylistFill}
                >
                  <Sparkles size={26} color={colors.onPrimary} strokeWidth={2} />
                </LinearGradient>
              </PressableScale>
              <Text
                variant="caption"
                color={focused ? 'primary' : 'secondary'}
                style={styles.stylistLabel}
              >
                {label}
              </Text>
            </View>
          );
        }

        const Icon = config.icon;
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.slot}
          >
            <Icon
              size={23}
              color={focused ? colors.primary : colors.secondary}
              strokeWidth={focused ? 2.2 : 1.8}
            />
            <Text variant="caption" color={focused ? 'primary' : 'secondary'}>
              {label}
            </Text>
            <View style={[styles.dot, focused && styles.dotActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  slot: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48, justifyContent: 'flex-end' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginTop: 1 },
  dotActive: { backgroundColor: colors.accent },
  stylistButton: {
    width: STYLIST_SIZE,
    height: STYLIST_SIZE,
    borderRadius: STYLIST_SIZE / 2,
    marginTop: -STYLIST_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.surface,
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  stylistFill: {
    flex: 1,
    borderRadius: STYLIST_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stylistLabel: { marginBottom: 5 },
});
