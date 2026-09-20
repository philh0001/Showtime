// React Native color schemes can cause a mismatch between
// server-rendered web content and the first browser render.
// For web, use a consistent light theme.

export function useColorScheme() {
  return 'light' as const;
}