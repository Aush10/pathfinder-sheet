import { DEFAULT_CHARACTER, createBlankCharacter } from '../data/defaultCharacter';
import type { PF1Character } from '../types/character';
import type {
  LoadedCharacter,
  SaveReceipt,
  StorageAdapter,
  StorageResult,
  StorageStatus,
  StoredCharacterSummary,
  StoredPlayer,
} from './types';

/**
 * Fake in-memory StorageAdapter implementation with short artificial delays
 * for front-end UI testing (?stub=1).
 */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface StubCharacterRecord {
  character: PF1Character;
  characterId: string;
  savedAt: string;
}

const createSeededCharacters = (): Record<string, Record<string, StubCharacterRecord>> => {
  const nowIso = new Date().toISOString();

  const valerius: PF1Character = {
    ...DEFAULT_CHARACTER,
    player: DEFAULT_CHARACTER.player || 'Player 1',
    name: DEFAULT_CHARACTER.name || 'Valerius',
  };

  const seraphina: PF1Character = {
    ...createBlankCharacter(),
    name: 'Seraphina Dawnstar',
    player: 'Player 1',
    characterClass: 'Cleric of Sarenrae 7',
    level: 7,
    race: 'Aasimar',
    alignment: 'Neutral Good',
    deity: 'Sarenrae',
    hpCurrent: 52,
    hpTotalMax: 52,
    baseAttackBonus: 5,
  };

  const kaelen: PF1Character = {
    ...createBlankCharacter(),
    name: 'Kaelen Vane',
    player: 'Austin',
    characterClass: 'Slayer 9',
    level: 9,
    race: 'Human',
    alignment: 'Chaotic Neutral',
    deity: 'Calistria',
    hpCurrent: 76,
    hpTotalMax: 76,
    baseAttackBonus: 9,
  };

  const lyra: PF1Character = {
    ...createBlankCharacter(),
    name: 'Lyra Thorne',
    player: 'Austin',
    characterClass: 'Magus (Kensai) 6',
    level: 6,
    race: 'Tiefling',
    alignment: 'Lawful Neutral',
    deity: 'Nethys',
    hpCurrent: 45,
    hpTotalMax: 45,
    baseAttackBonus: 4,
  };

  return {
    'Player 1': {
      [valerius.name]: { character: valerius, characterId: 'stub-char-valerius', savedAt: nowIso },
      [seraphina.name]: { character: seraphina, characterId: 'stub-char-seraphina', savedAt: nowIso },
    },
    Austin: {
      [kaelen.name]: { character: kaelen, characterId: 'stub-char-kaelen', savedAt: nowIso },
      [lyra.name]: { character: lyra, characterId: 'stub-char-lyra', savedAt: nowIso },
    },
  };
};

const cloneCharacter = (char: PF1Character): PF1Character =>
  typeof structuredClone === 'function'
    ? structuredClone(char)
    : JSON.parse(JSON.stringify(char));

export class StubStorageAdapter implements StorageAdapter {
  private store: Record<string, Record<string, StubCharacterRecord>> = createSeededCharacters();
  private crashSnapshot: LoadedCharacter | null = null;
  private selected: boolean = true;
  private rootName: string = 'PF1e_Vault (Stub)';

  constructor() {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('SimulateCrash') === '1' || params.get('crash') === '1') {
        this.crashSnapshot = {
          character: {
            ...DEFAULT_CHARACTER,
            name: `${DEFAULT_CHARACTER.name} (Crash Recovery)`,
          },
          characterId: 'stub-crash-recovery',
          savedAt: new Date().toISOString(),
        };
      }
    }
  }

  async saveCharacter(player: string, character: PF1Character): Promise<StorageResult<SaveReceipt>> {
    await delay(250);

    if (!character?.name || !character.name.trim()) {
      return {
        ok: false,
        error: {
          code: 'INVALID_CHARACTER',
          message: 'A character needs a name before it can be saved.',
        },
      };
    }

    if (character.name.trim().toUpperCase() === '[ERROR]') {
      return {
        ok: false,
        error: {
          code: 'IO_ERROR',
          message: 'Simulated disk write failure: Permission denied in save folder.',
        },
      };
    }

    const playerKey = (player || character.player || 'Player 1').trim() || 'Player 1';
    const charKey = character.name.trim();
    const savedAt = new Date().toISOString();
    const existingId = this.store[playerKey]?.[charKey]?.characterId;
    const characterId = existingId || `stub-${Date.now()}`;

    if (!this.store[playerKey]) {
      this.store[playerKey] = {};
    }

    this.store[playerKey][charKey] = {
      character: cloneCharacter(character),
      characterId,
      savedAt,
    };

    return {
      ok: true,
      player: playerKey,
      name: charKey,
      characterId,
      savedAt,
    };
  }

  async autosaveCrash(character: PF1Character): Promise<StorageResult<Omit<SaveReceipt, 'player'>>> {
    await delay(120);

    if (!character?.name || !character.name.trim()) {
      return {
        ok: false,
        error: {
          code: 'INVALID_CHARACTER',
          message: 'A character needs a name before it can be crash-saved.',
        },
      };
    }

    const savedAt = new Date().toISOString();
    const characterId = this.crashSnapshot?.characterId || 'stub-crash-slot';

    this.crashSnapshot = {
      character: cloneCharacter(character),
      characterId,
      savedAt,
    };

    return {
      ok: true,
      name: 'Crash',
      characterId,
      savedAt,
    };
  }

  async loadCrash(): Promise<StorageResult<{ character: LoadedCharacter | null }>> {
    await delay(100);
    if (!this.crashSnapshot) {
      return { ok: true, character: null };
    }
    return {
      ok: true,
      character: {
        character: cloneCharacter(this.crashSnapshot.character),
        characterId: this.crashSnapshot.characterId,
        savedAt: this.crashSnapshot.savedAt,
      },
    };
  }

  async listPlayers(): Promise<StorageResult<{ players: StoredPlayer[] }>> {
    await delay(80);
    const players = Object.keys(this.store)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name }));
    return { ok: true, players };
  }

  async listCharacters(player: string): Promise<StorageResult<{ characters: StoredCharacterSummary[] }>> {
    await delay(80);
    const trimmed = (player || '').trim();
    const matchedPlayerKey = Object.keys(this.store).find(
      (k) => k.toLowerCase() === trimmed.toLowerCase()
    );
    if (!matchedPlayerKey) {
      return { ok: true, characters: [] };
    }
    const charMap = this.store[matchedPlayerKey];
    const characters: StoredCharacterSummary[] = Object.keys(charMap)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        characterId: charMap[name].characterId,
        savedAt: charMap[name].savedAt,
      }));
    return { ok: true, characters };
  }

  async loadCharacter(player: string, name: string): Promise<StorageResult<LoadedCharacter>> {
    await delay(150);
    const pTrim = (player || '').trim().toLowerCase();
    const cTrim = (name || '').trim().toLowerCase();

    const matchedPlayerKey = Object.keys(this.store).find((k) => k.toLowerCase() === pTrim);
    if (!matchedPlayerKey) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Player "${player}" was not found in the save folder.`,
        },
      };
    }

    const charMap = this.store[matchedPlayerKey];
    const matchedCharKey = Object.keys(charMap).find((k) => k.toLowerCase() === cTrim);
    if (!matchedCharKey) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Character "${name}" was not found for player "${matchedPlayerKey}".`,
        },
      };
    }

    const record = charMap[matchedCharKey];
    return {
      ok: true,
      character: cloneCharacter(record.character),
      characterId: record.characterId,
      savedAt: record.savedAt,
    };
  }

  async pickFolderAndOpen(): Promise<StorageResult<{ rootName: string }>> {
    await delay(150);
    this.selected = true;
    this.rootName = 'PF1e_Picked_Folder (Stub)';
    return {
      ok: true,
      rootName: this.rootName,
    };
  }

  async getStatus(): Promise<StorageResult<StorageStatus>> {
    await delay(50);
    return {
      ok: true,
      supported: true,
      selected: this.selected,
      permission: 'granted',
      rootName: this.rootName,
    };
  }
}

export const stubStorageAdapter = new StubStorageAdapter();
