import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useActionSheet } from '@/components/ActionSheet';
import { Muted, Screen } from '@/components/ui';
import {
  useAllWatchedEpisodes,
  useMovies,
  useProfile,
  useTrackedShows,
} from '@/hooks/queries';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { usePersistedState } from '@/hooks/usePersistedState';
import {
  clearEpisodeNotifications,
  ensureNotificationPermission,
  notificationsAvailable,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { imageUrl } from '@/lib/tmdb';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

const EPISODE_MINUTES = 42;
const MOVIE_MINUTES = 110;

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View className="flex-1 bg-surface rounded-2xl p-4 items-center gap-1">
      <Text className="text-accent text-[24px] font-extrabold">{value}</Text>
      <Text className="text-muted text-xs text-center">{label}</Text>
    </View>
  );
}

function formatDuration(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  if (days > 0) return `${days} j ${hours} h`;
  return `${hours} h`;
}

function SettingRow({
  icon,
  label,
  danger,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 bg-surface rounded-2xl px-4 py-3.5"
      style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
    >
      <Ionicons
        name={icon}
        size={20}
        color={danger ? colors.danger : colors.accent}
      />
      <Text
        className={`flex-1 text-[15px] font-semibold ${
          danger ? 'text-danger' : 'text-fg'
        }`}
      >
        {label}
      </Text>
      {right ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        ) : null)}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const profile = useProfile();
  const shows = useTrackedShows();
  const watched = useAllWatchedEpisodes();
  const movies = useMovies();
  const [notifEnabled, setNotifEnabled] = usePersistedState(
    'notifications',
    false
  );
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const { show: openSheet, sheet } = useActionSheet();
  const isDesktop = useBreakpoint() === 'desktop';

  const checkForUpdate = async () => {
    if (!Updates.isEnabled) {
      openSheet({
        title: 'Indisponible',
        message:
          'Les mises à jour OTA ne fonctionnent que dans l’app installée (APK).',
        actions: [{ label: 'OK', onPress: () => {} }],
      });
      return;
    }
    setCheckingUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        openSheet({
          title: 'À jour ✓',
          message: 'Tu as déjà la dernière version.',
          actions: [{ label: 'OK', onPress: () => {} }],
        });
        return;
      }
      await Updates.fetchUpdateAsync();
      openSheet({
        title: 'Mise à jour prête',
        message: 'Redémarrer maintenant ?',
        actions: [
          {
            label: 'Redémarrer',
            variant: 'primary',
            onPress: () => Updates.reloadAsync(),
          },
          { label: 'Plus tard', onPress: () => {} },
        ],
      });
    } catch (error) {
      openSheet({
        title: 'Erreur',
        message:
          error instanceof Error ? error.message : 'Vérification impossible.',
        actions: [{ label: 'OK', onPress: () => {} }],
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const stats = useMemo(() => {
    const showList = shows.data ?? [];
    const episodes = watched.data ?? [];
    const movieList = movies.data ?? [];
    const moviesWatched = movieList.filter(
      (movie) => movie.status === 'watched'
    ).length;

    const year = String(new Date().getFullYear());
    const episodesThisYear = episodes.filter((episode) =>
      episode.watched_at.startsWith(year)
    ).length;

    const countByShow = new Map<number, number>();
    for (const episode of episodes) {
      countByShow.set(
        episode.tmdb_show_id,
        (countByShow.get(episode.tmdb_show_id) ?? 0) + 1
      );
    }
    const showById = new Map(showList.map((show) => [show.tmdb_id, show]));
    const topShows = [...countByShow.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tmdbId, count]) => ({
        show: showById.get(tmdbId),
        tmdbId,
        count,
      }))
      .filter((entry) => entry.show);

    return {
      shows: showList.length,
      completed: showList.filter((show) => show.status === 'completed').length,
      episodes: episodes.length,
      moviesWatched,
      episodesThisYear,
      totalMinutes:
        episodes.length * EPISODE_MINUTES + moviesWatched * MOVIE_MINUTES,
      topShows,
    };
  }, [shows.data, watched.data, movies.data]);

  const email = session?.user.email ?? '';
  const displayName = profile.data?.username || email.split('@')[0];
  const initial = (displayName[0] ?? '?').toUpperCase();

  const toggleNotifications = async (value: boolean) => {
    if (value) {
      if (!notificationsAvailable) {
        openSheet({
          title: 'Indisponible ici',
          message:
            "Les notifications nécessitent l'app installée (APK Android).",
          actions: [{ label: 'OK', onPress: () => {} }],
        });
        return;
      }
      const granted = await ensureNotificationPermission();
      if (!granted) {
        openSheet({
          title: 'Notifications refusées',
          message:
            'Autorise les notifications pour PopcornLog dans les réglages Android.',
          actions: [{ label: 'OK', onPress: () => {} }],
        });
        return;
      }
      setNotifEnabled(true);
    } else {
      setNotifEnabled(false);
      clearEpisodeNotifications().catch(() => {});
    }
  };

  return (
    <Screen>
      {sheet}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 20,
          width: '100%',
          maxWidth: isDesktop ? 1000 : 720,
          alignSelf: 'center',
        }}
      >
        <Text className="text-fg text-2xl font-extrabold">Profil</Text>
        {/* Identité */}
        <View
          className={`gap-2 pt-2 ${isDesktop ? 'flex-row items-center gap-4' : 'items-center'}`}
        >
          <View className="w-20 h-20 rounded-full bg-accent items-center justify-center">
            <Text className="text-accent-fg text-3xl font-extrabold">
              {initial}
            </Text>
          </View>
          <View className={isDesktop ? '' : 'items-center'}>
            <Text className="text-fg text-xl font-extrabold">{displayName}</Text>
            <Text className="text-muted text-[13px]">{email}</Text>
          </View>
        </View>

        {/* Statistiques */}
        <View className={isDesktop ? 'flex-row gap-3' : 'gap-3'}>
          <View className="flex-row gap-3 flex-1">
            <Stat value={stats.shows} label="Séries" />
            <Stat value={stats.episodes} label="Épisodes vus" />
            <Stat value={stats.moviesWatched} label="Films vus" />
          </View>
          <View className="flex-row gap-3 flex-1">
            <Stat
              value={`≈ ${formatDuration(stats.totalMinutes)}`}
              label="Devant l'écran"
            />
            <Stat value={stats.episodesThisYear} label="Épisodes cette année" />
            <Stat value={stats.completed} label="Séries terminées" />
          </View>
        </View>

        <View className={isDesktop ? 'flex-row gap-6 items-start' : 'gap-5'}>
        {/* Top séries */}
        {stats.topShows.length ? (
          <View className={`gap-2 ${isDesktop ? 'flex-[1.4]' : ''}`}>
            <Text className="text-fg text-lg font-bold">Top séries</Text>
            {stats.topShows.map((entry, index) => {
              const uri = imageUrl(entry.show?.poster_path, 'w92');
              return (
                <Pressable
                  key={entry.tmdbId}
                  onPress={() => router.push(`/show/${entry.tmdbId}`)}
                  className="flex-row items-center gap-3 bg-surface rounded-xl p-2"
                  style={({ pressed }) =>
                    pressed ? { opacity: 0.8 } : undefined
                  }
                >
                  <Text className="text-accent text-base font-extrabold w-6 text-center">
                    {index + 1}
                  </Text>
                  {uri ? (
                    <Image
                      source={{ uri }}
                      className="w-8 aspect-[2/3] rounded"
                    />
                  ) : (
                    <View className="w-8 aspect-[2/3] rounded bg-surface-light" />
                  )}
                  <Text
                    className="text-fg text-sm font-semibold flex-1"
                    numberOfLines={1}
                  >
                    {entry.show?.name}
                  </Text>
                  <Text className="text-muted text-xs">{entry.count} ép.</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Réglages */}
        <View className={`gap-2 ${isDesktop ? 'flex-1' : ''}`}>
          <Text className="text-fg text-lg font-bold">Réglages</Text>
          <SettingRow
            icon="notifications"
            label="Notifications de diffusion"
            right={
              <Switch
                value={notifEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: colors.surfaceLight, true: colors.accent }}
                thumbColor={colors.text}
              />
            }
          />
          <SettingRow
            icon="time"
            label="Historique de visionnage"
            onPress={() => router.push('/history')}
          />
          <SettingRow
            icon="tv"
            label="Associer un appareil Kodi"
            onPress={() => router.push('/pair')}
          />
          <SettingRow
            icon="download"
            label="Importer mon historique TV Time"
            onPress={() => router.push('/import')}
          />
          <SettingRow
            icon="download"
            label="Importer depuis Netflix"
            onPress={() => router.push('/import-netflix')}
          />
          <SettingRow
            icon="refresh"
            label={
              checkingUpdate
                ? 'Vérification…'
                : 'Rechercher une mise à jour'
            }
            onPress={checkForUpdate}
          />
          <SettingRow
            icon="log-out"
            label="Se déconnecter"
            danger
            onPress={() => supabase.auth.signOut()}
          />
        </View>
        </View>

        <Muted>
          PopcornLog v{Constants.expoConfig?.version ?? '1.0.0'}
          {Updates.updateId ? ` · maj ${Updates.updateId.slice(0, 8)}` : ''}
          {'\n'}Temps d'écran estimé (42 min/épisode, 1 h 50/film). Données
          TMDB — application non approuvée par TMDB.
        </Muted>
      </ScrollView>
    </Screen>
  );
}
