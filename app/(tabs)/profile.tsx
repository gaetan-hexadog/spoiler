import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { Muted, Screen } from '@/components/ui';
import {
  useAllWatchedEpisodes,
  useMovies,
  useProfile,
  useTrackedShows,
} from '@/hooks/queries';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { imageUrl } from '@/lib/tmdb';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

const EPISODE_MINUTES = 42;
const MOVIE_MINUTES = 110;

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View className="flex-1 bg-surface rounded-2xl p-4 items-center gap-1">
      <Text className="text-accent text-[24px] font-extrabold">{value}</Text>
      <Text className="text-muted text-xs text-center">{label}</Text>
    </View>
  );
}

function formatDuration(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  if (days > 0) return `${days} j ${hours} h`;
  return `${hours} h`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const profile = useProfile();
  const shows = useTrackedShows();
  const watched = useAllWatchedEpisodes();
  const movies = useMovies();
  const isDesktop = useBreakpoint() === 'desktop';

  const stats = useMemo(() => {
    const showList = shows.data ?? [];
    const episodes = watched.data ?? [];
    const movieList = movies.data ?? [];
    const moviesWatched = movieList.filter(
      (movie) => movie.status === 'watched'
    ).length;

    const countByShow = new Map<number, number>();
    for (const episode of episodes) {
      countByShow.set(
        episode.tmdb_show_id,
        (countByShow.get(episode.tmdb_show_id) ?? 0) + 1
      );
    }
    const showById = new Map(showList.map((show) => [show.tmdb_id, show]));
    const topShows = [...countByShow.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tmdbId, count]) => ({
        show: showById.get(tmdbId),
        tmdbId,
        count,
      }))
      .filter((entry) => entry.show);

    return {
      shows: showList.length,
      episodes: episodes.length,
      moviesWatched,
      totalMinutes:
        episodes.length * EPISODE_MINUTES + moviesWatched * MOVIE_MINUTES,
      topShows,
    };
  }, [shows.data, watched.data, movies.data]);

  const email = session?.user.email ?? '';
  const displayName = profile.data?.username || email.split('@')[0];
  const initial = (displayName[0] ?? '?').toUpperCase();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 20,
          width: '100%',
          maxWidth: isDesktop ? 1000 : 720,
          alignSelf: 'center',
        }}
      >
        {/* En-tête : titre + accès Paramètres */}
        <View className="flex-row items-center justify-between">
          <Text className="text-fg text-2xl font-extrabold">Profil</Text>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={8}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
            style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Identité */}
        <View
          className={`gap-2 ${isDesktop ? 'flex-row items-center gap-4' : 'items-center'}`}
        >
          <View className="w-20 h-20 rounded-full bg-accent items-center justify-center">
            <Text className="text-accent-fg text-3xl font-extrabold">
              {initial}
            </Text>
          </View>
          <View className={isDesktop ? '' : 'items-center'}>
            <Text className="text-fg text-xl font-extrabold">{displayName}</Text>
            <Text className="text-muted text-[13px]">{email}</Text>
          </View>
        </View>

        <View className={isDesktop ? 'flex-row gap-6 items-start' : 'gap-5'}>
          {/* Colonne gauche : chiffre héros + heatmap + stats secondaires */}
          <View className={`gap-5 ${isDesktop ? 'flex-1' : ''}`}>
            {/* Chiffre héros : temps passé devant l'écran */}
            <View className="bg-surface-light rounded-3xl p-5">
              <Text className="text-muted text-xs font-bold tracking-wider">
                DEVANT L'ÉCRAN
              </Text>
              <Text className="text-accent text-[42px] font-extrabold mt-1">
                {formatDuration(stats.totalMinutes)}
              </Text>
              <Text className="text-muted text-xs mt-2">
                {stats.episodes} épisodes · {stats.moviesWatched} films
              </Text>
            </View>

            <ActivityHeatmap allWatched={watched.data ?? []} />

            <View className="flex-row gap-3">
              <Stat value={stats.shows} label="Séries" />
              <Stat value={stats.episodes} label="Épisodes vus" />
              <Stat value={stats.moviesWatched} label="Films vus" />
            </View>
          </View>

          {/* Top séries */}
          {stats.topShows.length ? (
            <View className={`gap-2 ${isDesktop ? 'flex-1' : ''}`}>
              <Text className="text-fg text-lg font-bold">Top séries</Text>
              {stats.topShows.map((entry, index) => {
                const uri = imageUrl(entry.show?.poster_path, 'w92');
                return (
                  <Pressable
                    key={entry.tmdbId}
                    onPress={() => router.push(`/show/${entry.tmdbId}`)}
                    className="flex-row items-center gap-3 bg-surface rounded-xl p-2"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.8 } : undefined
                    }
                  >
                    <Text className="text-accent text-base font-extrabold w-6 text-center">
                      {index + 1}
                    </Text>
                    {uri ? (
                      <Image
                        source={{ uri }}
                        className="w-8 aspect-[2/3] rounded"
                      />
                    ) : (
                      <View className="w-8 aspect-[2/3] rounded bg-surface-light" />
                    )}
                    <Text
                      className="text-fg text-sm font-semibold flex-1"
                      numberOfLines={1}
                    >
                      {entry.show?.name}
                    </Text>
                    <Text className="text-muted text-xs">{entry.count} ép.</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Pied de page : logo + version */}
        <View className="items-center gap-2 mt-6 mb-4">
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 32, height: 32, opacity: 0.9 }}
            resizeMode="contain"
          />
          <Muted>
            PopcornLog v{Constants.expoConfig?.version ?? '1.0.0'}
            {Updates.updateId ? ` · maj ${Updates.updateId.slice(0, 8)}` : ''}
            {'\n'}Temps d'écran estimé (42 min/épisode, 1 h 50/film). Données
            TMDB — application non approuvée par TMDB.
          </Muted>
        </View>
      </ScrollView>
    </Screen>
  );
}
