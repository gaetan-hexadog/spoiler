import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState, Input, Screen } from '@/components/ui';
import { useAllListItems, useCreateList, useLists } from '@/hooks/queries';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { usePro } from '@/hooks/usePro';
import { imageUrl } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

/**
 * Mes listes (Pro) : index des listes personnalisées. Chaque carte montre un
 * mini-collage des dernières affiches + le compteur d'éléments.
 * Non-Pro : teaser + CTA vers le paywall.
 */
export default function ListsScreen() {
  const router = useRouter();
  const { isPro } = usePro();
  const bp = useBreakpoint();
  const listColumns = bp === 'desktop' ? 3 : bp === 'tablet' ? 2 : 1;
  const lists = useLists();
  const items = useAllListItems();
  const createList = useCreateList();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const byList = useMemo(() => {
    const map = new Map<number, typeof items.data>();
    for (const item of items.data ?? []) {
      const arr = map.get(item.list_id) ?? [];
      arr.push(item);
      map.set(item.list_id, arr);
    }
    return map;
  }, [items.data]);

  const submitCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createList.mutate(
      { name, emoji: null },
      {
        onSuccess: () => {
          setNewName('');
          setCreateOpen(false);
        },
      }
    );
  };

  const header = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <View className="flex-row items-center gap-3">
        <Pressable onPress={goBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text className="text-fg text-2xl font-extrabold">Mes listes</Text>
      </View>
      {isPro ? (
        <Pressable
          onPress={() => setCreateOpen(true)}
          hitSlop={8}
          className="w-10 h-10 rounded-full bg-accent items-center justify-center"
          style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
        >
          <Ionicons name="add" size={24} color={colors.accentText} />
        </Pressable>
      ) : null}
    </View>
  );

  if (!isPro) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <EmptyState
          icon="albums-outline"
          title="Listes personnalisées"
          subtitle="Crée tes collections — à binge-watcher, coups de cœur, soirées d'hiver… C'est une fonctionnalité Pro."
          action={{ label: 'Découvrir Pro', onPress: () => router.push('/pro') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      {(lists.data ?? []).length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title="Aucune liste"
          subtitle="Crée ta première liste, puis ajoute des séries et films depuis leurs fiches."
          action={{ label: 'Nouvelle liste', onPress: () => setCreateOpen(true) }}
        />
      ) : (
        <FlatList
          key={`lists-${listColumns}`}
          data={lists.data ?? []}
          numColumns={listColumns}
          columnWrapperStyle={listColumns > 1 ? { gap: 12 } : undefined}
          keyExtractor={(list) => String(list.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item: list }) => {
            const listItems = byList.get(list.id) ?? [];
            const posters = listItems.slice(0, 4);
            return (
              <Pressable
                onPress={() => router.push(`/list/${list.id}`)}
                className="bg-surface rounded-2xl p-3.5 flex-row items-center gap-3.5"
                style={({ pressed }) => [
                  { flex: 1 / listColumns },
                  pressed ? { opacity: 0.85 } : undefined,
                ]}
              >
                {/* Mini-collage des dernières affiches */}
                <View className="flex-row">
                  {posters.length ? (
                    posters.map((entry, index) => {
                      const uri = imageUrl(entry.poster_path, 'w92');
                      return (
                        <View
                          key={entry.id}
                          style={{ marginLeft: index === 0 ? 0 : -14 }}
                          className="w-9 aspect-[2/3] rounded-md overflow-hidden border border-line bg-surface-light"
                        >
                          {uri ? (
                            <Image source={{ uri }} className="w-full h-full" />
                          ) : null}
                        </View>
                      );
                    })
                  ) : (
                    <View className="w-9 aspect-[2/3] rounded-md bg-surface-light items-center justify-center">
                      <Ionicons
                        name="albums-outline"
                        size={16}
                        color={colors.textMuted}
                      />
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-fg text-[15px] font-bold" numberOfLines={1}>
                    {list.emoji ? `${list.emoji} ` : ''}
                    {list.name}
                  </Text>
                  <Text className="text-muted text-[12px] mt-0.5">
                    {listItems.length} élément{listItems.length > 1 ? 's' : ''}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            );
          }}
        />
      )}

      <BottomSheet visible={createOpen} onClose={() => setCreateOpen(false)}>
        <Text className="text-fg text-lg font-bold mb-3">Nouvelle liste</Text>
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Input
              placeholder="Nom de la liste"
              value={newName}
              onChangeText={setNewName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitCreate}
            />
          </View>
          <Pressable
            onPress={submitCreate}
            disabled={!newName.trim() || createList.isPending}
            className="bg-accent rounded-xl px-4 py-3"
            style={
              !newName.trim() || createList.isPending
                ? { opacity: 0.5 }
                : undefined
            }
          >
            <Text className="text-accent-fg font-extrabold text-[13px]">OK</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </Screen>
  );
}
