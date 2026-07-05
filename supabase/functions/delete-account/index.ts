// Edge Function « delete-account » : supprime définitivement le compte de
// l'utilisateur authentifié. La suppression du user d'auth cascade sur toutes
// ses données (profiles, tracked_shows, watched_episodes, user_movies,
// device_links — tous en `on delete cascade`).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'méthode invalide' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) {
    return json({ error: 'non authentifié' }, 401);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(
    userData.user.id
  );
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ ok: true });
});
