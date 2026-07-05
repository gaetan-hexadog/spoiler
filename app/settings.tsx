import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import React from 'react';
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
import { useProfile } from '@/hooks/queries';
import { useBreakpoint } from '@/hooks/useBreakpoint';
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
 * 1b — Écran Paramètres (route `app/settings.tsx`), refonte « cartes groupées » :
 * carte compte en tête, sections en cartes avec séparateurs internes, pied de
 * page logo + version. Accès depuis l'engrenage du profil.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-muted text-[12px] font-bold tracking-wider uppercase mt-5 mb-1.5 px-1">
      {children}
    </Text>
  );
}

function Row({
  icon,
  label,
  sublabel,
  danger,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  danger?: boolean;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 px-3.5 py-3.5"
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center"
        style={{
          backgroundColor: danger
            ? 'rgba(229,72,77,0.14)'
            : 'rgba(255,212,73,0.14)',
        }}
      >
        <Ionicons
          name={icon}
          size={18}
          color={danger ? colors.danger : colors.accent}
        />
      </View>
      <View className="flex-1">
        <Text
          className={`text-[15px] font-semibold ${
            danger ? 'text-danger' : 'text-fg'
          }`}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text className="text-muted text-[12px] mt-0.5">{sublabel}</Text>
        ) : null}
      </View>
      {right ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        ) : null)}
    </Pressable>
  );
}

/** Carte regroupant des lignes, avec un séparateur fin entre chacune. */
function Group({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <View className="bg-surface rounded-2xl overflow-hidden">
      {items.map((child, index) => (
        <View key={index}>
          {index > 0 ? <View className="h-px bg-line ml-[54px]" /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const profile = useProfile();
  const isDesktop = useBreakpoint() === 'desktop';
  const { show: openSheet, sheet } = useActionSheet();
  const [notifEnabled, setNotifEnabled] = usePersistedState(
    'notifications',
    false
  );

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

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {sheet}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 2,
          width: '100%',
          maxWidth: isDesktop ? 720 : 560,
          alignSelf: 'center',
        }}
      >
        {/* En-tête */}
        <View className="flex-row items-center gap-3 pt-1 pb-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            className="w-9 h-9 rounded-full bg-surface items-center justify-center"
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text className="text-fg text-2xl font-extrabold">Paramètres</Text>
        </View>

        {/* Carte compte */}
        <View className="flex-row items-center gap-3 bg-surface rounded-2xl p-4 mt-1">
          <View className="w-14 h-14 rounded-full bg-accent items-center justify-center">
            <Text className="text-accent-fg text-2xl font-extrabold">
              {initial}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-fg text-lg font-extrabold" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="text-muted text-[13px]" numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>

        <SectionLabel>Général</SectionLabel>
        <Group>
          {notificationsAvailable ? (
            <Row
              icon="notifications-outline"
              label="Notifications de diffusion"
              sublabel="Alerte à la sortie d'un épisode"
              right={
                <Switch
                  value={notifEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={{
                    false: colors.surfaceLight,
                    true: colors.accent,
                  }}
                  thumbColor={colors.text}
                />
              }
            />
          ) : null}
          <Row
            icon="time-outline"
            label="Historique de visionnage"
            onPress={() => router.push('/history')}
          />
        </Group>

        <SectionLabel>Données</SectionLabel>
        <Group>
          <Row
            icon="tv-outline"
            label="Associer un appareil Kodi"
            sublabel="Scrobbling automatique"
            onPress={() => router.push('/pair')}
          />
          <Row
            icon="cloud-download-outline"
            label="Importer depuis TV Time"
            onPress={() => router.push('/import')}
          />
          <Row
            icon="cloud-download-outline"
            label="Importer depuis Netflix"
            onPress={() => router.push('/import-netflix')}
          />
        </Group>

        <SectionLabel>Compte</SectionLabel>
        <Group>
          <Row
            icon="log-out-outline"
            label="Se déconnecter"
            danger
            onPress={confirmSignOut}
          />
        </Group>

        {/* Pied de page : logo + version */}
        <View className="items-center gap-2 mt-9 mb-4">
          <Image
            source={require('../assets/logo.png')}
            style={{ width: 32, height: 32, opacity: 0.85 }}
            resizeMode="contain"
          />
          <Muted>
            PopcornLog v{Constants.expoConfig?.version ?? '1.0.0'}
            {Updates.updateId ? ` · maj ${Updates.updateId.slice(0, 8)}` : ''}
            {'\n'}Données TMDB — application non approuvée par TMDB.
          </Muted>
        </View>
      </ScrollView>
    </Screen>
  );
}
