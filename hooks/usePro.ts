import { usePersistedState } from '@/hooks/usePersistedState';

/**
 * Entitlement « PopcornLog Pro ».
 *
 * Source de vérité à terme : RevenueCat (achat App Store / Play) → webhook →
 * `profiles.is_pro` en base, lu ici. En attendant l'intégration facturation,
 * on s'appuie sur un override local (persisté) qui permet de développer et
 * tester les écrans Pro des deux côtés du paywall.
 *
 * Le jour où RevenueCat est branché : remplacer le corps par la lecture de
 * l'entitlement (Purchases.getCustomerInfo()) ou du flag serveur, et garder la
 * même signature `{ isPro }` pour ne rien changer chez les appelants.
 */
export function usePro() {
  const [devOverride, setDevOverride] = usePersistedState(
    'pro_dev_override',
    false
  );
  return { isPro: devOverride, setDevOverride };
}
