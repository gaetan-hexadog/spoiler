import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { imageUrl } from '@/lib/tmdb';

/**
 * Carte affiche : `width` fixe pour les carrousels horizontaux,
 * sinon flex 1/3 pour les grilles à 3 colonnes.
 */
export function PosterCard({
  title,
  posterPath,
  subtitle,
  width,
  onPress,
  onLongPress,
}: {
  title: string;
  posterPath: string | null;
  subtitle?: string;
  width?: number;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const uri = imageUrl(posterPath, 'w342');
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="m-1.5 mb-3"
      style={({ pressed }) => [
        width ? { width } : { flex: 1 / 3 },
        pressed && { opacity: 0.7 },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} className="aspect-[2/3] rounded-xl bg-surface" />
      ) : (
        <View className="aspect-[2/3] rounded-xl bg-surface items-center justify-center p-2">
          <Text className="text-muted text-xs text-center" numberOfLines={3}>
            {title}
          </Text>
        </View>
      )}
      <Text className="text-fg text-xs font-semibold mt-1" numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-muted text-[11px]" numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}
