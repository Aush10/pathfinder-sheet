import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit3,
  Image as ImageIcon,
  CheckSquare,
  Search,
  X,
  Sparkles,
  MapPin,
  Bookmark,
  Settings,
  RefreshCw,
  FileText,
  Check,
  Wand2,
  ExternalLink,
  Table2,
} from 'lucide-react';
import {
  PF1Character,
  JournalEntry,
  JournalImage,
  SketchDetailQuality,
  ThemeMode,
} from '../../types/character';
import {
  DEFAULT_AI_MODULE_SETTINGS,
  generateJournalEntryInVoice,
  generatePencilSketch,
} from '../../engine/aiService';
import {
  evaluateDirectoryMacroValue,
  getAvailableDirectorySpells,
} from '../../engine/actionDirectory';
import { getActiveHostSrdOwner } from '../../engine/sotEngine';
import { blankCharacterWithEmptySot, SPELL_BOOK_JOURNAL_TITLE, SPELL_BOOK_TAG, characterHasStructuredCasting } from '../../storage/characterState';
import {
  loadSrdIngestArtifacts,
  srdDocFolderName,
  type SrdIngestArtifacts,
} from '../../storage/fsAdapter';
import { useOptionalCharacter } from '../../context/CharacterContext';

export interface JournalLookupTableRef {
  id: string;
  docTitle: string;
  caption: string;
  headers: string[];
  rows: string[][];
}

export function extractLookupTablesFromArtifacts(
  docTitle: string,
  artifacts: SrdIngestArtifacts | null | undefined
): JournalLookupTableRef[] {
  if (!artifacts) return [];
  const rawTableObj = (artifacts['table.json'] || {}) as {
    tables?: Array<Record<string, unknown>>;
  };
  const tables = Array.isArray(rawTableObj.tables) ? rawTableObj.tables : [];
  return tables
    .filter((t) => String(t.kind || '') === 'lookup-table')
    .map((t, idx) => ({
      id: String(t.id || `${docTitle}-lookup-${idx}`),
      docTitle,
      caption: String(t.caption || t.id || `Lookup Table ${idx + 1}`),
      headers: Array.isArray(t.headers) ? t.headers.map(String) : [],
      rows: Array.isArray(t.rows)
        ? (t.rows as unknown[]).map((r) =>
            Array.isArray(r) ? r.map((c) => String(c ?? '')) : []
          )
        : [],
    }));
}

export function resolveJournalModalTitle(character: PF1Character): string {
  const entries = character.journal || [];
  const hasSpellBook =
    entries.some((e) => e.tags?.includes(SPELL_BOOK_TAG)) ||
    characterHasStructuredCasting(character);
  return hasSpellBook ? SPELL_BOOK_JOURNAL_TITLE : `${character.name}’s Session Journal & Chronicle`;
}

interface JournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  character?: PF1Character;
  onUpdateCharacter?: (updater: (prev: PF1Character) => PF1Character) => void;
  onOpenAITool?: (initialTab?: string) => void;
  theme?: ThemeMode;
  lookupTables?: JournalLookupTableRef[];
}

export const JournalModal: React.FC<JournalModalProps> = ({
  isOpen,
  onClose,
  character: propCharacter,
  onUpdateCharacter: propOnUpdateCharacter,
  onOpenAITool,
  theme: propTheme,
  lookupTables: propLookupTables,
}) => {
  const ctx = useOptionalCharacter();
  const character = propCharacter ?? ctx?.character ?? blankCharacterWithEmptySot();
  const onUpdateCharacter = propOnUpdateCharacter ?? ctx?.updateCharacter ?? (() => {});
  const theme = propTheme ?? ctx?.layout.theme ?? 'parchment';

  const entries: JournalEntry[] = character.journal || [];
  const hasSpellBook =
    entries.some((e) => e.tags?.includes(SPELL_BOOK_TAG)) ||
    characterHasStructuredCasting(character);
  const spellBookPages = entries.filter((e) => e.tags?.includes(SPELL_BOOK_TAG));
  const [selectedEntryId, setSelectedEntryId] = useState<string>(() => {
    return entries.length > 0 ? entries[0].id : '';
  });
  const [loadedLookupTables, setLoadedLookupTables] = useState<JournalLookupTableRef[]>([]);
  const [selectedLookupTableId, setSelectedLookupTableId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || propLookupTables) return;
    const docs = character.sotCatalogue?.overridePages || [];
    if (docs.length === 0) {
      setLoadedLookupTables([]);
      return;
    }
    let cancelled = false;
    const ownerId = getActiveHostSrdOwner() || character.name?.trim() || 'session-default';
    void Promise.all(
      docs.map((doc) =>
        loadSrdIngestArtifacts({
          characterName: character.name,
          characterId: ownerId,
          docFolder: srdDocFolderName(doc.title, doc.id),
        }).then((res) => (res.ok ? extractLookupTablesFromArtifacts(doc.title, res.artifacts) : []))
      )
    ).then((chunks) => {
      if (!cancelled) {
        setLoadedLookupTables(chunks.flat());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, character.name, character.sotCatalogue?.overridePages, propLookupTables]);

  const lookupTables = propLookupTables ?? loadedLookupTables;
  const activeLookupTable = selectedLookupTableId
    ? lookupTables.find((t) => t.id === selectedLookupTableId) || null
    : null;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [isEditing, setIsEditing] = useState(false);

  // Read AI Listener Module Permissions & Journal Settings
  const aiSettings = character.installedModules?.aiSettings || DEFAULT_AI_MODULE_SETTINGS;
  const allowedModules = {
    ...DEFAULT_AI_MODULE_SETTINGS.allowedModules!,
    ...(aiSettings.allowedModules || {}),
  };

  const isVoiceGeneratorEnabled = Boolean(allowedModules.journalVoice);
  const isSketchGeneratorEnabled = Boolean(allowedModules.journalSketch);

  const activeVoiceTone =
    aiSettings.preferredVoice ||
    DEFAULT_AI_MODULE_SETTINGS.preferredVoice ||
    'Terse, serious, no-nonsense, gruff veteran';
  const activeVoiceSample =
    aiSettings.voiceSampleText || DEFAULT_AI_MODULE_SETTINGS.voiceSampleText || '';
  const activeArtStylePrompt =
    aiSettings.artStylePrompt ||
    DEFAULT_AI_MODULE_SETTINGS.artStylePrompt ||
    'Graphite cross-hatch on weathered parchment';

  // Local In-Character Journal Entry Generator Drawer State (Hidden if journalVoice permission is off)
  const [isVoiceDrawerOpen, setIsVoiceDrawerOpen] = useState(false);
  const [voiceSessionPrompt, setVoiceSessionPrompt] = useState('');
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Local Pencil Sketch Generator Drawer State (Hidden if journalSketch permission is off)
  const [isSketchDrawerOpen, setIsSketchDrawerOpen] = useState(false);
  const [sketchPrompt, setSketchPrompt] = useState('');
  const [sketchQuality, setSketchQuality] = useState<SketchDetailQuality>(
    aiSettings.defaultSketchQuality || 'tasteful'
  );
  const [isGeneratingSketch, setIsGeneratingSketch] = useState(false);

  // New note input for recalled notes
  const [newRecalledNoteText, setNewRecalledNoteText] = useState('');
  const [syncedToScratchpadNotice, setSyncedToScratchpadNotice] = useState(false);
  const [selectedAvailableSpellId, setSelectedAvailableSpellId] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableSpells = getAvailableDirectorySpells(character);
  const activeAvailableSpell = selectedAvailableSpellId
    ? availableSpells.find((s) => s.id === selectedAvailableSpellId) || null
    : null;

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) || entries[0] || null;
  const allTags = Array.from(new Set(entries.flatMap((e) => e.tags || [])));

  const filteredEntries = entries.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.location && e.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.recalledNotes &&
        e.recalledNotes.some((n) => n.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesTag = selectedTag === 'all' || (e.tags && e.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  const handleCreateNewEntry = () => {
    const newId = `entry-${Date.now()}`;
    const newEntry: JournalEntry = {
      id: newId,
      title: `Session ${entries.length + 1} Record`,
      sessionDate: `Session ${entries.length + 1} - 4714 AR`,
      realDate: new Date().toISOString().split('T')[0],
      location: character.campaign ? `${character.campaign} Camp` : 'Patrivia Marsh Camp',
      content: `The party gathered beneath the flickering lamplight as the session began...\n\n`,
      recalledNotes: ['Inspect perimeter and restock rations before morning'],
      images: [],
      tags: ['Session Log', 'Campaign'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onUpdateCharacter((prev) => ({
      ...prev,
      journal: [newEntry, ...(prev.journal || [])],
    }));
    setSelectedEntryId(newId);
    setIsEditing(true);
  };

  const handleUpdateCurrentEntry = (updates: Partial<JournalEntry>) => {
    if (!selectedEntry) return;
    onUpdateCharacter((prev) => ({
      ...prev,
      journal: (prev.journal || []).map((e) =>
        e.id === selectedEntry.id ? { ...e, ...updates, updatedAt: Date.now() } : e
      ),
    }));
  };

  const handleDeleteEntry = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this journal entry?')) return;
    onUpdateCharacter((prev) => {
      const remaining = (prev.journal || []).filter((e) => e.id !== id);
      return { ...prev, journal: remaining };
    });
    const remaining = entries.filter((e) => e.id !== id);
    if (remaining.length > 0) {
      setSelectedEntryId(remaining[0].id);
    } else {
      setSelectedEntryId('');
    }
  };

  const handleAddRecalledNote = () => {
    if (!newRecalledNoteText.trim() || !selectedEntry) return;
    handleUpdateCurrentEntry({
      recalledNotes: [...(selectedEntry.recalledNotes || []), newRecalledNoteText.trim()],
    });
    setNewRecalledNoteText('');
  };

  const handleRemoveRecalledNote = (index: number) => {
    if (!selectedEntry) return;
    const updated = [...(selectedEntry.recalledNotes || [])];
    updated.splice(index, 1);
    handleUpdateCurrentEntry({ recalledNotes: updated });
  };

  // Sync current entry's recall notes & location to the Character Scratchpad
  const handlePushNotesToScratchpad = () => {
    if (!selectedEntry) return;
    const noteLines = (selectedEntry.recalledNotes || []).map((n) => `- ${n}`).join('\n');
    const memoBlock = `\n== Journal Reference: ${selectedEntry.title} (${
      selectedEntry.location || 'Field'
    }) ==\n${noteLines || selectedEntry.content.slice(0, 160)}`;

    onUpdateCharacter((prev) => ({
      ...prev,
      characterBio: {
        portraits: prev.characterBio?.portraits || [],
        currentPortraitIndex: prev.characterBio?.currentPortraitIndex || 0,
        bioSections: prev.characterBio?.bioSections || [],
        skin: prev.characterBio?.skin || '',
        ...prev.characterBio,
        scratchpad: `${(prev.characterBio?.scratchpad || '').trim()}${memoBlock}`.trim(),
      },
      rollupNotes: {
        isRolledUp: prev.rollupNotes?.isRolledUp ?? false,
        content: `${(prev.rollupNotes?.content || '').trim()}${memoBlock}`.trim(),
      },
    }));
    setSyncedToScratchpadNotice(true);
    setTimeout(() => setSyncedToScratchpadNotice(false), 2500);
  };

  // Local AI Journal Entry Generator (uses voice behavior sample from Journal Settings)
  const handleGenerateVoiceEntry = async (mode: 'new_entry' | 'append_current') => {
    if (!voiceSessionPrompt.trim()) return;
    setIsGeneratingVoice(true);
    setVoiceError(null);
    try {
      const combinedVoiceInstruction = activeVoiceSample
        ? `${activeVoiceTone}. Voice behavior sample: "${activeVoiceSample}"`
        : activeVoiceTone;

      const res = await generateJournalEntryInVoice(
        voiceSessionPrompt.trim(),
        combinedVoiceInstruction,
        character,
      );

      if (mode === 'append_current' && selectedEntry) {
        handleUpdateCurrentEntry({
          content: `${selectedEntry.content.trim()}\n\n${res.content}`,
          recalledNotes: [
            ...(selectedEntry.recalledNotes || []),
            ...(res.recalledNotes || []),
          ],
          characterVoiceUsed: activeVoiceTone,
        });
      } else {
        const newId = `entry-ai-${Date.now()}`;
        const newEntry: JournalEntry = {
          id: newId,
          title: res.title,
          sessionDate: res.sessionDate,
          realDate: new Date().toISOString().split('T')[0],
          location: character.campaign || 'Patrivia Marsh',
          content: res.content,
          characterVoiceUsed: activeVoiceTone,
          recalledNotes: res.recalledNotes || [],
          images: [],
          tags: ['In-Character', 'AI Chronicle'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        onUpdateCharacter((prev) => ({
          ...prev,
          journal: [newEntry, ...(prev.journal || [])],
        }));
        setSelectedEntryId(newId);
      }

      setVoiceSessionPrompt('');
      setIsVoiceDrawerOpen(false);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  // Local Pencil Sketch Generator (uses artStylePrompt from Journal Settings)
  const handleGeneratePencilSketch = async () => {
    if (!sketchPrompt.trim() || !selectedEntry) return;
    setIsGeneratingSketch(true);
    try {
      const fullSubject = activeArtStylePrompt
        ? `${sketchPrompt.trim()} (${activeArtStylePrompt})`
        : sketchPrompt.trim();

      const res = await generatePencilSketch(
        fullSubject,
        sketchQuality,
      );

      const newImage: JournalImage = {
        id: `sketch-${Date.now()}`,
        url: res.imageUrl,
        caption: res.caption || `Field sketch: ${sketchPrompt.trim()}`,
        style: 'sketch',
        quality: sketchQuality,
        prompt: sketchPrompt.trim(),
        createdAt: Date.now(),
      };

      handleUpdateCurrentEntry({
        images: [...(selectedEntry.images || []), newImage],
      });

      setSketchPrompt('');
      setIsSketchDrawerOpen(false);
    } finally {
      setIsGeneratingSketch(false);
    }
  };

  const handleRemoveImage = (imgId: string) => {
    if (!selectedEntry) return;
    handleUpdateCurrentEntry({
      images: (selectedEntry.images || []).filter((img) => img.id !== imgId),
    });
  };

  const isDark = theme === 'blueprint' || theme === 'mythweavers';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 md:p-6 overflow-hidden">
      <div
        className={`w-full max-w-6xl h-[92vh] rounded-xl flex flex-col shadow-2xl border overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-cyan-500/40 text-slate-100'
            : 'bg-[#faf6ee] border-amber-900/30 text-stone-900'
        }`}
      >
        {/* Header Bar */}
        <div
          className={`p-4 border-b flex items-center justify-between shrink-0 select-none ${
            isDark ? 'bg-slate-950/80 border-cyan-500/30' : 'bg-[#f4ebe1] border-amber-800/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center border shadow-xs ${
                isDark
                  ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300'
                  : 'bg-amber-100 border-amber-700 text-amber-900'
              }`}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif font-bold text-lg tracking-wide">
                  {hasSpellBook
                    ? SPELL_BOOK_JOURNAL_TITLE
                    : `${character.name}’s Session Journal & Chronicle`}
                </h2>
                {hasSpellBook && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 font-semibold">
                    {character.name} • {spellBookPages.length} Pages
                  </span>
                )}
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 font-semibold">
                  {entries.length} Entries
                </span>
              </div>
              <p className="text-xs opacity-75 font-serif">
                {hasSpellBook
                  ? 'Spell Book level pages (levels 1–9), session logs, reference lookup tables, and field sketches'
                  : 'Session logs, recall notes, field pencil sketches, and in-character chronicles'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Local Journal Entry Generator Trigger (Shown ONLY when journalVoice permission is enabled) */}
            {isVoiceGeneratorEnabled && (
              <button
                onClick={() => {
                  setIsVoiceDrawerOpen(!isVoiceDrawerOpen);
                  setIsSketchDrawerOpen(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-xs transition-colors ${
                  isVoiceDrawerOpen
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-cyan-700 hover:bg-cyan-600 text-white'
                }`}
                title="Generate an in-character journal entry using your preset voice behavior sample"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Voice Entry</span>
              </button>
            )}

            {/* Local Pencil Sketch Generator Trigger (Shown ONLY when journalSketch permission is enabled) */}
            {isSketchGeneratorEnabled && selectedEntry && (
              <button
                onClick={() => {
                  setIsSketchDrawerOpen(!isSketchDrawerOpen);
                  setIsVoiceDrawerOpen(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition-colors ${
                  isSketchDrawerOpen
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'border-amber-600/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300'
                }`}
                title="Draw a graphite pencil sketch into this journal entry"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Pencil Sketch</span>
              </button>
            )}

            {/* Link to AI Companion Journal Settings / Module Permissions */}
            {onOpenAITool && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAITool(
                    isVoiceGeneratorEnabled || isSketchGeneratorEnabled
                      ? 'journal_settings'
                      : 'permissions'
                  );
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors"
                title="Open AI Companion to configure Voice Behavior Sample, Art Style Prompt, or Module Permissions"
              >
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
                <span>Voice &amp; Art Settings</span>
              </button>
            )}

            <button
              onClick={handleCreateNewEntry}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 text-white shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Session Log</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 opacity-70" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Entry List & Filters */}
          <div
            className={`w-80 md:w-96 border-r flex flex-col shrink-0 overflow-hidden ${
              isDark ? 'bg-slate-950/40 border-cyan-500/20' : 'bg-[#f7f1e6] border-amber-900/20'
            }`}
          >
            {/* Search and Tags */}
            <div className="p-3 border-b space-y-2 shrink-0 border-inherit">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 opacity-40" />
                <input
                  type="text"
                  placeholder="Search logs, notes, locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-8 pr-3 py-1.5 rounded text-xs border outline-hidden transition-all ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-cyan-400'
                      : 'bg-white border-stone-300 text-stone-900 focus:border-amber-700'
                  }`}
                />
              </div>

              {allTags.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-none">
                  <button
                    onClick={() => setSelectedTag('all')}
                    className={`px-2 py-0.5 rounded shrink-0 border transition-colors ${
                      selectedTag === 'all'
                        ? 'bg-amber-700 text-white border-amber-700'
                        : 'bg-black/5 dark:bg-white/5 border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    All
                  </button>
                  {allTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTag(t)}
                      className={`px-2 py-0.5 rounded shrink-0 border transition-colors ${
                        selectedTag === t
                          ? 'bg-amber-700 text-white border-amber-700'
                          : 'bg-black/5 dark:bg-white/5 border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Entry List */}
            <div className="flex-1 overflow-y-auto divide-y divide-inherit">
              {filteredEntries.length === 0 ? (
                <div className="p-8 text-center text-xs opacity-50 font-serif">
                  No journal records found. Click &quot;New Session Log&quot; to begin your chronicle!
                </div>
              ) : (
                filteredEntries.map((e) => {
                  const isSelected = selectedEntry && selectedEntry.id === e.id;
                  return (
                    <div
                      key={e.id}
                      onClick={() => {
                        setSelectedEntryId(e.id);
                        setIsEditing(false);
                      }}
                      className={`p-3 cursor-pointer transition-colors select-none ${
                        isSelected
                          ? isDark
                            ? 'bg-cyan-950/60 border-l-4 border-l-cyan-400 text-cyan-100'
                            : 'bg-amber-100/80 border-l-4 border-l-amber-800 text-stone-950 font-medium'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] font-semibold opacity-70 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>{e.sessionDate}</span>
                        </span>
                        {e.images && e.images.length > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            <ImageIcon className="w-2.5 h-2.5" />
                            <span>{e.images.length}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="font-serif font-bold text-sm leading-snug line-clamp-1 mb-1">
                        {e.title}
                      </h4>

                      <p className="font-serif text-xs opacity-75 line-clamp-2 leading-relaxed mb-1.5">
                        {e.content}
                      </p>

                      <div className="flex items-center justify-between text-[10px] opacity-70">
                        {e.location ? (
                          <span className="flex items-center gap-1 truncate max-w-[150px]">
                            <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                            <span className="truncate">{e.location}</span>
                          </span>
                        ) : (
                          <span />
                        )}
                        {e.recalledNotes && e.recalledNotes.length > 0 && (
                          <span className="font-mono text-amber-600 dark:text-amber-400">
                            {e.recalledNotes.length} recall notes
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reference Lookup Tables (Read-Only auxiliary tables from SOT ingest) */}
            {lookupTables.length > 0 && (
              <div
                className={`p-3 border-t space-y-2 shrink-0 ${
                  isDark ? 'border-amber-500/30 bg-amber-950/20' : 'border-amber-300 bg-amber-50/70'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-amber-600 dark:text-amber-300 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Table2 className="w-3.5 h-3.5" />
                    <span>Reference Lookup Tables ({lookupTables.length})</span>
                  </span>
                  <span className="text-[9px] opacity-75">Read-Only</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pf1-theme-scrollbar">
                  {lookupTables.map((tbl) => (
                    <button
                      key={tbl.id}
                      type="button"
                      onClick={() =>
                        setSelectedLookupTableId((cur) => (cur === tbl.id ? null : tbl.id))
                      }
                      className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                        activeLookupTable?.id === tbl.id
                          ? 'bg-amber-600 text-white border-amber-500 font-bold'
                          : isDark
                          ? 'bg-slate-900 border-amber-500/35 text-amber-200 hover:border-amber-400'
                          : 'bg-white border-amber-300 text-amber-900 hover:border-amber-500'
                      }`}
                    >
                      {tbl.caption}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* B3: Available Spells Linked from Action Directory */}
            {availableSpells.length > 0 && (
              <div
                className={`p-3 border-t space-y-2 shrink-0 ${
                  isDark ? 'border-purple-500/30 bg-purple-950/20' : 'border-purple-300 bg-purple-50/70'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-purple-600 dark:text-purple-300 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Available Spells ({availableSpells.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      ctx?.updateLayout({ activeSheet: 2, showAllSheets: false });
                      onClose();
                    }}
                    className="text-[10px] hover:underline flex items-center gap-0.5"
                    title="Open Page 2 Actions & Resources"
                  >
                    <span>Actions</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {availableSpells.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() =>
                        setSelectedAvailableSpellId((cur) => (cur === sp.id ? null : sp.id))
                      }
                      className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors flex items-center gap-1 ${
                        activeAvailableSpell?.id === sp.id
                          ? 'bg-purple-600 text-white border-purple-500 font-bold'
                          : isDark
                          ? 'bg-slate-900 border-purple-500/35 text-purple-200 hover:border-purple-400'
                          : 'bg-white border-purple-300 text-purple-900 hover:border-purple-500'
                      }`}
                    >
                      <span>{sp.name}</span>
                      <span className="opacity-70 text-[9px]">L{sp.spellLevel ?? 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Entry Reader, Local AI Generators & Editor */}
          <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 space-y-5">
            {activeAvailableSpell && (
              <div
                className={`p-4 rounded-xl border space-y-2 shadow-sm ${
                  isDark
                    ? 'bg-purple-950/30 border-purple-500/45 text-purple-100'
                    : 'bg-purple-50 border-purple-300 text-stone-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Wand2 className="w-4 h-4 text-purple-400" />
                    <span className="font-serif font-bold text-sm">{activeAvailableSpell.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/30">
                      Lvl {activeAvailableSpell.spellLevel ?? 1} •{' '}
                      {activeAvailableSpell.actionType || 'Standard'}
                    </span>
                    {activeAvailableSpell.saveDC && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30">
                        DC{' '}
                        {
                          evaluateDirectoryMacroValue(
                            activeAvailableSpell.saveDC,
                            character,
                            ctx?.derived
                          ).display
                        }
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        ctx?.updateLayout({ activeSheet: 2, showAllSheets: false });
                        onClose();
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1"
                    >
                      <span>Open on Sheet</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAvailableSpellId(null)}
                      className="p-1 opacity-60 hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs font-sans leading-relaxed whitespace-pre-wrap opacity-90">
                  {activeAvailableSpell.description}
                </p>
              </div>
            )}
            {activeLookupTable && (
              <div
                className={`p-4 rounded-xl border space-y-2 shadow-sm ${
                  isDark
                    ? 'bg-amber-950/25 border-amber-500/40 text-amber-100'
                    : 'bg-amber-50 border-amber-300 text-stone-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Table2 className="w-4 h-4 text-amber-500" />
                    <span className="font-serif font-bold text-sm">{activeLookupTable.caption}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/35">
                      lookup-table • {activeLookupTable.docTitle} • Read-Only
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLookupTableId(null)}
                    className="p-1 opacity-60 hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="overflow-x-auto pf1-theme-scrollbar">
                  <table className="min-w-full text-[11px] border-collapse">
                    {activeLookupTable.headers.length > 0 && (
                      <thead>
                        <tr className="border-b border-black/15 dark:border-white/15 text-left">
                          {activeLookupTable.headers.map((h, i) => (
                            <th key={i} className="px-2 py-1 font-mono font-bold whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {activeLookupTable.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-black/10 dark:border-white/10">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-2 py-1 align-top">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* LOCAL IN-CHARACTER JOURNAL ENTRY GENERATOR (Visible only when journalVoice permission is enabled) */}
            {isVoiceGeneratorEnabled && isVoiceDrawerOpen && (
              <div
                className={`p-4 rounded-xl border space-y-3 shadow-sm ${
                  isDark ? 'bg-slate-950 border-cyan-500/50' : 'bg-amber-50/95 border-amber-800/35'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="font-serif font-bold text-sm">
                      In-Character Journal Entry Generator
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="opacity-75 truncate max-w-xs">
                      Active Voice: <strong>{activeVoiceTone}</strong>
                    </span>
                    {onOpenAITool && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenAITool('journal_settings');
                        }}
                        className="text-cyan-500 hover:underline font-bold"
                      >
                        Edit Voice Sample &rarr;
                      </button>
                    )}
                  </div>
                </div>

                {activeVoiceSample && (
                  <div className="p-2 rounded bg-black/5 dark:bg-white/5 text-[11px] font-serif italic opacity-80">
                    Voice Sample: &ldquo;{activeVoiceSample}&rdquo;
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold opacity-80 block">
                    What happened in today&apos;s session?
                  </label>
                  <textarea
                    rows={3}
                    value={voiceSessionPrompt}
                    onChange={(e) => setVoiceSessionPrompt(e.target.value)}
                    placeholder="e.g. Ambushed by rougarou enforcers in Patrivia Marsh, found an old brass key, rested at the ruined watchtower..."
                    className={`w-full p-2.5 rounded-lg text-xs font-serif border outline-hidden resize-none ${
                      isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-amber-300'
                    }`}
                  />
                </div>

                {voiceError && (
                  <div className="p-2.5 rounded-lg border bg-rose-950/30 border-rose-500/50 text-rose-400 text-xs font-mono">
                    {voiceError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setIsVoiceDrawerOpen(false)}
                    className="px-3 py-1.5 rounded text-xs font-mono opacity-70 hover:opacity-100"
                  >
                    Cancel
                  </button>
                  {selectedEntry && (
                    <button
                      onClick={() => handleGenerateVoiceEntry('append_current')}
                      disabled={isGeneratingVoice || !voiceSessionPrompt.trim()}
                      className="px-3 py-1.5 rounded text-xs font-mono font-bold border border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/10 disabled:opacity-50 transition-colors"
                    >
                      Append to Current Entry
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerateVoiceEntry('new_entry')}
                    disabled={isGeneratingVoice || !voiceSessionPrompt.trim()}
                    className="px-4 py-1.5 rounded text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isGeneratingVoice ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Writing in Voice...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Write New Chronicle Entry</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {selectedEntry ? (
              <>
                {/* Entry Meta Header */}
                <div className="border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-inherit">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        type="text"
                        value={selectedEntry.title}
                        onChange={(e) => handleUpdateCurrentEntry({ title: e.target.value })}
                        className={`text-xl font-serif font-bold w-full rounded px-2 py-1 border outline-hidden ${
                          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-amber-300'
                        }`}
                      />
                    ) : (
                      <h3 className="text-2xl font-serif font-bold tracking-tight">
                        {selectedEntry.title}
                      </h3>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono opacity-80 mt-1.5">
                      {isEditing ? (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="opacity-60">Session:</span>
                            <input
                              type="text"
                              value={selectedEntry.sessionDate}
                              onChange={(e) =>
                                handleUpdateCurrentEntry({ sessionDate: e.target.value })
                              }
                              className="px-1.5 py-0.5 rounded border text-xs bg-transparent border-slate-600"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="opacity-60">Location:</span>
                            <input
                              type="text"
                              value={selectedEntry.location || ''}
                              onChange={(e) =>
                                handleUpdateCurrentEntry({ location: e.target.value })
                              }
                              className="px-1.5 py-0.5 rounded border text-xs bg-transparent border-slate-600"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                            <span>{selectedEntry.sessionDate}</span>
                          </span>
                          {selectedEntry.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-rose-500" />
                              <span>{selectedEntry.location}</span>
                            </span>
                          )}
                          {selectedEntry.realDate && (
                            <span className="flex items-center gap-1 opacity-60">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Recorded: {selectedEntry.realDate}</span>
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className={`px-3 py-1.5 rounded text-xs font-mono font-semibold border flex items-center gap-1.5 transition-colors ${
                        isEditing
                          ? 'bg-amber-700 text-white border-amber-700'
                          : 'bg-black/5 dark:bg-white/5 border-inherit hover:opacity-100'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isEditing ? 'Done Editing' : 'Edit Text'}</span>
                    </button>

                    {isSketchGeneratorEnabled && (
                      <button
                        onClick={() => setIsSketchDrawerOpen(!isSketchDrawerOpen)}
                        className="px-3 py-1.5 rounded text-xs font-mono font-semibold border border-amber-600/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center gap-1.5 transition-colors"
                        title="Generate a hand-drawn pencil sketch directly into this log"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Pencil Sketch</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteEntry(selectedEntry.id)}
                      className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="Delete Entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* LOCAL PENCIL SKETCH GENERATOR DRAWER (Shown ONLY when journalSketch permission is enabled) */}
                {isSketchGeneratorEnabled && isSketchDrawerOpen && (
                  <div
                    className={`p-4 rounded-xl border space-y-3 ${
                      isDark ? 'bg-slate-950 border-cyan-500/40' : 'bg-amber-50/90 border-amber-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-amber-600" />
                        <span className="font-serif font-bold text-sm">
                          Pencil Sketch Prompt (Local Journal Studio)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          Style: {activeArtStylePrompt}
                        </span>
                        {onOpenAITool && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenAITool('journal_settings');
                            }}
                            className="text-cyan-500 hover:underline font-bold"
                          >
                            Edit Art Style &rarr;
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[11px] font-mono font-bold opacity-75 block">
                          Sketch Subject / Prompt:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Patrivia Marsh watchtower, Rougarou tracks in bog mud, Ancient longsword relic..."
                          value={sketchPrompt}
                          onChange={(e) => setSketchPrompt(e.target.value)}
                          className={`w-full px-3 py-1.5 rounded text-xs border outline-hidden ${
                            isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-amber-300'
                          }`}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-mono font-bold opacity-75 block">
                          Pencil Detail Quality:
                        </label>
                        <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                          {(['crude', 'passible', 'tasteful', 'astounding'] as SketchDetailQuality[]).map(
                            (q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => setSketchQuality(q)}
                                className={`px-2 py-1 rounded capitalize border transition-all text-center ${
                                  sketchQuality === q
                                    ? 'bg-amber-700 text-white border-amber-700 font-bold shadow-xs'
                                    : 'bg-black/5 dark:bg-white/5 border-inherit opacity-75 hover:opacity-100'
                                }`}
                              >
                                {q}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setIsSketchDrawerOpen(false)}
                        className="px-3 py-1 rounded text-xs font-mono opacity-70 hover:opacity-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleGeneratePencilSketch}
                        disabled={isGeneratingSketch || !sketchPrompt.trim()}
                        className="px-4 py-1.5 rounded text-xs font-mono font-bold bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        {isGeneratingSketch ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Sketching...</span>
                          </>
                        ) : (
                          <>
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Draw &amp; Attach Sketch</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Entry Narrative Content */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono opacity-75">
                    <span className="uppercase tracking-wider font-bold">Session Narrative</span>
                    <span>{selectedEntry.content.length} characters</span>
                  </div>

                  {isEditing ? (
                    <textarea
                      rows={12}
                      value={selectedEntry.content}
                      onChange={(e) => handleUpdateCurrentEntry({ content: e.target.value })}
                      placeholder="Write your session chronicles here..."
                      className={`w-full p-4 rounded-xl font-serif text-sm leading-relaxed border outline-hidden shadow-inner resize-y ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-100'
                          : 'bg-white border-amber-300 text-stone-900'
                      }`}
                    />
                  ) : (
                    <div
                      className={`p-5 rounded-xl font-serif text-sm leading-relaxed whitespace-pre-wrap border shadow-xs ${
                        isDark
                          ? 'bg-slate-950/60 border-cyan-500/20'
                          : 'bg-white/90 border-amber-900/15'
                      }`}
                    >
                      {selectedEntry.content}
                    </div>
                  )}
                </div>

                {/* Recalled Notes Section + Sync to Scratchpad */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-slate-950/40 border-cyan-500/20' : 'bg-[#f4efe4] border-amber-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-amber-600" />
                      <h4 className="font-serif font-bold text-sm">
                        Recalled Notes &amp; Scratchpad Cross-Reference
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {syncedToScratchpadNotice && (
                        <span className="text-[11px] font-mono text-emerald-500 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Referenced in Scratchpad!
                        </span>
                      )}
                      <button
                        onClick={handlePushNotesToScratchpad}
                        className="px-2.5 py-1 rounded text-[11px] font-mono font-bold bg-amber-700/20 hover:bg-amber-700/30 text-amber-700 dark:text-amber-300 border border-amber-600/30 flex items-center gap-1 transition-colors"
                        title="Send these session clues to your character Scratchpad"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Reference in Scratchpad</span>
                      </button>
                    </div>
                  </div>

                  {/* Note List */}
                  <div className="space-y-1.5">
                    {(!selectedEntry.recalledNotes || selectedEntry.recalledNotes.length === 0) && (
                      <p className="text-xs opacity-50 font-serif italic py-1">
                        No recalled notes logged for this session yet.
                      </p>
                    )}
                    {(selectedEntry.recalledNotes || []).map((note, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border text-xs font-serif flex items-start justify-between gap-2 transition-colors ${
                          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-amber-200'
                        }`}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <CheckSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span className="leading-snug break-words">{note}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveRecalledNote(idx)}
                          className="opacity-50 hover:opacity-100 hover:text-rose-500 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add note input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add clue, setting detail, NPC contact or item to remember..."
                      value={newRecalledNoteText}
                      onChange={(e) => setNewRecalledNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddRecalledNote();
                      }}
                      className={`flex-1 px-3 py-1.5 rounded text-xs border outline-hidden ${
                        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-amber-300'
                      }`}
                    />
                    <button
                      onClick={handleAddRecalledNote}
                      disabled={!newRecalledNoteText.trim()}
                      className="px-3 py-1.5 rounded text-xs font-mono font-bold bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white transition-colors"
                    >
                      Add Note
                    </button>
                  </div>
                </div>

                {/* Attached Pencil Sketches & Illustrations Gallery */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-amber-600" />
                      <h4 className="font-serif font-bold text-sm">
                        Session Field Sketches &amp; Imagery ({selectedEntry.images?.length || 0})
                      </h4>
                    </div>
                  </div>

                  {!selectedEntry.images || selectedEntry.images.length === 0 ? (
                    <div
                      className={`p-6 rounded-xl border border-dashed text-center font-serif text-xs opacity-60 ${
                        isDark ? 'border-slate-800' : 'border-amber-900/20'
                      }`}
                    >
                      {isSketchGeneratorEnabled
                        ? 'No illustrations attached yet. Click "Pencil Sketch" above to draw an authentic graphite sketch!'
                        : 'No illustrations attached yet. (Enable Pencil Sketch Prompt in AI Companion -> Module Permissions to draw sketches here.)'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedEntry.images.map((img) => (
                        <div
                          key={img.id}
                          className={`rounded-xl border overflow-hidden shadow-sm flex flex-col ${
                            isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-amber-900/20'
                          }`}
                        >
                          <div className="relative group bg-black/10 overflow-hidden flex items-center justify-center max-h-60">
                            <img
                              src={img.url}
                              alt={img.caption || 'Session sketch'}
                              className="w-full h-auto object-contain max-h-60"
                            />
                            <button
                              onClick={() => handleRemoveImage(img.id)}
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-all shadow-md"
                              title="Remove image"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {img.quality && (
                              <span className="absolute bottom-2 left-2 text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-900/85 text-amber-200 border border-amber-500/30 uppercase font-bold tracking-wider">
                                {img.quality} Detail
                              </span>
                            )}
                          </div>
                          {img.caption && (
                            <div className="p-2.5 font-serif text-xs italic border-t border-inherit opacity-85">
                              {img.caption}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60 font-serif">
                <BookOpen className="w-12 h-12 mb-3 stroke-[1.5] text-amber-600" />
                <h3 className="text-lg font-bold">No Entry Selected</h3>
                <p className="text-xs max-w-sm mt-1">
                  Select a session chronicle from the list on the left or create a brand new log.
                </p>
                <button
                  onClick={handleCreateNewEntry}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-mono font-bold bg-amber-700 hover:bg-amber-600 text-white shadow-xs transition-colors"
                >
                  Create First Session Log
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
