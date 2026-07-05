import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, EmptyState, Input, Muted, Screen } from '@/components/ui';
import { usePro } from '@/hooks/usePro';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function PairDeviceScreen() {
  const router = useRouter();
  const { isPro } = usePro();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pair() {
    setLoading(true);
    setError(null);
    // Le jeton TMDB du plugin est injecté côté serveur (secret Supabase) :
    // le bundle de l'app n'en contient plus.
    const { data, error: fnError } = await supabase.functions.invoke(
      'pair-device',
      { body: { code: code.trim().toUpperCase() } }
    );
    setLoading(false);
    if (fnError || data?.error) {
      let message = data?.error ?? 'Association impossible.';
      if (fnError && 'context' in fnError) {
        try {
          const payload = await (
            fnError.context as Response
          ).json();
          message = payload?.error ?? message;
        } catch {
          // garde le message générique
        }
      }
      setError(message);
      return;
    }
    setDone(true);
  }

  // Scrobbling Kodi = fonctionnalité Pro (le plugin lui-même ne change pas :
  // c'est l'association d'un nouvel appareil qui est réservée).
  if (!isPro) {
    return (
      <Screen>
        <EmptyState
          icon="tv-outline"
          title="Scrobbling Kodi"
          subtitle="Associe Kodi à ton compte : tout ce que tu regardes là-bas est marqué vu ici, automatiquement. C'est une fonctionnalité Pro."
          action={{ label: 'Découvrir Pro', onPress: () => router.push('/pro') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="p-6 gap-5 w-full max-w-[420px] self-center">
        {done ? (
          <View className="items-center gap-3 pt-10">
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text className="text-fg text-xl font-extrabold">
              Appareil associé ✓
            </Text>
            <Muted>
              Kodi va récupérer sa session dans quelques secondes. Tout ce que
              tu termines là-bas sera marqué vu ici.
            </Muted>
          </View>
        ) : (
          <>
            <Text className="text-fg text-xl font-extrabold">
              Associer un appareil Kodi
            </Text>
            <Muted>
              Installe l'extension PopcornLog Scrobbler sur Kodi : elle affiche un
              code à 6 caractères. Saisis-le ici pour connecter l'appareil à ton
              compte — sans rien taper à la télécommande.
            </Muted>
            <Input
              placeholder="Code (ex : 4F7K2P)"
              value={code}
              onChangeText={(value) => setCode(value.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6 }}
            />
            {error ? (
              <Text className="text-danger text-sm text-center">{error}</Text>
            ) : null}
            <Button
              title="Associer"
              onPress={pair}
              loading={loading}
              disabled={code.trim().length !== 6}
            />
          </>
        )}
      </View>
    </Screen>
  );
}
