import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const colors = dark ? Colors.dark : Colors.light;
  const baseTheme = dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
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
