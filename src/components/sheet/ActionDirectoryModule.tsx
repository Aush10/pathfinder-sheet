import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Dices,
  Edit3,
  Flame,
  FolderPlus,
  GitBranch,
  Hash,
  Layers,
  Palette,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import type {
  ActionDirectoryEntryType,
  ActionDirectoryTab,
  CharacterActionItem,
  PF1Character,
  ResourceTracker,
} from '../../types/character';
import type { DerivedCombatStats } from '../../engine/pf1eMath';
import {
  DEFAULT_ABILITY_TYPES,
  RESOURCE_BAR_COLORS,
  buildActionFromMacroResult,
  evaluateDirectoryMacroValue,
  filterDirectoryEntries,
  getAltsForEntry,
  isAltEligibleEntry,
  normalizeDirectoryEntries,
  resolveActionEntryType,
  resolveResourceColor,
  searchCharacterMacros,
  stepResourceBarValue,
  type SearchableMacroResult,
} from '../../engine/actionDirectory';
import { lookupRulesWithSOT, RulesLookupResult } from '../../engine/aiService';
import { AppleEyeIcon } from '../common/AppleEyeIcon';
import { FieldCallTooltip } from '../common/FieldCallTooltip';

interface ActionDirectoryModuleProps {
  character: PF1Character;
  derived: DerivedCombatStats;
  theme: string;
  onUpdateCharacter: (updater: (prev: PF1Character) => PF1Character) => void;
  onRollFormula: (formula: string, label?: string) => void;
}

const ACTION_COST_OPTIONS: NonNullable<CharacterActionItem['actionType']>[] = [
  'Standard',
  'Move',
  'Swift',
  'Immediate',
  'Free',
  'Full-Round',
  '1 Round',
  'Passive / Pool',
];

const ICON_OPTIONS = [
  { id: 'sparkles', label: 'Sparkles' },
  { id: 'swords', label: 'Swords' },
  { id: 'flame', label: 'Flame' },
  { id: 'shield', label: 'Shield' },
  { id: 'crosshair', label: 'Crosshair' },
  { id: 'zap', label: 'Lightning' },
  { id: 'book', label: 'Tome' },
  { id: 'wand', label: 'Wand' },
  { id: 'hash', label: 'Counter' },
];

export const ActionDirectoryModule: React.FC<ActionDirectoryModuleProps> = ({
  character,
  derived,
  theme,
  onUpdateCharacter,
  onRollFormula,
}) => {
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

  const itemCardBg = isParchment
    ? 'border-amber-900/20 bg-white/65 hover:border-amber-700/50'
    : isBlueprint
    ? 'border-cyan-500/25 bg-slate-950/65 hover:border-cyan-400/60'
    : isMythWeavers
    ? 'border-[#2d3139] bg-[#0f1113]/90 hover:border-amber-500/45'
    : 'border-neutral-300 bg-neutral-50 hover:border-black';

  const inputStyle = isParchment
    ? 'bg-white/90 border-amber-900/30 text-stone-900 focus:border-amber-700 focus:bg-white'
    : isBlueprint
    ? 'bg-slate-950/85 border-cyan-700/60 text-cyan-200 focus:border-cyan-400'
    : isMythWeavers
    ? 'bg-[#0d0e10] border-[#383d47] text-amber-100 focus:border-amber-500'
    : 'bg-white border-neutral-400 text-black';

  // Search & Custom Tabs (no default category tabs!)
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabId, setActiveTabId] = useState<string>('all');
  const [isMakeTabOpen, setIsMakeTabOpen] = useState(false);
  const [newTabName, setNewTabName] = useState('');

  // Expandable description & active Alt view per entry
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [activeAltSelection, setActiveAltSelection] = useState<Record<string, string | null>>({});
  const [hoveredDogEarId, setHoveredDogEarId] = useState<string | null>(null);
  const [tabAssignPickerId, setTabAssignPickerId] = useState<string | null>(null);
  const [directoryNotice, setDirectoryNotice] = useState<string | null>(null);

  // Format picker & Editor modal state
  const [isFormatPickerOpen, setIsFormatPickerOpen] = useState(false);
  const [editorFormat, setEditorFormat] = useState<ActionDirectoryEntryType | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Shared editor form fields
  const [formName, setFormName] = useState('');
  const [formMacroKey, setFormMacroKey] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('sparkles');
  const [formActionCost, setFormActionCost] =
    useState<NonNullable<CharacterActionItem['actionType']>>('Standard');
  const [formSaveDC, setFormSaveDC] = useState('');
  const [formRollMacro, setFormRollMacro] = useState('');

  // Resource Bar specific fields (B1)
  const [formColor, setFormColor] = useState('amber');
  const [formStepperMacro, setFormStepperMacro] = useState('-1');
  const [formResourceCurrent, setFormResourceCurrent] = useState('3');
  const [formResourceMax, setFormResourceMax] = useState('3');

  // Ability specific fields (B2)
  const [formAbilityType, setFormAbilityType] = useState('Class Feature');
  const [isAddingCustomType, setIsAddingCustomType] = useState(false);
  const [newCustomTypeInput, setNewCustomTypeInput] = useState('');

  // Spell specific fields (B3)
  const [formSpellAvailable, setFormSpellAvailable] = useState(true);
  const [formSpellLevel, setFormSpellLevel] = useState('1');

  // Counter specific fields (B4)
  const [formTotalCountMacro, setFormTotalCountMacro] = useState('<<#LEVEL');

  // Alt specific fields (B5)
  const [formParentActionId, setFormParentActionId] = useState('');
  const [formShowAltCorner, setFormShowAltCorner] = useState(true);

  // Apple-Eye AI Seek state inside editor
  const [isSeekingAI, setIsSeekingAI] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    authority?: RulesLookupResult['sourceAuthority'];
    message: string;
  } | null>(null);

  const normalizedEntries = useMemo(
    () => normalizeDirectoryEntries(character.characterActions, character.resourceTrackers),
    [character.characterActions, character.resourceTrackers]
  );

  const customTabs: ActionDirectoryTab[] = character.actionDirectoryTabs || [];
  const activeTab = useMemo(
    () => customTabs.find((t) => t.id === activeTabId) || null,
    [customTabs, activeTabId]
  );

  const allAbilityTypes = useMemo(() => {
    const set = new Set<string>(DEFAULT_ABILITY_TYPES);
    (character.customAbilityTypes || []).forEach((t) => {
      if (t.trim()) set.add(t.trim());
    });
    normalizedEntries.forEach((e) => {
      if (e.abilityType?.trim()) set.add(e.abilityType.trim());
    });
    return Array.from(set);
  }, [character.customAbilityTypes, normalizedEntries]);

  const altEligibleOriginals = useMemo(
    () => normalizedEntries.filter((e) => isAltEligibleEntry(e)),
    [normalizedEntries]
  );

  const visibleEntries = useMemo(
    () => filterDirectoryEntries(normalizedEntries, { search: searchQuery, activeTab }),
    [normalizedEntries, searchQuery, activeTab]
  );

  const macroMatches = useMemo(
    () => searchCharacterMacros(character, searchQuery),
    [character, searchQuery]
  );

  const resourceEntryCount = useMemo(
    () => normalizedEntries.filter((e) => resolveActionEntryType(e) === 'resource').length,
    [normalizedEntries]
  );

  const entryById = useMemo(
    () => new Map(normalizedEntries.map((e) => [e.id, e])),
    [normalizedEntries]
  );

  const renderIcon = (iconName?: string) => {
    switch (iconName) {
      case 'flame':
        return <Flame className="w-4 h-4 text-amber-500" />;
      case 'swords':
        return <Swords className="w-4 h-4 text-rose-500" />;
      case 'shield':
        return <Shield className="w-4 h-4 text-emerald-500" />;
      case 'crosshair':
        return <Crosshair className="w-4 h-4 text-cyan-500" />;
      case 'book':
        return <BookOpen className="w-4 h-4 text-purple-500" />;
      case 'wand':
        return <Wand2 className="w-4 h-4 text-violet-400" />;
      case 'hash':
        return <Hash className="w-4 h-4 text-cyan-400" />;
      case 'zap':
        return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'sparkles':
      default:
        return <Sparkles className="w-4 h-4 text-amber-400" />;
    }
  };

  const resetEditorFields = () => {
    setFormName('');
    setFormMacroKey('');
    setFormDescription('');
    setFormIcon('sparkles');
    setFormActionCost('Standard');
    setFormSaveDC('');
    setFormRollMacro('');
    setFormColor('amber');
    setFormStepperMacro('-1');
    setFormResourceCurrent('3');
    setFormResourceMax('3');
    setFormAbilityType('Class Feature');
    setIsAddingCustomType(false);
    setNewCustomTypeInput('');
    setFormSpellAvailable(true);
    setFormSpellLevel('1');
    setFormTotalCountMacro('<<#LEVEL');
    setFormParentActionId('');
    setFormShowAltCorner(true);
    setLookupFeedback(null);
  };

  const openCreateFormat = (format: ActionDirectoryEntryType) => {
    setIsFormatPickerOpen(false);
    setEditingEntryId(null);
    resetEditorFields();

    if (format === 'resource') {
      setFormIcon('zap');
      setFormActionCost('Passive / Pool');
    } else if (format === 'spell') {
      setFormIcon('book');
    } else if (format === 'counter') {
      setFormIcon('hash');
    } else if (format === 'alt') {
      const firstOriginal = altEligibleOriginals[0];
      if (firstOriginal) {
        prefillAltFromOriginal(firstOriginal);
      }
    }

    setEditorFormat(format);
  };

  const prefillAltFromOriginal = (orig: CharacterActionItem) => {
    const origType = resolveActionEntryType(orig);
    setFormParentActionId(orig.id);
    setFormName(`${orig.name} (Alt)`);
    setFormMacroKey(orig.macroKey ? `${orig.macroKey}_ALT` : '');
    setFormIcon(orig.icon || (origType === 'spell' ? 'book' : 'sparkles'));
    setFormActionCost(orig.actionType || 'Standard');
    setFormSaveDC(orig.saveDC || '');
    setFormRollMacro(orig.macroFormula || '');
    setFormDescription(orig.description || '');
    setFormAbilityType(orig.abilityType || 'Class Feature');
    setFormSpellLevel(String(orig.spellLevel ?? 1));
    setFormSpellAvailable(orig.isAvailable !== false);
    setFormShowAltCorner(orig.showAltCorner !== false);
  };

  const openEditEntry = (entry: CharacterActionItem) => {
    const type = resolveActionEntryType(entry);
    setEditingEntryId(entry.id);
    resetEditorFields();

    setFormName(entry.name);
    setFormMacroKey(entry.macroKey || '');
    setFormDescription(entry.description || '');
    setFormIcon(entry.icon || (type === 'spell' ? 'book' : type === 'counter' ? 'hash' : 'sparkles'));
    setFormActionCost(entry.actionType || (type === 'resource' ? 'Passive / Pool' : 'Standard'));
    setFormSaveDC(entry.saveDC || '');
    setFormRollMacro(entry.macroFormula || '');

    setFormColor(entry.color || 'amber');
    setFormStepperMacro(entry.stepperMacro ?? '-1');
    setFormResourceCurrent(String(entry.resourceCurrent ?? 3));
    setFormResourceMax(String(entry.resourceMax ?? 3));

    setFormAbilityType(entry.abilityType || (entry.category === 'Racial' ? 'Racial' : 'Class Feature'));
    setFormSpellAvailable(Boolean(entry.isAvailable));
    setFormSpellLevel(String(entry.spellLevel ?? 1));
    setFormTotalCountMacro(entry.totalCountMacro || '<<#LEVEL');
    setFormParentActionId(entry.parentActionId || '');
    setFormShowAltCorner(Boolean(entry.showAltCorner));

    setEditorFormat(type);
  };

  const handleAddCustomAbilityType = () => {
    const clean = newCustomTypeInput.trim();
    if (!clean) return;
    onUpdateCharacter((prev) => {
      const existing = prev.customAbilityTypes || [];
      if (existing.some((t) => t.toLowerCase() === clean.toLowerCase())) return prev;
      return {
        ...prev,
        customAbilityTypes: [...existing, clean],
      };
    });
    setFormAbilityType(clean);
    setNewCustomTypeInput('');
    setIsAddingCustomType(false);
  };

  // Apple-Eye AI Seek inside the new format editors
  const handleSeekWithAppleEye = async () => {
    const isActionFieldAllowed =
      (character.installedModules?.aiSettings?.allowedFields?.actionsAndResources ?? true) !== false;
    if (!isActionFieldAllowed) {
      setLookupFeedback({
        type: 'error',
        message:
          'AI Blind Spot Active: "Action & Class Resource Directory" is disabled in AI Module Permissions.',
      });
      return;
    }

    const queryText = formName.trim();
    if (!queryText && !formDescription.trim() && !formMacroKey.trim()) {
      setLookupFeedback({
        type: 'warning',
        message:
          'Enter a name (or clue in Description / #MACRO_KEY) before clicking the Apple-Eye Seek button.',
      });
      return;
    }

    setIsSeekingAI(true);
    setLookupFeedback(null);

    try {
      const targetFormat = editorFormat || 'ability';
      const parentOrig =
        targetFormat === 'alt' && formParentActionId ? entryById.get(formParentActionId) : undefined;
      const isSpellTarget =
        targetFormat === 'spell' ||
        (targetFormat === 'alt' && parentOrig && resolveActionEntryType(parentOrig) === 'spell');

      const mappedFilter = isSpellTarget ? 'Spell' : 'Class Ability';

      const result = await lookupRulesWithSOT(queryText, mappedFilter, character, {
        directoryCategory: isSpellTarget
          ? 'Spells'
          : targetFormat === 'resource'
          ? 'Class Resource'
          : 'Class Ability',
        actionEconomy: formActionCost,
        macroKey: formMacroKey.trim() || undefined,
        saveDC: formSaveDC.trim() || undefined,
        descriptionHint: formDescription.trim() || undefined,
        hasResourcePool: targetFormat === 'resource',
      });

      if (!result.matched) {
        setLookupFeedback({
          type: 'warning',
          message:
            result.sourceNotes ||
            `No verified match found in SOT Docs, SOT Links, or PF1e SRD for "${queryText}".`,
        });
        return;
      }

      setFormName(result.title);
      setFormMacroKey(
        result.macroKey ||
          result.title
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
      );
      if (result.actionType) setFormActionCost(result.actionType);
      if (result.saveDC) setFormSaveDC(result.saveDC);
      if (result.suggestedMacro) setFormRollMacro(result.suggestedMacro);
      if (targetFormat === 'resource' && result.resourceMax) {
        setFormResourceMax(String(result.resourceMax));
        setFormResourceCurrent(String(result.resourceMax));
      }
      setFormDescription(result.fullDescription || result.summary);

      setLookupFeedback({
        type: 'success',
        authority: result.sourceAuthority,
        message: `Populated "${result.title}" (${result.sourceNotes})`,
      });
    } catch (err) {
      setLookupFeedback({
        type: 'warning',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSeekingAI(false);
    }
  };

  const handleSaveEntry = () => {
    if (!editorFormat || !formName.trim()) return;

    const cleanName = formName.trim();
    const cleanMacroKey =
      formMacroKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '') ||
      cleanName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

    const actionId = editingEntryId || `act-${Date.now()}`;
    const existingItem = editingEntryId ? entryById.get(editingEntryId) : undefined;
    const parentOrig =
      editorFormat === 'alt' && formParentActionId ? entryById.get(formParentActionId) : undefined;
    const altTargetType: 'ability' | 'spell' | undefined =
      editorFormat === 'alt'
        ? parentOrig && resolveActionEntryType(parentOrig) === 'spell'
          ? 'spell'
          : existingItem?.altTargetType || 'ability'
        : undefined;

    let savedItem: CharacterActionItem;

    if (editorFormat === 'resource') {
      const evaluatedFull = formRollMacro.trim()
        ? evaluateDirectoryMacroValue(formRollMacro.trim(), character, derived)
        : null;
      const parsedMax = Math.max(
        1,
        evaluatedFull && evaluatedFull.numeric !== null && evaluatedFull.numeric >= 1
          ? Math.round(evaluatedFull.numeric)
          : parseInt(formResourceMax, 10) || 1
      );
      const parsedCur = Math.max(
        0,
        Math.min(parsedMax, parseInt(formResourceCurrent, 10) || 0)
      );
      const linkedResId = existingItem?.linkedResourceId || `res-${actionId}`;

      savedItem = {
        ...(existingItem || {}),
        id: actionId,
        name: cleanName,
        entryType: 'resource',
        category: 'Class Resource',
        actionType: 'Passive / Pool',
        color: formColor,
        macroKey: cleanMacroKey,
        macroFormula: formRollMacro.trim() || String(parsedMax),
        stepperMacro: formStepperMacro.trim() || '-1',
        stepperStepCount: existingItem?.stepperStepCount || 0,
        description: formDescription.trim() || 'No description provided.',
        shortSummary: `${parsedCur}/${parsedMax} uses`,
        hasResourcePool: true,
        resourceCurrent: parsedCur,
        resourceMax: parsedMax,
        usesPerDay: `${parsedCur}/${parsedMax} remaining`,
        linkedResourceId: linkedResId,
      };
    } else if (editorFormat === 'spell') {
      const lvl = Math.max(0, Math.min(9, parseInt(formSpellLevel, 10) || 0));
      savedItem = {
        ...(existingItem || {}),
        id: actionId,
        name: cleanName,
        entryType: 'spell',
        category: 'Spells',
        icon: formIcon,
        macroKey: cleanMacroKey,
        isAvailable: formSpellAvailable,
        spellLevel: lvl,
        actionType: formActionCost,
        saveDC: formSaveDC.trim() || undefined,
        macroFormula: formRollMacro.trim() || undefined,
        description: formDescription.trim() || 'No description provided.',
        shortSummary: `Lvl ${lvl} Spell • ${formActionCost}`,
        hasResourcePool: false,
        showAltCorner: formShowAltCorner,
      };
    } else if (editorFormat === 'counter') {
      savedItem = {
        ...(existingItem || {}),
        id: actionId,
        name: cleanName,
        entryType: 'counter',
        category: 'Other',
        icon: formIcon,
        macroKey: cleanMacroKey,
        totalCountMacro: formTotalCountMacro.trim() || '0',
        description: formDescription.trim() || 'No description provided.',
        shortSummary: `Counter: ${formTotalCountMacro.trim() || '0'}`,
        hasResourcePool: false,
      };
    } else if (editorFormat === 'alt') {
      const lvl = Math.max(0, Math.min(9, parseInt(formSpellLevel, 10) || 0));
      savedItem = {
        ...(existingItem || {}),
        id: actionId,
        name: cleanName,
        entryType: 'alt',
        category: altTargetType === 'spell' ? 'Spells' : 'Class Ability',
        parentActionId: formParentActionId || existingItem?.parentActionId,
        altTargetType,
        abilityType: altTargetType === 'ability' ? formAbilityType : undefined,
        spellLevel: altTargetType === 'spell' ? lvl : undefined,
        isAvailable: altTargetType === 'spell' ? formSpellAvailable : undefined,
        icon: formIcon,
        macroKey: cleanMacroKey,
        actionType: formActionCost,
        saveDC: formSaveDC.trim() || undefined,
        macroFormula: formRollMacro.trim() || undefined,
        description: formDescription.trim() || 'No description provided.',
        shortSummary: `Alt • ${formActionCost}`,
        hasResourcePool: false,
      };
    } else {
      // 'ability'
      const abilityType = formAbilityType.trim() || 'Class Feature';
      savedItem = {
        ...(existingItem || {}),
        id: actionId,
        name: cleanName,
        entryType: 'ability',
        category: abilityType.toLowerCase() === 'racial' ? 'Racial' : 'Class Ability',
        abilityType,
        icon: formIcon,
        macroKey: cleanMacroKey,
        actionType: formActionCost,
        saveDC: formSaveDC.trim() || undefined,
        macroFormula: formRollMacro.trim() || undefined,
        description: formDescription.trim() || 'No description provided.',
        shortSummary: `${abilityType} • ${formActionCost}`,
        hasResourcePool: false,
        showAltCorner: formShowAltCorner,
      };
    }

    onUpdateCharacter((prev) => {
      let existingActions = [...(prev.characterActions || [])];
      const existingIdx = existingActions.findIndex((a) => a.id === actionId);
      if (existingIdx >= 0) {
        existingActions[existingIdx] = savedItem;
      } else {
        existingActions.push(savedItem);
      }

      // If creating/saving an Alt and user checked "Enable dog-ear corner on original", update parent
      if (editorFormat === 'alt' && savedItem.parentActionId) {
        existingActions = existingActions.map((a) =>
          a.id === savedItem.parentActionId ? { ...a, showAltCorner: formShowAltCorner } : a
        );
      }

      // Sync ResourceTracker for Resource Bar entries
      let updatedTrackers = [...(prev.resourceTrackers || [])];
      if (editorFormat === 'resource') {
        const linkedId = savedItem.linkedResourceId || `res-${actionId}`;
        const tIdx = updatedTrackers.findIndex(
          (r) => r.id === linkedId || r.id === actionId || r.macroKey === cleanMacroKey
        );
        const trackerObj: ResourceTracker = {
          id: tIdx >= 0 ? updatedTrackers[tIdx].id : linkedId,
          name: savedItem.name,
          current: savedItem.resourceCurrent ?? 0,
          max: savedItem.resourceMax ?? 1,
          macroKey: cleanMacroKey,
          category: 'Class Resource',
          notes: savedItem.description,
        };
        if (tIdx >= 0) {
          updatedTrackers[tIdx] = trackerObj;
        } else {
          updatedTrackers.push(trackerObj);
        }
      }

      // Auto-assign to active custom tab if currently viewing one on creation
      let updatedTabs = prev.actionDirectoryTabs;
      if (!editingEntryId && activeTab && updatedTabs) {
        updatedTabs = updatedTabs.map((t) =>
          t.id === activeTab.id && !t.entryIds.includes(actionId)
            ? { ...t, entryIds: [...t.entryIds, actionId] }
            : t
        );
      }

      return {
        ...prev,
        characterActions: existingActions,
        resourceTrackers: updatedTrackers,
        ...(updatedTabs ? { actionDirectoryTabs: updatedTabs } : {}),
      };
    });

    setEditorFormat(null);
    setEditingEntryId(null);
  };

  const handleDeleteEntry = (entry: CharacterActionItem) => {
    onUpdateCharacter((prev) => {
      // Deleting an original also removes orphaned alts attached to it
      const updatedActions = (prev.characterActions || []).filter(
        (a) => a.id !== entry.id && a.parentActionId !== entry.id
      );
      const updatedTrackers = (prev.resourceTrackers || []).filter(
        (r) =>
          r.id !== entry.id &&
          r.id !== entry.linkedResourceId &&
          !(
            entry.macroKey &&
            r.macroKey &&
            r.macroKey.toUpperCase() === entry.macroKey.toUpperCase()
          )
      );
      const updatedTabs = (prev.actionDirectoryTabs || []).map((t) => ({
        ...t,
        entryIds: t.entryIds.filter((id) => id !== entry.id),
      }));

      return {
        ...prev,
        characterActions: updatedActions,
        resourceTrackers: updatedTrackers,
        actionDirectoryTabs: updatedTabs,
      };
    });
  };

  const updateResourceValues = (
    entry: CharacterActionItem,
    nextCurrent: number,
    nextMax?: number,
    nextStepCount?: number
  ) => {
    const maxVal = nextMax !== undefined ? Math.max(1, nextMax) : Math.max(1, entry.resourceMax || 1);
    const clampedCurrent = Math.max(0, Math.min(maxVal, nextCurrent));

    onUpdateCharacter((prev) => {
      const prevActions = [...(prev.characterActions || [])];
      const prevTrackers = [...(prev.resourceTrackers || [])];
      const actionExists = prevActions.some((a) => a.id === entry.id);

      const nextActionFields: Partial<CharacterActionItem> = {
        entryType: 'resource',
        hasResourcePool: true,
        resourceCurrent: clampedCurrent,
        resourceMax: maxVal,
        usesPerDay: `${clampedCurrent}/${maxVal} remaining`,
        ...(nextStepCount !== undefined ? { stepperStepCount: nextStepCount } : {}),
      };

      const updatedActions = actionExists
        ? prevActions.map((a) => (a.id === entry.id ? { ...a, ...nextActionFields } : a))
        : [...prevActions, { ...entry, ...nextActionFields }];

      const trackerIdx = prevTrackers.findIndex(
        (r) =>
          r.id === entry.linkedResourceId ||
          r.id === entry.id ||
          (entry.macroKey && r.macroKey && r.macroKey.toUpperCase() === entry.macroKey.toUpperCase())
      );

      const updatedTrackers =
        trackerIdx >= 0
          ? prevTrackers.map((r, i) =>
              i === trackerIdx ? { ...r, current: clampedCurrent, max: maxVal } : r
            )
          : [
              ...prevTrackers,
              {
                id: entry.linkedResourceId || `res-${entry.id}`,
                name: entry.name,
                current: clampedCurrent,
                max: maxVal,
                macroKey: entry.macroKey || entry.name.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
                category: 'Class Resource' as const,
                notes: entry.description,
              },
            ];

      return {
        ...prev,
        characterActions: updatedActions,
        resourceTrackers: updatedTrackers,
      };
    });
  };

  const handleRunResourceStepper = (entry: CharacterActionItem) => {
    const stepOutcome = stepResourceBarValue(entry, character, derived);
    updateResourceValues(
      entry,
      stepOutcome.nextCurrent,
      stepOutcome.nextMax,
      stepOutcome.nextStepCount
    );
    setDirectoryNotice(stepOutcome.feedback);
  };

  const handleResetAllPools = () => {
    onUpdateCharacter((prev) => ({
      ...prev,
      characterActions: (prev.characterActions || []).map((a) => {
        if (resolveActionEntryType(a) !== 'resource') return a;
        const maxVal = a.resourceMax ?? 1;
        return {
          ...a,
          resourceCurrent: maxVal,
          stepperStepCount: 0,
          usesPerDay: `${maxVal}/${maxVal} remaining`,
        };
      }),
      resourceTrackers: (prev.resourceTrackers || []).map((r) => ({ ...r, current: r.max })),
    }));
    setDirectoryNotice('Reset all resource bars to full.');
  };

  const handleToggleSpellAvailable = (entry: CharacterActionItem) => {
    const nextVal = !entry.isAvailable;
    onUpdateCharacter((prev) => ({
      ...prev,
      characterActions: (prev.characterActions || []).map((a) =>
        a.id === entry.id ? { ...a, isAvailable: nextVal } : a
      ),
    }));
  };

  const handleToggleShowAltCorner = (entry: CharacterActionItem) => {
    const nextVal = !entry.showAltCorner;
    onUpdateCharacter((prev) => ({
      ...prev,
      characterActions: (prev.characterActions || []).map((a) =>
        a.id === entry.id ? { ...a, showAltCorner: nextVal } : a
      ),
    }));
  };

  // Custom tabs (C1: Make tab + Add to list)
  const handleCreateCustomTab = () => {
    const clean = newTabName.trim();
    if (!clean) return;
    const newTab: ActionDirectoryTab = {
      id: `tab-${Date.now()}`,
      name: clean,
      entryIds: [],
    };
    onUpdateCharacter((prev) => ({
      ...prev,
      actionDirectoryTabs: [...(prev.actionDirectoryTabs || []), newTab],
    }));
    setActiveTabId(newTab.id);
    setNewTabName('');
    setIsMakeTabOpen(false);
    setDirectoryNotice(`Created directory tab "${clean}". Use "Add to list" to store items here.`);
  };

  const handleDeleteCustomTab = (tabId: string) => {
    onUpdateCharacter((prev) => ({
      ...prev,
      actionDirectoryTabs: (prev.actionDirectoryTabs || []).filter((t) => t.id !== tabId),
    }));
    if (activeTabId === tabId) setActiveTabId('all');
  };

  const handleToggleEntryInTab = (entryId: string, tabId: string) => {
    onUpdateCharacter((prev) => ({
      ...prev,
      actionDirectoryTabs: (prev.actionDirectoryTabs || []).map((t) => {
        if (t.id !== tabId) return t;
        const exists = t.entryIds.includes(entryId);
        return {
          ...t,
          entryIds: exists ? t.entryIds.filter((id) => id !== entryId) : [...t.entryIds, entryId],
        };
      }),
    }));
  };

  const handleAddMacroToList = (macro: SearchableMacroResult) => {
    const existing = normalizedEntries.find(
      (e) =>
        e.name.toLowerCase() === macro.name.toLowerCase() ||
        (e.macroKey && e.macroKey.toUpperCase() === macro.key.toUpperCase())
    );

    if (existing) {
      if (activeTab) {
        handleToggleEntryInTab(existing.id, activeTab.id);
        setDirectoryNotice(`Added "${existing.name}" to tab "${activeTab.name}".`);
      } else {
        setDirectoryNotice(`"${existing.name}" is already in your action list.`);
      }
      return;
    }

    const newItem = buildActionFromMacroResult(macro);
    onUpdateCharacter((prev) => {
      const updatedTabs = activeTab
        ? (prev.actionDirectoryTabs || []).map((t) =>
            t.id === activeTab.id ? { ...t, entryIds: [...t.entryIds, newItem.id] } : t
          )
        : prev.actionDirectoryTabs;

      const updatedTrackers =
        newItem.entryType === 'resource'
          ? [
              ...(prev.resourceTrackers || []),
              {
                id: `res-${newItem.id}`,
                name: newItem.name,
                current: newItem.resourceCurrent ?? 10,
                max: newItem.resourceMax ?? 10,
                macroKey: newItem.macroKey,
                category: 'Resource Pool' as const,
                notes: newItem.description,
              },
            ]
          : prev.resourceTrackers;

      return {
        ...prev,
        characterActions: [...(prev.characterActions || []), newItem],
        ...(updatedTrackers ? { resourceTrackers: updatedTrackers } : {}),
        ...(updatedTabs ? { actionDirectoryTabs: updatedTabs } : {}),
      };
    });

    setDirectoryNotice(
      activeTab
        ? `Added "${newItem.name}" to list and tab "${activeTab.name}".`
        : `Added "${newItem.name}" to your action list.`
    );
  };

  const cycleAltForCard = (originalId: string, alts: CharacterActionItem[]) => {
    if (alts.length === 0) return;
    const sequence: Array<string | null> = [null, ...alts.map((a) => a.id)];
    const currentSel = activeAltSelection[originalId] || null;
    const idx = sequence.indexOf(currentSel);
    const nextSel = sequence[(idx + 1) % sequence.length];
    setActiveAltSelection((prev) => ({ ...prev, [originalId]: nextSel }));
  };

  const hasAnyEntries = normalizedEntries.length > 0;
  const hasCustomTabs = customTabs.length > 0;

  return (
    <div className={`rounded-xl border p-4 ${cardBg} space-y-3.5`}>
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-amber-500 shrink-0" />
          <h3 className="font-serif font-bold text-base tracking-wide">
            Actions &amp; Resources
          </h3>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {resourceEntryCount > 0 && (
            <button
              type="button"
              onClick={handleResetAllPools}
              className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 flex items-center gap-1 transition-colors"
              title="Rest / Refresh all resource bars to maximum"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Pools</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMakeTabOpen((v) => !v)}
            className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 border border-black/15 dark:border-white/15 flex items-center gap-1 transition-colors"
            title="Create a custom tab/list to organize actions and searched macros"
          >
            <FolderPlus className="w-3.5 h-3.5 text-cyan-500" />
            <span>Make tab</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFormatPickerOpen(true)}
            className="px-3 py-1 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 flex items-center gap-1 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Action</span>
          </button>
        </div>
      </div>

      {/* Inline Make Tab creator */}
      {isMakeTabOpen && (
        <div className="p-2.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 flex items-center gap-2">
          <input
            type="text"
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateCustomTab();
              if (e.key === 'Escape') setIsMakeTabOpen(false);
            }}
            placeholder="New tab name (e.g. Combat, Boss Buffs, Daily Spells)..."
            className={`flex-1 px-2.5 py-1 text-xs rounded border font-mono ${inputStyle}`}
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreateCustomTab}
            disabled={!newTabName.trim()}
            className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-950 font-mono font-bold text-xs"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setIsMakeTabOpen(false)}
            className="p-1 opacity-70 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* User-Created Custom Tabs (only shown when user creates tabs via Make tab) */}
      {hasCustomTabs && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTabId('all')}
            className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors ${
              activeTabId === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'bg-black/10 dark:bg-white/10 hover:bg-black/20 opacity-85'
            }`}
          >
            All ({normalizedEntries.filter((e) => resolveActionEntryType(e) !== 'alt').length})
          </button>
          {customTabs.map((tab) => (
            <div
              key={tab.id}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] whitespace-nowrap transition-colors ${
                activeTabId === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-black/10 dark:bg-white/10 hover:bg-black/20 opacity-85'
              }`}
            >
              <button type="button" onClick={() => setActiveTabId(tab.id)}>
                {tab.name} ({tab.entryIds.length})
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCustomTab(tab.id)}
                className="opacity-60 hover:opacity-100 ml-0.5"
                title={`Remove tab "${tab.name}"`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Directory Search (always accessible for actions, alts, and macros) */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search actions, resources, spells, alts, or macros (#MACRO_KEY)..."
          className={`w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border font-mono ${inputStyle}`}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-55 hover:opacity-100"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Transient feedback notice */}
      {directoryNotice && (
        <div className="px-2.5 py-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 text-xs font-mono flex items-center justify-between gap-2">
          <span>{directoryNotice}</span>
          <button
            type="button"
            onClick={() => setDirectoryNotice(null)}
            className="opacity-65 hover:opacity-100"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Clean Slate Empty State vs Cards List */}
      {!hasAnyEntries && !searchQuery.trim() && !activeTab ? (
        <div className="py-10 px-4 text-center rounded-xl border border-dashed border-black/15 dark:border-white/15 space-y-2.5">
          <Sparkles className="w-7 h-7 mx-auto text-amber-500/70" />
          <p className="text-xs font-mono opacity-75">
            No actions or resources yet. Click <strong>Add Action</strong> to choose a Resource Bar,
            Ability, Spell, Alt, or Counter.
          </p>
        </div>
      ) : (
        <div className="pf1-blue-scrollbar space-y-2 max-h-[540px] overflow-y-auto pr-1">
          {visibleEntries.map((baseEntry) => {
            const baseType = resolveActionEntryType(baseEntry);
            const alts = baseType !== 'alt' ? getAltsForEntry(normalizedEntries, baseEntry.id) : [];
            const selectedAltId = activeAltSelection[baseEntry.id] || null;
            const activeAlt = selectedAltId
              ? alts.find((a) => a.id === selectedAltId) || null
              : null;

            // Display either the currently cycled/jumped Alt or the base entry
            const displayed = activeAlt || baseEntry;
            const displayType =
              activeAlt && activeAlt.altTargetType
                ? activeAlt.altTargetType
                : resolveActionEntryType(displayed);
            const isExpanded = Boolean(expandedIds[baseEntry.id]);
            const callKey = displayed.macroKey
              ? `#${displayed.macroKey}`
              : `#${displayed.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

            // Evaluated DC if present
            const dcEval = displayed.saveDC
              ? evaluateDirectoryMacroValue(displayed.saveDC, character, derived)
              : null;

            // Evaluated Counter total if Counter
            const counterEval =
              displayType === 'counter'
                ? evaluateDirectoryMacroValue(displayed.totalCountMacro, character, derived)
                : null;

            // Resource Bar metrics
            const resColor = resolveResourceColor(displayed.color);
            const evaluatedMaxObj =
              displayType === 'resource' && displayed.macroFormula
                ? evaluateDirectoryMacroValue(displayed.macroFormula, character, derived)
                : null;
            const resMax = Math.max(
              1,
              evaluatedMaxObj && evaluatedMaxObj.numeric !== null && evaluatedMaxObj.numeric >= 1
                ? Math.round(evaluatedMaxObj.numeric)
                : displayed.resourceMax ?? 1
            );
            const resCur = Math.max(0, Math.min(resMax, displayed.resourceCurrent ?? resMax));
            const resPct = Math.min(100, Math.round((resCur / resMax) * 100));

            const showDogEar =
              baseType !== 'alt' && Boolean(baseEntry.showAltCorner) && alts.length > 0;
            const parentForSearchAlt =
              baseType === 'alt' && baseEntry.parentActionId
                ? entryById.get(baseEntry.parentActionId)
                : undefined;

            return (
              <div
                key={baseEntry.id}
                className={`relative p-3 rounded-lg border transition-all space-y-2 ${itemCardBg}`}
              >
                {/* B5 Dog-Ear Corner Control & Hover Menu */}
                {showDogEar && (
                  <div
                    className="absolute top-0 right-0 z-10"
                    onMouseEnter={() => setHoveredDogEarId(baseEntry.id)}
                    onMouseLeave={() => setHoveredDogEarId(null)}
                  >
                    <button
                      type="button"
                      onClick={() => cycleAltForCard(baseEntry.id, alts)}
                      className="w-6 h-6 overflow-hidden rounded-tr-lg focus:outline-none group"
                      title={`Dog-ear Alt Switcher (${alts.length} alt${alts.length > 1 ? 's' : ''}) — Click to cycle or hover to pick`}
                    >
                      <span
                        className={`block w-full h-full transition-colors ${
                          activeAlt
                            ? 'bg-gradient-to-bl from-cyan-400 via-cyan-500 to-transparent'
                            : 'bg-gradient-to-bl from-amber-400 via-amber-500/80 to-transparent group-hover:from-cyan-400'
                        }`}
                        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
                      />
                    </button>

                    {hoveredDogEarId === baseEntry.id && (
                      <div className="absolute right-0 top-6 w-52 rounded-lg border border-cyan-500/50 bg-slate-950 text-slate-100 shadow-xl p-1.5 z-30 font-mono text-[11px] space-y-1">
                        <div className="px-2 py-0.5 text-[9px] uppercase tracking-wider text-cyan-400 font-bold border-b border-slate-800">
                          Jump to Variation
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAltSelection((prev) => ({ ...prev, [baseEntry.id]: null }));
                            setHoveredDogEarId(null);
                          }}
                          className={`w-full text-left px-2 py-1 rounded flex items-center justify-between ${
                            !activeAlt
                              ? 'bg-amber-500/20 text-amber-300 font-bold'
                              : 'hover:bg-slate-800 text-slate-200'
                          }`}
                        >
                          <span className="truncate">{baseEntry.name} (Original)</span>
                          {!activeAlt && <Check className="w-3 h-3 shrink-0" />}
                        </button>
                        {alts.map((altItem) => (
                          <button
                            key={altItem.id}
                            type="button"
                            onClick={() => {
                              setActiveAltSelection((prev) => ({
                                ...prev,
                                [baseEntry.id]: altItem.id,
                              }));
                              setHoveredDogEarId(null);
                            }}
                            className={`w-full text-left px-2 py-1 rounded flex items-center justify-between ${
                              activeAlt?.id === altItem.id
                                ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                                : 'hover:bg-slate-800 text-slate-200'
                            }`}
                          >
                            <span className="truncate">{altItem.name}</span>
                            {activeAlt?.id === altItem.id && <Check className="w-3 h-3 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-start justify-between gap-2.5">
                  {/* Far-left Edit & Delete controls + Main content */}
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => openEditEntry(displayed)}
                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                        title={`Edit ${displayed.name}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(displayed)}
                        className="p-1 rounded hover:bg-rose-500/20 text-rose-500 opacity-70 hover:opacity-100"
                        title={`Delete ${displayed.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {displayType !== 'resource' && (
                      <div className="p-1.5 rounded-md bg-black/15 dark:bg-white/10 shrink-0 mt-0.5">
                        {renderIcon(displayed.icon)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap pr-4">
                        <span className="font-bold text-xs text-amber-800 dark:text-amber-200">
                          {displayed.name}
                        </span>

                        {baseType === 'alt' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                            <GitBranch className="w-2.5 h-2.5" />
                            <span>Alt{parentForSearchAlt ? ` of ${parentForSearchAlt.name}` : ''}</span>
                          </span>
                        )}

                        {activeAlt && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                            Alt View
                          </span>
                        )}

                        {displayType === 'ability' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
                            {displayed.abilityType || 'Class Feature'}
                          </span>
                        )}

                        {displayType === 'spell' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                            Lvl {displayed.spellLevel ?? 1}
                          </span>
                        )}

                        {(displayType === 'ability' || displayType === 'spell') &&
                          displayed.actionType && (
                            <span className="text-[10px] font-mono opacity-75 px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                              {displayed.actionType}
                            </span>
                          )}

                        {dcEval && dcEval.display && (
                          <span
                            className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                            title={`DC Macro: ${displayed.saveDC}`}
                          >
                            DC {dcEval.display}
                          </span>
                        )}

                        {displayed.sourceClassName && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                            {displayed.sourceClassName}
                          </span>
                        )}

                        {displayed.macroKey && (
                          <FieldCallTooltip
                            callName={callKey}
                            description={`${displayed.name} Macro Key`}
                          >
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 cursor-help">
                              {callKey}
                            </span>
                          </FieldCallTooltip>
                        )}
                      </div>

                      {/* B1 Resource Bar Display */}
                      {displayType === 'resource' && (
                        <div className="pt-0.5 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-4 rounded-full bg-black/25 dark:bg-black/50 border border-black/15 dark:border-white/10 overflow-hidden relative">
                              <div
                                className={`h-full transition-all duration-300 ${resColor.barClass}`}
                                style={{
                                  width: `${resPct}%`,
                                  ...(resColor.barClass ? {} : { backgroundColor: resColor.hex }),
                                }}
                              />
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white drop-shadow">
                                {resCur} / {resMax}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side Type-Specific Controls + Dropdown */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* B3 Spell Availability Checkbox */}
                    {displayType === 'spell' && baseType !== 'alt' && (
                      <label
                        className="flex items-center gap-1 px-2 py-1 rounded border border-purple-500/30 bg-purple-500/10 text-[10px] font-mono cursor-pointer"
                        title="Available spells populate a link list in your Session Journal"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(baseEntry.isAvailable)}
                          onChange={() => handleToggleSpellAvailable(baseEntry)}
                          className="rounded accent-purple-500 w-3 h-3"
                        />
                        <span>Avail</span>
                      </label>
                    )}

                    {/* B1 Resource Bar Stepper Button */}
                    {displayType === 'resource' && (
                      <button
                        type="button"
                        onClick={() => handleRunResourceStepper(displayed)}
                        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-mono font-bold text-xs flex items-center gap-1 shadow-xs transition-transform active:scale-95"
                        title={`Run Stepper (${displayed.stepperMacro || '-1'})`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Step</span>
                      </button>
                    )}

                    {/* B4 Counter Evaluated Total */}
                    {displayType === 'counter' && (
                      <span
                        className="px-2.5 py-1 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 font-mono font-black text-xs tabular-nums"
                        title={`Macro: ${displayed.totalCountMacro || '0'}`}
                      >
                        {counterEval?.display || '0'}
                      </span>
                    )}

                    {/* B2/B3 Dice Box Roll Button */}
                    {(displayType === 'ability' || displayType === 'spell') &&
                      displayed.macroFormula && (
                        <button
                          type="button"
                          onClick={() => onRollFormula(displayed.macroFormula!, displayed.name)}
                          className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold font-mono text-xs flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                          title={`Roll: ${displayed.macroFormula}`}
                        >
                          <Dices className="w-3.5 h-3.5" />
                        </button>
                      )}

                    {/* Custom Tab Assign Button when user-made tabs exist */}
                    {hasCustomTabs && baseType !== 'alt' && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setTabAssignPickerId((cur) =>
                              cur === baseEntry.id ? null : baseEntry.id
                            )
                          }
                          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                          title="Add to custom tab"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                        {tabAssignPickerId === baseEntry.id && (
                          <div className="absolute right-0 top-7 w-44 rounded-lg border border-cyan-500/50 bg-slate-950 text-slate-100 shadow-xl p-1.5 z-30 font-mono text-[11px] space-y-1">
                            <div className="px-1.5 py-0.5 text-[9px] uppercase text-cyan-400 font-bold border-b border-slate-800">
                              Assign to Tab
                            </div>
                            {customTabs.map((tab) => {
                              const checked = tab.entryIds.includes(baseEntry.id);
                              return (
                                <label
                                  key={tab.id}
                                  className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-slate-800 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleToggleEntryInTab(baseEntry.id, tab.id)}
                                    className="rounded accent-cyan-500 w-3 h-3"
                                  />
                                  <span className="truncate">{tab.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expand/Collapse Description Dropdown Toggle */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIds((prev) => ({
                          ...prev,
                          [baseEntry.id]: !prev[baseEntry.id],
                        }))
                      }
                      className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-75 hover:opacity-100"
                      title={isExpanded ? 'Hide description' : 'Show description'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expandable Description Dropdown */}
                {isExpanded && (
                  <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-2 text-xs">
                    <div className="p-2.5 rounded bg-black/5 dark:bg-black/35 font-sans leading-relaxed whitespace-pre-wrap">
                      {displayed.description || 'No description provided.'}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono opacity-80">
                      <div className="flex flex-wrap items-center gap-2">
                        {displayed.macroFormula && (
                          <span>
                            {displayType === 'resource' ? 'Full Macro' : 'Roll Macro'}:{' '}
                            <strong>{displayed.macroFormula}</strong>
                          </span>
                        )}
                        {displayType === 'resource' && displayed.stepperMacro && (
                          <span>• Stepper: {displayed.stepperMacro}</span>
                        )}
                        {displayType === 'counter' && displayed.totalCountMacro && (
                          <span>Total Macro: {displayed.totalCountMacro}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {displayType === 'resource' && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateResourceValues(displayed, resCur + 1, resMax)}
                              className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-300 font-bold"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => updateResourceValues(displayed, resMax, resMax, 0)}
                              className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-600 dark:text-cyan-300 font-bold"
                            >
                              Reset
                            </button>
                          </>
                        )}

                        {baseType !== 'alt' && isAltEligibleEntry(baseEntry) && alts.length > 0 && (
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(baseEntry.showAltCorner)}
                              onChange={() => handleToggleShowAltCorner(baseEntry)}
                              className="rounded accent-amber-500 w-3 h-3"
                            />
                            <span>Dog-ear Alts ({alts.length})</span>
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {visibleEntries.length === 0 && (searchQuery.trim() || activeTab) && (
            <div className="py-5 text-center text-xs font-mono opacity-60">
              No saved entries match{searchQuery.trim() ? ` "${searchQuery}"` : ' this tab'}.
            </div>
          )}

          {/* C1 Searchable Macro Directory Results */}
          {searchQuery.trim() && macroMatches.length > 0 && (
            <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-cyan-600 dark:text-cyan-400">
                Macro Directory Matches ({macroMatches.length})
              </div>
              {macroMatches.map((m) => (
                <div
                  key={m.id}
                  className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${itemCardBg}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-cyan-700 dark:text-cyan-300">
                        {m.name}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                        {m.source}
                      </span>
                      <span className="text-[10px] font-mono opacity-75 truncate">{m.formula}</span>
                    </div>
                    <p className="text-[11px] opacity-70 truncate">{m.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddMacroToList(m)}
                    className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono font-bold text-[11px] shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add to list</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* A2: FORMAT PICKER MODAL                                               */}
      {/* ===================================================================== */}
      {isFormatPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-2.5 border-black/10 dark:border-white/10">
              <h3 className="font-serif font-bold text-base text-amber-500">
                Choose Action Format
              </h3>
              <button
                type="button"
                onClick={() => setIsFormatPickerOpen(false)}
                className="p-1 opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => openCreateFormat('resource')}
                className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${itemCardBg}`}
              >
                <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs">1. Resource Bar</div>
                  <div className="text-[11px] opacity-75">
                    Colored bar showing current/max uses with a stepper macro button.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openCreateFormat('ability')}
                className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${itemCardBg}`}
              >
                <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs">2. Ability</div>
                  <div className="text-[11px] opacity-75">
                    Racial, class feature, or custom-tagged ability with DC &amp; roll macros.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openCreateFormat('spell')}
                className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${itemCardBg}`}
              >
                <BookOpen className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs">3. Spell</div>
                  <div className="text-[11px] opacity-75">
                    Spell entry with level, DC/roll macros, and Journal availability toggle.
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={altEligibleOriginals.length === 0}
                onClick={() => openCreateFormat('alt')}
                className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 disabled:opacity-45 ${itemCardBg}`}
              >
                <GitBranch className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs">4. Alt</div>
                  <div className="text-[11px] opacity-75">
                    {altEligibleOriginals.length === 0
                      ? 'Create an Ability or Spell first to attach an Alternate.'
                      : 'Save a searchable alternate version linked to an Ability or Spell.'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openCreateFormat('counter')}
                className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${itemCardBg}`}
              >
                <Hash className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs">5. Counter</div>
                  <div className="text-[11px] opacity-75">
                    Simple counter displaying its icon, name, and evaluated total-count macro.
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* B1–B5: FORMAT-SPECIFIC CREATE / EDIT MODAL                            */}
      {/* ===================================================================== */}
      {editorFormat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-4 shadow-2xl ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
              <h3 className="font-serif font-bold text-base text-amber-500">
                {editingEntryId ? 'Edit' : 'New'}{' '}
                {editorFormat === 'resource'
                  ? 'Resource Bar'
                  : editorFormat === 'ability'
                  ? 'Ability'
                  : editorFormat === 'spell'
                  ? 'Spell'
                  : editorFormat === 'counter'
                  ? 'Counter'
                  : 'Alt Variation'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditorFormat(null);
                  setEditingEntryId(null);
                }}
                className="p-1 opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-[72vh] overflow-y-auto pr-1">
              {/* B5 Alt Parent Selector */}
              {editorFormat === 'alt' && (
                <div>
                  <label className="block font-bold opacity-80 mb-1">
                    Original Ability or Spell
                  </label>
                  <select
                    value={formParentActionId}
                    onChange={(e) => {
                      const orig = entryById.get(e.target.value);
                      if (orig) prefillAltFromOriginal(orig);
                    }}
                    className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                  >
                    {altEligibleOriginals.map((orig) => (
                      <option key={orig.id} value={orig.id}>
                        {orig.name} ({resolveActionEntryType(orig) === 'spell' ? 'Spell' : 'Ability'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Name + Apple Eye Quick-Fill + Macro Key */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={editorFormat === 'counter' ? 'sm:col-span-3' : 'sm:col-span-2'}>
                  <label className="block font-bold opacity-85 mb-1">
                    Name <span className="text-[10px] font-mono opacity-60">(Apple-Eye Quick Fill)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSeekWithAppleEye();
                        }
                      }}
                      placeholder="Enter name, then click Seek..."
                      className={`flex-1 px-3 py-1.5 rounded border ${inputStyle}`}
                    />
                    <button
                      type="button"
                      onClick={handleSeekWithAppleEye}
                      disabled={isSeekingAI}
                      className="px-2.5 py-1.5 rounded-lg bg-gradient-to-b from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 disabled:opacity-50 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm border border-rose-400/50 shrink-0"
                      title="AI Seek (Eye in an Apple): Searches SOT Docs -> SOT Links -> Online SRD"
                    >
                      <AppleEyeIcon className="w-4 h-4" isSeeking={isSeekingAI} />
                      <span>{isSeekingAI ? 'Seeking...' : 'Seek'}</span>
                    </button>
                  </div>
                </div>

                {editorFormat !== 'counter' && (
                  <div>
                    <label className="block font-bold opacity-75 mb-1">Macro-Call Key</label>
                    <input
                      type="text"
                      value={formMacroKey}
                      onChange={(e) => setFormMacroKey(e.target.value)}
                      placeholder="e.g. SMITE"
                      className={`w-full px-3 py-1.5 rounded border font-mono uppercase ${inputStyle}`}
                    />
                  </div>
                )}
              </div>

              {lookupFeedback && (
                <div
                  className={`p-2 rounded-lg border text-[11px] font-mono flex items-start justify-between gap-2 ${
                    lookupFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                      : lookupFeedback.type === 'error'
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <span>{lookupFeedback.message}</span>
                  <button
                    type="button"
                    onClick={() => setLookupFeedback(null)}
                    className="opacity-65 hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* B1: Resource Bar Fields */}
              {editorFormat === 'resource' && (
                <>
                  <div>
                    <label className="flex items-center gap-1.5 font-bold opacity-75 mb-1.5">
                      <Palette className="w-3.5 h-3.5" />
                      <span>Bar Color</span>
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {RESOURCE_BAR_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setFormColor(c.id)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${
                            formColor === c.id ? 'border-white scale-110 shadow' : 'border-transparent opacity-80'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                        />
                      ))}
                      <input
                        type="color"
                        value={resolveResourceColor(formColor).hex}
                        onChange={(e) => setFormColor(e.target.value)}
                        className="w-7 h-6 rounded border border-black/20 cursor-pointer bg-transparent"
                        title="Custom bar color"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold opacity-75 mb-1">Full Macro (Max)</label>
                      <input
                        type="text"
                        value={formRollMacro}
                        onChange={(e) => setFormRollMacro(e.target.value)}
                        placeholder="e.g. 4 + #CHA or 5"
                        className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold opacity-75 mb-1">Stepper Macro</label>
                      <input
                        type="text"
                        value={formStepperMacro}
                        onChange={(e) => setFormStepperMacro(e.target.value)}
                        placeholder="e.g. -1 or <<[6+!*1]"
                        className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold opacity-75 mb-1">Current Value</label>
                      <input
                        type="number"
                        min="0"
                        value={formResourceCurrent}
                        onChange={(e) => setFormResourceCurrent(e.target.value)}
                        className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold opacity-75 mb-1">Fallback Max</label>
                      <input
                        type="number"
                        min="1"
                        value={formResourceMax}
                        onChange={(e) => setFormResourceMax(e.target.value)}
                        className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* B2 / B3 / B5 Ability & Spell Fields */}
              {(editorFormat === 'ability' || editorFormat === 'spell' || editorFormat === 'alt') && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold opacity-75 mb-1">Icon</label>
                      <select
                        value={formIcon}
                        onChange={(e) => setFormIcon(e.target.value)}
                        className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                      >
                        {ICON_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold opacity-75 mb-1">Action Cost</label>
                      <select
                        value={formActionCost}
                        onChange={(e) =>
                          setFormActionCost(
                            e.target.value as NonNullable<CharacterActionItem['actionType']>
                          )
                        }
                        className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                      >
                        {ACTION_COST_OPTIONS.map((cost) => (
                          <option key={cost} value={cost}>
                            {cost}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Ability Type + Add Type */}
                  {(editorFormat === 'ability' ||
                    (editorFormat === 'alt' &&
                      (!formParentActionId ||
                        resolveActionEntryType(entryById.get(formParentActionId) || {}) !==
                          'spell'))) && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold opacity-75">Type</label>
                        <button
                          type="button"
                          onClick={() => setIsAddingCustomType((v) => !v)}
                          className="text-[11px] font-mono font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add type</span>
                        </button>
                      </div>
                      <select
                        value={formAbilityType}
                        onChange={(e) => setFormAbilityType(e.target.value)}
                        className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                      >
                        {allAbilityTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      {isAddingCustomType && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={newCustomTypeInput}
                            onChange={(e) => setNewCustomTypeInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomAbilityType();
                              }
                            }}
                            placeholder="New custom tag (e.g. Mythic, Ki Power)..."
                            className={`flex-1 px-2.5 py-1 rounded border font-mono ${inputStyle}`}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomAbilityType}
                            className="px-2.5 py-1 rounded bg-cyan-600 text-slate-950 font-mono font-bold"
                          >
                            Save Tag
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Spell Level + Available Checkbox */}
                  {(editorFormat === 'spell' ||
                    (editorFormat === 'alt' &&
                      formParentActionId &&
                      resolveActionEntryType(entryById.get(formParentActionId) || {}) ===
                        'spell')) && (
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div>
                        <label className="block font-bold opacity-75 mb-1">Spell Level</label>
                        <input
                          type="number"
                          min="0"
                          max="9"
                          value={formSpellLevel}
                          onChange={(e) => setFormSpellLevel(e.target.value)}
                          className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                        />
                      </div>
                      <label className="flex items-center gap-2 px-3 py-1.5 rounded border border-purple-500/30 bg-purple-500/10 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formSpellAvailable}
                          onChange={(e) => setFormSpellAvailable(e.target.checked)}
                          className="rounded accent-purple-500 w-4 h-4"
                        />
                        <span className="font-bold text-purple-600 dark:text-purple-300">
                          Available (Journal Link)
                        </span>
                      </label>
                    </div>
                  )}

                  {/* DC Macro & Roll Macro */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold opacity-75 mb-1">DC Macro (Optional)</label>
                      <input
                        type="text"
                        value={formSaveDC}
                        onChange={(e) => setFormSaveDC(e.target.value)}
                        placeholder="e.g. DC+#CHA or 17"
                        className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold opacity-75 mb-1">Roll Macro (Optional)</label>
                      <input
                        type="text"
                        value={formRollMacro}
                        onChange={(e) => setFormRollMacro(e.target.value)}
                        placeholder="e.g. [1d20+#BAB+#STR]"
                        className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* B4 Counter Fields */}
              {editorFormat === 'counter' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold opacity-75 mb-1">Icon</label>
                    <select
                      value={formIcon}
                      onChange={(e) => setFormIcon(e.target.value)}
                      className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                    >
                      {ICON_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold opacity-75 mb-1">Total Count Macro</label>
                    <input
                      type="text"
                      value={formTotalCountMacro}
                      onChange={(e) => setFormTotalCountMacro(e.target.value)}
                      placeholder="e.g. <<#LEVEL or 3+#INT"
                      className={`w-full px-3 py-1.5 rounded border font-mono ${inputStyle}`}
                    />
                  </div>
                </div>
              )}

              {/* B5 Dog-ear opt-in checkbox */}
              {(editorFormat === 'alt' ||
                (editingEntryId &&
                  (editorFormat === 'ability' || editorFormat === 'spell'))) && (
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formShowAltCorner}
                    onChange={(e) => setFormShowAltCorner(e.target.checked)}
                    className="rounded accent-amber-500 w-4 h-4"
                  />
                  <span>
                    Show dog-ear alt corner on original entry for quick switching
                  </span>
                </label>
              )}

              <div>
                <label className="block font-bold opacity-75 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Enter rules text, scaling notes, and macro notes..."
                  className={`w-full px-3 py-2 rounded border font-sans text-xs ${inputStyle}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  setEditorFormat(null);
                  setEditingEntryId(null);
                }}
                className="px-3 py-1.5 rounded text-xs opacity-70 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEntry}
                disabled={!formName.trim()}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 font-bold text-xs flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
