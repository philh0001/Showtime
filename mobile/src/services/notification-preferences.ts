import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_KEY = 'showtime.notifications.v1';
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
export type NotificationPreferences = { remindersEnabled: boolean };
export type NotificationResult = { status: 'available' | 'unsupported'; preferences: NotificationPreferences }
  | { status: 'unavailable' };
type NotificationCapabilities = { scheduledRemindersAvailable: boolean };

export function createNotificationPreferences(
  storage: Storage,
  capabilities: NotificationCapabilities = { scheduledRemindersAvailable: false },
) {
  return {
    async load(): Promise<NotificationResult> {
      if (!capabilities.scheduledRemindersAvailable) {
        return { status: 'unsupported', preferences: { remindersEnabled: false } };
      }
      try {
        const raw = await storage.getItem(NOTIFICATION_KEY);
        if (!raw) return { status: 'available', preferences: { remindersEnabled: false } };
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || typeof (parsed as { remindersEnabled?: unknown }).remindersEnabled !== 'boolean') {
          return { status: 'unavailable' };
        }
        return { status: 'available', preferences: { remindersEnabled: (parsed as { remindersEnabled: boolean }).remindersEnabled } };
      } catch { return { status: 'unavailable' }; }
    },
    async setRemindersEnabled(remindersEnabled: boolean) {
      if (remindersEnabled && !capabilities.scheduledRemindersAvailable) {
        throw new Error('Scheduled reminders are not available in this build.');
      }
      const current = await this.load();
      if (current.status !== 'available') throw new Error('Notification preferences unavailable.');
      await storage.setItem(NOTIFICATION_KEY, JSON.stringify({ remindersEnabled }));
    },
  };
}

export const notificationPreferences = createNotificationPreferences(AsyncStorage);
