import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useActionSheet } from '@/components/ActionSheet';
import { Carousel } from '@/components/Carousel';
import { CastRow } from '@/components/CastRow';
import { FloatingButton, FloatingHeader } from '@/components/FloatingHeader';
import { PosterCard } from '@/components/PosterCard';
import { RatingStars } from '@/components/RatingStars';
import { DetailSkeleton } from '@/components/Skeleton';
import { WhereToWatch } from '@/components/WhereToWatch';
import { Button, Screen } from '@/components/ui';
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
  const { show: openSheet, sheet } = useActionSheet();
  const isDesktop = useBreakpoint() === 'desktop';
  const details = useMovieDetails(movieId);
  const movies = useMovies();
  const addMovie = useAddMovie();
  const setStatus = useSetMovieStatus();
  const removeMovie = useRemoveMovie();
  const setRating = useSetMovieRating();
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

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {sheet}
      <FloatingHeader
        right={
          <FloatingButton
            icon={saved ? 'bookmark' : 'bookmark-outline'}
            active={!!saved}
            onPress={() => {
              if (!saved) {
                addMovie.mutate({
                  tmdb_id: movie.id,
                  title: movie.title,
                  poster_path: movie.poster_path,
                  status: 'watchlist',
                });
              } else {
                openSheet({
                  title: 'Retirer de mes films',
                  message: movie.title,
                  actions: [
                    {
                      label: 'Retirer',
                      variant: 'danger',
                      onPress: () => removeMovie.mutate(movieId),
                    },
                  ],
                });
              }
            }}
          />
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
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
            <Text className="text-muted text-[13px]">
              {movie.release_date?.slice(0, 4)}
              {movie.runtime ? ` · ${movie.runtime} min` : ''}
              {movie.genres.length
                ? ` · ${movie.genres
                    .slice(0, 3)
                    .map((genre) => genre.name)
                    .join(', ')}`
                : ''}
            </Text>
            {movie.vote_average ? (
              <Text className="text-accent text-[13px] font-bold">
                ★ {movie.vote_average.toFixed(1)}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="p-4 gap-4">
          {/* Desktop : synopsis + actions à gauche, plateformes à droite. */}
          <View className={isDesktop ? 'flex-row gap-10 items-start' : 'gap-4'}>
            <View className={`gap-4 ${isDesktop ? 'flex-[3]' : ''}`}>
              {movie.overview ? (
                <Text className="text-fg text-sm leading-[21px] opacity-90">
                  {movie.overview}
                </Text>
              ) : null}

              {/* Ajout/retrait de la watchlist = bookmark du header. Ici, on ne
                  garde que les actions de statut que le bookmark ne couvre pas. */}
              <View className="gap-3">
            {!saved ? (
              <Button
                title="✓ Je l'ai déjà vu"
                loading={addMovie.isPending}
                onPress={() =>
                  addMovie.mutate({
                    tmdb_id: movie.id,
                    title: movie.title,
                    poster_path: movie.poster_path,
                    status: 'watched',
                  })
                }
              />
            ) : saved.status === 'watchlist' ? (
              <Button
                title="✓ Marquer comme vu"
                loading={setStatus.isPending}
                onPress={() =>
                  setStatus.mutate({ tmdbId: movieId, status: 'watched' })
                }
              />
            ) : (
              <>
                <Text className="text-success text-[17px] font-extrabold text-center">
                  ✓ Vu
                </Text>
                <RatingStars
                  value={saved.rating}
                  onChange={(rating) =>
                    setRating.mutate({ tmdbId: movieId, rating })
                  }
                />
                <Button
                  title="Remettre dans la watchlist"
                  variant="ghost"
                  loading={setStatus.isPending}
                  onPress={() =>
                    setStatus.mutate({ tmdbId: movieId, status: 'watchlist' })
                  }
                />
              </>
            )}
              </View>
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
