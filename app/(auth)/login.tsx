import { Link } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from 'react-native';
import { Button, Input, Muted, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) Alert.alert('Connexion impossible', error.message);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center p-6 gap-2"
      >
        <Text className="text-fg text-[32px] font-extrabold text-center">
          🍿 Spoiler
        </Text>
        <Muted>Tes séries et films, épisode par épisode.</Muted>
        <View className="mt-8 gap-4">
          <Input
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            placeholder="Mot de passe"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button
            title="Se connecter"
            onPress={signIn}
            loading={loading}
            disabled={!email || !password}
          />
          <Link href="/signup" className="text-accent text-center mt-2 text-sm">
            Pas encore de compte ? S'inscrire
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
