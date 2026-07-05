import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RatingStars } from '@/components/RatingStars';
import {
  useAddMovie,
  useMovies,
  useSetMovieRating,
  useSetMovieStatus,
} from '@/hooks/queries';
import type { TmdbMovieDetails } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

/**
 * 1b — Barre d'actions unifiée de la fiche film.
 * Réunit les deux logiques aujourd'hui éclatées (bookmark « watchlist » dans le
 * header + bouton « Vu » dans le corps) en trois actions claires et égales :
 * Vu · Watchlist · Noter.
 *
 * Remplace `actionsEl` + le bloc d'actions dans app/movie/[id].tsx.
 * Le bookmark du FloatingHeader peut être retiré (ou gardé en miroir de « Watchlist »).
 */
export function MovieActionBar({ movie }: { movie: TmdbMovieDetails }) {
  const movies = useMovies();
  const addMovie = useAddMovie();
  const setStatus = useSetMovieStatus();
  const setRating = useSetMovieRating();
  const saved = (movies.data ?? []).find((m) => m.tmdb_id === movie.id);
  const [rateOpen, setRateOpen] = useState(false);

  const watched = saved?.status === 'watched';
  const inWatchlist = saved?.status === 'watchlist';
  const showStars = rateOpen || (watched && saved?.rating != null);

  const toggleWatched = () => {
    if (!saved) {
      addMovie.mutate({
        tmdb_id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        status: 'watched',
      });
    } else {
      setStatus.mutate({
        tmdbId: movie.id,
        status: watched ? 'watchlist' : 'watched',
      });
    }
  };

  const toggleWatchlist = () => {
    if (!saved) {
      addMovie.mutate({
        tmdb_id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        status: 'watchlist',
      });
    } else {
      setStatus.mutate({
        tmdbId: movie.id,
        status: inWatchlist ? 'watched' : 'watchlist',
      });
    }
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
        <Btn
          icon="star-outline"
          label="Noter"
          active={rateOpen}
          onPress={() => setRateOpen((v) => !v)}
        />
      </View>

      {showStars ? (
        <View className="bg-surface rounded-2xl p-3">
          <RatingStars
            value={saved?.rating ?? null}
            onChange={(rating) => {
              if (!saved) {
                addMovie.mutate({
                  tmdb_id: movie.id,
                  title: movie.title,
                  poster_path: movie.poster_path,
                  status: 'watched',
                });
              }
              setRating.mutate({ tmdbId: movie.id, rating });
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
