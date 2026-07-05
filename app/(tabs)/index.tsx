import { useQueries } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Carousel } from '@/components/Carousel';
import { HomeHero } from '@/components/HomeHero';
import { LibraryToolbar, type ToolbarOption } from '@/components/LibraryToolbar';
import { PosterCard } from '@/components/PosterCard';
import { ShowGridCard } from '@/components/ShowGridCard';
import { ShowProgressCard } from '@/components/ShowProgressCard';
import { PosterGridSkeleton, RowListSkeleton } from '@/components/Skeleton';
import { UpNextCard } from '@/components/UpNextCard';
import { EmptyState, Screen } from '@/components/ui';
import {
  useAllWatchedEpisodes,
  useTrackedShows,
  useTrendingShows,
} from '@/hooks/queries';
import { useGridColumns } from '@/hooks/useGridColumns';
import { usePersistedState } from '@/hooks/usePersistedState';
import type { ShowStatus, TrackedShow } from '@/lib/db';
import { episodeKey, isUpToDate } from '@/lib/progress';
import { getShowDetails, type TmdbShowDetails } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

type ShowFilter = ShowStatus | 'all' | 'uptodate';
type Sort = 'activity' | 'added' | 'alpha' | 'rating';

/** Sans visionnage depuis 30 jours → « À reprendre ». */
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const SORTS: ToolbarOption<Sort>[] = [
  { value: 'activity', label: 'Vu récemment' },
  { value: 'added', label: 'Ajout' },
  { value: 'alpha', label: 'A → Z' },
  { value: 'rating', label: 'Note' },
];

const SHOW_FILTERS: ToolbarOption<ShowFilter>[] = [
  { value: 'watching', label: 'En cours' },
  { value: 'uptodate', label: 'À jour' },
  { value: 'planned', label: 'À commencer' },
  { value: 'completed', label: 'Terminées' },
  { value: 'stopped', label: 'Arrêtées' },
  { value: 'all', label: 'Toutes' },
];

export default function ShowsScreen() {
  const router = useRouter();
  const [showFilter, setShowFilter] = useState<ShowFilter>('watching');
  const [grid, setGrid] = usePersistedState('grid', true);
  const [sort, setSort] = usePersistedState<Sort>('sort', 'activity');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searching = searchOpen && search.trim().length > 0;
  const columns = useGridColumns();

  const shows = useTrackedShows();
  const watched = useAllWatchedEpisodes();
  const trending = useTrendingShows();

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
          return (
            (b.rating ?? 0) - (a.rating ?? 0) ||
            a.name.localeCompare(b.name, 'fr')
          );
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

  // « Reprendre » / « Dans la foulée » : séries en cours triées par activité.
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

  const toolbar = (
    <LibraryToolbar
      filters={SHOW_FILTERS}
      activeFilter={showFilter}
      onSelectFilter={setShowFilter}
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
      searchPlaceholder="Chercher dans mes séries…"
    />
  );

  if (shows.isLoading || watched.isLoading) {
    return (
      <Screen>
        {toolbar}
        {grid ? <PosterGridSkeleton /> : <RowListSkeleton />}
      </Screen>
    );
  }

  const refreshControl = (
    <RefreshControl
      refreshing={shows.isRefetching || watched.isRefetching}
      onRefresh={() => {
        shows.refetch();
        watched.refetch();
      }}
      tintColor={colors.accent}
    />
  );

  const showsTitle = searching
    ? `Résultats · ${filteredShows.length}`
    : `${
        SHOW_FILTERS.find((filter) => filter.value === showFilter)?.label ?? ''
      } · ${filteredShows.length}`;

  const showsHeader = (
    <View>
      {upNextShows.length && !searching ? (
        <HomeHero show={upNextShows[0]} allWatched={watched.data ?? []} />
      ) : null}
      {upNextShows.length > 1 && !searching ? (
        <View className="gap-3 pt-2 pb-2">
          <Text className="text-fg text-lg font-bold px-4">Dans la foulée</Text>
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
      <Text className="text-fg text-lg font-bold px-4 pt-3 pb-3">
        {showsTitle}
      </Text>
    </View>
  );

  // Section « À reprendre » affichée sous « En cours » (pas un filtre à part).
  const staleFooter =
    showFilter === 'watching' && !searching && staleShows.length ? (
      <View className="pt-5">
        <Text className="text-fg text-lg font-bold px-4 pb-3">
          À reprendre · {staleShows.length}
        </Text>
        {grid ? (
          <View className="flex-row flex-wrap px-2">
            {staleShows.map((item) => (
              <View key={item.tmdb_id} style={{ width: `${100 / columns}%` }}>
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

  if (!(shows.data ?? []).length) {
    return (
      <Screen>
        {toolbar}
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <EmptyState
            icon="albums-outline"
            title="Aucune série suivie"
            subtitle="Commence par en suivre quelques-unes — voilà ce qui cartonne en ce moment."
            action={{
              label: 'Explorer le catalogue',
              onPress: () => router.push('/discover'),
            }}
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
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      {toolbar}
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
    </Screen>
  );
}
