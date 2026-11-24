import { useEffect, useRef, useState } from 'react';
import type { PF1Character } from '../types/character';
import { AUTOSAVE_DEBOUNCE_MS, createSerializedWriteQueue } from './characterState';
import { formatStorageTimestamp, getStorageErrorMessage, useStorage } from './StorageContext';
import type { StorageResult, SaveReceipt } from './types';

export interface AutosaveState {
  isAutosaving: boolean;
  lastAutosavedAt: string | null;
  error: string | null;
}

/**
 * Debounced crash autosave hook.
 * Serializes writes (one in flight) and waits AUTOSAVE_DEBOUNCE_MS after edits.
 */
export function useAutosave(character: PF1Character, enabled: boolean = true): AutosaveState {
  const storage = useStorage();
  const isInitialMount = useRef(true);
  const characterRef = useRef(character);
  characterRef.current = character;
  const [state, setState] = useState<AutosaveState>({
    isAutosaving: false,
    lastAutosavedAt: null,
    error: null,
  });

  const queueRef = useRef<ReturnType<typeof createSerializedWriteQueue<PF1Character, StorageResult<Omit<SaveReceipt, 'player'>>>> | null>(null);
  if (!queueRef.current) {
    queueRef.current = createSerializedWriteQueue(async (next: PF1Character) => storage.autosaveCrash(next));
  }

  useEffect(() => {
    queueRef.current = createSerializedWriteQueue(async (next: PF1Character) => storage.autosaveCrash(next));
  }, [storage]);

  useEffect(() => {
    if (!enabled) return;

    // Skip firing autosave on the initial render before any user edits
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      const queued = characterRef.current;
      setState((prev) => ({ ...prev, isAutosaving: true, error: null }));
      void queueRef.current?.enqueue(queued).then((res) => {
        if (!res) {
          setState((prev) => ({ ...prev, isAutosaving: false, error: 'Autosave failed' }));
          return;
        }
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
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [character, enabled, storage]);

  return state;
}
