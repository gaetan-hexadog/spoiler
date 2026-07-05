import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { FloatingButton } from '@/components/FloatingHeader';
import { Input } from '@/components/ui';
import {
  useAddToList,
  useAllListItems,
  useCreateList,
  useLists,
  useRemoveFromList,
} from '@/hooks/queries';
import { usePro } from '@/hooks/usePro';
import type { ListMediaType } from '@/lib/db';
import { colors } from '@/lib/theme';

/**
 * Bouton « albums » du header des fiches (série + film) + bottom-sheet
 * « Ajouter à une liste » : coche/décoche l'œuvre dans chaque liste, création
 * de liste inline. Fonctionnalité Pro : non abonné → paywall.
 */
export function AddToListButton({
  mediaType,
  tmdbId,
  title,
  posterPath,
}: {
  mediaType: ListMediaType;
  tmdbId: number;
  title: string;
  posterPath: string | null;
}) {
  const router = useRouter();
  const { isPro } = usePro();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const lists = useLists();
  const items = useAllListItems();
  const addToList = useAddToList();
  const removeFromList = useRemoveFromList();
  const createList = useCreateList();

  const inList = (listId: number) =>
    (items.data ?? []).some(
      (row) =>
        row.list_id === listId &&
        row.media_type === mediaType &&
        row.tmdb_id === tmdbId
    );

  const toggle = (listId: number) => {
    if (inList(listId)) {
      removeFromList.mutate({ listId, mediaType, tmdbId });
    } else {
      addToList.mutate({
        list_id: listId,
        media_type: mediaType,
        tmdb_id: tmdbId,
        title,
        poster_path: posterPath,
      });
    }
  };

  const submitCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createList.mutate(
      { name, emoji: null },
      {
        onSuccess: () => {
          setNewName('');
          setCreating(false);
        },
      }
    );
  };

  const membershipCount = (lists.data ?? []).filter((l) => inList(l.id)).length;

  return (
    <>
      <FloatingButton
        icon={membershipCount > 0 ? 'albums' : 'albums-outline'}
        active={membershipCount > 0}
        onPress={() => (isPro ? setOpen(true) : router.push('/pro'))}
      />
      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text className="text-fg text-lg font-bold mb-1">
          Ajouter à une liste
        </Text>
        <Text className="text-muted text-[12px] mb-3" numberOfLines={1}>
          {title}
        </Text>

        {(lists.data ?? []).map((list) => {
          const checked = inList(list.id);
          return (
            <Pressable
              key={list.id}
              onPress={() => toggle(list.id)}
              className="flex-row items-center justify-between py-3 border-b border-line/50"
            >
              <Text
                className={`text-[15px] ${
                  checked ? 'text-accent font-bold' : 'text-fg font-medium'
                }`}
              >
                {list.emoji ? `${list.emoji} ` : ''}
                {list.name}
              </Text>
              <Ionicons
                name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={checked ? colors.accent : colors.textMuted}
              />
            </Pressable>
          );
        })}

        {creating ? (
          <View className="flex-row items-center gap-2 mt-3">
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
              <Text className="text-accent-fg font-extrabold text-[13px]">
                OK
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setCreating(true)}
            className="flex-row items-center gap-2 py-3.5"
          >
            <Ionicons name="add-circle" size={22} color={colors.accent} />
            <Text className="text-accent text-[15px] font-bold">
              Nouvelle liste
            </Text>
          </Pressable>
        )}
      </BottomSheet>
    </>
  );
}
