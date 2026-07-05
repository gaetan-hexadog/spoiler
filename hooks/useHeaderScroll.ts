import { useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * Pilote le fond flou du FloatingHeader de façon fiable (web + natif).
 * Un simple booléen `scrolled` (passé au FloatingHeader) bascule quand on
 * dépasse un petit seuil ; l'opacité est ensuite animée côté FloatingHeader
 * via reanimated. `scrollProps` se pose sur une ScrollView / FlatList normale.
 *
 *   const { scrolled, scrollProps } = useHeaderScroll();
 *   <FloatingHeader scrolled={scrolled} … />
 *   <ScrollView {...scrollProps}>…</ScrollView>
 */
export function useHeaderScroll(threshold = 40) {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // setState avec la même valeur = no-op (pas de re-render superflu).
    setScrolled(event.nativeEvent.contentOffset.y > threshold);
  };
  return { scrolled, scrollProps: { onScroll, scrollEventThrottle: 16 } };
}
