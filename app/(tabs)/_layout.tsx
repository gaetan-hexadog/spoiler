import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import React, { forwardRef } from 'react';
import {
  Pressable,
  Text,
  View,
  type PressableProps,
  type View as ViewType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Loading } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

const TABS = [
  { name: 'index', href: '/' as const, icon: 'albums', label: 'Ma liste' },
  {
    name: 'calendar',
    href: '/calendar' as const,
    icon: 'calendar',
    label: 'Calendrier',
  },
  {
    name: 'discover',
    href: '/discover' as const,
    icon: 'compass',
    label: 'Découvrir',
  },
  { name: 'profile', href: '/profile' as const, icon: 'person', label: 'Profil' },
] as const;

type TabButtonProps = PressableProps & {
  isFocused?: boolean;
  icon: string;
  label: string;
};

/** Bouton de la bottom bar mobile (icône + libellé). */
const TabButton = forwardRef<ViewType, TabButtonProps>(
  ({ isFocused, icon, label, ...props }, ref) => {
    const iconName = (isFocused ? icon : `${icon}-outline`) as keyof typeof Ionicons.glyphMap;
    const color = isFocused ? colors.accent : colors.textMuted;
    const { style, ...rest } = props;
    return (
      <Pressable
        ref={ref}
        {...rest}
        style={[
          style as object,
          { flexDirection: 'column', alignItems: 'center', flex: 1 },
        ]}
        className="gap-0.5 py-2"
      >
        <Ionicons name={iconName} size={22} color={color} />
        <Text
          className={`text-[11px] font-semibold ${
            isFocused ? 'text-accent' : 'text-muted'
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
);
TabButton.displayName = 'TabButton';

export default function TabsLayout() {
  const { session, loading } = useAuth();
  const wide = useBreakpoint() !== 'mobile';
  const insets = useSafeAreaInsets();

  if (loading) return <Loading />;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Le TabSlot headless (expo-router/ui) ne pose pas de safe-area : on
          réserve l'inset haut via pt-safe (Uniwind → rt.insets.top, alimenté
          par le SafeAreaListener du layout racine). Sans ça, le contenu des
          onglets passe sous la status bar sur mobile. */}
      <View className="flex-1 pt-safe">
        <TabSlot style={{ flex: 1 }} />
      </View>
      {/* Desktop/tablette : la sidebar est fournie par le layout racine, la
          TabList reste montée mais masquée pour enregistrer les onglets. */}
      <TabList
        style={
          wide
            ? { position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }
            : {
                flexDirection: 'row',
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 6),
                paddingTop: 4,
                backgroundColor: colors.bg,
              }
        }
      >
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabButton icon={tab.icon} label={tab.label} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}
