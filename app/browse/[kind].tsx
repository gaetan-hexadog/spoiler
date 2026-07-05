import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingHeader } from '@/components/FloatingHeader';
import { PosterCard, type LibraryBadge } from '@/components/PosterCard';
import { EmptyState, Loading, Screen } from '@/components/ui';
import {
  useMovies,
  useNowPlayingMovies,
  useTopRatedShows,
  useTrackedShows,
  useTrendingMovies,
  useTrendingShows,
} from '@/hooks/queries';
import { useGridColumns } from '@/hooks/useGridColumns';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { colors } from '@/lib/theme';

export const BROWSE_TITLES: Record<string, string> = {
  'trending-tv': 'Séries tendances',
  'trending-movie': 'Films tendances',
  'now-playing': 'Au cinéma',
  'top-rated-tv': 'Séries les mieux notées',
};

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = params.kind ?? 'trending-tv';
  const router = useRouter();
  const columns = useGridColumns();
  const insets = useSafeAreaInsets();
  const { scrollY, scrollProps } = useHeaderScroll();

  const trendingShows = useTrendingShows();
  const trendingMovies = useTrendingMovies();
  const topRatedShows = useTopRatedShows();
  const nowPlaying = useNowPlayingMovies();

  const tracked = useTrackedShows();
  const movies = useMovies();
  const showBadges = useMemo(() => {
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
    return map;
  }, [tracked.data]);
  const movieBadges = useMemo(() => {
    const map = new Map<number, LibraryBadge>();
    for (const movie of movies.data ?? []) {
      map.set(movie.tmdb_id, movie.status === 'watched' ? 'watched' : 'planned');
    }
    return map;
  }, [movies.data]);

  const isShowKind = kind === 'trending-tv' || kind === 'top-rated-tv';
  const source =
    kind === 'trending-tv'
      ? trendingShows
      : kind === 'top-rated-tv'
        ? topRatedShows
        : kind === 'now-playing'
          ? nowPlaying
          : trendingMovies;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <FloatingHeader
        scrollY={scrollY}
        title={BROWSE_TITLES[kind] ?? 'Parcourir'}
      />
      {source.isLoading ? (
        <Loading />
      ) : source.items.length ? (
        <Animated.FlatList
          {...scrollProps}
          key={`browse-${columns}`}
          data={source.items as { id: number }[]}
          numColumns={columns}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={{
            padding: 8,
            paddingTop: insets.top + 52,
            paddingBottom: 32,
          }}
          onEndReached={source.loadMore}
          onEndReachedThreshold={1}
          ListFooterComponent={
            source.isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (isShowKind) {
              const show = item as (typeof trendingShows.items)[number];
              return (
                <PosterCard
                  title={show.name}
                  posterPath={show.poster_path}
                  subtitle={show.first_air_date?.slice(0, 4)}
                  columns={columns}
                  badge={showBadges.get(show.id)}
                  onPress={() => router.push(`/show/${show.id}`)}
                />
              );
            }
            const movie = item as (typeof trendingMovies.items)[number];
            return (
              <PosterCard
                title={movie.title}
                posterPath={movie.poster_path}
                subtitle={movie.release_date?.slice(0, 4)}
                columns={columns}
                badge={movieBadges.get(movie.id)}
                onPress={() => router.push(`/movie/${movie.id}`)}
              />
            );
          }}
        />
      ) : (
        <EmptyState title="Rien à afficher" />
      )}
    </Screen>
  );
}
