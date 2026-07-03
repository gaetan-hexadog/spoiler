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

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signUp() {
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
        className="flex-1 justify-center p-6 gap-2"
      >
        <Text className="text-fg text-[32px] font-extrabold text-center">
          🍿 Spoiler
        </Text>
        <Muted>Crée ton compte pour suivre tes séries.</Muted>
        <View className="mt-8 gap-4">
          <Input
            placeholder="Pseudo"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <Input
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            placeholder="Mot de passe (8 caractères min.)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button
            title="Créer mon compte"
            onPress={signUp}
            loading={loading}
            disabled={!email || password.length < 8}
          />
          <Link href="/login" className="text-accent text-center mt-2 text-sm">
            Déjà un compte ? Se connecter
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
