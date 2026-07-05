import AsyncStorage from '@react-native-async-storage/async-storage';
import { Uniwind } from 'uniwind';
import { colors } from '@/lib/theme';

/**
 * Thèmes d'accent (Pro) : change la couleur signature de l'app.
 * Deux canaux à synchroniser :
 *  - les className Tailwind (bg-accent…) via Uniwind.updateCSSVariables
 *  - l'objet `colors` (icônes, navigation…) muté en place — les écrans le
 *    lisent au rendu, donc l'application au démarrage + au changement suffit.
 * Tous les accents restent clairs → texte d'accent sombre constant.
 */
export interface AccentTheme {
  key: string;
  label: string;
  accent: string;
  accentFg: string;
}

export const ACCENT_THEMES: AccentTheme[] = [
  { key: 'popcorn', label: 'Pop-corn', accent: '#FFD449', accentFg: '#1A1A05' },
  { key: 'menthe', label: 'Menthe', accent: '#4CC38A', accentFg: '#04140C' },
  { key: 'lagon', label: 'Lagon', accent: '#5EEAD4', accentFg: '#042F2A' },
  { key: 'flamant', label: 'Flamant', accent: '#F9A8D4', accentFg: '#3B0A24' },
  { key: 'orange', label: 'Sunset', accent: '#FDBA74', accentFg: '#3B1A05' },
  { key: 'lavande', label: 'Lavande', accent: '#C4B5FD', accentFg: '#1E1B4B' },
];

const STORAGE_KEY = 'pref:accent_theme';

export function applyAccentTheme(key: string): void {
  const theme = ACCENT_THEMES.find((t) => t.key === key) ?? ACCENT_THEMES[0];
  colors.accent = theme.accent;
  colors.accentText = theme.accentFg;
  Uniwind.updateCSSVariables(Uniwind.currentTheme, {
    '--color-accent': theme.accent,
    '--color-accent-fg': theme.accentFg,
  });
}

export async function setAccentTheme(key: string): Promise<void> {
  applyAccentTheme(key);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(key)).catch(() => {});
}

export async function getAccentThemeKey(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string) : 'popcorn';
  } catch {
    return 'popcorn';
  }
}

/** À appeler au démarrage (root layout) : ré-applique le thème persisté. */
export async function restoreAccentTheme(): Promise<void> {
  const key = await getAccentThemeKey();
  if (key !== 'popcorn') applyAccentTheme(key);
}
