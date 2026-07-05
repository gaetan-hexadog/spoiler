import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { Carousel } from '@/components/Carousel';
import { CastRow } from '@/components/CastRow';
import { FloatingButton, FloatingHeader } from '@/components/FloatingHeader';
import { PosterCard } from '@/components/PosterCard';
import { RatingField } from '@/components/RatingField';
import { DetailSkeleton } from '@/components/Skeleton';
import { WhereToWatch } from '@/components/WhereToWatch';
import { Screen } from '@/components/ui';
import {
  useAddMovie,
  useMovieDetails,
  useMovieRecommendations,
  useMovies,
  useRemoveMovie,
  useSetMovieRating,
  useSetMovieStatus,
} from '@/hooks/queries';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { findTrailer, imageUrl } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

export default function MovieDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const movieId = Number(params.id);

  const router = useRouter();
  const { scrolled, scrollProps } = useHeaderScroll();
  const isDesktop = useBreakpoint() === 'desktop';
  const details = useMovieDetails(movieId);
  const movies = useMovies();
  const addMovie = useAddMovie();
  const setStatus = useSetMovieStatus();
  const setRating = useSetMovieRating();
  const removeMovie = useRemoveMovie();
  const recommendations = useMovieRecommendations(movieId);

  // Recommandations : ne pas re-proposer les films déjà dans ma liste.
  const myMovieIds = useMemo(
    () => new Set((movies.data ?? []).map((m) => m.tmdb_id)),
    [movies.data]
  );

  if (details.isLoading || movies.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <FloatingHeader />
        <DetailSkeleton />
      </Screen>
    );
  }
  if (!details.data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <FloatingHeader />
        <Text className="text-muted p-4 text-center mt-24">
          Film introuvable.
        </Text>
      </Screen>
    );
  }

  const movie = details.data;
  const saved = (movies.data ?? []).find((m) => m.tmdb_id === movieId);
  const backdrop = imageUrl(movie.backdrop_path, 'w780');
  const poster = imageUrl(movie.poster_path, 'w342');
  const filteredRecs = (recommendations.data?.results ?? [])
    .filter((item) => !myMovieIds.has(item.id))
    .slice(0, 12);

  // --- Modèle d'action : les deux états (À voir · Vu) vivent dans le header,
  // sous forme de boutons ronds qui basculent leur propre statut. Actif = plein
  // accent ; ré-appui sur l'actif = on retire. Jumelle exacte de la fiche série.
  const watched = saved?.status === 'watched';
  const inWatchlist = saved?.status === 'watchlist';

  const setStatusOrAdd = (status: 'watched' | 'watchlist') => {
    if (saved) setStatus.mutate({ tmdbId: movie.id, status });
    else
      addMovie.mutate({
        tmdb_id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        status,
      });
  };
  const toggleWatched = () =>
    watched ? removeMovie.mutate(movie.id) : setStatusOrAdd('watched');
  const toggleWatchlist = () =>
    inWatchlist ? removeMovie.mutate(movie.id) : setStatusOrAdd('watchlist');

  const headerRight = (
    <>
      <FloatingButton
        icon={inWatchlist ? 'bookmark' : 'bookmark-outline'}
        active={inWatchlist}
        onPress={toggleWatchlist}
      />
      <FloatingButton
        icon={watched ? 'checkmark-circle' : 'checkmark-circle-outline'}
        active={watched}
        onPress={toggleWatched}
      />
    </>
  );

  // La note apparaît d'elle-même une fois le film vu (bloc « Ma note » partagé).
  const ratingEl = watched ? (
    <RatingField
      value={saved?.rating ?? null}
      onChange={(rating) => setRating.mutate({ tmdbId: movie.id, rating })}
    />
  ) : null;

  // Méta présentée en chips (année · durée · genres · note).
  const metaChips = (
    <View className="flex-row flex-wrap items-center gap-1.5">
      {movie.release_date ? (
        <View className="bg-surface rounded-full px-2.5 py-1">
          <Text className="text-muted text-[12px] font-semibold">
            {movie.release_date.slice(0, 4)}
          </Text>
        </View>
      ) : null}
      {movie.runtime ? (
        <View className="bg-surface rounded-full px-2.5 py-1">
          <Text className="text-muted text-[12px] font-semibold">
            {movie.runtime} min
          </Text>
        </View>
      ) : null}
      {movie.genres.slice(0, 3).map((genre) => (
        <View key={genre.name} className="bg-surface rounded-full px-2.5 py-1">
          <Text className="text-muted text-[12px] font-semibold">
            {genre.name}
          </Text>
        </View>
      ))}
      {movie.vote_average ? (
        <View className="bg-surface rounded-full px-2.5 py-1">
          <Text className="text-accent text-[12px] font-bold">
            ★ {movie.vote_average.toFixed(1)}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const whereEl = (
    <WhereToWatch providers={movie['watch/providers']?.results?.FR} />
  );

  const castAndRecs = (
    <View className="gap-6 pb-4">
      {movie.credits?.cast?.length ? (
        <CastRow cast={movie.credits.cast} />
      ) : null}
      {filteredRecs.length ? (
        <Carousel
          title="Dans le même genre"
          data={filteredRecs}
          render={(item) => (
            <PosterCard
              title={item.title}
              posterPath={item.poster_path}
              subtitle={item.release_date?.slice(0, 4)}
              width={110}
              onPress={() => router.push(`/movie/${item.id}`)}
            />
          )}
        />
      ) : null}
    </View>
  );

  // --- Desktop : rail affiche/actions à gauche, contenu à droite ---
  if (isDesktop) {
    return (
      <View className="flex-1 bg-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <FloatingHeader right={headerRight} />
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="bg-surface" style={{ height: 360 }}>
            {backdrop ? (
              <Image source={{ uri: backdrop }} className="w-full h-full" />
            ) : null}
            <LinearGradient
              colors={['transparent', colors.bg]}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 }}
            />
            {(() => {
              const trailer = findTrailer(movie.videos);
              return trailer ? (
                <Pressable
                  onPress={() =>
                    Linking.openURL(`https://www.youtube.com/watch?v=${trailer.key}`)
                  }
                  className="absolute inset-0 items-center justify-center"
                >
                  <View className="w-16 h-16 rounded-full bg-bg/70 border border-fg/30 items-center justify-center pl-1">
                    <Ionicons name="play" size={30} color={colors.text} />
                  </View>
                </Pressable>
              ) : null;
            })()}
          </View>

          <View className="flex-row gap-8 px-8 -mt-24">
            <View className="w-52 gap-4">
              {poster ? (
                <Image
                  source={{ uri: poster }}
                  className="w-52 aspect-[2/3] rounded-2xl border-2 border-line"
                />
              ) : null}
              {ratingEl}
              {whereEl}
            </View>
            <View className="flex-1 gap-5 pt-28">
              <View className="gap-1">
                <Text className="text-fg text-3xl font-extrabold">
                  {movie.title}
                </Text>
                {metaChips}
              </View>
              {movie.overview ? (
                <Text className="text-fg text-sm leading-[22px] opacity-90">
                  {movie.overview}
                </Text>
              ) : null}
              {castAndRecs}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <FloatingHeader
        scrolled={scrolled}
        title={movie.title}
        right={headerRight}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} {...scrollProps}>
        <View
          className={isDesktop ? 'bg-surface' : 'aspect-video bg-surface'}
          style={isDesktop ? { height: 360 } : undefined}
        >
          {backdrop ? (
            <Image source={{ uri: backdrop }} className="w-full h-full" />
          ) : null}
          <LinearGradient
            colors={['transparent', colors.bg]}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 90,
            }}
          />
          {(() => {
            const trailer = findTrailer(movie.videos);
            return trailer ? (
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    `https://www.youtube.com/watch?v=${trailer.key}`
                  )
                }
                className="absolute inset-0 items-center justify-center"
              >
                <View className="w-14 h-14 rounded-full bg-bg/70 border border-fg/30 items-center justify-center pl-1">
                  <Ionicons name="play" size={26} color={colors.text} />
                </View>
              </Pressable>
            ) : null;
          })()}
        </View>

        <View className="flex-row px-4 -mt-12 gap-3 items-end">
          {poster ? (
            <Image
              source={{ uri: poster }}
              className="w-24 aspect-[2/3] rounded-xl border-2 border-line"
            />
          ) : null}
          <View className="flex-1 pb-1 gap-1">
            <Text className="text-fg text-2xl font-extrabold">
              {movie.title}
            </Text>
            {metaChips}
          </View>
        </View>

        <View className="p-4 gap-4">
          <View className={isDesktop ? 'flex-row gap-10 items-start' : 'gap-4'}>
            <View className={`gap-4 ${isDesktop ? 'flex-[3]' : ''}`}>
              {/* Les actions (À voir · Vu) sont dans le header ; ici la note
                  contextuelle puis le synopsis. */}
              {ratingEl}
              {movie.overview ? (
                <Text className="text-fg text-sm leading-[21px] opacity-90">
                  {movie.overview}
                </Text>
              ) : null}
            </View>
            <View className={isDesktop ? 'flex-[2]' : ''}>
              <WhereToWatch providers={movie['watch/providers']?.results?.FR} />
            </View>
          </View>
        </View>

        <View className="gap-6 pb-4">
          {movie.credits?.cast?.length ? (
            <CastRow cast={movie.credits.cast} />
          ) : null}
          {filteredRecs.length ? (
            <Carousel
              title="Dans le même genre"
              data={filteredRecs}
              render={(item) => (
                <PosterCard
                  title={item.title}
                  posterPath={item.poster_path}
                  subtitle={item.release_date?.slice(0, 4)}
                  width={110}
                  onPress={() => router.push(`/movie/${item.id}`)}
                />
              )}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
