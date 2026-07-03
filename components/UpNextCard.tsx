import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import {
  useMarkEpisode,
  useSeasonDetails,
  useShowDetails,
} from '@/hooks/queries';
import type { TrackedShow, WatchedEpisode } from '@/lib/db';
import { isUpToDate, nextEpisode, watchedSetForShow } from '@/lib/progress';
import { imageUrl } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

/** Card « À voir ensuite » : image de l'épisode, SxxEyy, check rapide. */
export function UpNextCard({
  show,
  allWatched,
}: {
  show: TrackedShow;
  allWatched: WatchedEpisode[];
}) {
  const router = useRouter();
  const { data: details } = useShowDetails(show.tmdb_id);
  const markEpisode = useMarkEpisode();

  const watched = watchedSetForShow(allWatched, show.tmdb_id);
  const next = details ? nextEpisode(details.seasons, watched) : null;
  const lastAired = details?.last_episode_to_air ?? null;
  const upToDate = details
    ? isUpToDate(details.seasons, watched, lastAired)
    : true;

  const season = useSeasonDetails(
    show.tmdb_id,
    details && next && !upToDate ? next.season : null
  );

  if (!details || !next || upToDate) return null;

  const episode = season.data?.episodes.find(
    (ep) => ep.episode_number === next.episode
  );
  const image = imageUrl(
    episode?.still_path ?? details.backdrop_path,
    'w342'
  );

  return (
    <Pressable
      onPress={() => router.push(`/show/${show.tmdb_id}?tab=episodes`)}
      className="w-60 mr-3 rounded-2xl overflow-hidden bg-surface"
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      <View className="aspect-video">
        {image ? (
          <Image source={{ uri: image }} className="w-full h-full" />
        ) : (
          <View className="w-full h-full bg-surface-light" />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(13, 19, 33, 0.97)']}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 70,
            justifyContent: 'flex-end',
            padding: 10,
          }}
        >
          <Text className="text-fg text-sm font-bold" numberOfLines={1}>
            {show.name}
          </Text>
          <Text className="text-muted text-xs" numberOfLines={1}>
            S{String(next.season).padStart(2, '0')}E
            {String(next.episode).padStart(2, '0')}
            {episode?.name ? ` · ${episode.name}` : ''}
          </Text>
        </LinearGradient>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            markEpisode.mutate({
              showId: show.tmdb_id,
              season: next.season,
              episode: next.episode,
              watched: true,
            });
          }}
          disabled={markEpisode.isPending}
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-bg/60 border border-fg/40 items-center justify-center"
          style={({ pressed }) =>
            pressed || markEpisode.isPending ? { opacity: 0.6 } : undefined
          }
        >
          <Ionicons name="checkmark" size={20} color={colors.text} />
        </Pressable>
      </View>
    </Pressable>
  );
}
