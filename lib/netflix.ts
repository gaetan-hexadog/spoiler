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
    return {
      kind: 'episode',
      show: tailMatch[1].trim(),
      season: 1,
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
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const title = (row[titleIndex] ?? '').trim();
    if (!title) {
      skipped++;
      continue;
    }
    const parsed = parseNetflixTitle(title);
    if (parsed.kind === 'episode' && parsed.show) {
      const dedupe = `${parsed.show.toLowerCase()}|${parsed.season}|${normalizeTitle(parsed.episodeTitle ?? '')}`;
      if (episodeSeen.has(dedupe)) continue;
      episodeSeen.add(dedupe);
      const list = series.get(parsed.show) ?? [];
      list.push({
        show: parsed.show,
        season: parsed.season ?? 1,
        episodeTitle: parsed.episodeTitle ?? '',
      });
      series.set(parsed.show, list);
    } else if (parsed.title) {
      movieSet.add(parsed.title);
    }
  }

  return { series, movies: [...movieSet], skipped };
}
