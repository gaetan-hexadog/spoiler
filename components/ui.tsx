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

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text className="text-muted text-sm text-center">{children}</Text>;
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
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-2 p-6">
      <Text className="text-fg text-[17px] font-semibold text-center">
        {title}
      </Text>
      {subtitle ? <Muted>{subtitle}</Muted> : null}
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
