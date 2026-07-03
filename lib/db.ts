import { supabase } from './supabase';

export type ShowStatus = 'watching' | 'completed' | 'stopped' | 'planned';
export type MovieStatus = 'watchlist' | 'watched';

export interface TrackedShow {
  id: number;
  user_id: string;
  tmdb_id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  status: ShowStatus;
  rating: number | null;
  added_at: string;
}

export interface WatchedEpisode {
  id: number;
  user_id: string;
  tmdb_show_id: number;
  season_number: number;
  episode_number: number;
  watched_at: string;
}

export interface UserMovie {
  id: number;
  user_id: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  status: MovieStatus;
  rating: number | null;
  watched_at: string | null;
  added_at: string;
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

// --- Profil ------------------------------------------------------------------

export interface Profile {
  id: string;
  username: string | null;
  created_at: string;
}

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .maybeSingle();
  throwIfError(error);
  return data as Profile | null;
}

// --- Séries suivies -------------------------------------------------------

export async function fetchTrackedShows(): Promise<TrackedShow[]> {
  const { data, error } = await supabase
    .from('tracked_shows')
    .select('*')
    .order('added_at', { ascending: false });
  throwIfError(error);
  return (data ?? []) as TrackedShow[];
}

export async function trackShow(show: {
  tmdb_id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  status?: ShowStatus;
}): Promise<void> {
  const { error } = await supabase
    .from('tracked_shows')
    .upsert(show, { onConflict: 'user_id,tmdb_id', ignoreDuplicates: true });
  throwIfError(error);
}

export async function setShowStatus(
  tmdbId: number,
  status: ShowStatus
): Promise<void> {
  const { error } = await supabase
    .from('tracked_shows')
    .update({ status })
    .eq('tmdb_id', tmdbId);
  throwIfError(error);
}

export async function setShowRating(
  tmdbId: number,
  rating: number | null
): Promise<void> {
  const { error } = await supabase
    .from('tracked_shows')
    .update({ rating })
    .eq('tmdb_id', tmdbId);
  throwIfError(error);
}

export async function untrackShow(tmdbId: number): Promise<void> {
  const { error: episodesError } = await supabase
    .from('watched_episodes')
    .delete()
    .eq('tmdb_show_id', tmdbId);
  throwIfError(episodesError);
  const { error } = await supabase
    .from('tracked_shows')
    .delete()
    .eq('tmdb_id', tmdbId);
  throwIfError(error);
}

// --- Épisodes vus ----------------------------------------------------------

export async function fetchAllWatchedEpisodes(): Promise<WatchedEpisode[]> {
  const pageSize = 1000;
  // Une requête de comptage, puis toutes les pages en parallèle.
  const { count, error: countError } = await supabase
    .from('watched_episodes')
    .select('*', { count: 'exact', head: true });
  throwIfError(countError);
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase
        .from('watched_episodes')
        .select('*')
        .order('id')
        .range(i * pageSize, i * pageSize + pageSize - 1)
    )
  );
  const all: WatchedEpisode[] = [];
  for (const { data, error } of results) {
    throwIfError(error);
    all.push(...((data ?? []) as WatchedEpisode[]));
  }
  return all;
}

export async function markEpisode(
  tmdbShowId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<void> {
  const { error } = await supabase.from('watched_episodes').upsert(
    {
      tmdb_show_id: tmdbShowId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
    },
    {
      onConflict: 'user_id,tmdb_show_id,season_number,episode_number',
      ignoreDuplicates: true,
    }
  );
  throwIfError(error);
}

export async function unmarkEpisode(
  tmdbShowId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<void> {
  const { error } = await supabase
    .from('watched_episodes')
    .delete()
    .eq('tmdb_show_id', tmdbShowId)
    .eq('season_number', seasonNumber)
    .eq('episode_number', episodeNumber);
  throwIfError(error);
}

export async function markEpisodesBulk(
  episodes: {
    tmdb_show_id: number;
    season_number: number;
    episode_number: number;
  }[]
): Promise<void> {
  const chunkSize = 500;
  for (let i = 0; i < episodes.length; i += chunkSize) {
    const { error } = await supabase
      .from('watched_episodes')
      .upsert(episodes.slice(i, i + chunkSize), {
        onConflict: 'user_id,tmdb_show_id,season_number,episode_number',
        ignoreDuplicates: true,
      });
    throwIfError(error);
  }
}

// --- Films ------------------------------------------------------------------

export async function fetchMovies(): Promise<UserMovie[]> {
  // Supabase plafonne à 1000 lignes par requête → pagination parallèle.
  const pageSize = 1000;
  const { count, error: countError } = await supabase
    .from('user_movies')
    .select('*', { count: 'exact', head: true });
  throwIfError(countError);
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase
        .from('user_movies')
        .select('*')
        .order('added_at', { ascending: false })
        .order('id', { ascending: false })
        .range(i * pageSize, i * pageSize + pageSize - 1)
    )
  );
  const all: UserMovie[] = [];
  for (const { data, error } of results) {
    throwIfError(error);
    all.push(...((data ?? []) as UserMovie[]));
  }
  return all;
}

export async function addMovie(movie: {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  status?: MovieStatus;
}): Promise<void> {
  const { error } = await supabase.from('user_movies').upsert(
    {
      ...movie,
      watched_at: movie.status === 'watched' ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,tmdb_id', ignoreDuplicates: false }
  );
  throwIfError(error);
}

export async function setMovieStatus(
  tmdbId: number,
  status: MovieStatus
): Promise<void> {
  const { error } = await supabase
    .from('user_movies')
    .update({
      status,
      watched_at: status === 'watched' ? new Date().toISOString() : null,
    })
    .eq('tmdb_id', tmdbId);
  throwIfError(error);
}

export async function setMovieRating(
  tmdbId: number,
  rating: number | null
): Promise<void> {
  const { error } = await supabase
    .from('user_movies')
    .update({ rating })
    .eq('tmdb_id', tmdbId);
  throwIfError(error);
}

export async function removeMovie(tmdbId: number): Promise<void> {
  const { error } = await supabase
    .from('user_movies')
    .delete()
    .eq('tmdb_id', tmdbId);
  throwIfError(error);
}
