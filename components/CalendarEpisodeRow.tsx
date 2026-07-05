import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useMarkEpisode } from '@/hooks/queries';
import { imageUrl } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

const pad = (n: number) => String(n).padStart(2, '0');

export interface CalendarRowItem {
  showId: number;
  showName: string;
  posterPath: string | null;
  season: number;
  episode: number;
  episodeName?: string;
  airDate: string;
  watched: boolean;
}

function relLabel(air: string, today: string) {
  const diff =
    (new Date(`${air}T00:00:00`).getTime() -
      new Date(`${today}T00:00:00`).getTime()) /
    86400000;
  if (diff === 1) return 'Demain';
  if (diff > 1 && diff <= 14) return `Dans ${diff} j`;
  return new Date(`${air}T00:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * 2a — Rangée d'agenda du calendrier (mobile).
 * Rend l'épisode cochable directement :
 *  - à venir  → pastille d'échéance (« Demain », « Dans N j », date)
 *  - passé/aujourd'hui non vu → bouton rond jaune (marque vu)
 *  - déjà vu  → coche pleine (statique)
 * Remplace le `renderItem` de la SectionList mobile dans calendar.tsx.
 */
export function CalendarEpisodeRow({
  item,
  today,
}: {
  item: CalendarRowItem;
  today: string;
}) {
  const router = useRouter();
  const markEpisode = useMarkEpisode();
  const uri = imageUrl(item.posterPath, 'w185');
  const future = item.airDate > today;

  return (
    <Pressable
      onPress={() => router.push(`/show/${item.showId}?tab=episodes`)}
      className="flex-row items-center bg-surface rounded-2xl p-2.5 mx-4 mb-2.5 gap-3"
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      {uri ? (
        <Image source={{ uri }} className="w-10 aspect-[2/3] rounded-md" />
      ) : (
        <View className="w-10 aspect-[2/3] rounded-md bg-surface-light" />
      )}
      <View className="flex-1">
        <Text className="text-fg text-[14px] font-bold" numberOfLines={1}>
          {item.showName}
        </Text>
        <Text className="text-muted text-[11.5px]" numberOfLines={1}>
          S{pad(item.season)}E{pad(item.episode)}
          {item.episodeName ? ` · ${item.episodeName}` : ''}
        </Text>
      </View>

      {future ? (
        <View className="bg-surface-light px-2.5 py-1 rounded-full">
          <Text className="text-muted text-[10.5px] font-extrabold">
            {relLabel(item.airDate, today)}
          </Text>
        </View>
      ) : item.watched ? (
        <Ionicons name="checkmark-circle" size={30} color={colors.accent} />
      ) : (
        // Passé mais non vu : case vide « à cocher » (tap = marquer vu),
        // distincte de la coche pleine d'un épisode réellement vu.
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            markEpisode.mutate({
              showId: item.showId,
              season: item.season,
              episode: item.episode,
              watched: true,
            });
          }}
          disabled={markEpisode.isPending}
          className="w-8 h-8 rounded-full border-2 border-line items-center justify-center"
          style={({ pressed }) =>
            pressed || markEpisode.isPending ? { opacity: 0.6 } : undefined
          }
        >
          <Ionicons name="checkmark" size={16} color={colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
}
