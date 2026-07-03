import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { PosterCard } from '@/components/PosterCard';
import { EmptyState, Loading, Screen } from '@/components/ui';
import {
  useNowPlayingMovies,
  useTopRatedShows,
  useTrendingMovies,
  useTrendingShows,
} from '@/hooks/queries';
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

  const trendingShows = useTrendingShows();
  const trendingMovies = useTrendingMovies();
  const topRatedShows = useTopRatedShows();
  const nowPlaying = useNowPlayingMovies();

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
      <Stack.Screen
        options={{ title: BROWSE_TITLES[kind] ?? 'Parcourir' }}
      />
      {source.isLoading ? (
        <Loading />
      ) : source.items.length ? (
        <FlatList
          data={source.items as { id: number }[]}
          numColumns={3}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={{ padding: 8, paddingBottom: 32 }}
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
