// Edge Function « pair-device » : l'app (authentifiée) valide un code
// d'association affiché par Kodi. On génère un jeton magiclink à usage
// unique pour l'utilisateur et on le dépose dans device_links — l'appareil
// l'échangera contre sa propre session Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'méthode invalide' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user?.email) {
    return json({ error: 'non authentifié' }, 401);
  }

  const { code, tmdb_token } = await req.json().catch(() => ({}));
  const normalized = String(code ?? '').trim().toUpperCase();
  if (normalized.length !== 6) return json({ error: 'code invalide' }, 400);

  const { data: link } = await admin
    .from('device_links')
    .select('*')
    .eq('code', normalized)
    .maybeSingle();
  const expired =
    !link ||
    new Date(link.created_at).getTime() < Date.now() - 10 * 60 * 1000;
  if (expired || link.claimed) {
    return json({ error: 'code inconnu ou expiré — régénère-le sur Kodi' }, 400);
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
    });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return json({ error: linkError?.message ?? 'génération impossible' }, 500);
  }

  const { error: updateError } = await admin
    .from('device_links')
    .update({
      claimed: true,
      token_hash: tokenHash,
      // Jeton TMDB pour le plugin Kodi : injecté depuis le secret serveur
      // (le bundle de l'app ne contient plus de jeton TMDB). Le champ client
      // reste en repli pour d'anciens builds.
      payload: {
        tmdb_token: Deno.env.get('TMDB_TOKEN') ?? tmdb_token ?? null,
      },
    })
    .eq('code', normalized);
  if (updateError) return json({ error: updateError.message }, 500);

  return json({ ok: true });
});
