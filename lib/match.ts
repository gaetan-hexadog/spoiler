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

/**
 * Film : n'accepte qu'une correspondance de titre EXACTE (titre localisé ou
 * original, articles tolérés) parmi les premiers résultats. Sinon `null` —
 * mieux vaut « non trouvé » (signalé) qu'un mauvais film lié en douce.
 */
export async function findMovieMatch(
  title: string
): Promise<TmdbMovieSummary | null> {
  const wanted = normalizeTitle(title);
  const { results } = await searchMovies(title);
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
