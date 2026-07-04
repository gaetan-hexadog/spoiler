import { useWindowDimensions } from 'react-native';

/** Largeur max du contenu sur grand écran (voir <Screen/>). */
export const CONTENT_MAX_WIDTH = 1200;

/**
 * Nombre de colonnes d'une grille d'affiches selon la place disponible :
 * ~140 px par affiche, entre 3 (téléphone) et 8 (desktop).
 */
export function useGridColumns(target = 140, min = 3, max = 8): number {
  const { width } = useWindowDimensions();
  const effective = Math.min(width, CONTENT_MAX_WIDTH);
  return Math.max(min, Math.min(max, Math.floor(effective / target)));
}
