import { Ionicons } from '@expo/vector-icons';
import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useActionSheet } from '@/components/ActionSheet';
import { Carousel } from '@/components/Carousel';
import { CastRow } from '@/components/CastRow';
import { EpisodeCard } from '@/components/EpisodeCard';
import { FloatingButton, FloatingHeader } from '@/components/FloatingHeader';
import { NextEpisodeBanner } from '@/components/NextEpisodeBanner';
import { PosterCard } from '@/components/PosterCard';
import { RatingField } from '@/components/RatingField';
import { DetailSkeleton } from '@/components/Skeleton';
import { TrailerPlayButton } from '@/components/TrailerPlayButton';
import { WhereToWatch } from '@/components/WhereToWatch';
import { ProgressBar, Screen } from '@/components/ui';
import {
  useAllWatchedEpisodes,
  useMarkEpisode,
  useMarkEpisodesBulk,
  useSeasonDetails,
  useSetShowRating,
  useSetShowStatus,
  useShowDetails,
  useShowRecommendations,
  useTrackShow,
  useTrackedShows,
  useUntrackShow,
} from '@/hooks/queries';
import { useAutoShowStatus } from '@/hooks/useAutoShowStatus';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { ShowStatus } from '@/lib/db';
import {
  episodeKey,
  isUpToDate,
  nextEpisode,
  totalEpisodes,
  unwatchedUpTo,
  watchedCount,
  watchedSetForShow,
} from '@/lib/progress';
import { findTrailer, imageUrl, type TmdbEpisode } from '@/lib/tmdb';
import { colors } from '@/lib/theme';

const STATUS_META: Record<ShowStatus, { label: string; bg: string; text: string }> = {
  watching: { label: 'En cours', bg: 'bg-accent/15', text: 'text-accent' },
  planned: { label: 'À commencer', bg: 'bg-surface-light', text: 'text-muted' },
  completed: { label: 'Terminée ✓', bg: 'bg-success/15', text: 'text-success' },
  stopped: { label: 'Ne regarde plus', bg: 'bg-danger/15', text: 'text-danger' },
};

type Tab = 'about' | 'episodes';

export default function ShowDetailScreen() {
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const showId = Number(params.id);
  const router = useRouter();
  const { scrolled, scrollProps } = useHeaderScroll();
  const blurTarget = useRef<View>(null);
  const [tab, setTab] = useState<Tab>(
    params.tab === 'episodes' ? 'episodes' : 'about'
  );
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const { show: openSheet, sheet } = useActionSheet();
  const isDesktop = useBreakpoint() === 'desktop';

  const details = useShowDetails(showId);
  const tracked = useTrackedShows();
  const watchedRows = useAllWatchedEpisodes();
  const untrackShow = useUntrackShow();
  const trackShow = useTrackShow();
  const setStatus = useSetShowStatus();
  const setRating = useSetShowRating();
  const markEpisode = useMarkEpisode();
  const markBulk = useMarkEpisodesBulk();
  const recommendations = useShowRecommendations(showId);

  const trackedShow = (tracked.data ?? []).find(
    (show) => show.tmdb_id === showId
  );
  const watched = useMemo(
    () => watchedSetForShow(watchedRows.data ?? [], showId),
    [watchedRows.data, showId]
  );
  useAutoShowStatus(trackedShow, details.data, watched);

  const seasons = useMemo(
    () =>
      (details.data?.seasons ?? [])
        .filter((season) => season.episode_count > 0)
        .sort((a, b) => {
          if (a.season_number === 0) return 1;
          if (b.season_number === 0) return -1;
          return a.season_number - b.season_number;
        }),
    [details.data]
  );
  const next = useMemo(
    () => (details.data ? nextEpisode(details.data.seasons, watched) : null),
    [details.data, watched]
  );
  // Saison affichée : celle choisie, sinon celle du prochain épisode à voir.
  const activeSeason =
    selectedSeason ?? next?.season ?? seasons[0]?.season_number ?? null;
  const seasonDetails = useSeasonDetails(
    showId,
    tab === 'episodes' ? activeSeason : null
  );
  // Saison du prochain épisode (still + nom + durée pour la bannière),
  // chargée même hors onglet Épisodes.
  const nextSeasonDetails = useSeasonDetails(showId, next?.season ?? null);

  // Recommandations : ne pas re-proposer ce qu'on suit déjà.
  const trackedIds = useMemo(
    () => new Set((tracked.data ?? []).map((show) => show.tmdb_id)),
    [tracked.data]
  );
  const filteredRecs = (recommendations.data?.results ?? [])
    .filter((item) => !trackedIds.has(item.id))
    .slice(0, 12);

  if (details.isLoading || tracked.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <FloatingHeader />
        <DetailSkeleton />
      </Screen>
    );
  }
  if (!details.data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <FloatingHeader />
        <Text className="text-muted p-4 text-center mt-24">
          Série introuvable.
        </Text>
      </Screen>
    );
  }

  const show = details.data;
  const total = totalEpisodes(show.seasons);
  const seen = watchedCount(watched);
  const backdrop = imageUrl(show.backdrop_path, 'w780');
  const poster = imageUrl(show.poster_path, 'w342');

  const upToDate = isUpToDate(
    show.seasons,
    watched,
    show.last_episode_to_air ?? null
  );
  const nextEpisodeData = next
    ? nextSeasonDetails.data?.episodes.find(
        (episode) => episode.episode_number === next.episode
      )
    : undefined;
  // Méta présentée en chips (année · genres · note), réutilisée mobile + desktop.
  const metaChips = (
    <>
      {show.first_air_date ? (
        <View className="bg-surface rounded-full px-2.5 py-1">
          <Text className="text-muted text-[12px] font-semibold">
            {show.first_air_date.slice(0, 4)}
          </Text>
        </View>
      ) : null}
      {show.genres.slice(0, 3).map((genre) => (
        <View key={genre.name} className="bg-surface rounded-full px-2.5 py-1">
          <Text className="text-muted text-[12px] font-semibold">
            {genre.name}
          </Text>
        </View>
      ))}
      {show.vote_average ? (
        <View className="bg-surface rounded-full px-2.5 py-1">
          <Text className="text-accent text-[12px] font-bold">
            ★ {show.vote_average.toFixed(1)}
          </Text>
        </View>
      ) : null}
    </>
  );
  // Bannière « À voir maintenant » : action principale remontée sous le titre.
  const nextBanner =
    trackedShow && next && !upToDate ? (
      <NextEpisodeBanner
        showId={showId}
        next={next}
        stillPath={nextEpisodeData?.still_path ?? show.backdrop_path}
        episodeName={nextEpisodeData?.name}
        runtime={nextEpisodeData?.runtime}
        seen={seen}
        total={total}
      />
    ) : null;

  // « En cours » mais tout vu → « À jour » (le statut en base reste watching).
  const statusMeta = trackedShow
    ? trackedShow.status === 'watching' &&
      isUpToDate(show.seasons, watched, show.last_episode_to_air ?? null)
      ? { label: 'À jour ✓', bg: 'bg-success/15', text: 'text-success' }
      : STATUS_META[trackedShow.status]
    : null;

  // --- Modèle d'action (jumeau de la fiche film) : deux boutons ronds dans le
  // header, À voir · Suivie. Actif = plein accent ; ré-appui sur l'actif = on
  // arrête sans rien perdre.
  //   « Suivie » = en cours / terminée (watching|completed)
  //   « À voir » = planifiée (planned)
  //   « Arrêtée » (stopped) = les DEUX inactifs, mais la série et TOUT
  //     l'historique d'épisodes restent en base (on peut re-suivre plus tard).
  const following =
    trackedShow?.status === 'watching' || trackedShow?.status === 'completed';
  const planned = trackedShow?.status === 'planned';
  // « démarrée » = suivie OU arrêtée : dans les deux cas on a pu la noter.
  const started = !!trackedShow && trackedShow.status !== 'planned';

  const setStatusOrTrack = (status: 'watching' | 'planned') => {
    if (trackedShow) setStatus.mutate({ tmdbId: showId, status });
    else
      trackShow.mutate({
        tmdb_id: show.id,
        name: show.name,
        poster_path: show.poster_path,
        backdrop_path: show.backdrop_path,
        status,
      });
  };
  // Arrêter de suivre = passer en « Arrêtée » (garde l'historique). La
  // suppression totale (série + logs) reste au long-press dans les listes.
  const toggleFollowing = () =>
    following
      ? setStatus.mutate({ tmdbId: showId, status: 'stopped' })
      : setStatusOrTrack('watching');
  const togglePlanned = () =>
    planned ? untrackShow.mutate(showId) : setStatusOrTrack('planned');

  const headerRight = (
    <>
      <FloatingButton
        icon={planned ? 'bookmark' : 'bookmark-outline'}
        active={planned}
        onPress={togglePlanned}
      />
      <FloatingButton
        icon={following ? 'checkmark-circle' : 'checkmark-circle-outline'}
        active={following}
        onPress={toggleFollowing}
      />
    </>
  );

  // La note apparaît une fois la série démarrée (suivie ou arrêtée).
  const ratingEl = started ? (
    <RatingField
      value={trackedShow?.rating ?? null}
      onChange={(rating) => setRating.mutate({ tmdbId: showId, rating })}
    />
  ) : null;

  const toggleEpisode = (episode: TmdbEpisode, isWatched: boolean) => {
    const markSingle = (value: boolean) =>
      markEpisode.mutate({
        showId,
        season: episode.season_number,
        episode: episode.episode_number,
        watched: value,
      });
    if (isWatched) {
      markSingle(false);
      return;
    }
    // Marquage rétroactif : proposer les épisodes précédents non vus.
    const previous = unwatchedUpTo(show.seasons, watched, {
      season: episode.season_number,
      episode: episode.episode_number,
    }).filter(
      (pair) =>
        !(
          pair.season_number === episode.season_number &&
          pair.episode_number === episode.episode_number
        )
    );
    if (!previous.length) {
      markSingle(true);
      return;
    }
    openSheet({
      title: 'Épisodes précédents',
      message: `${previous.length} épisode${previous.length > 1 ? 's' : ''} avant celui-ci ${
        previous.length > 1 ? 'ne sont pas marqués' : "n'est pas marqué"
      } comme vu${previous.length > 1 ? 's' : ''}.`,
      actions: [
        {
          label: `Tout marquer (${previous.length + 1})`,
          variant: 'primary',
          onPress: () =>
            markBulk.mutate(
              [
                ...previous,
                {
                  season_number: episode.season_number,
                  episode_number: episode.episode_number,
                },
              ].map((pair) => ({
                tmdb_show_id: showId,
                season_number: pair.season_number,
                episode_number: pair.episode_number,
              }))
            ),
        },
        { label: 'Celui-ci seulement', onPress: () => markSingle(true) },
      ],
    });
  };

  const activeSeasonSummary = seasons.find(
    (season) => season.season_number === activeSeason
  );
  const episodes = seasonDetails.data?.episodes ?? [];
  const seenInActiveSeason = episodes.filter((episode) =>
    watched.has(episodeKey(episode.season_number, episode.episode_number))
  ).length;

  // --- Blocs de contenu réutilisés par les layouts mobile et desktop ---

  const synopsisEl = show.overview ? (
    <Text className="text-fg text-sm leading-[21px] opacity-90">
      {show.overview}
    </Text>
  ) : null;

  const whereEl = (
    <WhereToWatch providers={show['watch/providers']?.results?.FR} />
  );

  const castAndRecs = (
    <View className="gap-6">
      {show.credits?.cast?.length ? <CastRow cast={show.credits.cast} /> : null}
      {filteredRecs.length ? (
        <Carousel
          title="Dans le même genre"
          data={filteredRecs}
          render={(item) => (
            <PosterCard
              title={item.name}
              posterPath={item.poster_path}
              subtitle={item.first_air_date?.slice(0, 4)}
              width={110}
              onPress={() => router.push(`/show/${item.id}`)}
            />
          )}
        />
      ) : null}
    </View>
  );

  const seasonSelector = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {seasons.map((season) => {
        let seenInSeason = 0;
        for (let e = 1; e <= season.episode_count; e++) {
          if (watched.has(episodeKey(season.season_number, e))) seenInSeason++;
        }
        const complete = seenInSeason >= season.episode_count;
        const active = season.season_number === activeSeason;
        return (
          <Pressable
            key={season.id}
            onPress={() => setSelectedSeason(season.season_number)}
            className={`px-3.5 py-2 rounded-full flex-row items-center gap-1.5 ${
              active ? 'bg-accent' : 'bg-surface'
            }`}
          >
            <Text
              className={`text-[13px] font-bold ${
                active ? 'text-accent-fg' : 'text-muted'
              }`}
            >
              {season.season_number === 0
                ? 'Spéciaux'
                : `Saison ${season.season_number}`}
            </Text>
            {complete ? (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={active ? colors.accentText : colors.success}
              />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const episodesBody = (
    <View className="gap-4">
      <View className="gap-1.5">
        <Text className="text-muted text-[13px]">
          {seen} / {total} épisodes vus
        </Text>
        <ProgressBar progress={total > 0 ? seen / total : 0} />
      </View>
      {seasonSelector}
      {seasonDetails.isLoading ? (
        <Text className="text-muted p-4 text-center">Chargement…</Text>
      ) : (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-muted text-[13px]">
              {seenInActiveSeason} / {episodes.length} vus
              {activeSeasonSummary?.air_date
                ? ` · ${activeSeasonSummary.air_date.slice(0, 4)}`
                : ''}
            </Text>
            {seenInActiveSeason < episodes.length ? (
              <Pressable
                onPress={() =>
                  markBulk.mutate(
                    episodes.map((episode) => ({
                      tmdb_show_id: showId,
                      season_number: episode.season_number,
                      episode_number: episode.episode_number,
                    }))
                  )
                }
                disabled={markBulk.isPending}
                className="bg-surface-light px-3 py-1.5 rounded-md"
              >
                <Text className="text-accent text-xs font-bold">
                  Tout marquer vu
                </Text>
              </Pressable>
            ) : null}
          </View>
          {/* Desktop : liste d'épisodes en 2 colonnes ; mobile : 1 colonne. */}
          <View className={isDesktop ? 'flex-row flex-wrap' : 'gap-3'}>
            {episodes.map((episode) => {
              const isWatched = watched.has(
                episodeKey(episode.season_number, episode.episode_number)
              );
              const card = (
                <EpisodeCard
                  episode={episode}
                  watched={isWatched}
                  onToggleWatched={() => toggleEpisode(episode, isWatched)}
                />
              );
              return isDesktop ? (
                <View key={episode.id} style={{ width: '50%' }} className="px-1 pb-2">
                  {card}
                </View>
              ) : (
                <View key={episode.id}>{card}</View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );

  const tabSelector = (
    <View
      className={`${isDesktop ? 'self-start' : ''} flex-row bg-surface rounded-lg p-[3px]`}
    >
      {(
        [
          ['about', 'À propos'],
          ['episodes', 'Épisodes'],
        ] as [Tab, string][]
      ).map(([value, label]) => (
        <Pressable
          key={value}
          onPress={() => setTab(value)}
          className={`${isDesktop ? 'px-10' : 'flex-1'} py-2 rounded-md items-center ${
            tab === value ? 'bg-accent' : ''
          }`}
        >
          <Text
            className={`font-bold text-sm ${
              tab === value ? 'text-accent-fg' : 'text-muted'
            }`}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  // --- Desktop : rail affiche/actions à gauche, contenu à droite ---
  if (isDesktop) {
    return (
      <View className="flex-1 bg-bg">
        <Stack.Screen options={{ headerShown: false }} />
        {sheet}
        <FloatingHeader right={headerRight} />
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="bg-surface" style={{ height: 360 }}>
            {backdrop ? (
              <Image source={{ uri: backdrop }} className="w-full h-full" />
            ) : null}
            <LinearGradient
              colors={['transparent', colors.bg]}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 }}
            />
            <TrailerPlayButton trailer={findTrailer(show.videos)} size="lg" />
          </View>

          <View className="flex-row gap-8 px-8 -mt-24">
            {/* Rail gauche : affiche + actions (collant pendant le scroll). */}
            <View
              className="w-52 gap-4"
              style={{ position: 'sticky', top: 16 } as object}
            >
              {poster ? (
                <Image
                  source={{ uri: poster }}
                  className="w-52 aspect-[2/3] rounded-2xl border-2 border-line"
                />
              ) : null}
              {statusMeta ? (
                <View className="flex-row items-center gap-2">
                  <View className={`px-3 py-1.5 rounded-full ${statusMeta.bg}`}>
                    <Text className={`text-[12px] font-bold ${statusMeta.text}`}>
                      {statusMeta.label}
                    </Text>
                  </View>
                </View>
              ) : null}
              {ratingEl}
              {whereEl}
            </View>

            {/* Colonne droite : titre + onglets + contenu */}
            <View className="flex-1 gap-4 pt-28">
              <View className="gap-1">
                <Text className="text-fg text-3xl font-extrabold">
                  {show.name}
                </Text>
                <View className="flex-row flex-wrap items-center gap-1.5">
                  {metaChips}
                </View>
              </View>
              {nextBanner}
              {tabSelector}
              {tab === 'about' ? (
                <View className="gap-6">
                  {synopsisEl}
                  {castAndRecs}
                </View>
              ) : (
                episodesBody
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {sheet}
      <FloatingHeader
        scrolled={scrolled}
        title={show.name}
        right={headerRight}
        blurTarget={blurTarget}
      />
      <BlurTargetView ref={blurTarget} collapsable={false} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} {...scrollProps}>
        <View
          className={isDesktop ? 'bg-surface' : 'aspect-video bg-surface'}
          style={isDesktop ? { height: 360 } : undefined}
        >
          {backdrop ? (
            <Image source={{ uri: backdrop }} className="w-full h-full" />
          ) : null}
          <LinearGradient
            colors={['transparent', colors.bg]}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 90,
            }}
          />
          <TrailerPlayButton trailer={findTrailer(show.videos)} />
        </View>

        <View className="flex-row px-4 -mt-12 gap-3 items-end">
          {poster ? (
            <Image
              source={{ uri: poster }}
              className="w-24 aspect-[2/3] rounded-xl border-2 border-line"
            />
          ) : null}
          <View className="flex-1 pb-1 gap-2">
            <Text className="text-fg text-2xl font-extrabold">{show.name}</Text>
            <View className="flex-row flex-wrap items-center gap-1.5">
              {metaChips}
              {statusMeta ? (
                <View className={`px-2.5 py-1 rounded-full ${statusMeta.bg}`}>
                  <Text className={`text-[11px] font-bold ${statusMeta.text}`}>
                    {statusMeta.label}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {nextBanner ? <View className="pt-3">{nextBanner}</View> : null}

        <View className="p-4 gap-4">
          {ratingEl}

          <View
            className={`${isDesktop ? 'self-start' : ''} flex-row bg-surface rounded-lg p-[3px]`}
          >
            {(
              [
                ['about', 'À propos'],
                ['episodes', 'Épisodes'],
              ] as [Tab, string][]
            ).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                className={`${isDesktop ? 'px-10' : 'flex-1'} py-2 rounded-md items-center ${
                  tab === value ? 'bg-accent' : ''
                }`}
              >
                <Text
                  className={`font-bold text-sm ${
                    tab === value ? 'text-accent-fg' : 'text-muted'
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {tab === 'about' ? (
          <View className="gap-6 pb-4">
            {/* Ordre : synopsis → Où regarder → casting → reco.
                (La note est dans la barre d'actions en haut de fiche.) */}
            <View className="gap-5 px-4">
              {synopsisEl}
              <WhereToWatch providers={show['watch/providers']?.results?.FR} />
            </View>
            {show.credits?.cast?.length ? (
              <CastRow cast={show.credits.cast} />
            ) : null}
            {filteredRecs.length ? (
              <Carousel
                title="Dans le même genre"
                data={filteredRecs}
                render={(item) => (
                  <PosterCard
                    title={item.name}
                    posterPath={item.poster_path}
                    subtitle={item.first_air_date?.slice(0, 4)}
                    width={110}
                    onPress={() => router.push(`/show/${item.id}`)}
                  />
                )}
              />
            ) : null}
          </View>
        ) : (
          <View
            className={`gap-4 pb-4 ${
              isDesktop ? 'w-full max-w-[800px] self-center' : ''
            }`}
          >
            <View className="px-4 gap-1.5">
              <Text className="text-muted text-[13px]">
                {seen} / {total} épisodes vus
              </Text>
              <ProgressBar progress={total > 0 ? seen / total : 0} />
            </View>

            {/* Sélecteur de saison — la saison en cours est présélectionnée. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {seasons.map((season) => {
                let seenInSeason = 0;
                for (let e = 1; e <= season.episode_count; e++) {
                  if (watched.has(episodeKey(season.season_number, e)))
                    seenInSeason++;
                }
                const complete = seenInSeason >= season.episode_count;
                const active = season.season_number === activeSeason;
                return (
                  <Pressable
                    key={season.id}
                    onPress={() => setSelectedSeason(season.season_number)}
                    className={`px-3.5 py-2 rounded-full flex-row items-center gap-1.5 ${
                      active ? 'bg-accent' : 'bg-surface'
                    }`}
                  >
                    <Text
                      className={`text-[13px] font-bold ${
                        active ? 'text-accent-fg' : 'text-muted'
                      }`}
                    >
                      {season.season_number === 0
                        ? 'Spéciaux'
                        : `Saison ${season.season_number}`}
                    </Text>
                    {complete ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={active ? colors.accentText : colors.success}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            {seasonDetails.isLoading ? (
              <Text className="text-muted p-4 text-center">Chargement…</Text>
            ) : (
              <View className="px-4 gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-muted text-[13px]">
                    {seenInActiveSeason} / {episodes.length} vus
                    {activeSeasonSummary?.air_date
                      ? ` · ${activeSeasonSummary.air_date.slice(0, 4)}`
                      : ''}
                  </Text>
                  {seenInActiveSeason < episodes.length ? (
                    <Pressable
                      onPress={() =>
                        markBulk.mutate(
                          episodes.map((episode) => ({
                            tmdb_show_id: showId,
                            season_number: episode.season_number,
                            episode_number: episode.episode_number,
                          }))
                        )
                      }
                      disabled={markBulk.isPending}
                      className="bg-surface-light px-3 py-1.5 rounded-md"
                    >
                      <Text className="text-accent text-xs font-bold">
                        Tout marquer vu
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {episodes.map((episode) => {
                  const isWatched = watched.has(
                    episodeKey(episode.season_number, episode.episode_number)
                  );
                  return (
                    <EpisodeCard
                      key={episode.id}
                      episode={episode}
                      watched={isWatched}
                      onToggleWatched={() => toggleEpisode(episode, isWatched)}
                    />
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </BlurTargetView>
    </Screen>
  );
}
