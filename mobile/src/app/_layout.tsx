import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
