import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, SectionList, Text, View } from 'react-native';
import { RowListSkeleton } from '@/components/Skeleton';
import { EmptyState, Screen } from '@/components/ui';
import { useAllWatchedEpisodes, useTrackedShows } from '@/hooks/queries';
import { usePersistedState } from '@/hooks/usePersistedState';
import { syncEpisodeNotifications } from '@/lib/notifications';
import { episodeKey } from '@/lib/progress';
import {
  getSeasonDetails,
  getShowDetails,
  imageUrl,
  type TmdbSeasonDetails,
  type TmdbShowDetails,
} from '@/lib/tmdb';
import { colors } from '@/lib/theme';

type Mode = 'upcoming' | 'recent';

interface CalendarItem {
  showId: number;
  showName: string;
  posterPath: string | null;
  season: number;
  episode: number;
  episodeName: string;
  airDate: string;
  watched: boolean;
}

const RECENT_DAYS = 14;

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function relativeLabel(airDate: string): string {
  const today = new Date(`${isoToday()}T00:00:00`);
  const date = new Date(`${airDate}T00:00:00`);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  if (diff > 1 && diff <= 7) return `Dans ${diff} jours`;
  if (diff < -1 && diff >= -7) return `Il y a ${-diff} jours`;
  return '';
}

function dateHeader(airDate: string): string {
  const label = new Date(`${airDate}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const relative = relativeLabel(airDate);
  return relative ? `${label} · ${relative}` : label;
}

export default function CalendarScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('upcoming');
  const shows = useTrackedShows();
  const watchedRows = useAllWatchedEpisodes();

  const activeShows = useMemo(
    () =>
      (shows.data ?? []).filter(
        (show) => show.status === 'watching' || show.status === 'planned'
      ),
    [shows.data]
  );

  const detailQueries = useQueries({
    queries: activeShows.map((show) => ({
      queryKey: ['tmdb', 'show', show.tmdb_id],
      queryFn: () => getShowDetails(show.tmdb_id),
      staleTime: 1000 * 60 * 60,
    })),
  });

  // Saison du prochain épisode annoncé → tous les épisodes futurs, pas juste un.
  const seasonTargets = useMemo(
    () =>
      detailQueries
        .map((query, index) => ({
          show: activeShows[index],
          details: query.data as TmdbShowDetails | undefined,
        }))
        .filter((entry) => entry.show && entry.details?.next_episode_to_air)
        .map((entry) => ({
          show: entry.show,
          seasonNumber: entry.details!.next_episode_to_air!.season_number,
        })),
    [detailQueries, activeShows]
  );

  const seasonQueries = useQueries({
    queries: seasonTargets.map((target) => ({
      queryKey: ['tmdb', 'season', target.show.tmdb_id, target.seasonNumber],
      queryFn: () => getSeasonDetails(target.show.tmdb_id, target.seasonNumber),
      staleTime: 1000 * 60 * 60,
    })),
  });

  const loading =
    shows.isLoading || detailQueries.some((query) => query.isLoading);

  const items = useMemo(() => {
    const watchedSet = new Set(
      (watchedRows.data ?? []).map(
        (row) => `${row.tmdb_show_id}:${episodeKey(row.season_number, row.episode_number)}`
      )
    );
    const showById = new Map(activeShows.map((show) => [show.tmdb_id, show]));
    const seen = new Set<string>();
    const items: CalendarItem[] = [];

    const push = (
      showId: number,
      episode: {
        season_number: number;
        episode_number: number;
        name: string;
        air_date: string | null;
      }
    ) => {
      if (!episode.air_date) return;
      const dedupe = `${showId}:${episode.season_number}:${episode.episode_number}`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);
      const show = showById.get(showId);
      if (!show) return;
      items.push({
        showId,
        showName: show.name,
        posterPath: show.poster_path,
        season: episode.season_number,
        episode: episode.episode_number,
        episodeName: episode.name,
        airDate: episode.air_date,
        watched: watchedSet.has(
          `${showId}:${episodeKey(episode.season_number, episode.episode_number)}`
        ),
      });
    };

    // Épisodes des saisons en cours (couvre plusieurs semaines à venir).
    seasonQueries.forEach((query, index) => {
      const season = query.data as TmdbSeasonDetails | undefined;
      const target = seasonTargets[index];
      if (!season || !target) return;
      for (const episode of season.episodes) push(target.show.tmdb_id, episode);
    });
    // Filets de sécurité : prochain épisode + dernier diffusé de chaque série.
    detailQueries.forEach((query, index) => {
      const details = query.data as TmdbShowDetails | undefined;
      const show = activeShows[index];
      if (!details || !show) return;
      if (details.next_episode_to_air) push(show.tmdb_id, details.next_episode_to_air);
      if (details.last_episode_to_air) push(show.tmdb_id, details.last_episode_to_air);
    });

    return items;
  }, [detailQueries, seasonQueries, seasonTargets, activeShows, watchedRows.data]);

  const sections = useMemo(() => {
    const today = isoToday();
    const recentFloor = new Date();
    recentFloor.setDate(recentFloor.getDate() - RECENT_DAYS);
    const recentFloorIso = recentFloor.toISOString().slice(0, 10);

    const filtered = items.filter((item) =>
      mode === 'upcoming'
        ? item.airDate >= today
        : item.airDate < today && item.airDate >= recentFloorIso
    );
    filtered.sort((a, b) =>
      mode === 'upcoming'
        ? a.airDate.localeCompare(b.airDate) || a.showName.localeCompare(b.showName)
        : b.airDate.localeCompare(a.airDate) || a.showName.localeCompare(b.showName)
    );

    const grouped: { title: string; data: CalendarItem[] }[] = [];
    for (const item of filtered) {
      const title = dateHeader(item.airDate);
      const last = grouped[grouped.length - 1];
      if (last && last.title === title) last.data.push(item);
      else grouped.push({ title, data: [item] });
    }
    return grouped;
  }, [items, mode]);

  // Notifications de diffusion : replanifiées à chaque passage ici.
  const [notifEnabled] = usePersistedState('notifications', false);
  useEffect(() => {
    if (!notifEnabled || loading || !items.length) return;
    const today = isoToday();
    syncEpisodeNotifications(
      items
        .filter((item) => item.airDate >= today)
        .map((item) => ({
          showName: item.showName,
          season: item.season,
          episode: item.episode,
          airDate: item.airDate,
        }))
    ).catch(() => {});
  }, [notifEnabled, loading, items]);

  if (loading) {
    return (
      <Screen>
        <RowListSkeleton />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row bg-surface rounded-lg p-[3px] mx-4 mt-2 mb-1">
        {(
          [
            ['upcoming', 'À venir'],
            ['recent', 'Sortis récemment'],
          ] as [Mode, string][]
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setMode(value)}
            className={`flex-1 py-2 rounded-md items-center ${
              mode === value ? 'bg-accent' : ''
            }`}
          >
            <Text
              className={`font-semibold text-sm ${
                mode === value ? 'text-accent-fg' : 'text-muted'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {sections.length ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) =>
            `${item.showId}-${item.season}-${item.episode}`
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          renderSectionHeader={({ section }) => (
            <Text className="text-accent text-[13px] font-bold px-4 pt-5 pb-2 capitalize">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => {
            const uri = imageUrl(item.posterPath, 'w185');
            return (
              <Pressable
                onPress={() =>
                  router.push(`/show/${item.showId}?tab=episodes`)
                }
                className="flex-row items-center bg-surface rounded-2xl p-3 mx-4 mb-3 gap-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.8 } : undefined
                }
              >
                {uri ? (
                  <Image
                    source={{ uri }}
                    className="w-11 aspect-[2/3] rounded-md"
                  />
                ) : (
                  <View className="w-11 aspect-[2/3] rounded-md bg-surface-light" />
                )}
                <View className="flex-1 gap-0.5">
                  <Text
                    className="text-fg text-[15px] font-bold"
                    numberOfLines={1}
                  >
                    {item.showName}
                  </Text>
                  <Text className="text-muted text-[13px]" numberOfLines={1}>
                    S{String(item.season).padStart(2, '0')}E
                    {String(item.episode).padStart(2, '0')}
                    {item.episodeName ? ` · ${item.episodeName}` : ''}
                  </Text>
                </View>
                {mode === 'recent' ? (
                  <Ionicons
                    name={item.watched ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={item.watched ? colors.accent : colors.textMuted}
                  />
                ) : null}
              </Pressable>
            );
          }}
        />
      ) : (
        <EmptyState
          title={
            mode === 'upcoming' ? "Rien à l'horizon" : 'Rien ces deux dernières semaines'
          }
          subtitle={
            mode === 'upcoming'
              ? 'Aucun épisode annoncé pour tes séries en cours.'
              : 'Les épisodes sortis apparaîtront ici.'
          }
        />
      )}
    </Screen>
  );
}
