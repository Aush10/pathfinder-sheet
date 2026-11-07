/**
 * CharacterContext & State Integration Store
 * ==========================================
 *
 * Owns:
 * - Primary `PF1Character` state (`character`, `setCharacter`, `updateCharacter`)
 * - Derived PF1e combat & skill math (`derived` via `resolveIntegratedCharacterView`)
 * - Career progression summary (`careerSummary`) and sheet synchronization (`syncCareerToSheet`)
 * - Workspace layout state (`layout`, `setLayout`, `updateLayout`)
 * - `localStorage` persistence (`pf1e_character_data_v1` & `pf1e_workspace_layout_v1`)
 * - `window.__INITIAL_CHARACTER__` & `window.__INITIAL_LAYOUT__` standalone HTML hydration
 * - Automatic odd-level feat slot synchronization (`syncOddLevelFeats`)
 * - Startup crash recovery / active character restore (`restoreSheetFromStorage`) and debounced crash autosave (`useAutosave`)
 * - Shared domain actions for tools and sheet modules (`applyPointBuy`, `updateHP`, `updateBuffBox`,
 *   `updateCustomBuffs`, `resetToBlankSheet`, `resetToDefaultSheet`, `installAITool`,
 *   `selectImageFromBrowser`, `exportStandaloneHTML`, `exportJSON`, `importJSON`, `exportCSV`)
 *
 * Integration Mapping Location:
 * -----------------------------
 * See `resolveIntegratedCharacterView` and `applyCareerProgressionToCharacter` in
 * `src/engine/characterIntegration.ts` for the single integration pipeline that maps
 * career progression, class grids, Buff Box totals, and Macaroni evaluations into
 * the character fields displayed on the sheet.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AbilityName,
  BuffBoxData,
  CareerProgressionData,
  CustomBuffEffect,
  PF1Character,
  WorkspaceLayout,
} from '../types/character';
import { DerivedCombatStats } from '../engine/pf1eMath';
import { CalculatedCareerResult } from '../engine/multiclassCalculator';
import {
  DEFAULT_CHARACTER,
  LOCAL_STORAGE_CHARACTER_KEY,
  LOCAL_STORAGE_LAYOUT_KEY,
  applyBuffBoxToCharacter,
  applyCareerProgressionToCharacter,
  applyCustomBuffsWithInventorySync,
  applyPointBuyToCharacter,
  applySelectedImageToCharacter,
  createBlankCharacter,
  loadInitialCharacterState,
  loadInitialLayoutState,
  normalizeCharacterState,
  resolveIntegratedCharacterView,
  syncOddLevelFeats,
} from '../engine/characterIntegration';
import {
  exportCharacterCSV,
  exportCharacterJSON,
  exportStandaloneHTMLBundle,
  importCharacterJSONFile,
} from '../utils/sheetExporters';
import { emitStorageToastError, useStorage } from '../storage/StorageContext';
import { restoreSheetFromStorage } from '../storage/characterState';
import { AutosaveState, useAutosave } from '../storage/useAutosave';

export interface CharacterContextValue {
  character: PF1Character;
  derived: DerivedCombatStats;
  careerSummary: CalculatedCareerResult;

  /** React state dispatcher compatible with all existing onUpdateCharacter props */
  setCharacter: React.Dispatch<React.SetStateAction<PF1Character>>;
  /** Convenient alias for setCharacter supporting updater function or direct value */
  updateCharacter: React.Dispatch<React.SetStateAction<PF1Character>>;
  /** Shallow-merges partial fields into the current character */
  patchCharacter: (updates: Partial<PF1Character>) => void;
  /** Normalizes and applies a loaded character from folder storage */
  applyLoadedCharacter: (loaded: PF1Character, meta?: { recoveredFromCrash?: boolean }) => void;

  /** Workspace layout state & updater */
  layout: WorkspaceLayout;
  setLayout: React.Dispatch<React.SetStateAction<WorkspaceLayout>>;
  updateLayout: (updates: Partial<WorkspaceLayout>) => void;

  /** Shared domain handlers for tools & modals */
  syncCareerToSheet: (careerOverride?: CareerProgressionData) => CalculatedCareerResult;
  applyPointBuy: (payload: {
    bases: Record<AbilityName, number>;
    asi: Record<AbilityName, number>;
  }) => void;
  applyBaseScores: (payload: {
    bases: Record<AbilityName, number>;
    asi: Record<AbilityName, number>;
  }) => void;
  updateHP: (
    updates: Partial<Pick<PF1Character, 'hpCurrent' | 'hpTotalMax' | 'hpTemp' | 'hpNonlethal'>>
  ) => void;
  updateBuffBox: (buffBox: BuffBoxData) => void;
  updateCustomBuffs: (customBuffs: CustomBuffEffect[]) => void;
  selectImageFromBrowser: (
    config: { targetType: 'profile' | 'portrait' | 'item'; itemId?: string },
    url: string
  ) => void;
  applyImageSelection: (
    config: { targetType: 'profile' | 'portrait' | 'item'; itemId?: string },
    url: string
  ) => void;
  resetToBlankSheet: () => void;
  resetToDefaultSheet: () => void;
  installAITool: () => void;
  installAICompanion: () => void;

  /** Export / Import handlers */
  isExportingHTML: boolean;
  exportStandaloneHTML: () => Promise<void>;
  exportJSON: () => void;
  importJSON: () => void;
  exportCSV: () => void;

  /** Crash autosave & recovery state */
  autosaveState: AutosaveState;
  showCrashRecoveredBanner: boolean;
  dismissCrashRecoveredBanner: () => void;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

export interface CharacterProviderProps {
  initialCharacter?: PF1Character;
  readOnly?: boolean;
  isReadOnly?: boolean;
  children: React.ReactNode;
}

export const CharacterProvider: React.FC<CharacterProviderProps> = ({
  initialCharacter,
  readOnly = false,
  isReadOnly = false,
  children,
}) => {
  const effectiveReadOnly = readOnly || isReadOnly;
  const storage = useStorage();
  const [character, setCharacter] = useState<PF1Character>(() =>
    initialCharacter ? normalizeCharacterState(initialCharacter) : loadInitialCharacterState()
  );
  const [layout, setLayout] = useState<WorkspaceLayout>(() => loadInitialLayoutState());
  const [showCrashRecoveredBanner, setShowCrashRecoveredBanner] = useState(false);
  const [isExportingHTML, setIsExportingHTML] = useState(false);

  // Debounced Crash Autosave (~1 second after character changes)
  const autosaveState = useAutosave(character, !effectiveReadOnly);

  // On startup, restore crash recovery or the last deliberately saved character from folder storage
  useEffect(() => {
    if (effectiveReadOnly) return;
    let mounted = true;
    restoreSheetFromStorage(storage)
      .then((restored) => {
        if (!mounted || !restored.character) return;
        setCharacter(syncOddLevelFeats(restored.character));
        setShowCrashRecoveredBanner(restored.recoveredFromCrash);
      })
      .catch(() => {
        // ignore startup restore errors
      });
    return () => {
      mounted = false;
    };
  }, [storage, effectiveReadOnly]);

  // Automatically generate a new Feat entry for every odd level (1, 3, 5, 7...) reached
  useEffect(() => {
    setCharacter((prev) => syncOddLevelFeats(prev));
  }, [character.level]);

  // Persist character to localStorage (pf1e_character_data_v1)
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CHARACTER_KEY, JSON.stringify(character));
    } catch {
      // ignore quota errors
    }
  }, [character]);

  // Persist workspace layout to localStorage (pf1e_workspace_layout_v1)
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      // ignore quota errors
    }
  }, [layout]);

  // Compute integrated derived stats & career progression summary
  const { derived, careerSummary } = useMemo(
    () => resolveIntegratedCharacterView(character),
    [character]
  );

  const patchCharacter = useCallback((updates: Partial<PF1Character>) => {
    setCharacter((prev) => ({ ...prev, ...updates }));
  }, []);

  const applyLoadedCharacter = useCallback(
    (loaded: PF1Character, meta?: { recoveredFromCrash?: boolean }) => {
      setCharacter(normalizeCharacterState(loaded));
      if (meta !== undefined) {
        setShowCrashRecoveredBanner(Boolean(meta.recoveredFromCrash));
      }
    },
    []
  );

  const updateLayout = useCallback((updates: Partial<WorkspaceLayout>) => {
    setLayout((prev) => ({ ...prev, ...updates }));
  }, []);

  const syncCareerToSheet = useCallback(
    (careerOverride?: CareerProgressionData): CalculatedCareerResult => {
      let computedResult = careerSummary;
      setCharacter((prev) => {
        const { updatedCharacter, careerResult } = applyCareerProgressionToCharacter(
          prev,
          careerOverride
        );
        computedResult = careerResult;
        return updatedCharacter;
      });
      return computedResult;
    },
    [careerSummary]
  );

  const applyPointBuy = useCallback(
    (payload: { bases: Record<AbilityName, number>; asi: Record<AbilityName, number> }) => {
      setCharacter((prev) => applyPointBuyToCharacter(prev, payload));
    },
    []
  );

  const updateHP = useCallback(
    (
      updates: Partial<Pick<PF1Character, 'hpCurrent' | 'hpTotalMax' | 'hpTemp' | 'hpNonlethal'>>
    ) => {
      setCharacter((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const updateBuffBox = useCallback((buffBox: BuffBoxData) => {
    setCharacter((prev) => applyBuffBoxToCharacter(prev, buffBox));
  }, []);

  const updateCustomBuffs = useCallback((customBuffs: CustomBuffEffect[]) => {
    setCharacter((prev) => applyCustomBuffsWithInventorySync(prev, customBuffs));
  }, []);

  const selectImageFromBrowser = useCallback(
    (config: { targetType: 'profile' | 'portrait' | 'item'; itemId?: string }, url: string) => {
      setCharacter((prev) => applySelectedImageToCharacter(prev, config, url));
    },
    []
  );

  const resetToBlankSheet = useCallback(() => {
    setCharacter(createBlankCharacter());
  }, []);

  const resetToDefaultSheet = useCallback(() => {
    setCharacter(DEFAULT_CHARACTER);
  }, []);

  const installAITool = useCallback(() => {
    setCharacter((prev) => ({
      ...prev,
      installedModules: {
        ...prev.installedModules,
        aiCompanion: true,
      },
    }));
  }, []);

  const exportStandaloneHTML = useCallback(async () => {
    setIsExportingHTML(true);
    try {
      await exportStandaloneHTMLBundle(character, layout);
    } finally {
      setIsExportingHTML(false);
    }
  }, [character, layout]);

  const exportJSON = useCallback(() => {
    exportCharacterJSON(character);
  }, [character]);

  const importJSON = useCallback(() => {
    importCharacterJSONFile(
      (imported) => setCharacter(imported),
      (errMsg) => emitStorageToastError(errMsg)
    );
  }, []);

  const exportCSV = useCallback(() => {
    exportCharacterCSV(character, derived);
  }, [character, derived]);

  const dismissCrashRecoveredBanner = useCallback(() => {
    setShowCrashRecoveredBanner(false);
    void storage.dismissCrash();
  }, [storage]);

  const contextValue = useMemo<CharacterContextValue>(
    () => ({
      character,
      derived,
      careerSummary,
      setCharacter,
      updateCharacter: setCharacter,
      patchCharacter,
      applyLoadedCharacter,
      layout,
      setLayout,
      updateLayout,
      syncCareerToSheet,
      applyPointBuy,
      applyBaseScores: applyPointBuy,
      updateHP,
      updateBuffBox,
      updateCustomBuffs,
      selectImageFromBrowser,
      applyImageSelection: selectImageFromBrowser,
      resetToBlankSheet,
      resetToDefaultSheet,
      installAITool,
      installAICompanion: installAITool,
      isExportingHTML,
      exportStandaloneHTML,
      exportJSON,
      importJSON,
      exportCSV,
      autosaveState,
      showCrashRecoveredBanner,
      dismissCrashRecoveredBanner,
    }),
    [
      character,
      derived,
      careerSummary,
      patchCharacter,
      applyLoadedCharacter,
      layout,
      updateLayout,
      syncCareerToSheet,
      applyPointBuy,
      updateHP,
      updateBuffBox,
      updateCustomBuffs,
      selectImageFromBrowser,
      resetToBlankSheet,
      resetToDefaultSheet,
      installAITool,
      isExportingHTML,
      exportStandaloneHTML,
      exportJSON,
      importJSON,
      exportCSV,
      autosaveState,
      showCrashRecoveredBanner,
      dismissCrashRecoveredBanner,
    ]
  );

  return <CharacterContext.Provider value={contextValue}>{children}</CharacterContext.Provider>;
};

/**
 * Primary hook for accessing character state, derived stats, and update handlers.
 */
export function useCharacter(): CharacterContextValue {
  const ctx = useContext(CharacterContext);
  if (!ctx) {
    throw new Error('useCharacter() must be used within a <CharacterProvider>.');
  }
  return ctx;
}

/**
 * Optional hook that returns null if outside CharacterProvider (useful when a component
 * supports both context consumption and explicit prop overrides).
 */
export function useOptionalCharacter(): CharacterContextValue | null {
  return useContext(CharacterContext);
}
