import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Pilote le fond flou du FloatingHeader depuis un seul endroit.
 * Retourne la valeur de scroll (à passer au `FloatingHeader`) et les props à
 * étaler sur une `Animated.ScrollView` / `Animated.FlatList`.
 *
 *   const { scrollY, scrollProps } = useHeaderScroll();
 *   <FloatingHeader scrollY={scrollY} … />
 *   <Animated.ScrollView {...scrollProps}>…</Animated.ScrollView>
 */
export function useHeaderScroll() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );
  return { scrollY, scrollProps: { onScroll, scrollEventThrottle: 16 } };
}
