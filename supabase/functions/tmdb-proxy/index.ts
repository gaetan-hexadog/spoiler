// Edge Function « tmdb-proxy » : relaie les requêtes TMDB pour les
// utilisateurs AUTHENTIFIÉS. Le jeton TMDB vit ici (secret TMDB_TOKEN),
// plus jamais dans le bundle client — il ne peut donc plus être extrait
// de l'app ni abusé hors quota.
//
//   GET /tmdb-proxy?path=/trending/tv/week&page=2&language=fr-FR
//
// Garde-fous : GET uniquement, chemin allowlisté (segments API v3 simples),
// paramètres de requête filtrés.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

// Chemins TMDB v3 autorisés : lettres/chiffres/underscore/tirets et « / ».
const PATH_RE = /^\/[a-z0-9_/-]+$/;
// Paramètres transmis tels quels (le reste est ignoré).
const ALLOWED_PARAMS = new Set([
  'language',
  'page',
  'region',
  'query',
  'append_to_response',
  'include_adult',
  'primary_release_year',
  'year',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return json({ error: 'méthode invalide' }, 405);

  // Authentification : un vrai utilisateur connecté, pas juste l'anon key.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) {
    return json({ error: 'non authentifié' }, 401);
  }

  const token = Deno.env.get('TMDB_TOKEN') ?? '';
  if (!token) return json({ error: 'TMDB_TOKEN manquant côté serveur' }, 500);

  const incoming = new URL(req.url);
  const path = incoming.searchParams.get('path') ?? '';
  if (!PATH_RE.test(path)) return json({ error: 'chemin invalide' }, 400);

  const target = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [key, value] of incoming.searchParams) {
    if (ALLOWED_PARAMS.has(key)) target.searchParams.set(key, value);
  }

  // Jeton v4 (JWT, contient des points) → header ; clé v3 → api_key.
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token.includes('.')) headers.Authorization = `Bearer ${token}`;
  else target.searchParams.set('api_key', token);

  const upstream = await fetch(target.toString(), { headers });
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json',
      // Catalogue public : cachable un moment côté CDN/client.
      'Cache-Control': 'public, max-age=300',
      ...cors,
    },
  });
});
