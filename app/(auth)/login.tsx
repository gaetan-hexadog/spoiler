import { Link } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from 'react-native';
import { Logo } from '@/components/Logo';
import { Button, Input, Muted, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function signIn() {
    if (!email || !password || loading) return;
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
        className="flex-1 justify-center p-6"
      >
        <View className="w-full max-w-[420px] self-center gap-3">
          <Logo />
          <Muted>Tes séries et films, épisode par épisode.</Muted>
          <View className="mt-6 gap-4">
            <Input
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Input
              ref={passwordRef}
              placeholder="Mot de passe"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={signIn}
            />
            <Button
              title="Se connecter"
              onPress={signIn}
              loading={loading}
              disabled={!email || !password}
            />
            <Link
              href="/signup"
              className="text-accent text-center mt-1 text-sm font-semibold"
            >
              Pas encore de compte ? Créer un compte
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
