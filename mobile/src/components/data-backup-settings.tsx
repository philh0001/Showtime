import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { backupSync } from '@/services/backup-sync';

export function DataBackupSettings() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success');
  async function exportData() {
    setBusy(true); setMessage('');
    try {
      setText(JSON.stringify(await backupSync.exportBackup(), null, 2));
      setMessageKind('success');
      setMessage('Backup created. Copy this text and keep it somewhere safe.');
    } catch { setMessageKind('error'); setMessage('Backup could not be created from local storage.'); }
    finally { setBusy(false); }
  }
  async function importData() {
    setBusy(true); setMessage('');
    try {
      await backupSync.importBackup(text);
      setMessageKind('success');
      setMessage('Backup imported. Return to Home or Profile to refresh your data.');
    } catch (error) {
      setMessageKind('error');
      setMessage(error instanceof Error ? error.message : 'Backup could not be imported.');
    }
    finally { setBusy(false); }
  }
  function confirmImport() {
    const warning = 'This will overwrite matching watchlist, progress, history, and settings data on this device.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm(warning)) void importData();
      return;
    }
    Alert.alert('Import backup?', warning, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Import', style: 'destructive', onPress: () => void importData() },
    ]);
  }
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>Local backup</Text>
    <Text style={styles.help}>Export a validated backup to move your watchlist, progress and settings to another device. Backups stay under your control and are not stored in the cloud.</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void exportData()} style={styles.button}><Text style={styles.buttonText}>Create backup</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy || !text.trim()} onPress={confirmImport} style={[styles.button, (!text.trim() || busy) && styles.disabled]}><Text style={styles.buttonText}>Import backup</Text></Pressable>
    </View>
    <TextInput accessibilityLabel="Backup JSON" multiline value={text} onChangeText={setText} placeholder="Paste a Showtime backup here" placeholderTextColor="#777780" style={styles.input} autoCapitalize="none" />
    {!!message && <Text accessibilityRole="alert" style={messageKind === 'error' ? styles.error : styles.message}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#29292F', gap: 10 },
  heading: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  help: { color: '#A7A7B0', fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  button: { backgroundColor: '#23886F', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  input: { minHeight: 110, maxHeight: 220, borderWidth: 1, borderColor: '#45454E', borderRadius: 6, color: '#FFFFFF', padding: 10, textAlignVertical: 'top', fontFamily: 'monospace' },
  message: { color: '#63D7BA', fontSize: 14, lineHeight: 20 },
  error: { color: '#FF8A8A', fontSize: 14, lineHeight: 20 },
});
