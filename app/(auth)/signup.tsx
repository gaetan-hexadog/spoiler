import { Link } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { Muted, Screen } from '@/components/ui';

// Inscriptions fermées pour le moment (verrou également activé côté
// Supabase : Authentication → Sign In / Up → Allow new users to sign up).
export default function SignupScreen() {
  return (
    <Screen>
      <View className="flex-1 justify-center p-6 gap-3">
        <Text className="text-fg text-[32px] font-extrabold text-center">
          🍿 Spoiler
        </Text>
        <Text className="text-fg text-lg font-bold text-center">
          Les inscriptions sont fermées
        </Text>
        <Muted>
          Spoiler est pour l'instant une application privée.
        </Muted>
        <Link
          href="/login"
          className="text-accent text-center mt-4 text-sm font-semibold"
        >
          ← Retour à la connexion
        </Link>
      </View>
    </Screen>
  );
}
