import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { useActionSheet } from '@/components/ActionSheet';
import { ProgressBar } from '@/components/ui';
import { WatchCheck } from '@/components/WatchCheck';
import { useMarkEpisode, useShowDetails } from '@/hooks/queries';
import { useAutoShowStatus } from '@/hooks/useAutoShowStatus';
import { useShowQuickActions } from '@/hooks/useShowQuickActions';
import type { TrackedShow, WatchedEpisode } from '@/lib/db';
import {
  airedTotal,
  isUpToDate,
  nextEpisode,
  totalEpisodes,
  watchedCount,
  watchedSetForShow,
} from '@/lib/progress';
import { imageUrl } from '@/lib/tmdb';

export function ShowProgressCard({
  show,
  allWatched,
}: {
  show: TrackedShow;
  allWatched: WatchedEpisode[];
}) {
  const router = useRouter();
  const { data: details } = useShowDetails(show.tmdb_id);
  const markEpisode = useMarkEpisode();
  const { show: openSheet, sheet } = useActionSheet();
  const quickActions = useShowQuickActions(openSheet);

  const watched = watchedSetForShow(allWatched, show.tmdb_id);
  useAutoShowStatus(show, details, watched);

  const seen = watchedCount(watched);
  const total = details ? totalEpisodes(details.seasons) : 0;
  const lastAired = details?.last_episode_to_air ?? null;
  const next = details ? nextEpisode(details.seasons, watched) : null;
  const upToDate = details
    ? isUpToDate(details.seasons, watched, lastAired)
    : false;
  const airedRemaining = details
    ? Math.max(0, airedTotal(details.seasons, lastAired) - seen)
    : 0;
  const nextAirDate = details?.next_episode_to_air?.air_date;

  const uri = imageUrl(show.poster_path, 'w185');

  return (
    <Reanimated.View entering={FadeIn.duration(240)}>
    <Pressable
      onPress={() => router.push(`/show/${show.tmdb_id}`)}
      onLongPress={() => quickActions(show, upToDate ? null : next)}
      className="flex-row items-center bg-surface rounded-2xl p-3 mx-4 mb-3 gap-3"
      style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
    >
      {sheet}
      {uri ? (
        <Image source={{ uri }} className="w-14 aspect-[2/3] rounded-md" />
      ) : (
        <View className="w-14 aspect-[2/3] rounded-md bg-surface-light" />
      )}
      <View className="flex-1 gap-[5px]">
        <Text className="text-fg text-[15px] font-bold" numberOfLines={1}>
          {show.name}
        </Text>
        {details ? (
          <>
            <Text className="text-muted text-xs">
              {seen} / {total} épisodes
              {upToDate ? ' · à jour ✓' : ` · ${airedRemaining} à voir`}
            </Text>
            <ProgressBar progress={total > 0 ? seen / total : 0} />
          </>
        ) : (
          <Text className="text-muted text-xs">Chargement…</Text>
        )}
        {next && !upToDate ? (
          <Text className="text-accent text-xs font-semibold">
            À voir : S{String(next.season).padStart(2, '0')}E
            {String(next.episode).padStart(2, '0')}
          </Text>
        ) : upToDate && nextAirDate ? (
          <Text className="text-success text-xs font-semibold">
            Prochain épisode le{' '}
            {new Date(`${nextAirDate}T00:00:00`).toLocaleDateString('fr-FR')}
          </Text>
        ) : null}
      </View>
      {next && !upToDate ? (
        <WatchCheck
          watched={false}
          pending={markEpisode.isPending}
          onToggle={() =>
            markEpisode.mutate({
              showId: show.tmdb_id,
              season: next.season,
              episode: next.episode,
              watched: true,
            })
          }
        />
      ) : null}
    </Pressable>
    </Reanimated.View>
  );
}
