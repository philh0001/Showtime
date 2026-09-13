import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSettingsStorage } from './settings-storage';

const storage = createSettingsStorage(AsyncStorage);
export const loadSettings = storage.load;
export const setShowTrending = storage.setShowTrending;
