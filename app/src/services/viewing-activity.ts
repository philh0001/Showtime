import AsyncStorage from '@react-native-async-storage/async-storage';
import { createViewingActivityStorage } from './viewing-activity-storage';

const storage = createViewingActivityStorage(AsyncStorage);
export const loadViewingActivity = storage.load;
export const recordViewingActivity = storage.record;
