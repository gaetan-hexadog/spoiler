import React from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import { useHoverScale } from '@/hooks/useHoverScale';
import { imageUrl } from '@/lib/tmdb';

/**
 * Carte affiche : `width` fixe pour les carrousels horizontaux,
 * sinon fraction de ligne selon `columns` (grilles responsives).
 */
export function PosterCard({
  title,
  posterPath,
  subtitle,
  width,
  columns = 3,
  onPress,
  onLongPress,
}: {
  title: string;
  posterPath: string | null;
  subtitle?: string;
  width?: number;
  columns?: number;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const uri = imageUrl(posterPath, 'w342');
  const { scale, onHoverIn, onHoverOut } = useHoverScale();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      className="m-1.5 mb-3"
      style={({ pressed }) => [
        width ? { width } : { flex: 1 / columns },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
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
      </Animated.View>
    </Pressable>
  );
}
