import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';

/**
 * Bottom-sheet animée : fondu du backdrop + glissement du panneau,
 * à l'ouverture comme à la fermeture. `onDismissed` est appelé une fois
 * l'animation de sortie terminée (pour démonter le contenu).
 */
export function BottomSheet({
  visible,
  onClose,
  onDismissed,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
          onDismissed?.();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mounted]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(13, 19, 33, 0.72)',
          opacity: progress,
        }}
      >
        <Pressable className="flex-1 justify-end" onPress={onClose}>
          <Animated.View
            style={{
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [420, 0],
                  }),
                },
              ],
            }}
          >
            <Pressable
              className="bg-surface rounded-t-3xl px-5 pt-3 pb-9 gap-2 w-full max-w-[480px] self-center"
              onPress={(event) => event.stopPropagation()}
            >
              {/* Poignée : signale que la sheet se ferme d'un tap sur le fond. */}
              <View className="self-center w-10 h-1 rounded-full bg-surface-light mb-2" />
              {children}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
