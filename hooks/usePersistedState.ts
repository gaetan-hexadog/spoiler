import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** useState persisté dans AsyncStorage (préférences UI). */
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    AsyncStorage.getItem(`pref:${key}`)
      .then((raw) => {
        if (raw != null) setValue(JSON.parse(raw) as T);
      })
      .catch(() => {});
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      AsyncStorage.setItem(`pref:${key}`, JSON.stringify(next)).catch(() => {});
    },
    [key]
  );

  return [value, set] as const;
}
