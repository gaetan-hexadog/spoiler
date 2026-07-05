import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

const EPISODE_MINUTES = 42;
const MOVIE_MINUTES = 110;

export interface HistoryStatItem {
  kind: 'episode' | 'movie';
  watchedAt: string;
}

function fmt(mins: number) {
  const days = Math.floor(mins / 1440);
  const h = Math.round((mins % 1440) / 60);
  return days > 0 ? `${days} j ${h} h` : `${h} h`;
}

/**
 * 2b — En-tête chiffré de l'historique.
 * `variant="card"` (mobile) : une carte « cette semaine · N ép · ≈ X h ».
 * `variant="strip"` (desktop) : 3 cartes semaine / mois / total.
 * Mêmes constantes de durée que le profil (42 min/ép, 1 h 50/film).
 */
export function HistoryStats({
  items,
  variant,
}: {
  items: HistoryStatItem[];
  variant: 'card' | 'strip';
}) {
  const { week, month, totalMins, weekMins } = useMemo(() => {
    const now = new Date();
    const startWeek = new Date(now);
    startWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startWeek.setHours(0, 0, 0, 0);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let week = 0;
    let month = 0;
    let totalMins = 0;
    let weekMins = 0;
    for (const it of items) {
      const d = new Date(it.watchedAt);
      const m = it.kind === 'movie' ? MOVIE_MINUTES : EPISODE_MINUTES;
      totalMins += m;
      if (d >= startMonth) month += 1;
      if (d >= startWeek) {
        week += 1;
        weekMins += m;
      }
    }
    return { week, month, totalMins, weekMins };
  }, [items]);

  if (variant === 'card') {
    return (
      <View className="mx-4 bg-surface-light rounded-3xl p-4 flex-row items-center justify-between">
        <View>
          <Text className="text-muted text-[11px] font-bold tracking-wide">
            CETTE SEMAINE
          </Text>
          <View className="flex-row items-baseline gap-1.5 mt-1">
            <Text className="text-accent text-[30px] font-extrabold">{week}</Text>
            <Text className="text-fg text-[13px] font-bold">épisodes</Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-fg text-[20px] font-extrabold">≈ {fmt(weekMins)}</Text>
          <Text className="text-muted text-[11px]">devant l'écran</Text>
        </View>
      </View>
    );
  }

  const Card = ({
    label,
    value,
    unit,
    accent,
  }: {
    label: string;
    value: string | number;
    unit: string;
    accent?: boolean;
  }) => (
    <View className="flex-1 bg-surface rounded-2xl p-4">
      <Text className="text-muted text-[11px] font-bold tracking-wide">{label}</Text>
      <Text className={`text-[26px] font-extrabold mt-1 ${accent ? 'text-accent' : 'text-fg'}`}>
        {value} <Text className="text-muted text-[13px] font-bold">{unit}</Text>
      </Text>
    </View>
  );

  return (
    <View className="flex-row gap-3.5">
      <Card label="CETTE SEMAINE" value={week} unit="ép." accent />
      <Card label="CE MOIS" value={month} unit="ép." />
      <Card label="TEMPS TOTAL" value={fmt(totalMins)} unit="" />
    </View>
  );
}
