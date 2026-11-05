import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FolderOpen, Loader2, User, Camera } from 'lucide-react';
import type { PF1Character } from '../../types/character';
import {
  useStorage,
  isDirectoryPickerSupported,
  isStubModeEnabled,
  emitStorageToastError,
} from '../../storage/StorageContext';

export interface IdentityLoadFieldsProps {
  character: PF1Character;
  inputStyle: string;
  onChangeName: (name: string) => void;
  onChangePlayer: (player: string) => void;
  onCharacterLoaded: (loaded: PF1Character) => void;
  onOpenImageBrowser?: () => void;
}

/**
 * Autocomplete dropdown inputs for Character Name and Player Name in Identity & Lineage,
 * plus the "Open" button next to Player Name that calls loadCharacter(player, characterName)
 * and falls back to pickFolderAndOpen() if not found or not connected.
 */
export const IdentityLoadFields: React.FC<IdentityLoadFieldsProps> = ({
  character,
  inputStyle,
  onChangeName,
  onChangePlayer,
  onCharacterLoaded,
  onOpenImageBrowser,
}) => {
  const storage = useStorage();
  const [players, setPlayers] = useState<string[]>([]);
  const [charactersForPlayer, setCharactersForPlayer] = useState<string[]>([]);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showCharDropdown, setShowCharDropdown] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  const charContainerRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Fetch players list
  const refreshPlayers = async () => {
    try {
      const res = await storage.listPlayers();
      if (res.ok) {
        setPlayers(res.players.map((p) => p.name));
      } else {
        setPlayers([]);
      }
    } catch {
      setPlayers([]);
    }
  };

  // Fetch characters for the current player
  const refreshCharacters = async (playerValue: string) => {
    try {
      const res = await storage.listCharacters(playerValue);
      if (res.ok) {
        setCharactersForPlayer(res.characters.map((c) => c.name));
      } else {
        setCharactersForPlayer([]);
      }
    } catch {
      setCharactersForPlayer([]);
    }
  };

  useEffect(() => {
    refreshPlayers();
  }, [storage]);

  useEffect(() => {
    refreshCharacters(character.player);
  }, [character.player, storage]);

  useEffect(() => {
    const handleStatusChanged = () => {
      refreshPlayers();
      refreshCharacters(character.player);
    };
    window.addEventListener('pf1e:storage-status-changed', handleStatusChanged);
    return () => window.removeEventListener('pf1e:storage-status-changed', handleStatusChanged);
  }, [character.player, storage]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (charContainerRef.current && !charContainerRef.current.contains(e.target as Node)) {
        setShowCharDropdown(false);
      }
      if (playerContainerRef.current && !playerContainerRef.current.contains(e.target as Node)) {
        setShowPlayerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenClick = async () => {
    if (!isStubModeEnabled() && !isDirectoryPickerSupported()) {
      emitStorageToastError('Saving to a folder needs Edge or Chrome');
      return;
    }
    if (isOpening) return;
    setIsOpening(true);
    try {
      const playerName = (character.player || 'Player 1').trim() || 'Player 1';
      const charName = (character.name || '').trim();

      const statusRes = await storage.getStatus();
      const isConnected =
        statusRes.ok && statusRes.selected && statusRes.permission === 'granted';

      if (isConnected && charName) {
        const loadRes = await storage.loadCharacter(playerName, charName);
        if (loadRes.ok && loadRes.character) {
          onCharacterLoaded(loadRes.character);
          await refreshPlayers();
          await refreshCharacters(loadRes.character.player);
          return;
        }
      }

      const pickRes = await storage.pickFolderAndOpen();
      if (pickRes.ok) {
        await refreshPlayers();
        await refreshCharacters(playerName);
        if (charName) {
          const retryRes = await storage.loadCharacter(playerName, charName);
          if (retryRes.ok && retryRes.character) {
            onCharacterLoaded(retryRes.character);
          }
        }
      }
    } finally {
      setIsOpening(false);
    }
  };

  const filteredPlayers = players.filter(
    (p) => !character.player.trim() || p.toLowerCase().includes(character.player.toLowerCase())
  );
  const displayPlayers = filteredPlayers.length > 0 ? filteredPlayers : players;

  const filteredChars = charactersForPlayer.filter(
    (c) => !character.name.trim() || c.toLowerCase().includes(character.name.toLowerCase())
  );
  const displayChars = filteredChars.length > 0 ? filteredChars : charactersForPlayer;

  const avatarUrl = character.profileData?.avatarUrl || character.characterBio?.portraits?.[0];

  return (
    <>
      {/* Character Name Autocomplete Field (col-span-2) */}
      <div className="col-span-2" ref={charContainerRef}>
        <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
          Character Name
        </label>
        <div className="flex items-center gap-2 mt-0.5 relative">
          <div
            onClick={onOpenImageBrowser}
            className="w-8 h-8 rounded-lg overflow-hidden border border-black/20 dark:border-white/20 bg-black/40 flex items-center justify-center shrink-0 cursor-pointer relative group"
            title="Click to browse profile picture"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={character.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-amber-500/70" />
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-amber-300 transition-opacity">
              <Camera className="w-3 h-3" />
            </div>
          </div>

          <div className="relative flex-1">
            <input
              type="text"
              value={character.name}
              onFocus={() => {
                refreshCharacters(character.player);
                setShowCharDropdown(true);
              }}
              onChange={(e) => {
                onChangeName(e.target.value);
                setShowCharDropdown(true);
              }}
              placeholder="Character Name"
              className={`w-full font-bold text-base px-2 pr-7 py-1 rounded border ${inputStyle}`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                refreshCharacters(character.player);
                setShowCharDropdown((prev) => !prev);
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 opacity-60 hover:opacity-100"
              title="Show saved characters for this player"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showCharDropdown && displayChars.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-30 max-h-44 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-xl py-1 text-xs font-mono">
                {displayChars.map((cName) => (
                  <li key={cName}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onChangeName(cName);
                        setShowCharDropdown(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-amber-500/20 hover:text-amber-300 transition-colors flex items-center justify-between"
                    >
                      <span className="font-bold">{cName}</span>
                      <span className="text-[10px] opacity-60">{character.player || 'Saved'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Player Name Autocomplete Field + Open Button */}
      <div ref={playerContainerRef}>
        <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
          Player
        </label>
        <div className="flex items-center gap-1 mt-0.5 relative">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={character.player}
              onFocus={() => {
                refreshPlayers();
                setShowPlayerDropdown(true);
              }}
              onChange={(e) => {
                onChangePlayer(e.target.value);
                setShowPlayerDropdown(true);
              }}
              placeholder="Player Name"
              className={`w-full text-xs px-2 pr-6 py-1 rounded border ${inputStyle}`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                refreshPlayers();
                setShowPlayerDropdown((prev) => !prev);
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 opacity-60 hover:opacity-100"
              title="Show known players"
            >
              <ChevronDown className="w-3 h-3" />
            </button>

            {showPlayerDropdown && displayPlayers.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-30 max-h-44 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-xl py-1 text-xs font-mono">
                {displayPlayers.map((pName) => (
                  <li key={pName}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onChangePlayer(pName);
                        setShowPlayerDropdown(false);
                        refreshCharacters(pName);
                      }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors"
                    >
                      {pName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenClick}
            disabled={isOpening}
            title="Load character for (Player, Character Name), or pick folder if not found"
            className="px-2 py-1 rounded border border-cyan-500/50 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 font-mono font-bold text-[11px] flex items-center gap-1 shrink-0 transition-colors"
          >
            {isOpening ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FolderOpen className="w-3 h-3 text-cyan-400" />
            )}
            <span>Open</span>
          </button>
        </div>
      </div>
    </>
  );
};
