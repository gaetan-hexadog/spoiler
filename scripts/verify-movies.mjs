#!/usr/bin/env node
// Vérification des films importés (Netflix + TV Time) contre TMDB.
//
// Rejoue chaque titre source avec :
//   - l'ANCIEN matching (1er résultat de recherche — celui des imports fautifs)
//   - le NOUVEAU matching (titre exact parmi les 8 premiers, articles tolérés)
// puis croise avec la base : toute ligne user_movies issue d'un ancien
// matching divergent est un SUSPECT (mauvais film lié).
//
// Usage :
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… TMDB_TOKEN=… \
//   node scripts/verify-movies.mjs <netflix.csv> [tvtime-v1.csv] [--fix]
//
// Sans --fix : rapport seul (aucune écriture). Avec --fix : supprime les
// suspects et insère le bon film (statut « vu ») à la place.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TMDB_TOKEN = process.env.TMDB_TOKEN ?? '';
if (!SUPABASE_URL || !SERVICE_KEY || !TMDB_TOKEN) {
  console.error('Variables requises : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_TOKEN');
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a !== '--fix');
const FIX = process.argv.includes('--fix');
if (!args.length) {
  console.error('Usage: node scripts/verify-movies.mjs <netflix.csv> [tvtime-v1.csv] [--fix]');
  process.exit(1);
}

// --- Helpers copiés de lib/tvtime.ts / lib/netflix.ts / lib/match.ts -------
// (dupliqués : ces libs importent le client Supabase RN, inutilisable sous node)

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ',' || char === ';') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

const normalize = (v) =>
  v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const stripArticle = (n) =>
  n.replace(/^(le|la|les|l|the|a|an|el|los|las|der|die|das)\s+/, '');
const titlesMatch = (a, b) =>
  !!a && !!b && (a === b || stripArticle(a) === stripArticle(b));

// Classification de l'ANCIEN import (celle qui a créé les mauvaises lignes) :
// seuls les motifs saison/mini-série étaient reconnus comme épisodes — tout le
// reste (y compris « Émission: Titre d'épisode ») partait en recherche FILM.
// On rejoue exactement ça pour retrouver chaque lien fautif possible.
const SEASON_RE = /^(.*?):\s*(?:Saison|Season|Temporada|Staffel|Volume|Partie|Part|Chapitre|Chapter|Book|Livre)\s+(\d+)\s*:\s*(.*)$/i;
const PART_RE = /^(.*?):\s*(?:Limited Series|Miniseries|Mini-série|Miniserie)\b[^:]*:\s*(.*)$/i;
const isNetflixEpisode = (t) => SEASON_RE.test(t) || PART_RE.test(t);

// --- Extraction des titres de films des sources -----------------------------

function moviesFromNetflix(text) {
  const rows = parseCsv(text);
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const ti = Math.max(0, header.findIndex((c) => ['title', 'titre', 'título'].includes(c)));
  const titles = new Set();
  for (const row of rows.slice(1)) {
    const title = (row[ti] ?? '').trim();
    if (title && !isNetflixEpisode(title)) titles.add(title);
  }
  return [...titles];
}

function moviesFromTvTimeV1(text) {
  const rows = parseCsv(text);
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const typeI = header.indexOf('type');
  const entityI = header.indexOf('entity_type');
  const movieI = header.indexOf('movie_name');
  if (movieI === -1) return [];
  const titles = new Set();
  for (const row of rows.slice(1)) {
    if (typeI !== -1 && !(row[typeI] ?? '').includes('watch')) continue;
    if (entityI !== -1 && (row[entityI] ?? '') !== 'movie') continue;
    const title = (row[movieI] ?? '').trim();
    if (title) titles.add(title);
  }
  return [...titles];
}

// --- TMDB (direct : script local, jeton depuis l'env) -----------------------

async function tmdbSearch(title) {
  const url = new URL('https://api.themoviedb.org/3/search/movie');
  url.searchParams.set('language', 'fr-FR');
  url.searchParams.set('query', title);
  const headers = { accept: 'application/json' };
  if (TMDB_TOKEN.includes('.')) headers.Authorization = `Bearer ${TMDB_TOKEN}`;
  else url.searchParams.set('api_key', TMDB_TOKEN);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return (await res.json()).results ?? [];
  }
  throw new Error('TMDB rate limit');
}

function newMatch(wanted, results) {
  return (
    results.slice(0, 8).find(
      (m) =>
        titlesMatch(wanted, normalize(m.title ?? '')) ||
        titlesMatch(wanted, normalize(m.original_title ?? ''))
    ) ?? null
  );
}

// --- Main --------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function fetchAllMovies() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('user_movies')
      .select('*')
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

const sources = [];
for (const file of args) {
  const text = readFileSync(file, 'utf8');
  const header = text.slice(0, 400).toLowerCase();
  const titles = header.includes('movie_name')
    ? moviesFromTvTimeV1(text)
    : moviesFromNetflix(text);
  console.log(`${file} → ${titles.length} titres de films`);
  for (const t of titles) sources.push(t);
}
const uniqueTitles = [...new Set(sources)];
console.log(`Total unique : ${uniqueTitles.length} titres\n`);

const dbMovies = await fetchAllMovies();
const dbById = new Map(dbMovies.map((m) => [m.tmdb_id, m]));
console.log(`Base : ${dbMovies.length} films\n`);

const suspects = []; // { source, wrongId, wrongTitle, rightId, rightTitle, row }
const unresolved = []; // titres source sans correspondance sûre
let okCount = 0;
let done = 0;

const CONCURRENCY = 6;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async (_, w) => {
    for (let i = w; i < uniqueTitles.length; i += CONCURRENCY) {
      const title = uniqueTitles[i];
      done++;
      if (done % 200 === 0) console.log(`… ${done}/${uniqueTitles.length}`);
      let results;
      try {
        results = await tmdbSearch(title);
      } catch {
        unresolved.push(`${title} (erreur TMDB)`);
        continue;
      }
      const wanted = normalize(title);
      const oldPick = results[0] ?? null; // ce que faisaient les imports
      const good = newMatch(wanted, results);
      if (!good) unresolved.push(title);
      if (!oldPick) continue;
      const inDb = dbById.get(oldPick.id);
      if (!inDb) continue; // l'ancien choix n'est pas en base → rien à nettoyer
      if (good && good.id === oldPick.id) { okCount++; continue; }
      suspects.push({
        source: title,
        wrongId: oldPick.id,
        wrongTitle: oldPick.title,
        rightId: good?.id ?? null,
        rightTitle: good?.title ?? null,
        rightPoster: good?.poster_path ?? null,
        row: inDb,
      });
    }
  })
);

// Dédoublonner par wrongId (plusieurs titres source peuvent pointer au même).
const byWrong = new Map();
for (const s of suspects) if (!byWrong.has(s.wrongId)) byWrong.set(s.wrongId, s);
const finalSuspects = [...byWrong.values()];

console.log(`\n=== RÉSULTAT ===`);
console.log(`Bien liés (vérifiés) : ${okCount}`);
console.log(`SUSPECTS en base : ${finalSuspects.length}`);
console.log(`Titres source sans correspondance sûre : ${unresolved.length}`);

const lines = [];
lines.push('SUSPECTS (mauvais film probablement lié) :');
for (const s of finalSuspects) {
  lines.push(
    `· source « ${s.source} » → en base : « ${s.wrongTitle} » (tmdb ${s.wrongId})` +
      (s.rightTitle ? ` → correct : « ${s.rightTitle} » (tmdb ${s.rightId})` : ' → aucun candidat sûr')
  );
}
lines.push('', 'TITRES SOURCE SANS CORRESPONDANCE SÛRE (à traiter à la main) :');
for (const t of unresolved) lines.push(`· ${t}`);
const reportPath = new URL('../verify-movies-report.txt', import.meta.url).pathname;
writeFileSync(reportPath, lines.join('\n'));
console.log(`\nRapport complet : ${reportPath}`);
console.log(finalSuspects.slice(0, 20).map((s) => `· « ${s.source} » → base « ${s.wrongTitle} »${s.rightTitle ? ` → correct « ${s.rightTitle} »` : ''}`).join('\n'));

if (FIX && finalSuspects.length) {
  console.log('\n--fix : application…');
  for (const s of finalSuspects) {
    const { error: delError } = await supabase
      .from('user_movies')
      .delete()
      .eq('id', s.row.id);
    if (delError) { console.error(`  ✗ suppression ${s.wrongTitle}: ${delError.message}`); continue; }
    if (s.rightId && !dbById.has(s.rightId)) {
      const { error: insError } = await supabase.from('user_movies').upsert(
        {
          user_id: s.row.user_id,
          tmdb_id: s.rightId,
          title: s.rightTitle,
          poster_path: s.rightPoster,
          status: 'watched',
          watched_at: s.row.watched_at ?? new Date().toISOString(),
        },
        { onConflict: 'user_id,tmdb_id', ignoreDuplicates: true }
      );
      if (insError) { console.error(`  ✗ insertion ${s.rightTitle}: ${insError.message}`); continue; }
    }
    console.log(`  ✓ « ${s.wrongTitle} » → ${s.rightTitle ?? '(supprimé)'}`);
  }
  console.log('Terminé.');
} else if (finalSuspects.length) {
  console.log('\nDry-run : rien modifié. Relance avec --fix pour appliquer.');
}
