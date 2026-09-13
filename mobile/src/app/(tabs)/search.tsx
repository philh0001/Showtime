import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchTitles, type SearchResult } from '@/services/search';
import {
  clearRecentSearches,
  loadRecentSearches,
  recordRecentSearch,
} from '@/services/search-history';
import { filterRecentSearches } from '@/services/search-history-rules';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    loadRecentSearches()
      .then((searches) => {
        if (active) setRecentSearches(searches);
      })
      .catch(() => {
        // Search still works when optional local history is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  function changeQuery(value: string) {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setQuery(value);
    setResults([]);
    setStatus('idle');
  }

  async function submit(value = query) {
    const searchQuery = value.trim();
    if (!searchQuery) return;
    setQuery(searchQuery);
    Keyboard.dismiss();
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setStatus('loading');
    setResults([]);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const matches = await searchTitles(searchQuery, controller.signal);
      if (activeRequest.current !== controller) return;
      setResults(matches);
      setStatus('success');
      recordRecentSearch(searchQuery).then(setRecentSearches).catch(() => {
        // A storage failure must not turn a successful search into an error.
      });
    } catch {
      if (activeRequest.current !== controller) return;
      setStatus('error');
    } finally {
      clearTimeout(timeout);
    }
  }

  const suggestions = filterRecentSearches(recentSearches, query);

  function clearHistory() {
    setRecentSearches([]);
    clearRecentSearches().catch(() => {
      // The in-memory list can still be cleared for this session.
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>Find movies and TV shows.</Text>
        <View style={styles.form}>
          <TextInput
            accessibilityLabel="Movie or TV title"
            style={styles.input}
            placeholder="Enter a title"
            placeholderTextColor="#A7A7B0"
            value={query}
            onChangeText={changeQuery}
            onSubmitEditing={() => void submit()}
            returnKeyType="search"
            maxLength={100}
            autoCorrect={false}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!query.trim() || status === 'loading'}
            onPress={() => void submit()}
            style={({ pressed }) => [styles.button, (!query.trim() || status === 'loading' || pressed) && styles.dimmed]}>
            <Text style={styles.buttonText}>Search</Text>
          </Pressable>
        </View>
        {status === 'idle' && suggestions.length > 0 && (
          <View style={styles.suggestions}>
            <View style={styles.suggestionHeader}>
              <Text style={styles.suggestionHeading}>
                {query.trim() ? 'Previous searches' : 'Recent searches'}
              </Text>
              <Pressable accessibilityRole="button" onPress={clearHistory} hitSlop={8}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            </View>
            {suggestions.map((suggestion) => (
              <Pressable
                key={suggestion.toLocaleLowerCase()}
                accessibilityRole="button"
                accessibilityLabel={`Search again for ${suggestion}`}
                onPress={() => void submit(suggestion)}
                style={({ pressed }) => [styles.suggestion, pressed && styles.dimmed]}>
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {status === 'loading' && <ActivityIndicator accessibilityLabel="Searching" color="#FFFFFF" style={styles.message} />}
        {status === 'error' && <Text accessibilityRole="alert" style={styles.message}>Could not load results. Check your connection and try again.</Text>}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={status === 'idle'
            ? <Text style={styles.message}>Search by movie or TV title to get started.</Text>
            : status === 'success'
              ? <Text style={styles.message}>No movie or TV matches on the first page. Try a different title.</Text>
              : null}
          ListFooterComponent={<View style={styles.credits}>
            {results.length > 0 && <Text style={styles.footer}>Showing movie and TV matches from the first page.</Text>}
            <Text style={styles.footer}>Credits</Text>
            <Link href="https://www.themoviedb.org" accessibilityLabel="Visit TMDB">
              <Image source={require('@/assets/images/tmdb-logo.svg')} style={{ width: 100, height: 24 }} contentFit="contain" accessibilityLabel="TMDB" />
            </Link>
            <Text style={styles.footer}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
          </View>}
          renderItem={({ item }) => <ResultRow item={item} />}
        />
      </View>
    </SafeAreaView>
  );
}

function ResultRow({ item }: { item: SearchResult }) {
  const [failed, setFailed] = useState(false);
  const id = item.id.replace(/^(movie|tv)-/, '');
  return (
    <Link href={{ pathname: item.mediaType === 'Movie' ? '/movie/[id]' : '/tv/[id]', params: { id } }} asChild>
    <Pressable accessibilityRole="link" accessibilityLabel={`View ${item.title}, ${item.mediaType}`} style={Platform.OS === 'web' ? styles.row : ({ pressed }) => [styles.row, pressed && styles.dimmed]}>
      {item.posterUrl && !failed
        ? <Image source={{ uri: item.posterUrl }} style={styles.poster} contentFit="cover" onError={() => setFailed(true)} accessibilityLabel={`${item.title} poster`} />
        : <View style={[styles.poster, styles.placeholder]}><Text style={styles.placeholderText}>No poster</Text></View>}
      <View style={styles.details}>
        <Text style={styles.resultTitle}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.year ?? 'Year unknown'} · {item.mediaType}</Text>
      </View>
    </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0F' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 96 : 24 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#A7A7B0', fontSize: 16, lineHeight: 24 },
  form: { flexDirection: 'row', gap: 12, marginVertical: 24 },
  suggestions: { backgroundColor: '#16161B', borderRadius: 12, marginBottom: 20, overflow: 'hidden' },
  suggestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  suggestionHeading: { color: '#A7A7B0', fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  clearText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  suggestion: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#393940' },
  suggestionText: { color: '#FFFFFF', fontSize: 16 },
  input: { flex: 1, minWidth: 0, color: '#FFFFFF', backgroundColor: '#212225', borderRadius: 12, padding: 14, fontSize: 16 },
  button: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', minHeight: 48 },
  buttonText: { color: '#0B0B0F', fontWeight: '700', fontSize: 16 },
  dimmed: { opacity: 0.5 },
  list: { paddingBottom: 120 },
  row: { flexDirection: 'row', gap: 16, marginBottom: 20, alignItems: 'center' },
  poster: { width: 80, height: 120, borderRadius: 8, backgroundColor: '#212225' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#A7A7B0', fontSize: 12 },
  details: { flex: 1, gap: 8 },
  resultTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  message: { color: '#A7A7B0', fontSize: 16, lineHeight: 24, marginBottom: 20 },
  footer: { color: '#A7A7B0', fontSize: 13, lineHeight: 20 },
  credits: { gap: 12, paddingTop: 16 },
});
