import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { RatingStars } from '@/components/RatingStars';
import {
  useAddMovie,
  useMovies,
  useRemoveMovie,
  useSetMovieRating,
  useSetMovieStatus,
} from '@/hooks/queries';
import type { TmdbMovieDetails } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

/**
 * Barre d'actions de la fiche film : deux boutons d'ÉTAT mutuellement exclusifs
 * (Vu · Watchlist). La notation n'est pas un bouton-switch : elle apparaît
 * d'elle-même quand le film est « Vu » (comme « Ma note » sur la fiche série).
 * Remplace `actionsEl` + le bloc d'actions dans app/movie/[id].tsx.
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

  const Btn = ({
    icon,
    label,
    active,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    active?: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-2xl py-3 items-center gap-1 ${
        active ? 'bg-accent' : 'bg-surface'
      }`}
      style={({ pressed }) => (pressed ? { opacity: 0.75 } : undefined)}
    >
      <Ionicons
        name={icon}
        size={22}
        color={active ? colors.accentText : colors.text}
      />
      <Text
        className={`text-[11.5px] font-extrabold ${
          active ? 'text-accent-fg' : 'text-fg'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View className="gap-3">
      <View className="flex-row gap-2.5">
        <Btn
          icon={watched ? 'checkmark-circle' : 'checkmark-circle-outline'}
          label="Vu"
          active={watched}
          onPress={toggleWatched}
        />
        <Btn
          icon={inWatchlist ? 'bookmark' : 'bookmark-outline'}
          label="Watchlist"
          active={inWatchlist}
          onPress={toggleWatchlist}
        />
      </View>

      {/* La note apparaît d'elle-même une fois le film vu (pas de bouton-switch). */}
      {watched ? (
        <View className="bg-surface rounded-2xl p-3">
          <RatingStars
            value={saved?.rating ?? null}
            onChange={(rating) => setRating.mutate({ tmdbId: movie.id, rating })}
          />
        </View>
      ) : null}
    </View>
  );
}
