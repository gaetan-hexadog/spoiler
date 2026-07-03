// Parseur de l'export TV Time (fichier « seen_episode.csv » de l'export RGPD,
// ou tout CSV avec des colonnes série / saison / épisode).

export interface ImportRow {
  showName: string;
  season: number;
  episode: number;
}

export interface ParseResult {
  rows: ImportRow[];
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

function findColumn(header: string[], candidates: string[]): number {
  const normalized = header.map((column) => column.trim().toLowerCase());
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * Extrait les épisodes vus d'un CSV TV Time.
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
  if (showIndex === -1 || seasonIndex === -1 || episodeIndex === -1) {
    throw new Error(
      `Colonnes introuvables. Attendues : nom de série (${SHOW_COLUMNS[0]}), ` +
        `saison (${SEASON_COLUMNS[0]}), épisode (${EPISODE_COLUMNS[0]}). ` +
        `Trouvées : ${header.join(', ')}`
    );
  }

  const result: ImportRow[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
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
  return { rows: result, skipped };
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
