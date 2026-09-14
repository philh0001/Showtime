/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    background: '#F7F5F2',
    surface: '#FFFFFF',
    surfaceMuted: '#EFEBE6',
    text: '#171719',
    textSecondary: '#666168',
    border: '#DED8D2',
    accent: '#087F6A',
    onAccent: '#FFFFFF',
    danger: '#B3261E',
    overlay: 'rgba(23, 23, 25, 0.55)',
    pressed: '#E5E0DA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E5E0DA',
  },
  dark: {
    background: '#0B0B0F',
    surface: '#16161B',
    surfaceMuted: '#212225',
    text: '#FFFFFF',
    textSecondary: '#A7A7B0',
    border: '#393940',
    accent: '#63D7BA',
    onAccent: '#06271F',
    danger: '#FF8A8A',
    overlay: 'rgba(0, 0, 0, 0.65)',
    pressed: '#29292F',
    backgroundElement: '#16161B',
    backgroundSelected: '#29292F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const Layout = {
  pagePadding: 20,
  pagePaddingWide: 24,
  contentMaxWidth: 1180,
  readingMaxWidth: 800,
  compactBreakpoint: 640,
  wideBreakpoint: 900,
} as const;

export const Radii = {
  small: 8,
  medium: 12,
  large: 18,
  pill: 999,
} as const;

export const MaxContentWidth = Layout.readingMaxWidth;
