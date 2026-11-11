import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  Terminal,
  Play,
  Copy,
  Send,
  BookOpen,
  Edit3,
  Check,
  Sliders,
  Settings,
  X,
  AlertCircle,
  RefreshCw,
  Trash2,
  Cpu,
  Split,
  Clock,
  ArrowRight,
  FileText,
  Lock,
  Unlock,
  Globe,
  Link2,
  Plus,
  ExternalLink,
  Bold,
  Italic,
  Underline,
  List,
  Heading2,
  Award,
  Swords,
  Download,
  Upload,
  HardDrive,
  ShieldAlert,
} from 'lucide-react';
import {
  PF1Character,
  AIModuleSettings,
  SketchDetailQuality,
  CustomFormulaObject,
  CustomBuffEffect,
  StepperRule,
  ThemeMode,
  SOTCategory,
  SOTWeblinkItem,
  SOTRichTextPage,
  SOTCatalogueData,
  SOTIncidentalLink,
  FeatItem,
  CharacterActionItem,
} from '../../types/character';
import {
  generateMacroFromEnglish,
  GeneratedMacroResult,
  generateBuffFromEnglish,
  GeneratedBuffResult,
  parseNaturalLanguageSheetUpdates,
  SheetModificationAction,
  DEFAULT_AI_MODULE_SETTINGS,
  DEFAULT_SOT_CATALOGUE,
  lookupRulesWithSOT,
  RulesLookupResult,
} from '../../engine/aiService';
import {
  sanitizeSrdDocument,
  extractMacaroniSuggestionsFromSrd,
  saveSrdDocToHostDeviceStorage,
  loadAllHostDeviceSrdDocs,
  removeSrdDocFromHostDeviceStorage,
  exportSrdDocFileToHost,
  parseImportedSrdFile,
} from '../../engine/sotEngine';
import { evaluateFormula, buildFormulaContext } from '../../engine/formula';
import { AppleEyeIcon } from '../common/AppleEyeIcon';
import { useCharacter } from '../../context/CharacterContext';

export type AICompanionTab =
  | 'permissions'
  | 'lookup_sot'
  | 'journal_settings'
  | 'macro'
  | 'fields';
export type MacroDestination = 'copy' | 'dsl_studio' | 'buff_box' | 'stepper';

interface AICompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  character?: PF1Character;
  onUpdateCharacter?: (updater: (prev: PF1Character) => PF1Character) => void;
  onOpenJournal?: () => void;
  onOpenAddClass?: () => void;
  onOpenBuffBox?: () => void;
  onOpenStepper?: () => void;
  onNavigateToDSLPage?: () => void;
  onOpenCompleteSheet?: () => void;
  initialTab?: string;
  theme?: ThemeMode;
}

const MODULE_PERMISSION_DEFINITIONS: Array<{
  key: keyof NonNullable<AIModuleSettings['allowedModules']>;
  label: string;
  desc: string;
  group: 'Core AI Listeners' | 'Macro & Build Engines' | 'Specialized Sheet Toolkits';
}> = [
  {
    key: 'sotCatalogue',
    label: 'Lookups & SOT Catalogue',
    desc: 'Allows AI to read saved SOT Override Docs, follow SOT Weblinks, and perform SRD lookups',
    group: 'Core AI Listeners',
  },
  {
    key: 'journalVoice',
    label: 'Journal Entry Generator (Local in Journal)',
    desc: 'Displays in-character voice chronicle prompt inside the Session Journal modal',
    group: 'Core AI Listeners',
  },
  {
    key: 'journalSketch',
    label: 'Pencil Sketch Prompt (Local in Journal)',
    desc: 'Displays graphite field sketch generator inside the Session Journal modal',
    group: 'Core AI Listeners',
  },
  {
    key: 'scratchpad',
    label: 'Scratchpad Build Planner (>>#AI$)',
    desc: 'Allows Scratchpad Run button to execute >>#AI$, >>AI$, and >>#ai! build conversations',
    group: 'Core AI Listeners',
  },
  {
    key: 'addClass',
    label: 'Add Class & Archetype Studio',
    desc: 'Filters SRD skills/proficiencies chatter and adapts archetype descriptions into the 1–20 grid',
    group: 'Macro & Build Engines',
  },
  {
    key: 'buffBox',
    label: 'Buff Box (<^...> Matrix)',
    desc: 'Direct-send active status & bonus matrix buffs from Plain Text to Macro',
    group: 'Macro & Build Engines',
  },
  {
    key: 'dslStudio',
    label: 'DSL Studio (Page 4 Formula Objects)',
    desc: 'Direct-send #CALL custom formula objects from Plain Text to Macro',
    group: 'Macro & Build Engines',
  },
  {
    key: 'stepper',
    label: 'Stepper Tool (<< / >> Countdowns)',
    desc: 'Direct-send round & turn countdown rules from Plain Text to Macro',
    group: 'Macro & Build Engines',
  },
  {
    key: 'pointBuy',
    label: 'Point Buy & Ability Calculator',
    desc: 'Permits AI to inspect or suggest point-buy arrays and ability allocations',
    group: 'Specialized Sheet Toolkits',
  },
  {
    key: 'cmbTool',
    label: 'CMB / CMD Maneuver Calculator',
    desc: 'Permits AI to read and configure combat maneuver bonuses and conditional modifiers',
    group: 'Specialized Sheet Toolkits',
  },
  {
    key: 'loadoutTool',
    label: 'Armor & Gear Loadout Manager',
    desc: 'Permits AI to inspect or swap active combat equipment loadouts',
    group: 'Specialized Sheet Toolkits',
  },
  {
    key: 'deckTool',
    label: 'Deck & Harrow Card Tool',
    desc: 'Permits AI to interact with custom card draws and deck state',
    group: 'Specialized Sheet Toolkits',
  },
  {
    key: 'xdxTool',
    label: 'xDx Dice Roller & Pool Analyzer',
    desc: 'Permits AI to queue complex dice pools in the roller toolkit',
    group: 'Specialized Sheet Toolkits',
  },
  {
    key: 'imageBrowser',
    label: 'Portrait & Token Image Browser',
    desc: 'Permits AI to read portrait metadata and framing presets',
    group: 'Specialized Sheet Toolkits',
  },
];

const FIELD_PERMISSION_DEFINITIONS: Array<{
  key: keyof AIModuleSettings['allowedFields'];
  label: string;
  desc: string;
}> = [
  { key: 'coreIdentity', label: 'Core Identity, Level & XP', desc: 'Character name, level, classes, alignment, deity, XP' },
  { key: 'abilities', label: 'Ability Scores (STR–CHA)', desc: 'Base ability scores, racial/inherent/temp modifiers' },
  { key: 'hp', label: 'Hit Points, Vitals & Nonlethal', desc: 'Current HP, Max HP, Temp HP, nonlethal damage, healing' },
  { key: 'armorClass', label: 'Armor Class & Defenses', desc: 'Natural armor, deflection, dodge, DR, SR, resistances' },
  { key: 'saves', label: 'Saving Throws (Fort/Ref/Will)', desc: 'Base saves, magic/misc/conditional save modifiers' },
  { key: 'attacksAndWeapons', label: 'Weapons & Attack Matrix', desc: 'Melee/ranged weapon slots, attack bonuses, crit profiles' },
  { key: 'armorAndGear', label: 'Equipped Armor & Shield', desc: 'AC bonus, max Dex, armor check penalty, spell failure' },
  { key: 'actionsAndResources', label: 'Action & Class Resource Directory', desc: '+Add Action/Resource AI Seek, daily pools (#SMITE, #RAGE)' },
  { key: 'feats', label: 'Feats & Odd-Level Progression', desc: '+Add Feat AI Seek, odd-level feat slots, prerequisites' },
  { key: 'skills', label: '35 PF1e Skills Matrix', desc: 'Skill ranks, class skill toggles, misc skill modifiers' },
  { key: 'spellsAndMagic', label: 'Spells, Grimoire & Concentration', desc: 'Known/prepared spells, caster level, spell slots' },
  { key: 'conditions', label: 'Combat & Status Conditions', desc: 'Fatigued, shaken, sickened, prone, grappled toggles' },
  { key: 'inventory', label: 'Inventory, Stash & Containers', desc: 'Carried gear, weight, consumables, magic items' },
  { key: 'currency', label: 'Currency & Coinage (PP/GP/SP/CP)', desc: 'Adding or spending platinum, gold, silver, copper' },
  { key: 'companionsAndMount', label: 'Animal Companion, Mount & Familiar', desc: 'Companion stats, tricks, HP, and shared buffs' },
  { key: 'bioAndProfile', label: 'Biography, Traits & Backstory', desc: 'Personality, appearance, campaign traits, drawbacks' },
  { key: 'notes', label: 'Scratchpad & Session Notes', desc: 'Appending session clues, build plans, and memos' },
  { key: 'journal', label: 'Leatherbound Session Journal', desc: 'Creating in-character chronicle entries and recall checklists' },
  { key: 'customFormulas', label: 'Custom #CALL Formula Objects', desc: 'Creating or updating Page 4 Macaroni DSL objects' },
];

export const AICompanionModal: React.FC<AICompanionModalProps> = ({
  isOpen,
  onClose,
  character: propCharacter,
  onUpdateCharacter: propOnUpdateCharacter,
  onOpenJournal,
  onOpenAddClass,
  onOpenCompleteSheet,
  initialTab = 'permissions',
  theme: propTheme,
}) => {
  const ctx = useCharacter();
  const character = propCharacter ?? ctx.character;
  const onUpdateCharacter = propOnUpdateCharacter ?? ctx.updateCharacter;
  const theme = propTheme ?? ctx.layout.theme;
  const normalizeTab = (tab?: string): AICompanionTab => {
    if (tab === 'lookup' || tab === 'sot' || tab === 'lookup_sot') {
      return 'lookup_sot';
    }
    if (tab === 'journal' || tab === 'sketch' || tab === 'journal_settings') {
      return 'journal_settings';
    }
    if (tab === 'macro' || tab === 'buff_maker') {
      return 'permissions';
    }
    if (tab === 'fields') {
      return 'fields';
    }
    return 'permissions';
  };

  const [activeTab, setActiveTab] = useState<AICompanionTab>(() => normalizeTab(initialTab));

  useEffect(() => {
    if (isOpen) {
      setActiveTab(normalizeTab(initialTab));
    }
  }, [isOpen, initialTab]);

  // Merged Module Settings with defaults
  const rawSettings = character.installedModules?.aiSettings || DEFAULT_AI_MODULE_SETTINGS;
  const settings: AIModuleSettings = {
    ...DEFAULT_AI_MODULE_SETTINGS,
    ...rawSettings,
    allowedFields: {
      ...DEFAULT_AI_MODULE_SETTINGS.allowedFields,
      ...(rawSettings.allowedFields || {}),
    },
    allowedModules: {
      ...DEFAULT_AI_MODULE_SETTINGS.allowedModules!,
      ...(rawSettings.allowedModules || {}),
    },
  };

  const allowedModules = settings.allowedModules!;
  const allowedFields = settings.allowedFields;
  const sotCatalogue: SOTCatalogueData = character.sotCatalogue || DEFAULT_SOT_CATALOGUE;

  // SOT & Lookup state
  const [sotSubView, setSotSubView] = useState<'lookup' | 'override_docs' | 'weblinks'>('lookup');
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupCategory, setLookupCategory] = useState<string>('All');
  const [lookupPrereqModifier, setLookupPrereqModifier] = useState('');
  const [lookupActionModifier, setLookupActionModifier] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<RulesLookupResult | null>(null);
  const [lookupApplyNotice, setLookupApplyNotice] = useState<string | null>(null);

  // SOT Weblink form state
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkCategory, setNewLinkCategory] = useState<SOTCategory>('General Rule');
  const [newLinkNotes, setNewLinkNotes] = useState('');

  // SOT Rich-Text Override Page editor state
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [pageCategory, setPageCategory] = useState<SOTCategory>('Full Class SRD');
  const [pageTags, setPageTags] = useState('');
  const [pageIsOverride, setPageIsOverride] = useState(true);
  const [pageSavedNotice, setPageSavedNotice] = useState<string | null>(null);
  const [fetchingWeblinkId, setFetchingWeblinkId] = useState<string | null>(null);
  const richEditorRef = useRef<HTMLDivElement | null>(null);
  const srdFileInputRef = useRef<HTMLInputElement | null>(null);

  // Journal Settings Tab local state synced to character settings
  const [voiceSetting, setVoiceSetting] = useState(
    settings.preferredVoice || DEFAULT_AI_MODULE_SETTINGS.preferredVoice || ''
  );
  const [voiceSampleText, setVoiceSampleText] = useState(
    settings.voiceSampleText || DEFAULT_AI_MODULE_SETTINGS.voiceSampleText || ''
  );
  const [artStylePrompt, setArtStylePrompt] = useState(
    settings.artStylePrompt || DEFAULT_AI_MODULE_SETTINGS.artStylePrompt || ''
  );
  const [defaultSketchQuality, setDefaultSketchQuality] = useState<SketchDetailQuality>(
    settings.defaultSketchQuality || 'tasteful'
  );
  const [journalSettingsSaved, setJournalSettingsSaved] = useState(false);

  // Unified Plain Text to Macro state
  const [macroPrompt, setMacroPrompt] = useState('');
  const [macroDestination, setMacroDestination] = useState<MacroDestination>('copy');
  const [macroResult, setMacroResult] = useState<GeneratedMacroResult | null>(null);
  const [buffResult, setBuffResult] = useState<GeneratedBuffResult | null>(null);
  const [macroTestOutput, setMacroTestOutput] = useState<string | null>(null);
  const [isGeneratingMacro, setIsGeneratingMacro] = useState(false);
  const [permissionWarningMessage, setPermissionWarningMessage] = useState<string | null>(null);
  const [macroCopied, setMacroCopied] = useState(false);
  const [macroSentNotice, setMacroSentNotice] = useState<string | null>(null);

  // Tab 5: Broad Sheet Authority & Blind Spot Enforced Field Inspector
  const [fieldInstruction, setFieldInstruction] = useState('');
  const [proposedActions, setProposedActions] = useState<SheetModificationAction[]>([]);
  const [actionAppliedNotice, setActionAppliedNotice] = useState(false);

  if (!isOpen) return null;

  // Update Module Settings in character state
  const handleUpdateSettings = (updates: Partial<AIModuleSettings>) => {
    onUpdateCharacter((prev) => {
      const current = prev.installedModules?.aiSettings || DEFAULT_AI_MODULE_SETTINGS;
      return {
        ...prev,
        installedModules: {
          ...prev.installedModules,
          aiCompanion: true,
          aiSettings: {
            ...DEFAULT_AI_MODULE_SETTINGS,
            ...current,
            ...updates,
            allowedFields: {
              ...DEFAULT_AI_MODULE_SETTINGS.allowedFields,
              ...(current.allowedFields || {}),
              ...(updates.allowedFields || {}),
            },
            allowedModules: {
              ...DEFAULT_AI_MODULE_SETTINGS.allowedModules!,
              ...(current.allowedModules || {}),
              ...(updates.allowedModules || {}),
            },
          },
        },
      };
    });
  };

  const toggleModulePermission = (key: keyof NonNullable<AIModuleSettings['allowedModules']>) => {
    handleUpdateSettings({
      allowedModules: {
        ...allowedModules,
        [key]: !allowedModules[key],
      },
    });
  };

  const toggleFieldPermission = (key: keyof AIModuleSettings['allowedFields']) => {
    handleUpdateSettings({
      allowedFields: {
        ...allowedFields,
        [key]: !allowedFields[key],
      },
    });
  };

  const handleSetAllBlindSpots = (authorizeAll: boolean) => {
    const nextModules: Record<string, boolean> = {};
    MODULE_PERMISSION_DEFINITIONS.forEach((m) => {
      nextModules[m.key] = authorizeAll;
    });
    const nextFields: Record<string, boolean> = {};
    FIELD_PERMISSION_DEFINITIONS.forEach((f) => {
      nextFields[f.key] = authorizeAll;
    });
    handleUpdateSettings({
      allowedModules: nextModules as AIModuleSettings['allowedModules'],
      allowedFields: nextFields as unknown as AIModuleSettings['allowedFields'],
    });
  };

  // SOT Catalogue Updater
  const handleUpdateSOT = (updater: (prevSot: SOTCatalogueData) => SOTCatalogueData) => {
    onUpdateCharacter((prev) => {
      const currentSot = prev.sotCatalogue || DEFAULT_SOT_CATALOGUE;
      return {
        ...prev,
        sotCatalogue: updater(currentSot),
      };
    });
  };

  // Run AI Rules Lookup (1. SOT Doc -> 2. SOT Links -> 3. Online SRD)
  const handleRunLookup = async () => {
    if (!lookupQuery.trim() && !lookupPrereqModifier.trim()) return;
    setIsLookingUp(true);
    setLookupApplyNotice(null);
    try {
      const res = await lookupRulesWithSOT(lookupQuery, lookupCategory, character, {
        prerequisites: lookupPrereqModifier.trim() || undefined,
        actionEconomy: lookupActionModifier.trim() || undefined,
      });
      setLookupResult(res);
    } catch (err) {
      setLookupResult(null);
      setLookupApplyNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLookingUp(false);
    }
  };

  // Apply verified Lookup Result to Character Sheet (respects AI Blind Spots!)
  const handleApplyLookupToSheet = (target: 'feat' | 'action') => {
    if (!lookupResult || !lookupResult.matched) return;

    if (target === 'feat') {
      if (!allowedFields.feats) {
        setLookupApplyNotice(
          'Blocked by AI Blind Spot: "Feats & Odd-Level Progression" is currently in the AI\'s Blind Spots. Enable it in Module Permissions first.'
        );
        return;
      }
      const newFeat: FeatItem = {
        id: `feat-sot-${Date.now()}`,
        name: lookupResult.title,
        type: lookupResult.featType || 'Combat',
        prerequisites: lookupResult.prerequisites || 'None',
        summary: lookupResult.fullDescription || lookupResult.summary,
      };
      onUpdateCharacter((prev) => ({
        ...prev,
        characterFeats: [...(prev.characterFeats || []), newFeat],
        featsAndAbilities: [...(prev.featsAndAbilities || []), newFeat.name],
      }));
      setLookupApplyNotice(`Added "${lookupResult.title}" to Feats & Special Qualities!`);
    } else if (target === 'action') {
      if (!allowedFields.actionsAndResources) {
        setLookupApplyNotice(
          'Blocked by AI Blind Spot: "Action & Class Resource Directory" is currently in the AI\'s Blind Spots. Enable it in Module Permissions first.'
        );
        return;
      }
      const cleanKey =
        lookupResult.macroKey ||
        lookupResult.title.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
      const newAct: CharacterActionItem = {
        id: `act-sot-${Date.now()}`,
        name: lookupResult.title,
        category:
          lookupResult.category === 'Spell'
            ? 'Spells'
            : lookupResult.category === 'Feat'
            ? 'Feats'
            : lookupResult.hasResourcePool
            ? 'Class Resource'
            : 'Class Ability',
        actionType: lookupResult.actionType || 'Standard',
        macroKey: cleanKey,
        macroFormula: lookupResult.suggestedMacro || undefined,
        icon: lookupResult.category === 'Spell' ? 'book' : 'sparkles',
        description: lookupResult.fullDescription || lookupResult.summary,
        shortSummary: lookupResult.summary,
        range: lookupResult.range,
        saveDC: lookupResult.saveDC,
        hasResourcePool: Boolean(lookupResult.hasResourcePool),
        resourceCurrent: lookupResult.resourceMax || 3,
        resourceMax: lookupResult.resourceMax || 3,
      };
      onUpdateCharacter((prev) => ({
        ...prev,
        characterActions: [...(prev.characterActions || []), newAct],
      }));
      setLookupApplyNotice(`Added "${lookupResult.title}" to Action & Class Resource Directory!`);
    }
  };

  // SOT Weblinks handlers
  const handleAddWeblink = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    const formattedUrl = /^https?:\/\//i.test(newLinkUrl.trim())
      ? newLinkUrl.trim()
      : `https://${newLinkUrl.trim()}`;
    const item: SOTWeblinkItem = {
      id: `sot-link-${Date.now()}`,
      title: newLinkTitle.trim(),
      url: formattedUrl,
      category: newLinkCategory,
      notes: newLinkNotes.trim() || undefined,
      isActive: true,
      createdAt: Date.now(),
    };
    handleUpdateSOT((prev) => ({
      ...prev,
      weblinks: [item, ...(prev.weblinks || [])],
    }));
    setNewLinkTitle('');
    setNewLinkUrl('');
    setNewLinkNotes('');
  };

  const handleToggleWeblink = (id: string) => {
    handleUpdateSOT((prev) => ({
      ...prev,
      weblinks: (prev.weblinks || []).map((l) =>
        l.id === id ? { ...l, isActive: !l.isActive } : l
      ),
    }));
  };

  const handleDeleteWeblink = (id: string) => {
    handleUpdateSOT((prev) => ({
      ...prev,
      weblinks: (prev.weblinks || []).filter((l) => l.id !== id),
    }));
  };

  // SOT Rich-Text Override Pages handlers
  const execRichFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    richEditorRef.current?.focus();
  };

  const handleEditOverridePage = (page: SOTRichTextPage) => {
    setEditingPageId(page.id);
    setPageTitle(page.title);
    setPageCategory(page.category);
    setPageTags((page.tags || []).join(', '));
    setPageIsOverride(page.isOverride);
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = page.htmlContent || page.plainText;
    }
  };

  const handleClearOverrideForm = () => {
    setEditingPageId(null);
    setPageTitle('');
    setPageCategory('Full Class SRD');
    setPageTags('');
    setPageIsOverride(true);
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = '';
    }
  };

  // Promote an incidental link found inside a read-only SRD or single-page snapshot to the player's SOT Links list
  const handlePromoteIncidentalLinkToSOT = (
    incLink: SOTIncidentalLink,
    parentDocId?: string,
    parentWeblinkId?: string
  ) => {
    if (incLink.isWebhookOrSuspicious) return;
    handleUpdateSOT((prev) => {
      const existingLinks = prev.weblinks || [];
      const alreadyExists = existingLinks.some(
        (w) => w.url.toLowerCase() === incLink.url.toLowerCase()
      );
      const newWeblink: SOTWeblinkItem = {
        id: `sot-link-${Date.now()}`,
        title: incLink.label || incLink.url,
        url: incLink.url,
        category: 'General Rule',
        notes: 'Promoted from incidental SRD link (opens 1 page & halts read-only)',
        isActive: true,
        createdAt: Date.now(),
      };

      const nextWeblinks = alreadyExists ? existingLinks : [newWeblink, ...existingLinks];
      const nextPages = parentDocId
        ? (prev.overridePages || []).map((p) =>
            p.id === parentDocId
              ? {
                  ...p,
                  incidentalLinks: (p.incidentalLinks || []).map((l) =>
                    l.url === incLink.url ? { ...l, promotedToSOT: true } : l
                  ),
                }
              : p
          )
        : prev.overridePages || [];

      const nextWeblinksWithFlag = parentWeblinkId
        ? nextWeblinks.map((w) =>
            w.id === parentWeblinkId && w.readOnlySnapshot
              ? {
                  ...w,
                  readOnlySnapshot: {
                    ...w.readOnlySnapshot,
                    incidentalLinks: (w.readOnlySnapshot.incidentalLinks || []).map((l) =>
                      l.url === incLink.url ? { ...l, promotedToSOT: true } : l
                    ),
                  },
                }
              : w
          )
        : nextWeblinks;

      return {
        ...prev,
        weblinks: nextWeblinksWithFlag,
        overridePages: nextPages,
      };
    });
    setPageSavedNotice(`Promoted "${incLink.label}" to your official SOT Weblinks list!`);
    setTimeout(() => setPageSavedNotice(null), 3500);
  };

  // Open 1 Page & Halt (Read-Only Snapshot) for SOT Weblink
  const handleFetchSinglePageReadOnly = async (link: SOTWeblinkItem) => {
    setFetchingWeblinkId(link.id);
    try {
      const resp = await fetch('/api/sot/fetch-readonly-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link.url }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setPageSavedNotice(data?.error || 'Could not load single-page read-only snapshot.');
        return;
      }
      const snapshot = {
        fetchedAt: data.fetchedAt || Date.now(),
        sanitizedText: data.sanitizedText || '',
        haltedSinglePageOnly: true as const,
        incidentalLinks: (data.incidentalLinks || []) as SOTIncidentalLink[],
        securityAudit: data.securityAudit || {
          isReadOnly: true as const,
          strippedScriptsCount: 0,
          strippedWebhooksCount: 0,
          strippedCodeSnipsCount: 0,
          incidentalLinksCount: 0,
          sanitizedAt: Date.now(),
        },
      };
      // Also extract any mathematical breakdowns from this single-page SRD into Macaroni Suggestions!
      const newMathSuggestions = extractMacaroniSuggestionsFromSrd(
        link.id,
        link.title,
        snapshot.sanitizedText
      );

      handleUpdateSOT((prev) => {
        const existingSuggs = prev.macaroniSuggestions || [];
        const mergedSuggs = [...existingSuggs];
        for (const s of newMathSuggestions) {
          if (!mergedSuggs.some((m) => m.abilityName.toLowerCase() === s.abilityName.toLowerCase())) {
            mergedSuggs.unshift(s);
          }
        }
        return {
          ...prev,
          weblinks: (prev.weblinks || []).map((w) =>
            w.id === link.id ? { ...w, readOnlySnapshot: snapshot } : w
          ),
          macaroniSuggestions: mergedSuggs,
        };
      });
      setPageSavedNotice(
        `Opened 1 page ("${link.title}") & halted! Treated as Read-Only (${newMathSuggestions.length} math macro(s) sent to DSL Studio).`
      );
      setTimeout(() => setPageSavedNotice(null), 4000);
    } catch {
      setPageSavedNotice('Network error while fetching single-page read-only snapshot.');
    } finally {
      setFetchingWeblinkId(null);
    }
  };

  // Load/Import multiple SRD files saved separately on the host device
  const handleImportHostSrdFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const importedDocs: SOTRichTextPage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const text = await file.text();
      const doc = parseImportedSrdFile(file.name, text);
      if (doc) {
        saveSrdDocToHostDeviceStorage(doc);
        importedDocs.push(doc);
      }
    }

    if (importedDocs.length > 0) {
      handleUpdateSOT((prev) => {
        const existingPages = [...(prev.overridePages || [])];
        const existingSuggs = [...(prev.macaroniSuggestions || [])];

        for (const doc of importedDocs) {
          const idx = existingPages.findIndex((p) => p.id === doc.id);
          if (idx >= 0) {
            existingPages[idx] = doc;
          } else {
            existingPages.unshift(doc);
          }

          const extractedSuggs = extractMacaroniSuggestionsFromSrd(
            doc.id,
            doc.title,
            doc.plainText
          );
          for (const s of extractedSuggs) {
            if (
              !existingSuggs.some(
                (m) => m.abilityName.toLowerCase() === s.abilityName.toLowerCase()
              )
            ) {
              existingSuggs.unshift(s);
            }
          }
        }

        return {
          ...prev,
          overridePages: existingPages,
          macaroniSuggestions: existingSuggs,
        };
      });

      setPageSavedNotice(
        `Loaded ${importedDocs.length} SRD doc(s) as Read-Only & saved separately on host device!`
      );
      setTimeout(() => setPageSavedNotice(null), 4000);
    }
    e.target.value = '';
  };

  // Sync any SRDs previously saved separately in Host Device storage
  const handleSyncFromHostDeviceStorage = () => {
    const hostDocs = loadAllHostDeviceSrdDocs();
    if (hostDocs.length === 0) {
      setPageSavedNotice('No additional separate SRD docs found in host device storage.');
      setTimeout(() => setPageSavedNotice(null), 3000);
      return;
    }
    handleUpdateSOT((prev) => {
      const existingPages = [...(prev.overridePages || [])];
      const existingSuggs = [...(prev.macaroniSuggestions || [])];
      let addedCount = 0;
      for (const doc of hostDocs) {
        if (!existingPages.some((p) => p.id === doc.id)) {
          existingPages.unshift(doc);
          addedCount++;
        }
        const suggs = extractMacaroniSuggestionsFromSrd(doc.id, doc.title, doc.plainText);
        for (const s of suggs) {
          if (!existingSuggs.some((m) => m.abilityName.toLowerCase() === s.abilityName.toLowerCase())) {
            existingSuggs.unshift(s);
          }
        }
      }
      setPageSavedNotice(
        `Synced ${hostDocs.length} separate SRD doc(s) from host device (${addedCount} new)!`
      );
      setTimeout(() => setPageSavedNotice(null), 3500);
      return {
        ...prev,
        overridePages: existingPages,
        macaroniSuggestions: existingSuggs,
      };
    });
  };

  const handleSaveOverridePage = () => {
    const rawHtml = richEditorRef.current?.innerHTML?.trim() || '';
    const rawPlain = richEditorRef.current?.innerText?.trim() || '';
    if (!pageTitle.trim() || (!rawHtml && !rawPlain)) return;

    // Sanitize & quarantine embedded links, webhooks, and code snips
    const sanitized = sanitizeSrdDocument(rawHtml || `<p>${rawPlain}</p>`, rawPlain);
    const pageId = editingPageId || `sot-page-${Date.now()}`;

    const savedPage: SOTRichTextPage = {
      id: pageId,
      title: pageTitle.trim(),
      category: pageCategory,
      htmlContent: sanitized.sanitizedHtml,
      plainText: sanitized.sanitizedPlainText,
      isOverride: pageIsOverride,
      isReadOnly: true,
      incidentalLinks: sanitized.incidentalLinks,
      securityAudit: sanitized.securityAudit,
      tags: pageTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      updatedAt: Date.now(),
    };

    // Save separately on the host device
    const hostKey = saveSrdDocToHostDeviceStorage(savedPage);
    savedPage.hostSavedKey = hostKey;

    // Extract Macaroni Suggestions from any mathematical breakdowns in the SRD
    const newMathSuggestions = extractMacaroniSuggestionsFromSrd(
      savedPage.id,
      savedPage.title,
      savedPage.plainText
    );

    handleUpdateSOT((prev) => {
      const existing = prev.overridePages || [];
      const idx = existing.findIndex((p) => p.id === savedPage.id);
      const nextPages =
        idx >= 0
          ? existing.map((p, i) => (i === idx ? savedPage : p))
          : [savedPage, ...existing];

      const existingSuggs = prev.macaroniSuggestions || [];
      const mergedSuggs = [...existingSuggs];
      for (const s of newMathSuggestions) {
        if (!mergedSuggs.some((m) => m.abilityName.toLowerCase() === s.abilityName.toLowerCase())) {
          mergedSuggs.unshift(s);
        }
      }

      return {
        ...prev,
        overridePages: nextPages,
        macaroniSuggestions: mergedSuggs,
      };
    });

    handleClearOverrideForm();
    setPageSavedNotice(
      `Locked "${savedPage.title}" as Read-Only SRD (saved separately on host device • ${newMathSuggestions.length} Macaroni suggestion(s) sent to DSL Studio)!`
    );
    setTimeout(() => setPageSavedNotice(null), 4000);
  };

  const handleDeleteOverridePage = (id: string) => {
    removeSrdDocFromHostDeviceStorage(id);
    handleUpdateSOT((prev) => ({
      ...prev,
      overridePages: (prev.overridePages || []).filter((p) => p.id !== id),
      macaroniSuggestions: (prev.macaroniSuggestions || []).filter((m) => m.sourceDocId !== id),
    }));
    if (editingPageId === id) {
      handleClearOverrideForm();
    }
  };

  const handleSaveJournalSettings = () => {
    handleUpdateSettings({
      preferredVoice: voiceSetting,
      voiceSampleText,
      artStylePrompt,
      defaultSketchQuality,
    });
    setJournalSettingsSaved(true);
    setTimeout(() => setJournalSettingsSaved(false), 2500);
  };

  const checkDestinationPermission = (
    dest: MacroDestination
  ): {
    allowed: boolean;
    missingLabel: string;
    permKey?: keyof NonNullable<AIModuleSettings['allowedModules']>;
  } => {
    if (dest === 'dsl_studio' && !allowedModules.dslStudio) {
      return { allowed: false, missingLabel: 'DSL Studio (Page 4)', permKey: 'dslStudio' };
    }
    if (dest === 'buff_box' && !allowedModules.buffBox) {
      return { allowed: false, missingLabel: 'Buff Box (<^...>)', permKey: 'buffBox' };
    }
    if (dest === 'stepper' && !allowedModules.stepper) {
      return { allowed: false, missingLabel: 'Stepper Tool (<< / >>)', permKey: 'stepper' };
    }
    return { allowed: true, missingLabel: '' };
  };

  const handleGenerateUnifiedMacro = async (bypassPermWarning = false) => {
    if (!macroPrompt.trim()) return;

    const permCheck = checkDestinationPermission(macroDestination);
    const anyMissingCorePerms =
      !allowedModules.stepper || !allowedModules.buffBox || !allowedModules.dslStudio;

    if (!permCheck.allowed && !bypassPermWarning) {
      setPermissionWarningMessage(
        `AI Blind Spot Notice: Direct sending to "${permCheck.missingLabel}" is currently in the AI's Blind Spots. Enable ${permCheck.missingLabel} permission below, or click "Generate for Copy/Paste Only".`
      );
      return;
    }

    if (anyMissingCorePerms && !bypassPermWarning && !permissionWarningMessage) {
      const disabledList = [
        !allowedModules.stepper ? 'Stepper' : null,
        !allowedModules.buffBox ? 'Buff Box' : null,
        !allowedModules.dslStudio ? 'DSL Studio' : null,
      ].filter(Boolean);
      setPermissionWarningMessage(
        `Note from AI Listener: [${disabledList.join(
          ', '
        )}] are currently in the AI's Blind Spots. Direct routing to those fields is locked until authorized in Module Permissions.`
      );
    } else if (permCheck.allowed) {
      setPermissionWarningMessage(null);
    }

    setIsGeneratingMacro(true);
    setMacroTestOutput(null);
    setMacroSentNotice(null);

    try {
      const [dslRes, buffRes] = await Promise.all([
        generateMacroFromEnglish(macroPrompt, character),
        generateBuffFromEnglish(macroPrompt, character),
      ]);
      setMacroResult(dslRes);
      setBuffResult(buffRes);

      if (macroDestination !== 'copy' && permCheck.allowed) {
        dispatchMacroToDestination(macroDestination, dslRes, buffRes);
      }
    } catch (err) {
      setPermissionWarningMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingMacro(false);
    }
  };

  const dispatchMacroToDestination = (
    dest: MacroDestination,
    dslRes: GeneratedMacroResult | null = macroResult,
    bRes: GeneratedBuffResult | null = buffResult
  ) => {
    const permCheck = checkDestinationPermission(dest);
    if (!permCheck.allowed) {
      setPermissionWarningMessage(
        `Cannot send directly to ${permCheck.missingLabel} because it is in the AI's Blind Spots.`
      );
      return;
    }

    if (dest === 'dsl_studio' && dslRes) {
      const newFormulaObj: CustomFormulaObject = {
        id: `macro-${Date.now()}`,
        name: dslRes.name,
        description: dslRes.description,
        formula:
          bRes &&
          (macroPrompt.toLowerCase().includes('buff') ||
            macroPrompt.toLowerCase().includes('ac') ||
            macroPrompt.toLowerCase().includes('rage'))
            ? bRes.coordinateSyntax
            : dslRes.formula,
        category: dslRes.category,
      };
      onUpdateCharacter((prev) => ({
        ...prev,
        customObjects: [...(prev.customObjects || []), newFormulaObj],
      }));
      setMacroSentNotice('Sent directly to DSL Studio (Page 4 Formula Objects)!');
    } else if (dest === 'buff_box' && bRes) {
      const newBuff: CustomBuffEffect = {
        id: `ai-buff-${Date.now()}`,
        name: bRes.name,
        bonusType: bRes.bonusType,
        category: bRes.category,
        isActive: true,
        values: bRes.values,
        notes: `${bRes.explanation} | Macro: ${bRes.coordinateSyntax}`,
      };
      onUpdateCharacter((prev) => ({
        ...prev,
        customBuffs: [newBuff, ...(prev.customBuffs || [])],
      }));
      setMacroSentNotice(`Sent "${bRes.name}" directly to Buff Box and activated!`);
    } else if (dest === 'stepper' && dslRes) {
      const newRule: StepperRule = {
        id: `step-ai-${Date.now()}`,
        rawText: `[${dslRes.name}: <<10 -1 =0 "${dslRes.name} ended"] // ${dslRes.description}`,
        type: 'track',
        label: dslRes.name,
        currentValue: 10,
        stepAmount: -1,
        triggerValue: 0,
        triggerAlert: `${dslRes.name} expired!`,
        isActive: true,
        playerNote: dslRes.description,
      };
      onUpdateCharacter((prev) => ({
        ...prev,
        stepperRules: [newRule, ...(prev.stepperRules || [])],
      }));
      setMacroSentNotice(`Sent "${dslRes.name}" countdown rule directly to Stepper Tool!`);
    }
  };

  const handleTestMacro = () => {
    if (!macroResult) return;
    const context = buildFormulaContext(
      character,
      {
        strPenalty: 0,
        dexPenalty: 0,
        attackPenalty: 0,
      },
      ctx.derived
    );
    const evalRes = evaluateFormula(macroResult.formula, context);
    if (evalRes.isError) {
      setMacroTestOutput(`Error: ${evalRes.errorMessage}`);
    } else {
      setMacroTestOutput(evalRes.evaluated);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setMacroCopied(true);
    setTimeout(() => setMacroCopied(false), 2000);
  };

  // Sheet Field Inspector
  const handleParseFieldInstruction = () => {
    if (!fieldInstruction.trim()) return;
    const actions = parseNaturalLanguageSheetUpdates(
      fieldInstruction,
      character,
      settings.allowedFields
    );
    setProposedActions(actions);
  };

  const handleApplyAction = (action: SheetModificationAction) => {
    if (action.isBlockedByBlindSpot) return;
    onUpdateCharacter((prev) => action.apply(prev));
    setProposedActions((prev) => prev.filter((a) => a !== action));
    setActionAppliedNotice(true);
    setTimeout(() => setActionAppliedNotice(false), 2500);
  };

  const isDark = theme === 'blueprint' || theme === 'mythweavers';

  // Calculate Blind Spot counts
  const totalModulesCount = MODULE_PERMISSION_DEFINITIONS.length;
  const authorizedModulesCount = MODULE_PERMISSION_DEFINITIONS.filter(
    (m) => allowedModules[m.key] !== false
  ).length;
  const blindSpotModulesCount = totalModulesCount - authorizedModulesCount;

  const totalFieldsCount = FIELD_PERMISSION_DEFINITIONS.length;
  const authorizedFieldsCount = FIELD_PERMISSION_DEFINITIONS.filter(
    (f) => allowedFields[f.key] !== false
  ).length;
  const blindSpotFieldsCount = totalFieldsCount - authorizedFieldsCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 md:p-6 overflow-hidden">
      <div
        className={`w-full max-w-5xl h-[92vh] rounded-xl flex flex-col shadow-2xl border overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-cyan-500/40 text-slate-100'
            : 'bg-[#faf6ee] border-amber-900/30 text-stone-900'
        }`}
      >
        {/* Header Bar */}
        <div
          className={`p-4 border-b flex items-center justify-between shrink-0 select-none ${
            isDark ? 'bg-slate-950/90 border-cyan-500/30' : 'bg-[#f4ebe1] border-amber-800/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center border shadow-xs ${
                isDark
                  ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                  : 'bg-amber-100 border-amber-700 text-amber-900'
              }`}
            >
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-mono font-bold text-base tracking-wide flex items-center gap-1.5">
                  <span>AI Companion Listener, SOT Catalogue &amp; Blind Spots</span>
                </h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {authorizedModulesCount + authorizedFieldsCount} Active •{' '}
                  {blindSpotModulesCount + blindSpotFieldsCount} Blind Spots
                </span>
              </div>
              <p className="text-xs opacity-75 font-serif">
                Manage AI Blind Spots across all 14 toolkits &amp; 19 sheet sections, curate Source
                of Truth (SOT) Override Docs &amp; Weblinks, and run verified SRD lookups.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCompleteSheet && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCompleteSheet();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white flex items-center gap-1.5 transition-all shadow-xs"
                title="Launch Complete Sheet Chatbot Mini-Window"
              >
                <AppleEyeIcon className="w-4 h-4 text-cyan-200" />
                <span>Complete Sheet (Mini-Window)</span>
              </button>
            )}

            {onOpenAddClass && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAddClass();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-slate-950 flex items-center gap-1.5 transition-colors shadow-xs"
                title="Jump directly to Add Class & Archetype Studio"
              >
                <Split className="w-3.5 h-3.5" />
                <span>Add Class Tool</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 opacity-70" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          className={`px-4 border-b flex items-center gap-2 shrink-0 overflow-x-auto ${
            isDark ? 'bg-slate-950/40 border-cyan-500/20' : 'bg-[#f7f2e7] border-amber-900/15'
          }`}
        >
          {[
            { id: 'permissions', label: '1. Module Permissions & Blind Spots', icon: Settings },
            { id: 'lookup_sot', label: '2. Lookups & SOT Catalogue', icon: Globe },
            { id: 'journal_settings', label: '3. Journal & Sketch Settings', icon: BookOpen },
            { id: 'fields', label: '5. Broad Sheet Authority', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AICompanionTab)}
                className={`py-2.5 px-3 border-b-2 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  isActive
                    ? isDark
                      ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                      : 'border-amber-800 text-amber-900 bg-amber-200/40'
                    : 'border-transparent opacity-65 hover:opacity-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* ================================================================= */}
          {/* TAB 1: MODULE PERMISSIONS & GRANULAR AI BLIND SPOTS               */}
          {/* ================================================================= */}
          {activeTab === 'permissions' && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Top Summary & Batch Blind Spot Controls */}
              <div
                className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isDark ? 'bg-slate-950 border-cyan-500/30' : 'bg-white border-amber-800/25'
                }`}
              >
                <div className="space-y-1">
                  <h3 className="font-serif font-bold text-base flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    <span>AI Authority &amp; Blind Spot Control Matrix</span>
                  </h3>
                  <p className="text-xs opacity-80 font-serif">
                    Every module, toolkit, and sheet section has its own independent toggle. Adding
                    a module or section to the AI&apos;s <strong>Blind Spots</strong> prevents the
                    AI from reading, auto-populating, or modifying it.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => handleSetAllBlindSpots(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Authorize All</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllBlindSpots(false)}
                    className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold flex items-center gap-1.5"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Add All to Blind Spots</span>
                  </button>
                </div>
              </div>

              {/* SECTION A: All 14 Toolkit & Studio Modules */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono font-bold text-xs uppercase tracking-wider text-cyan-500">
                    Toolkit &amp; Studio Modules ({authorizedModulesCount}/{totalModulesCount} Authorized • {blindSpotModulesCount} in Blind Spots)
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    {onOpenJournal && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenJournal();
                        }}
                        className="text-amber-500 hover:underline"
                      >
                        Open Journal &rarr;
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('lookup_sot')}
                      className="text-cyan-400 hover:underline"
                    >
                      Open SOT Catalogue &rarr;
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {MODULE_PERMISSION_DEFINITIONS.map((mod) => {
                    const isAllowed = allowedModules[mod.key] !== false;
                    return (
                      <div
                        key={mod.key}
                        onClick={() => toggleModulePermission(mod.key)}
                        className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex items-start justify-between gap-3 ${
                          isAllowed
                            ? isDark
                              ? 'bg-cyan-950/35 border-cyan-500/40'
                              : 'bg-amber-100/60 border-amber-700/40'
                            : 'bg-rose-950/20 border-rose-500/30 opacity-75'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs">{mod.label}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/15 dark:bg-white/10 opacity-70">
                              {mod.group}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-80 font-serif">{mod.desc}</p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleModulePermission(mod.key);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 shrink-0 transition-colors ${
                            isAllowed
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-rose-700 hover:bg-rose-600 text-white'
                          }`}
                        >
                          {isAllowed ? (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Authorized</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span>Blind Spot</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION B: All 19 Character Sheet Sections & Fields */}
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-amber-800/20'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-500 block">
                      Character Sheet Section Permissions &amp; Blind Spots ({authorizedFieldsCount}/{totalFieldsCount} Authorized • {blindSpotFieldsCount} in Blind Spots)
                    </span>
                    <p className="text-[11px] font-serif opacity-75">
                      Control which specific character sheet sections the AI can read or populate
                      (including the Apple-Eye AI Seek button inside +Add Feat and +Add Action/Resource).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('fields')}
                    className="px-3 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold"
                  >
                    Test Sheet Field Authority &rarr;
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  {FIELD_PERMISSION_DEFINITIONS.map((field) => {
                    const isAllowed = allowedFields[field.key] !== false;
                    return (
                      <div
                        key={field.key}
                        onClick={() => toggleFieldPermission(field.key)}
                        className={`p-2.5 rounded-lg border cursor-pointer select-none transition-all flex items-start justify-between gap-2 ${
                          isAllowed
                            ? isDark
                              ? 'bg-cyan-950/35 border-cyan-500/40 text-cyan-100'
                              : 'bg-amber-100/60 border-amber-700/40 text-stone-900'
                            : 'bg-rose-950/20 border-rose-500/30 opacity-70'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-[11px] leading-tight">
                            {field.label}
                          </div>
                          <div className="text-[10px] font-serif opacity-75 mt-0.5">
                            {field.desc}
                          </div>
                        </div>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 flex items-center gap-1 ${
                            isAllowed
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/25 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {isAllowed ? (
                            <>
                              <Unlock className="w-2.5 h-2.5" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              < EyeOff className="w-2.5 h-2.5" />
                              <span>Blind Spot</span>
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: LOOKUPS & SOURCE OF TRUTH (SOT) CATALOGUE                  */}
          {/* ================================================================= */}
          {activeTab === 'lookup_sot' && (
            <div className="max-w-4xl mx-auto space-y-5">
              {/* Sub-Navigation Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                    <AppleEyeIcon className="w-5 h-5 text-rose-400" />
                    <span>Online Rules Lookup &amp; Source of Truth (SOT) Catalogue</span>
                  </h3>
                  <p className="text-xs opacity-80 font-serif">
                    Strict search order: <strong>1. SOT Override Docs</strong> (overrides online
                    info) &rarr; <strong>2. Saved SOT Weblinks</strong> &rarr;{' '}
                    <strong>3. Verified Online PF1e SRD</strong>. Never guesses or fabricates rules!
                  </p>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs">
                  {[
                    { id: 'lookup' as const, label: 'AI Seek & Lookup', icon: Globe },
                    {
                      id: 'override_docs' as const,
                      label: `SOT Override Docs (${sotCatalogue.overridePages?.length || 0})`,
                      icon: FileText,
                    },
                    {
                      id: 'weblinks' as const,
                      label: `SOT Weblinks (${sotCatalogue.weblinks?.length || 0})`,
                      icon: Link2,
                    },
                  ].map((sub) => {
                    const SubIcon = sub.icon;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSotSubView(sub.id)}
                        className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 font-bold transition-colors ${
                          sotSubView === sub.id
                            ? 'bg-cyan-600 text-white border-cyan-500'
                            : 'bg-black/5 dark:bg-white/5 border-inherit opacity-75 hover:opacity-100'
                        }`}
                      >
                        <SubIcon className="w-3.5 h-3.5" />
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SUB-VIEW 1: AI RULES LOOKUP */}
              {sotSubView === 'lookup' && (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-xl border space-y-3 ${
                      isDark ? 'bg-slate-950 border-cyan-500/30' : 'bg-white border-amber-800/25'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-6">
                        <label className="text-xs font-mono font-bold block mb-1">
                          Feat, Class Ability, Spell, or Power Name:
                        </label>
                        <input
                          type="text"
                          value={lookupQuery}
                          onChange={(e) => setLookupQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRunLookup();
                          }}
                          placeholder="e.g. Power Attack, Outflank, Smite Evil, Haste, Fireball..."
                          className={`w-full px-3 py-2 rounded-lg text-xs border font-mono ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-100'
                              : 'bg-stone-50 border-amber-300 text-stone-900'
                          }`}
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="text-xs font-mono font-bold block mb-1">
                          Category Modifier:
                        </label>
                        <select
                          value={lookupCategory}
                          onChange={(e) => setLookupCategory(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg text-xs border font-mono ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-cyan-200'
                              : 'bg-stone-50 border-amber-300 text-stone-900'
                          }`}
                        >
                          <option value="All">All Categories</option>
                          <option value="Feat">Feat</option>
                          <option value="Class Ability">Class Ability / Resource</option>
                          <option value="Spell">Spell / SLA</option>
                          <option value="Power">Power / Sphere / Maneuver</option>
                          <option value="Archetype">Archetype</option>
                        </select>
                      </div>

                      <div className="md:col-span-3 flex items-end">
                        <button
                          type="button"
                          onClick={handleRunLookup}
                          disabled={isLookingUp || (!lookupQuery.trim() && !lookupPrereqModifier.trim())}
                          className="w-full px-4 py-2 rounded-lg bg-gradient-to-b from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 disabled:opacity-50 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-sm border border-rose-400/40"
                        >
                          <AppleEyeIcon className="w-4 h-4" isSeeking={isLookingUp} />
                          <span>{isLookingUp ? 'Seeking...' : 'Seek with Apple-Eye'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Optional Search Modifiers Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] font-mono opacity-75 block mb-1">
                          Optional Prerequisite / Keyword Modifier:
                        </label>
                        <input
                          type="text"
                          value={lookupPrereqModifier}
                          onChange={(e) => setLookupPrereqModifier(e.target.value)}
                          placeholder="e.g. BAB +1, Str 13, Paladin 1, Sorcerer 3..."
                          className={`w-full px-3 py-1.5 rounded text-xs border font-mono ${
                            isDark
                              ? 'bg-slate-900 border-slate-800 text-slate-200'
                              : 'bg-stone-50 border-amber-200'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-mono opacity-75 block mb-1">
                          Optional Action Economy Modifier:
                        </label>
                        <input
                          type="text"
                          value={lookupActionModifier}
                          onChange={(e) => setLookupActionModifier(e.target.value)}
                          placeholder="e.g. Swift, Standard, Free, Passive..."
                          className={`w-full px-3 py-1.5 rounded text-xs border font-mono ${
                            isDark
                              ? 'bg-slate-900 border-slate-800 text-slate-200'
                              : 'bg-stone-50 border-amber-200'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono pt-1">
                      <span className="opacity-60">Try Verified Lookups:</span>
                      {[
                        'Power Attack',
                        'Deadly Aim',
                        'Outflank',
                        'Dodge',
                        'Smite Evil',
                        'Barbarian Rage',
                        'Lay on Hands',
                        'Haste',
                        'Fireball',
                      ].map((sample) => (
                        <button
                          key={sample}
                          type="button"
                          onClick={() => {
                            setLookupQuery(sample);
                          }}
                          className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 hover:bg-rose-500/20 text-[10px]"
                        >
                          {sample}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lookup Error Notice (when lookupResult is null) */}
                  {!lookupResult && lookupApplyNotice && (
                    <div className="p-3 rounded-xl border bg-rose-950/30 border-rose-500/50 text-rose-300 text-xs font-mono flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                      <div>{lookupApplyNotice}</div>
                    </div>
                  )}

                  {/* Lookup Result Display */}
                  {lookupResult && (
                    <div
                      className={`p-4 rounded-xl border space-y-3 ${
                        !lookupResult.matched
                          ? 'bg-amber-950/30 border-amber-500/50'
                          : isDark
                          ? 'bg-slate-950 border-cyan-500/40'
                          : 'bg-white border-amber-800/30'
                      }`}
                    >
                      {!lookupResult.matched ? (
                        <div className="flex items-start gap-2.5 text-xs font-mono text-amber-400">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold">No Verified Match Found (Zero Guessing Policy)</div>
                            <p className="opacity-85 mt-0.5">{lookupResult.sourceNotes}</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-black/10 dark:border-white/10">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-serif font-bold text-base text-amber-500">
                                  {lookupResult.title}
                                </h4>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                                  {lookupResult.category}
                                </span>
                                <span
                                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                    lookupResult.sourceAuthority === 'SOT Override Page'
                                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                                      : lookupResult.sourceAuthority === 'SOT Weblink'
                                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                                      : 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                                  }`}
                                >
                                  Authority: {lookupResult.sourceAuthority}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono opacity-75 mt-1 flex flex-wrap gap-3">
                                <span>Prerequisites: {lookupResult.prerequisites}</span>
                                <span>• Action: {lookupResult.actionType}</span>
                                {lookupResult.range && <span>• Range: {lookupResult.range}</span>}
                                {lookupResult.saveDC && <span>• Save: {lookupResult.saveDC}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <button
                                type="button"
                                onClick={() => handleApplyLookupToSheet('feat')}
                                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold flex items-center gap-1"
                              >
                                <Award className="w-3.5 h-3.5" />
                                <span>+ Add to Feats</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplyLookupToSheet('action')}
                                className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1"
                              >
                                <Swords className="w-3.5 h-3.5" />
                                <span>+ Add to Action Directory</span>
                              </button>
                            </div>
                          </div>

                          {lookupApplyNotice && (
                            <div className="p-2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
                              {lookupApplyNotice}
                            </div>
                          )}

                          <p className="text-xs font-serif leading-relaxed whitespace-pre-wrap">
                            {lookupResult.fullDescription}
                          </p>

                          {lookupResult.suggestedMacro && (
                            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono flex items-center justify-between gap-2">
                              <span className="text-cyan-300 truncate">
                                Macro: <strong>{lookupResult.suggestedMacro}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(lookupResult.suggestedMacro)}
                                className="text-amber-400 hover:underline shrink-0"
                              >
                                Copy Macro
                              </button>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/10 dark:border-white/10 text-[11px] font-mono opacity-80">
                            <span>Source: {lookupResult.sourceNotes}</span>
                            {lookupResult.sourceUrls.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap">
                                {lookupResult.sourceUrls.slice(0, 3).map((u, i) => (
                                  <a
                                    key={i}
                                    href={u.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-400 hover:underline flex items-center gap-1"
                                  >
                                    <span>{u.title}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-VIEW 2: SOT RICH-TEXT OVERRIDE PAGES & MULTI-SRD REPOSITORY */}
              {sotSubView === 'override_docs' && (
                <div className="space-y-4">
                  {/* Host Device Multi-SRD Toolbar */}
                  <div
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                      isDark
                        ? 'bg-slate-950/90 border-emerald-500/30'
                        : 'bg-amber-50/90 border-amber-800/25'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-2">
                          <span>Multi-SRD Host Vault &amp; Read-Only Quarantine</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40">
                            {(sotCatalogue.overridePages || []).length} SRD Docs Loaded
                          </span>
                        </div>
                        <p className="text-[11px] font-serif opacity-80">
                          Paste an entire browser class/rules page or load multiple SRDs. Once loaded,
                          SRD docs are locked <strong>Read-Only</strong> (webhooks/scripts/code stripped).
                          Incidental links inside SRDs are inert until you promote them to your SOT Links list.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      <input
                        ref={srdFileInputRef}
                        type="file"
                        accept=".json,.txt,.html,.md"
                        multiple
                        onChange={handleImportHostSrdFiles}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => srdFileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1"
                        title="Load one or more SRD files (.srd.json, .html, .txt) from your host device"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Load SRD File(s) from Host</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSyncFromHostDeviceStorage}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1"
                        title="Sync all separate SRDs saved in browser host storage"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Sync Host SRDs</span>
                      </button>
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-xl border space-y-3 ${
                      isDark ? 'bg-slate-950 border-cyan-500/30' : 'bg-white border-amber-800/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-mono font-bold text-xs uppercase text-emerald-400">
                          {editingPageId
                            ? 'Re-Sanitize & Update SOT SRD Doc'
                            : 'Load New SRD Document / Browser Page Dump into SOT (Locked Read-Only on Save)'}
                        </h4>
                        <p className="text-[11px] font-serif opacity-75">
                          Copy-paste an entire browser class page, feat list, or house rule below.
                          Mathematical breakdowns automatically generate{' '}
                          <strong>Macaroni Suggestions</strong> in the DSL Studio!
                        </p>
                      </div>
                      {editingPageId && (
                        <button
                          type="button"
                          onClick={handleClearOverrideForm}
                          className="text-xs font-mono text-rose-400 hover:underline"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="md:col-span-2">
                        <label className="font-mono font-bold block mb-1">SRD / Rule Title:</label>
                        <input
                          type="text"
                          value={pageTitle}
                          onChange={(e) => setPageTitle(e.target.value)}
                          placeholder="e.g. Full Class SRD: Slayer, Elephant in the Room Feat Taxes..."
                          className={`w-full px-3 py-1.5 rounded border ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-100'
                              : 'bg-stone-50 border-amber-300'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="font-mono font-bold block mb-1">Category:</label>
                        <select
                          value={pageCategory}
                          onChange={(e) => setPageCategory(e.target.value as SOTCategory)}
                          className={`w-full px-3 py-1.5 rounded border font-mono ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-cyan-200'
                              : 'bg-stone-50 border-amber-300'
                          }`}
                        >
                          <option value="Full Class SRD">Full Class SRD (Browser Page Dump)</option>
                          <option value="Feat">Feat</option>
                          <option value="Class Ability">Class Ability</option>
                          <option value="Spell">Spell</option>
                          <option value="Power">Power</option>
                          <option value="Archetype">Archetype</option>
                          <option value="General Rule">General Rule</option>
                        </select>
                      </div>
                    </div>

                    {/* Rich Text Formatting Toolbar */}
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 rounded-t-lg border border-b-0 border-slate-700 bg-slate-900 text-slate-200 text-xs font-mono">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => execRichFormat('bold')}
                            className="p-1 rounded hover:bg-white/10"
                            title="Bold"
                          >
                            <Bold className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => execRichFormat('italic')}
                            className="p-1 rounded hover:bg-white/10"
                            title="Italic"
                          >
                            <Italic className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => execRichFormat('underline')}
                            className="p-1 rounded hover:bg-white/10"
                            title="Underline"
                          >
                            <Underline className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => execRichFormat('formatBlock', 'H3')}
                            className="p-1 rounded hover:bg-white/10"
                            title="Heading"
                          >
                            <Heading2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => execRichFormat('insertUnorderedList')}
                            className="p-1 rounded hover:bg-white/10"
                            title="Bullet List"
                          >
                            <List className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-emerald-400">
                          <input
                            type="checkbox"
                            checked={pageIsOverride}
                            onChange={(e) => setPageIsOverride(e.target.checked)}
                            className="rounded accent-emerald-500"
                          />
                          <span>Active</span>
                        </label>
                      </div>

                      <div
                        ref={richEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        className={`min-h-[120px] max-h-[240px] overflow-y-auto p-3 rounded-b-lg border text-xs font-serif leading-relaxed outline-hidden ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-slate-100'
                            : 'bg-stone-50 border-amber-300 text-stone-900'
                        }`}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <input
                        type="text"
                        value={pageTags}
                        onChange={(e) => setPageTags(e.target.value)}
                        placeholder="Keywords / Tags (comma-separated, e.g. Slayer, Studied Target, Power Attack)..."
                        className={`flex-1 px-3 py-1.5 rounded text-xs border font-mono ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-slate-200'
                            : 'bg-stone-50 border-amber-300'
                        }`}
                      />

                      <button
                        type="button"
                        onClick={handleSaveOverridePage}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>
                          {editingPageId
                            ? 'Sanitize & Lock SRD (Read-Only)'
                            : 'Load & Lock SRD as Read-Only'}
                        </span>
                      </button>
                    </div>

                    {pageSavedNotice && (
                      <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>{pageSavedNotice}</span>
                      </div>
                    )}
                  </div>

                  {/* Saved Read-Only SRD Pages List */}
                  <div className="space-y-3">
                    {(sotCatalogue.overridePages || []).map((page) => {
                      const incLinks = page.incidentalLinks || [];
                      const audit = page.securityAudit;
                      return (
                        <div
                          key={page.id}
                          className={`p-3.5 rounded-xl border space-y-2.5 ${
                            isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-amber-800/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-serif font-bold text-sm text-amber-500">
                                {page.title}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                                {page.category}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                <span>READ-ONLY SRD</span>
                              </span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                  page.isOverride
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                {page.isOverride ? 'OVERRIDES ONLINE SRD' : 'Reference Only'}
                              </span>
                              {audit && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
                                  Quarantined: {audit.strippedScriptsCount} scripts,{' '}
                                  {audit.strippedWebhooksCount} webhooks,{' '}
                                  {audit.strippedCodeSnipsCount} code snips stripped
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => exportSrdDocFileToHost(page)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1 border border-emerald-500/30"
                                title="Save this SRD separately as a file (.srd.json) on your host device"
                              >
                                <Download className="w-3 h-3" />
                                <span>Save File to Host</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOverridePage(page.id)}
                                className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
                                title="Delete SRD doc from SOT and host storage"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Read-Only Sanitized Body */}
                          <div
                            className="p-3 rounded-lg bg-black/20 border border-slate-800/80 text-xs font-serif opacity-90 prose prose-invert max-w-none select-text pointer-events-none"
                            dangerouslySetInnerHTML={{ __html: page.htmlContent }}
                          />

                          {/* Incidental Links Quarantined inside this SRD */}
                          {incLinks.length > 0 && (
                            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/30 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-mono text-amber-300">
                                <span className="flex items-center gap-1.5 font-bold">
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                                  <span>
                                    Incidental Links in SRD ({incLinks.length}) — Not SOT unless added
                                    to SOT Links List:
                                  </span>
                                </span>
                              </div>
                              <div className="space-y-1">
                                {incLinks.map((inc, idx) => {
                                  const alreadyInSot =
                                    inc.promotedToSOT ||
                                    (sotCatalogue.weblinks || []).some(
                                      (w) => w.url.toLowerCase() === inc.url.toLowerCase()
                                    );
                                  return (
                                    <div
                                      key={`${inc.url}-${idx}`}
                                      className="flex items-center justify-between gap-2 text-[11px] font-mono px-2 py-1 rounded bg-slate-950/80 border border-slate-800"
                                    >
                                      <div className="truncate flex items-center gap-2 min-w-0">
                                        <span className="font-bold text-slate-200 truncate">
                                          {inc.label}
                                        </span>
                                        <span className="text-slate-500 truncate">{inc.url}</span>
                                        {inc.isWebhookOrSuspicious && (
                                          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[10px]">
                                            Blocked Webhook/Script
                                          </span>
                                        )}
                                      </div>
                                      <div className="shrink-0">
                                        {inc.isWebhookOrSuspicious ? (
                                          <span className="text-[10px] text-rose-400 font-bold">
                                            Quarantined
                                          </span>
                                        ) : alreadyInSot ? (
                                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                            <Check className="w-3 h-3" />
                                            <span>In SOT Links</span>
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handlePromoteIncidentalLinkToSOT(inc, page.id, undefined)
                                            }
                                            className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold flex items-center gap-1"
                                          >
                                            <Plus className="w-3 h-3" />
                                            <span>+ Add to SOT Links List</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB-VIEW 3: SOT WEBLINKS (SINGLE-PAGE HALT & READ-ONLY) */}
              {sotSubView === 'weblinks' && (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-xl border space-y-3 ${
                      isDark ? 'bg-slate-950 border-cyan-500/30' : 'bg-white border-amber-800/25'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="font-mono font-bold text-xs uppercase text-cyan-400">
                          Add Source of Truth Weblink (Opens 1 Page, Halts &amp; Treats as Read-Only)
                        </h4>
                        <p className="text-[11px] font-serif opacity-75">
                          SOT Links never spider or execute embedded scripts/webhooks. Click{' '}
                          <strong>Open 1 Page &amp; Halt (Read-Only)</strong> on any link below to
                          snapshot its sanitized text and inspect incidental links.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs">
                      <input
                        type="text"
                        value={newLinkTitle}
                        onChange={(e) => setNewLinkTitle(e.target.value)}
                        placeholder="Title (e.g. d20PFSRD Paladin, Spheres Wiki)..."
                        className={`md:col-span-4 px-3 py-1.5 rounded border ${
                          isDark ? 'bg-slate-900 border-slate-700' : 'bg-stone-50 border-amber-300'
                        }`}
                      />
                      <input
                        type="text"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className={`md:col-span-5 px-3 py-1.5 rounded border font-mono ${
                          isDark ? 'bg-slate-900 border-slate-700' : 'bg-stone-50 border-amber-300'
                        }`}
                      />
                      <select
                        value={newLinkCategory}
                        onChange={(e) => setNewLinkCategory(e.target.value as SOTCategory)}
                        className={`md:col-span-3 px-2.5 py-1.5 rounded border font-mono ${
                          isDark ? 'bg-slate-900 border-slate-700' : 'bg-stone-50 border-amber-300'
                        }`}
                      >
                        <option value="General Rule">General Rule</option>
                        <option value="Full Class SRD">Full Class SRD</option>
                        <option value="Feat">Feat</option>
                        <option value="Class Ability">Class Ability</option>
                        <option value="Spell">Spell</option>
                        <option value="Power">Power</option>
                        <option value="Archetype">Archetype</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLinkNotes}
                        onChange={(e) => setNewLinkNotes(e.target.value)}
                        placeholder="Optional notes on what the AI should use this link for..."
                        className={`flex-1 px-3 py-1.5 rounded text-xs border ${
                          isDark ? 'bg-slate-900 border-slate-700' : 'bg-stone-50 border-amber-300'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleAddWeblink}
                        className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add SOT Link</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {(sotCatalogue.weblinks || []).map((link) => (
                      <div
                        key={link.id}
                        className={`p-3 rounded-xl border space-y-2 ${
                          isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-amber-800/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs text-cyan-400">
                                {link.title}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
                                {link.category}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                <span>1-Page Halt • Read-Only</span>
                              </span>
                              <span className="text-[11px] font-mono opacity-75 truncate">
                                {link.url}
                              </span>
                            </div>
                            {link.notes && (
                              <p className="text-[11px] font-serif opacity-75 mt-0.5">{link.notes}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleFetchSinglePageReadOnly(link)}
                              disabled={fetchingWeblinkId === link.id}
                              className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 flex items-center gap-1"
                              title="Open this single page, halt spidering, strip scripts/webhooks, and load as Read-Only"
                            >
                              {fetchingWeblinkId === link.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Lock className="w-3 h-3" />
                              )}
                              <span>Open 1 Page &amp; Halt (Read-Only)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleWeblink(link.id)}
                              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold ${
                                link.isActive
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {link.isActive ? 'AI Follows Link' : 'Ignored'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWeblink(link.id)}
                              className="p-1 text-rose-400 hover:bg-rose-500/20 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Single-Page Halted Read-Only Snapshot */}
                        {link.readOnlySnapshot && (
                          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-cyan-500/30 space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300 flex-wrap gap-2">
                              <span>
                                <strong>HALTS AT DEPTH 1 (SINGLE PAGE READ-ONLY):</strong>{' '}
                                {link.title}
                              </span>
                              <span>
                                Stripped {link.readOnlySnapshot.securityAudit.strippedScriptsCount} scripts /{' '}
                                {link.readOnlySnapshot.securityAudit.strippedWebhooksCount} webhooks /{' '}
                                {link.readOnlySnapshot.securityAudit.strippedCodeSnipsCount} code snips
                              </span>
                            </div>
                            <pre className="max-h-32 overflow-y-auto p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-serif whitespace-pre-wrap text-slate-300 select-text">
                              {link.readOnlySnapshot.sanitizedText.slice(0, 1500)}
                            </pre>
                            {link.readOnlySnapshot.incidentalLinks.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-mono text-amber-300 font-bold">
                                  Incidental Links Found on Page (Not SOT unless added):
                                </div>
                                <div className="max-h-28 overflow-y-auto space-y-1">
                                  {link.readOnlySnapshot.incidentalLinks.slice(0, 12).map((inc, idx) => {
                                    const alreadyInSot =
                                      inc.promotedToSOT ||
                                      (sotCatalogue.weblinks || []).some(
                                        (w) => w.url.toLowerCase() === inc.url.toLowerCase()
                                      );
                                    return (
                                      <div
                                        key={`${inc.url}-${idx}`}
                                        className="flex items-center justify-between gap-2 text-[10px] font-mono px-2 py-1 rounded bg-slate-950 border border-slate-800"
                                      >
                                        <span className="truncate text-slate-300">
                                          {inc.label} — <span className="text-slate-500">{inc.url}</span>
                                        </span>
                                        {alreadyInSot ? (
                                          <span className="text-emerald-400 font-bold shrink-0">
                                            In SOT Links
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handlePromoteIncidentalLinkToSOT(inc, undefined, link.id)
                                            }
                                            className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold shrink-0"
                                          >
                                            + Add to SOT Links List
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: JOURNAL SETTINGS (VOICE SAMPLE & ART STYLE PROMPT)         */}
          {/* ================================================================= */}
          {activeTab === 'journal_settings' && (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-amber-500" />
                    <span>Journal Voice Behavior Sample &amp; Art Style Settings</span>
                  </h3>
                  <p className="text-xs opacity-80 font-serif leading-relaxed">
                    Configure how your character writes and illustrates their chronicle. The actual
                    Journal Entry Generator and Pencil Sketch input boxes live directly inside the{' '}
                    <strong>Session Journal</strong> tool when enabled in Module Permissions.
                  </p>
                </div>

                {onOpenJournal && (
                  <button
                    onClick={() => {
                      handleSaveJournalSettings();
                      onClose();
                      onOpenJournal();
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-mono font-bold bg-amber-700 hover:bg-amber-600 text-white shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Save &amp; Open Journal Tool &rarr;</span>
                  </button>
                )}
              </div>

              <div
                className={`p-4 rounded-xl border space-y-4 ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-amber-800/20'
                }`}
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-amber-500 uppercase block">
                    1. Character Voice Tone &amp; Temperament:
                  </label>
                  <input
                    type="text"
                    value={voiceSetting}
                    onChange={(e) => setVoiceSetting(e.target.value)}
                    placeholder="e.g. Terse, serious, no-nonsense, short sentences, gruff veteran..."
                    className={`w-full px-3 py-2 rounded-lg text-xs font-serif border outline-hidden ${
                      isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-stone-50 border-amber-300'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-amber-500 uppercase block">
                    2. Preset Voice Behavior Sample (In-Character Excerpt):
                  </label>
                  <textarea
                    rows={3}
                    value={voiceSampleText}
                    onChange={(e) => setVoiceSampleText(e.target.value)}
                    placeholder="Write a sample sentence or two in your character's voice..."
                    className={`w-full p-3 rounded-lg text-xs font-serif border outline-hidden resize-y ${
                      isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-stone-50 border-amber-300'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-cyan-400 uppercase block">
                    3. Preset Art Style Prompt (Journal Pencil Sketches):
                  </label>
                  <input
                    type="text"
                    value={artStylePrompt}
                    onChange={(e) => setArtStylePrompt(e.target.value)}
                    placeholder="e.g. Graphite cross-hatch on weathered parchment..."
                    className={`w-full px-3 py-2 rounded-lg text-xs font-mono border outline-hidden ${
                      isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-stone-50 border-amber-300'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-cyan-400 uppercase block">
                    4. Default Pencil Sketch Detail Quality:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    {(['crude', 'passible', 'tasteful', 'astounding'] as SketchDetailQuality[]).map(
                      (q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setDefaultSketchQuality(q)}
                          className={`p-2 rounded-lg capitalize border transition-all text-center ${
                            defaultSketchQuality === q
                              ? 'bg-amber-700 text-white border-amber-600 font-bold shadow-xs'
                              : 'bg-black/5 dark:bg-white/5 border-inherit opacity-75 hover:opacity-100'
                          }`}
                        >
                          <div className="font-bold">{q}</div>
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-black/10 dark:border-white/10">
                  {journalSettingsSaved ? (
                    <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      <span>Voice &amp; Art presets saved!</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono opacity-65">
                      Used automatically by the Journal Entry &amp; Sketch generators
                    </span>
                  )}

                  <button
                    onClick={handleSaveJournalSettings}
                    className="px-4 py-2 rounded-lg text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Journal &amp; Art Presets</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: UNIFIED PLAIN TEXT TO MACRO (DSL + BUFF BOX + STEPPER)     */}
          {/* ================================================================= */}
          {activeTab === 'macro' && (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  <span>Plain Text to Macro (Unified DSL, Buff Box &amp; Stepper Generator)</span>
                </h3>
                <p className="text-xs opacity-80 font-serif leading-relaxed">
                  Describe any attack, spell, sustained buff (<code>&lt;^...&gt;</code>), or round
                  countdown in plain English. Respects your saved SOT Override Docs and Module
                  Blind Spots.
                </p>
              </div>

              {permissionWarningMessage && (
                <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/60 text-amber-200 text-xs space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="leading-relaxed font-mono">{permissionWarningMessage}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    <button
                      onClick={() => {
                        handleUpdateSettings({
                          allowedModules: {
                            ...allowedModules,
                            stepper: true,
                            buffBox: true,
                            dslStudio: true,
                          },
                        });
                        setPermissionWarningMessage(null);
                      }}
                      className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[11px]"
                    >
                      Authorize Modules Now
                    </button>
                    <button
                      onClick={() => {
                        setMacroDestination('copy');
                        setPermissionWarningMessage(null);
                        handleGenerateUnifiedMacro(true);
                      }}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[11px]"
                    >
                      Generate for Copy/Paste Only
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-7">
                  <label className="text-xs font-mono font-bold opacity-80 block mb-1">
                    Plain English Rule, Attack, or Buff Request:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Mage Armor +4 enhancement to AC locked once, or Power Attack with greatsword, or Barbarian Rage..."
                    value={macroPrompt}
                    onChange={(e) => setMacroPrompt(e.target.value)}
                    className={`w-full p-3 rounded-lg text-xs font-mono border outline-hidden shadow-inner resize-none ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-white border-amber-300 text-stone-900'
                    }`}
                  />
                </div>

                <div className="md:col-span-5 space-y-2">
                  <label className="text-xs font-mono font-bold text-cyan-400 block">
                    Target Destination (On Run):
                  </label>
                  <select
                    value={macroDestination}
                    onChange={(e) => {
                      setMacroDestination(e.target.value as MacroDestination);
                      setPermissionWarningMessage(null);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-mono font-bold border outline-hidden ${
                      isDark
                        ? 'bg-slate-950 border-cyan-500/50 text-cyan-200'
                        : 'bg-white border-amber-500 text-stone-900'
                    }`}
                  >
                    <option value="copy">Copy / Paste Result Only</option>
                    <option value="buff_box">
                      Send Directly to Buff Box ({allowedModules.buffBox ? 'Authorized' : 'Blind Spot'})
                    </option>
                    <option value="dsl_studio">
                      Send Directly to DSL Studio ({allowedModules.dslStudio ? 'Authorized' : 'Blind Spot'})
                    </option>
                    <option value="stepper">
                      Send Directly to Stepper ({allowedModules.stepper ? 'Authorized' : 'Blind Spot'})
                    </option>
                  </select>

                  <button
                    onClick={() => handleGenerateUnifiedMacro(false)}
                    disabled={isGeneratingMacro || !macroPrompt.trim()}
                    className="w-full px-4 py-2 rounded-lg text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isGeneratingMacro ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Forging Macaroni...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Macro</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {(macroResult || buffResult) && (
                <div
                  className={`p-4 rounded-xl border space-y-4 shadow-sm ${
                    isDark ? 'bg-slate-950 border-cyan-500/40' : 'bg-white border-amber-800/30'
                  }`}
                >
                  {macroSentNotice && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>{macroSentNotice}</span>
                    </div>
                  )}

                  {macroResult && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-cyan-400 uppercase">
                          Macaroni Action / Roll Formula (#{macroResult.name}):
                        </span>
                        <button
                          onClick={() => handleCopyText(macroResult.formula)}
                          className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{macroCopied ? 'Copied!' : 'Copy Formula'}</span>
                        </button>
                      </div>
                      <div
                        className={`p-2.5 rounded-lg font-mono text-xs font-bold border break-all select-all ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-cyan-200'
                            : 'bg-stone-50 border-stone-300 text-stone-900'
                        }`}
                      >
                        {macroResult.formula}
                      </div>
                    </div>
                  )}

                  {buffResult && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono pt-2 border-t border-black/10 dark:border-white/10">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-cyan-400">
                          <span>1. &#123;col:row&#125; Matrix</span>
                          <button
                            onClick={() => handleCopyText(buffResult.coordinateSyntax)}
                            className="underline hover:text-white"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="text-amber-300 font-bold break-all select-all">
                          {buffResult.coordinateSyntax}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-cyan-400">
                          <span>2. Stat.Type Shorthand</span>
                          <button
                            onClick={() => handleCopyText(buffResult.macaroniSyntax)}
                            className="underline hover:text-white"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="text-emerald-300 font-bold break-all select-all">
                          {buffResult.macaroniSyntax}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-cyan-400">
                          <span>3. ALLCAPS Phrase</span>
                          <button
                            onClick={() => handleCopyText(buffResult.allCapsSyntax)}
                            className="underline hover:text-white"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="text-purple-300 font-bold break-all select-all">
                          {buffResult.allCapsSyntax}
                        </div>
                      </div>
                    </div>
                  )}

                  {macroTestOutput && (
                    <div className="p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 font-mono text-xs flex items-center gap-2 text-cyan-200">
                      <Play className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Live Evaluation:</span>
                      <span className="font-bold text-emerald-400">{macroTestOutput}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                    <button
                      onClick={handleTestMacro}
                      className="px-3 py-1.5 rounded text-xs font-mono font-bold bg-emerald-700 hover:bg-emerald-600 text-white flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Test Live</span>
                    </button>
                    <button
                      onClick={() => dispatchMacroToDestination('buff_box')}
                      className="px-3 py-1.5 rounded text-xs font-mono font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Send to Buff Box</span>
                    </button>
                    <button
                      onClick={() => dispatchMacroToDestination('dsl_studio')}
                      className="px-3 py-1.5 rounded text-xs font-mono font-bold bg-cyan-700 hover:bg-cyan-600 text-white flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send to DSL Studio</span>
                    </button>
                    <button
                      onClick={() => dispatchMacroToDestination('stepper')}
                      className="px-3 py-1.5 rounded text-xs font-mono font-bold bg-purple-700 hover:bg-purple-600 text-white flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Send to Stepper</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 5: BROAD SHEET AUTHORITY & BLIND-SPOT ENFORCED INSPECTOR      */}
          {/* ================================================================= */}
          {activeTab === 'fields' && (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-cyan-400" />
                  <span>Broad Sheet Authority &amp; Blind-Spot Enforced Inspector</span>
                </h3>
                <p className="text-xs opacity-75 font-serif leading-relaxed">
                  Command natural language updates across Ability Scores, Level/XP, HP, AC, Saving
                  Throws, Feats, Class Resources, Skills, Conditions, Currency, Inventory, and
                  Notes. Any section placed in the AI&apos;s <strong>Blind Spots</strong> will be
                  blocked automatically.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Set STR to 18, Take 12 damage, Add feat Outflank, Add 5 ranks in Perception, Found 120 gp..."
                    value={fieldInstruction}
                    onChange={(e) => setFieldInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleParseFieldInstruction();
                    }}
                    className={`flex-1 px-3 py-2 rounded text-xs border outline-hidden ${
                      isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-amber-300'
                    }`}
                  />
                  <button
                    onClick={handleParseFieldInstruction}
                    disabled={!fieldInstruction.trim()}
                    className="px-4 py-2 rounded text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition-colors"
                  >
                    Inspect &amp; Propose
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                  {[
                    'Set STR to 18',
                    'Take 14 damage',
                    'Level up',
                    'Add feat Dodge',
                    'Add resource Ki Pool max 5',
                    'Add 4 ranks in Perception',
                    'Become shaken',
                    'Found 250 gp',
                  ].map((cmd) => (
                    <button
                      key={cmd}
                      type="button"
                      onClick={() => setFieldInstruction(cmd)}
                      className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 hover:bg-cyan-500/20"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>

              {proposedActions.length > 0 && (
                <div className="space-y-2">
                  {proposedActions.map((action, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        action.isBlockedByBlindSpot
                          ? 'bg-rose-950/30 border-rose-500/50'
                          : isDark
                          ? 'bg-slate-950 border-cyan-500/30'
                          : 'bg-white border-amber-800/20'
                      }`}
                    >
                      <div>
                        <div
                          className={`text-xs font-mono font-bold flex items-center gap-1.5 ${
                            action.isBlockedByBlindSpot ? 'text-rose-400' : 'text-amber-500'
                          }`}
                        >
                          {action.isBlockedByBlindSpot && <EyeOff className="w-3.5 h-3.5" />}
                          <span>{action.label}</span>
                        </div>
                        <div className="text-xs font-serif opacity-80">{action.details}</div>
                      </div>
                      {action.isBlockedByBlindSpot ? (
                        <button
                          type="button"
                          onClick={() => setActiveTab('permissions')}
                          className="px-3 py-1.5 rounded text-xs font-mono font-bold bg-rose-700 hover:bg-rose-600 text-white shrink-0"
                        >
                          In Blind Spot (Configure)
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApplyAction(action)}
                          className="px-3 py-1.5 rounded text-xs font-mono font-bold bg-emerald-700 hover:bg-emerald-600 text-white shrink-0"
                        >
                          Approve &amp; Apply
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {actionAppliedNotice && (
                <div className="p-3 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Applied to {character.name}&apos;s character sheet!</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
