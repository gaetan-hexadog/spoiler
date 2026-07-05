import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Input } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { colors } from '@/lib/theme';

export interface ToolbarOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Barre d'outils partagée des pages Séries / Films : filtres de statut en chips
 * directs (scroll horizontal sur mobile, wrap sur desktop) + recherche + bascule
 * grille/liste + tri (petit menu). Chaque page passe ses propres filtres.
 */
export function LibraryToolbar<F extends string, S extends string>({
  filters,
  activeFilter,
  onSelectFilter,
  sorts,
  sort,
  onSelectSort,
  grid,
  onToggleGrid,
  searchOpen,
  onToggleSearch,
  search,
  onChangeSearch,
  searchPlaceholder,
}: {
  filters: ToolbarOption<F>[];
  activeFilter: F;
  onSelectFilter: (value: F) => void;
  sorts: ToolbarOption<S>[];
  sort: S;
  onSelectSort: (value: S) => void;
  grid: boolean;
  onToggleGrid: () => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  search: string;
  onChangeSearch: (value: string) => void;
  searchPlaceholder: string;
}) {
  const wide = useBreakpoint() !== 'mobile';
  const [sortOpen, setSortOpen] = useState(false);

  const chips = filters.map((filter) => {
    const active = filter.value === activeFilter;
    return (
      <Pressable
        key={filter.value}
        onPress={() => onSelectFilter(filter.value)}
        className={`px-3.5 py-2 rounded-full ${
          active ? 'bg-accent' : 'bg-surface'
        }`}
      >
        <Text
          className={`text-[13px] font-semibold ${
            active ? 'text-accent-fg' : 'text-muted'
          }`}
        >
          {filter.label}
        </Text>
      </Pressable>
    );
  });

  return (
    <View className="px-4 pt-3 pb-3">
      <View className="flex-row items-center gap-2.5">
        {searchOpen ? (
          <View className="flex-1">
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChangeText={onChangeSearch}
              autoFocus
              autoCorrect={false}
            />
          </View>
        ) : wide ? (
          <View className="flex-1 flex-row flex-wrap gap-2">{chips}</View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-1"
            contentContainerStyle={{ gap: 8, alignItems: 'center' }}
          >
            {chips}
          </ScrollView>
        )}

        <View className="flex-row gap-2">
          <IconButton
            icon={searchOpen ? 'close' : 'search'}
            active={searchOpen}
            onPress={onToggleSearch}
          />
          <IconButton icon="swap-vertical" onPress={() => setSortOpen(true)} />
          <IconButton
            icon={grid ? 'list' : 'grid'}
            onPress={onToggleGrid}
          />
        </View>
      </View>

      <BottomSheet visible={sortOpen} onClose={() => setSortOpen(false)}>
        <Text className="text-fg text-lg font-bold mb-2">Trier par</Text>
        {sorts.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              onSelectSort(option.value);
              setSortOpen(false);
            }}
            className="flex-row items-center justify-between py-3 border-b border-line/50"
          >
            <Text
              className={`text-[15px] ${
                sort === option.value
                  ? 'text-accent font-bold'
                  : 'text-fg font-medium'
              }`}
            >
              {option.label}
            </Text>
            {sort === option.value ? (
              <Ionicons name="checkmark" size={20} color={colors.accent} />
            ) : null}
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

function IconButton({
  icon,
  onPress,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      className={`w-9 h-9 rounded-lg items-center justify-center ${
        active ? 'bg-accent' : 'bg-surface'
      }`}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? colors.accentText : colors.text}
      />
    </Pressable>
  );
}
