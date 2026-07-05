#!/usr/bin/env node
// Annule EXACTEMENT le delta appliqué par verify-movies.mjs --fix, en se
// basant sur le rapport écrit par ce même run (verify-movies-report.txt) :
//   - supprime les films de la section MANQUANTS (ils n'existaient pas avant
//     le --fix : leur suppression est un retour arrière exact) ;
//   - ré-insère les films de la section SUSPECTS (affiche re-résolue via TMDB
//     par id ; la date de visionnage d'origine est perdue → date du jour).
//
// Usage :
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… TMDB_TOKEN=… \
//   node scripts/rollback-movies.mjs [chemin/du/rapport] [--apply]
//
// Sans --apply : affiche ce qui serait fait. Idempotent (upsert + delete par id).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TMDB_TOKEN = process.env.TMDB_TOKEN ?? '';
if (!SUPABASE_URL || !SERVICE_KEY || !TMDB_TOKEN) {
  console.error('Variables requises : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_TOKEN');
  process.exit(1);
}
const APPLY = process.argv.includes('--apply');
const reportPath =
  process.argv.slice(2).find((a) => a !== '--apply') ??
  new URL('../verify-movies-report.txt', import.meta.url).pathname;

const report = readFileSync(reportPath, 'utf8');

// --- Parse du rapport ---------------------------------------------------------
const section = (name, next) => {
  const start = report.indexOf(name);
  if (start === -1) return '';
  const end = next ? report.indexOf(next, start) : report.length;
  return report.slice(start, end === -1 ? report.length : end);
};

// SUSPECTS : `· source « X » → en base : « Titre » (tmdb 123) …`
const suspects = [];
for (const line of section('SUSPECTS', 'MANQUANTS').split('\n')) {
  const m = line.match(/en base : « (.+?) » \(tmdb (\d+)\)/);
  if (m) suspects.push({ tmdbId: Number(m[2]), title: m[1] });
}
// MANQUANTS : `· Titre (tmdb 123)`
const added = [];
for (const line of section('MANQUANTS', 'TITRES SOURCE').split('\n')) {
  const m = line.match(/^· (.+) \(tmdb (\d+)\)$/);
  if (m) added.push({ tmdbId: Number(m[2]), title: m[1] });
}

console.log(`Rapport : ${reportPath}`);
console.log(`À SUPPRIMER (ajoutés par --fix) : ${added.length}`);
console.log(`À RÉ-INSÉRER (supprimés par --fix) : ${suspects.length}`);
if (!APPLY) {
  console.log('\nAperçu (10 premiers de chaque) :');
  added.slice(0, 10).forEach((a) => console.log(`  − ${a.title} (${a.tmdbId})`));
  suspects.slice(0, 10).forEach((s) => console.log(`  + ${s.title} (${s.tmdbId})`));
  console.log('\nDry-run : rien modifié. Relance avec --apply pour annuler le --fix.');
  process.exit(0);
}

// --- Application ---------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const { data: users, error: userError } = await supabase
  .from('user_movies')
  .select('user_id')
  .limit(1000);
if (userError) throw new Error(userError.message);
const userIds = new Set((users ?? []).map((u) => u.user_id));
if (userIds.size > 1) {
  console.error('Annulé : plusieurs utilisateurs en base.');
  process.exit(1);
}
const userId = [...userIds][0];

console.log('\nSuppression des films ajoutés par --fix…');
for (const a of added) {
  const { error } = await supabase
    .from('user_movies')
    .delete()
    .eq('tmdb_id', a.tmdbId);
  console.log(error ? `  ✗ ${a.title}: ${error.message}` : `  ✓ − ${a.title}`);
}

console.log('\nRé-insertion des films supprimés par --fix…');
for (const s of suspects) {
  // Affiche re-résolue par id (fiable : pas de recherche par titre).
  let poster = null;
  try {
    const url = new URL(`https://api.themoviedb.org/3/movie/${s.tmdbId}`);
    url.searchParams.set('language', 'fr-FR');
    const headers = { accept: 'application/json' };
    if (TMDB_TOKEN.includes('.')) headers.Authorization = `Bearer ${TMDB_TOKEN}`;
    else url.searchParams.set('api_key', TMDB_TOKEN);
    const res = await fetch(url, { headers });
    if (res.ok) poster = (await res.json()).poster_path ?? null;
  } catch {
    // affiche indisponible : tant pis
  }
  const { error } = await supabase.from('user_movies').upsert(
    {
      user_id: userId,
      tmdb_id: s.tmdbId,
      title: s.title,
      poster_path: poster,
      status: 'watched',
      watched_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,tmdb_id', ignoreDuplicates: true }
  );
  console.log(error ? `  ✗ ${s.title}: ${error.message}` : `  ✓ + ${s.title}`);
}
console.log('\nRollback terminé — état d\'avant le --fix restauré.');
