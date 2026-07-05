import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Muted, Screen } from '@/components/ui';
import { importMovieWatched, markEpisodesBulk, trackShow } from '@/lib/db';
import { findMovieMatch, findShowMatch } from '@/lib/match';
import {
  normalizeTitle,
  parseNetflixCsv,
  type NetflixEpisode,
} from '@/lib/netflix';
import {
  getSeasonDetails,
  getShowDetails,
  type TmdbEpisode,
} from '@/lib/tmdb';

interface ImportReport {
  showsMatched: number;
  episodesMatched: number;
  moviesMatched: number;
  unmatchedShows: string[];
  unmatchedMovies: string[];
  unmatchedEpisodes: number;
  skipped: number;
}

/** « Épisode 3 » / « Episode 3 » / « Chapter 3 » → 3 (repli si le titre ne matche pas). */
function episodeNumberFromTitle(title: string): number | null {
  const m = title.match(
    /(?:episode|épisode|chapter|chapitre|part|partie|folge)\s+(\d+)/i
  );
  return m ? Number.parseInt(m[1], 10) : null;
}

export default function ImportNetflixScreen() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runImport() {
    setError(null);
    setReport(null);

    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', '*/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.length) return;

    setRunning(true);
    try {
      const asset = picked.assets[0];
      const content = asset.file
        ? await asset.file.text()
        : await FileSystem.readAsStringAsync(asset.uri);
      const { series, movies, skipped } = parseNetflixCsv(content);

      const result: ImportReport = {
        showsMatched: 0,
        episodesMatched: 0,
        moviesMatched: 0,
        unmatchedShows: [],
        unmatchedMovies: [],
        unmatchedEpisodes: 0,
        skipped,
      };

      // --- Séries : résoudre la série, puis chaque épisode par son titre ---
      const seasonCache = new Map<string, Map<string, number>>();
      let index = 0;
      // Séries « inférées » rejetées (préfixe ambigu) : leurs titres bruts
      // sont retentés en films après la boucle séries.
      const movieQueue = [...movies];
      for (const [showName, episodes] of series) {
        index++;
        setProgress(`Séries ${index}/${series.size} — ${showName}`);
        // Série « inférée » = uniquement des titres ambigus « A: B » regroupés
        // (jamais de segment saison explicite chez Netflix).
        const inferred = episodes.every((ep) => ep.seasonUnknown);
        try {
          const { match, exact } = await findShowMatch(showName);
          if (!match) {
            if (inferred) {
              for (const ep of episodes) if (ep.raw) movieQueue.push(ep.raw);
            } else {
              result.unmatchedShows.push(showName);
            }
            continue;
          }

          // Résoudre les épisodes AVANT d'enregistrer : sans correspondance
          // de titre d'épisode, une série inexacte — ou inférée — est
          // probablement la mauvaise → on ne pollue pas.
          const toMark: {
            tmdb_show_id: number;
            season_number: number;
            episode_number: number;
          }[] = [];
          let byTitleHits = 0;
          for (const ep of episodes) {
            const resolved = await resolveEpisode(match.id, ep, seasonCache);
            if (resolved != null) {
              if (resolved.byTitle) byTitleHits++;
              toMark.push({
                tmdb_show_id: match.id,
                season_number: resolved.season,
                episode_number: resolved.number,
              });
            } else {
              result.unmatchedEpisodes++;
            }
          }
          if ((inferred || !exact) && byTitleHits === 0) {
            // Pas un seul titre d'épisode reconnu : série douteuse. Les titres
            // inférés retournent dans la file films (match exact exigé).
            if (inferred) {
              for (const ep of episodes) if (ep.raw) movieQueue.push(ep.raw);
            } else {
              result.unmatchedShows.push(showName);
            }
            continue;
          }

          await trackShow({
            tmdb_id: match.id,
            name: match.name,
            poster_path: match.poster_path,
            backdrop_path: match.backdrop_path,
          });
          if (toMark.length) {
            await markEpisodesBulk(toMark);
            result.episodesMatched += toMark.length;
          }
          result.showsMatched++;
        } catch {
          result.unmatchedShows.push(showName);
        }
      }

      // --- Films : correspondance de titre VÉRIFIÉE (sinon signalé, jamais
      // lié au hasard) ; écriture idempotente (ré-import sans écrasement). ---
      let mIndex = 0;
      for (const title of movieQueue) {
        mIndex++;
        setProgress(`Films ${mIndex}/${movieQueue.length} — ${title}`);
        try {
          const match = await findMovieMatch(title);
          if (!match) {
            result.unmatchedMovies.push(title);
            continue;
          }
          await importMovieWatched({
            tmdb_id: match.id,
            title: match.title,
            poster_path: match.poster_path,
          });
          result.moviesMatched++;
        } catch {
          result.unmatchedMovies.push(title);
        }
      }

      setReport(result);
      queryClient.invalidateQueries({ queryKey: ['db'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import impossible.');
    } finally {
      setRunning(false);
      setProgress('');
    }
  }

  /** Carte titre normalisé → numéro d'épisode d'une saison (mémoïsée). */
  async function seasonMap(
    showId: number,
    season: number,
    cache: Map<string, Map<string, number>>
  ): Promise<Map<string, number>> {
    const key = `${showId}:${season}`;
    let byName = cache.get(key);
    if (!byName) {
      byName = new Map();
      try {
        const details = await getSeasonDetails(showId, season);
        for (const episode of details.episodes as TmdbEpisode[]) {
          byName.set(normalizeTitle(episode.name), episode.episode_number);
        }
      } catch {
        // saison introuvable côté TMDB
      }
      cache.set(key, byName);
    }
    return byName;
  }

  /**
   * Retrouve saison + numéro d'épisode TMDB à partir du titre Netflix.
   * Saison inconnue (titres « Émission: Épisode ») → recherche du titre dans
   * TOUTES les saisons. `byTitle` distingue une vraie correspondance de titre
   * (signal fort que la série est la bonne) du simple repli « Épisode N ».
   */
  async function resolveEpisode(
    showId: number,
    ep: NetflixEpisode,
    cache: Map<string, Map<string, number>>
  ): Promise<{ number: number; season: number; byTitle: boolean } | null> {
    const wanted = normalizeTitle(ep.episodeTitle);
    if (!ep.seasonUnknown) {
      const byName = await seasonMap(showId, ep.season, cache);
      const found = byName.get(wanted);
      if (found != null)
        return { number: found, season: ep.season, byTitle: true };
    } else {
      // Saison inconnue : parcourir les saisons de la série (spéciaux exclus).
      try {
        const details = await getShowDetails(showId);
        for (const season of details.seasons) {
          if (season.season_number === 0) continue;
          const byName = await seasonMap(showId, season.season_number, cache);
          const found = byName.get(wanted);
          if (found != null)
            return { number: found, season: season.season_number, byTitle: true };
        }
      } catch {
        // détails de série indisponibles
      }
    }
    // Repli : « Épisode N » dans le titre Netflix.
    const fromNumber = episodeNumberFromTitle(ep.episodeTitle);
    return fromNumber != null
      ? { number: fromNumber, season: ep.seasonUnknown ? 1 : ep.season, byTitle: false }
      : null;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text className="text-fg text-xl font-extrabold">
          Importer depuis Netflix
        </Text>
        <Muted>
          Sur netflix.com : Compte → sélectionne ton profil → « Activité de
          visionnage » → « Télécharger tout » (fichier
          « NetflixViewingActivity.csv »). Sélectionne-le ici. Chaque série et
          film sera retrouvé sur TMDB. Les épisodes sont associés par leur
          titre — certains, mal nommés côté Netflix, peuvent ne pas être
          reconnus.
        </Muted>

        <Button
          title={running ? 'Import en cours…' : 'Choisir le fichier CSV'}
          onPress={runImport}
          loading={running}
        />

        {progress ? (
          <Text className="text-accent text-sm text-center">{progress}</Text>
        ) : null}
        {error ? <Text className="text-danger text-sm">{error}</Text> : null}

        {report ? (
          <View className="bg-surface rounded-2xl p-4 gap-1">
            <Text className="text-success text-[15px] font-bold">
              ✓ {report.showsMatched} séries · {report.episodesMatched} épisodes
              · {report.moviesMatched} films importés
            </Text>
            {report.skipped > 0 ? (
              <Muted>{report.skipped} lignes ignorées</Muted>
            ) : null}
            {report.unmatchedEpisodes > 0 ? (
              <Muted>
                {report.unmatchedEpisodes} épisodes non associés (titre non
                reconnu)
              </Muted>
            ) : null}
            {report.unmatchedShows.length ? (
              <>
                <Text className="text-fg font-bold mt-2">
                  Séries non trouvées :
                </Text>
                {report.unmatchedShows.slice(0, 40).map((name) => (
                  <Text key={name} className="text-muted text-[13px]">
                    · {name}
                  </Text>
                ))}
              </>
            ) : null}
            {report.unmatchedMovies.length ? (
              <>
                <Text className="text-fg font-bold mt-2">
                  Films non liés (titre sans correspondance sûre) :
                </Text>
                {report.unmatchedMovies.slice(0, 60).map((name) => (
                  <Text key={name} className="text-muted text-[13px]">
                    · {name}
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
