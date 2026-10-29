import { Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingBlob } from '@/components/LoadingBlob';
import { BackendStatusProvider } from '@/hooks/BackendStatusContext';
import { PartyProvider, useParty } from '@/state/PartyContext';
import { asyncStorageAdapter } from '@/state/asyncStorageAdapter';
import { colors, fonts } from '@/theme';

/** Nothing is shown as restored until the saved session has been read (or found absent or unreadable). */
function RestoreGate({ children }: { children: React.ReactNode }) {
  const { persistence } = useParty();
  if (persistence.status === 'restoring') {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.cream }}
      >
        <LoadingBlob label="Opening your adventure" />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  // If fonts fail to load the app continues with the system font; it never blocks on them.
  if (!loaded && !error) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.cream }}
      >
        <LoadingBlob label="Warming up" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <BackendStatusProvider>
        <PartyProvider storage={asyncStorageAdapter}>
          <RestoreGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.cream },
                headerTintColor: colors.ink,
                headerTitleStyle: { fontFamily: fonts.heading },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.cream },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="status" options={{ title: 'Connection status' }} />
              <Stack.Screen name="search" options={{ title: 'Entity search' }} />
              <Stack.Screen name="party" options={{ title: 'Your party' }} />
              <Stack.Screen name="member/[id]" options={{ title: 'Taste profile' }} />
              <Stack.Screen name="discover" options={{ title: 'Discover' }} />
              <Stack.Screen name="negotiate" options={{ title: 'Plan together' }} />
              <Stack.Screen name="plan" options={{ title: 'Your plan' }} />
            </Stack>
          </RestoreGate>
        </PartyProvider>
      </BackendStatusProvider>
    </SafeAreaProvider>
  );
}
