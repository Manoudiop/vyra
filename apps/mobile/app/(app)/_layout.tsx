import { Stack } from 'expo-router';
import { useSession } from '@/features/auth/session-store';
import { colors } from '@/ui';

/**
 * Signed-in area. Until onboarding is complete, it is the only reachable screen;
 * afterwards the tabs are the root and detail screens stack above them.
 */
export default function AppLayout() {
  const onboarded = useSession((state) => state.user?.onboardingCompleted ?? false);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="closet/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="closet/[id]/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="closet/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="outfit/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="saved-outfits" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="wear-history" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="plan-day/[date]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plan-outfit/[id]" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}
