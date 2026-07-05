import '../global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaListener } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';
import { DesktopSidebar } from '@/components/DesktopSidebar';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30,
    },
  },
});

/**
 * Ossature : sidebar persistante à gauche (tablette/desktop, une fois
 * connecté et hors écran d'auth), pile de navigation à droite. La sidebar
 * vit au niveau racine pour rester identique sur TOUS les écrans, onglets
 * comme fiches détail.
 */
function AppShell() {
  const { session } = useAuth();
  const wide = useBreakpoint() !== 'mobile';
  const segments = useSegments();
  const inAuth = segments[0] === '(auth)';
  const showSidebar = wide && !!session && !inAuth;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      {showSidebar ? <DesktopSidebar /> : null}
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="import" options={{ title: 'Import TV Time' }} />
          <Stack.Screen
            name="import-netflix"
            options={{ title: 'Import Netflix' }}
          />
          <Stack.Screen name="history" options={{ title: 'Historique' }} />
          <Stack.Screen name="pair" options={{ title: 'Associer Kodi' }} />
        </Stack>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Alimente le runtime d'insets d'Uniwind (rt.insets) pour que les
            utilitaires safe-area (pt-safe, pb-safe…) fonctionnent. Requis en
            version OSS d'Uniwind : cf. docs.uniwind.dev (SafeAreaListener →
            Uniwind.updateInsets). SafeAreaListener émet les insets dès le
            montage, y compris sur natif. */}
        <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
          <StatusBar style="light" />
          <UpdatePrompt />
          <AppShell />
        </SafeAreaListener>
      </AuthProvider>
    </QueryClientProvider>
  );
}
