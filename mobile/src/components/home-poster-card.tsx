import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
}: {
  item: HomePosterItem;
  statusLabel?: 'Watched' | 'Completed';
}) {
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
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.poster}>
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
          {statusLabel && <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>}
        </View>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {item.year ?? 'Year unknown'} · {item.mediaType}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { width: 126, gap: 6 },
  poster: {
    width: 126,
    height: 189,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#212225',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  statusBadgeText: { color: '#0B0B0F', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  fallback: { color: '#A7A7B0', fontSize: 13 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  meta: { color: '#A7A7B0', fontSize: 12 },
  pressed: { opacity: 0.65 },
});
