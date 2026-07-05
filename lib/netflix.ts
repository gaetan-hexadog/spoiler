// Parseur de l'export « Activité de visionnage » de Netflix.
// Fichier CSV avec deux colonnes : Title, Date.
// Les épisodes de séries ont un titre structuré :
//   « Nom de la série: Saison 4: Titre de l'épisode »  (compte FR)
//   « Show Name: Season 4: Episode Title »              (compte EN)
// Les films n'ont qu'un titre simple.
import { parseCsv } from './tvtime';

export interface NetflixEpisode {
  show: string;
  season: number;
  episodeTitle: string;
  /** Saison inconnue (titre « Émission: Épisode » sans segment saison). */
  seasonUnknown?: boolean;
  /** Titre Netflix brut — pour retenter en FILM si la série est rejetée. */
  raw?: string;
}

export interface NetflixParseResult {
  series: Map<string, NetflixEpisode[]>; // clé = nom de série
  movies: string[]; // titres de films (dédupliqués)
  skipped: number;
}

/** Normalise un titre pour comparaison tolérante (accents, ponctuation, casse). */
export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface ParsedTitle {
  kind: 'episode' | 'movie';
  show?: string;
  season?: number;
  episodeTitle?: string;
  title?: string;
}

// « … : Saison 4 : … » et variantes numérotées (Volume 3, Partie 2, Chapitre 1…)
const SEASON_RE =
  /^(.*?):\s*(?:Saison|Season|Temporada|Staffel|Volume|Partie|Part|Chapitre|Chapter|Book|Livre)\s+(\d+)\s*:\s*(.*)$/i;
// Séries sans numéro de saison explicite (mini-séries) → saison 1
const PART_RE =
  /^(.*?):\s*(?:Limited Series|Miniseries|Mini-série|Miniserie)\b[^:]*:\s*(.*)$/i;
// « Émission : Épisode 12 » (talk-shows, docs, animes sans saison) → saison 1.
// SANS ça, ces lignes partaient en recherche FILM et se liaient n'importe où.
const EPISODE_TAIL_RE =
  /^(.*?):\s*((?:Épisode|Episode|Chapitre|Chapter|Folge|Capítulo|Aflevering)\s+\d+.*)$/i;

/** Décompose un titre Netflix en épisode de série ou film. */
export function parseNetflixTitle(raw: string): ParsedTitle {
  const trimmed = raw.trim();
  const seasonMatch = trimmed.match(SEASON_RE);
  if (seasonMatch) {
    return {
      kind: 'episode',
      show: seasonMatch[1].trim(),
      season: Number.parseInt(seasonMatch[2], 10),
      episodeTitle: seasonMatch[3].trim(),
    };
  }
  const partMatch = trimmed.match(PART_RE);
  if (partMatch) {
    return {
      kind: 'episode',
      show: partMatch[1].trim(),
      season: 1,
      episodeTitle: partMatch[2].trim(),
    };
  }
  const tailMatch = trimmed.match(EPISODE_TAIL_RE);
  if (tailMatch) {
    // Pas de segment saison : saison inconnue (résolue multi-saisons à l'import).
    return {
      kind: 'episode',
      show: tailMatch[1].trim(),
      episodeTitle: tailMatch[2].trim(),
    };
  }
  return { kind: 'movie', title: trimmed };
}

const TITLE_COLUMNS = ['title', 'titre', 'título'];

function findTitleColumn(header: string[]): number {
  const normalized = header.map((c) => c.trim().toLowerCase());
  for (const candidate of TITLE_COLUMNS) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return 0; // par défaut : première colonne
}

export function parseNetflixCsv(text: string): NetflixParseResult {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error('Fichier vide ou sans données.');
  }
  const titleIndex = findTitleColumn(rows[0]);

  const series = new Map<string, NetflixEpisode[]>();
  const movieSet = new Set<string>();
  const episodeSeen = new Set<string>();
  // Titres ambigus « A: B » (un seul deux-points, pas de segment saison) :
  // épisode d'une série sans saison OU film à sous-titre. Tranché en 2e passe.
  const ambiguous: { show: string; tail: string; raw: string }[] = [];
  let skipped = 0;

  const pushEpisode = (ep: NetflixEpisode) => {
    const dedupe = `${ep.show.toLowerCase()}|${ep.season}|${normalizeTitle(ep.episodeTitle)}`;
    if (episodeSeen.has(dedupe)) return;
    episodeSeen.add(dedupe);
    const list = series.get(ep.show) ?? [];
    list.push(ep);
    series.set(ep.show, list);
  };

  for (const row of rows.slice(1)) {
    const title = (row[titleIndex] ?? '').trim();
    if (!title) {
      skipped++;
      continue;
    }
    const parsed = parseNetflixTitle(title);
    if (parsed.kind === 'episode' && parsed.show) {
      pushEpisode({
        show: parsed.show,
        season: parsed.season ?? 1,
        episodeTitle: parsed.episodeTitle ?? '',
        seasonUnknown: parsed.season == null,
        raw: title,
      });
    } else if (parsed.title) {
      const two = parsed.title.match(/^(.*?):\s*(.+)$/);
      if (two) {
        ambiguous.push({
          show: two[1].trim(),
          tail: two[2].trim(),
          raw: parsed.title,
        });
      } else {
        movieSet.add(parsed.title);
      }
    }
  }

  // 2e passe : un préfixe vu PLUSIEURS fois avec des suites différentes, ou
  // déjà connu comme série, est une série (« Legends: Old Kings », « Legends:
  // Alliance »…). Un préfixe unique reste un candidat film (« Black Mirror:
  // Bandersnatch »). Les groupes classés série gardent leur titre brut : si la
  // série est rejetée à la résolution TMDB, l'import retentera chaque titre en
  // film (correspondance exacte exigée) — rien n'est lié au hasard.
  const knownShows = new Set(
    [...series.keys()].map((name) => normalizeTitle(name))
  );
  const groups = new Map<string, { show: string; tail: string; raw: string }[]>();
  for (const entry of ambiguous) {
    const key = normalizeTitle(entry.show);
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  for (const [key, entries] of groups) {
    const tails = new Set(entries.map((e) => normalizeTitle(e.tail)));
    if (knownShows.has(key) || tails.size >= 2) {
      for (const entry of entries) {
        pushEpisode({
          show: entry.show,
          season: 1,
          episodeTitle: entry.tail,
          seasonUnknown: true,
          raw: entry.raw,
        });
      }
    } else {
      for (const entry of entries) movieSet.add(entry.raw);
    }
  }

  return { series, movies: [...movieSet], skipped };
}
