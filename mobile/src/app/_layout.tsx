import { DarkTheme, Stack, ThemeProvider } from 'expo-router';

import { BrandColors } from '@/constants/design';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  return (
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
      </Stack>
    </ThemeProvider>
  );
}
