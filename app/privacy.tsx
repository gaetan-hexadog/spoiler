import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

/**
 * Politique de confidentialité — page statique, accessible connecté (Paramètres)
 * comme déconnecté (écran d'inscription). Sert aussi d'URL publique via le build
 * web (Netlify) : https://<domaine>/privacy — à renseigner dans les fiches store.
 *
 * ⚠️ Modèle à faire relire ; remplace l'email de contact et l'entité juridique.
 */
const CONTACT_EMAIL = 'contact@hexadog.com';
const LAST_UPDATED = '5 juillet 2026';

function H({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-fg text-[17px] font-extrabold mt-6 mb-2">
      {children}
    </Text>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-muted text-[14px] leading-[22px] mb-2">{children}</Text>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();
  // Sortie garantie même sans historique (accès direct par URL, ou depuis
  // signup après un refresh) : back si possible, sinon retour à l'accueil
  // (qui redirige vers /login si déconnecté).
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 48,
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
        }}
      >
        <Pressable
          onPress={goBack}
          hitSlop={8}
          className="flex-row items-center gap-2 py-2 -ml-1 mb-2 self-start"
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
          <Text className="text-fg text-[15px] font-bold">Retour</Text>
        </Pressable>
        <Text className="text-fg text-2xl font-extrabold">
          Politique de confidentialité
        </Text>
        <Text className="text-muted text-[12px] mt-1">
          Dernière mise à jour : {LAST_UPDATED}
        </Text>

        <P>
          PopcornLog (« l'application ») t'aide à suivre les séries et films que
          tu regardes. Cette page explique quelles données sont collectées,
          pourquoi, et tes droits.
        </P>

        <H>Données que nous collectons</H>
        <P>
          • Compte : ton adresse e-mail et un pseudo optionnel, pour
          l'authentification.
        </P>
        <P>
          • Activité de visionnage : séries et films suivis, épisodes marqués
          vus, notes, statuts et dates associées — c'est le cœur du service.
        </P>
        <P>
          • Données techniques minimales nécessaires au fonctionnement
          (jetons de session). Nous n'intégrons pas de traceurs publicitaires.
        </P>

        <H>Comment ces données sont utilisées</H>
        <P>
          Uniquement pour fournir le service : afficher ta bibliothèque, ta
          progression, tes statistiques et tes rappels de diffusion. Nous ne
          vendons ni ne louons tes données personnelles.
        </P>

        <H>Hébergement et sous-traitants</H>
        <P>
          Tes données sont stockées chez Supabase (base de données et
          authentification). Les métadonnées et affiches des œuvres proviennent
          de l'API TMDB, et les disponibilités de streaming de JustWatch ; ces
          services reçoivent uniquement des requêtes de catalogue, jamais ta
          liste personnelle. Ce produit utilise l'API TMDB mais n'est ni
          approuvé ni certifié par TMDB.
        </P>

        <H>Notifications</H>
        <P>
          Si tu les actives, l'application programme des rappels locaux de
          diffusion sur ton appareil. Elles peuvent être désactivées à tout
          moment dans les Paramètres.
        </P>

        <H>Conservation et suppression</H>
        <P>
          Tes données sont conservées tant que ton compte existe. Tu peux
          supprimer ton compte à tout moment depuis Paramètres → « Supprimer mon
          compte » : l'ensemble de tes données (séries, films, historique,
          notes) est alors définitivement effacé.
        </P>

        <H>Tes droits</H>
        <P>
          Conformément au RGPD, tu disposes d'un droit d'accès, de
          rectification, de suppression et de portabilité de tes données. Pour
          l'exercer, écris-nous à {CONTACT_EMAIL}.
        </P>

        <H>Enfants</H>
        <P>
          L'application n'est pas destinée aux enfants de moins de 13 ans et ne
          collecte pas sciemment leurs données.
        </P>

        <H>Modifications</H>
        <P>
          Cette politique peut évoluer ; la date de mise à jour en haut de page
          sera modifiée en conséquence.
        </P>

        <H>Contact</H>
        <P>Pour toute question : {CONTACT_EMAIL}.</P>

        <View className="h-6" />
      </ScrollView>
    </Screen>
  );
}
