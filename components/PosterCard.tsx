import React from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import { useHoverScale } from '@/hooks/useHoverScale';
import { imageUrl } from '@/lib/tmdb';

/** Statut d'un item déjà présent dans la bibliothèque de l'utilisateur. */
export type LibraryBadge = 'watched' | 'watching' | 'planned' | 'stopped';

// Badge texte en pastille (coin haut-gauche), conforme à la maquette :
// SUIVI (jaune) · VU (vert) · À VOIR (sombre) · ARRÊTÉ (rouge).
const BADGE_STYLE: Record<
  LibraryBadge,
  { label: string; bg: string; fg: string }
> = {
  watching: { label: 'SUIVI', bg: 'rgba(255,212,73,0.92)', fg: '#1A1A05' },
  watched: { label: 'VU', bg: 'rgba(76,195,138,0.92)', fg: '#04140C' },
  planned: { label: 'À VOIR', bg: 'rgba(13,19,33,0.82)', fg: '#F5F7FA' },
  stopped: { label: 'ARRÊTÉ', bg: 'rgba(229,72,77,0.92)', fg: '#FFFFFF' },
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
            className="absolute top-1.5 left-1.5 rounded-md"
            style={{
              backgroundColor: badgeStyle.bg,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: badgeStyle.fg,
                fontSize: 9,
                fontWeight: '800',
                letterSpacing: 0.3,
              }}
            >
              {badgeStyle.label}
            </Text>
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
