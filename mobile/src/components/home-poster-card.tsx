import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewingProgress } from '@/services/viewing-summary';
import { useTheme } from '@/hooks/use-theme';

export type HomePosterItem = {
  id: number;
  mediaType: 'Movie' | 'TV';
  title: string;
  year: string | null;
  posterUrl: string | null;
};

export function HomePosterCard({
  item,
  statusLabel,
  progress,
  compact = false,
}: {
  item: HomePosterItem;
  statusLabel?: 'Watched' | 'Completed';
  progress?: ViewingProgress;
  compact?: boolean;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Link
      href={{
        pathname: item.mediaType === 'Movie' ? '/movie/[id]' : '/tv/[id]',
        params: { id: String(item.id) },
      }}
      asChild
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${item.title}, ${item.mediaType}${statusLabel ? `, ${statusLabel.toLowerCase()}` : ''}`}
        style={Platform.OS === 'web' ? StyleSheet.flatten([styles.card, compact && styles.compactCard])
          : ({ pressed }) => [styles.card, compact && styles.compactCard, pressed && styles.pressed]}
      >
        <View style={[styles.poster, compact && styles.compactPoster]}>
          <View style={[styles.posterContent, statusLabel && styles.watchedPoster]}>
            {item.posterUrl && !imageFailed
              ? <Image
                source={{ uri: item.posterUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessibilityLabel={`${item.title} poster`}
                onError={() => setImageFailed(true)}
              />
              : <Text style={styles.fallback}>No poster</Text>}
          </View>
          {statusLabel && !compact && <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>}
        </View>
        <View style={[styles.info, compact && styles.compactInfo]}>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {item.year ?? 'Year unknown'} · {item.mediaType}
        </Text>
        {compact && statusLabel && <Text style={styles.compactStatus}>{statusLabel}</Text>}
        {progress && <View style={styles.progressGroup}>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`${item.title} viewing progress`}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.fraction * 100), text: `${progress.watched} of ${progress.total} seasons watched` }}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.fraction * 100)}
            aria-valuetext={`${progress.watched} of ${progress.total} seasons watched`}
            style={styles.progressTrack}
          >
            <View style={[styles.progressFill, { width: `${progress.fraction * 100}%` }]} />
          </View>
          <Text style={styles.meta}>{progress.watched} of {progress.total} seasons</Text>
        </View>}
        </View>
      </Pressable>
    </Link>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  card: { width: 126, gap: 6 },
  info: { gap: 6 },
  compactCard: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14 },
  compactPoster: { width: 72, height: 108, borderRadius: 8 },
  compactInfo: { flex: 1, gap: 8 },
  compactStatus: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  progressGroup: { gap: 6, marginTop: 3 },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.accent },
  poster: {
    width: 126,
    height: 189,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterContent: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  watchedPoster: { opacity: 0.55 },
  statusBadge: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  statusBadgeText: { color: colors.onAccent, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  fallback: { color: colors.textSecondary, fontSize: 13 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  meta: { color: colors.textSecondary, fontSize: 12 },
  pressed: { opacity: 0.65 },
});
}
