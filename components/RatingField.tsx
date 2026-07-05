import React from 'react';
import { View } from 'react-native';
import { RatingStars } from '@/components/RatingStars';

/**
 * Bloc « Ma note » partagé (même style sur fiche série et film).
 */
export function RatingField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
}) {
  return (
    <View className="bg-surface rounded-2xl p-3">
      <RatingStars value={value} onChange={onChange} />
    </View>
  );
}
