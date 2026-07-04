import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import { useHoverScale } from '@/hooks/useHoverScale';
import { imageUrl } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

/** Statut d'un item déjà présent dans la bibliothèque de l'utilisateur. */
export type LibraryBadge = 'watched' | 'watching' | 'planned' | 'stopped';

const BADGE_STYLE: Record<
  LibraryBadge,
  { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }
> = {
  watched: { icon: 'checkmark', bg: colors.success, fg: '#04231A' },
  watching: { icon: 'play', bg: colors.accent, fg: colors.accentText },
  planned: { icon: 'bookmark', bg: colors.surfaceLight, fg: colors.text },
  stopped: { icon: 'close', bg: colors.danger, fg: '#fff' },
};

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
  badge,
  onPress,
  onLongPress,
}: {
  title: string;
  posterPath: string | null;
  subtitle?: string;
  width?: number;
  columns?: number;
  badge?: LibraryBadge;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const uri = imageUrl(posterPath, 'w342');
  const { scale, onHoverIn, onHoverOut } = useHoverScale();
  const badgeStyle = badge ? BADGE_STYLE[badge] : null;
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
      <View className="aspect-[2/3] rounded-xl bg-surface overflow-hidden">
        {uri ? (
          <Image source={{ uri }} className="w-full h-full" />
        ) : (
          <View className="w-full h-full items-center justify-center p-2">
            <Text className="text-muted text-xs text-center" numberOfLines={3}>
              {title}
            </Text>
          </View>
        )}
        {badgeStyle ? (
          <View
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full items-center justify-center"
            style={{ backgroundColor: badgeStyle.bg }}
          >
            <Ionicons name={badgeStyle.icon} size={14} color={badgeStyle.fg} />
          </View>
        ) : null}
      </View>
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
