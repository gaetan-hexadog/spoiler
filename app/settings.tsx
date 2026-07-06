import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useActionSheet } from '@/components/ActionSheet';
import { FrostedHeader } from '@/components/FrostedHeader';
import { Screen } from '@/components/ui';
import { useProfile } from '@/hooks/queries';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { usePro } from '@/hooks/usePro';
import {
  ACCENT_THEMES,
  getAccentThemeKey,
  setAccentTheme,
} from '@/lib/accentThemes';
import { exportBackup } from '@/lib/backup';
import { usePersistedState } from '@/hooks/usePersistedState';
import {
  clearEpisodeNotifications,
  ensureNotificationPermission,
  notificationsAvailable,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Écran Paramètres (route `app/settings.tsx`) — refonte « cartes groupées » :
 * carte compte en tête, listes groupées (pastilles d'icônes + sous-libellés),
 * déconnexion isolée en rouge, pied de page logo + version. 2 colonnes en
 * desktop. Accès depuis l'engrenage du profil : router.push('/settings').
 */
function IconChip({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View
      className="w-[34px] h-[34px] rounded-[10px] items-center justify-center"
      style={{ backgroundColor: 'rgba(255,212,73,0.12)' }}
    >
      <Ionicons name={icon} size={18} color={colors.accent} />
    </View>
  );
}

function Row({
  icon,
  label,
  sublabel,
  right,
  divider,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  divider?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 px-3.5 py-3"
      style={({ pressed }) => [
        pressed ? { opacity: 0.75 } : undefined,
        divider
          ? { borderBottomWidth: 1, borderBottomColor: 'rgba(44,56,82,0.55)' }
          : undefined,
      ]}
    >
      <IconChip icon={icon} />
      <View className="flex-1">
        <Text className="text-fg text-[14px] font-semibold">{label}</Text>
        {sublabel ? (
          <Text className="text-muted text-[11px] mt-0.5">{sublabel}</Text>
        ) : null}
      </View>
      {right ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
        ) : null)}
    </Pressable>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-muted text-[11.5px] font-extrabold tracking-wider px-1 pt-5 pb-2">
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const profile = useProfile();
  const isDesktop = useBreakpoint() === 'desktop';
  const [headerH, setHeaderH] = useState(0);
  const { isPro } = usePro();
  const [accentKey, setAccentKey] = useState('popcorn');
  useEffect(() => {
    getAccentThemeKey().then(setAccentKey);
  }, []);
  const { show: openSheet, sheet } = useActionSheet();
  const [notifEnabled, setNotifEnabled] = usePersistedState(
    'notifications',
    false
  );

  const email = session?.user.email ?? '';
  const displayName = profile.data?.username || email.split('@')[0] || 'Moi';
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
          message: 'Autorise les notifications dans les réglages Android.',
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

  const confirmSignOut = () =>
    openSheet({
      title: 'Se déconnecter ?',
      message: 'Tu devras te reconnecter pour retrouver ta liste.',
      actions: [
        {
          label: 'Se déconnecter',
          variant: 'danger',
          onPress: () => supabase.auth.signOut(),
        },
      ],
    });

  // Sauvegarde JSON (Pro) : partage vers Drive/Files, téléchargement sur web.
  const [backingUp, setBackingUp] = useState(false);
  const backupData = async () => {
    if (!isPro) {
      router.push('/pro');
      return;
    }
    if (backingUp) return;
    setBackingUp(true);
    try {
      await exportBackup();
    } catch (error) {
      Alert.alert(
        'Sauvegarde impossible',
        error instanceof Error ? error.message : 'Une erreur est survenue.'
      );
    } finally {
      setBackingUp(false);
    }
  };

  const [deleting, setDeleting] = useState(false);
  const confirmDeleteAccount = () =>
    openSheet({
      title: 'Supprimer le compte ?',
      message:
        'Toutes tes données (séries, films, historique, notes) seront définitivement effacées. Cette action est irréversible.',
      actions: [
        {
          label: 'Tout supprimer',
          variant: 'danger',
          onPress: async () => {
            setDeleting(true);
            const { error } = await supabase.functions.invoke(
              'delete-account',
              { method: 'POST' }
            );
            if (error) {
              setDeleting(false);
              Alert.alert(
                'Suppression impossible',
                error.message ?? 'Réessaie plus tard.'
              );
              return;
            }
            await supabase.auth.signOut();
          },
        },
      ],
    });

  const notifSwitch = (
    <Switch
      value={notifEnabled}
      onValueChange={toggleNotifications}
      trackColor={{ false: colors.surfaceLight, true: colors.accent }}
      thumbColor={colors.bg}
    />
  );

  const generalGroup = (
    <View>
      <GroupLabel>GÉNÉRAL</GroupLabel>
      <View className="bg-surface rounded-2xl overflow-hidden">
        {notificationsAvailable ? (
          <Row
            icon="notifications"
            label="Notifications"
            sublabel="Alertes de diffusion"
            right={notifSwitch}
            divider
          />
        ) : null}
        <Row
          icon="time"
          label="Historique de visionnage"
          onPress={() => router.push('/history')}
        />
      </View>

      <GroupLabel>APPARENCE</GroupLabel>
      <View className="bg-surface rounded-2xl p-3.5">
        <View className="flex-row items-center gap-2 mb-3">
          <Text className="text-fg text-[14px] font-semibold flex-1">
            Couleur d'accent
          </Text>
          {!isPro ? (
            <View className="bg-accent rounded-full px-2 py-0.5">
              <Text className="text-accent-fg text-[9px] font-extrabold">
                PRO
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row flex-wrap gap-2.5">
          {ACCENT_THEMES.map((theme) => {
            const active = theme.key === accentKey;
            return (
              <Pressable
                key={theme.key}
                onPress={() => {
                  if (!isPro) {
                    router.push('/pro');
                    return;
                  }
                  setAccentKey(theme.key);
                  setAccentTheme(theme.key).catch(() => {});
                }}
                className="items-center gap-1"
                style={({ pressed }) => (pressed ? { opacity: 0.75 } : undefined)}
              >
                <View
                  className="w-9 h-9 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: theme.accent,
                    borderWidth: active ? 3 : 0,
                    borderColor: colors.text,
                  }}
                >
                  {active ? (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={theme.accentFg}
                    />
                  ) : null}
                </View>
                <Text
                  className={`text-[9.5px] ${
                    active ? 'text-fg font-bold' : 'text-muted'
                  }`}
                >
                  {theme.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Pressable
        onPress={confirmSignOut}
        className="mt-[18px] rounded-2xl px-3.5 py-3.5 flex-row items-center gap-3"
        style={({ pressed }) => [
          { backgroundColor: 'rgba(229,72,77,0.1)' },
          pressed ? { opacity: 0.8 } : undefined,
        ]}
      >
        <Ionicons name="log-out" size={19} color={colors.danger} />
        <Text className="text-danger text-[14px] font-extrabold">
          Se déconnecter
        </Text>
      </Pressable>
    </View>
  );

  const proBadge = !isPro ? (
    <View className="bg-accent rounded-full px-2 py-0.5">
      <Text className="text-accent-fg text-[9px] font-extrabold">PRO</Text>
    </View>
  ) : undefined;

  // Les 3 scrobblings regroupés (ils n'ont rien à faire dans « Import »).
  const connexionsGroup = (
    <View>
      <GroupLabel>CONNEXIONS</GroupLabel>
      <View className="bg-surface rounded-2xl overflow-hidden">
        <Row
          icon="server"
          label="Plex / Jellyfin"
          sublabel="Scrobbling par webhook"
          onPress={() => router.push('/connect-server')}
          right={proBadge}
          divider
        />
        <Row
          icon="tv"
          label="Appareil Kodi"
          sublabel="Scrobbling automatique"
          onPress={() => router.push('/pair')}
          right={proBadge}
        />
      </View>
    </View>
  );

  const dataGroup = (
    <View>
      <GroupLabel>DONNÉES & IMPORT</GroupLabel>
      <View className="bg-surface rounded-2xl overflow-hidden">
        <Row
          icon="download"
          label="Importer depuis TV Time"
          sublabel="Export CSV"
          onPress={() => router.push('/import')}
          divider
        />
        <Row
          icon="download"
          label="Importer depuis Netflix"
          onPress={() => router.push('/import-netflix')}
          divider
        />
        <Row
          icon="cloud-upload"
          label="Sauvegarder mes données"
          sublabel={
            backingUp ? 'Préparation…' : 'Export JSON — vers Drive, Files…'
          }
          onPress={backupData}
          right={proBadge}
        />
      </View>
    </View>
  );

  const footer = (
    <View className="items-center gap-3 mt-9 mb-6">
      <Pressable onPress={() => router.push('/privacy')} hitSlop={8}>
        <Text className="text-muted text-[12px] font-semibold underline">
          Politique de confidentialité
        </Text>
      </Pressable>
      <View className="flex-row items-center justify-center gap-2.5">
        <Image
          source={require('../assets/logo.png')}
          style={{ width: 28, height: 28, opacity: 0.9 }}
          resizeMode="contain"
        />
        <Text className="text-muted text-[11px] font-semibold">
          PopcornLog v{Constants.expoConfig?.version ?? '1.0.0'} · Données TMDB
          {Platform.OS !== 'web' && Updates.updateId
            ? ` · maj ${Updates.updateId.slice(0, 8)}`
            : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {sheet}
      <FrostedHeader onHeight={setHeaderH}>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text className="text-fg text-2xl font-extrabold">Paramètres</Text>
        </View>
      </FrostedHeader>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: headerH + 8,
          paddingBottom: 16,
          width: '100%',
          maxWidth: isDesktop ? 800 : 720,
          alignSelf: 'center',
        }}
      >
        {/* Bannière Pro héroïque (dégradé) — ancre visuelle de l'écran. */}
        <Pressable
          onPress={() => router.push('/pro')}
          className="mt-2 rounded-[18px] overflow-hidden"
          style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
        >
          <LinearGradient
            colors={
              isPro ? ['#3a3216', '#1A2235'] : ['#2f2a14', '#1A2235']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 16 }}
          >
            <View className="flex-row items-center gap-3.5">
              <View className="w-11 h-11 rounded-2xl bg-accent items-center justify-center">
                <Ionicons name="star" size={22} color={colors.accentText} />
              </View>
              <View className="flex-1">
                <Text className="text-fg text-[15px] font-extrabold">
                  {isPro ? 'PopcornLog Pro' : 'Passer à Pro'}
                </Text>
                <Text className="text-muted text-[12px] mt-0.5">
                  {isPro
                    ? 'Abonnement actif — merci ✦'
                    : 'Suivi illimité, stats avancées, bandes-annonces…'}
                </Text>
              </View>
              {isPro ? (
                <View className="bg-accent rounded-full px-2.5 py-1">
                  <Text className="text-accent-fg text-[11px] font-extrabold">
                    PRO
                  </Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.accent} />
              )}
            </View>
          </LinearGradient>
        </Pressable>

        {isDesktop ? (
          <View className="flex-row gap-5 mt-1 items-start">
            <View className="flex-1">
              {generalGroup}
              {connexionsGroup}
            </View>
            <View className="flex-1">{dataGroup}</View>
          </View>
        ) : (
          <>
            {generalGroup}
            {connexionsGroup}
            {dataGroup}
          </>
        )}

        {/* Suppression de compte : de-emphasized mais présente. */}
        <Pressable
          onPress={confirmDeleteAccount}
          disabled={deleting}
          className="items-center mt-8"
          style={({ pressed }) =>
            pressed || deleting ? { opacity: 0.6 } : undefined
          }
        >
          <Text className="text-danger text-[13px] font-semibold">
            {deleting ? 'Suppression…' : 'Supprimer mon compte'}
          </Text>
        </Pressable>

        {footer}
      </ScrollView>
    </Screen>
  );
}
