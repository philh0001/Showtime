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

export function HomePosterCard({ item }: { item: HomePosterItem }) {
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
        accessibilityLabel={`Open ${item.title}, ${item.mediaType}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.poster}>
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
  fallback: { color: '#A7A7B0', fontSize: 13 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  meta: { color: '#A7A7B0', fontSize: 12 },
  pressed: { opacity: 0.65 },
});
