import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>SHOWTIME</Text>

        <Text style={styles.tagline}>
          Track what you watch. Discover what&apos;s next.
        </Text>

        <Pressable
          style={styles.button}
          onPress={() =>
            Alert.alert('Showtime', 'We’re ready to start building 🎬')
          }
        >
          <Text style={styles.buttonText}>Start exploring</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 4,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  tagline: {
    fontSize: 18,
    color: '#A7A7B0',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  buttonText: {
    color: '#0B0B0F',
    fontSize: 16,
    fontWeight: '700',
  },
});