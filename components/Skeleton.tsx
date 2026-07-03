import React, { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import { colors } from '@/lib/theme';

/** Bloc fantôme pulsant — remplace les spinners plein écran. */
export function Skeleton({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { backgroundColor: colors.surfaceLight, borderRadius: 10, opacity },
        style,
      ]}
    />
  );
}

/** Grille d'affiches fantômes (3 colonnes). */
export function PosterGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <View className="flex-row flex-wrap px-2 pt-2">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: '33.333%', padding: 6 }}>
          <Skeleton style={{ aspectRatio: 2 / 3, borderRadius: 12 }} />
          <Skeleton
            style={{ height: 10, marginTop: 8, width: '80%', borderRadius: 5 }}
          />
        </View>
      ))}
    </View>
  );
}

/** Lignes fantômes (listes). */
export function RowListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View className="px-4 pt-2 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="flex-row items-center gap-3">
          <Skeleton style={{ width: 56, aspectRatio: 2 / 3, borderRadius: 8 }} />
          <View className="flex-1 gap-2">
            <Skeleton style={{ height: 14, width: '60%', borderRadius: 7 }} />
            <Skeleton style={{ height: 10, width: '40%', borderRadius: 5 }} />
            <Skeleton style={{ height: 6, width: '100%', borderRadius: 3 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Fiche fantôme (détail série/film). */
export function DetailSkeleton() {
  return (
    <View>
      <Skeleton style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 0 }} />
      <View className="flex-row px-4 -mt-12 gap-3 items-end">
        <Skeleton style={{ width: 96, aspectRatio: 2 / 3, borderRadius: 12 }} />
        <View className="flex-1 gap-2 pb-2">
          <Skeleton style={{ height: 22, width: '75%', borderRadius: 8 }} />
          <Skeleton style={{ height: 12, width: '50%', borderRadius: 6 }} />
        </View>
      </View>
      <View className="p-4 gap-2.5">
        <Skeleton style={{ height: 12, width: '100%', borderRadius: 6 }} />
        <Skeleton style={{ height: 12, width: '95%', borderRadius: 6 }} />
        <Skeleton style={{ height: 12, width: '70%', borderRadius: 6 }} />
      </View>
    </View>
  );
}
