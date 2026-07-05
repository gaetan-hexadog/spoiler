import { supabase } from './supabase';

// Les requêtes TMDB passent par l'Edge Function « tmdb-proxy » : le jeton
// TMDB vit côté serveur (secret Supabase), plus jamais dans le bundle client.
const PROXY_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/tmdb-proxy`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const LANG = 'fr-FR';

export interface TmdbShowSummary {
  id: number;
  name: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date?: string;
  vote_average: number;
}

export interface TmdbSeasonSummary {
  id: number;
  season_number: number;
  episode_count: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
}

export interface TmdbEpisode {
  id: number;
  season_number: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
  vote_average: number;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

export interface TmdbCountryProviders {
  link: string;
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
}

export interface TmdbWatchProviders {
  results: Record<string, TmdbCountryProviders>;
}

export interface TmdbVideo {
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

/** Première bande-annonce YouTube disponible. */
export function findTrailer(
  videos: { results: TmdbVideo[] } | undefined
): TmdbVideo | undefined {
  const list = (videos?.results ?? []).filter((v) => v.site === 'YouTube');
  return (
    list.find((v) => v.type === 'Trailer' && v.official) ??
    list.find((v) => v.type === 'Trailer') ??
    list.find((v) => v.type === 'Teaser')
  );
}

export interface TmdbShowDetails extends TmdbShowSummary {
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: TmdbSeasonSummary[];
  next_episode_to_air: TmdbEpisode | null;
  last_episode_to_air: TmdbEpisode | null;
  episode_run_time: number[];
  genres: { id: number; name: string }[];
  status: string;
  in_production: boolean;
  credits?: { cast: TmdbCastMember[] };
  'watch/providers'?: TmdbWatchProviders;
  videos?: { results: TmdbVideo[] };
}

export interface TmdbSeasonDetails {
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episodes: TmdbEpisode[];
}

export interface TmdbMovieSummary {
  id: number;
  title: string;
  original_title?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  vote_average: number;
}

export interface TmdbMovieDetails extends TmdbMovieSummary {
  runtime: number | null;
  genres: { id: number; name: string }[];
  status: string;
  credits?: { cast: TmdbCastMember[] };
  'watch/providers'?: TmdbWatchProviders;
  videos?: { results: TmdbVideo[] };
}

export interface Paginated<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

async function tmdb<T>(
  path: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const url = new URL(PROXY_URL);
  url.searchParams.set('path', path);
  url.searchParams.set('language', LANG);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  // Le proxy exige un utilisateur connecté (tous les écrans TMDB sont
  // derrière l'auth, la session est donc toujours là).
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error('Connexion requise pour charger le catalogue.');
  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!res.ok) {
    throw new Error(`TMDB ${res.status} sur ${path}`);
  }
  return (await res.json()) as T;
}

export function getTrendingShows(page = 1) {
  return tmdb<Paginated<TmdbShowSummary>>('/trending/tv/week', { page });
}

export function getTrendingMovies(page = 1) {
  return tmdb<Paginated<TmdbMovieSummary>>('/trending/movie/week', { page });
}

export function getTopRatedShows(page = 1) {
  return tmdb<Paginated<TmdbShowSummary>>('/tv/top_rated', { page });
}

export function getNowPlayingMovies(page = 1) {
  return tmdb<Paginated<TmdbMovieSummary>>('/movie/now_playing', {
    page,
    region: 'FR',
  });
}

export function searchShows(query: string, page = 1) {
  return tmdb<Paginated<TmdbShowSummary>>('/search/tv', { query, page });
}

export function searchMovies(query: string, page = 1) {
  return tmdb<Paginated<TmdbMovieSummary>>('/search/movie', { query, page });
}

export function getShowDetails(id: number) {
  return tmdb<TmdbShowDetails>(`/tv/${id}`, {
    append_to_response: 'credits,watch/providers,videos',
  });
}

export function getShowRecommendations(id: number, page = 1) {
  return tmdb<Paginated<TmdbShowSummary>>(`/tv/${id}/recommendations`, {
    page,
  });
}

export function getMovieRecommendations(id: number, page = 1) {
  return tmdb<Paginated<TmdbMovieSummary>>(`/movie/${id}/recommendations`, {
    page,
  });
}

export interface TmdbPersonCredit {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  character?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  popularity: number;
  vote_count: number;
}

export interface TmdbPersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  combined_credits?: { cast: TmdbPersonCredit[] };
}

export function getPersonDetails(id: number) {
  return tmdb<TmdbPersonDetails>(`/person/${id}`, {
    append_to_response: 'combined_credits',
  });
}

export function getSeasonDetails(showId: number, seasonNumber: number) {
  return tmdb<TmdbSeasonDetails>(`/tv/${showId}/season/${seasonNumber}`);
}

export function getMovieDetails(id: number) {
  return tmdb<TmdbMovieDetails>(`/movie/${id}`, {
    append_to_response: 'credits,watch/providers,videos',
  });
}

export function imageUrl(
  path: string | null | undefined,
  size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'
): string | undefined {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
}
