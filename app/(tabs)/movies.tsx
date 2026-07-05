import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text } from 'react-native';
import { useActionSheet } from '@/components/ActionSheet';
import { LibraryToolbar, type ToolbarOption } from '@/components/LibraryToolbar';
import { MovieRowCard } from '@/components/MovieRowCard';
import { PosterCard } from '@/components/PosterCard';
import { PosterGridSkeleton, RowListSkeleton } from '@/components/Skeleton';
import { EmptyState, Screen } from '@/components/ui';
import { useMovies, useRemoveMovie, useSetMovieStatus } from '@/hooks/queries';
import { useGridColumns } from '@/hooks/useGridColumns';
import { usePersistedState } from '@/hooks/usePersistedState';
import type { MovieStatus, UserMovie } from '@/lib/db';
import { colors } from '@/lib/theme';

type Sort = 'activity' | 'added' | 'alpha' | 'rating';

const SORTS: ToolbarOption<Sort>[] = [
  { value: 'activity', label: 'Vu récemment' },
  { value: 'added', label: 'Ajout' },
  { value: 'alpha', label: 'A → Z' },
  { value: 'rating', label: 'Note' },
];

const MOVIE_FILTERS: ToolbarOption<MovieStatus>[] = [
  { value: 'watchlist', label: 'À voir' },
  { value: 'watched', label: 'Vus' },
];

export default function MoviesScreen() {
  const router = useRouter();
  const [movieFilter, setMovieFilter] = useState<MovieStatus>('watchlist');
  const [grid, setGrid] = usePersistedState('grid', true);
  const [sort, setSort] = usePersistedState<Sort>('sort', 'activity');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searching = searchOpen && search.trim().length > 0;
  const columns = useGridColumns();

  const movies = useMovies();
  const setMovieStatus = useSetMovieStatus();
  const removeMovie = useRemoveMovie();
  const { show: openSheet, sheet } = useActionSheet();

  // Actions rapides film (long-press).
  const openMovieActions = (movie: UserMovie) =>
    openSheet({
      title: movie.title,
      actions: [
        movie.status === 'watchlist'
          ? {
              label: '✓ Marquer comme vu',
              variant: 'primary' as const,
              onPress: () =>
                setMovieStatus.mutate({
                  tmdbId: movie.tmdb_id,
                  status: 'watched',
                }),
            }
          : {
              label: 'Remettre dans la watchlist',
              onPress: () =>
                setMovieStatus.mutate({
                  tmdbId: movie.tmdb_id,
                  status: 'watchlist',
                }),
            },
        {
          label: 'Retirer de mes films',
          variant: 'danger' as const,
          onPress: () => removeMovie.mutate(movie.tmdb_id),
        },
      ],
    });

  const filteredMovies = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (movies.data ?? []).filter((movie) =>
      searching
        ? movie.title.toLowerCase().includes(query)
        : movie.status === movieFilter
    );
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'alpha':
          return a.title.localeCompare(b.title, 'fr');
        case 'added':
          return b.added_at.localeCompare(a.added_at);
        case 'rating':
          return (
            (b.rating ?? 0) - (a.rating ?? 0) ||
            a.title.localeCompare(b.title, 'fr')
          );
        default:
          return (b.watched_at ?? b.added_at).localeCompare(
            a.watched_at ?? a.added_at
          );
      }
    });
  }, [movies.data, movieFilter, sort, searching, search]);

  const toolbar = (
    <LibraryToolbar
      filters={MOVIE_FILTERS}
      activeFilter={movieFilter}
      onSelectFilter={setMovieFilter}
      sorts={SORTS}
      sort={sort}
      onSelectSort={setSort}
      grid={grid}
      onToggleGrid={() => setGrid(!grid)}
      searchOpen={searchOpen}
      onToggleSearch={() => {
        if (searchOpen) setSearch('');
        setSearchOpen(!searchOpen);
      }}
      search={search}
      onChangeSearch={setSearch}
      searchPlaceholder="Chercher dans mes films…"
    />
  );

  if (movies.isLoading) {
    return (
      <Screen>
        {toolbar}
        {grid ? <PosterGridSkeleton /> : <RowListSkeleton />}
      </Screen>
    );
  }

  const refreshControl = (
    <RefreshControl
      refreshing={movies.isRefetching}
      onRefresh={() => movies.refetch()}
      tintColor={colors.accent}
    />
  );

  const moviesTitle = searching
    ? `Résultats · ${filteredMovies.length}`
    : `${
        MOVIE_FILTERS.find((filter) => filter.value === movieFilter)?.label ?? ''
      } · ${filteredMovies.length}`;

  return (
    <Screen>
      {toolbar}
      {filteredMovies.length ? (
        grid ? (
          <FlatList
            key={`movies-grid-${columns}`}
            data={filteredMovies}
            numColumns={columns}
            keyExtractor={(item) => String(item.tmdb_id)}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 32 }}
            refreshControl={refreshControl}
            ListHeaderComponent={
              <Text className="text-fg text-lg font-bold px-4 pt-3 pb-3">
                {moviesTitle}
              </Text>
            }
            renderItem={({ item }) => (
              <PosterCard
                title={item.title}
                posterPath={item.poster_path}
                subtitle={
                  item.rating
                    ? `★ ${item.rating}/10`
                    : item.status === 'watched'
                      ? 'Vu'
                      : undefined
                }
                columns={columns}
                onPress={() => router.push(`/movie/${item.tmdb_id}`)}
                onLongPress={() => openMovieActions(item)}
              />
            )}
          />
        ) : (
          <FlatList
            key="movies-list"
            data={filteredMovies}
            keyExtractor={(item) => String(item.tmdb_id)}
            contentContainerStyle={{
              paddingBottom: 32,
              width: '100%',
              maxWidth: 760,
              alignSelf: 'center',
            }}
            refreshControl={refreshControl}
            ListHeaderComponent={
              <Text className="text-fg text-lg font-bold px-4 pt-3 pb-3">
                {moviesTitle}
              </Text>
            }
            renderItem={({ item }) => (
              <MovieRowCard
                movie={item}
                onLongPress={() => openMovieActions(item)}
              />
            )}
          />
        )
      ) : (
        <EmptyState
          title={movieFilter === 'watchlist' ? 'Watchlist vide' : 'Aucun film vu'}
          subtitle="Ajoute des films depuis l'onglet Découvrir."
        />
      )}
      {sheet}
    </Screen>
  );
}
