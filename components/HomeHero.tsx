import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  useMarkEpisode,
  useSeasonDetails,
  useShowDetails,
} from '@/hooks/queries';
import type { TrackedShow, WatchedEpisode } from '@/lib/db';
import {
  isUpToDate,
  nextEpisode,
  totalEpisodes,
  watchedCount,
  watchedSetForShow,
} from '@/lib/progress';
import { imageUrl } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

/**
 * 1b — Bloc « Reprendre » de l'accueil.
 * Met en avant LE prochain épisode à voir de la série la plus récemment active.
 * Tap sur la carte → onglet Épisodes ; tap sur « Marquer vu » → coche l'épisode.
 *
 * À rendre en tête de l'accueil (segment « Séries », hors recherche), avec en
 * argument la 1re série de `upNextShows` (déjà triée par activité dans index.tsx).
 */
export function HomeHero({
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
  const upToDate = details
    ? isUpToDate(details.seasons, watched, details.last_episode_to_air ?? null)
    : false;
  const season = useSeasonDetails(
    show.tmdb_id,
    details && next && !upToDate ? next.season : null
  );

  if (!details || !next || upToDate) return null;

  const episode = season.data?.episodes.find(
    (ep) => ep.episode_number === next.episode
  );
  const image = imageUrl(episode?.still_path ?? details.backdrop_path, 'w780');
  const seen = watchedCount(watched);
  const total = totalEpisodes(details.seasons);
  const pct = total > 0 ? (seen / total) * 100 : 0;

  return (
    <View className="px-4 pt-1 pb-2">
      <Pressable
        onPress={() => router.push(`/show/${show.tmdb_id}?tab=episodes`)}
        className="rounded-3xl overflow-hidden"
        style={({ pressed }) => (pressed ? { opacity: 0.92 } : undefined)}
      >
        <View className="h-60">
          {image ? (
            <Image source={{ uri: image }} className="w-full h-full" />
          ) : (
            <View className="w-full h-full bg-surface-light" />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(13, 19, 33, 0.96)']}
            style={StyleSheet.absoluteFill}
          />

          <View className="absolute top-3 left-3 flex-row items-center gap-1 bg-bg/60 border border-fg/20 px-3 py-1.5 rounded-full">
            <Ionicons name="refresh" size={12} color={colors.text} />
            <Text className="text-fg text-[11px] font-extrabold tracking-wide">
              REPRENDRE
            </Text>
          </View>

          <View className="absolute left-4 right-4 bottom-4">
            <Text className="text-fg text-[22px] font-extrabold" numberOfLines={1}>
              {show.name}
            </Text>
            <Text className="text-fg/80 text-[13px] mt-0.5" numberOfLines={1}>
              S{String(next.season).padStart(2, '0')} E
              {String(next.episode).padStart(2, '0')}
              {episode?.name ? ` · ${episode.name}` : ''}
            </Text>

            <View className="flex-row items-center gap-2 my-3">
              <View className="flex-1 h-1.5 rounded-full bg-fg/20 overflow-hidden">
                <View
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </View>
              <Text className="text-muted text-[11px] font-bold">
                {seen} / {total}
              </Text>
            </View>

            <View className="flex-row gap-2.5">
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
                className="flex-1 bg-accent rounded-xl py-3 flex-row items-center justify-center gap-1.5"
                style={({ pressed }) =>
                  pressed || markEpisode.isPending ? { opacity: 0.7 } : undefined
                }
              >
                <Ionicons name="checkmark" size={20} color={colors.accentText} />
                <Text className="text-accent-fg text-[14px] font-extrabold">
                  Marquer vu
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/show/${show.tmdb_id}?tab=episodes`)}
                className="w-12 rounded-xl bg-fg/10 border border-fg/20 items-center justify-center"
                style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
              >
                <Ionicons name="play" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
