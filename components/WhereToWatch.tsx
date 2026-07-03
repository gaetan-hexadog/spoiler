import React from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import {
  imageUrl,
  type TmdbCountryProviders,
  type TmdbProvider,
} from '@/lib/tmdb';

// Liens directs vers les principaux services (le fallback est la page JustWatch).
const PROVIDER_URLS: Record<number, string> = {
  8: 'https://www.netflix.com',
  9: 'https://www.primevideo.com',
  119: 'https://www.primevideo.com',
  337: 'https://www.disneyplus.com/fr-fr',
  350: 'https://tv.apple.com/fr',
  2: 'https://tv.apple.com/fr',
  381: 'https://www.canalplus.com',
  345: 'https://www.canalplus.com',
  531: 'https://www.paramountplus.com/fr',
  1899: 'https://www.max.com/fr',
  56: 'https://animationdigitalnetwork.com',
  283: 'https://www.crunchyroll.com/fr',
  61: 'https://www.ocs.fr',
  236: 'https://www.france.tv',
  59: 'https://www.arte.tv',
  1870: 'https://www.tf1plus.fr',
  147: 'https://www.6play.fr',
};

/** Plateformes disponibles en France (données TMDB / JustWatch). */
export function WhereToWatch({
  providers,
}: {
  providers: TmdbCountryProviders | undefined;
}) {
  if (!providers) return null;

  const streaming = providers.flatrate ?? [];
  const rentBuy: TmdbProvider[] = [];
  const seen = new Set(streaming.map((p) => p.provider_id));
  for (const provider of [...(providers.rent ?? []), ...(providers.buy ?? [])]) {
    if (!seen.has(provider.provider_id)) {
      seen.add(provider.provider_id);
      rentBuy.push(provider);
    }
  }
  if (!streaming.length && !rentBuy.length) return null;

  const openProvider = (provider: TmdbProvider) =>
    Linking.openURL(PROVIDER_URLS[provider.provider_id] ?? providers.link);

  const logoRow = (list: TmdbProvider[], label: string) =>
    list.length ? (
      <View className="gap-1.5">
        <Text className="text-muted text-xs">{label}</Text>
        <View className="flex-row flex-wrap gap-2">
          {list.slice(0, 8).map((provider) => (
            <Pressable
              key={provider.provider_id}
              onPress={() => openProvider(provider)}
              style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
            >
              <Image
                source={{ uri: imageUrl(provider.logo_path, 'w92') }}
                className="w-11 h-11 rounded-xl bg-surface"
              />
            </Pressable>
          ))}
        </View>
      </View>
    ) : null;

  return (
    <View className="px-4 gap-2.5">
      <Text className="text-fg text-lg font-bold">Où regarder</Text>
      {logoRow(streaming, 'Streaming')}
      {logoRow(rentBuy, 'Location / Achat')}
      <Pressable onPress={() => Linking.openURL(providers.link)} hitSlop={6}>
        <Text className="text-muted text-[11px]">
          Source JustWatch · voir toutes les offres →
        </Text>
      </Pressable>
    </View>
  );
}
