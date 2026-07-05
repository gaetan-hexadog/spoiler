import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import type { WatchedEpisode } from '@/lib/db';
import { colors } from '@/lib/theme';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 1b — Heatmap d'activité de l'année en cours (une case = une semaine).
 * Intensité proportionnelle au nombre d'épisodes vus dans la semaine.
 * À placer dans profile.tsx sous le chiffre héros « Devant l'écran ».
 */
export function ActivityHeatmap({
  allWatched,
  year: yearProp,
}: {
  allWatched: WatchedEpisode[];
  /** Année affichée (défaut : année en cours) — utilisé par le bilan /stats. */
  year?: number;
}) {
  const year = yearProp ?? new Date().getFullYear();

  const { counts, total, currentWeek } = useMemo(() => {
    const start = new Date(year, 0, 1).getTime();
    const weeks = new Array(53).fill(0);
    let total = 0;
    for (const episode of allWatched) {
      const d = new Date(episode.watched_at);
      if (d.getFullYear() !== year) continue;
      const week = Math.floor((d.getTime() - start) / WEEK_MS);
      if (week >= 0 && week < 53) {
        weeks[week] += 1;
        total += 1;
      }
    }
    const currentWeek = Math.floor((Date.now() - start) / WEEK_MS);
    return { counts: weeks, total, currentWeek };
  }, [allWatched, year]);

  const max = Math.max(1, ...counts);
  const color = (n: number) => {
    if (n === 0) return colors.surface;
    const t = n / max;
    if (t < 0.34) return '#3a4a1a';
    if (t < 0.67) return '#6b6b1a';
    return colors.accent;
  };

  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-fg text-lg font-bold">Activité {year}</Text>
        <Text className="text-muted text-xs">{total} épisodes</Text>
      </View>
      <View className="flex-row flex-wrap gap-1">
        {counts
          .slice(
            0,
            // Année passée : les 53 semaines ; année en cours : jusqu'à
            // aujourd'hui seulement.
            year < new Date().getFullYear() ? 53 : currentWeek + 1
          )
          .map((n, i) => (
          <View
            key={i}
            style={{
              width: 13,
              height: 13,
              borderRadius: 3,
              backgroundColor: color(n),
            }}
          />
        ))}
      </View>
    </View>
  );
}
