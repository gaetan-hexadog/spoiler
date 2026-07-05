import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  SectionList,
  Text,
  View,
} from 'react-native';
import { CalendarEpisodeRow } from '@/components/CalendarEpisodeRow';
import { CalendarWeekStrip } from '@/components/CalendarWeekStrip';
import { FrostedHeader } from '@/components/FrostedHeader';
import { RowListSkeleton } from '@/components/Skeleton';
import { EmptyState, Screen } from '@/components/ui';
import { useAllWatchedEpisodes, useTrackedShows } from '@/hooks/queries';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { usePersistedState } from '@/hooks/usePersistedState';
import { usePro } from '@/hooks/usePro';
import { buildEpisodesIcs, exportIcs } from '@/lib/ics';
import { syncEpisodeNotifications } from '@/lib/notifications';
import { episodeKey } from '@/lib/progress';
import {
  getSeasonDetails,
  getShowDetails,
  imageUrl,
  type TmdbSeasonDetails,
  type TmdbShowDetails,
} from '@/lib/tmdb';
import { colors } from '@/lib/theme';

interface CalendarItem {
  showId: number;
  showName: string;
  posterPath: string | null;
  season: number;
  episode: number;
  episodeName: string;
  airDate: string;
  watched: boolean;
}

/** YYYY-MM-DD en date locale (évite le décalage UTC de toISOString). */
function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoToday(): string {
  return toLocalIso(new Date());
}

function relativeLabel(airDate: string): string {
  const today = new Date(`${isoToday()}T00:00:00`);
  const date = new Date(`${airDate}T00:00:00`);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  if (diff > 1 && diff <= 7) return `Dans ${diff} jours`;
  if (diff < -1 && diff >= -7) return `Il y a ${-diff} jours`;
  return '';
}

function dateHeader(airDate: string): string {
  const label = new Date(`${airDate}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const relative = relativeLabel(airDate);
  return relative ? `${label} · ${relative}` : label;
}

/** Lundi de la semaine (décalée de `offset` semaines), au format YYYY-MM-DD. */
function weekStartIso(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow + offset * 7);
  return toLocalIso(d);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalIso(d);
}

const WEEKDAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

export default function CalendarScreen() {
  const router = useRouter();
  const { isPro } = usePro();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(isoToday());
  const [headerH, setHeaderH] = useState(0);
  const isDesktop = useBreakpoint() === 'desktop';
  const listRef = useRef<SectionList<CalendarItem>>(null);

  // Le jour « focusé » suit le scroll : la pastille de la bande hebdo glisse
  // sur le jour dont la section est en haut de liste (dynamise l'écran).
  const onViewable = useRef(
    ({ viewableItems }: { viewableItems: { section?: { iso: string } }[] }) => {
      const iso = viewableItems.find((v) => v.section)?.section?.iso;
      if (iso) setSelectedDay((prev) => (prev === iso ? prev : iso));
    }
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 40 }).current;

  const shows = useTrackedShows();
  const watchedRows = useAllWatchedEpisodes();

  const activeShows = useMemo(
    () =>
      (shows.data ?? []).filter(
        (show) => show.status === 'watching' || show.status === 'planned'
      ),
    [shows.data]
  );

  const detailQueries = useQueries({
    queries: activeShows.map((show) => ({
      queryKey: ['tmdb', 'show', show.tmdb_id],
      queryFn: () => getShowDetails(show.tmdb_id),
      staleTime: 1000 * 60 * 60,
    })),
  });

  // Saison du prochain épisode annoncé → tous les épisodes futurs, pas juste un.
  const seasonTargets = useMemo(
    () =>
      detailQueries
        .map((query, index) => ({
          show: activeShows[index],
          details: query.data as TmdbShowDetails | undefined,
        }))
        .filter((entry) => entry.show && entry.details?.next_episode_to_air)
        .map((entry) => ({
          show: entry.show,
          seasonNumber: entry.details!.next_episode_to_air!.season_number,
        })),
    [detailQueries, activeShows]
  );

  const seasonQueries = useQueries({
    queries: seasonTargets.map((target) => ({
      queryKey: ['tmdb', 'season', target.show.tmdb_id, target.seasonNumber],
      queryFn: () => getSeasonDetails(target.show.tmdb_id, target.seasonNumber),
      staleTime: 1000 * 60 * 60,
    })),
  });

  const loading =
    shows.isLoading || detailQueries.some((query) => query.isLoading);

  const items = useMemo(() => {
    const watchedSet = new Set(
      (watchedRows.data ?? []).map(
        (row) => `${row.tmdb_show_id}:${episodeKey(row.season_number, row.episode_number)}`
      )
    );
    const showById = new Map(activeShows.map((show) => [show.tmdb_id, show]));
    const seen = new Set<string>();
    const items: CalendarItem[] = [];

    const push = (
      showId: number,
      episode: {
        season_number: number;
        episode_number: number;
        name: string;
        air_date: string | null;
      }
    ) => {
      if (!episode.air_date) return;
      const dedupe = `${showId}:${episode.season_number}:${episode.episode_number}`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);
      const show = showById.get(showId);
      if (!show) return;
      items.push({
        showId,
        showName: show.name,
        posterPath: show.poster_path,
        season: episode.season_number,
        episode: episode.episode_number,
        episodeName: episode.name,
        airDate: episode.air_date,
        watched: watchedSet.has(
          `${showId}:${episodeKey(episode.season_number, episode.episode_number)}`
        ),
      });
    };

    // Épisodes des saisons en cours (couvre plusieurs semaines à venir).
    seasonQueries.forEach((query, index) => {
      const season = query.data as TmdbSeasonDetails | undefined;
      const target = seasonTargets[index];
      if (!season || !target) return;
      for (const episode of season.episodes) push(target.show.tmdb_id, episode);
    });
    // Filets de sécurité : prochain épisode + dernier diffusé de chaque série.
    detailQueries.forEach((query, index) => {
      const details = query.data as TmdbShowDetails | undefined;
      const show = activeShows[index];
      if (!details || !show) return;
      if (details.next_episode_to_air) push(show.tmdb_id, details.next_episode_to_air);
      if (details.last_episode_to_air) push(show.tmdb_id, details.last_episode_to_air);
    });

    return items;
  }, [detailQueries, seasonQueries, seasonTargets, activeShows, watchedRows.data]);

  // Fenêtre pertinente autour d'aujourd'hui : évite les finales anciennes
  // (last_episode_to_air des séries terminées il y a des années).
  const boundedItems = useMemo(() => {
    const floor = addDays(isoToday(), -14);
    const ceil = addDays(isoToday(), 180);
    return items.filter((i) => i.airDate >= floor && i.airDate <= ceil);
  }, [items]);

  // Jours (de la semaine affichée) ayant au moins une sortie → pastille.
  const daysWithItems = useMemo(
    () => new Set(boundedItems.map((i) => i.airDate)),
    [boundedItems]
  );

  // Export .ics des diffusions à venir (Pro).
  const exportCalendar = async () => {
    if (!isPro) {
      router.push('/pro');
      return;
    }
    const today = isoToday();
    const upcoming = boundedItems.filter((i) => i.airDate >= today);
    if (!upcoming.length) {
      Alert.alert('Rien à exporter', 'Aucune diffusion à venir.');
      return;
    }
    try {
      await exportIcs(
        buildEpisodesIcs(
          upcoming.map((i) => ({
            showName: i.showName,
            season: i.season,
            episode: i.episode,
            episodeName: i.episodeName,
            airDate: i.airDate,
          }))
        ),
        'popcornlog-diffusions.ics'
      );
    } catch (error) {
      Alert.alert(
        'Export impossible',
        error instanceof Error ? error.message : 'Une erreur est survenue.'
      );
    }
  };

  // Calendrier continu : passé + futur, une seule timeline chronologique.
  const { sections, todayIndex } = useMemo(() => {
    const today = isoToday();
    const sorted = [...boundedItems].sort(
      (a, b) =>
        a.airDate.localeCompare(b.airDate) ||
        a.showName.localeCompare(b.showName)
    );
    const grouped: { title: string; iso: string; data: CalendarItem[] }[] = [];
    for (const item of sorted) {
      const last = grouped[grouped.length - 1];
      if (last && last.iso === item.airDate) last.data.push(item);
      else
        grouped.push({
          title: dateHeader(item.airDate),
          iso: item.airDate,
          data: [item],
        });
    }
    let idx = grouped.findIndex((s) => s.iso >= today);
    if (idx < 0) idx = Math.max(0, grouped.length - 1);
    return { sections: grouped, todayIndex: idx };
  }, [items]);

  // Notifications de diffusion : replanifiées à chaque passage ici.
  const [notifEnabled] = usePersistedState('notifications', false);
  useEffect(() => {
    if (!notifEnabled || loading || !items.length) return;
    const today = isoToday();
    syncEpisodeNotifications(
      items
        .filter((item) => item.airDate >= today)
        .map((item) => ({
          showName: item.showName,
          season: item.season,
          episode: item.episode,
          airDate: item.airDate,
        }))
    ).catch(() => {});
  }, [notifEnabled, loading, items]);

  // Agenda mobile : positionner la vue sur aujourd'hui à l'ouverture.
  useEffect(() => {
    if (isDesktop || loading || !sections.length) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToLocation({
        sectionIndex: todayIndex,
        itemIndex: 0,
        viewPosition: 0,
        viewOffset: headerH,
        animated: false,
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [isDesktop, loading, sections.length, todayIndex, headerH]);

  // Grille semaine (desktop) : les épisodes de la semaine affichée, par jour.
  const start = weekStartIso(weekOffset);
  const weekDays = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const byDay = new Map<string, typeof items>();
    for (const item of items) {
      if (item.airDate >= days[0] && item.airDate <= days[6]) {
        const list = byDay.get(item.airDate) ?? [];
        list.push(item);
        byDay.set(item.airDate, list);
      }
    }
    return days.map((iso) => ({ iso, items: byDay.get(iso) ?? [] }));
  }, [items, start]);
  const weekLabel = `${new Date(`${start}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${new Date(`${addDays(start, 6)}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  const today = isoToday();

  if (loading) {
    return (
      <Screen>
        <FrostedHeader onHeight={setHeaderH}>
          <View className="flex-row items-center px-4 pt-3 pb-2">
            <Text className="text-fg text-2xl font-extrabold">Calendrier</Text>
          </View>
        </FrostedHeader>
        <View style={{ height: headerH }} />
        <RowListSkeleton />
      </Screen>
    );
  }

  const useWeekGrid = isDesktop;

  return (
    <Screen>
      <View
        className={`flex-1 w-full self-center ${useWeekGrid ? '' : 'max-w-[760px]'}`}
      >
      <FrostedHeader onHeight={setHeaderH}>
        <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
          <Text className="text-fg text-2xl font-extrabold">Calendrier</Text>
          <View className="flex-row items-center gap-3">
            {useWeekGrid ? (
              <>
                <Pressable
                  onPress={() => setWeekOffset((o) => o - 1)}
                  hitSlop={8}
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
                <Pressable onPress={() => setWeekOffset(0)}>
                  <Text className="text-fg text-sm font-semibold min-w-[110px] text-center">
                    {weekOffset === 0 ? 'Cette semaine' : weekLabel}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setWeekOffset((o) => o + 1)}
                  hitSlop={8}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              </>
            ) : null}
            {/* Export .ics des diffusions à venir (Pro). */}
            <Pressable
              onPress={exportCalendar}
              hitSlop={8}
              className="w-9 h-9 rounded-lg bg-surface items-center justify-center"
              style={({ pressed }) => (pressed ? { opacity: 0.75 } : undefined)}
            >
              <Ionicons
                name="download-outline"
                size={17}
                color={colors.text}
              />
              {!isPro ? (
                <View className="absolute -top-1 -right-1.5 bg-accent rounded-full px-1 py-px">
                  <Text className="text-accent-fg text-[7px] font-extrabold">
                    PRO
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
        {/* La bande hebdo vit dans le header figé : la pastille du jour focusé
            reste visible pendant le scroll de l'agenda. */}
        {!useWeekGrid && sections.length ? (
          <CalendarWeekStrip
            weekStart={weekStartIso(0)}
            today={today}
            daysWithItems={daysWithItems}
            selected={selectedDay}
            onSelect={(iso) => {
              setSelectedDay(iso);
              const idx = sections.findIndex((s) => s.iso >= iso);
              if (idx >= 0)
                listRef.current?.scrollToLocation({
                  sectionIndex: idx,
                  itemIndex: 0,
                  viewPosition: 0,
                });
            }}
          />
        ) : null}
      </FrostedHeader>

      {useWeekGrid ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: headerH + 16 }}>
          <View className="flex-row gap-2">
            {weekDays.map((day) => {
              const d = new Date(`${day.iso}T00:00:00`);
              const isToday = day.iso === today;
              return (
                <View key={day.iso} className="flex-1">
                  <View className="items-center mb-2">
                    <Text className="text-muted text-[11px]">
                      {WEEKDAYS[(d.getDay() + 6) % 7]}
                    </Text>
                    <Text
                      className={`text-[15px] font-bold ${isToday ? 'text-accent-fg bg-accent px-2 rounded-md' : 'text-fg'}`}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                  <View className="gap-1.5">
                    {day.items.map((item, i) => {
                      const uri = imageUrl(item.posterPath, 'w185');
                      const highlight = isToday && i === 0;
                      return (
                        <Pressable
                          key={`${item.showId}-${item.season}-${item.episode}`}
                          onPress={() =>
                            router.push(`/show/${item.showId}?tab=episodes`)
                          }
                          className={`bg-surface rounded-lg overflow-hidden ${
                            highlight ? 'border border-accent' : ''
                          }`}
                          style={({ pressed }) =>
                            pressed ? { opacity: 0.8 } : undefined
                          }
                        >
                          <View className="aspect-video bg-surface-light">
                            {uri ? (
                              <Image
                                source={{ uri }}
                                className="w-full h-full"
                              />
                            ) : null}
                            {highlight ? (
                              <View className="absolute top-1 left-1 bg-accent px-1.5 py-0.5 rounded">
                                <Text className="text-accent-fg text-[8px] font-extrabold">
                                  CE SOIR
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <View className="p-1.5">
                            <Text
                              className="text-fg text-[11px] font-bold"
                              numberOfLines={1}
                            >
                              {item.showName}
                            </Text>
                            <Text className="text-muted text-[10px]">
                              S{String(item.season).padStart(2, '0')}E
                              {String(item.episode).padStart(2, '0')}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : sections.length ? (
        <>
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) =>
            `${item.showId}-${item.season}-${item.episode}`
          }
          contentContainerStyle={{ paddingTop: headerH, paddingBottom: 32 }}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewabilityConfig}
          onScrollToIndexFailed={({ highestMeasuredFrameIndex }) => {
            listRef.current?.scrollToLocation({
              sectionIndex: Math.min(todayIndex, highestMeasuredFrameIndex),
              itemIndex: 0,
              viewPosition: 0,
              viewOffset: headerH,
              animated: false,
            });
            setTimeout(() => {
              listRef.current?.scrollToLocation({
                sectionIndex: todayIndex,
                itemIndex: 0,
                viewPosition: 0,
                viewOffset: headerH,
                animated: false,
              });
            }, 300);
          }}
          renderSectionHeader={({ section }) => {
            const isTodayHeader = section.iso === today;
            return (
              <Text
                className={`text-[13px] font-bold px-4 pt-5 pb-2 capitalize ${isTodayHeader ? 'text-accent-fg' : 'text-accent'}`}
              >
                {isTodayHeader ? "Aujourd'hui" : section.title}
              </Text>
            );
          }}
          renderItem={({ item }) => (
            <CalendarEpisodeRow item={item} today={today} />
          )}
        />
        </>
      ) : (
        <EmptyState
          icon="calendar-outline"
          title="Rien à l'horizon"
          subtitle="Aucun épisode annoncé pour tes séries en cours."
        />
      )}
      </View>
    </Screen>
  );
}
