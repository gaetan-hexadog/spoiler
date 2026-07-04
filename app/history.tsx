import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SectionList,
  Text,
  View,
} from 'react-native';
import { colors } from '@/lib/theme';
import { RowListSkeleton } from '@/components/Skeleton';
import { EmptyState, Screen } from '@/components/ui';
import {
  useAllWatchedEpisodes,
  useMovies,
  useTrackedShows,
} from '@/hooks/queries';
import { imageUrl } from '@/lib/tmdb';

interface HistoryItem {
  key: string;
  kind: 'episode' | 'movie';
  tmdbId: number;
  title: string;
  detail: string;
  posterPath: string | null;
  watchedAt: string;
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
  const router = useRouter();
  const episodes = useAllWatchedEpisodes();
  const shows = useTrackedShows();
  const movies = useMovies();
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
        ListFooterComponent={
          hasMore ? (
            <View className="py-5 items-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Text className="text-accent text-[13px] font-bold px-4 pt-5 pb-2 capitalize">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const uri = imageUrl(item.posterPath, 'w92');
          return (
            <Pressable
              onPress={() =>
                router.push(
                  item.kind === 'episode'
                    ? `/show/${item.tmdbId}`
                    : `/movie/${item.tmdbId}`
                )
              }
              className="flex-row items-center gap-3 px-4 py-1.5"
              style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
            >
              {uri ? (
                <Image source={{ uri }} className="w-9 aspect-[2/3] rounded" />
              ) : (
                <View className="w-9 aspect-[2/3] rounded bg-surface" />
              )}
              <View className="flex-1">
                <Text className="text-fg text-sm font-semibold" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text className="text-muted text-xs">
                  {item.detail}
                  {' · '}
                  {new Date(item.watchedAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
