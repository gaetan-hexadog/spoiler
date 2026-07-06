import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Screen } from '@/components/ui';
import { usePro } from '@/hooks/usePro';
import { colors } from '@/lib/theme';

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  {
    icon: 'infinite',
    title: 'Suivi illimité',
    sub: 'Aucune limite de séries ni de films dans ta bibliothèque.',
  },
  {
    icon: 'stats-chart',
    title: 'Statistiques avancées',
    sub: 'Temps par genre, records, heatmap annuelle complète, bilans.',
  },
  {
    icon: 'albums',
    title: 'Listes personnalisées',
    sub: 'Crée tes collections (à binge-watcher, favoris, thématiques…).',
  },
  {
    icon: 'play-circle',
    title: 'Bandes-annonces en un tap',
    sub: 'Lance la bande-annonce directement depuis la fiche.',
  },
  {
    icon: 'calendar',
    title: 'Export calendrier',
    sub: 'Tes prochaines diffusions dans ton agenda (.ics).',
  },
  {
    icon: 'server',
    title: 'Scrobbling Plex · Jellyfin · Kodi',
    sub: 'Tout ce que tu termines sur ton serveur média est marqué vu ici.',
  },
  {
    icon: 'cloud-upload',
    title: 'Sauvegarde de tes données',
    sub: 'Export JSON complet vers Google Drive, Files… en un tap.',
  },
  {
    icon: 'color-palette',
    title: 'Thèmes & icônes',
    sub: 'Personnalise l’apparence et l’icône de l’app.',
  },
  {
    icon: 'sparkles',
    title: 'Accès anticipé',
    sub: 'Les nouvelles fonctions en avant-première, sans pub.',
  },
];

export default function ProScreen() {
  const router = useRouter();
  const { isPro, setDevOverride } = usePro();

  // Sortie garantie même sans historique (URL directe).
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const subscribe = () => {
    // TODO facturation : brancher RevenueCat (Purchases.purchasePackage).
    Alert.alert(
      'Bientôt disponible',
      "L'abonnement PopcornLog Pro arrive très vite. Merci de ton intérêt !"
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
        }}
      >
        <Pressable
          onPress={goBack}
          hitSlop={8}
          className="flex-row items-center gap-2 py-2 -ml-1 self-start"
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
          <Text className="text-fg text-[15px] font-bold">Retour</Text>
        </Pressable>
        <View className="items-center gap-2 mt-2 mb-4">
          <View className="w-16 h-16 rounded-3xl bg-accent items-center justify-center">
            <Ionicons name="star" size={30} color={colors.accentText} />
          </View>
          <Text className="text-fg text-[26px] font-extrabold text-center">
            PopcornLog Pro
          </Text>
          <Text className="text-muted text-[14px] text-center px-4">
            {isPro
              ? 'Tu es Pro — merci de ton soutien ✨'
              : 'Débloque tout le potentiel de ton suivi.'}
          </Text>
        </View>

        <View className="gap-2.5">
          {BENEFITS.map((b) => (
            <View
              key={b.title}
              className="flex-row items-center gap-3 bg-surface rounded-2xl p-3.5"
            >
              <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: 'rgba(255,212,73,0.12)' }}>
                <Ionicons name={b.icon} size={19} color={colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-fg text-[14.5px] font-bold">{b.title}</Text>
                <Text className="text-muted text-[12px] mt-0.5">{b.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {!isPro ? (
          <View className="mt-6 gap-2">
            <Button title="S'abonner — 2,99 €/mois" onPress={subscribe} />
            <Pressable onPress={subscribe} hitSlop={6} className="py-2">
              <Text className="text-muted text-center text-[13px]">
                ou 19,99 €/an <Text className="text-accent font-bold">(−44 %)</Text>
              </Text>
            </Pressable>
            <Text className="text-muted text-center text-[11px] px-4 mt-1">
              Abonnement sans engagement, résiliable à tout moment. Paiement via
              l’App Store / Google Play.
            </Text>
          </View>
        ) : (
          <View className="mt-6">
            <Button
              title="Retour"
              variant="ghost"
              onPress={() => router.back()}
            />
          </View>
        )}

        {/* Bloc DEV — à retirer quand RevenueCat sera branché. Permet de tester
            l'app des deux côtés du paywall sans achat réel. */}
        {__DEV__ ? (
          <Pressable
            onPress={() => setDevOverride(!isPro)}
            className="mt-6 py-2 items-center"
          >
            <Text className="text-muted text-[11px] underline">
              [dev] {isPro ? 'Désactiver' : 'Activer'} Pro localement
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
