import type { PF1Character } from '../types/character';
import { restoreSheetFromStorage } from './characterState';
import type { StorageAdapter, StorageResult } from './types';

export interface FolderConnection {
  rootName: string;
  action: 'saved' | 'recovery' | 'loaded' | 'connected';
  character?: PF1Character;
  recoveredFromCrash?: boolean;
  savedAt?: string;
}

/** Connect from a user gesture, restore existing data, or populate a fresh tree. */
export async function connectSheetToFolder(
  adapter: StorageAdapter,
  current: PF1Character,
): Promise<StorageResult<FolderConnection>> {
  // The picker must run before any other awaited browser operation.
  const opened = await adapter.pickFolderAndOpen();
  if (!opened.ok) return opened;

  const crash = await adapter.loadCrash();
  if (!crash.ok) return crash;
  const active = await adapter.getActiveCharacter();
  if (!active.ok) return active;

  if (crash.character || active.activeCharacter) {
    const restored = await restoreSheetFromStorage(adapter);
    if (!restored.character) {
      return {
        ok: false,
        error: {
          code: 'RESTORE_FAILED',
          message: 'The folder is connected, but its previous sheet could not be loaded. No new sheet was written. Choose a saved character using the Player and Character fields.',
        },
      };
    }
    return {
      ok: true,
      rootName: opened.rootName,
      action: 'loaded',
      character: restored.character,
      recoveredFromCrash: restored.recoveredFromCrash,
    };
  }

  // A missing active.json is not proof that a folder has no saved characters.
  // Never bootstrap over an existing or unreadable collection.
  const players = await adapter.listPlayers();
  if (!players.ok) return players;
  for (const player of players.players) {
    const characters = await adapter.listCharacters(player.name);
    if (!characters.ok) return characters;
    if (characters.characters.length > 0) {
      return { ok: true, rootName: opened.rootName, action: 'connected' };
    }
  }

  // Populate recovery immediately; the autosave hook only observes sheet edits.
  const recovery = await adapter.autosaveCrash(current);
  if (!recovery.ok) return recovery;
  if (!current.name?.trim()) {
    return { ok: true, rootName: opened.rootName, action: 'recovery', savedAt: recovery.savedAt };
  }

  const player = current.player?.trim() || 'Player 1';
  const saved = await adapter.saveCharacter(player, current);
  if (!saved.ok) return saved;
  return { ok: true, rootName: opened.rootName, action: 'saved', savedAt: saved.savedAt };
}
