import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import { useActionSheet } from '@/components/ActionSheet';
import { useHoverScale } from '@/hooks/useHoverScale';
import { useShowQuickActions } from '@/hooks/useShowQuickActions';
import { useShowDetails } from '@/hooks/queries';
import { useAutoShowStatus } from '@/hooks/useAutoShowStatus';
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

/** Tuile de grille : affiche + progression + badge « à voir » / « à jour ». */
export function ShowGridCard({
  show,
  allWatched,
  columns = 3,
}: {
  show: TrackedShow;
  allWatched: WatchedEpisode[];
  columns?: number;
}) {
  const router = useRouter();
  const { data: details } = useShowDetails(show.tmdb_id);
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

  const uri = imageUrl(show.poster_path, 'w342');
  const { scale, onHoverIn, onHoverOut } = useHoverScale();

  return (
    <Pressable
      onPress={() => router.push(`/show/${show.tmdb_id}`)}
      onLongPress={() => quickActions(show, upToDate ? null : next)}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      className="m-1.5 mb-3"
      style={({ pressed }) => [
        { flex: 1 / columns },
        pressed && { opacity: 0.7 },
      ]}
    >
      {sheet}
      <Animated.View style={{ transform: [{ scale }] }}>
      <View className="aspect-[2/3] rounded-xl bg-surface overflow-hidden">
        {uri ? (
          <Image source={{ uri }} className="w-full h-full" />
        ) : (
          <View className="w-full h-full items-center justify-center p-2">
            <Text className="text-muted text-xs text-center" numberOfLines={3}>
              {show.name}
            </Text>
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(13, 19, 33, 0.95)']}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            justifyContent: 'flex-end',
            padding: 6,
          }}
        >
          {details ? (
            upToDate ? (
              <Text className="text-success text-[11px] font-bold">
                À jour ✓
              </Text>
            ) : (
              <Text className="text-fg text-[11px] font-bold">
                {airedRemaining} à voir
                {next ? ` · S${next.season}E${next.episode}` : ''}
              </Text>
            )
          ) : null}
        </LinearGradient>
        {total > 0 ? (
          <View className="absolute bottom-0 left-0 right-0 h-1 bg-surface-light/60">
            <View
              className="h-full bg-accent"
              style={{ width: `${(seen / total) * 100}%` }}
            />
          </View>
        ) : null}
      </View>
      <Text className="text-fg text-xs font-semibold mt-1" numberOfLines={1}>
        {show.name}
      </Text>
      </Animated.View>
    </Pressable>
  );
}
