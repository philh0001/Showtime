import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchPanel } from '@/components/search-panel';
import { BrandColors, Layout, Space } from '@/constants/design';
import { useSearchController } from '@/services/search-controller';

export default function SearchScreen() {
  const search = useSearchController();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>Find movies and TV shows.</Text>
        <SearchPanel
          query={search.query}
          results={search.results}
          status={search.status}
          message={search.message}
          suggestions={search.suggestions}
          onChangeQuery={search.changeQuery}
          onSubmit={search.submit}
          onClear={search.clear}
          onClearHistory={search.clearHistory}
        />
        {search.results.length > 0 && (
          <View style={styles.credits}>
            <Text style={styles.footer}>Showing movie and TV matches from the first page.</Text>
            <Text style={styles.footer}>Credits</Text>
            <Link href="https://www.themoviedb.org" accessibilityLabel="Visit TMDB">
              <Image source={require('@/assets/images/tmdb-logo.svg')} style={{ width: 100, height: 24 }} contentFit="contain" accessibilityLabel="TMDB" />
            </Link>
            <Text style={styles.footer}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BrandColors.background },
  content: {
    flex: 1,
    paddingHorizontal: Layout.pagePadding,
    paddingTop: Space.xl,
    paddingBottom: Space.xxl,
    gap: Space.lg,
    maxWidth: Layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  title: { color: BrandColors.text, fontSize: 32, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: BrandColors.textMuted, fontSize: 16, lineHeight: 24 },
  credits: { marginTop: Space.sm, gap: Space.sm },
  footer: { color: BrandColors.textMuted, fontSize: 12, lineHeight: 18 },
});
