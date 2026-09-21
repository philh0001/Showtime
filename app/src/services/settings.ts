import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSettingsStorage } from './settings-storage';
import { createNotifyingStorage } from './library-changes';

const storage = createSettingsStorage(createNotifyingStorage(AsyncStorage));
export const loadSettings = storage.load;
export const setShowTrending = storage.setShowTrending;
