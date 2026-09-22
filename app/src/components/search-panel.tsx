import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { BrandColors, ControlSize, Layout, Radii, Space } from '@/constants/design';
import type { SearchResult } from '@/services/search';

type SearchPanelProps = {
  query: string;
  results: SearchResult[];
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string | null;
  suggestions: string[];
  compact?: boolean;
  placeholder?: string;
  emptyText?: string;
  onChangeQuery: (value: string) => void;
  onSubmit: (value?: string) => void | Promise<void>;
  onClear: () => void;
  onClearHistory: () => void;
};

export function SearchPanel({
  query,
  results,
  status,
  message,
  suggestions,
  compact = false,
  placeholder = 'Search movies or TV shows',
  emptyText = 'Add a title to build your Home screen.',
  onChangeQuery,
  onSubmit,
  onClear,
  onClearHistory,
}: SearchPanelProps) {
  const [failedPosterIds, setFailedPosterIds] = useState<Set<string>>(new Set());
  const [isFocused, setIsFocused] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const availableWidth = Math.max(0, Math.min(windowWidth, Layout.maxContentWidth) - Layout.pagePadding * 2);
  const resultColumns = compact ? 1 : Math.max(1, Math.min(4,
    Math.floor((availableWidth + Space.md) / (320 + Space.md))));
  const resultWidth = (availableWidth - Space.md * (resultColumns - 1)) / resultColumns;
  const grid = resultColumns > 1;

  const recentSuggestions = useMemo(() => suggestions.slice(0, compact ? 3 : undefined), [compact, suggestions]);
  const canSubmit = query.trim().length > 0 && status !== 'loading';

  return (
    <View style={[styles.wrapper, compact && styles.compact]}>
      <View style={styles.fieldRow}>
        <View style={[styles.inputWrap, isFocused && styles.inputWrapFocused]}>
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={() => void onSubmit()}
            placeholder={placeholder}
            placeholderTextColor={BrandColors.textMuted}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={100}
            selectionColor={BrandColors.textMuted}
            accessibilityLabel="Movie or TV title"
            style={styles.input}
          />
          {query.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              onPress={onClear}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search"
          disabled={!canSubmit}
          onPress={() => void onSubmit()}
          style={({ pressed }) => [styles.submitButton, !canSubmit && styles.submitDisabled, pressed && styles.submitPressed]}
        >
          <Text style={styles.submitText}>Search</Text>
        </Pressable>
      </View>

      {!compact && query.trim().length === 0 && recentSuggestions.length > 0 && (
        <View style={styles.suggestionsWrap}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>Previous searches</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={onClearHistory}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>
          {recentSuggestions.map((suggestion) => (
            <Pressable
              key={suggestion.toLocaleLowerCase()}
              accessibilityRole="button"
              accessibilityLabel={`Search again for ${suggestion}`}
              onPress={() => void onSubmit(suggestion)}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {status === 'loading' && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={BrandColors.gold} accessibilityLabel="Searching" />
          <Text style={styles.stateText}>Searching…</Text>
        </View>
      )}

      {status === 'error' && message && (
        <View style={styles.inlineMessage}>
          <Text accessibilityRole="alert" style={styles.errorText}>{message}</Text>
          <Pressable onPress={() => void onSubmit()} style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {query.trim().length > 0 && results.length === 0 && status === 'success' && (
        <Text style={styles.emptyText}>No matches for “{query.trim()}”. Try a different title.</Text>
      )}

      {query.trim().length > 0 && results.length > 0 && (
        <View style={[styles.resultsWrap, grid && styles.resultsGridWrap]}>
          <FlatList
            key={`results-${resultColumns}`}
            numColumns={resultColumns}
            columnWrapperStyle={grid ? styles.resultColumns : undefined}
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            style={styles.resultsList}
            contentContainerStyle={[styles.resultsListContent, grid && styles.resultsGridContent]}
            ListEmptyComponent={status === 'idle' ? <Text style={styles.emptyText}>{emptyText}</Text> : null}
            renderItem={({ item }) => {
              const failed = failedPosterIds.has(item.id);
              const id = item.id.replace(/^(movie|tv)-/, '');
              const route = item.mediaType === 'Movie' ? '/movie/[id]' : '/tv/[id]';
              return (
                <Link href={{ pathname: route, params: { id } }} asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`View ${item.title}, ${item.mediaType}`}
                    style={Platform.OS === 'web'
                      ? StyleSheet.flatten([styles.resultRow, grid && styles.gridResultRow, grid && { width: resultWidth }])
                      : ({ pressed }) => [styles.resultRow, grid && styles.gridResultRow,
                        grid && { width: resultWidth }, pressed && styles.resultRowPressed]}
                  >
                    {item.posterUrl && !failed ? (
                      <Image
                        source={{ uri: item.posterUrl }}
                        style={styles.poster}
                        contentFit="cover"
                        onError={() => setFailedPosterIds((current) => new Set(current).add(item.id))}
                        accessibilityLabel={`${item.title} poster`}
                      />
                    ) : (
                      <View style={[styles.poster, styles.posterFallback]}>
                        <Text style={styles.posterFallbackText}>{item.mediaType === 'Movie' ? 'Movie' : 'TV'}</Text>
                      </View>
                    )}
                    <View style={styles.resultMeta}>
                      <Text style={styles.resultTitle}>{item.title}</Text>
                      <Text style={styles.resultDetail}>{item.year ?? 'Year unknown'} · {item.mediaType}</Text>
                    </View>
                  </Pressable>
                </Link>
              );
            }}
          />
        </View>
      )}

      {query.trim().length === 0 && results.length === 0 && status === 'idle' && !compact && (
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Space.md,
    width: '100%',
    alignSelf: 'stretch',
    maxWidth: '100%',
  },
  compact: { gap: Space.sm },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.surface,
    borderColor: BrandColors.border,
    borderWidth: 1,
    borderRadius: Radii.lg,
    minHeight: ControlSize.search,
    paddingHorizontal: Space.lg,
  },
  inputWrapFocused: {
    borderColor: BrandColors.textMuted,
    backgroundColor: BrandColors.surfaceInteractive,
  },
  input: {
    flex: 1,
    color: BrandColors.text,
    fontSize: 16,
    paddingVertical: Space.sm,
  },
  clearButton: {
    marginLeft: Space.sm,
    paddingVertical: Space.xs,
    paddingHorizontal: Space.sm,
  },
  clearText: {
    color: BrandColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    minWidth: 88,
    minHeight: ControlSize.minimum,
    backgroundColor: BrandColors.surfaceInteractive,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: BrandColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.lg,
  },
  submitDisabled: {
    opacity: 0.55,
  },
  submitPressed: {
    backgroundColor: BrandColors.surfaceRaised,
  },
  submitText: {
    color: BrandColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  suggestionsWrap: {
    backgroundColor: BrandColors.surface,
    borderColor: BrandColors.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Space.md,
    gap: Space.sm,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionsTitle: {
    color: BrandColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chip: {
    backgroundColor: BrandColors.surfaceInteractive,
    borderRadius: Radii.pill,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    marginRight: Space.sm,
    marginBottom: Space.xs,
    alignSelf: 'flex-start',
  },
  chipPressed: {
    backgroundColor: BrandColors.surfaceRaised,
  },
  chipText: {
    color: BrandColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
  },
  stateText: {
    color: BrandColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  inlineMessage: {
    backgroundColor: BrandColors.surface,
    borderRadius: Radii.md,
    borderColor: BrandColors.border,
    borderWidth: 1,
    padding: Space.md,
    gap: Space.sm,
  },
  errorText: {
    color: BrandColors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.gold,
    borderRadius: Radii.pill,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  retryPressed: {
    opacity: 0.85,
  },
  retryText: {
    color: BrandColors.onGold,
    fontWeight: '700',
  },
  emptyText: {
    color: BrandColors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  resultsWrap: {
    backgroundColor: BrandColors.surface,
    borderRadius: Radii.md,
    borderColor: BrandColors.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultsGridWrap: { backgroundColor: 'transparent', borderWidth: 0, overflow: 'visible' },
  resultsList: {
    width: '100%',
  },
  resultsListContent: {
    paddingVertical: 0,
  },
  resultsGridContent: { gap: Space.md },
  resultColumns: { gap: Space.md },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space.md,
    paddingHorizontal: Space.md,
    gap: Space.md,
    minHeight: 120,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.border,
  },
  resultRowPressed: {
    backgroundColor: BrandColors.surfaceInteractive,
  },
  gridResultRow: { backgroundColor: BrandColors.surface, borderWidth: 1,
    borderColor: BrandColors.border, borderRadius: Radii.md },
  poster: {
    width: 72,
    height: 108,
    borderRadius: Radii.sm,
    backgroundColor: BrandColors.surfaceRaised,
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  posterFallbackText: {
    color: BrandColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  resultMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  resultTitle: {
    color: BrandColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  resultDetail: {
    color: BrandColors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
});
