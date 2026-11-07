import React from 'react';
import { Layers, FilePlus, User } from 'lucide-react';
import { useCharacter } from '../../context/CharacterContext';
import { ImageBrowserTargetConfig } from '../../engine/characterIntegration';
import { SaveButton } from '../storage/SaveButton';
import { AutosaveState } from '../../storage/useAutosave';

export interface WorkspaceHeaderProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenImageBrowser: (config?: Partial<ImageBrowserTargetConfig>) => void;
  onOpenNewSheet: () => void;
  autosaveState?: AutosaveState;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenImageBrowser,
  onOpenNewSheet,
  autosaveState: propAutosaveState,
}) => {
  const {
    character,
    applyLoadedCharacter,
    autosaveState: ctxAutosaveState,
  } = useCharacter();

  const autosaveState = propAutosaveState ?? ctxAutosaveState;

  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800 text-slate-100 px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 z-20 print:hidden select-none">
      {/* Left: Wordmark & Core Identity */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 transition-colors"
          title={isSidebarCollapsed ? 'Expand Blueprint Sidebar' : 'Collapse Blueprint Sidebar'}
        >
          <Layers className="w-4 h-4" />
        </button>
        <span className="font-serif font-black tracking-tight text-amber-300 text-sm md:text-base whitespace-nowrap">
          Pathfinder 1e{' '}
          <span className="font-sans font-light text-slate-400 text-xs hidden sm:inline">
            | Modular Workspace
          </span>
        </span>

        {/* Profile Picture thumbnail / button */}
        <button
          onClick={() =>
            onOpenImageBrowser({
              targetType: 'profile',
              title: 'Character Profile Picture Browser',
              subtitle:
                'Choose an avatar from local files, fantasy portraits, or enter an image URL.',
              currentUrl:
                character.profileData?.avatarUrl || character.characterBio?.portraits?.[0],
            })
          }
          className="flex items-center gap-1.5 p-1 pr-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-300 transition-all group"
          title="Click to browse character profile picture"
        >
          <div className="w-6 h-6 rounded-full overflow-hidden border border-cyan-500/50 bg-black/60 shrink-0 flex items-center justify-center">
            {character.profileData?.avatarUrl || character.characterBio?.portraits?.[0] ? (
              <img
                src={character.profileData?.avatarUrl || character.characterBio?.portraits?.[0]}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-3.5 h-3.5 text-cyan-400" />
            )}
          </div>
          <span className="text-xs font-mono hidden md:inline-block group-hover:text-cyan-300 font-semibold truncate max-w-[130px]">
            {character.name || 'Unnamed'} (Lvl {character.level})
          </span>
        </button>

        {/* Clear All / New Sheet Button */}
        <button
          onClick={onOpenNewSheet}
          className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 hover:border-rose-400 text-rose-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          title="Clear all / Start a fresh new character sheet"
        >
          <FilePlus className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">New Sheet</span>
        </button>
      </div>

      {/* Right: Save & Autosave Status */}
      <div className="flex items-center gap-2 shrink-0">
        <SaveButton
          character={character}
          autosaveState={autosaveState}
          onCharacterLoaded={(loaded, meta) => {
            applyLoadedCharacter(loaded, meta);
          }}
        />
      </div>
    </header>
  );
};
