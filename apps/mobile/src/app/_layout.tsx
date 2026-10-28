import { Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingBlob } from '@/components/LoadingBlob';
import { BackendStatusProvider } from '@/hooks/BackendStatusContext';
import { PartyProvider } from '@/state/PartyContext';
import { colors, fonts } from '@/theme';

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
        <PartyProvider>
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
          </Stack>
        </PartyProvider>
      </BackendStatusProvider>
    </SafeAreaProvider>
  );
}
