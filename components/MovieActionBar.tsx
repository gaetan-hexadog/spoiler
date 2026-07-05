import React from 'react';
import { View } from 'react-native';
import { ActionToggle } from '@/components/ActionToggle';
import { RatingField } from '@/components/RatingField';
import {
  useAddMovie,
  useMovies,
  useRemoveMovie,
  useSetMovieRating,
  useSetMovieStatus,
} from '@/hooks/queries';
import type { TmdbMovieDetails } from '@/lib/tmdb';

/**
 * Barre d'actions de la fiche film : deux boutons d'ÉTAT mutuellement exclusifs
 * (Vu · À voir). La notation n'est pas un bouton-switch : elle apparaît
 * d'elle-même quand le film est « Vu » (bloc « Ma note » partagé avec la fiche
 * série via RatingField). Jumelle exacte de ShowActionBar.
 */
export function MovieActionBar({ movie }: { movie: TmdbMovieDetails }) {
  const movies = useMovies();
  const addMovie = useAddMovie();
  const setStatus = useSetMovieStatus();
  const setRating = useSetMovieRating();
  const removeMovie = useRemoveMovie();
  const saved = (movies.data ?? []).find((m) => m.tmdb_id === movie.id);

  const watched = saved?.status === 'watched';
  const inWatchlist = saved?.status === 'watchlist';

  // Chaque bouton toggle SON propre statut. Actif → on retire ; inactif → on
  // (dé)place vers ce statut. Watched et watchlist étant exclusifs, activer
  // l'un désactive l'autre (mais cliquer un bouton déjà actif ne bascule JAMAIS
  // vers l'autre statut).
  const setStatusOrAdd = (status: 'watched' | 'watchlist') => {
    if (!saved) {
      addMovie.mutate({
        tmdb_id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        status,
      });
    } else {
      setStatus.mutate({ tmdbId: movie.id, status });
    }
  };

  const toggleWatched = () => {
    if (watched) removeMovie.mutate(movie.id);
    else setStatusOrAdd('watched');
  };

  const toggleWatchlist = () => {
    if (inWatchlist) removeMovie.mutate(movie.id);
    else setStatusOrAdd('watchlist');
  };

  return (
    <View className="gap-3">
      <View className="flex-row gap-2.5">
        <ActionToggle
          icon={watched ? 'checkmark-circle' : 'checkmark-circle-outline'}
          label="Vu"
          active={watched}
          onPress={toggleWatched}
        />
        <ActionToggle
          icon={inWatchlist ? 'bookmark' : 'bookmark-outline'}
          label="À voir"
          active={inWatchlist}
          onPress={toggleWatchlist}
        />
      </View>

      {/* La note apparaît d'elle-même une fois le film vu (pas de bouton-switch). */}
      {watched ? (
        <RatingField
          value={saved?.rating ?? null}
          onChange={(rating) => setRating.mutate({ tmdbId: movie.id, rating })}
        />
      ) : null}
    </View>
  );
}
