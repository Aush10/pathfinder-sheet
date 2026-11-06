import React, { useCallback, useEffect, useState } from 'react';
import { Disc, Loader2, Check, AlertCircle, X, FolderOpen } from 'lucide-react';
import type { PF1Character } from '../../types/character';
import {
  useStorage,
  isDirectoryPickerSupported,
  isStubModeEnabled,
  formatStorageTimestamp,
  getStorageErrorMessage,
} from '../../storage/StorageContext';
import { AutosaveState } from '../../storage/useAutosave';
import { restoreSheetFromStorage } from '../../storage/characterState';

export interface SaveButtonProps {
  character: PF1Character;
  autosaveState?: AutosaveState;
  onCharacterLoaded?: (loaded: PF1Character, meta?: { recoveredFromCrash?: boolean }) => void;
}

type SaveUiState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Header Save Controls:
 * - Shows "Saving to a folder needs Edge or Chrome" if window.showDirectoryPicker is unavailable (and not in ?stub=1 mode).
 * - Shows "Connect save folder" button whenever getStatus() says not connected, calling pickFolderAndOpen() on user click.
 * - Shows connected folder name and last saved time in the header next to the CD icon.
 * - Displays all adapter errors ({ ok: false, error }) in the toast notification without crashing the sheet.
 */
export const SaveButton: React.FC<SaveButtonProps> = ({
  character,
  autosaveState,
  onCharacterLoaded,
}) => {
  const storage = useStorage();
  const [saveState, setSaveState] = useState<SaveUiState>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnectingFolder, setIsConnectingFolder] = useState(false);
  const [folderStatus, setFolderStatus] = useState<{
    supported: boolean;
    connected: boolean;
    folderName?: string;
  }>({
    supported: isStubModeEnabled() || isDirectoryPickerSupported(),
    connected: false,
  });

  const stubMode = isStubModeEnabled();
  const hasDirectoryPicker = stubMode || isDirectoryPickerSupported();

  const refreshStatus = useCallback(async () => {
    try {
      const res = await storage.getStatus();
      if (res.ok) {
        setFolderStatus({
          supported: stubMode || res.supported,
          connected: Boolean(res.selected && res.permission === 'granted'),
          folderName: res.rootName,
        });
      } else {
        setFolderStatus((prev) => ({ ...prev, connected: false }));
      }
    } catch {
      setFolderStatus((prev) => ({ ...prev, connected: false }));
    }
  }, [storage, stubMode]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Listen for global adapter errors and status changes from any useStorage() call
  useEffect(() => {
    const handleStorageError = (e: Event) => {
      const custom = e as CustomEvent<{ error?: string }>;
      const msg = custom.detail?.error;
      if (msg) {
        setErrorMessage(msg);
        setSaveState('error');
      }
    };

    const handleStatusChanged = (e: Event) => {
      const custom = e as CustomEvent<{ lastSavedAt?: string }>;
      if (custom.detail?.lastSavedAt) {
        setSavedAt(formatStorageTimestamp(custom.detail.lastSavedAt));
      }
      refreshStatus();
    };

    window.addEventListener('pf1e:storage-error', handleStorageError);
    window.addEventListener('pf1e:storage-status-changed', handleStatusChanged);
    return () => {
      window.removeEventListener('pf1e:storage-error', handleStorageError);
      window.removeEventListener('pf1e:storage-status-changed', handleStatusChanged);
    };
  }, [refreshStatus]);

  const handleConnectFolderClick = async () => {
    if (!hasDirectoryPicker) {
      setErrorMessage('Saving to a folder needs Edge or Chrome');
      setSaveState('error');
      return;
    }
    if (isConnectingFolder) return;
    setIsConnectingFolder(true);
    setErrorMessage(null);

    try {
      const res = await storage.pickFolderAndOpen();
      await refreshStatus();
      if (!res.ok) {
        setErrorMessage(getStorageErrorMessage(res.error));
        setSaveState('error');
      } else if (onCharacterLoaded) {
        const restored = await restoreSheetFromStorage(storage);
        if (restored.character) {
          onCharacterLoaded(restored.character, { recoveredFromCrash: restored.recoveredFromCrash });
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not connect save folder.');
      setSaveState('error');
    } finally {
      setIsConnectingFolder(false);
    }
  };

  const handleSaveClick = async () => {
    if (!hasDirectoryPicker) {
      setErrorMessage('Saving to a folder needs Edge or Chrome');
      setSaveState('error');
      return;
    }
    if (saveState === 'saving') return;
    setSaveState('saving');
    setErrorMessage(null);

    try {
      const player = (character.player || 'Player 1').trim() || 'Player 1';
      const result = await storage.saveCharacter(player, character);
      await refreshStatus();

      if (result.ok) {
        setSavedAt(formatStorageTimestamp(result.savedAt));
        setSaveState('saved');
      } else {
        setErrorMessage(getStorageErrorMessage(result.error));
        setSaveState('error');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unexpected save failure');
      setSaveState('error');
    }
  };

  const displayLastSaved = savedAt;
  const isBrowserSupported = hasDirectoryPicker && folderStatus.supported;

  const tooltipText = !isBrowserSupported
    ? 'Saving to a folder needs Edge or Chrome'
    : saveState === 'saved' && displayLastSaved
    ? `Saved ${displayLastSaved}${folderStatus.folderName ? ` (${folderStatus.folderName})` : ''}`
    : saveState === 'saving'
    ? 'Saving character...'
    : saveState === 'error'
    ? `Save failed: ${errorMessage || 'Unknown error'}`
    : displayLastSaved
    ? `Save Character (Saved ${displayLastSaved})`
    : 'Save Character';

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Tiny Crash Autosave Indicator */}
      {(autosaveState?.lastAutosavedAt || autosaveState?.isAutosaving) && (
        <span
          className="text-[10px] font-mono text-slate-400 select-none hidden sm:inline-block"
          title={
            autosaveState.lastAutosavedAt
              ? `Crash autosave updated at ${autosaveState.lastAutosavedAt}`
              : 'Updating crash autosave...'
          }
        >
          {autosaveState.isAutosaving ? 'Autosaving…' : 'Autosaved'}
        </span>
      )}

      {/* Requirement 3: Browser has no showDirectoryPicker */}
      {!isBrowserSupported ? (
        <span
          role="status"
          className="px-2 py-1 rounded-lg bg-amber-950/90 border border-amber-500/50 text-amber-200 text-[11px] font-mono font-semibold whitespace-nowrap"
        >
          Saving to a folder needs Edge or Chrome
        </span>
      ) : !folderStatus.connected ? (
        /* Requirement 2: "Connect save folder" button shown whenever getStatus() says not connected */
        <button
          type="button"
          onClick={handleConnectFolderClick}
          disabled={isConnectingFolder}
          className="px-2.5 py-1.5 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          title="Select a local folder to save and load character files"
        >
          {isConnectingFolder ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" />
          ) : (
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span>Connect save folder</span>
        </button>
      ) : (
        /* Connected folder name & last saved time shown next to the CD icon */
        <div className="hidden lg:flex flex-col items-end leading-tight text-[10px] font-mono text-slate-300 px-1">
          {folderStatus.folderName && (
            <span className="text-emerald-300 font-semibold truncate max-w-[140px]" title={folderStatus.folderName}>
              {folderStatus.folderName}
            </span>
          )}
          {displayLastSaved && (
            <span className="text-slate-400">Saved {displayLastSaved}</span>
          )}
        </div>
      )}

      {/* Save CD / Disc Button with Connection Status Dot */}
      <button
        type="button"
        onClick={handleSaveClick}
        disabled={saveState === 'saving' || !isBrowserSupported}
        title={tooltipText}
        aria-label={tooltipText}
        className={`relative p-1.5 rounded-lg border font-mono text-xs flex items-center gap-1 transition-colors ${
          !isBrowserSupported
            ? 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed'
            : saveState === 'error'
            ? 'bg-rose-950/90 hover:bg-rose-900 border-rose-500 text-rose-200'
            : saveState === 'saved'
            ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/60 text-emerald-300'
            : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-300'
        }`}
      >
        {/* Small Folder Connection Status Dot */}
        <span
          title={
            folderStatus.connected
              ? `Save folder connected${folderStatus.folderName ? `: ${folderStatus.folderName}` : ''}`
              : 'No save folder connected'
          }
          className={`w-2 h-2 rounded-full shrink-0 ${
            folderStatus.connected
              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
              : 'bg-slate-500'
          }`}
        />

        {saveState === 'saving' && <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />}
        {saveState === 'saved' && <Check className="w-4 h-4 text-emerald-400" />}
        {saveState === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
        {saveState === 'idle' && <Disc className="w-4 h-4 text-cyan-300" />}
      </button>

      {/* Error Toast Notification (Displays any { ok: false, error } across the adapter) */}
      {errorMessage && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-sm bg-rose-950 border border-rose-500 text-rose-100 px-3.5 py-2.5 rounded-xl shadow-2xl flex items-start gap-2.5 font-mono text-xs"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-rose-300">Storage Error</div>
            <div className="text-[11px] opacity-90 mt-0.5">{errorMessage}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              if (saveState === 'error') {
                setSaveState('idle');
              }
            }}
            className="p-0.5 rounded hover:bg-rose-900 text-rose-300"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
