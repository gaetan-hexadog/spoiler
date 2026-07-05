import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useActionSheet } from '@/components/ActionSheet';
import { BottomSheet } from '@/components/BottomSheet';
import { Carousel } from '@/components/Carousel';
import { HomeHero } from '@/components/HomeHero';
import { MovieRowCard } from '@/components/MovieRowCard';
import { PosterCard } from '@/components/PosterCard';
import { ShowGridCard } from '@/components/ShowGridCard';
import { ShowProgressCard } from '@/components/ShowProgressCard';
import { PosterGridSkeleton, RowListSkeleton } from '@/components/Skeleton';
import { UpNextCard } from '@/components/UpNextCard';
import { Button, EmptyState, Input, Screen } from '@/components/ui';
import {
  useAllWatchedEpisodes,
  useMovies,
  useRemoveMovie,
  useSetMovieStatus,
  useTrackedShows,
  useTrendingShows,
} from '@/hooks/queries';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useGridColumns } from '@/hooks/useGridColumns';
import { usePersistedState } from '@/hooks/usePersistedState';
import type { UserMovie } from '@/lib/db';
import type { MovieStatus, ShowStatus, TrackedShow } from '@/lib/db';
import { episodeKey, isUpToDate } from '@/lib/progress';
import { getShowDetails, type TmdbShowDetails } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

type Segment = 'shows' | 'movies';
type ShowFilter = ShowStatus | 'all' | 'uptodate';

/** Sans visionnage depuis 30 jours → « À reprendre ». */
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
type Sort = 'activity' | 'added' | 'alpha' | 'rating';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'activity', label: 'Vu récemment' },
  { value: 'added', label: 'Ajout' },
  { value: 'alpha', label: 'A → Z' },
  { value: 'rating', label: 'Note' },
];

const SHOW_FILTERS: { value: ShowFilter; label: string }[] = [
  { value: 'watching', label: 'En cours' },
  { value: 'uptodate', label: 'À jour' },
  { value: 'planned', label: 'À commencer' },
  { value: 'completed', label: 'Terminées' },
  { value: 'stopped', label: 'Arrêtées' },
  { value: 'all', label: 'Toutes' },
];

const MOVIE_FILTERS: { value: MovieStatus; label: string }[] = [
  { value: 'watchlist', label: 'À voir' },
  { value: 'watched', label: 'Vus' },
];

export default function LibraryScreen() {
  const router = useRouter();
  const [segment, setSegment] = usePersistedState<Segment>('segment', 'shows');
  const [showFilter, setShowFilter] = useState<ShowFilter>('watching');
  const [movieFilter, setMovieFilter] = useState<MovieStatus>('watchlist');
  const [grid, setGrid] = usePersistedState('grid', true);
  const [sort, setSort] = usePersistedState<Sort>('sort', 'activity');
  const [sortModal, setSortModal] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searching = searchOpen && search.trim().length > 0;
  const columns = useGridColumns();
  const wide = useBreakpoint() !== 'mobile';

  const shows = useTrackedShows();
  const watched = useAllWatchedEpisodes();
  const movies = useMovies();
  const trending = useTrendingShows();
  const setMovieStatus = useSetMovieStatus();
  const removeMovie = useRemoveMovie();
  const { show: openSheet, sheet: movieSheet } = useActionSheet();

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

  // Date du dernier épisode vu par série — sert au tri « Vu récemment ».
  const lastActivity = useMemo(() => {
    const map = new Map<number, string>();
    for (const episode of watched.data ?? []) {
      const current = map.get(episode.tmdb_show_id);
      if (!current || episode.watched_at > current) {
        map.set(episode.tmdb_show_id, episode.watched_at);
      }
    }
    return map;
  }, [watched.data]);

  // Épisodes vus par série (clé « saison:épisode »).
  const watchedByShow = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const episode of watched.data ?? []) {
      let set = map.get(episode.tmdb_show_id);
      if (!set) {
        set = new Set();
        map.set(episode.tmdb_show_id, set);
      }
      set.add(episodeKey(episode.season_number, episode.episode_number));
    }
    return map;
  }, [watched.data]);

  // Séries « à jour » : tout ce qui est diffusé est vu, mais la série continue.
  // Nécessite les détails TMDB (partagés avec les cards, cache 1 h).
  const watchingShows = useMemo(
    () => (shows.data ?? []).filter((show) => show.status === 'watching'),
    [shows.data]
  );
  const watchingDetails = useQueries({
    queries: watchingShows.map((show) => ({
      queryKey: ['tmdb', 'show', show.tmdb_id],
      queryFn: () => getShowDetails(show.tmdb_id),
      staleTime: 1000 * 60 * 60,
    })),
  });
  const upToDateIds = useMemo(() => {
    const set = new Set<number>();
    watchingDetails.forEach((query, index) => {
      const details = query.data as TmdbShowDetails | undefined;
      const show = watchingShows[index];
      if (!details || !show) return;
      if (
        isUpToDate(
          details.seasons,
          watchedByShow.get(show.tmdb_id) ?? new Set(),
          details.last_episode_to_air ?? null
        )
      ) {
        set.add(show.tmdb_id);
      }
    });
    return set;
  }, [watchingDetails, watchingShows, watchedByShow]);

  // Séries « en cours » sans visionnage depuis 30 jours.
  const staleIds = useMemo(() => {
    const cutoff = Date.now() - STALE_AFTER_MS;
    const set = new Set<number>();
    for (const show of shows.data ?? []) {
      if (show.status !== 'watching') continue;
      const last = lastActivity.get(show.tmdb_id) ?? show.added_at;
      if (new Date(last).getTime() < cutoff) set.add(show.tmdb_id);
    }
    return set;
  }, [shows.data, lastActivity]);

  const staleShows = useMemo(
    () =>
      (shows.data ?? [])
        .filter(
          (show) =>
            show.status === 'watching' &&
            !upToDateIds.has(show.tmdb_id) &&
            staleIds.has(show.tmdb_id)
        )
        .sort((a, b) =>
          (lastActivity.get(b.tmdb_id) ?? b.added_at).localeCompare(
            lastActivity.get(a.tmdb_id) ?? a.added_at
          )
        ),
    [shows.data, upToDateIds, staleIds, lastActivity]
  );

  const filteredShows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (shows.data ?? []).filter((show) => {
      if (searching) return show.name.toLowerCase().includes(query);
      if (showFilter === 'all') return true;
      if (showFilter === 'watching') {
        return (
          show.status === 'watching' &&
          !upToDateIds.has(show.tmdb_id) &&
          !staleIds.has(show.tmdb_id)
        );
      }
      if (showFilter === 'uptodate') {
        return show.status === 'watching' && upToDateIds.has(show.tmdb_id);
      }
      return show.status === showFilter;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'alpha':
          return a.name.localeCompare(b.name, 'fr');
        case 'added':
          return b.added_at.localeCompare(a.added_at);
        case 'rating':
          return (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name, 'fr');
        default:
          return (lastActivity.get(b.tmdb_id) ?? b.added_at).localeCompare(
            lastActivity.get(a.tmdb_id) ?? a.added_at
          );
      }
    });
  }, [
    shows.data,
    showFilter,
    sort,
    lastActivity,
    upToDateIds,
    staleIds,
    searching,
    search,
  ]);

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

  // « À voir ensuite » : séries en cours triées par activité récente.
  const upNextShows = useMemo(
    () =>
      (shows.data ?? [])
        .filter((show) => show.status === 'watching')
        .sort((a, b) =>
          (lastActivity.get(b.tmdb_id) ?? b.added_at).localeCompare(
            lastActivity.get(a.tmdb_id) ?? a.added_at
          )
        )
        .slice(0, 15),
    [shows.data, lastActivity]
  );

  // Le badge « Séries » compte ce qui a réellement des épisodes à voir.
  const watchingCount = watchingShows.filter(
    (show) => !upToDateIds.has(show.tmdb_id)
  ).length;
  const watchlistCount = (movies.data ?? []).filter(
    (movie) => movie.status === 'watchlist'
  ).length;

  if (shows.isLoading || watched.isLoading || movies.isLoading) {
    return (
      <Screen>{grid ? <PosterGridSkeleton /> : <RowListSkeleton />}</Screen>
    );
  }

  const refreshControl = (
    <RefreshControl
      refreshing={shows.isRefetching || watched.isRefetching || movies.isRefetching}
      onRefresh={() => {
        shows.refetch();
        watched.refetch();
        movies.refetch();
      }}
      tintColor={colors.accent}
    />
  );

  const showsTitle = searching
    ? `Résultats · ${filteredShows.length}`
    : `${
        SHOW_FILTERS.find((filter) => filter.value === showFilter)?.label ?? ''
      } · ${filteredShows.length}`;
  const moviesTitle = searching
    ? `Résultats · ${filteredMovies.length}`
    : `${
        MOVIE_FILTERS.find((filter) => filter.value === movieFilter)?.label ?? ''
      } · ${filteredMovies.length}`;

  const listTitle = (title: string) => (
    <Text className="text-fg text-lg font-bold px-4 pt-3 pb-3">{title}</Text>
  );

  const showsHeader = (
    <View>
      {upNextShows.length && !searching ? (
        <HomeHero show={upNextShows[0]} allWatched={watched.data ?? []} />
      ) : null}
      {upNextShows.length > 1 && !searching ? (
        <View className="gap-3 pt-2 pb-2">
          <Text className="text-fg text-lg font-bold px-4">
            Dans la foulée
          </Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={upNextShows.slice(1)}
            keyExtractor={(item) => `next-${item.tmdb_id}`}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <UpNextCard show={item} allWatched={watched.data ?? []} />
            )}
          />
        </View>
      ) : null}
      {listTitle(showsTitle)}
    </View>
  );

  // Section « À reprendre » affichée sous « En cours » (pas un filtre à part).
  const staleFooter =
    segment === 'shows' &&
    showFilter === 'watching' &&
    !searching &&
    staleShows.length ? (
      <View className="pt-5">
        <Text className="text-fg text-lg font-bold px-4 pb-3">
          À reprendre · {staleShows.length}
        </Text>
        {grid ? (
          <View className="flex-row flex-wrap px-2">
            {staleShows.map((item) => (
              <View
                key={item.tmdb_id}
                style={{ width: `${100 / columns}%` }}
              >
                <ShowGridCard show={item} allWatched={watched.data ?? []} />
              </View>
            ))}
          </View>
        ) : (
          staleShows.map((item) => (
            <ShowProgressCard
              key={item.tmdb_id}
              show={item}
              allWatched={watched.data ?? []}
            />
          ))
        )}
      </View>
    ) : null;

  const filterOptions: { value: string; label: string }[] =
    segment === 'shows' ? SHOW_FILTERS : MOVIE_FILTERS;
  const activeFilter = segment === 'shows' ? showFilter : movieFilter;

  const sortModalElement = (
    <BottomSheet visible={sortModal} onClose={() => setSortModal(false)}>
      <Text className="text-fg text-lg font-bold mb-2">Afficher</Text>
      {filterOptions.map((option) => {
        const active = activeFilter === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() =>
              segment === 'shows'
                ? setShowFilter(option.value as ShowFilter)
                : setMovieFilter(option.value as MovieStatus)
            }
            className="flex-row items-center justify-between py-3 border-b border-line/50"
          >
            <Text
              className={`text-[15px] ${
                active ? 'text-accent font-bold' : 'text-fg font-medium'
              }`}
            >
              {option.label}
            </Text>
            {active ? (
              <Ionicons name="checkmark" size={20} color={colors.accent} />
            ) : null}
          </Pressable>
        );
      })}

      <Text className="text-fg text-lg font-bold mb-2 mt-6">Trier par</Text>
      {SORTS.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => setSort(option.value)}
          className="flex-row items-center justify-between py-3 border-b border-line/50"
        >
          <Text
            className={`text-[15px] ${
              sort === option.value
                ? 'text-accent font-bold'
                : 'text-fg font-medium'
            }`}
          >
            {option.label}
          </Text>
          {sort === option.value ? (
            <Ionicons name="checkmark" size={20} color={colors.accent} />
          ) : null}
        </Pressable>
      ))}

      <Pressable
        onPress={() => setSortModal(false)}
        className="mt-6 bg-accent rounded-xl py-3 items-center"
        style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
      >
        <Text className="text-accent-fg font-bold text-[15px]">Terminé</Text>
      </Pressable>
    </BottomSheet>
  );

  // Un filtre non-défaut est actif → le bouton filtre s'allume (les chips ont
  // migré dans la modale, donc on signale l'état ici).
  const filterActive =
    segment === 'shows' ? showFilter !== 'watching' : movieFilter !== 'watchlist';

  const actionButtons = (
    <View className="flex-row gap-2">
      <Pressable
        onPress={() => {
          if (searchOpen) setSearch('');
          setSearchOpen(!searchOpen);
        }}
        hitSlop={6}
        className={`w-9 h-9 rounded-lg items-center justify-center ${
          searchOpen ? 'bg-accent' : 'bg-surface'
        }`}
      >
        <Ionicons
          name={searchOpen ? 'close' : 'search'}
          size={16}
          color={searchOpen ? colors.accentText : colors.text}
        />
      </Pressable>
      <Pressable
        onPress={() => setSortModal(true)}
        hitSlop={6}
        className={`w-9 h-9 rounded-lg items-center justify-center ${
          filterActive ? 'bg-accent' : 'bg-surface'
        }`}
      >
        <Ionicons
          name="options-outline"
          size={16}
          color={filterActive ? colors.accentText : colors.text}
        />
      </Pressable>
      <Pressable
        onPress={() => setGrid(!grid)}
        hitSlop={6}
        className="w-9 h-9 rounded-lg bg-surface items-center justify-center"
      >
        <Ionicons name={grid ? 'list' : 'grid'} size={16} color={colors.text} />
      </Pressable>
    </View>
  );

  const segmentControl = (
    <View
      className={`${wide ? '' : 'flex-1'} flex-row bg-surface rounded-lg p-[3px]`}
    >
      {(
        [
          ['shows', 'Séries', watchingCount],
          ['movies', 'Films', watchlistCount],
        ] as [Segment, string, number][]
      ).map(([value, label, count]) => {
        const active = segment === value;
        return (
          <Pressable
            key={value}
            onPress={() => setSegment(value)}
            className={`${wide ? 'px-6' : 'flex-1'} py-2 rounded-md flex-row items-center justify-center gap-1.5 ${
              active ? 'bg-accent' : ''
            }`}
          >
            <Text
              className={`font-bold text-sm ${
                active ? 'text-accent-fg' : 'text-muted'
              }`}
            >
              {label}
            </Text>
            {count > 0 ? (
              <View
                className={`px-1.5 py-0.5 rounded-full min-w-[20px] items-center ${
                  active ? 'bg-accent-fg/15' : 'bg-surface-light'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    active ? 'text-accent-fg' : 'text-muted'
                  }`}
                >
                  {count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  const searchInput = (
    <Input
      placeholder={
        segment === 'shows'
          ? 'Chercher dans mes séries…'
          : 'Chercher dans mes films…'
      }
      value={search}
      onChangeText={setSearch}
      autoFocus
      autoCorrect={false}
    />
  );

  // Header compact unifié (mobile + desktop) : segment Séries/Films + actions
  // sur une seule ligne. Filtres et tri vivent dans la modale (bouton options).
  const header = (
    <View className="px-4 pt-3 pb-3 gap-3">
      <View className="flex-row items-center gap-2.5">
        {segmentControl}
        {wide ? (
          searchOpen ? (
            <View className="flex-1">{searchInput}</View>
          ) : (
            <View className="flex-1" />
          )
        ) : null}
        {actionButtons}
      </View>
      {!wide && searchOpen ? searchInput : null}
    </View>
  );

  if (segment === 'movies') {
    return (
      <Screen>
        {header}
        {filteredMovies.length ? (
          grid ? (
            <FlatList
              key={`movies-grid-${columns}`}
              data={filteredMovies}
              numColumns={columns}
              keyExtractor={(item) => String(item.tmdb_id)}
              contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 32 }}
              refreshControl={refreshControl}
              ListHeaderComponent={listTitle(moviesTitle)}
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
              ListHeaderComponent={listTitle(moviesTitle)}
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
        {sortModalElement}
        {movieSheet}
      </Screen>
    );
  }

  if (!(shows.data ?? []).length) {
    return (
      <Screen>
        {header}
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <EmptyState
            title="Aucune série suivie"
            subtitle="Commence par en suivre quelques-unes — voilà ce qui cartonne en ce moment."
          />
          <Carousel
            title="Tendances de la semaine"
            data={trending.items.slice(0, 12)}
            render={(item) => (
              <PosterCard
                title={item.name}
                posterPath={item.poster_path}
                subtitle={item.first_air_date?.slice(0, 4)}
                width={110}
                onPress={() => router.push(`/show/${item.id}`)}
              />
            )}
          />
          <View className="p-6">
            <Button
              title="Explorer tout le catalogue"
              onPress={() => router.push('/discover')}
            />
          </View>
        </ScrollView>
        {sortModalElement}
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      {filteredShows.length || staleFooter ? (
        grid ? (
          <FlatList
            key={`shows-grid-${columns}`}
            data={filteredShows}
            numColumns={columns}
            keyExtractor={(item: TrackedShow) => String(item.tmdb_id)}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 32 }}
            refreshControl={refreshControl}
            ListHeaderComponent={showsHeader}
            ListFooterComponent={staleFooter}
            renderItem={({ item }) => (
              <ShowGridCard
                show={item}
                allWatched={watched.data ?? []}
                columns={columns}
              />
            )}
          />
        ) : (
          <FlatList
            key="shows-list"
            data={filteredShows}
            keyExtractor={(item: TrackedShow) => String(item.tmdb_id)}
            contentContainerStyle={{
              paddingBottom: 32,
              width: '100%',
              maxWidth: 760,
              alignSelf: 'center',
            }}
            refreshControl={refreshControl}
            ListHeaderComponent={showsHeader}
            ListFooterComponent={staleFooter}
            renderItem={({ item }) => (
              <ShowProgressCard show={item} allWatched={watched.data ?? []} />
            )}
          />
        )
      ) : (
        <EmptyState title="Rien dans ce filtre" />
      )}
      {sortModalElement}
    </Screen>
  );
}
