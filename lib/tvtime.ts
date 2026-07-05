// Parseur des exports TV Time (RGPD). Deux formats connus :
//  - « tracking-prod-records-v2.csv » (récent, COMPLET : épisodes ET films,
//    colonnes entity_type / series_name / movie_name…)
//  - « seen_episode.csv » (ancien, épisodes seulement)
// La détection est automatique via les colonnes présentes.

export interface ImportRow {
  showName: string;
  season: number;
  episode: number;
}

export interface ImportMovie {
  title: string;
}

export interface ParseResult {
  rows: ImportRow[];
  movies: ImportMovie[];
  skipped: number;
}

/** Parse CSV minimaliste avec gestion des champs entre guillemets. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',' || char === ';') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

const SHOW_COLUMNS = ['tv_show_name', 'show_name', 'series_name', 'show', 'name', 'title'];
const SEASON_COLUMNS = ['episode_season_number', 'season_number', 'season', 's'];
const EPISODE_COLUMNS = ['episode_number', 'episode', 'number', 'e'];
const MOVIE_COLUMNS = ['movie_name', 'movie_title'];
const ENTITY_COLUMNS = ['entity_type'];
const TYPE_COLUMNS = ['type'];

function findColumn(header: string[], candidates: string[]): number {
  const normalized = header.map((column) => column.trim().toLowerCase());
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * Extrait épisodes vus ET films d'un export TV Time (les deux formats).
 * Lance une erreur si les colonnes attendues sont introuvables.
 */
export function parseTvTimeCsv(text: string): ParseResult {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error('Fichier vide ou sans données.');
  }
  const header = rows[0];
  const showIndex = findColumn(header, SHOW_COLUMNS);
  const seasonIndex = findColumn(header, SEASON_COLUMNS);
  const episodeIndex = findColumn(header, EPISODE_COLUMNS);
  const movieIndex = findColumn(header, MOVIE_COLUMNS);
  const entityIndex = findColumn(header, ENTITY_COLUMNS);
  const typeIndex = findColumn(header, TYPE_COLUMNS);
  const hasEpisodeColumns =
    showIndex !== -1 && seasonIndex !== -1 && episodeIndex !== -1;
  if (!hasEpisodeColumns && movieIndex === -1) {
    throw new Error(
      `Colonnes introuvables. Attendues : nom de série (${SHOW_COLUMNS[0]}), ` +
        `saison (${SEASON_COLUMNS[0]}), épisode (${EPISODE_COLUMNS[0]}) — ` +
        `et/ou film (${MOVIE_COLUMNS[0]}). Trouvées : ${header.join(', ')}`
    );
  }

  const result: ImportRow[] = [];
  const movies: ImportMovie[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  const seenMovies = new Set<string>();

  for (const row of rows.slice(1)) {
    // tracking-prod-records-v2 : ne garder que les événements de visionnage
    // (type « watch »/« rewatch ») quand la colonne existe — les follows,
    // notes, etc. ne sont pas des vus.
    if (typeIndex !== -1) {
      const type = (row[typeIndex] ?? '').trim().toLowerCase();
      if (type && !type.includes('watch')) {
        skipped++;
        continue;
      }
    }
    const entity =
      entityIndex !== -1 ? (row[entityIndex] ?? '').trim().toLowerCase() : '';

    // Films (v2 uniquement) : entity_type « movie » ou colonne movie_name remplie.
    const movieTitle =
      movieIndex !== -1 ? (row[movieIndex] ?? '').trim() : '';
    if (movieTitle && (entity === '' || entity.includes('movie'))) {
      const key = movieTitle.toLowerCase();
      if (!seenMovies.has(key)) {
        seenMovies.add(key);
        movies.push({ title: movieTitle });
      }
      continue;
    }
    if (entity.includes('movie')) {
      skipped++;
      continue;
    }

    // Épisodes.
    if (!hasEpisodeColumns) {
      skipped++;
      continue;
    }
    const showName = (row[showIndex] ?? '').trim();
    const season = Number.parseInt(row[seasonIndex] ?? '', 10);
    const episode = Number.parseInt(row[episodeIndex] ?? '', 10);
    if (!showName || Number.isNaN(season) || Number.isNaN(episode) || episode < 1) {
      skipped++;
      continue;
    }
    const key = `${showName.toLowerCase()}|${season}|${episode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ showName, season, episode });
  }
  return { rows: result, movies, skipped };
}

/** Regroupe les lignes d'import par nom de série. */
export function groupByShow(rows: ImportRow[]): Map<string, ImportRow[]> {
  const groups = new Map<string, ImportRow[]>();
  for (const row of rows) {
    const list = groups.get(row.showName) ?? [];
    list.push(row);
    groups.set(row.showName, list);
  }
  return groups;
}
