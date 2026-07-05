import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActionSheet } from '@/components/ActionSheet';
import { Screen } from '@/components/ui';
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
  const insets = useSafeAreaInsets();
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

  const editProfileSoon = () =>
    openSheet({
      title: 'Bientôt',
      message: 'La modification du profil arrive dans une prochaine version.',
      actions: [{ label: 'OK', onPress: () => {} }],
    });

  const notifSwitch = (
    <Switch
      value={notifEnabled}
      onValueChange={toggleNotifications}
      trackColor={{ false: colors.surfaceLight, true: colors.accent }}
      thumbColor={colors.bg}
    />
  );

  const accountCard = (
    <Pressable
      className="bg-surface rounded-[18px] p-[18px] flex-row items-center gap-4"
      onPress={editProfileSoon}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      <View className="w-14 h-14 rounded-full bg-accent items-center justify-center">
        <Text className="text-accent-fg text-2xl font-extrabold">{initial}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-fg text-[17px] font-extrabold" numberOfLines={1}>
          {displayName}
        </Text>
        <Text className="text-muted text-[12.5px]" numberOfLines={1}>
          {email}
        </Text>
      </View>
      <View className="bg-surface-light rounded-[10px] px-3.5 py-2">
        <Text className="text-fg text-[12.5px] font-extrabold">Modifier</Text>
      </View>
    </Pressable>
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

  const dataGroup = (
    <View>
      <GroupLabel>DONNÉES & IMPORT</GroupLabel>
      <View className="bg-surface rounded-2xl overflow-hidden">
        <Row
          icon="tv"
          label="Associer un appareil Kodi"
          sublabel="Scrobbling automatique"
          onPress={() => router.push('/pair')}
          divider
        />
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
        />
      </View>
    </View>
  );

  const footer = (
    <View className="flex-row items-center justify-center gap-2.5 mt-9 mb-6">
      <Image
        source={require('../assets/logo.png')}
        style={{ width: 28, height: 28, opacity: 0.9 }}
        resizeMode="contain"
      />
      <Text className="text-muted text-[12px] font-semibold">
        PopcornLog v{Constants.expoConfig?.version ?? '1.0.0'} · Données TMDB
        {Platform.OS !== 'web' && Updates.updateId
          ? ` · maj ${Updates.updateId.slice(0, 8)}`
          : ''}
      </Text>
    </View>
  );

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {sheet}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 16,
          width: '100%',
          maxWidth: isDesktop ? 800 : 720,
          alignSelf: 'center',
        }}
      >
        <View className="flex-row items-center gap-3 pt-2 pb-4">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text className="text-fg text-2xl font-extrabold">Paramètres</Text>
        </View>

        {accountCard}

        {isDesktop ? (
          <View className="flex-row gap-5 mt-1 items-start">
            <View className="flex-1">{generalGroup}</View>
            <View className="flex-1">{dataGroup}</View>
          </View>
        ) : (
          <>
            {generalGroup}
            {dataGroup}
          </>
        )}

        {footer}
      </ScrollView>
    </Screen>
  );
}
