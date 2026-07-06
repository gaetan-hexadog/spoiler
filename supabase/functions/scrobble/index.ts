// Edge Function « scrobble » : reçoit les webhooks des serveurs média et
// marque films/épisodes vus. Déployée SANS verify_jwt (les serveurs média
// n'envoient pas de JWT) : l'authentification passe par le jeton d'URL
// (?key=…) généré par create_scrobble_token().
//
// Sources supportées (détection automatique du payload) :
//  - Plex (webhooks Plex Pass)   : multipart/form-data, champ « payload »,
//    événement media.scrobble, GUIDs tmdb/tvdb/imdb.
//  - Jellyfin (plugin Webhook, « Send All Properties ») : JSON,
//    NotificationType=PlaybackStop + PlayedToCompletion, Provider_*.
//  - Tautulli (webhook JSON personnalisé, cf. gabarit dans l'app) :
//    { source:"tautulli", media_type, tmdb_id, tvdb_id, imdb_id,
//      season, episode }.
//
// Résolution par IDENTIFIANTS uniquement (tmdb direct, ou tvdb/imdb via
// /find TMDB) — jamais par titre : pas de faux positifs.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const TMDB = 'https://api.themoviedb.org/3';

function tmdbHeaders(): { headers: Record<string, string>; keyParam: string | null } {
  const token = Deno.env.get('TMDB_TOKEN') ?? '';
  if (token.includes('.')) {
    return { headers: { accept: 'application/json', Authorization: `Bearer ${token}` }, keyParam: null };
  }
  return { headers: { accept: 'application/json' }, keyParam: token };
}

async function tmdbGet(path: string, params: Record<string, string> = {}) {
  const { headers, keyParam } = tmdbHeaders();
  const url = new URL(`${TMDB}${path}`);
  url.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (keyParam) url.searchParams.set('api_key', keyParam);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status} sur ${path}`);
  return await res.json();
}

interface Scrobble {
  kind: 'movie' | 'episode';
  tmdbMovieId?: number; // films : id TMDB direct
  // épisodes : identifiants de L'ÉPISODE (résolus via /find)
  tvdbEpisodeId?: string;
  imdbEpisodeId?: string;
  // films sans tmdb : repli imdb
  imdbMovieId?: string;
}

/** GUIDs Plex « tmdb://123 » / Provider_* Jellyfin → Scrobble normalisé. */
function fromIds(
  kind: 'movie' | 'episode',
  ids: { tmdb?: string; tvdb?: string; imdb?: string }
): Scrobble | null {
  if (kind === 'movie') {
    if (ids.tmdb) return { kind, tmdbMovieId: Number(ids.tmdb) };
    if (ids.imdb) return { kind, imdbMovieId: ids.imdb };
    return null;
  }
  if (ids.tvdb) return { kind, tvdbEpisodeId: ids.tvdb };
  if (ids.imdb) return { kind, imdbEpisodeId: ids.imdb };
  return null;
}

function parsePlexGuids(metadata: { Guid?: { id?: string }[] }) {
  const ids: { tmdb?: string; tvdb?: string; imdb?: string } = {};
  for (const g of metadata.Guid ?? []) {
    const m = (g.id ?? '').match(/^(tmdb|tvdb|imdb):\/\/(.+)$/);
    if (m) ids[m[1] as 'tmdb' | 'tvdb' | 'imdb'] = m[2];
  }
  return ids;
}

/** Payload (déjà décodé) → Scrobble ou null (événement à ignorer). */
function parsePayload(payload: Record<string, unknown>): Scrobble | null | 'ignored' {
  // --- Plex ---
  if (typeof payload.event === 'string' && payload.Metadata) {
    if (payload.event !== 'media.scrobble') return 'ignored';
    const metadata = payload.Metadata as Record<string, unknown>;
    const type = metadata.type;
    if (type !== 'movie' && type !== 'episode') return 'ignored';
    return fromIds(type, parsePlexGuids(metadata as { Guid?: { id?: string }[] }));
  }
  // --- Jellyfin (plugin Webhook, Send All Properties) ---
  if (typeof payload.NotificationType === 'string') {
    if (payload.NotificationType !== 'PlaybackStop') return 'ignored';
    if (payload.PlayedToCompletion !== true) return 'ignored';
    const itemType = payload.ItemType;
    if (itemType === 'Movie') {
      return fromIds('movie', {
        tmdb: payload.Provider_tmdb as string | undefined,
        imdb: payload.Provider_imdb as string | undefined,
      });
    }
    if (itemType === 'Episode') {
      return fromIds('episode', {
        tvdb: payload.Provider_tvdb as string | undefined,
        imdb: payload.Provider_imdb as string | undefined,
      });
    }
    return 'ignored';
  }
  // --- Tautulli (gabarit fourni dans l'app) ---
  if (payload.source === 'tautulli') {
    const type = payload.media_type;
    if (type === 'movie') {
      return fromIds('movie', {
        tmdb: payload.tmdb_id ? String(payload.tmdb_id) : undefined,
        imdb: payload.imdb_id ? String(payload.imdb_id) : undefined,
      });
    }
    if (type === 'episode') {
      return fromIds('episode', {
        tvdb: payload.tvdb_id ? String(payload.tvdb_id) : undefined,
        imdb: payload.imdb_id ? String(payload.imdb_id) : undefined,
      });
    }
    return 'ignored';
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'méthode invalide' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Authentification par jeton d'URL.
  const key = new URL(req.url).searchParams.get('key') ?? '';
  if (key.length < 32) return json({ error: 'jeton manquant' }, 401);
  const { data: tokenRow } = await admin
    .from('scrobble_tokens')
    .select('user_id')
    .eq('token', key)
    .maybeSingle();
  if (!tokenRow) return json({ error: 'jeton inconnu' }, 401);
  const userId = tokenRow.user_id as string;

  // Décodage du corps : Plex = multipart (champ payload), sinon JSON.
  let payload: Record<string, unknown>;
  const contentType = req.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      payload = JSON.parse(String(form.get('payload') ?? '{}'));
    } else {
      payload = await req.json();
    }
  } catch {
    return json({ error: 'payload illisible' }, 400);
  }

  const scrobble = parsePayload(payload);
  if (scrobble === 'ignored') return json({ ok: true, ignored: true });
  if (!scrobble) return json({ error: 'payload non reconnu ou sans identifiants' }, 400);

  admin
    .from('scrobble_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .then(() => {});

  try {
    if (scrobble.kind === 'movie') {
      // id TMDB direct, ou /find via imdb.
      let movieId = scrobble.tmdbMovieId ?? null;
      if (!movieId && scrobble.imdbMovieId) {
        const found = await tmdbGet(`/find/${scrobble.imdbMovieId}`, {
          external_source: 'imdb_id',
        });
        movieId = found.movie_results?.[0]?.id ?? null;
      }
      if (!movieId) return json({ error: 'film non identifiable' }, 422);
      const movie = await tmdbGet(`/movie/${movieId}`);
      const { error } = await admin.from('user_movies').upsert(
        {
          user_id: userId,
          tmdb_id: movieId,
          title: movie.title ?? `Film ${movieId}`,
          poster_path: movie.poster_path ?? null,
          status: 'watched',
          watched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,tmdb_id', ignoreDuplicates: false }
      );
      if (error) throw new Error(error.message);
      return json({ ok: true, movie: movie.title });
    }

    // Épisode : /find (tvdb ou imdb de l'épisode) → show_id + S/E TMDB.
    const [externalId, source] = scrobble.tvdbEpisodeId
      ? [scrobble.tvdbEpisodeId, 'tvdb_id']
      : [scrobble.imdbEpisodeId!, 'imdb_id'];
    const found = await tmdbGet(`/find/${externalId}`, {
      external_source: source,
    });
    const episode = found.tv_episode_results?.[0];
    if (!episode?.show_id) return json({ error: 'épisode non identifiable' }, 422);

    const show = await tmdbGet(`/tv/${episode.show_id}`);
    const { error: showError } = await admin.from('tracked_shows').upsert(
      {
        user_id: userId,
        tmdb_id: episode.show_id,
        name: show.name ?? `Série ${episode.show_id}`,
        poster_path: show.poster_path ?? null,
        backdrop_path: show.backdrop_path ?? null,
        status: 'watching',
      },
      { onConflict: 'user_id,tmdb_id', ignoreDuplicates: true }
    );
    if (showError) throw new Error(showError.message);
    const { error: epError } = await admin.from('watched_episodes').upsert(
      {
        user_id: userId,
        tmdb_show_id: episode.show_id,
        season_number: episode.season_number,
        episode_number: episode.episode_number,
      },
      {
        onConflict: 'user_id,tmdb_show_id,season_number,episode_number',
        ignoreDuplicates: true,
      }
    );
    if (epError) throw new Error(epError.message);
    return json({
      ok: true,
      show: show.name,
      episode: `S${episode.season_number}E${episode.episode_number}`,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'échec du scrobble' },
      500
    );
  }
});
