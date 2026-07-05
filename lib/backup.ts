import { Platform } from 'react-native';
import * as db from '@/lib/db';

/**
 * Sauvegarde des données (Pro) — phase 1 : export JSON complet partagé via la
 * feuille de partage Android/iOS (l'utilisateur choisit Google Drive, Files…)
 * ou téléchargé sur web. Phase 2 (post-RevenueCat) : OAuth Google Drive +
 * sauvegarde automatique planifiée.
 */
export interface BackupPayload {
  app: 'PopcornLog';
  version: 1;
  exported_at: string;
  tracked_shows: db.TrackedShow[];
  watched_episodes: db.WatchedEpisode[];
  user_movies: db.UserMovie[];
  user_lists: db.UserList[];
  list_items: db.ListItem[];
}

export async function buildBackup(): Promise<BackupPayload> {
  const [shows, episodes, movies, lists, items] = await Promise.all([
    db.fetchTrackedShows(),
    db.fetchAllWatchedEpisodes(),
    db.fetchMovies(),
    db.fetchLists(),
    db.fetchAllListItems(),
  ]);
  return {
    app: 'PopcornLog',
    version: 1,
    exported_at: new Date().toISOString(),
    tracked_shows: shows,
    watched_episodes: episodes,
    user_movies: movies,
    user_lists: lists,
    list_items: items,
  };
}

/** Partage/télécharge le JSON (même mécanique que l'export .ics). */
export async function exportBackup(): Promise<void> {
  const payload = await buildBackup();
  const content = JSON.stringify(payload, null, 1);
  const filename = `popcornlog-backup-${payload.exported_at.slice(0, 10)}.json`;

  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = require('expo-file-system/legacy');
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let Sharing: typeof import('expo-sharing');
  try {
    Sharing = require('expo-sharing');
  } catch {
    throw new Error(
      "Le partage de fichier nécessite la prochaine version de l'app."
    );
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Le partage n'est pas disponible sur cet appareil.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Sauvegarder mes données PopcornLog',
  });
}
