import { Link } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Logo } from '@/components/Logo';
import { Button, Input, Muted, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function signUp() {
    if (!email || password.length < 8 || loading) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() || null } },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Inscription impossible', error.message);
      return;
    }
    if (!data.session) {
      Alert.alert(
        'Vérifie ta boîte mail',
        'Un email de confirmation vient de t’être envoyé.'
      );
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center p-6"
      >
        <View className="w-full max-w-[420px] self-center gap-3">
          <Logo />
          <Muted>Crée ton compte — tes séries et films, épisode par épisode.</Muted>
          <View className="mt-6 gap-4">
            <Input
              placeholder="Pseudo"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            <Input
              ref={emailRef}
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
              placeholder="Mot de passe (8 caractères min.)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={signUp}
            />
            <Button
              title="Créer mon compte"
              onPress={signUp}
              loading={loading}
              disabled={!email || password.length < 8}
            />
            <Text className="text-muted text-center text-[11px] px-2">
              En créant un compte, tu acceptes notre{' '}
              <Link href="/privacy" className="text-accent">
                politique de confidentialité
              </Link>
              .
            </Text>
            <Link
              href="/login"
              className="text-accent text-center mt-1 text-sm font-semibold"
            >
              Déjà un compte ? Se connecter
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
