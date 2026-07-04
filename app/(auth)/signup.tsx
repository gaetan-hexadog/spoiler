import { Link } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { Muted, Screen } from '@/components/ui';

// Inscriptions fermées pour le moment (verrou également activé côté
// Supabase : Authentication → Sign In / Up → Allow new users to sign up).
export default function SignupScreen() {
  return (
    <Screen>
      <View className="flex-1 justify-center p-6">
        <View className="w-full max-w-[420px] self-center gap-3 items-center">
          <Logo />
          <Text className="text-fg text-lg font-bold text-center mt-4">
            Les inscriptions sont fermées
          </Text>
          <Muted>PopcornLog est pour l'instant une application privée.</Muted>
          <Link
            href="/login"
            className="text-accent text-center mt-4 text-sm font-semibold"
          >
            ← Retour à la connexion
          </Link>
        </View>
      </View>
    </Screen>
  );
}
