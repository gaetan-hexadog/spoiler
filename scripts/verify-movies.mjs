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

const args = process.argv
  .slice(2)
  .filter((a) => a !== '--fix' && a !== '--add-missing');
const FIX = process.argv.includes('--fix'); // supprime les suspects
const ADD = process.argv.includes('--add-missing'); // ajoute les manquants vérifiés
if (!args.length) {
  console.error(
    'Usage: node scripts/verify-movies.mjs <netflix.csv> [tvtime-v1.csv] [--fix] [--add-missing]'
  );
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

// → [{ title, maxYear }] : la date de visionnage borne l'année de sortie
// (un film vu en 2023 ne peut pas être un homonyme sorti en 2025).
function moviesFromNetflix(text) {
  const rows = parseCsv(text);
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const ti = Math.max(0, header.findIndex((c) => ['title', 'titre', 'título'].includes(c)));
  const di = header.findIndex((c) => c === 'date');
  const byTitle = new Map();
  // Déchets évidents : un « titre » réduit à « Episode N » / « Chapter N »
  // (lignes d'épisodes cassées) ne doit JAMAIS devenir un candidat film.
  const JUNK_RE = /(^|:)\s*(épisode|episode|chapitre|chapter|part|partie|folge)\s*\d+\s*$/i;
  for (const row of rows.slice(1)) {
    const title = (row[ti] ?? '').trim();
    if (!title || isNetflixEpisode(title) || JUNK_RE.test(title)) continue;
    // Date « M/D/YY » (export US) → année pleine.
    let maxYear;
    if (di !== -1) {
      const m = (row[di] ?? '').trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (m) {
        const yy = Number(m[3]);
        maxYear = yy < 100 ? 2000 + yy : yy;
      }
    }
    const prev = byTitle.get(title);
    // Garder la date de visionnage la plus ANCIENNE (borne la plus stricte).
    if (!prev || (maxYear && (!prev.maxYear || maxYear < prev.maxYear))) {
      byTitle.set(title, { title, maxYear });
    }
  }
  return [...byTitle.values()];
}

// → [{ title, year }] : le v1 fournit release_date (2 490/2 500 lignes) —
// titre + année = quasi zéro homonyme.
function moviesFromTvTimeV1(text) {
  const rows = parseCsv(text);
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const typeI = header.indexOf('type');
  const entityI = header.indexOf('entity_type');
  const movieI = header.indexOf('movie_name');
  const releaseI = header.indexOf('release_date');
  if (movieI === -1) return [];
  const byTitle = new Map();
  for (const row of rows.slice(1)) {
    if (typeI !== -1 && !(row[typeI] ?? '').includes('watch')) continue;
    if (entityI !== -1 && (row[entityI] ?? '') !== 'movie') continue;
    const title = (row[movieI] ?? '').trim();
    if (!title || byTitle.has(title)) continue;
    let year;
    if (releaseI !== -1) {
      const m = (row[releaseI] ?? '').match(/^(\d{4})-/);
      if (m && m[1] !== '0001') year = Number(m[1]);
    }
    byTitle.set(title, { title, year });
  }
  return [...byTitle.values()];
}

// --- TMDB (direct : script local, jeton depuis l'env) -----------------------

async function tmdbSearch(title, lang = 'fr-FR', year = null) {
  const url = new URL('https://api.themoviedb.org/3/search/movie');
  url.searchParams.set('language', lang);
  url.searchParams.set('query', title);
  if (year) url.searchParams.set('primary_release_year', String(year));
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

function releaseYear(m) {
  const y = Number.parseInt((m.release_date ?? '').slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

// Titre exact + contraintes d'année : `year` = année de sortie connue (±2),
// `maxYear` = borne (film vu cette année-là → sorti au plus tard cette année).
function newMatch(wanted, results, { year = null, maxYear = null } = {}) {
  return (
    results.slice(0, 8).find((m) => {
      const okTitle =
        titlesMatch(wanted, normalize(m.title ?? '')) ||
        titlesMatch(wanted, normalize(m.original_title ?? ''));
      if (!okTitle) return false;
      const ry = releaseYear(m);
      if (year != null && ry != null && Math.abs(ry - year) > 2) return false;
      if (maxYear != null && ry != null && ry > maxYear) return false;
      return true;
    }) ?? null
  );
}

/** Résolution sûre d'une entrée source { title, year?, maxYear? }. */
async function resolveEntry(entry, broadResults) {
  const wanted = normalize(entry.title);
  const constraints = { year: entry.year ?? null, maxYear: entry.maxYear ?? null };
  // 1) recherche large fr (déjà faite pour oldPick)
  let good = newMatch(wanted, broadResults, constraints);
  // 2) année connue : recherches restreintes par année (rattrape les titres
  //    hors du top-8 de la recherche large)
  if (!good && entry.year) {
    for (const y of [entry.year, entry.year - 1, entry.year + 1]) {
      const results = await tmdbSearch(entry.title, 'fr-FR', y);
      good = newMatch(wanted, results, constraints);
      if (good) break;
    }
  }
  // 3) repli anglais (sources Netflix en anglais)
  if (!good) {
    const resultsEn = await tmdbSearch(entry.title, 'en-US');
    good = newMatch(wanted, resultsEn, constraints);
  }
  return good;
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

const byTitle = new Map(); // titre → { title, year?, maxYear? }
for (const file of args) {
  const text = readFileSync(file, 'utf8');
  const header = text.slice(0, 400).toLowerCase();
  const entries = header.includes('movie_name')
    ? moviesFromTvTimeV1(text)
    : moviesFromNetflix(text);
  console.log(`${file} → ${entries.length} titres de films`);
  for (const e of entries) {
    const prev = byTitle.get(e.title);
    // L'année de sortie (TV Time) prime sur la simple borne (Netflix).
    if (!prev || (e.year && !prev.year)) byTitle.set(e.title, { ...prev, ...e });
  }
}
const uniqueEntries = [...byTitle.values()];
console.log(`Total unique : ${uniqueEntries.length} titres (${uniqueEntries.filter((e) => e.year).length} avec année de sortie)\n`);

const dbMovies = await fetchAllMovies();
const dbById = new Map(dbMovies.map((m) => [m.tmdb_id, m]));
console.log(`Base : ${dbMovies.length} films\n`);

const suspects = []; // { source, wrongId, wrongTitle, rightId, rightTitle, row }
const unresolved = []; // titres source sans correspondance sûre
// Toute ligne DB confirmée par AU MOINS UN titre source est exonérée : une
// ligne peut être le mauvais choix d'un titre ET le bon choix d'un autre
// (doublons Netflix/TV Time, titres localisés). On garde aussi le détail
// pour AJOUTER tout film vérifié absent de la base (raté par l'ancien import).
const verified = new Map(); // id → { id, title, poster_path }
let okCount = 0;
let done = 0;

const CONCURRENCY = 6;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async (_, w) => {
    for (let i = w; i < uniqueEntries.length; i += CONCURRENCY) {
      const entry = uniqueEntries[i];
      done++;
      if (done % 200 === 0) console.log(`… ${done}/${uniqueEntries.length}`);
      let results;
      try {
        results = await tmdbSearch(entry.title, 'fr-FR');
      } catch {
        unresolved.push(`${entry.title} (erreur TMDB)`);
        continue;
      }
      const oldPick = results[0] ?? null; // ce que faisaient les imports
      let good = null;
      try {
        good = await resolveEntry(entry, results);
      } catch {
        // erreurs des recherches complémentaires : on reste prudent (null)
      }
      if (good) {
        if (!verified.has(good.id)) {
          verified.set(good.id, {
            id: good.id,
            title: good.title,
            poster_path: good.poster_path ?? null,
          });
        }
      } else {
        unresolved.push(
          entry.year ? `${entry.title} (${entry.year})` : entry.title
        );
      }
      if (!oldPick) continue;
      const inDb = dbById.get(oldPick.id);
      if (!inDb) continue; // l'ancien choix n'est pas en base → rien à nettoyer
      if (good && good.id === oldPick.id) { okCount++; continue; }
      suspects.push({
        source: entry.title,
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

// Exonérer les lignes confirmées ailleurs, puis dédoublonner par wrongId.
const byWrong = new Map();
for (const s of suspects) {
  if (verified.has(s.wrongId)) continue; // confirmée par un autre titre
  if (!byWrong.has(s.wrongId)) byWrong.set(s.wrongId, s);
}
const finalSuspects = [...byWrong.values()];

// Films vérifiés ABSENTS de la base : ratés par l'ancien import (erreur,
// mauvaise ligne déjà nettoyée…) — à ajouter. Couvre aussi le cas de deux
// titres mal liés vers le même mauvais film (un seul suspect conservé, mais
// les DEUX bons films finissent ici s'ils manquent).
const missing = [...verified.values()].filter((v) => !dbById.has(v.id));

console.log(`\n=== RÉSULTAT ===`);
console.log(`Bien liés (vérifiés) : ${okCount}`);
console.log(`SUSPECTS en base (à supprimer) : ${finalSuspects.length}`);
console.log(`MANQUANTS vérifiés (à ajouter) : ${missing.length}`);
console.log(`Titres source sans correspondance sûre : ${unresolved.length}`);

const lines = [];
lines.push('SUSPECTS (mauvais film probablement lié — supprimés par --fix) :');
for (const s of finalSuspects) {
  lines.push(
    `· source « ${s.source} » → en base : « ${s.wrongTitle} » (tmdb ${s.wrongId})` +
      (s.rightTitle ? ` → correct : « ${s.rightTitle} » (tmdb ${s.rightId})` : ' → aucun candidat sûr')
  );
}
lines.push('', 'MANQUANTS (films vérifiés absents de la base — ajoutés par --fix) :');
for (const m of missing) lines.push(`· ${m.title} (tmdb ${m.id})`);
lines.push('', 'TITRES SOURCE SANS CORRESPONDANCE SÛRE (à traiter à la main) :');
for (const t of unresolved) lines.push(`· ${t}`);
const reportPath = new URL('../verify-movies-report.txt', import.meta.url).pathname;
writeFileSync(reportPath, lines.join('\n'));
console.log(`\nRapport complet : ${reportPath}`);
console.log(finalSuspects.slice(0, 20).map((s) => `· « ${s.source} » → base « ${s.wrongTitle} »${s.rightTitle ? ` → correct « ${s.rightTitle} »` : ''}`).join('\n'));

if ((FIX && finalSuspects.length) || (ADD && missing.length)) {
  // Garde multi-comptes : ce script opère avec la clé service (tous les
  // utilisateurs) — on n'écrit que si la base ne contient qu'un seul user.
  const userIds = new Set(dbMovies.map((m) => m.user_id));
  if (userIds.size > 1) {
    console.error('\nÉcriture refusée : plusieurs utilisateurs en base.');
    process.exit(1);
  }
  const userId = dbMovies[0]?.user_id;
  // Dates héritées des lignes remplacées (le bon film garde la date du faux).
  const dateFor = new Map();
  for (const s of finalSuspects) {
    if (s.rightId && s.row.watched_at) dateFor.set(s.rightId, s.row.watched_at);
  }

  if (FIX) {
    console.log('\n--fix : suppression des suspects…');
    for (const s of finalSuspects) {
      const { error: delError } = await supabase
        .from('user_movies')
        .delete()
        .eq('id', s.row.id);
      if (delError) console.error(`  ✗ ${s.wrongTitle}: ${delError.message}`);
      else console.log(`  ✓ supprimé « ${s.wrongTitle} »`);
    }
  }

  if (ADD) {
    console.log('\n--add-missing : ajout des manquants vérifiés…');
    for (const m of missing) {
      // upsert + contrainte unique (user_id, tmdb_id) : aucun doublon
      // possible, même relancé ; une ligne existante n'est jamais modifiée.
      const { error: insError } = await supabase.from('user_movies').upsert(
        {
          user_id: userId,
          tmdb_id: m.id,
          title: m.title,
          poster_path: m.poster_path,
          status: 'watched',
          watched_at: dateFor.get(m.id) ?? new Date().toISOString(),
        },
        { onConflict: 'user_id,tmdb_id', ignoreDuplicates: true }
      );
      if (insError) console.error(`  ✗ ${m.title}: ${insError.message}`);
      else console.log(`  ✓ ajouté « ${m.title} »`);
    }
  }
  console.log('\nTerminé. Relançable sans risque (idempotent).');
} else if (finalSuspects.length || missing.length) {
  console.log(
    '\nDry-run : rien modifié. --fix = supprimer les suspects · --add-missing = ajouter les manquants.'
  );
}
