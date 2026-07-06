import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { EmptyState, Screen } from '@/components/ui';
import {
  useAllWatchedEpisodes,
  useMovies,
  useTrackedShows,
} from '@/hooks/queries';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { usePro } from '@/hooks/usePro';
import { imageUrl } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

const EPISODE_MINUTES = 42;
const MOVIE_MINUTES = 110;
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDuration(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  if (days > 0) return `${days} j ${hours} h`;
  return `${hours} h`;
}

function Card({
  icon,
  label,
  value,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View className="bg-surface rounded-2xl p-4 flex-1 min-w-[46%] gap-1">
      <View className="flex-row items-center gap-1.5">
        <Ionicons name={icon} size={13} color={colors.textMuted} />
        <Text className="text-muted text-[10.5px] font-bold tracking-wider uppercase">
          {label}
        </Text>
      </View>
      <Text className="text-fg text-[19px] font-extrabold">{value}</Text>
      {sub ? <Text className="text-muted text-[11.5px]">{sub}</Text> : null}
    </View>
  );
}

/**
 * Mon bilan (Pro) : statistiques avancées par année — temps devant l'écran,
 * records (plus gros jour, série de jours consécutifs, mois le plus actif),
 * top séries/films de l'année, heatmap complète. Non-Pro : teaser + paywall.
 */
export default function StatsScreen() {
  const router = useRouter();
  const { isPro } = usePro();
  const isDesktop = useBreakpoint() === 'desktop';
  const shows = useTrackedShows();
  const watched = useAllWatchedEpisodes();
  const movies = useMovies();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  // Années disponibles (épisodes + films), plus récentes d'abord.
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const e of watched.data ?? []) set.add(new Date(e.watched_at).getFullYear());
    for (const m of movies.data ?? [])
      if (m.watched_at) set.add(new Date(m.watched_at).getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [watched.data, movies.data]);

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const activeYear = years.includes(year) ? year : (years[0] ?? year);

  const stats = useMemo(() => {
    const episodes = (watched.data ?? []).filter(
      (e) => new Date(e.watched_at).getFullYear() === activeYear
    );
    const yearMovies = (movies.data ?? []).filter(
      (m) => m.watched_at && new Date(m.watched_at).getFullYear() === activeYear
    );

    // Par jour (YYYY-MM-DD) et par mois.
    const byDay = new Map<string, number>();
    const byMonth = new Array(12).fill(0);
    const byShow = new Map<number, number>();
    for (const e of episodes) {
      const d = new Date(e.watched_at);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byDay.set(iso, (byDay.get(iso) ?? 0) + 1);
      byMonth[d.getMonth()] += 1;
      byShow.set(e.tmdb_show_id, (byShow.get(e.tmdb_show_id) ?? 0) + 1);
    }

    // Record : plus gros jour.
    let bestDay: { iso: string; count: number } | null = null;
    for (const [iso, count] of byDay) {
      if (!bestDay || count > bestDay.count) bestDay = { iso, count };
    }

    // Record : plus longue série de jours consécutifs avec ≥ 1 épisode.
    const days = [...byDay.keys()].sort();
    let streak = 0;
    let bestStreak = 0;
    let prev: string | null = null;
    for (const iso of days) {
      if (prev) {
        const next = new Date(`${prev}T00:00:00`);
        next.setDate(next.getDate() + 1);
        const expected = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
        streak = iso === expected ? streak + 1 : 1;
      } else {
        streak = 1;
      }
      bestStreak = Math.max(bestStreak, streak);
      prev = iso;
    }

    // Mois le plus actif.
    let bestMonth = 0;
    for (let m = 1; m < 12; m++) if (byMonth[m] > byMonth[bestMonth]) bestMonth = m;

    // Top séries de l'année.
    const showById = new Map((shows.data ?? []).map((s) => [s.tmdb_id, s]));
    const topShows = [...byShow.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tmdbId, count]) => ({ show: showById.get(tmdbId), tmdbId, count }))
      .filter((entry) => entry.show);

    // Top films notés de l'année (sinon derniers vus).
    const topMovies = [...yearMovies]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.watched_at ?? '').localeCompare(a.watched_at ?? ''))
      .slice(0, 5);

    return {
      episodes: episodes.length,
      movies: yearMovies.length,
      showCount: byShow.size,
      minutes: episodes.length * EPISODE_MINUTES + yearMovies.length * MOVIE_MINUTES,
      activeDays: byDay.size,
      bestDay,
      bestStreak,
      bestMonth: byMonth[bestMonth] > 0 ? { month: bestMonth, count: byMonth[bestMonth] } : null,
      topShows,
      topMovies,
    };
  }, [watched.data, movies.data, shows.data, activeYear]);

  const header = (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <Pressable onPress={goBack} hitSlop={8}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <Text className="text-fg text-2xl font-extrabold">Mon bilan</Text>
    </View>
  );

  if (!isPro) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <EmptyState
          icon="stats-chart"
          title="Statistiques avancées"
          subtitle="Records, top de l'année, temps par période, heatmap complète… C'est une fonctionnalité Pro."
          action={{ label: 'Découvrir Pro', onPress: () => router.push('/pro') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
          gap: 16,
          width: '100%',
          maxWidth: isDesktop ? 1100 : 720,
          alignSelf: 'center',
        }}
      >
        {/* Sélecteur d'année */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {(years.length ? years : [activeYear]).map((y) => (
            <Pressable
              key={y}
              onPress={() => setYear(y)}
              className={`px-4 py-2 rounded-full ${
                y === activeYear ? 'bg-accent' : 'bg-surface'
              }`}
            >
              <Text
                className={`text-[13.5px] font-bold ${
                  y === activeYear ? 'text-accent-fg' : 'text-muted'
                }`}
              >
                {y}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Chiffre héros */}
        <View className="bg-surface-light rounded-3xl p-5">
          <Text className="text-muted text-xs font-bold tracking-wider">
            DEVANT L'ÉCRAN EN {activeYear}
          </Text>
          <Text className="text-accent text-[40px] font-extrabold mt-1">
            {formatDuration(stats.minutes)}
          </Text>
          <Text className="text-muted text-xs mt-2">
            {stats.episodes} épisodes · {stats.movies} films · {stats.showCount}{' '}
            séries différentes
          </Text>
        </View>

        {/* Records */}
        <View className="flex-row flex-wrap gap-3">
          <Card
            icon="flame"
            label="Record en un jour"
            value={stats.bestDay ? `${stats.bestDay.count} épisodes` : '—'}
            sub={
              stats.bestDay
                ? new Date(`${stats.bestDay.iso}T00:00:00`).toLocaleDateString(
                    'fr-FR',
                    { day: 'numeric', month: 'long' }
                  )
                : undefined
            }
          />
          <Card
            icon="trending-up"
            label="Série de jours"
            value={stats.bestStreak ? `${stats.bestStreak} jours` : '—'}
            sub="d'affilée avec au moins 1 épisode"
          />
          <Card
            icon="calendar"
            label="Mois le plus actif"
            value={stats.bestMonth ? MONTHS[stats.bestMonth.month] : '—'}
            sub={
              stats.bestMonth ? `${stats.bestMonth.count} épisodes` : undefined
            }
          />
          <Card
            icon="checkmark-done"
            label="Jours actifs"
            value={`${stats.activeDays} jours`}
            sub={`sur l'année ${activeYear}`}
          />
        </View>

        <ActivityHeatmap allWatched={watched.data ?? []} year={activeYear} />

        {/* Top de l'année : deux colonnes côte à côte sur desktop. */}
        <View className={isDesktop ? 'flex-row gap-6 items-start' : 'gap-4'}>
        {stats.topShows.length ? (
          <View className="gap-2 flex-1">
            <Text className="text-fg text-lg font-bold">
              Top séries {activeYear}
            </Text>
            {stats.topShows.map((entry, index) => {
              const uri = imageUrl(entry.show?.poster_path ?? null, 'w92');
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
        ) : null}

        {/* Top films de l'année */}
        {stats.topMovies.length ? (
          <View className="gap-2 flex-1">
            <Text className="text-fg text-lg font-bold">
              Top films {activeYear}
            </Text>
            {stats.topMovies.map((movie, index) => {
              const uri = imageUrl(movie.poster_path, 'w92');
              return (
                <Pressable
                  key={movie.tmdb_id}
                  onPress={() => router.push(`/movie/${movie.tmdb_id}`)}
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
                    {movie.title}
                  </Text>
                  {movie.rating ? (
                    <Text className="text-accent text-xs font-bold">
                      ★ {movie.rating}/10
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
