import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import type { UserMovie } from '@/lib/db';
import { imageUrl } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

/** Ligne film pour le mode liste : affiche, statut, note. */
export function MovieRowCard({
  movie,
  onLongPress,
}: {
  movie: UserMovie;
  onLongPress?: () => void;
}) {
  const router = useRouter();
  const uri = imageUrl(movie.poster_path, 'w185');

  return (
    <Reanimated.View entering={FadeIn.duration(240)}>
    <Pressable
      onPress={() => router.push(`/movie/${movie.tmdb_id}`)}
      onLongPress={onLongPress}
      className="flex-row items-center bg-surface rounded-2xl p-3 mx-4 mb-3 gap-3"
      style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
    >
      {uri ? (
        <Image source={{ uri }} className="w-14 aspect-[2/3] rounded-md" />
      ) : (
        <View className="w-14 aspect-[2/3] rounded-md bg-surface-light" />
      )}
      <View className="flex-1 gap-1">
        <Text className="text-fg text-[15px] font-bold" numberOfLines={1}>
          {movie.title}
        </Text>
        {movie.status === 'watched' ? (
          <Text className="text-success text-xs font-semibold">
            Vu
            {movie.watched_at
              ? ` le ${new Date(movie.watched_at).toLocaleDateString('fr-FR')}`
              : ''}
          </Text>
        ) : (
          <Text className="text-accent text-xs font-semibold">À voir</Text>
        )}
        {movie.rating ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="star" size={12} color={colors.accent} />
            <Text className="text-muted text-xs">{movie.rating}/10</Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
    </Reanimated.View>
  );
}
