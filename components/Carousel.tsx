import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { colors } from '@/lib/theme';

export function Carousel<T>({
  title,
  data,
  loadingMore,
  onEndReached,
  onSeeAll,
  render,
}: {
  title: string;
  data: T[];
  loadingMore?: boolean;
  onEndReached?: () => void;
  onSeeAll?: () => void;
  render: (item: T) => React.ReactElement;
}) {
  if (!data.length) return null;
  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between px-4">
        <Text className="text-fg text-lg font-bold">{title}</Text>
        {onSeeAll ? (
          <Pressable
            onPress={onSeeAll}
            className="flex-row items-center gap-0.5"
            hitSlop={8}
          >
            <Text className="text-accent text-[13px] font-semibold">
              Tout voir
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        onEndReached={onEndReached}
        onEndReachedThreshold={2}
        ListFooterComponent={
          loadingMore ? (
            <View className="w-16 items-center justify-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null
        }
        renderItem={({ item }) => render(item)}
      />
    </View>
  );
}
