import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CastMember, DetailExtras as Extras } from '@/services/detail-extras-rules';
import { fetchPersonDetails } from '@/services/details';
import type { PersonDetails } from '@/services/person-details-rules';

export function DetailExtras({ cast, crew, trailer, mediaType }: Extras & { mediaType: 'Movie' | 'TV' }) {
  return <View>
    {trailer && isYouTubeWatchUrl(trailer.url) && <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Watch ${trailer.name} on YouTube`}
      onPress={() => {
        if (Platform.OS === 'web') {
          window.location.assign(trailer.url);
        } else {
          void Linking.openURL(trailer.url);
        }
      }}
      style={({ pressed }) => [styles.trailer, pressed && styles.trailerPressed]}
    >
      <View style={styles.youtubeMark} accessibilityElementsHidden>
        <Text style={styles.youtubePlay}>▶</Text>
      </View>
      <Text style={styles.trailerLabel}>Watch official trailer</Text>
    </Pressable>}
    {cast.length > 0 && <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>{mediaType === 'TV' ? 'Latest-season cast' : 'Cast'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {cast.map((member) => <CastPortrait key={member.id} member={member} />)}
      </ScrollView>
    </View>}
    {crew.length > 0 && <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Key crew</Text>
      {crew.map((member) => <View key={`${member.id}:${member.job}`} style={styles.crewRow}>
        <Text style={styles.name}>{member.name}</Text><Text style={styles.secondary}>{member.job}</Text>
      </View>)}
    </View>}
  </View>;
}

function isYouTubeWatchUrl(url: string): url is `https://www.youtube.com/watch?v=${string}` {
  return /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(url);
}

function CastPortrait({ member }: { member: CastMember }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [personState, setPersonState] = useState<'idle' | 'loading' | 'error'>('idle');
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let active = true;
    void fetchPersonDetails(member.id, controller.signal).then((details) => {
      if (active) {
        setPerson(details);
        setPersonState('idle');
      }
    }).catch((error) => {
      if (active && !(error instanceof Error && error.name === 'AbortError')) {
        setPersonState('error');
      }
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [member.id, open]);
  const portrait = <View style={styles.portrait}>
    {member.profileUrl && !failed ? <Image source={{ uri: member.profileUrl }} style={StyleSheet.absoluteFill}
      contentFit="cover" accessibilityLabel={member.name} onError={() => setFailed(true)} />
      : <Text style={styles.secondary}>No photo</Text>}
  </View>;
  return <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View details for ${member.name}`}
      onPress={() => {
        setPerson(null);
        setPersonState('loading');
        setOpen(true);
      }}
      style={({ pressed }) => [styles.person, pressed && styles.pressed]}
    >
      {portrait}
      <Text style={styles.name} numberOfLines={2}>{member.name}</Text>
      {member.character && <Text style={styles.secondary} numberOfLines={2}>{member.character}</Text>}
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
        <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
          {portrait}
          <Text style={styles.modalName}>{member.name}</Text>
          {member.character && <Text style={styles.modalRole}>As {member.character}</Text>}
          {personState === 'loading' && <View style={styles.detailState}>
            <ActivityIndicator color="#63D7BA" accessibilityLabel="Loading actor details" />
            <Text style={styles.modalDescription}>Loading actor details…</Text>
          </View>}
          {personState === 'error' && <Text accessibilityRole="alert" style={styles.modalDescription}>
            Actor details are temporarily unavailable.
          </Text>}
          {personState === 'idle' && person && <>
            {person.biography && <Text numberOfLines={3} style={styles.modalDescription}>{person.biography}</Text>}
            {person.birthday && <Text style={styles.modalMeta}>Born {person.birthday}</Text>}
            {person.knownFor.length > 0 && <Text numberOfLines={1} style={styles.modalMeta}>Known for: {person.knownFor.slice(0, 3).join(', ')}</Text>}
            {!person.biography && !person.birthday && person.knownFor.length === 0
              && <Text style={styles.modalDescription}>No additional details available.</Text>}
          </>}
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trailer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, marginTop: 16 },
  trailerPressed: { opacity: 0.65 },
  youtubeMark: { width: 28, height: 20, borderRadius: 5, backgroundColor: '#FF0000', alignItems: 'center', justifyContent: 'center' },
  youtubePlay: { color: '#FFFFFF', fontSize: 11, lineHeight: 12, marginLeft: 1 },
  trailerLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  section: { marginTop: 24, gap: 12 },
  heading: { color: '#FFFFFF', fontSize: 21, fontWeight: '700' },
  rail: { gap: 14 },
  person: { width: 104, gap: 6 },
  pressed: { opacity: 0.7 },
  portrait: { width: 104, height: 156, borderRadius: 8, overflow: 'hidden', backgroundColor: '#212225', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', lineHeight: 20, flexShrink: 1 },
  secondary: { color: '#A7A7B0', fontSize: 13, lineHeight: 19, flexShrink: 1 },
  crewRow: { gap: 3, paddingVertical: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#16161B', borderRadius: 16, padding: 20, alignItems: 'center', gap: 10 },
  modalName: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  modalRole: { color: '#63D7BA', fontSize: 16, textAlign: 'center' },
  modalDescription: { color: '#A7A7B0', fontSize: 14, textAlign: 'center' },
  detailState: { alignItems: 'center', gap: 8 },
  modalMeta: { color: '#D5D5DC', fontSize: 14, textAlign: 'center' },
  closeButton: { backgroundColor: '#FFFFFF', borderRadius: 10, marginTop: 4, paddingHorizontal: 20, paddingVertical: 10 },
  closeText: { color: '#0B0B0F', fontSize: 15, fontWeight: '700' },
});
