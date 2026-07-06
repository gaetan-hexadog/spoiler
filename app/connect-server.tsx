import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useActionSheet } from '@/components/ActionSheet';
import { Button, EmptyState, Muted, Screen } from '@/components/ui';
import { usePro } from '@/hooks/usePro';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const WEBHOOK_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/scrobble`;

/** Gabarit JSON à coller dans Tautulli (webhook « JSON Data »). */
const TAUTULLI_TEMPLATE = `{
  "source": "tautulli",
  "media_type": "{media_type}",
  "tmdb_id": "{themoviedb_id}",
  "tvdb_id": "{thetvdb_id}",
  "imdb_id": "{imdb_id}",
  "season": "{season_num}",
  "episode": "{episode_num}"
}`;

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View className="flex-row gap-2.5 items-start">
      <View className="w-5 h-5 rounded-full bg-accent items-center justify-center mt-0.5">
        <Text className="text-accent-fg text-[11px] font-extrabold">{n}</Text>
      </View>
      <Text className="text-fg text-[13.5px] flex-1 leading-[19px]">
        {children}
      </Text>
    </View>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <Text selectable className="text-accent text-[11.5px] font-semibold">
      {children}
    </Text>
  );
}

/**
 * Connecter un serveur média (Pro) : génère l'URL de webhook personnelle et
 * guide la configuration Plex / Jellyfin / Tautulli. Tout ce qui est terminé
 * là-bas est marqué vu ici — comme le scrobbling Kodi, mais côté serveur.
 */
export default function ConnectServerScreen() {
  const router = useRouter();
  const { isPro } = usePro();
  const { show: openSheet, sheet } = useActionSheet();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  useEffect(() => {
    if (!isPro) return;
    supabase
      .from('scrobble_tokens')
      .select('token')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.token) setToken(data.token);
      });
  }, [isPro]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc(
      'create_scrobble_token'
    );
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setToken(data as string);
  };

  const url = token ? `${WEBHOOK_BASE}?key=${token}` : null;

  const copy = async (value: string) => {
    // expo-clipboard chargé paresseusement : absent des builds pré-rebuild,
    // le texte reste sélectionnable à la main.
    try {
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copie indisponible — sélectionne le texte à la main.');
    }
  };

  const confirmRegenerate = () =>
    // ActionSheet maison : fonctionne aussi sur web (Alert.alert n'y est
    // qu'un no-op).
    openSheet({
      title: "Régénérer l'URL ?",
      message: "L'ancienne URL cessera de fonctionner sur tous tes serveurs.",
      actions: [
        { label: 'Régénérer', variant: 'danger', onPress: generate },
      ],
    });

  if (!isPro) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <EmptyState
          icon="server-outline"
          title="Scrobbling Plex · Jellyfin"
          subtitle="Connecte ton serveur média : tout ce que tu y termines est marqué vu ici, automatiquement. C'est une fonctionnalité Pro."
          action={{ label: 'Découvrir Pro', onPress: () => router.push('/pro') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {sheet}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
          gap: 16,
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
        }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable onPress={goBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text className="text-fg text-2xl font-extrabold">
            Connecter un serveur
          </Text>
        </View>
        <Muted>
          Plex, Jellyfin ou Tautulli : tout ce que tu termines sur ton serveur
          est marqué vu ici, automatiquement. L'identification passe par les
          identifiants TMDB/TVDB — fiable à 100 %, aucune devinette de titre.
        </Muted>

        {/* URL personnelle */}
        <View className="bg-surface rounded-2xl p-4 gap-3">
          <Text className="text-fg text-[15px] font-bold">
            Ton URL de webhook
          </Text>
          {url ? (
            <>
              <Text
                selectable
                className="text-accent text-[12px] font-semibold leading-[17px]"
              >
                {url}
              </Text>
              <View className="flex-row gap-2.5">
                <Button
                  title={copied ? 'Copiée ✓' : "Copier l'URL"}
                  onPress={() => copy(url)}
                />
              </View>
              <Pressable onPress={confirmRegenerate} hitSlop={6}>
                <Text className="text-muted text-[12px] underline">
                  Régénérer (invalide l'ancienne)
                </Text>
              </Pressable>
            </>
          ) : (
            <Button
              title="Générer mon URL"
              onPress={generate}
              loading={loading}
            />
          )}
          {error ? (
            <Text className="text-danger text-[12.5px]">{error}</Text>
          ) : null}
          <Muted>
            Cette URL est un secret : quiconque la connaît peut marquer des
            visionnages sur ton compte.
          </Muted>
        </View>

        {/* Plex */}
        <View className="bg-surface rounded-2xl p-4 gap-3">
          <Text className="text-fg text-[15px] font-bold">
            Plex <Text className="text-muted text-[11px]">(Plex Pass requis)</Text>
          </Text>
          <Step n={1}>
            app.plex.tv → Paramètres → <Mono>Webhooks</Mono> →{' '}
            <Mono>Ajouter un webhook</Mono>.
          </Step>
          <Step n={2}>Colle ton URL ci-dessus, enregistre. C'est tout.</Step>
          <Muted>
            Le scrobble part quand un film/épisode dépasse ~90 % de lecture.
            Sans Plex Pass, passe par Tautulli (gratuit) ci-dessous.
          </Muted>
        </View>

        {/* Jellyfin */}
        <View className="bg-surface rounded-2xl p-4 gap-3">
          <Text className="text-fg text-[15px] font-bold">Jellyfin</Text>
          <Step n={1}>
            Tableau de bord → Extensions → Catalogue → installe{' '}
            <Mono>Webhook</Mono>, puis redémarre Jellyfin.
          </Step>
          <Step n={2}>
            Extensions → Webhook → <Mono>Add Generic Destination</Mono> : colle
            ton URL.
          </Step>
          <Step n={3}>
            Coche <Mono>Playback Stop</Mono> (Notification Type),{' '}
            <Mono>Movies</Mono> + <Mono>Episodes</Mono> (Item Type), et{' '}
            <Mono>Send All Properties</Mono>.
          </Step>
        </View>

        {/* Tautulli */}
        <View className="bg-surface rounded-2xl p-4 gap-3">
          <Text className="text-fg text-[15px] font-bold">
            Tautulli <Text className="text-muted text-[11px]">(Plex sans Pass)</Text>
          </Text>
          <Step n={1}>
            Settings → Notification Agents → <Mono>Add a new notification
            agent</Mono> → <Mono>Webhook</Mono>.
          </Step>
          <Step n={2}>
            Webhook URL = ton URL · Webhook Method = <Mono>POST</Mono> ·
            déclencheur <Mono>Watched</Mono>.
          </Step>
          <Step n={3}>Onglet Data → Watched → JSON Data, colle :</Step>
          <View className="bg-bg rounded-xl p-3">
            <Text selectable className="text-accent text-[11px] font-semibold leading-4">
              {TAUTULLI_TEMPLATE}
            </Text>
          </View>
          <View className="flex-row">
            <Button title="Copier le gabarit" variant="ghost" onPress={() => copy(TAUTULLI_TEMPLATE)} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
