import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingHeader } from '@/components/FloatingHeader';
import { PosterCard } from '@/components/PosterCard';
import { Loading, Screen } from '@/components/ui';
import { usePersonDetails } from '@/hooks/queries';
import { useGridColumns } from '@/hooks/useGridColumns';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useLibraryBadges } from '@/hooks/useLibraryBadges';
import { imageUrl, type TmdbPersonCredit } from '@/lib/tmdb';

function age(birthday: string, deathday: string | null): number {
  const end = deathday ? new Date(deathday) : new Date();
  const birth = new Date(birthday);
  let years = end.getFullYear() - birth.getFullYear();
  if (
    end.getMonth() < birth.getMonth() ||
    (end.getMonth() === birth.getMonth() && end.getDate() < birth.getDate())
  ) {
    years--;
  }
  return years;
}

export default function PersonScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const personId = Number(params.id);
  const router = useRouter();
  const person = usePersonDetails(personId);
  const columns = useGridColumns();
  const insets = useSafeAreaInsets();
  const { scrolled, scrollProps } = useHeaderScroll();
  const { showBadge, movieBadge } = useLibraryBadges();
  const [bioExpanded, setBioExpanded] = useState(false);

  // Filmographie : dédupliquée, triée par date de sortie décroissante.
  const credits = useMemo(() => {
    const seen = new Set<string>();
    return (person.data?.combined_credits?.cast ?? [])
      .filter((credit) => {
        const key = `${credit.media_type}-${credit.id}`;
        if (seen.has(key) || !credit.poster_path) return false;
        seen.add(key);
        return credit.vote_count > 10;
      })
      .sort((a, b) =>
        (b.release_date ?? b.first_air_date ?? '').localeCompare(
          a.release_date ?? a.first_air_date ?? ''
        )
      )
      .slice(0, 60);
  }, [person.data]);

  if (person.isLoading) return <Loading />;
  if (!person.data) {
    return (
      <Screen>
        <Text className="text-muted p-4 text-center">Fiche introuvable.</Text>
      </Screen>
    );
  }

  const data = person.data;
  const photo = imageUrl(data.profile_path, 'w342');

  const openCredit = (credit: TmdbPersonCredit) =>
    router.push(
      credit.media_type === 'tv' ? `/show/${credit.id}` : `/movie/${credit.id}`
    );

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <FloatingHeader scrolled={scrolled} title={data.name} />
      <FlatList
        {...scrollProps}
        key={`credits-${columns}`}
        data={credits}
        numColumns={columns}
        keyExtractor={(item) => `${item.media_type}-${item.id}`}
        contentContainerStyle={{
          paddingHorizontal: 8,
          paddingTop: insets.top + 52,
          paddingBottom: 32,
        }}
        ListHeaderComponent={
          <View className="gap-4 px-2 pt-3 pb-4">
            <View className="flex-row gap-4 items-center">
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  className="w-28 h-36 rounded-2xl bg-surface"
                />
              ) : (
                <View className="w-28 h-36 rounded-2xl bg-surface items-center justify-center">
                  <Text className="text-muted text-3xl">🎭</Text>
                </View>
              )}
              <View className="flex-1 gap-1">
                <Text className="text-fg text-xl font-extrabold">
                  {data.name}
                </Text>
                {data.birthday ? (
                  <Text className="text-muted text-[13px]">
                    {age(data.birthday, data.deathday)} ans
                    {data.deathday ? ' (décédé·e)' : ''}
                  </Text>
                ) : null}
                {data.place_of_birth ? (
                  <Text className="text-muted text-[13px]" numberOfLines={2}>
                    {data.place_of_birth}
                  </Text>
                ) : null}
              </View>
            </View>

            {data.biography ? (
              <Pressable onPress={() => setBioExpanded(!bioExpanded)}>
                <Text
                  className="text-fg text-[13px] leading-5 opacity-85"
                  numberOfLines={bioExpanded ? undefined : 5}
                >
                  {data.biography}
                </Text>
                <Text className="text-accent text-xs font-semibold mt-1">
                  {bioExpanded ? 'Réduire' : 'Lire la suite'}
                </Text>
              </Pressable>
            ) : null}

            {credits.length ? (
              <Text className="text-fg text-lg font-bold pt-1">
                Filmographie
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PosterCard
            columns={columns}
            title={item.title ?? item.name ?? ''}
            posterPath={item.poster_path}
            subtitle={
              item.character ||
              (item.release_date ?? item.first_air_date)?.slice(0, 4)
            }
            badge={
              item.media_type === 'tv'
                ? showBadge(item.id)
                : movieBadge(item.id)
            }
            onPress={() => openCredit(item)}
          />
        )}
      />
    </Screen>
  );
}
