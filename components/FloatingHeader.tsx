import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

/** Bouton rond translucide qui flotte au-dessus du backdrop. */
export function FloatingButton({
  icon,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      className={`w-10 h-10 rounded-full items-center justify-center border ${
        active ? 'bg-accent border-accent' : 'bg-bg/60 border-fg/25'
      }`}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
    >
      <Ionicons
        name={icon}
        size={20}
        color={active ? colors.accentText : colors.text}
      />
    </Pressable>
  );
}

/**
 * Header flottant des fiches : retour à gauche, actions à droite.
 * Fixe et transparent sur le hero ; si un `scrollY` est fourni, une barre
 * translucide (floutée sur le web) apparaît en fondu quand on scrolle.
 */
export function FloatingHeader({
  right,
  scrollY,
}: {
  right?: React.ReactNode;
  scrollY?: Animated.Value;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const barOpacity = scrollY
    ? scrollY.interpolate({
        inputRange: [0, 90, 170],
        outputRange: [0, 0, 1],
        extrapolate: 'clamp',
      })
    : undefined;

  return (
    <>
      {scrollY ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + 52,
            backgroundColor: 'rgba(13,19,33,0.72)',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            opacity: barOpacity,
            // Web : vrai flou derrière la barre (no-op natif sans expo-blur).
            ...({ backdropFilter: 'blur(14px)' } as object),
          }}
        />
      ) : null}
      <View
        className="absolute left-0 right-0 z-10 flex-row justify-between px-3"
        style={{ top: insets.top + 4 }}
      >
        <FloatingButton
          icon="arrow-back"
          onPress={() => {
            // Web : après un accès direct / refresh, il n'y a pas d'historique.
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        />
        <View className="flex-row gap-2">{right}</View>
      </View>
    </>
  );
}
