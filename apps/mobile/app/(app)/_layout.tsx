import { Stack } from 'expo-router';
import { colors } from '@/ui';

/** Signed-in area. Tabs are the root; detail screens and modals stack above them. */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
