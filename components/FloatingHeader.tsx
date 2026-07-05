import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
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
 * Fixe et transparent sur le hero ; quand `scrolled` passe à true, une barre
 * floutée (BlurView, web + natif) + le titre apparaissent en fondu.
 */
export function FloatingHeader({
  right,
  scrolled,
  title,
}: {
  right?: React.ReactNode;
  scrolled?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hasScroll = scrolled !== undefined;
  const fade = useAnimatedStyle(() => ({
    opacity: withTiming(scrolled ? 1 : 0, { duration: 200 }),
  }));

  return (
    <>
      {hasScroll ? (
        <Reanimated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: insets.top + 52,
              // La barre doit passer AU-DESSUS du contenu du ScrollView (qui est
              // un frère rendu après le header) sinon le contenu la recouvre sur
              // natif et on ne voit ni fond ni flou. On reste sous les boutons
              // (z-10) et le titre (z-11).
              zIndex: 9,
              // Teinte sombre : donne la couleur du header. On la garde assez
              // dense (le flou lourd par-dessus fait le reste : le contenu
              // derrière est brouillé, donc ça ne « voit pas au travers »).
              backgroundColor: 'rgba(13,19,33,0.78)',
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            },
            fade,
          ]}
        >
          {/* experimentalBlurMethod est INDISPENSABLE pour un vrai flou sur
              Android (sinon expo-blur ne pose qu'une teinte plate). */}
          <BlurView
            intensity={64}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>
      ) : null}
      {title && hasScroll ? (
        <Reanimated.Text
          numberOfLines={1}
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: insets.top + 14,
              left: 64,
              right: 64,
              textAlign: 'center',
              color: colors.text,
              fontSize: 16,
              fontWeight: '800',
              zIndex: 11,
            },
            fade,
          ]}
        >
          {title}
        </Reanimated.Text>
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
