import React from 'react';
import { View } from 'react-native';
import { ActionToggle } from '@/components/ActionToggle';
import { RatingField } from '@/components/RatingField';
import {
  useSetShowRating,
  useSetShowStatus,
  useTrackedShows,
  useTrackShow,
  useUntrackShow,
} from '@/hooks/queries';
import type { TmdbShowDetails } from '@/lib/tmdb';

/**
 * Barre d'actions de la fiche série : deux boutons d'ÉTAT mutuellement exclusifs
 * (Suivie · À voir), jumelle exacte de MovieActionBar. La notation apparaît
 * d'elle-même une fois la série suivie (bloc « Ma note » partagé via RatingField).
 *
 * Modèle unifié avec la fiche film :
 *  - « Suivie » = série trackée avec un statut de visionnage (watching/completed/stopped)
 *  - « À voir » = série trackée avec le statut `planned` (watchlist)
 *  - cliquer un bouton déjà actif → on retire la série (untrack)
 */
export function ShowActionBar({ show }: { show: TmdbShowDetails }) {
  const shows = useTrackedShows();
  const trackShow = useTrackShow();
  const setStatus = useSetShowStatus();
  const setRating = useSetShowRating();
  const untrackShow = useUntrackShow();
  const saved = (shows.data ?? []).find((s) => s.tmdb_id === show.id);

  const following = !!saved && saved.status !== 'planned';
  const planned = saved?.status === 'planned';

  // (dé)place la série vers le statut cible (ou la track si absente).
  const setStatusOrTrack = (status: 'watching' | 'planned') => {
    if (!saved) {
      trackShow.mutate({
        tmdb_id: show.id,
        name: show.name,
        poster_path: show.poster_path,
        backdrop_path: show.backdrop_path,
        status,
      });
    } else {
      setStatus.mutate({ tmdbId: show.id, status });
    }
  };

  const toggleFollowing = () => {
    if (following) untrackShow.mutate(show.id);
    else setStatusOrTrack('watching');
  };

  const togglePlanned = () => {
    if (planned) untrackShow.mutate(show.id);
    else setStatusOrTrack('planned');
  };

  return (
    <View className="gap-3">
      <View className="flex-row gap-2.5">
        <ActionToggle
          icon={following ? 'checkmark-circle' : 'checkmark-circle-outline'}
          label="Suivie"
          active={following}
          onPress={toggleFollowing}
        />
        <ActionToggle
          icon={planned ? 'bookmark' : 'bookmark-outline'}
          label="À voir"
          active={planned}
          onPress={togglePlanned}
        />
      </View>

      {/* La note apparaît d'elle-même une fois la série suivie (démarrée),
          comme sur la fiche film où elle n'apparaît qu'une fois « Vu ». */}
      {following ? (
        <RatingField
          value={saved?.rating ?? null}
          onChange={(rating) => setRating.mutate({ tmdbId: show.id, rating })}
        />
      ) : null}
    </View>
  );
}
