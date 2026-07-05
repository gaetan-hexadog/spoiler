import React, { useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, Text, View } from 'react-native';
import { HistoryRow } from '@/components/HistoryRow';
import { HistoryStats } from '@/components/HistoryStats';
import { RowListSkeleton } from '@/components/Skeleton';
import { EmptyState, Screen } from '@/components/ui';
import {
  useAllWatchedEpisodes,
  useMovies,
  useTrackedShows,
} from '@/hooks/queries';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { colors } from '@/lib/theme';

interface HistoryItem {
  key: string;
  kind: 'episode' | 'movie';
  tmdbId: number;
  title: string;
  detail: string;
  posterPath: string | null;
  watchedAt: string;
}

const EPISODE_MINUTES = 42;
const MOVIE_MINUTES = 110;

function fmtMins(mins: number): string {
  const days = Math.floor(mins / 1440);
  const h = Math.round((mins % 1440) / 60);
  return days > 0 ? `${days} j ${h} h` : `${h} h`;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Aujourd'hui";
  if (sameDay(date, yesterday)) return 'Hier';
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

const PAGE_SIZE = 150;

export default function HistoryScreen() {
  const episodes = useAllWatchedEpisodes();
  const shows = useTrackedShows();
  const movies = useMovies();
  const isDesktop = useBreakpoint() === 'desktop';
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Liste plate triée, calculée une seule fois.
  const allItems = useMemo(() => {
    const showById = new Map(
      (shows.data ?? []).map((show) => [show.tmdb_id, show])
    );
    const items: HistoryItem[] = [];

    for (const episode of episodes.data ?? []) {
      const show = showById.get(episode.tmdb_show_id);
      items.push({
        key: `e-${episode.id}`,
        kind: 'episode',
        tmdbId: episode.tmdb_show_id,
        title: show?.name ?? `Série ${episode.tmdb_show_id}`,
        detail: `S${String(episode.season_number).padStart(2, '0')}E${String(
          episode.episode_number
        ).padStart(2, '0')}`,
        posterPath: show?.poster_path ?? null,
        watchedAt: episode.watched_at,
      });
    }
    for (const movie of movies.data ?? []) {
      if (movie.status !== 'watched' || !movie.watched_at) continue;
      items.push({
        key: `m-${movie.id}`,
        kind: 'movie',
        tmdbId: movie.tmdb_id,
        title: movie.title,
        detail: 'Film',
        posterPath: movie.poster_path,
        watchedAt: movie.watched_at,
      });
    }

    items.sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));
    return items;
  }, [episodes.data, shows.data, movies.data]);

  // Seule la fenêtre visible est groupée par jour — le reste arrive au scroll.
  const sections = useMemo(() => {
    const grouped: { title: string; data: HistoryItem[] }[] = [];
    for (const item of allItems.slice(0, limit)) {
      const label = dayLabel(item.watchedAt);
      const last = grouped[grouped.length - 1];
      if (last && last.title === label) last.data.push(item);
      else grouped.push({ title: label, data: [item] });
    }
    return grouped;
  }, [allItems, limit]);

  const hasMore = limit < allItems.length;

  if (episodes.isLoading || shows.isLoading || movies.isLoading) {
    return (
      <Screen>
        <RowListSkeleton count={10} />
      </Screen>
    );
  }

  if (!sections.length) {
    return (
      <Screen>
        <EmptyState
          title="Historique vide"
          subtitle="Marque des épisodes ou des films comme vus pour les retrouver ici."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{
          paddingBottom: 32,
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
        }}
        initialNumToRender={20}
        onEndReached={() => {
          if (hasMore) setLimit((current) => current + PAGE_SIZE);
        }}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View className={isDesktop ? 'px-4 pt-3 pb-1' : 'pt-3 pb-1'}>
            <HistoryStats
              items={allItems}
              variant={isDesktop ? 'strip' : 'card'}
            />
          </View>
        }
        ListFooterComponent={
          hasMore ? (
            <View className="py-5 items-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => {
          const count = section.data.length;
          const mins = section.data.reduce(
            (total, item) =>
              total + (item.kind === 'movie' ? MOVIE_MINUTES : EPISODE_MINUTES),
            0
          );
          return (
            <View className="flex-row items-center justify-between px-4 pt-5 pb-2 bg-bg">
              <Text className="text-accent text-[13px] font-bold capitalize">
                {section.title}
              </Text>
              <Text className="text-muted text-[11px] font-semibold">
                {count} · {fmtMins(mins)}
              </Text>
            </View>
          );
        }}
        renderItem={({ item, index, section }) => (
          <HistoryRow
            item={item}
            isLast={index === section.data.length - 1}
          />
        )}
      />
    </Screen>
  );
}
