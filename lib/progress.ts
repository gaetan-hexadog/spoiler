import type { TmdbSeasonSummary } from './tmdb';
import type { WatchedEpisode } from './db';

export function episodeKey(season: number, episode: number): string {
  return `${season}:${episode}`;
}

export function watchedSetForShow(
  allWatched: WatchedEpisode[],
  tmdbShowId: number
): Set<string> {
  const set = new Set<string>();
  for (const row of allWatched) {
    if (row.tmdb_show_id === tmdbShowId) {
      set.add(episodeKey(row.season_number, row.episode_number));
    }
  }
  return set;
}

/** Nombre total d'épisodes hors saison 0 (épisodes spéciaux). */
export function totalEpisodes(seasons: TmdbSeasonSummary[]): number {
  return seasons
    .filter((s) => s.season_number > 0)
    .reduce((sum, s) => sum + s.episode_count, 0);
}

export function watchedCount(watched: Set<string>): number {
  let count = 0;
  for (const key of watched) {
    if (!key.startsWith('0:')) count++;
  }
  return count;
}

export interface EpisodeRef {
  season_number: number;
  episode_number: number;
}

/** Nombre d'épisodes déjà diffusés (bornés par le dernier épisode diffusé). */
export function airedTotal(
  seasons: TmdbSeasonSummary[],
  lastAired: EpisodeRef | null
): number {
  if (!lastAired) return totalEpisodes(seasons);
  let count = 0;
  for (const season of seasons) {
    if (season.season_number <= 0) continue;
    if (season.season_number < lastAired.season_number) {
      count += season.episode_count;
    } else if (season.season_number === lastAired.season_number) {
      count += Math.min(season.episode_count, lastAired.episode_number);
    }
  }
  return count;
}

/** Vrai si tous les épisodes déjà diffusés sont vus. */
export function isUpToDate(
  seasons: TmdbSeasonSummary[],
  watched: Set<string>,
  lastAired: EpisodeRef | null
): boolean {
  const next = nextEpisode(seasons, watched);
  if (!next) return true;
  if (!lastAired) return false;
  return (
    next.season > lastAired.season_number ||
    (next.season === lastAired.season_number &&
      next.episode > lastAired.episode_number)
  );
}

/**
 * Épisodes non vus jusqu'à (et incluant) l'épisode cible, hors spéciaux —
 * pour le marquage rétroactif « j'ai rattrapé jusqu'ici ».
 */
export function unwatchedUpTo(
  seasons: TmdbSeasonSummary[],
  watched: Set<string>,
  upTo: { season: number; episode: number }
): { season_number: number; episode_number: number }[] {
  const result: { season_number: number; episode_number: number }[] = [];
  for (const season of seasons) {
    const s = season.season_number;
    if (s <= 0 || s > upTo.season) continue;
    const maxEpisode =
      s === upTo.season ? upTo.episode : season.episode_count;
    for (let e = 1; e <= Math.min(maxEpisode, season.episode_count); e++) {
      if (!watched.has(episodeKey(s, e))) {
        result.push({ season_number: s, episode_number: e });
      }
    }
  }
  return result;
}

/**
 * Premier épisode non vu, dans l'ordre des saisons (hors spéciaux).
 * Retourne null si tout est vu.
 */
export function nextEpisode(
  seasons: TmdbSeasonSummary[],
  watched: Set<string>
): { season: number; episode: number } | null {
  const ordered = seasons
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);
  for (const season of ordered) {
    for (let ep = 1; ep <= season.episode_count; ep++) {
      if (!watched.has(episodeKey(season.season_number, ep))) {
        return { season: season.season_number, episode: ep };
      }
    }
  }
  return null;
}
