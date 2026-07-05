import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { usePro } from '@/hooks/usePro';
import type { TmdbVideo } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

/**
 * Bouton play centré sur le backdrop des fiches série/film : lance la
 * bande-annonce YouTube. Fonctionnalité Pro : sans abonnement, le bouton
 * affiche un badge PRO et mène au paywall (/pro) au lieu de lire la vidéo.
 * Partagé par les deux fiches (même rendu partout).
 */
export function TrailerPlayButton({
  trailer,
  size = 'md',
}: {
  trailer: TmdbVideo | undefined;
  size?: 'md' | 'lg';
}) {
  const router = useRouter();
  const { isPro } = usePro();
  if (!trailer) return null;

  const dim = size === 'lg' ? 'w-16 h-16' : 'w-14 h-14';
  const icon = size === 'lg' ? 30 : 26;

  return (
    <Pressable
      onPress={() =>
        isPro
          ? Linking.openURL(`https://www.youtube.com/watch?v=${trailer.key}`)
          : router.push('/pro')
      }
      className="absolute inset-0 items-center justify-center"
    >
      <View
        className={`${dim} rounded-full bg-bg/70 border border-fg/30 items-center justify-center pl-1`}
      >
        <Ionicons name="play" size={icon} color={colors.text} />
        {!isPro ? (
          <View className="absolute -top-1 -right-2 bg-accent rounded-full px-1.5 py-0.5">
            <Text className="text-accent-fg text-[8px] font-extrabold">PRO</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
