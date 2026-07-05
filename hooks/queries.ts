import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import * as db from '@/lib/db';
import * as tmdb from '@/lib/tmdb';
import type { Paginated } from '@/lib/tmdb';

// --- TMDB -------------------------------------------------------------------

/** Liste TMDB paginée avec scroll infini (20 items par page). */
function useTmdbInfinite<T>(
  key: (string | number)[],
  fetcher: (page: number) => Promise<Paginated<T>>,
  enabled = true
) {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetcher(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < Math.min(last.total_pages, 500) ? last.page + 1 : undefined,
    enabled,
    staleTime: 1000 * 60 * 30,
  });
  const items = (() => {
    const flat = query.data?.pages.flatMap((page) => page.results) ?? [];
    // TMDB renvoie parfois le même titre sur plusieurs pages → dédup par id.
    const seen = new Set<number>();
    return flat.filter((item) => {
      const id = (item as { id: number }).id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  })();
  return {
    ...query,
    items,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    },
  };
}

export function useTrendingShows() {
  return useTmdbInfinite(['tmdb', 'trending', 'tv'], tmdb.getTrendingShows);
}

export function useTrendingMovies() {
  return useTmdbInfinite(['tmdb', 'trending', 'movie'], tmdb.getTrendingMovies);
}

export function useTopRatedShows() {
  return useTmdbInfinite(['tmdb', 'top_rated', 'tv'], tmdb.getTopRatedShows);
}

export function useNowPlayingMovies() {
  return useTmdbInfinite(
    ['tmdb', 'now_playing', 'movie'],
    tmdb.getNowPlayingMovies
  );
}

export function useSearchShows(query: string) {
  return useTmdbInfinite(
    ['tmdb', 'search', 'tv', query],
    (page) => tmdb.searchShows(query, page),
    query.trim().length > 1
  );
}

export function useSearchMovies(query: string) {
  return useTmdbInfinite(
    ['tmdb', 'search', 'movie', query],
    (page) => tmdb.searchMovies(query, page),
    query.trim().length > 1
  );
}

export function useShowDetails(id: number) {
  return useQuery({
    queryKey: ['tmdb', 'show', id],
    queryFn: () => tmdb.getShowDetails(id),
    staleTime: 1000 * 60 * 60,
  });
}

export function useSeasonDetails(showId: number, seasonNumber: number | null) {
  return useQuery({
    queryKey: ['tmdb', 'season', showId, seasonNumber],
    queryFn: () => tmdb.getSeasonDetails(showId, seasonNumber as number),
    enabled: seasonNumber !== null,
    staleTime: 1000 * 60 * 60,
  });
}

export function useShowRecommendations(id: number, enabled = true) {
  return useQuery({
    queryKey: ['tmdb', 'recs', 'tv', id],
    queryFn: () => tmdb.getShowRecommendations(id),
    staleTime: 1000 * 60 * 60,
    enabled,
  });
}

export function useMovieRecommendations(id: number, enabled = true) {
  return useQuery({
    queryKey: ['tmdb', 'recs', 'movie', id],
    queryFn: () => tmdb.getMovieRecommendations(id),
    staleTime: 1000 * 60 * 60,
    enabled,
  });
}

export function usePersonDetails(id: number) {
  return useQuery({
    queryKey: ['tmdb', 'person', id],
    queryFn: () => tmdb.getPersonDetails(id),
    staleTime: 1000 * 60 * 60,
  });
}

export function useMovieDetails(id: number) {
  return useQuery({
    queryKey: ['tmdb', 'movie', id],
    queryFn: () => tmdb.getMovieDetails(id),
    staleTime: 1000 * 60 * 60,
  });
}

// --- Supabase : lectures ------------------------------------------------------

const SHOWS_KEY = ['db', 'tracked_shows'];
const EPISODES_KEY = ['db', 'watched_episodes'];
const MOVIES_KEY = ['db', 'user_movies'];

export function useTrackedShows() {
  return useQuery({ queryKey: SHOWS_KEY, queryFn: db.fetchTrackedShows });
}

export function useAllWatchedEpisodes() {
  return useQuery({
    queryKey: EPISODES_KEY,
    queryFn: db.fetchAllWatchedEpisodes,
  });
}

export function useMovies() {
  return useQuery({ queryKey: MOVIES_KEY, queryFn: db.fetchMovies });
}

export function useProfile() {
  return useQuery({
    queryKey: ['db', 'profile'],
    queryFn: db.fetchProfile,
    staleTime: 1000 * 60 * 60,
  });
}

// --- Supabase : mutations (toutes optimistes) ---------------------------------
// Le cache est mis à jour immédiatement (feedback instantané et cohérence de
// toutes les listes), la requête part en arrière-plan, rollback + alerte en
// cas d'échec, puis re-synchronisation avec la base.

function useOptimisticMutation<TArgs, TRow>(
  run: (args: TArgs) => Promise<void>,
  key: string[],
  updater: (old: TRow[], args: TArgs) => TRow[],
  alsoInvalidate: string[][] = []
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onMutate: async (args: TArgs) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: TRow[] = []) => updater(old, args));
      return { previous };
    },
    onError: (error, _args, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(key, context.previous);
      }
      Alert.alert(
        'Action impossible',
        error instanceof Error ? error.message : 'Une erreur est survenue.'
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      for (const extra of alsoInvalidate) {
        queryClient.invalidateQueries({ queryKey: extra });
      }
    },
  });
}

// --- Séries -------------------------------------------------------------------

export function useTrackShow() {
  return useOptimisticMutation<
    Parameters<typeof db.trackShow>[0],
    db.TrackedShow
  >(
    (show) => db.trackShow(show),
    SHOWS_KEY,
    (old, show) =>
      old.some((row) => row.tmdb_id === show.tmdb_id)
        ? old
        : [
            {
              id: -show.tmdb_id,
              user_id: '',
              tmdb_id: show.tmdb_id,
              name: show.name,
              poster_path: show.poster_path,
              backdrop_path: show.backdrop_path,
              status: show.status ?? 'watching',
              rating: null,
              added_at: new Date().toISOString(),
            },
            ...old,
          ]
  );
}

export function useSetShowStatus() {
  return useOptimisticMutation<
    { tmdbId: number; status: db.ShowStatus },
    db.TrackedShow
  >(
    ({ tmdbId, status }) => db.setShowStatus(tmdbId, status),
    SHOWS_KEY,
    (old, { tmdbId, status }) =>
      old.map((row) => (row.tmdb_id === tmdbId ? { ...row, status } : row))
  );
}

export function useSetShowRating() {
  return useOptimisticMutation<
    { tmdbId: number; rating: number | null },
    db.TrackedShow
  >(
    ({ tmdbId, rating }) => db.setShowRating(tmdbId, rating),
    SHOWS_KEY,
    (old, { tmdbId, rating }) =>
      old.map((row) => (row.tmdb_id === tmdbId ? { ...row, rating } : row))
  );
}

export function useUntrackShow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tmdbId: number) => db.untrackShow(tmdbId),
    onMutate: async (tmdbId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await queryClient.cancelQueries({ queryKey: SHOWS_KEY });
      await queryClient.cancelQueries({ queryKey: EPISODES_KEY });
      const previousShows = queryClient.getQueryData(SHOWS_KEY);
      const previousEpisodes = queryClient.getQueryData(EPISODES_KEY);
      queryClient.setQueryData(SHOWS_KEY, (old: db.TrackedShow[] = []) =>
        old.filter((row) => row.tmdb_id !== tmdbId)
      );
      queryClient.setQueryData(EPISODES_KEY, (old: db.WatchedEpisode[] = []) =>
        old.filter((row) => row.tmdb_show_id !== tmdbId)
      );
      return { previousShows, previousEpisodes };
    },
    onError: (error, _args, context) => {
      if (context?.previousShows !== undefined) {
        queryClient.setQueryData(SHOWS_KEY, context.previousShows);
      }
      if (context?.previousEpisodes !== undefined) {
        queryClient.setQueryData(EPISODES_KEY, context.previousEpisodes);
      }
      Alert.alert(
        'Action impossible',
        error instanceof Error ? error.message : 'Une erreur est survenue.'
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SHOWS_KEY });
      queryClient.invalidateQueries({ queryKey: EPISODES_KEY });
    },
  });
}

// --- Épisodes -------------------------------------------------------------------

function optimisticEpisode(
  showId: number,
  season: number,
  episode: number
): db.WatchedEpisode {
  return {
    id: -(showId * 1000000 + season * 1000 + episode),
    user_id: '',
    tmdb_show_id: showId,
    season_number: season,
    episode_number: episode,
    watched_at: new Date().toISOString(),
  };
}

export function useMarkEpisode() {
  return useOptimisticMutation<
    { showId: number; season: number; episode: number; watched: boolean },
    db.WatchedEpisode
  >(
    ({ showId, season, episode, watched }) =>
      watched
        ? db.markEpisode(showId, season, episode)
        : db.unmarkEpisode(showId, season, episode),
    EPISODES_KEY,
    (old, { showId, season, episode, watched }) =>
      watched
        ? [...old, optimisticEpisode(showId, season, episode)]
        : old.filter(
            (row) =>
              !(
                row.tmdb_show_id === showId &&
                row.season_number === season &&
                row.episode_number === episode
              )
          )
  );
}

export function useMarkEpisodesBulk() {
  return useOptimisticMutation<
    Parameters<typeof db.markEpisodesBulk>[0],
    db.WatchedEpisode
  >(
    (episodes) => db.markEpisodesBulk(episodes),
    EPISODES_KEY,
    (old, episodes) => {
      const existing = new Set(
        old.map(
          (row) =>
            `${row.tmdb_show_id}:${row.season_number}:${row.episode_number}`
        )
      );
      const added = episodes
        .filter(
          (episode) =>
            !existing.has(
              `${episode.tmdb_show_id}:${episode.season_number}:${episode.episode_number}`
            )
        )
        .map((episode) =>
          optimisticEpisode(
            episode.tmdb_show_id,
            episode.season_number,
            episode.episode_number
          )
        );
      return [...old, ...added];
    }
  );
}

// --- Films -----------------------------------------------------------------------

export function useAddMovie() {
  return useOptimisticMutation<
    Parameters<typeof db.addMovie>[0],
    db.UserMovie
  >(
    (movie) => db.addMovie(movie),
    MOVIES_KEY,
    (old, movie) => {
      const status = movie.status ?? 'watchlist';
      const row: db.UserMovie = {
        id: -movie.tmdb_id,
        user_id: '',
        tmdb_id: movie.tmdb_id,
        title: movie.title,
        poster_path: movie.poster_path,
        status,
        rating: null,
        watched_at: status === 'watched' ? new Date().toISOString() : null,
        added_at: new Date().toISOString(),
      };
      return [row, ...old.filter((m) => m.tmdb_id !== movie.tmdb_id)];
    }
  );
}

export function useSetMovieStatus() {
  return useOptimisticMutation<
    { tmdbId: number; status: db.MovieStatus },
    db.UserMovie
  >(
    ({ tmdbId, status }) => db.setMovieStatus(tmdbId, status),
    MOVIES_KEY,
    (old, { tmdbId, status }) =>
      old.map((row) =>
        row.tmdb_id === tmdbId
          ? {
              ...row,
              status,
              watched_at:
                status === 'watched' ? new Date().toISOString() : null,
            }
          : row
      )
  );
}

export function useSetMovieRating() {
  return useOptimisticMutation<
    { tmdbId: number; rating: number | null },
    db.UserMovie
  >(
    ({ tmdbId, rating }) => db.setMovieRating(tmdbId, rating),
    MOVIES_KEY,
    (old, { tmdbId, rating }) =>
      old.map((row) => (row.tmdb_id === tmdbId ? { ...row, rating } : row))
  );
}

export function useRemoveMovie() {
  return useOptimisticMutation<number, db.UserMovie>(
    (tmdbId) => db.removeMovie(tmdbId),
    MOVIES_KEY,
    (old, tmdbId) => old.filter((row) => row.tmdb_id !== tmdbId)
  );
}

// --- Listes personnalisées (Pro) ------------------------------------------------

const LISTS_KEY = ['db', 'user_lists'];
const LIST_ITEMS_KEY = ['db', 'list_items'];

export function useLists() {
  return useQuery({ queryKey: LISTS_KEY, queryFn: db.fetchLists });
}

/** Tous les éléments de toutes les listes (petits volumes → un seul fetch). */
export function useAllListItems() {
  return useQuery({ queryKey: LIST_ITEMS_KEY, queryFn: db.fetchAllListItems });
}

export function useCreateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, emoji }: { name: string; emoji: string | null }) =>
      db.createList(name, emoji),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LISTS_KEY }),
    onError: (error) =>
      Alert.alert(
        'Création impossible',
        error instanceof Error ? error.message : 'Une erreur est survenue.'
      ),
  });
}

export function useRenameList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      name,
      emoji,
    }: {
      listId: number;
      name: string;
      emoji: string | null;
    }) => db.renameList(listId, name, emoji),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LISTS_KEY }),
    onError: (error) =>
      Alert.alert(
        'Renommage impossible',
        error instanceof Error ? error.message : 'Une erreur est survenue.'
      ),
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: number) => db.deleteList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTS_KEY });
      queryClient.invalidateQueries({ queryKey: LIST_ITEMS_KEY });
    },
    onError: (error) =>
      Alert.alert(
        'Suppression impossible',
        error instanceof Error ? error.message : 'Une erreur est survenue.'
      ),
  });
}

export function useAddToList() {
  return useOptimisticMutation<
    {
      list_id: number;
      media_type: db.ListMediaType;
      tmdb_id: number;
      title: string;
      poster_path: string | null;
    },
    db.ListItem
  >(
    (item) => db.addToList(item),
    LIST_ITEMS_KEY,
    (old, item) =>
      old.some(
        (row) =>
          row.list_id === item.list_id &&
          row.media_type === item.media_type &&
          row.tmdb_id === item.tmdb_id
      )
        ? old
        : [
            {
              id: -Date.now(),
              user_id: '',
              added_at: new Date().toISOString(),
              ...item,
            },
            ...old,
          ]
  );
}

export function useRemoveFromList() {
  return useOptimisticMutation<
    { listId: number; mediaType: db.ListMediaType; tmdbId: number },
    db.ListItem
  >(
    ({ listId, mediaType, tmdbId }) =>
      db.removeFromList(listId, mediaType, tmdbId),
    LIST_ITEMS_KEY,
    (old, { listId, mediaType, tmdbId }) =>
      old.filter(
        (row) =>
          !(
            row.list_id === listId &&
            row.media_type === mediaType &&
            row.tmdb_id === tmdbId
          )
      )
  );
}
