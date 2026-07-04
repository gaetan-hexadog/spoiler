import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

const ITEMS = [
  { href: '/', icon: 'albums', match: (p: string) => p === '/' },
  {
    href: '/calendar',
    icon: 'calendar',
    match: (p: string) => p.startsWith('/calendar'),
  },
  {
    href: '/discover',
    icon: 'compass',
    match: (p: string) => p.startsWith('/discover'),
  },
  {
    href: '/profile',
    icon: 'person',
    match: (p: string) => p.startsWith('/profile'),
  },
] as const;

/**
 * Rail de navigation persistant (tablette/desktop). Réutilisé par les écrans
 * hors du groupe (tabs) — fiches détail — pour garder la sidebar visible.
 */
export function DesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Section active : l'onglet courant, ou le dernier visité quand on est sur
  // une fiche détail (hors onglets) — pour garder un surlignage cohérent.
  const [lastSection, setLastSection] = useState('/');
  const currentMatch = ITEMS.find((item) => item.match(pathname))?.href;
  useEffect(() => {
    if (currentMatch) setLastSection(currentMatch);
  }, [currentMatch]);
  const activeHref = currentMatch ?? lastSection;

  return (
    <View
      style={{
        width: 72,
        paddingTop: insets.top + 20,
        paddingHorizontal: 12,
        gap: 4,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      <View className="items-center pb-6">
        <Image
          source={require('../assets/logo.png')}
          style={{ width: 34, height: 22 }}
          resizeMode="contain"
        />
      </View>
      {ITEMS.map((item) => {
        const active = item.href === activeHref;
        const iconName = (active ? item.icon : `${item.icon}-outline`) as keyof typeof Ionicons.glyphMap;
        return (
          <Pressable
            key={item.href}
            onPress={() => router.navigate(item.href)}
            className={`items-center py-3.5 rounded-xl ${active ? 'bg-accent/10' : ''}`}
          >
            <Ionicons
              name={iconName}
              size={24}
              color={active ? colors.accent : colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
