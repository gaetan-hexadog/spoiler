import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/** Point de rupture courant : mobile < 768 ≤ tablet < 1024 ≤ desktop. */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}
