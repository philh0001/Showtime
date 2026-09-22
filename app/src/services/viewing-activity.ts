import AsyncStorage from '@react-native-async-storage/async-storage';
import { createViewingActivityStorage } from './viewing-activity-storage';
import { createNotifyingStorage } from './library-changes';

const storage = createViewingActivityStorage(createNotifyingStorage(AsyncStorage));
export const loadViewingActivity = storage.load;
export const recordViewingActivity = storage.record;
