import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { colors } from '@/lib/theme';

/**
 * Bouton d'action/état partagé par les barres d'actions des fiches série et
 * film (même style partout). Actif = fond accent.
 */
export function ActionToggle({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-2xl py-3 items-center gap-1 ${
        active ? 'bg-accent' : 'bg-surface'
      }`}
      style={({ pressed }) => (pressed ? { opacity: 0.75 } : undefined)}
    >
      <Ionicons
        name={icon}
        size={22}
        color={active ? colors.accentText : colors.text}
      />
      <Text
        className={`text-[11.5px] font-extrabold ${
          active ? 'text-accent-fg' : 'text-fg'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
