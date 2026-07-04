import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Expo Go (Android) ne supporte plus expo-notifications depuis le SDK 53,
// et le web n'a pas de notifications planifiées : le module n'est chargé
// que dans un vrai build natif (APK / development build).
export const notificationsAvailable =
  Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null = null;
function getModule(): NotificationsModule | null {
  if (!notificationsAvailable) return null;
  if (!cached) {
    cached = require('expo-notifications') as NotificationsModule;
    // Affichage des notifications quand l'app est au premier plan.
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      cached
        .setNotificationChannelAsync('episodes', {
          name: 'Sorties d’épisodes',
          importance: cached.AndroidImportance.DEFAULT,
        })
        .catch(() => {});
    }
  }
  return cached;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const Notifications = getModule();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export interface EpisodeNotification {
  showName: string;
  season: number;
  episode: number;
  airDate: string; // YYYY-MM-DD
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Replanifie les notifications locales : une par épisode à venir,
 * le jour de sa diffusion à 9 h (max 60, limite système).
 */
export async function syncEpisodeNotifications(
  items: EpisodeNotification[]
): Promise<void> {
  const Notifications = getModule();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const upcoming = items
    .map((item) => ({
      ...item,
      fireDate: new Date(`${item.airDate}T09:00:00`),
    }))
    .filter((item) => item.fireDate.getTime() > now)
    .sort((a, b) => a.fireDate.getTime() - b.fireDate.getTime())
    .slice(0, 60);

  for (const item of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.showName,
        body: `S${pad(item.season)}E${pad(item.episode)} est disponible aujourd'hui 🍿`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.fireDate,
        channelId: 'episodes',
      },
    });
  }
}

export async function clearEpisodeNotifications(): Promise<void> {
  const Notifications = getModule();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
