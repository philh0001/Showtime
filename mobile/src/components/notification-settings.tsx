import { StyleSheet, Switch, Text, View } from 'react-native';

export function NotificationSettings() {
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>Notifications</Text>
    <View style={styles.row}>
      <View style={styles.labelGroup}>
        <Text style={styles.label}>Episode reminders</Text>
        <Text style={styles.status}>Not available in this build</Text>
      </View>
      <Switch accessibilityLabel="Episode reminders unavailable" value={false} disabled
        trackColor={{ false: '#38383F', true: '#23886F' }} thumbColor="#FFFFFF" />
    </View>
    <Text style={styles.help}>Upcoming episodes remain available on Home. Reminder controls will be enabled when scheduled notifications are included.</Text>
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#29292F', gap: 10 },
  heading: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 8 },
  labelGroup: { flex: 1, gap: 3 },
  label: { color: '#DDDEE3', fontSize: 16, fontWeight: '600' },
  status: { color: '#8D8D96', fontSize: 13 },
  help: { color: '#A7A7B0', fontSize: 14, lineHeight: 20 },
});
