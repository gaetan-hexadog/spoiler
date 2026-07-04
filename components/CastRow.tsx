import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { imageUrl, type TmdbCastMember } from '@/lib/tmdb';

export function CastRow({ cast }: { cast: TmdbCastMember[] }) {
  const router = useRouter();
  if (!cast.length) return null;
  // TMDB peut renvoyer le même acteur plusieurs fois (rôles multiples) :
  // on dédoublonne par id pour éviter les clés dupliquées et les doublons.
  const seen = new Set<number>();
  const uniqueCast = cast.filter((member) =>
    seen.has(member.id) ? false : (seen.add(member.id), true)
  );
  return (
    <View className="gap-2.5">
      <Text className="text-fg text-lg font-bold px-4">Casting</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={uniqueCast.slice(0, 15)}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => {
          const uri = imageUrl(item.profile_path, 'w185');
          return (
            <Pressable
              onPress={() => router.push(`/person/${item.id}`)}
              className="w-24"
              style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  className="w-24 h-32 rounded-xl bg-surface"
                />
              ) : (
                <View className="w-24 h-32 rounded-xl bg-surface items-center justify-center">
                  <Text className="text-muted text-2xl">🎭</Text>
                </View>
              )}
              <Text
                className="text-fg text-xs font-semibold mt-1.5"
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text className="text-muted text-[11px]" numberOfLines={1}>
                {item.character}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
