import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable } from 'react-native';
import { colors } from '@/lib/theme';

const DIM = { sm: 30, md: 36, lg: 44 } as const;
const ICON = { sm: 15, md: 18, lg: 24 } as const;

/**
 * Coche « vu » unifiée, utilisée partout (bannière, calendrier, listes…).
 *  - vu       → rond plein accent avec coche (état accompli)
 *  - non vu   → cercle vide « à cocher » (action, ne se lit pas comme fait)
 * `onToggle` absent → purement indicatif (non cliquable).
 */
export function WatchCheck({
  watched,
  onToggle,
  size = 'md',
  pending,
}: {
  watched: boolean;
  onToggle?: () => void;
  size?: keyof typeof DIM;
  pending?: boolean;
}) {
  const dim = DIM[size];
  const interactive = !!onToggle && !pending;

  if (watched) {
    return (
      <Pressable
        onPress={(event) => {
          event?.stopPropagation?.();
          onToggle?.();
        }}
        disabled={!interactive}
        hitSlop={6}
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
      >
        <Ionicons name="checkmark-circle" size={dim} color={colors.accent} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onToggle}
      disabled={!interactive}
      hitSlop={6}
      className="rounded-full border-2 border-line items-center justify-center"
      style={({ pressed }) => [
        { width: dim, height: dim },
        pressed || pending ? { opacity: 0.6 } : undefined,
      ]}
    >
      <Ionicons name="checkmark" size={ICON[size]} color={colors.textMuted} />
    </Pressable>
  );
}
