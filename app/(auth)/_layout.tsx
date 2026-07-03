import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { Loading } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';

export default function AuthLayout() {
  const { session, loading } = useAuth();

  if (loading) return <Loading />;
  if (session) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
