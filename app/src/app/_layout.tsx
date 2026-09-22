import { DarkTheme, Stack, ThemeProvider } from 'expo-router';

import { BrandColors } from '@/constants/design';
import { AuthProvider } from '@/hooks/use-auth';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={{
          headerStyle: { backgroundColor: BrandColors.background },
          headerTintColor: BrandColors.text,
          contentStyle: { backgroundColor: BrandColors.background },
          headerBackTitle: 'Back',
        }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="movie/[id]" options={{ title: 'Movie details' }} />
          <Stack.Screen name="tv/[id]" options={{ title: 'TV details' }} />
          <Stack.Screen name="history" options={{ title: 'Viewing history' }} />
          <Stack.Screen name="account" options={{ title: 'Account' }} />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
