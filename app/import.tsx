import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Muted, Screen } from '@/components/ui';
import { importMovieWatched, markEpisodesBulk, trackShow } from '@/lib/db';
import { findMovieMatch } from '@/lib/match';
import { groupByShow, parseTvTimeCsv } from '@/lib/tvtime';
import { searchShows } from '@/lib/tmdb';

interface ImportReport {
  matched: { name: string; episodes: number }[];
  unmatched: string[];
  moviesMatched: number;
  moviesUnmatched: string[];
  skipped: number;
}

export default function ImportScreen() {
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
      // Web : l'URI est un blob, FileSystem n'existe pas — on lit le File.
      const content = asset.file
        ? await asset.file.text()
        : await FileSystem.readAsStringAsync(asset.uri);
      const { rows, movies, skipped } = parseTvTimeCsv(content);
      const groups = groupByShow(rows);
      const result: ImportReport = {
        matched: [],
        unmatched: [],
        moviesMatched: 0,
        moviesUnmatched: [],
        skipped,
      };

      let index = 0;
      for (const [showName, episodes] of groups) {
        index++;
        setProgress(`Séries ${index} / ${groups.size} — ${showName}`);
        try {
          const search = await searchShows(showName);
          const match = search.results[0];
          if (!match) {
            result.unmatched.push(showName);
            continue;
          }
          await trackShow({
            tmdb_id: match.id,
            name: match.name,
            poster_path: match.poster_path,
            backdrop_path: match.backdrop_path,
          });
          await markEpisodesBulk(
            episodes.map((episode) => ({
              tmdb_show_id: match.id,
              season_number: episode.season,
              episode_number: episode.episode,
            }))
          );
          result.matched.push({ name: match.name, episodes: episodes.length });
        } catch {
          result.unmatched.push(showName);
        }
      }

      // Films (présents dans tracking-prod-records-v2.csv) : résolus sur TMDB
      // puis marqués « vus ».
      let movieIndex = 0;
      for (const movie of movies) {
        movieIndex++;
        setProgress(`Films ${movieIndex} / ${movies.length} — ${movie.title}`);
        try {
          // Correspondance titre + année vérifiée : jamais de mauvais film lié.
          const match = await findMovieMatch(movie.title, { year: movie.year });
          if (!match) {
            result.moviesUnmatched.push(movie.title);
            continue;
          }
          await importMovieWatched({
            tmdb_id: match.id,
            title: match.title,
            poster_path: match.poster_path,
          });
          result.moviesMatched++;
        } catch {
          result.moviesUnmatched.push(movie.title);
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text className="text-fg text-xl font-extrabold">
          Importer depuis TV Time
        </Text>
        <Muted>
          Demande l'export de tes données sur TV Time (Paramètres → compte →
          exporter, ou demande RGPD par email). Deux fichiers à importer, l'un
          après l'autre : « tracking-prod-records-v2.csv » (tous les épisodes
          vus) puis « tracking-prod-records.csv » (les FILMS + anciens
          épisodes). Chaque titre est retrouvé sur TMDB ; le ré-import ne crée
          jamais de doublon.
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
              ✓ {report.matched.length} série
              {report.matched.length > 1 ? 's' : ''} importée
              {report.matched.length > 1 ? 's' : ''} (
              {report.matched.reduce((sum, show) => sum + show.episodes, 0)}{' '}
              épisodes)
            </Text>
            {report.moviesMatched > 0 ? (
              <Text className="text-success text-[15px] font-bold">
                ✓ {report.moviesMatched} film
                {report.moviesMatched > 1 ? 's' : ''} importé
                {report.moviesMatched > 1 ? 's' : ''}
              </Text>
            ) : null}
            {report.skipped > 0 ? (
              <Muted>{report.skipped} lignes ignorées (non-visionnage)</Muted>
            ) : null}
            {report.unmatched.length ? (
              <>
                <Text className="text-fg font-bold mt-2">
                  Séries non trouvées sur TMDB :
                </Text>
                {report.unmatched.map((name) => (
                  <Text key={name} className="text-muted text-[13px]">
                    · {name}
                  </Text>
                ))}
              </>
            ) : null}
            {report.moviesUnmatched.length ? (
              <>
                <Text className="text-fg font-bold mt-2">
                  Films non trouvés sur TMDB :
                </Text>
                {report.moviesUnmatched.map((name) => (
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
