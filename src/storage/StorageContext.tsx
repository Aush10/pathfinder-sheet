import React, { createContext, useContext, useMemo } from 'react';
import type { PF1Character } from '../types/character';
import type {
  LoadedCharacter,
  SaveReceipt,
  StorageAdapter,
  StorageError,
  StorageResult,
  StorageStatus,
  StoredCharacterSummary,
  StoredPlayer,
} from './types';
import { createFsStorageAdapter } from './fsAdapter';
import { stubStorageAdapter } from './stubAdapter';

export function isStubModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('stub') === '1';
}

export function isDirectoryPickerSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

export function formatStorageTimestamp(isoOrTime?: string | null): string | null {
  if (!isoOrTime) return null;
  if (/^\d{2}:\d{2}$/.test(isoOrTime)) return isoOrTime;
  const parsed = new Date(isoOrTime);
  if (Number.isNaN(parsed.getTime())) return isoOrTime;
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function getStorageErrorMessage(error: StorageError | string | unknown): string {
  if (!error) return 'Storage operation failed.';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return 'Storage operation failed.';
}

export function emitStorageToastError(error: StorageError | string | unknown): void {
  const msg = getStorageErrorMessage(error);
  if (typeof window !== 'undefined' && msg) {
    window.dispatchEvent(new CustomEvent('pf1e:storage-error', { detail: { error: msg } }));
  }
}

export function emitStorageStatusRefresh(lastSavedAt?: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pf1e:storage-status-changed', {
        detail: lastSavedAt ? { lastSavedAt } : undefined,
      })
    );
  }
}

/**
 * Wraps any StorageAdapter so that:
 * 1. Every { ok: false, error } result or thrown error is routed to the toast UI.
 * 2. Adapter errors never throw uncaught exceptions or crash the character sheet.
 */
function createSafeStorageAdapter(raw: StorageAdapter): StorageAdapter {
  const toCaughtFailure = (err: unknown, fallbackMessage: string): { ok: false; error: StorageError } => {
    const message = err instanceof Error && err.message ? err.message : fallbackMessage;
    const error: StorageError = { code: 'UNEXPECTED_ERROR', message };
    emitStorageToastError(error);
    return { ok: false, error };
  };

  return {
    async saveCharacter(player: string, character: PF1Character): Promise<StorageResult<SaveReceipt>> {
      try {
        const effectivePlayer = (player || character.player || 'Player 1').trim() || 'Player 1';
        const res = await raw.saveCharacter(effectivePlayer, character);
        if (!res.ok) {
          emitStorageToastError(res.error);
        } else {
          emitStorageStatusRefresh(res.savedAt);
        }
        return res;
      } catch (err) {
        return toCaughtFailure(err, 'Failed to save character.');
      }
    },

    async autosaveCrash(character: PF1Character): Promise<StorageResult<Omit<SaveReceipt, 'player'>>> {
      try {
        // Avoid firing noisy toasts when no folder has been selected yet
        const statusRes = await raw.getStatus().catch(() => null);
        const isConnected =
          statusRes && statusRes.ok && statusRes.selected && statusRes.permission === 'granted';
        if (!isConnected && !isStubModeEnabled()) {
          return {
            ok: false,
            error: {
              code: 'FOLDER_NOT_SELECTED',
              message: 'Select a storage folder before saving.',
            },
          };
        }
        const res = await raw.autosaveCrash(character);
        if (!res.ok) {
          emitStorageToastError(res.error);
        }
        return res;
      } catch (err) {
        return toCaughtFailure(err, 'Crash autosave failed.');
      }
    },

    async loadCrash(): Promise<StorageResult<{ character: LoadedCharacter | null }>> {
      try {
        // Check status first so startup crash check does not trigger a toast before folder selection
        const statusRes = await raw.getStatus().catch(() => null);
        const isConnected =
          statusRes && statusRes.ok && statusRes.selected && statusRes.permission === 'granted';
        if (!isConnected && !isStubModeEnabled()) {
          return { ok: true, character: null };
        }
        const res = await raw.loadCrash();
        if (!res.ok) {
          emitStorageToastError(res.error);
        }
        return res;
      } catch (err) {
        return toCaughtFailure(err, 'Failed to load crash autosave.');
      }
    },

    async listPlayers(): Promise<StorageResult<{ players: StoredPlayer[] }>> {
      try {
        const statusRes = await raw.getStatus().catch(() => null);
        const isConnected =
          statusRes && statusRes.ok && statusRes.selected && statusRes.permission === 'granted';
        if (!isConnected && !isStubModeEnabled()) {
          return { ok: true, players: [] };
        }
        const res = await raw.listPlayers();
        if (!res.ok) {
          emitStorageToastError(res.error);
        }
        return res;
      } catch (err) {
        return toCaughtFailure(err, 'Failed to list players.');
      }
    },

    async listCharacters(player: string): Promise<StorageResult<{ characters: StoredCharacterSummary[] }>> {
      try {
        if (!player || !player.trim()) {
          return { ok: true, characters: [] };
        }
        const statusRes = await raw.getStatus().catch(() => null);
        const isConnected =
          statusRes && statusRes.ok && statusRes.selected && statusRes.permission === 'granted';
        if (!isConnected && !isStubModeEnabled()) {
          return { ok: true, characters: [] };
        }
        const res = await raw.listCharacters(player);
        if (!res.ok) {
          // If the typed player folder does not exist yet during autocomplete, avoid spamming errors
          if (res.error.code === 'NOT_FOUND') {
            return { ok: true, characters: [] };
          }
          emitStorageToastError(res.error);
        }
        return res;
      } catch (err) {
        return toCaughtFailure(err, 'Failed to list characters.');
      }
    },

    async loadCharacter(player: string, name: string): Promise<StorageResult<LoadedCharacter>> {
      try {
        const res = await raw.loadCharacter(player, name);
        if (!res.ok) {
          emitStorageToastError(res.error);
        } else {
          emitStorageStatusRefresh(res.savedAt);
        }
        return res;
      } catch (err) {
        return toCaughtFailure(err, 'Failed to load character.');
      }
    },

    async pickFolderAndOpen(): Promise<StorageResult<{ rootName: string }>> {
      try {
        const res = await raw.pickFolderAndOpen();
        if (!res.ok) {
          emitStorageToastError(res.error);
        }
        emitStorageStatusRefresh();
        return res;
      } catch (err) {
        return toCaughtFailure(err, 'Failed to connect save folder.');
      }
    },

    async getStatus(): Promise<StorageResult<StorageStatus>> {
      try {
        const res = await raw.getStatus();
        if (!res.ok) {
          emitStorageToastError(res.error);
        }
        return res;
      } catch (err) {
        return toCaughtFailure(err, 'Failed to read storage status.');
      }
    },
  };
}

const defaultAdapter = createSafeStorageAdapter(
  isStubModeEnabled() ? stubStorageAdapter : createFsStorageAdapter()
);

const StorageContext = createContext<StorageAdapter>(defaultAdapter);

export interface StorageProviderProps {
  adapter?: StorageAdapter;
  children: React.ReactNode;
}

export const StorageProvider: React.FC<StorageProviderProps> = ({ adapter, children }) => {
  const value = useMemo(() => {
    if (adapter) {
      return createSafeStorageAdapter(adapter);
    }
    const baseAdapter = isStubModeEnabled() ? stubStorageAdapter : createFsStorageAdapter();
    return createSafeStorageAdapter(baseAdapter);
  }, [adapter]);

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
};

export const useStorage = (): StorageAdapter => {
  return useContext(StorageContext);
};
