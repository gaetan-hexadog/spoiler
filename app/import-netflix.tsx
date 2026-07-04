import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Muted, Screen } from '@/components/ui';
import { addMovie, markEpisodesBulk, trackShow } from '@/lib/db';
import {
  normalizeTitle,
  parseNetflixCsv,
  type NetflixEpisode,
} from '@/lib/netflix';
import {
  getSeasonDetails,
  searchMovies,
  searchShows,
  type TmdbEpisode,
} from '@/lib/tmdb';

interface ImportReport {
  showsMatched: number;
  episodesMatched: number;
  moviesMatched: number;
  unmatchedShows: string[];
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
        unmatchedEpisodes: 0,
        skipped,
      };

      // --- Séries : résoudre la série, puis chaque épisode par son titre ---
      const seasonCache = new Map<string, Map<string, number>>();
      let index = 0;
      for (const [showName, episodes] of series) {
        index++;
        setProgress(`Séries ${index}/${series.size} — ${showName}`);
        try {
          const search = await searchShows(showName);
          const match = search.results[0];
          if (!match) {
            result.unmatchedShows.push(showName);
            continue;
          }
          await trackShow({
            tmdb_id: match.id,
            name: match.name,
            poster_path: match.poster_path,
            backdrop_path: match.backdrop_path,
          });

          const toMark: {
            tmdb_show_id: number;
            season_number: number;
            episode_number: number;
          }[] = [];
          for (const ep of episodes) {
            const number = await resolveEpisode(
              match.id,
              ep,
              seasonCache
            );
            if (number != null) {
              toMark.push({
                tmdb_show_id: match.id,
                season_number: ep.season,
                episode_number: number,
              });
            } else {
              result.unmatchedEpisodes++;
            }
          }
          if (toMark.length) {
            await markEpisodesBulk(toMark);
            result.episodesMatched += toMark.length;
          }
          result.showsMatched++;
        } catch {
          result.unmatchedShows.push(showName);
        }
      }

      // --- Films ---
      let mIndex = 0;
      for (const title of movies) {
        mIndex++;
        setProgress(`Films ${mIndex}/${movies.length} — ${title}`);
        try {
          const search = await searchMovies(title);
          const match = search.results[0];
          if (!match) continue;
          await addMovie({
            tmdb_id: match.id,
            title: match.title,
            poster_path: match.poster_path,
            status: 'watched',
          });
          result.moviesMatched++;
        } catch {
          // titre non résolu : ignoré
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

  /** Retrouve le numéro d'épisode TMDB à partir du titre Netflix. */
  async function resolveEpisode(
    showId: number,
    ep: NetflixEpisode,
    cache: Map<string, Map<string, number>>
  ): Promise<number | null> {
    const key = `${showId}:${ep.season}`;
    let byName = cache.get(key);
    if (!byName) {
      byName = new Map();
      try {
        const season = await getSeasonDetails(showId, ep.season);
        for (const episode of season.episodes as TmdbEpisode[]) {
          byName.set(normalizeTitle(episode.name), episode.episode_number);
        }
      } catch {
        // saison introuvable côté TMDB
      }
      cache.set(key, byName);
    }
    const byTitle = byName.get(normalizeTitle(ep.episodeTitle));
    if (byTitle != null) return byTitle;
    // Repli : « Épisode N » dans le titre Netflix.
    return episodeNumberFromTitle(ep.episodeTitle);
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
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
