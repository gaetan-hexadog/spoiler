import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
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

/** Header flottant des fiches : retour à gauche, actions à droite. */
export function FloatingHeader({ right }: { right?: React.ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
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
  );
}
