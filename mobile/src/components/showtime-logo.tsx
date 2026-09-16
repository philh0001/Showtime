import { StyleSheet, Text, View } from 'react-native';

export function ShowtimeLogo() {
  return (
    <View accessibilityRole="header" accessibilityLabel="Showtime" style={styles.logo}>
      <View style={styles.clapper} accessibilityElementsHidden>
        <View style={styles.clapperTop}>
          <View style={styles.clapperStripe} />
          <View style={styles.clapperStripe} />
          <View style={styles.clapperStripe} />
        </View>
        <View style={styles.clapperBody} />
      </View>
      <Text style={styles.wordmark}>SHOWTIME</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clapper: {
    width: 30,
    height: 25,
    justifyContent: 'flex-end',
    transform: [{ rotate: '-4deg' }],
  },
  clapperTop: {
    height: 8,
    borderRadius: 2,
    backgroundColor: '#63D7BA',
    flexDirection: 'row',
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  clapperStripe: { width: 5, height: 12, backgroundColor: '#0B0B0F', transform: [{ rotate: '28deg' }] },
  clapperBody: { height: 15, borderRadius: 2, backgroundColor: '#63D7BA' },
  wordmark: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: 1.5 },
});
