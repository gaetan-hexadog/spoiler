import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

export interface ActionSheetAction {
  label: string;
  variant?: 'default' | 'primary' | 'danger';
  onPress: () => void;
}

export interface ActionSheetConfig {
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
}

/** Bottom-sheet maison — remplace les Alert natifs pour les choix. */
export function ActionSheet({
  visible,
  title,
  message,
  actions,
  onClose,
}: ActionSheetConfig & { visible: boolean; onClose: () => void }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-bg/70 justify-end" onPress={onClose}>
        <Pressable
          className="bg-surface rounded-t-3xl px-5 pt-3 pb-9 gap-2"
          onPress={(event) => event.stopPropagation()}
        >
          {/* Poignée : signale que la sheet se ferme d'un tap sur le fond. */}
          <View className="self-center w-10 h-1 rounded-full bg-surface-light mb-2" />
          {title ? (
            <Text className="text-fg text-lg font-bold">{title}</Text>
          ) : null}
          {message ? (
            <Text className="text-muted text-sm mb-1">{message}</Text>
          ) : null}
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              className={`py-3.5 rounded-xl items-center ${
                action.variant === 'danger'
                  ? 'bg-danger/15'
                  : action.variant === 'primary'
                    ? 'bg-accent'
                    : 'bg-surface-light'
              }`}
              style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
            >
              <Text
                className={`text-[15px] font-bold ${
                  action.variant === 'danger'
                    ? 'text-danger'
                    : action.variant === 'primary'
                      ? 'text-accent-fg'
                      : 'text-fg'
                }`}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Contrôleur : `const { show, sheet } = useActionSheet()` puis rendre {sheet}. */
export function useActionSheet() {
  const [config, setConfig] = useState<ActionSheetConfig | null>(null);
  const sheet = config ? (
    <ActionSheet
      visible
      title={config.title}
      message={config.message}
      actions={config.actions}
      onClose={() => setConfig(null)}
    />
  ) : null;
  return { show: setConfig, sheet };
}
