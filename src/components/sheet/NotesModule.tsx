import React, { useState } from 'react';
import {
  BookOpen,
  ChevronUp,
  ChevronDown,
  Clock,
  Copy,
  Check,
  Trash2,
  Maximize2,
  Play,
  Sparkles,
} from 'lucide-react';
import { PF1Character, RollupNotesData } from '../../types/character';
import { executeScratchpadAIMacro, DEFAULT_AI_MODULE_SETTINGS } from '../../engine/aiService';

interface NotesModuleProps {
  character: PF1Character;
  theme: string;
  fontClass: string;
  onUpdateCharacter: (updater: (prev: PF1Character) => PF1Character) => void;
}

export const NotesModule: React.FC<NotesModuleProps> = ({
  character,
  theme,
  fontClass,
  onUpdateCharacter,
}) => {
  const [copied, setCopied] = useState(false);
  const [aiStatusNote, setAiStatusNote] = useState<string | null>(null);
  const aiSettings = character.installedModules?.aiSettings || DEFAULT_AI_MODULE_SETTINGS;
  const isScratchpadAiAllowed = aiSettings.allowedModules?.scratchpad ?? true;

  const isParchment = theme === 'parchment';
  const isBlueprint = theme === 'blueprint';
  const isMythWeavers = theme === 'mythweavers';

  const cardBg = isParchment
    ? 'bg-amber-50/70 border-amber-800/20 text-stone-900 shadow-sm'
    : isBlueprint
    ? 'bg-slate-900/90 border-cyan-500/40 text-cyan-50'
    : isMythWeavers
    ? 'bg-[#15171a] border-[#2d3139] text-slate-100'
    : 'bg-white border-black text-black';

  const headerBg = isParchment
    ? 'bg-amber-900/10 border-amber-900/20 text-amber-950 font-serif'
    : isBlueprint
    ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300 font-mono'
    : isMythWeavers
    ? 'bg-[#0f1113] border-[#2d3139] text-amber-400 font-serif'
    : 'bg-neutral-100 border-black text-black font-sans';

  const inputStyle = isParchment
    ? 'bg-white/80 border-amber-900/30 text-stone-900 focus:border-amber-700 focus:bg-white'
    : isBlueprint
    ? 'bg-slate-950/80 border-cyan-700/60 text-cyan-200 focus:border-cyan-400'
    : isMythWeavers
    ? 'bg-[#0d0e10] border-[#383d47] text-amber-100 focus:border-amber-500'
    : 'bg-white border-neutral-400 text-black';

  const rollupNotes: RollupNotesData = character.rollupNotes || {
    content: '== Campaign Scratchpad & Session Log ==\n- Met with party in Kenabres\n- Purchased 2 healing potions\n- Prepared for undercity expedition',
    isRolledUp: false,
  };

  const isRolledUp = rollupNotes.isRolledUp;

  const toggleRollup = () => {
    onUpdateCharacter((prev) => ({
      ...prev,
      rollupNotes: {
        ...(prev.rollupNotes || rollupNotes),
        isRolledUp: !isRolledUp,
      },
    }));
  };

  const handleContentChange = (newContent: string) => {
    onUpdateCharacter((prev) => ({
      ...prev,
      rollupNotes: {
        ...(prev.rollupNotes || rollupNotes),
        content: newContent,
      },
    }));
  };

  const handleInsertTimestamp = () => {
    const timestamp = `\n[Session Log: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]\n- `;
    handleContentChange(rollupNotes.content + timestamp);
  };

  const handleCopyNotes = () => {
    navigator.clipboard.writeText(rollupNotes.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearNotes = () => {
    if (confirm('Clear scratchpad notes?')) {
      handleContentChange('');
    }
  };

  const handleRunScratchpadMacros = async () => {
    if (!isScratchpadAiAllowed) {
      setAiStatusNote('Scratchpad AI is disabled in AI Listener -> Module Permissions.');
      return;
    }
    try {
      const res = await executeScratchpadAIMacro(rollupNotes.content || '', character);
      handleContentChange(res.updatedText);
      setAiStatusNote(res.generatedReply || 'Executed scratchpad AI macro.');
    } catch (err) {
      setAiStatusNote(err instanceof Error ? err.message : String(err));
    }
  };

  const handleInsertBuildPrompt = () => {
    const cur = rollupNotes.content || '';
    const sep = cur && !cur.endsWith('\n') ? '\n' : '';
    handleContentChange(`${cur}${sep}What should I make for this game>>#AI$`);
  };

  const wordCount = rollupNotes.content.trim() ? rollupNotes.content.trim().split(/\s+/).length : 0;
  const lineCount = rollupNotes.content.split('\n').length;

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${cardBg} ${fontClass}`}>
      {/* Roll-up Bar Header */}
      <div
        onClick={toggleRollup}
        className={`px-3 py-2 flex items-center justify-between cursor-pointer select-none transition-colors ${headerBg} ${
          !isRolledUp ? 'border-b' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span className="font-bold uppercase text-xs tracking-wider">
            Roll-Up Notes & Scratchpad
          </span>
          <span className="text-[10px] font-mono opacity-70">
            ({wordCount} words, {lineCount} lines)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-current opacity-70">
            {isRolledUp ? 'Rolled Up' : 'Expanded'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleRollup();
            }}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title={isRolledUp ? 'Unroll notes' : 'Roll up notes into a single bar'}
          >
            {isRolledUp ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Unrolled Scratchpad Body */}
      {!isRolledUp && (
        <div className="p-3 space-y-2">
          {/* Quick Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleRunScratchpadMacros}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold flex items-center gap-1 transition-colors text-[11px] shadow-xs"
                title="Execute macro-sensitive AI lines (>>#AI$, >>AI$, >>#ai!)"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Run</span>
              </button>
              <button
                type="button"
                onClick={handleInsertBuildPrompt}
                className="px-2 py-1 rounded border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 flex items-center gap-1 transition-colors text-[11px]"
                title="Insert conversational build planning prompt"
              >
                <Sparkles className="w-3 h-3 text-cyan-500" />
                <span>+&gt;&gt;#AI$</span>
              </button>
              <button
                type="button"
                onClick={handleInsertTimestamp}
                className="px-2 py-1 rounded border border-slate-700/60 hover:border-cyan-400 text-cyan-700 dark:text-cyan-300 flex items-center gap-1 transition-colors text-[11px]"
              >
                <Clock className="w-3 h-3 text-cyan-500" />
                <span>Timestamp</span>
              </button>
              <button
                type="button"
                onClick={handleCopyNotes}
                className="px-2 py-1 rounded border border-slate-700/60 hover:border-cyan-400 text-stone-700 dark:text-slate-300 flex items-center gap-1 transition-colors text-[11px]"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleClearNotes}
              className="px-2 py-1 rounded border border-slate-700/60 hover:border-rose-500 text-rose-600 dark:text-rose-400 flex items-center gap-1 transition-colors text-[11px]"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>

          {aiStatusNote && (
            <div className="px-2.5 py-1.5 rounded bg-cyan-950/15 dark:bg-cyan-950/60 border border-cyan-500/30 text-[11px] font-mono text-cyan-800 dark:text-cyan-200 flex items-center justify-between gap-2">
              <span>{aiStatusNote}</span>
              <button
                type="button"
                onClick={() => setAiStatusNote(null)}
                className="text-[10px] opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {/* Resizable Scratchpad Textarea */}
          <textarea
            value={rollupNotes.content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Type session logs, GM clues, or build planning macros (e.g. What should I make for this game>>#AI$, It's in my journal >>#AI$, Na something more human make a couple suggestions>>AI$, Backstory for flinn>>#ai!)..."
            rows={8}
            className={`w-full p-2.5 rounded-lg text-xs leading-relaxed resize-y min-h-[160px] font-mono ${inputStyle}`}
          />
        </div>
      )}
    </div>
  );
};
