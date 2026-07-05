import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useActionSheet } from '@/components/ActionSheet';
import { PosterCard } from '@/components/PosterCard';
import { EmptyState, Screen } from '@/components/ui';
import {
  useAllListItems,
  useDeleteList,
  useLists,
  useRemoveFromList,
} from '@/hooks/queries';
import { useGridColumns } from '@/hooks/useGridColumns';
import type { ListItem } from '@/lib/db';
import { colors } from '@/lib/theme';

/** Détail d'une liste personnalisée : grille d'affiches, retrait au long-press. */
export default function ListDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const listId = Number(params.id);
  const router = useRouter();
  const columns = useGridColumns();
  const { show: openSheet, sheet } = useActionSheet();

  const lists = useLists();
  const items = useAllListItems();
  const removeFromList = useRemoveFromList();
  const deleteList = useDeleteList();

  const list = (lists.data ?? []).find((entry) => entry.id === listId);
  const listItems = (items.data ?? []).filter(
    (item) => item.list_id === listId
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/lists');
  };

  const openItemActions = (item: ListItem) =>
    openSheet({
      title: item.title,
      actions: [
        {
          label: 'Retirer de la liste',
          variant: 'danger',
          onPress: () =>
            removeFromList.mutate({
              listId,
              mediaType: item.media_type,
              tmdbId: item.tmdb_id,
            }),
        },
      ],
    });

  const openListActions = () =>
    openSheet({
      title: list?.name ?? 'Liste',
      actions: [
        {
          label: 'Supprimer la liste',
          variant: 'danger',
          onPress: () => {
            deleteList.mutate(listId, { onSuccess: goBack });
          },
        },
      ],
    });

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {sheet}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center gap-3 flex-1">
          <Pressable onPress={goBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text
            className="text-fg text-2xl font-extrabold flex-1"
            numberOfLines={1}
          >
            {list ? `${list.emoji ? `${list.emoji} ` : ''}${list.name}` : 'Liste'}
          </Text>
        </View>
        <Pressable onPress={openListActions} hitSlop={8}>
          <Ionicons
            name="ellipsis-horizontal"
            size={22}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

      {listItems.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title="Liste vide"
          subtitle="Ajoute des séries et films depuis leurs fiches (bouton listes en haut à droite)."
        />
      ) : (
        <FlatList
          key={`list-${columns}`}
          data={listItems}
          numColumns={columns}
          keyExtractor={(item) => `${item.media_type}-${item.tmdb_id}`}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <PosterCard
              title={item.title}
              posterPath={item.poster_path}
              subtitle={item.media_type === 'show' ? 'Série' : 'Film'}
              columns={columns}
              onPress={() =>
                router.push(
                  item.media_type === 'show'
                    ? `/show/${item.tmdb_id}`
                    : `/movie/${item.tmdb_id}`
                )
              }
              onLongPress={() => openItemActions(item)}
            />
          )}
        />
      )}
    </Screen>
  );
}
