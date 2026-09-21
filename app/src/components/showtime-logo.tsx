import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

export function ShowtimeLogo({ compact = false, decorative = false }: {
  compact?: boolean;
  decorative?: boolean;
}) {
  return <Image
    source={compact
      ? require('@/assets/images/showtime-mark.svg')
      : require('@/assets/images/showtime-logo.svg')}
    style={compact ? styles.mark : styles.logo}
    contentFit="contain"
    accessibilityLabel={decorative ? undefined : 'Showtime'}
    accessible={!decorative}
  />;
}

const styles = StyleSheet.create({
  logo: { width: '100%', maxWidth: 420, height: 96, marginVertical: 4 },
  mark: { width: 44, height: 44 },
});
