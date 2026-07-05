import { useMemo } from 'react';
import type { LibraryBadge } from '@/components/PosterCard';
import { useMovies, useTrackedShows } from '@/hooks/queries';

/**
 * Badges de statut (SUIVI / VU / À VOIR / ARRÊTÉ) pour les cartes affiche,
 * partagés entre Découvrir, Voir tout et la fiche acteur (fini la duplication).
 */
export function useLibraryBadges() {
  const tracked = useTrackedShows();
  const movies = useMovies();

  const showBadge = useMemo(() => {
    const map = new Map<number, LibraryBadge>();
    for (const show of tracked.data ?? []) {
      map.set(
        show.tmdb_id,
        show.status === 'completed'
          ? 'watched'
          : show.status === 'stopped'
            ? 'stopped'
            : show.status === 'planned'
              ? 'planned'
              : 'watching'
      );
    }
    return (id: number) => map.get(id);
  }, [tracked.data]);

  const movieBadge = useMemo(() => {
    const map = new Map<number, LibraryBadge>();
    for (const movie of movies.data ?? []) {
      map.set(movie.tmdb_id, movie.status === 'watched' ? 'watched' : 'planned');
    }
    return (id: number) => map.get(id);
  }, [movies.data]);

  return { showBadge, movieBadge };
}
