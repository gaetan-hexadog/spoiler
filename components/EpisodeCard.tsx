import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { imageUrl, type TmdbEpisode } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

/** Fiche épisode : image, infos, coche — tap pour déplier le synopsis. */
export function EpisodeCard({
  episode,
  watched,
  onToggleWatched,
}: {
  episode: TmdbEpisode;
  watched: boolean;
  onToggleWatched: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const still = imageUrl(episode.still_path, 'w342');
  const today = new Date().toISOString().slice(0, 10);
  const notAired = !!episode.air_date && episode.air_date > today;

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      className={`bg-surface rounded-2xl overflow-hidden ${
        notAired ? 'opacity-50' : ''
      }`}
    >
      <View className="flex-row gap-3 p-3 items-center">
        <View className="w-32 aspect-video rounded-lg bg-surface-light overflow-hidden">
          {still ? (
            <Image source={{ uri: still }} className="w-full h-full" />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <Ionicons name="tv-outline" size={20} color={colors.textMuted} />
            </View>
          )}
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-muted text-[11px] font-bold">
            S{String(episode.season_number).padStart(2, '0')}E
            {String(episode.episode_number).padStart(2, '0')}
          </Text>
          <Text className="text-fg text-sm font-bold" numberOfLines={2}>
            {episode.name || `Épisode ${episode.episode_number}`}
          </Text>
          <Text className="text-muted text-xs">
            {episode.air_date
              ? new Date(`${episode.air_date}T00:00:00`).toLocaleDateString(
                  'fr-FR'
                )
              : 'Date inconnue'}
            {episode.runtime ? ` · ${episode.runtime} min` : ''}
          </Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onToggleWatched();
          }}
          className="pr-1"
          hitSlop={8}
        >
          <Ionicons
            name={watched ? 'checkmark-circle' : 'ellipse-outline'}
            size={28}
            color={watched ? colors.accent : colors.textMuted}
          />
        </Pressable>
      </View>
      {expanded && episode.overview ? (
        <Text className="text-fg text-[13px] leading-5 opacity-80 px-3 pb-3">
          {episode.overview}
        </Text>
      ) : null}
    </Pressable>
  );
}
