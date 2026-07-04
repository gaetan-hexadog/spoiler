import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';

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

/** Feuille d'actions maison — remplace les Alert natifs pour les choix. */
export function ActionSheet({
  visible,
  title,
  message,
  actions,
  onClose,
  onDismissed,
}: ActionSheetConfig & {
  visible: boolean;
  onClose: () => void;
  onDismissed?: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} onDismissed={onDismissed}>
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
    </BottomSheet>
  );
}

/** Contrôleur : `const { show, sheet } = useActionSheet()` puis rendre {sheet}. */
export function useActionSheet() {
  const [config, setConfig] = useState<ActionSheetConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const show = (next: ActionSheetConfig) => {
    setConfig(next);
    setVisible(true);
  };

  const sheet = config ? (
    <ActionSheet
      visible={visible}
      title={config.title}
      message={config.message}
      actions={config.actions}
      onClose={() => setVisible(false)}
      onDismissed={() => {
        // Ne pas effacer la config si une nouvelle sheet a été rouverte
        // pendant l'animation de sortie (cas de la confirmation en chaîne).
        setVisible((current) => {
          if (!current) setConfig(null);
          return current;
        });
      }}
    />
  ) : null;

  return { show, sheet };
}
