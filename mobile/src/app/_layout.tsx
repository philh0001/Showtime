import { DarkTheme, Stack, ThemeProvider } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{
        headerStyle: { backgroundColor: '#0B0B0F' },
        headerTintColor: '#FFFFFF',
        contentStyle: { backgroundColor: '#0B0B0F' },
        headerBackTitle: 'Back',
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="movie/[id]" options={{ title: 'Movie details' }} />
        <Stack.Screen name="tv/[id]" options={{ title: 'TV details' }} />
      </Stack>
    </ThemeProvider>
  );
}
