import { useEffect } from 'react';
import { useSetShowStatus } from '@/hooks/queries';
import type { ShowStatus, TrackedShow } from '@/lib/db';
import { nextEpisode, totalEpisodes, watchedCount } from '@/lib/progress';
import type { TmdbShowDetails } from '@/lib/tmdb';

/**
 * Le statut d'une série est dérivé automatiquement du visionnage :
 * - 0 épisode vu            → « À commencer »
 * - au moins 1 épisode vu   → « En cours » (y compris à jour, série encore diffusée)
 * - tout vu + série finie   → « Terminée »
 * Seul « Abandonnée » est un choix manuel : on n'y touche jamais.
 */
export function useAutoShowStatus(
  show: TrackedShow | undefined,
  details: TmdbShowDetails | undefined,
  watched: Set<string>
) {
  const setStatus = useSetShowStatus();

  let target: ShowStatus | null = null;
  if (details && totalEpisodes(details.seasons) > 0) {
    const ended = details.status === 'Ended' || details.status === 'Canceled';
    const fullyWatched = nextEpisode(details.seasons, watched) === null;
    const seen = watchedCount(watched);
    if (fullyWatched && ended) target = 'completed';
    else if (seen === 0) target = 'planned';
    else target = 'watching';
  }

  const currentStatus = show?.status;
  const tmdbId = show?.tmdb_id;
  const { mutate } = setStatus;

  useEffect(() => {
    if (!tmdbId || !target) return;
    if (currentStatus === 'stopped' || currentStatus === target) return;
    mutate({ tmdbId, status: target });
  }, [tmdbId, target, currentStatus, mutate]);
}
