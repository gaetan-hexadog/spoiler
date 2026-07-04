import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Effet de survol desktop : léger zoom élastique de la carte.
 * Inerte sur mobile (pas d'événements hover).
 */
export function useHoverScale(scaleTo = 1.045) {
  const scale = useRef(new Animated.Value(1)).current;

  const onHoverIn = () =>
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 60,
      bounciness: 5,
    }).start();

  const onHoverOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 60,
      bounciness: 5,
    }).start();

  return { scale, onHoverIn, onHoverOut };
}
