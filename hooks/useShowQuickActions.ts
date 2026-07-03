import type { ActionSheetConfig } from '@/components/ActionSheet';
import {
  useMarkEpisode,
  useSetShowStatus,
  useUntrackShow,
} from '@/hooks/queries';
import type { TrackedShow } from '@/lib/db';

/**
 * Actions rapides d'une série (long-press sur une carte) :
 * cocher le prochain épisode, ne plus regarder / reprendre, ne plus suivre.
 */
export function useShowQuickActions(
  openSheet: (config: ActionSheetConfig) => void
) {
  const markEpisode = useMarkEpisode();
  const setStatus = useSetShowStatus();
  const untrackShow = useUntrackShow();

  return (
    show: TrackedShow,
    next: { season: number; episode: number } | null
  ) => {
    const actions: ActionSheetConfig['actions'] = [];
    if (next) {
      actions.push({
        label: `✓ Cocher S${String(next.season).padStart(2, '0')}E${String(
          next.episode
        ).padStart(2, '0')} vu`,
        variant: 'primary',
        onPress: () =>
          markEpisode.mutate({
            showId: show.tmdb_id,
            season: next.season,
            episode: next.episode,
            watched: true,
          }),
      });
    }
    actions.push({
      label: show.status === 'stopped' ? 'Reprendre la série' : 'Ne plus regarder',
      onPress: () =>
        setStatus.mutate({
          tmdbId: show.tmdb_id,
          status: show.status === 'stopped' ? 'watching' : 'stopped',
        }),
    });
    actions.push({
      label: 'Ne plus suivre (tout supprimer)',
      variant: 'danger',
      onPress: () =>
        openSheet({
          title: 'Ne plus suivre',
          message: 'La série et tous tes épisodes vus seront supprimés.',
          actions: [
            {
              label: 'Supprimer',
              variant: 'danger',
              onPress: () => untrackShow.mutate(show.tmdb_id),
            },
          ],
        }),
    });
    openSheet({ title: show.name, actions });
  };
}
