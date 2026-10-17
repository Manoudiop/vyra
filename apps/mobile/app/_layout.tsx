import '@/i18n';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession } from '@/features/auth/session-store';
import { UnreachableScreen } from '@/features/auth/UnreachableScreen';
import { queryClient } from '@/lib/query-client';
import { colors } from '@/ui';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const status = useSession((state) => state.status);
  const restore = useSession((state) => state.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  // The native splash stays up until fonts are ready and the session is known,
  // so the user never sees a flash of the wrong screen.
  const ready = (fontsLoaded || fontError !== null) && status !== 'restoring';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          {status === 'unreachable' ? (
            <UnreachableScreen />
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'fade',
              }}
            >
              <Stack.Protected guard={status === 'signedIn'}>
                <Stack.Screen name="(app)" />
              </Stack.Protected>
              <Stack.Protected guard={status !== 'signedIn'}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
            </Stack>
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
