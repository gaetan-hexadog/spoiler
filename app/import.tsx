import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Muted, Screen } from '@/components/ui';
import { markEpisodesBulk, trackShow } from '@/lib/db';
import { groupByShow, parseTvTimeCsv } from '@/lib/tvtime';
import { searchShows } from '@/lib/tmdb';

interface ImportReport {
  matched: { name: string; episodes: number }[];
  unmatched: string[];
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
      const content = await FileSystem.readAsStringAsync(picked.assets[0].uri);
      const { rows, skipped } = parseTvTimeCsv(content);
      const groups = groupByShow(rows);
      const result: ImportReport = { matched: [], unmatched: [], skipped };

      let index = 0;
      for (const [showName, episodes] of groups) {
        index++;
        setProgress(`${index} / ${groups.size} — ${showName}`);
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
          exporter, ou demande RGPD par email). Sélectionne ensuite le fichier
          CSV des épisodes vus (« seen_episode.csv »). Chaque série sera
          retrouvée sur TMDB et ton historique recréé.
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
            {report.skipped > 0 ? (
              <Muted>{report.skipped} lignes ignorées (invalides)</Muted>
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
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
