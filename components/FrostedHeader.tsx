import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

/**
 * Barre de titre flottante et translucide des onglets (Séries, Films, Calendrier,
 * Découvrir, Profil, Paramètres). Le contenu de la page défile DESSOUS :
 *  - web / iOS : vrai verre dépoli (BlurView automatique)
 *  - Android : teinte translucide (pas de flou vif sur une liste qui défile,
 *    volontairement — meilleures perfs qu'un blur recalculé à chaque frame)
 *
 * Usage : la poser en frère AVANT le scroller (elle est en position absolue),
 * puis rembourrer le scroller de `onHeight` px en haut pour que le contenu
 * démarre sous la barre. La hauteur inclut l'encoche (safe-area top).
 */
export function FrostedHeader({
  children,
  onHeight,
}: {
  children?: React.ReactNode;
  onHeight?: (height: number) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      onLayout={(e: LayoutChangeEvent) =>
        onHeight?.(e.nativeEvent.layout.height)
      }
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
    >
      <BlurView
        intensity={64}
        tint="dark"
        blurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: 'rgba(13,19,33,0.6)',
          borderBottomWidth: children ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: colors.border,
        }}
      >
        {children}
      </View>
    </View>
  );
}
