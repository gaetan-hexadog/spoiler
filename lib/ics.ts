import { Platform } from 'react-native';

export interface IcsEpisode {
  showName: string;
  season: number;
  episode: number;
  episodeName?: string;
  airDate: string; // YYYY-MM-DD
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Échappe les caractères réservés iCalendar (RFC 5545). */
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Construit un VCALENDAR des diffusions à venir : un événement « journée
 * entière » par épisode (l'heure précise de mise en ligne varie selon les
 * plateformes — la date seule est fiable).
 */
export function buildEpisodesIcs(episodes: IcsEpisode[]): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const events = episodes.map((e) => {
    const date = e.airDate.replace(/-/g, '');
    const next = new Date(`${e.airDate}T00:00:00`);
    next.setDate(next.getDate() + 1);
    const dateEnd = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
    const code = `S${pad(e.season)}E${pad(e.episode)}`;
    const summary = `${e.showName} — ${code}`;
    const description = e.episodeName ? `${code} · ${e.episodeName}` : code;
    return [
      'BEGIN:VEVENT',
      `UID:popcornlog-${esc(e.showName).replace(/[^A-Za-z0-9]/g, '')}-${code}-${date}@popcornlog`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${date}`,
      `DTEND;VALUE=DATE:${dateEnd}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(description)}`,
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PopcornLog//Calendrier des diffusions//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PopcornLog — diffusions',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/**
 * Exporte le fichier .ics :
 *  - web : téléchargement direct (Blob)
 *  - natif : écriture dans le cache + feuille de partage. `expo-sharing` est
 *    chargé paresseusement : sur un build qui ne l'embarque pas encore (OTA),
 *    on échoue proprement au lieu de crasher au chargement du module.
 */
export async function exportIcs(content: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
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
    throw new Error("Le partage de fichier n'est pas disponible sur cet appareil.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'text/calendar',
    dialogTitle: 'Exporter le calendrier des diffusions',
    UTI: 'com.apple.ical.ics',
  });
}
