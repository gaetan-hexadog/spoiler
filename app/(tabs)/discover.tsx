import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Carousel } from '@/components/Carousel';
import { PosterCard } from '@/components/PosterCard';
import { EmptyState, Input, Loading, Screen } from '@/components/ui';
import {
  useNowPlayingMovies,
  useSearchMovies,
  useSearchShows,
  useShowRecommendations,
  useTopRatedShows,
  useTrackedShows,
  useTrendingMovies,
  useTrendingShows,
} from '@/hooks/queries';
import { useLibraryBadges } from '@/hooks/useLibraryBadges';
import type { TmdbMovieSummary, TmdbShowSummary } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

const CAROUSEL_WIDTH = 110;

export default function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 1;

  const trendingShows = useTrendingShows();
  const trendingMovies = useTrendingMovies();
  const topRatedShows = useTopRatedShows();
  const nowPlaying = useNowPlayingMovies();
  const searchShows = useSearchShows(searching ? query : '');
  const searchMovies = useSearchMovies(searching ? query : '');

  // Badges de statut : ce que l'utilisateur a déjà dans sa bibliothèque.
  const tracked = useTrackedShows();
  const { showBadge, movieBadge } = useLibraryBadges();
  const seedShow = useMemo(
    () => (tracked.data ?? []).find((show) => show.status === 'watching'),
    [tracked.data]
  );
  const personalRecs = useShowRecommendations(
    seedShow?.tmdb_id ?? 0,
    !!seedShow
  );

  const showCard = (item: TmdbShowSummary) => (
    <PosterCard
      title={item.name}
      posterPath={item.poster_path}
      subtitle={item.first_air_date?.slice(0, 4)}
      width={CAROUSEL_WIDTH}
      badge={showBadge(item.id)}
      onPress={() => router.push(`/show/${item.id}`)}
    />
  );
  const movieCard = (item: TmdbMovieSummary) => (
    <PosterCard
      title={item.title}
      posterPath={item.poster_path}
      subtitle={item.release_date?.slice(0, 4)}
      width={CAROUSEL_WIDTH}
      badge={movieBadge(item.id)}
      onPress={() => router.push(`/movie/${item.id}`)}
    />
  );

  return (
    <Screen>
      <View className="px-4 pt-3 pb-4 gap-3">
        <Text className="text-fg text-2xl font-extrabold">Découvrir</Text>
        <View className="relative justify-center">
          <Input
            placeholder="Rechercher une série ou un film…"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            style={{ paddingRight: 40 }}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              className="absolute right-3"
              hitSlop={8}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {searching ? (
        searchShows.isLoading || searchMovies.isLoading ? (
          <Loading />
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 32, gap: 24 }}>
            <Carousel
              title="Séries"
              data={searchShows.items}
              loadingMore={searchShows.isFetchingNextPage}
              onEndReached={searchShows.loadMore}
              render={showCard}
            />
            <Carousel
              title="Films"
              data={searchMovies.items}
              loadingMore={searchMovies.isFetchingNextPage}
              onEndReached={searchMovies.loadMore}
              render={movieCard}
            />
            {!searchShows.items.length && !searchMovies.items.length ? (
              <EmptyState
                icon="search-outline"
                title="Aucun résultat"
                subtitle={`Rien trouvé pour « ${query.trim()} ».`}
              />
            ) : null}
          </ScrollView>
        )
      ) : trendingShows.isLoading || trendingMovies.isLoading ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32, gap: 28 }}>
          <Carousel
            title="Séries tendances"
            data={trendingShows.items}
            loadingMore={trendingShows.isFetchingNextPage}
            onEndReached={trendingShows.loadMore}
            onSeeAll={() => router.push('/browse/trending-tv')}
            render={showCard}
          />
          {seedShow && personalRecs.data?.results.length ? (
            <Carousel
              title={`Parce que tu suis ${seedShow.name}`}
              data={personalRecs.data.results.filter(
                (item) =>
                  !(tracked.data ?? []).some((s) => s.tmdb_id === item.id)
              )}
              render={showCard}
            />
          ) : null}
          <Carousel
            title="Films tendances"
            data={trendingMovies.items}
            loadingMore={trendingMovies.isFetchingNextPage}
            onEndReached={trendingMovies.loadMore}
            onSeeAll={() => router.push('/browse/trending-movie')}
            render={movieCard}
          />
          <Carousel
            title="Au cinéma"
            data={nowPlaying.items}
            loadingMore={nowPlaying.isFetchingNextPage}
            onEndReached={nowPlaying.loadMore}
            onSeeAll={() => router.push('/browse/now-playing')}
            render={movieCard}
          />
          <Carousel
            title="Séries les mieux notées"
            data={topRatedShows.items}
            loadingMore={topRatedShows.isFetchingNextPage}
            onEndReached={topRatedShows.loadMore}
            onSeeAll={() => router.push('/browse/top-rated-tv')}
            render={showCard}
          />
        </ScrollView>
      )}
    </Screen>
  );
}
