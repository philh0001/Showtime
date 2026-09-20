import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Only the server's public address belongs in the mobile app, never its token.
export function getServerUrl() {
  const configured = process.env.EXPO_PUBLIC_SEARCH_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri;
  if (__DEV__ && hostUri) return `http://${new URL(`http://${hostUri}`).hostname}:3001`;
  if (__DEV__ && Platform.OS === 'web') return 'http://localhost:3001';
  throw new Error('The content service is not available yet.');
}
