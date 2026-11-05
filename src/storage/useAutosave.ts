import { useEffect, useRef, useState } from 'react';
import type { PF1Character } from '../types/character';
import { formatStorageTimestamp, getStorageErrorMessage, useStorage } from './StorageContext';

export interface AutosaveState {
  isAutosaving: boolean;
  lastAutosavedAt: string | null;
  error: string | null;
}

/**
 * Debounced crash autosave hook.
 * Calls storage.autosaveCrash(character) ~1 second after character changes.
 */
export function useAutosave(character: PF1Character, enabled: boolean = true): AutosaveState {
  const storage = useStorage();
  const isInitialMount = useRef(true);
  const [state, setState] = useState<AutosaveState>({
    isAutosaving: false,
    lastAutosavedAt: null,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;

    // Skip firing autosave on the initial render before any user edits
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      setState((prev) => ({ ...prev, isAutosaving: true, error: null }));
      try {
        const res = await storage.autosaveCrash(character);
        if (res.ok) {
          setState({
            isAutosaving: false,
            lastAutosavedAt: formatStorageTimestamp(res.savedAt) || res.savedAt,
            error: null,
          });
        } else {
          setState((prev) => ({
            ...prev,
            isAutosaving: false,
            error: getStorageErrorMessage(res.error),
          }));
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isAutosaving: false,
          error: err instanceof Error ? err.message : 'Autosave failed',
        }));
      }
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [character, enabled, storage]);

  return state;
}
