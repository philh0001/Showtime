import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

export function ShowtimeLogo({ compact = false, decorative = false }: {
  compact?: boolean;
  decorative?: boolean;
}) {
  return <Image
    source={compact
      ? require('@/assets/images/showtime-mark.svg')
      : require('@/assets/images/showtime-logo.png')}
    style={compact ? styles.mark : styles.logo}
    contentFit="contain"
    accessibilityLabel={decorative ? undefined : 'Showtime'}
    accessible={!decorative}
  />;
}

const styles = StyleSheet.create({
  // Keep the supplied artwork's full aspect ratio, including the subtitle.
  logo: { width: '100%', maxWidth: 420, aspectRatio: 1983 / 793 },
  mark: { width: 44, height: 44 },
});
