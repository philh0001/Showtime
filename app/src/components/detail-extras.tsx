import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CastMember, DetailExtras as Extras } from '@/services/detail-extras-rules';

export function DetailExtras({ cast, crew, trailer, mediaType }: Extras & { mediaType: 'Movie' | 'TV' }) {
  return <View>
    {trailer && <Link href={trailer.url} accessibilityLabel={`Watch ${trailer.name} on YouTube`} style={styles.trailer}>
      Watch official trailer
    </Link>}
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

function CastPortrait({ member }: { member: CastMember }) {
  const [failed, setFailed] = useState(false);
  return <View style={styles.person}>
    <View style={styles.portrait}>
      {member.profileUrl && !failed ? <Image source={{ uri: member.profileUrl }} style={StyleSheet.absoluteFill}
        contentFit="cover" accessibilityLabel={member.name} onError={() => setFailed(true)} />
        : <Text style={styles.secondary}>No photo</Text>}
    </View>
    <Text style={styles.name} numberOfLines={2}>{member.name}</Text>
    {member.character && <Text style={styles.secondary} numberOfLines={2}>{member.character}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  trailer: { color: '#63D7BA', fontSize: 16, fontWeight: '700', paddingVertical: 16, marginTop: 16, textDecorationLine: 'underline' },
  section: { marginTop: 24, gap: 12 },
  heading: { color: '#FFFFFF', fontSize: 21, fontWeight: '700' },
  rail: { gap: 14 },
  person: { width: 104, gap: 6 },
  portrait: { width: 104, height: 156, borderRadius: 8, overflow: 'hidden', backgroundColor: '#212225', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', lineHeight: 20, flexShrink: 1 },
  secondary: { color: '#A7A7B0', fontSize: 13, lineHeight: 19, flexShrink: 1 },
  crewRow: { gap: 3, paddingVertical: 4 },
});
