import React from 'react';
import { Image, Text, View } from 'react-native';
import { WatchCheck } from '@/components/WatchCheck';
import { useMarkEpisode } from '@/hooks/queries';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { imageUrl } from '@/lib/tmdb';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 1b — Bannière « À voir maintenant » de la fiche série.
 * LE changement clé : une fois la série suivie, l'action principale
 * (regarder le prochain épisode) est remontée juste sous le titre,
 * au lieu d'être cachée dans l'onglet Épisodes.
 *
 * À insérer dans app/show/[id]/index.tsx, après le bloc titre/poster et
 * avant le sélecteur d'onglets, uniquement si `trackedShow && next && !upToDate`.
 */
export function NextEpisodeBanner({
  showId,
  next,
  stillPath,
  episodeName,
  runtime,
  seen,
  total,
}: {
  showId: number;
  next: { season: number; episode: number };
  stillPath: string | null;
  episodeName?: string;
  runtime?: number | null;
  seen: number;
  total: number;
}) {
  const markEpisode = useMarkEpisode();
  const wide = useBreakpoint() !== 'mobile';
  const uri = imageUrl(stillPath, 'w342');
  const pct = total > 0 ? Math.round((seen / total) * 100) : 0;

  return (
    <View
      className={`${wide ? 'self-start w-full max-w-[560px]' : 'mx-4'} bg-surface border border-line rounded-2xl p-3`}
    >
      <View className="flex-row items-center gap-3">
        <View className="w-[84px] aspect-video rounded-lg bg-surface-light overflow-hidden">
          {uri ? <Image source={{ uri }} className="w-full h-full" /> : null}
        </View>
        <View className="flex-1">
          <Text className="text-accent text-[10.5px] font-extrabold tracking-wide">
            À VOIR MAINTENANT
          </Text>
          <Text
            className="text-fg text-[13.5px] font-extrabold mt-0.5"
            numberOfLines={1}
          >
            S{pad(next.season)}E{pad(next.episode)}
            {episodeName ? ` · ${episodeName}` : ''}
          </Text>
          {runtime ? (
            <Text className="text-muted text-[11px]">{runtime} min</Text>
          ) : null}
        </View>
        <WatchCheck
          watched={false}
          size="lg"
          pending={markEpisode.isPending}
          onToggle={() =>
            markEpisode.mutate({
              showId,
              season: next.season,
              episode: next.episode,
              watched: true,
            })
          }
        />
      </View>

      {/* <View className="flex-row items-center gap-2 mt-3">
        <View className="flex-1 h-1.5 rounded-full bg-surface-light overflow-hidden">
          <View
            className="h-full bg-accent rounded-full"
            style={{ width: `${pct}%` }}
          />
        </View>
        <Text className="text-muted text-[11px] font-bold">
          {seen}/{total} · {pct}%
        </Text>
      </View> */}
    </View>
  );
}
