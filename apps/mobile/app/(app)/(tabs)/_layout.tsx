import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/navigation/TabBar';
import { colors } from '@/ui';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        animation: 'fade',
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="closet" />
      <Tabs.Screen name="stylist" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
