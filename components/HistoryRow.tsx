import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { imageUrl } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

export interface HistoryRowItem {
  key: string;
  kind: 'episode' | 'movie';
  tmdbId: number;
  title: string;
  detail: string;
  posterPath: string | null;
  watchedAt: string;
}

/**
 * 2b — Rangée de l'historique, façon journal (timeline).
 * Épine verticale à gauche + pastille (jaune = épisode, vert = film) + tag de type.
 * `isLast` coupe l'épine sous la dernière rangée d'un groupe.
 * Remplace le `renderItem` de la SectionList dans history.tsx.
 */
export function HistoryRow({
  item,
  isLast,
}: {
  item: HistoryRowItem;
  isLast?: boolean;
}) {
  const router = useRouter();
  const uri = imageUrl(item.posterPath, 'w92');
  const isMovie = item.kind === 'movie';
  const time = new Date(item.watchedAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View className="flex-row gap-3 px-4">
      <View style={{ width: 18, alignItems: 'center' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: isLast ? undefined : 0,
            height: isLast ? 24 : undefined,
            width: 2,
            backgroundColor: colors.surfaceLight,
          }}
        />
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 99,
            marginTop: 18,
            backgroundColor: isMovie ? colors.success : colors.accent,
          }}
        />
      </View>
      <Pressable
        onPress={() =>
          router.push(isMovie ? `/movie/${item.tmdbId}` : `/show/${item.tmdbId}`)
        }
        className="flex-1 flex-row items-center gap-3 pb-3"
        style={({ pressed }) => (pressed ? { opacity: 0.75 } : undefined)}
      >
        {uri ? (
          <Image source={{ uri }} className="w-10 aspect-[2/3] rounded-md" />
        ) : (
          <View className="w-10 aspect-[2/3] rounded-md bg-surface" />
        )}
        <View className="flex-1">
          <Text className="text-fg text-[13.5px] font-bold" numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-muted text-[11px]" numberOfLines={1}>
            {item.detail}
          </Text>
        </View>
        <View className="items-end gap-1">
          <View className={`px-1.5 py-0.5 rounded ${isMovie ? 'bg-success/15' : 'bg-accent/15'}`}>
            <Text className={`text-[9px] font-extrabold ${isMovie ? 'text-success' : 'text-accent'}`}>
              {isMovie ? 'FILM' : 'ÉP'}
            </Text>
          </View>
          <Text className="text-muted text-[10.5px]">{time}</Text>
        </View>
      </Pressable>
    </View>
  );
}
