import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors } from '@/lib/theme';

export function Screen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // Contenu centré et borné sur grand écran (web/tablette),
  // pleine largeur sur téléphone.
  return (
    <View className={`flex-1 bg-bg ${className ?? ''}`}>
      <View className="flex-1 w-full max-w-[1200px] self-center">
        {children}
      </View>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-fg text-lg font-bold mt-7 mb-3 px-4">{children}</Text>
  );
}

const MUTED_SIZES = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
} as const;

export function Muted({
  children,
  size = 'sm',
  className,
}: {
  children: React.ReactNode;
  size?: keyof typeof MUTED_SIZES;
  className?: string;
}) {
  return (
    <Text
      className={`text-muted ${MUTED_SIZES[size]} text-center ${className ?? ''}`}
    >
      {children}
    </Text>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-accent',
  ghost: 'bg-surface-light',
  danger: 'bg-danger',
} as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: keyof typeof BUTTON_VARIANTS;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`py-3 px-4 rounded-lg items-center justify-center ${BUTTON_VARIANTS[variant]}`}
      style={({ pressed }) =>
        pressed || disabled || loading ? { opacity: 0.6 } : undefined
      }
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.accentText : colors.text}
        />
      ) : (
        <Text
          className={`font-bold text-[15px] ${
            variant === 'primary' ? 'text-accent-fg' : 'text-fg'
          }`}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export const Input = React.forwardRef<TextInput, TextInputProps>(
  (props, ref) => (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.textMuted}
      className="bg-surface rounded-lg border border-line text-fg px-4 py-3 text-[15px]"
      {...props}
    />
  )
);
Input.displayName = 'Input';

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center gap-2 p-6">
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  icon = 'albums-outline',
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-8 py-10">
      <View
        className="w-[74px] h-[74px] rounded-[20px] items-center justify-center mb-2"
        style={{ backgroundColor: colors.surface }}
      >
        <Ionicons name={icon} size={34} color={colors.accent} />
      </View>
      <Text className="text-fg text-[17px] font-extrabold text-center">
        {title}
      </Text>
      {subtitle ? <Muted>{subtitle}</Muted> : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          className="mt-4 bg-accent rounded-xl px-6 py-3"
          style={({ pressed }) => (pressed ? { opacity: 0.75 } : undefined)}
        >
          <Text className="text-accent-fg text-[14px] font-extrabold">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View className="h-1.5 rounded-full bg-surface-light overflow-hidden">
      <View
        className="h-full rounded-full bg-accent"
        style={{ width: `${clamped * 100}%` }}
      />
    </View>
  );
}
