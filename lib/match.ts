// Résolution TMDB VÉRIFIÉE pour les imports (Netflix, TV Time).
// Le premier résultat d'une recherche TMDB est souvent un faux ami
// (titres localisés, homonymes, contenus exclusifs absents du catalogue) :
// on n'accepte un candidat que si son titre correspond vraiment.
import { normalizeTitle } from './netflix';
import {
  searchMovies,
  searchShows,
  type TmdbMovieSummary,
  type TmdbShowSummary,
} from './tmdb';

/** Titre sans article initial (le/la/les/the/a/an…) pour comparer plus large. */
function stripArticle(normalized: string): string {
  return normalized.replace(/^(le|la|les|l|the|a|an|el|los|las|der|die|das)\s+/, '');
}

function titlesMatch(wanted: string, candidate: string): boolean {
  if (!wanted || !candidate) return false;
  if (wanted === candidate) return true;
  return stripArticle(wanted) === stripArticle(candidate);
}

function exactTitle(
  wanted: string,
  results: TmdbMovieSummary[]
): TmdbMovieSummary | null {
  // Les résultats TMDB sont triés par pertinence/popularité : le premier
  // dont le titre correspond vraiment est le bon.
  return (
    results
      .slice(0, 8)
      .find(
        (movie) =>
          titlesMatch(wanted, normalizeTitle(movie.title)) ||
          titlesMatch(wanted, normalizeTitle(movie.original_title ?? ''))
      ) ?? null
  );
}

/**
 * Film : n'accepte qu'une correspondance de titre EXACTE (titre localisé ou
 * original, articles tolérés) parmi les premiers résultats. Sinon `null` —
 * mieux vaut « non trouvé » (signalé) qu'un mauvais film lié en douce.
 *
 * `year` (dispo dans les exports TV Time) désambiguïse les homonymes :
 * recherche d'abord restreinte à l'année de sortie (±1 an de tolérance,
 * les dates locales divergeant parfois), puis repli titre-exact + année
 * cohérente sur la recherche large.
 */
export async function findMovieMatch(
  title: string,
  opts: { year?: number } = {}
): Promise<TmdbMovieSummary | null> {
  const wanted = normalizeTitle(title);
  if (opts.year) {
    for (const year of [opts.year, opts.year - 1, opts.year + 1]) {
      const { results } = await searchMovies(title, 1, year);
      const match = exactTitle(wanted, results);
      if (match) return match;
    }
    // Repli : recherche large, mais l'année du candidat doit rester cohérente.
    const { results } = await searchMovies(title);
    const match = exactTitle(wanted, results);
    if (match) {
      const matchYear = Number.parseInt(
        (match.release_date ?? '').slice(0, 4),
        10
      );
      if (
        Number.isFinite(matchYear) &&
        Math.abs(matchYear - opts.year) <= 2
      ) {
        return match;
      }
      return null; // titre exact mais mauvaise année → homonyme, on refuse
    }
    return null;
  }
  const { results } = await searchMovies(title);
  return exactTitle(wanted, results);
}

/**
 * Série : correspondance exacte si possible ; sinon on rend quand même le
 * premier résultat mais marqué `exact: false` — l'appelant doit alors le
 * confirmer par un signal secondaire (ex. : au moins un épisode dont le
 * titre matche) avant de l'enregistrer.
 */
export async function findShowMatch(
  name: string
): Promise<{ match: TmdbShowSummary | null; exact: boolean }> {
  const wanted = normalizeTitle(name);
  const { results } = await searchShows(name);
  const top = results.slice(0, 8);
  const exact = top.find(
    (show) =>
      titlesMatch(wanted, normalizeTitle(show.name)) ||
      titlesMatch(wanted, normalizeTitle(show.original_name ?? ''))
  );
  if (exact) return { match: exact, exact: true };
  return { match: top[0] ?? null, exact: false };
}
