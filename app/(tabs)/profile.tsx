import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FloatingButton } from '@/components/FloatingHeader';
import { Muted } from '@/components/ui';
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
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Petit raccourci (Mes listes / Mon bilan).
function Shortcut({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface rounded-2xl p-3.5 flex-row items-center gap-3 flex-1"
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center"
        style={{ backgroundColor: 'rgba(255,212,73,0.12)' }}
      >
        <Ionicons name={icon} size={19} color={colors.accent} />
      </View>
      <View className="flex-1">
        <Text className="text-fg text-[14.5px] font-bold">{label}</Text>
        <Text className="text-muted text-[12px] mt-0.5">{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      .map(([tmdbId, count]) => ({ show: showById.get(tmdbId), tmdbId, count }))
      .filter((entry) => entry.show);

    // Activité de l'année en cours, une barre par semaine jusqu'à aujourd'hui.
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1).getTime();
    const weeks = new Array(53).fill(0);
    let yearTotal = 0;
    for (const episode of episodes) {
      const d = new Date(episode.watched_at);
      if (d.getFullYear() !== year) continue;
      const w = Math.floor((d.getTime() - start) / WEEK_MS);
      if (w >= 0 && w < 53) {
        weeks[w] += 1;
        yearTotal += 1;
      }
    }
    const currentWeek = Math.floor((Date.now() - start) / WEEK_MS);
    const bars = weeks.slice(0, Math.max(1, currentWeek + 1));

    const totalMinutes =
      episodes.length * EPISODE_MINUTES + moviesWatched * MOVIE_MINUTES;

    return {
      shows: showList.length,
      episodes: episodes.length,
      moviesWatched,
      days: Math.floor(totalMinutes / 1440),
      hours: Math.round((totalMinutes % 1440) / 60),
      months: Math.round(totalMinutes / 1440 / 30),
      topShows,
      bars,
      year,
      yearTotal,
    };
  }, [shows.data, watched.data, movies.data]);

  const email = session?.user.email ?? '';
  const displayName = profile.data?.username || email.split('@')[0];
  const initial = (displayName[0] ?? '?').toUpperCase();

  // Backdrop = série la plus regardée (repli : première série avec un backdrop).
  const heroBackdrop =
    stats.topShows[0]?.show?.backdrop_path ??
    (shows.data ?? []).find((s) => s.backdrop_path)?.backdrop_path ??
    null;
  const heroUri = imageUrl(heroBackdrop, 'w780');

  const maxBar = Math.max(1, ...stats.bars);

  // --- Blocs réutilisés par les layouts mobile (1 col) et desktop (2 col) ---
  const devantEcran = (
    <View className="rounded-3xl overflow-hidden">
      <LinearGradient
        colors={['#2a2418', '#1A2235']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 20 }}
      >
        <Text className="text-muted text-[11px] font-bold tracking-[2px]">
          DEVANT L'ÉCRAN
        </Text>
        <View className="flex-row items-end gap-1 mt-1">
          <Text className="text-accent text-[46px] font-extrabold leading-[48px]">
            {stats.days}
          </Text>
          <Text className="text-accent text-2xl font-extrabold mb-2">j</Text>
          <Text className="text-fg text-[46px] font-extrabold leading-[48px] ml-2">
            {stats.hours}
          </Text>
          <Text className="text-fg text-2xl font-extrabold mb-2">h</Text>
        </View>
        {stats.months > 0 ? (
          <Text className="text-muted text-[12px] mt-1">
            soit ~{stats.months} mois de ta vie ✦
          </Text>
        ) : null}
      </LinearGradient>
    </View>
  );

  const tiles = (
    <View className="flex-row gap-3">
      {[
        { v: stats.shows, l: 'Séries' },
        { v: stats.episodes.toLocaleString('fr'), l: 'Épisodes' },
        { v: stats.moviesWatched.toLocaleString('fr'), l: 'Films' },
      ].map((s) => (
        <View
          key={s.l}
          className="flex-1 rounded-2xl p-3.5 items-center"
          style={{
            backgroundColor: 'rgba(36,47,73,0.6)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <Text className="text-fg text-lg font-extrabold">{s.v}</Text>
          <Text className="text-muted text-[10.5px] mt-0.5">{s.l}</Text>
        </View>
      ))}
    </View>
  );

  const activity = (
    <View className="bg-surface rounded-2xl p-4 gap-2.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-fg text-[14px] font-bold">
          Activité {stats.year}
        </Text>
        <Text className="text-muted text-[11px]">
          {stats.yearTotal} épisodes
        </Text>
      </View>
      <View className="flex-row items-end gap-[3px] h-16">
        {stats.bars.map((n, i) => (
          <View
            key={i}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${Math.max(4, (n / maxBar) * 100)}%`,
              backgroundColor:
                i === stats.bars.length - 1 ? colors.accent : '#2f3d5c',
            }}
          />
        ))}
      </View>
    </View>
  );

  const shortcuts = (
    <View className="flex-row gap-3">
      <Shortcut
        icon="albums"
        label="Mes listes"
        sub="Collections"
        onPress={() => router.push('/lists')}
      />
      <Shortcut
        icon="stats-chart"
        label="Mon bilan"
        sub="Stats par année"
        onPress={() => router.push('/stats')}
      />
    </View>
  );

  const topSeries = stats.topShows.length ? (
    <View className="gap-2">
      <Text className="text-fg text-lg font-bold">Top séries</Text>
      {stats.topShows.map((entry, index) => {
        const uri = imageUrl(entry.show?.poster_path, 'w92');
        return (
          <Pressable
            key={entry.tmdbId}
            onPress={() => router.push(`/show/${entry.tmdbId}`)}
            className="flex-row items-center gap-3 bg-surface rounded-xl p-2"
            style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
          >
            <Text className="text-accent text-base font-extrabold w-6 text-center">
              {index + 1}
            </Text>
            {uri ? (
              <Image source={{ uri }} className="w-8 aspect-[2/3] rounded" />
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
  ) : null;

  const footer = (
    <View className="items-center gap-2 mt-6 mb-2">
      <Image
        source={require('../../assets/logo.png')}
        style={{ width: 32, height: 32, opacity: 0.9 }}
        resizeMode="contain"
      />
      <View style={{ maxWidth: 320 }}>
        <Muted size="xs">
          PopcornLog v{Constants.expoConfig?.version ?? '1.0.0'}
          {Updates.updateId ? ` · maj ${Updates.updateId.slice(0, 8)}` : ''}
          {'\n'}Temps d'écran estimé (42 min/épisode, 1 h 50/film). Données
          TMDB — application non approuvée par TMDB.
        </Muted>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-bg">
      {/* Colonne centrée sur desktop : le hero et la ⚙️ y sont ancrés
          ensemble (sinon la ⚙️, collée au viewport, se détache à droite). */}
      <View
        className="flex-1 w-full self-center"
        style={{ maxWidth: isDesktop ? 720 : undefined }}
      >
        {/* ⚙️ Réglages : flotte en haut à droite, sur le hero. */}
        <View className="absolute right-3 z-10" style={{ top: insets.top + 4 }}>
          <FloatingButton
            icon="settings-outline"
            onPress={() => router.push('/settings')}
          />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* HERO cinéma : backdrop flou + identité posée dessus. */}
        <View style={{ height: 250 }}>
          {heroUri ? (
            <Image
              source={{ uri: heroUri }}
              className="w-full h-full"
              blurRadius={12}
            />
          ) : (
            <View className="w-full h-full bg-surface-light" />
          )}
          <LinearGradient
            colors={['rgba(13,19,33,0.25)', 'rgba(13,19,33,0.7)', '#0D1321']}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <View
            className="absolute left-0 right-0 items-center gap-2"
            style={{ bottom: 16, top: insets.top + 8, justifyContent: 'flex-end' }}
          >
            <View
              className="w-[74px] h-[74px] rounded-full items-center justify-center border-2"
              style={{
                borderColor: 'rgba(255,212,73,0.6)',
                backgroundColor: 'rgba(255,212,73,0.14)',
              }}
            >
              <Text className="text-accent text-3xl font-extrabold">
                {initial}
              </Text>
            </View>
            <Text className="text-fg text-xl font-extrabold">{displayName}</Text>
            <Text className="text-muted text-[12px]" numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>

        <View className="px-4 gap-3 -mt-2">
          {/* Pièce maîtresse : temps devant l'écran. */}
          <View className="rounded-3xl overflow-hidden">
            <LinearGradient
              colors={['#2a2418', '#1A2235']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 20 }}
            >
              <Text className="text-muted text-[11px] font-bold tracking-[2px]">
                DEVANT L'ÉCRAN
              </Text>
              <View className="flex-row items-end gap-1 mt-1">
                <Text className="text-accent text-[46px] font-extrabold leading-[48px]">
                  {stats.days}
                </Text>
                <Text className="text-accent text-2xl font-extrabold mb-2">
                  j
                </Text>
                <Text className="text-fg text-[46px] font-extrabold leading-[48px] ml-2">
                  {stats.hours}
                </Text>
                <Text className="text-fg text-2xl font-extrabold mb-2">h</Text>
              </View>
              {stats.months > 0 ? (
                <Text className="text-muted text-[12px] mt-1">
                  soit ~{stats.months} mois de ta vie ✦
                </Text>
              ) : null}
            </LinearGradient>
          </View>

          {/* Trois tuiles vitrées. */}
          <View className="flex-row gap-3">
            {[
              { v: stats.shows, l: 'Séries' },
              { v: stats.episodes.toLocaleString('fr'), l: 'Épisodes' },
              { v: stats.moviesWatched.toLocaleString('fr'), l: 'Films' },
            ].map((s) => (
              <View
                key={s.l}
                className="flex-1 rounded-2xl p-3.5 items-center"
                style={{
                  backgroundColor: 'rgba(36,47,73,0.6)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.05)',
                }}
              >
                <Text className="text-fg text-lg font-extrabold">{s.v}</Text>
                <Text className="text-muted text-[10.5px] mt-0.5">{s.l}</Text>
              </View>
            ))}
          </View>

          {/* Activité de l'année en barres. */}
          <View className="bg-surface rounded-2xl p-4 gap-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-fg text-[14px] font-bold">
                Activité {stats.year}
              </Text>
              <Text className="text-muted text-[11px]">
                {stats.yearTotal} épisodes
              </Text>
            </View>
            <View className="flex-row items-end gap-[3px] h-16">
              {stats.bars.map((n, i) => (
                <View
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${Math.max(4, (n / maxBar) * 100)}%`,
                    backgroundColor:
                      i === stats.bars.length - 1 ? colors.accent : '#2f3d5c',
                  }}
                />
              ))}
            </View>
          </View>

          {/* Raccourcis Pro. */}
          <View className="flex-row gap-3">
            <Shortcut
              icon="albums"
              label="Mes listes"
              sub="Collections"
              onPress={() => router.push('/lists')}
            />
            <Shortcut
              icon="stats-chart"
              label="Mon bilan"
              sub="Stats par année"
              onPress={() => router.push('/stats')}
            />
          </View>

          {/* Top séries. */}
          {stats.topShows.length ? (
            <View className="gap-2 mt-1">
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

          {/* Pied de page : logo + version + attribution. */}
          <View className="items-center gap-2 mt-6 mb-2">
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 32, height: 32, opacity: 0.9 }}
              resizeMode="contain"
            />
            <View style={{ maxWidth: 320 }}>
              <Muted size="xs">
                PopcornLog v{Constants.expoConfig?.version ?? '1.0.0'}
                {Updates.updateId
                  ? ` · maj ${Updates.updateId.slice(0, 8)}`
                  : ''}
                {'\n'}Temps d'écran estimé (42 min/épisode, 1 h 50/film).
                Données TMDB — application non approuvée par TMDB.
              </Muted>
            </View>
          </View>
        </View>
        </ScrollView>
      </View>
    </View>
  );
}
