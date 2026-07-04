import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import React, { forwardRef } from 'react';
import {
  Image,
  Pressable,
  Text,
  View,
  type PressableProps,
  type View as ViewType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Loading } from '@/components/ui';
import { useBreakpoint, type Breakpoint } from '@/hooks/useBreakpoint';
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
  breakpoint: Breakpoint;
};

/** Bouton d'onglet — trois habillages : bottom bar, rail, sidebar. */
const TabButton = forwardRef<ViewType, TabButtonProps>(
  ({ isFocused, icon, label, breakpoint, ...props }, ref) => {
    const iconName = (isFocused ? icon : `${icon}-outline`) as keyof typeof Ionicons.glyphMap;
    const color = isFocused ? colors.accent : colors.textMuted;

    if (breakpoint === 'desktop') {
      return (
        <Pressable
          ref={ref}
          {...props}
          className={`flex-row items-center gap-3 px-4 py-3 rounded-xl ${
            isFocused ? 'bg-accent/10' : ''
          }`}
        >
          <Ionicons name={iconName} size={20} color={color} />
          {/* <Text
            className={`text-[15px] font-bold ${
              isFocused ? 'text-accent' : 'text-muted'
            }`}
          >
            {label}
          </Text> */}
        </Pressable>
      );
    }

    if (breakpoint === 'tablet') {
      // Rail : icônes seules, le libellé déborderait.
      return (
        <Pressable
          ref={ref}
          {...props}
          className={`items-center py-3.5 rounded-xl ${
            isFocused ? 'bg-accent/10' : ''
          }`}
        >
          <Ionicons name={iconName} size={24} color={color} />
        </Pressable>
      );
    }

    // TabTrigger impose flexDirection row via son style cloné → on force
    // explicitement la colonne pour la bottom bar.
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
  const breakpoint = useBreakpoint();
  const insets = useSafeAreaInsets();

  if (loading) return <Loading />;
  if (!session) return <Redirect href="/login" />;

  const sidebar = breakpoint !== 'mobile';

  return (
    <Tabs
      style={{
        flex: 1,
        flexDirection: sidebar ? 'row' : 'column',
        backgroundColor: colors.bg,
      }}
    >
      {sidebar ? (
        <TabList
          style={{
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'stretch',
            width: breakpoint === 'desktop' ? 72 : 72,
            paddingTop: insets.top + 20,
            paddingHorizontal: 12,
            gap: 4,
            borderRightWidth: 1,
            borderRightColor: colors.border,
          }}
        >
          <View
            className={`items-center pb-6 ${
              breakpoint === 'desktop' ? 'flex-row gap-3 px-4' : ''
            }`}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 34, height: 22 }}
              resizeMode="contain"
            />
            {/* {breakpoint === 'desktop' ? (
              <Text className="text-fg text-lg font-extrabold">PopcornLog</Text>
            ) : null} */}
          </View>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton
                icon={tab.icon}
                label={tab.label}
                breakpoint={breakpoint}
              />
            </TabTrigger>
          ))}
        </TabList>
      ) : null}

      <TabSlot style={{ flex: 1 }} />

      {!sidebar ? (
        <TabList
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 6),
            paddingTop: 4,
            backgroundColor: colors.bg,
          }}
        >
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton
                icon={tab.icon}
                label={tab.label}
                breakpoint={breakpoint}
              />
            </TabTrigger>
          ))}
        </TabList>
      ) : null}
    </Tabs>
  );
}
