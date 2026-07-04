import * as Updates from 'expo-updates';
import React, { useEffect, useState } from 'react';
import { ActionSheet } from '@/components/ActionSheet';

/**
 * Vérifie les mises à jour OTA au démarrage : si une nouvelle version est
 * prête, propose de redémarrer via notre bottom-sheet (pas d'Alert natif).
 * « Plus tard » = la mise à jour s'appliquera au prochain lancement.
 */
export function UpdatePrompt() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable || cancelled) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        setReady(true);
        setVisible(true);
      } catch {
        // silencieux : le check au démarrage ne doit jamais gêner
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;

  return (
    <ActionSheet
      visible={visible}
      title="Mise à jour disponible"
      message="Une nouvelle version de PopcornLog est prête."
      actions={[
        {
          label: 'Redémarrer maintenant',
          variant: 'primary',
          onPress: () => Updates.reloadAsync(),
        },
        {
          label: 'Plus tard (au prochain lancement)',
          onPress: () => {},
        },
      ]}
      onClose={() => setVisible(false)}
      onDismissed={() => setReady(false)}
    />
  );
}
