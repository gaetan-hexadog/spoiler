import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

/** Note personnelle sur 5 — re-taper la note actuelle l'efface. */
export function RatingStars({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-muted text-[13px]">
        Ma note{value ? ` : ${value}/5` : ''}
      </Text>
      <View className="flex-row gap-0.5">
        {Array.from({ length: 5 }, (_, i) => i + 1).map((star) => (
          <Pressable
            key={star}
            onPress={() => onChange(star === value ? null : star)}
            hitSlop={4}
          >
            <Ionicons
              name={value && star <= value ? 'star' : 'star-outline'}
              size={24}
              color={value && star <= value ? colors.accent : colors.textMuted}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
