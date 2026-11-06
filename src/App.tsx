/**
 * Pathfinder 1st Edition Modular Workspace & Character Sheet Application
 * Implements:
 * - Technical Blueprint Workspace Builder
 * - Tabletop Facing Sheet (Parchment Tan & Times New Roman 12 Charcoal Black)
 * - Player-Friendly Custom Formula & Object Engine (DSL)
 * - Automated PF1e Mathematics (Point Buy, AC, Saves, Iterative Attacks, ACP, Encumbrance, Conditions)
 * - Interactive Tools (Dice Tray, Point Buy Allocator, Quick HP Tracker, Condition Debuffs)
 * - Spreadsheet CSV & JSON Persistence
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  FilePlus,
  User,
} from 'lucide-react';

import { PF1Character, WorkspaceLayout, AbilityName } from './types/character';
import { DEFAULT_CHARACTER, createBlankCharacter, syncOddLevelFeats } from './data/defaultCharacter';
import { computeDerivedCharacterStats } from './engine/pf1eMath';
import { DiceRollOutcome } from './engine/formula';

import { BlueprintSidebar } from './components/workspace/BlueprintSidebar';
import { SheetPage1Core } from './components/sheet/SheetPage1Core';
import { SheetPage2ActionsSkills } from './components/sheet/SheetPage2ActionsSkills';
import { SheetPage3BioStorage } from './components/sheet/SheetPage3BioStorage';
import { SheetPage2SkillsGear } from './components/sheet/SheetPage2SkillsGear';
import { SheetPage3SpellsBio } from './components/sheet/SheetPage3SpellsBio';
import { SheetPage4FormulaStudio } from './components/sheet/SheetPage4FormulaStudio';
import { BuffBoxModule } from './components/sheet/BuffBoxModule';

import { DiceRollerTray } from './components/tools/DiceRollerTray';
import { PointBuyModal } from './components/tools/PointBuyModal';
import { QuickHPBar } from './components/tools/QuickHPBar';
import { StepperTool } from './components/tools/StepperTool';
import { DeckTool } from './components/tools/DeckTool';
import { XDXTool } from './components/tools/XDXTool';
import { LoadoutModal } from './components/tools/LoadoutModal';
import { AddClassModal } from './components/tools/AddClassModal';
import { CMBTool } from './components/tools/CMBTool';
import { NewSheetModal } from './components/tools/NewSheetModal';
import { ImageFileBrowserModal } from './components/tools/ImageFileBrowserModal';
import { JournalModal } from './components/tools/JournalModal';
import { AICompanionModal } from './components/tools/AICompanionModal';
import { CompleteSheetChatWindow } from './components/tools/CompleteSheetChatWindow';
import { FloatingAlertCard } from './components/common/FloatingAlertCard';
import { InteractiveQueryModal } from './components/common/InteractiveQueryModal';
import { FloatingAlertPayload, MacaroniQueryRequest } from './engine/macaroni';
import { useStorage } from './storage/StorageContext';
import { useAutosave } from './storage/useAutosave';
import { normalizeCharacter, restoreSheetFromStorage } from './storage/characterState';
import { SaveButton } from './components/storage/SaveButton';
import { CrashRecoveryBanner } from './components/storage/CrashRecoveryBanner';
import { PrintSheet } from './components/sheet/PrintSheet';

const LOCAL_STORAGE_KEY = 'pf1e_character_data_v1';
const LOCAL_STORAGE_LAYOUT_KEY = 'pf1e_workspace_layout_v1';

export interface AppProps {
  readOnly?: boolean;
}

export default function App({ readOnly: propReadOnly }: AppProps = {}) {
  const storage = useStorage();
  const isReadOnlyMode =
    Boolean(propReadOnly) ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('readonly') === '1');
  // Initialize character state from injected window object, localStorage, or default
  const [character, setCharacter] = useState<PF1Character>(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).__INITIAL_CHARACTER__) {
        return normalizeCharacter((window as any).__INITIAL_CHARACTER__);
      }
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return normalizeCharacter(parsed);
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_CHARACTER;
  });

  // Initialize workspace layout
  const [layout, setLayout] = useState<WorkspaceLayout>(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).__INITIAL_LAYOUT__) {
        return (window as any).__INITIAL_LAYOUT__;
      }
      const saved = localStorage.getItem(LOCAL_STORAGE_LAYOUT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            theme: parsed.theme || 'parchment',
            font: parsed.font || 'times',
            activeSheet: parsed.activeSheet >= 1 && parsed.activeSheet <= 4 ? parsed.activeSheet : 1,
            showAllSheets: Boolean(parsed.showAllSheets),
            visibleModules: {
              abilities: true,
              hpAndVitals: true,
              armorClass: true,
              saves: true,
              attacks: true,
              weapons: true,
              armor: true,
              feats: true,
              skills: true,
              inventory: true,
              currency: true,
              languages: true,
              spellMatrix: true,
              spellbook: true,
              conditions: true,
              biography: true,
              profile: true,
              notes: true,
              formulaStudio: true,
              statblock: true,
              buffBox: true,
              ...(parsed.visibleModules || {}),
            },
          };
        }
      }
    } catch {
      // Fallback
    }
    return {
      theme: 'parchment', // Defaults to Parchment Tan per user instruction
      font: 'times', // Defaults to Times New Roman 12 per user instruction
      activeSheet: 1,
      showAllSheets: false,
      visibleModules: {
        abilities: true,
        hpAndVitals: true,
        armorClass: true,
        saves: true,
        attacks: true,
        weapons: true,
        armor: true,
        feats: true,
        skills: true,
        inventory: true,
        currency: true,
        languages: true,
        spellMatrix: true,
        spellbook: true,
        conditions: true,
        biography: true,
        profile: true,
        notes: true,
        formulaStudio: true,
        statblock: true,
        buffBox: true,
      },
    };
  });

  // Tool Modals State
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [dicePresetFormula, setDicePresetFormula] = useState<string>('1d20+7');
  const [isPointBuyOpen, setIsPointBuyOpen] = useState(false);
  const [isQuickHPOpen, setIsQuickHPOpen] = useState(false);
  const [isBuffBoxOpen, setIsBuffBoxOpen] = useState(false);
  const [isConditionsOpen, setIsConditionsOpen] = useState(false);
  const [isStepperOpen, setIsStepperOpen] = useState(false);
  const [isDeckOpen, setIsDeckOpen] = useState(false);
  const [isXDXOpen, setIsXDXOpen] = useState(false);
  const [isLoadoutOpen, setIsLoadoutOpen] = useState(false);
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isCMBtOpen, setIsCMBtOpen] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [isAIToolOpen, setIsAIToolOpen] = useState(false);
  const [isCompleteSheetOpen, setIsCompleteSheetOpen] = useState(false);
  const [aiToolInitialTab, setAiToolInitialTab] = useState<string>('permissions');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);
  const [showCrashRecoveredBanner, setShowCrashRecoveredBanner] = useState(false);

  // Debounced Crash Autosave (~1 second after character changes)
  const autosaveState = useAutosave(character, !isReadOnlyMode);

  const applyLoadedCharacter = (loaded: PF1Character) => {
    setCharacter(normalizeCharacter(loaded));
  };

  // On startup, restore crash recovery or the last deliberately saved character.
  useEffect(() => {
    if (isReadOnlyMode) return;
    let mounted = true;
    restoreSheetFromStorage(storage)
      .then((restored) => {
        if (!mounted || !restored.character) return;
        setCharacter(restored.character);
        setShowCrashRecoveredBanner(restored.recoveredFromCrash);
      })
      .catch(() => {
        // ignore startup restore errors
      });
    return () => {
      mounted = false;
    };
  }, [storage, isReadOnlyMode]);

  // New Sheet & Image File Browser state
  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false);
  const [isImageBrowserOpen, setIsImageBrowserOpen] = useState(false);
  const [imageBrowserConfig, setImageBrowserConfig] = useState<{
    targetType: 'profile' | 'portrait' | 'item';
    title?: string;
    subtitle?: string;
    itemName?: string;
    currentUrl?: string;
    itemId?: string;
  }>({
    targetType: 'profile',
    title: 'Character Profile Picture Browser',
    currentUrl: '',
  });

  // Macaroni Interactive Global Alerts (<TAG"message">) & Decision Queries (<?>)
  const [floatingAlerts, setFloatingAlerts] = useState<FloatingAlertPayload[]>([]);
  const [activeQuery, setActiveQuery] = useState<MacaroniQueryRequest | null>(null);

  useEffect(() => {
    const handleAlert = (e: any) => {
      if (e.detail) {
        setFloatingAlerts((prev) => [...prev, e.detail]);
      }
    };
    const handleQuery = (e: any) => {
      if (e.detail) {
        setActiveQuery(e.detail);
      }
    };

    window.addEventListener('macaroni:alert', handleAlert);
    window.addEventListener('macaroni:query', handleQuery);

    return () => {
      window.removeEventListener('macaroni:alert', handleAlert);
      window.removeEventListener('macaroni:query', handleQuery);
    };
  }, []);

  // Automatically generate a new Feat entry for every odd level (1, 3, 5, 7...) reached
  useEffect(() => {
    setCharacter((prev) => syncOddLevelFeats(prev));
  }, [character.level]);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(character));
    } catch {
      // ignore quota errors
    }
  }, [character]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      // ignore
    }
  }, [layout]);

  // Global Ctrl+X or Escape listener to close all open tools/modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && (e.key === 'x' || e.key === 'X')) || e.key === 'Escape') {
        setIsDiceOpen(false);
        setIsPointBuyOpen(false);
        setIsQuickHPOpen(false);
        setIsBuffBoxOpen(false);
        setIsConditionsOpen(false);
        setIsStepperOpen(false);
        setIsDeckOpen(false);
        setIsXDXOpen(false);
        setIsLoadoutOpen(false);
        setIsAddClassOpen(false);
        setIsCMBtOpen(false);
        setIsNewSheetOpen(false);
        setIsImageBrowserOpen(false);
        setIsJournalOpen(false);
        setIsAIToolOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenJournal = () => setIsJournalOpen(true);
  const handleOpenAITool = (tab: string = 'permissions') => {
    setAiToolInitialTab(tab);
    setIsAIToolOpen(true);
  };
  const handleInstallAITool = () => {
    setCharacter((prev) => ({
      ...prev,
      installedModules: {
        ...prev.installedModules,
        aiCompanion: true,
      },
    }));
    setAiToolInitialTab('permissions');
    setIsAIToolOpen(true);
  };

  // Compute all derived stats automatically
  const derived = computeDerivedCharacterStats(character);

  // Read-only snapshot mode (?readonly=1 or readOnly prop): render PrintSheet-style view with all editing disabled and no save UI
  if (isReadOnlyMode) {
    return (
      <PrintSheet
        character={character}
        derived={derived}
        isReadOnlySnapshot={true}
      />
    );
  }

  // Dedicated Print View mode (replaces single-page clipped print behavior)
  if (isPrintViewOpen) {
    return (
      <PrintSheet
        character={character}
        derived={derived}
        isReadOnlySnapshot={false}
        onExitPrintView={() => setIsPrintViewOpen(false)}
      />
    );
  }

  // Trigger a dice roll with a preset formula
  const handleRollFormula = (formula: string, label?: string) => {
    setDicePresetFormula(formula);
    setIsDiceOpen(true);
  };

  // Open Image File Browser for any target (profile, portrait, or inventory item)
  const handleOpenImageBrowser = (config?: {
    targetType?: 'profile' | 'portrait' | 'item';
    title?: string;
    subtitle?: string;
    itemName?: string;
    currentUrl?: string;
    itemId?: string;
  }) => {
    setImageBrowserConfig({
      targetType: config?.targetType || 'profile',
      title: config?.title || 'Character Profile Picture Browser',
      subtitle: config?.subtitle,
      itemName: config?.itemName,
      currentUrl: config?.currentUrl || '',
      itemId: config?.itemId,
    });
    setIsImageBrowserOpen(true);
  };

  // Callback when an image is chosen in Image File Browser
  const handleSelectImageFromBrowser = (url: string) => {
    if (imageBrowserConfig.targetType === 'profile') {
      setCharacter((prev) => ({
        ...prev,
        profileData: {
          ...(prev.profileData || { customFields: [] }),
          avatarUrl: url,
        },
      }));
    } else if (imageBrowserConfig.targetType === 'portrait') {
      setCharacter((prev) => {
        const currentList = prev.characterBio?.portraits || [];
        const updated = url ? [...currentList.filter((p) => p !== url), url] : currentList;
        return {
          ...prev,
          characterBio: {
            ...(prev.characterBio || { scratchpad: '', bioSections: [] }),
            portraits: updated,
            currentPortraitIndex: Math.max(0, updated.length - 1),
          },
        };
      });
    } else if (imageBrowserConfig.targetType === 'item' && imageBrowserConfig.itemId) {
      setCharacter((prev) => ({
        ...prev,
        inventory: prev.inventory.map((item) =>
          item.id === imageBrowserConfig.itemId ? { ...item, imageUrl: url } : item
        ),
      }));
    }
  };

  // Reset to pristine blank sheet
  const handleConfirmBlankSheet = () => {
    const blank = createBlankCharacter();
    setCharacter(blank);
  };

  // Reset to default iconic Valerius
  const handleConfirmDefaultSheet = () => {
    setCharacter(DEFAULT_CHARACTER);
  };

  // Apply point buy and Level ASI updates
  const handleApplyPointBuy = ({
    bases,
    asi,
  }: {
    bases: Record<AbilityName, number>;
    asi: Record<AbilityName, number>;
  }) => {
    setCharacter((prev) => {
      const updatedAbilities = { ...prev.abilities };
      for (const ab of Object.keys(bases) as AbilityName[]) {
        if (updatedAbilities[ab]) {
          updatedAbilities[ab] = {
            ...updatedAbilities[ab],
            base: bases[ab],
            levelAsiMod: asi[ab] || 0,
          };
        }
      }
      return { ...prev, abilities: updatedAbilities };
    });
  };

  // Export Standalone Single-File HTML bundle
  const [isExportingHTML, setIsExportingHTML] = useState(false);

  const handleExportStandaloneHTML = async () => {
    setIsExportingHTML(true);
    try {
      // Fetch the pre-bundled standalone HTML asset from public directory
      let htmlText = '';
      try {
        const response = await fetch('/pathfinder1e_standalone.html');
        if (response.ok) {
          htmlText = await response.text();
        }
      } catch (e) {
        console.warn('Could not fetch standalone template directly:', e);
      }

      if (!htmlText || !htmlText.includes('<!DOCTYPE html>')) {
        // Fallback: If template not loaded via fetch (e.g. offline file://), create inline bootloader wrapper
        const serializedChar = JSON.stringify(character).replace(/</g, '\\u003c');
        const serializedLayout = JSON.stringify(layout).replace(/</g, '\\u003c');
        htmlText = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${character.name || 'Character'} - Pathfinder 1e Sheet</title>
  <script>
    window.__INITIAL_CHARACTER__ = ${serializedChar};
    window.__INITIAL_LAYOUT__ = ${serializedLayout};
  </script>
</head>
<body>
  ${document.documentElement.outerHTML}
</body>
</html>`;
      } else {
        // Inject the active character and layout into the standalone template
        const injectionScript = `<script>
  window.__INITIAL_CHARACTER__ = ${JSON.stringify(character).replace(/<\/script>/gi, '<\\/script>')};
  window.__INITIAL_LAYOUT__ = ${JSON.stringify(layout).replace(/<\/script>/gi, '<\\/script>')};
</script>`;
        // Insert right after <head>
        if (htmlText.includes('<head>')) {
          htmlText = htmlText.replace('<head>', `<head>\n  ${injectionScript}`);
        } else {
          htmlText = injectionScript + htmlText;
        }
      }

      const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `${(character.name || 'Pathfinder1e_Character').replace(/[^a-zA-Z0-9_-]/g, '_')}_pf1e_sheet.html`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export standalone HTML:', err);
      // Direct snapshot fallback
      const serializedChar = JSON.stringify(character).replace(/</g, '\\u003c');
      const fallbackHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${character.name}</title><script>window.__INITIAL_CHARACTER__=${serializedChar};</script></head><body>${document.documentElement.outerHTML}</body></html>`;
      const blob = new Blob([fallbackHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(character.name || 'Character').replace(/\s+/g, '_')}_pf1e_sheet.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingHTML(false);
    }
  };

  // Export JSON file
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(character, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${character.name.replace(/\s+/g, '_')}_pf1e_sheet.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON file
  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.name && parsed.abilities) {
            setCharacter(parsed);
          } else {
            alert('Invalid character sheet format.');
          }
        } catch {
          alert('Could not parse JSON file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Export CSV formatted index matching the uploaded spreadsheet structure
  const handleExportCSV = () => {
    const lines: string[] = [
      `Name:,${character.name},,,,Race:,${character.race},,,,Space:,5 ft.`,
      `Class:,${character.characterClass},,,,Level:,${character.level},,Size:,${character.size},,Reach:,5 ft.`,
      `Abilities,,Total,Base,Race,Enh,Misc,Mod,,,,Current,Max,Temp`,
      `STR,,${derived.strTotal},${character.abilities.STR.base},${character.abilities.STR.raceMod},${character.abilities.STR.enhMod},${character.abilities.STR.miscMod},${derived.strMod},Hit Points:,${character.hpCurrent},${character.hpTotalMax},${character.hpTemp}`,
      `DEX,,${derived.dexTotal},${character.abilities.DEX.base},${character.abilities.DEX.raceMod},${character.abilities.DEX.enhMod},${character.abilities.DEX.miscMod},${derived.dexMod}`,
      `CON,,${derived.conTotal},${character.abilities.CON.base},${character.abilities.CON.raceMod},${character.abilities.CON.enhMod},${character.abilities.CON.miscMod},${derived.conMod}`,
      `INT,,${derived.intTotal},${character.abilities.INT.base},${character.abilities.INT.raceMod},${character.abilities.INT.enhMod},${character.abilities.INT.miscMod},${derived.intMod}`,
      `WIS,,${derived.wisTotal},${character.abilities.WIS.base},${character.abilities.WIS.raceMod},${character.abilities.WIS.enhMod},${character.abilities.WIS.miscMod},${derived.wisMod}`,
      `CHA,,${derived.chaTotal},${character.abilities.CHA.base},${character.abilities.CHA.raceMod},${character.abilities.CHA.enhMod},${character.abilities.CHA.miscMod},${derived.chaMod}`,
      `Defense,Total,Armor,Shield,Natural,Dex,Deflection,Touch,Flat-Footed`,
      `AC,${derived.acTotal},${derived.armorBonusTotal},${derived.shieldBonusTotal},${character.naturalArmorMod},${derived.effectiveDexModForAC},${character.deflectionMod},${derived.touchAC},${derived.flatFootedAC}`,
      `Saves,Total,Base,Ability,Magic,Misc`,
      `Fortitude,${derived.fortitudeTotal},${character.saves.fortitude.base},${derived.conMod},${character.saves.fortitude.magicMod},${character.saves.fortitude.miscMod}`,
      `Reflex,${derived.reflexTotal},${character.saves.reflex.base},${derived.dexMod},${character.saves.reflex.magicMod},${character.saves.reflex.miscMod}`,
      `Will,${derived.willTotal},${character.saves.will.base},${derived.wisMod},${character.saves.will.magicMod},${character.saves.will.miscMod}`,
      `Combat,BAB,${character.baseAttackBonus},CMB,${derived.cmbTotal},CMD,${derived.cmdTotal},Initiative,${derived.initiativeTotal}`,
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `${character.name.replace(/\s+/g, '_')}_pf1e_sheet.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Determine active font family
  const getFontClass = () => {
    switch (layout.font) {
      case 'times':
        return 'font-serif text-[13px] leading-relaxed'; // Classic Times New Roman 12-13pt feel
      case 'cinzel':
        return 'font-serif tracking-tight';
      case 'mono':
        return 'font-mono text-xs';
      case 'sans':
      default:
        return 'font-sans text-xs';
    }
  };

  // Determine background style of workspace canvas
  const getCanvasBgClass = () => {
    switch (layout.theme) {
      case 'blueprint':
        return 'bg-[#08121f] text-cyan-50 bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:24px_24px]'; // Blueprint grid
      case 'mythweavers':
        return 'bg-[#0d0f12] text-slate-100'; // Dark Myth-Weavers
      case 'print':
        return 'bg-[#faf7f0] text-stone-900 print:bg-white print:text-black';
      case 'parchment':
      default:
        return 'bg-[#f4efe4] text-[#1c1917]'; // Authentic warm parchment tan
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans ${layout.theme === 'blueprint' || layout.theme === 'mythweavers' ? 'dark' : ''}`}>
      {/* Top Bar (Clean 1-row header: identity on left, save & storage on right) */}
      <header className="h-14 bg-slate-950 border-b border-slate-800 text-slate-100 px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 z-20 print:hidden select-none">
        {/* Left: Wordmark & Core Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 transition-colors"
            title="Toggle Blueprint Sidebar"
          >
            <Layers className="w-4 h-4" />
          </button>
          <span className="font-serif font-black tracking-tight text-amber-300 text-sm md:text-base whitespace-nowrap">
            Pathfinder 1e <span className="font-sans font-light text-slate-400 text-xs hidden sm:inline">| Modular Workspace</span>
          </span>

          {/* Profile Picture thumbnail / button */}
          <button
            onClick={() =>
              handleOpenImageBrowser({
                targetType: 'profile',
                title: 'Character Profile Picture Browser',
                subtitle: 'Choose an avatar from local files, fantasy portraits, or enter an image URL.',
                currentUrl: character.profileData?.avatarUrl || character.characterBio?.portraits?.[0],
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
            onClick={() => setIsNewSheetOpen(true)}
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
              applyLoadedCharacter(loaded);
              setShowCrashRecoveredBanner(Boolean(meta?.recoveredFromCrash));
            }}
          />
        </div>
      </header>

      {/* Startup Crash Recovery Banner */}
      <CrashRecoveryBanner
        visible={showCrashRecoveredBanner}
        onDismiss={() => {
          setShowCrashRecoveredBanner(false);
          void storage.dismissCrash();
        }}
      />

      {/* Hidden PrintSheet rendered automatically if user triggers native Ctrl+P from workspace */}
      <div className="hidden print:block">
        <PrintSheet character={character} derived={derived} isReadOnlySnapshot={true} />
      </div>

      {/* Main Workspace Body */}
      <div className="no-print print:hidden flex-1 flex overflow-hidden">
        {/* Left Modular Blueprint Sidebar (Matches user's wireframe) */}
        {!isSidebarCollapsed && (
          <BlueprintSidebar
            layout={layout}
            onUpdateLayout={(updates) => setLayout((prev) => ({ ...prev, ...updates }))}
            character={character}
            onOpenPointBuy={() => setIsPointBuyOpen(true)}
            onOpenDiceRoller={() => setIsDiceOpen(true)}
            onOpenQuickHP={() => setIsQuickHPOpen(true)}
            onOpenBuffBox={() => setIsBuffBoxOpen(true)}
            onOpenConditions={() => setIsConditionsOpen(!isConditionsOpen)}
            onOpenStepper={() => setIsStepperOpen(true)}
            onOpenDeck={() => setIsDeckOpen(true)}
            onOpenXDX={() => setIsXDXOpen(true)}
            onOpenLoadout={() => setIsLoadoutOpen(true)}
            onOpenAddClass={() => setIsAddClassOpen(true)}
            onOpenCMBt={() => setIsCMBtOpen(true)}
            onOpenJournal={handleOpenJournal}
            onOpenAITool={() => handleOpenAITool('permissions')}
            onOpenCompleteSheet={() => setIsCompleteSheetOpen(true)}
            onInstallAITool={handleInstallAITool}
            onOpenNewSheet={() => setIsNewSheetOpen(true)}
            onOpenImageBrowser={() =>
              handleOpenImageBrowser({
                targetType: 'profile',
                title: 'Image & File Browser (Portraits, Items, Gallery)',
                subtitle: 'Browse local files from your computer, choose fantasy items/portraits, or link an image.',
                currentUrl: character.profileData?.avatarUrl || character.characterBio?.portraits?.[0],
              })
            }
            onExportStandaloneHTML={handleExportStandaloneHTML}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onExportCSV={handleExportCSV}
            onPrint={() => setIsPrintViewOpen(true)}
          />
        )}

        {/* Center / Main Canvas Viewport */}
        <main className={`flex-1 overflow-y-auto p-4 md:p-8 transition-colors duration-200 ${getCanvasBgClass()}`}>
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Quick condition debuff notification if active */}
            {isConditionsOpen && (
              <div className="mb-4">
                <SheetPage3SpellsBio
                  character={character}
                  derived={derived}
                  theme={layout.theme}
                  fontClass={getFontClass()}
                  onUpdateCharacter={setCharacter}
                  visibleModules={{ conditions: true }}
                />
              </div>
            )}

            {/* Render Active Pages based on Viewport State */}
            {layout.showAllSheets ? (
              // All 3 Standard Pages Layout (Tablet / Tabletop facing mode)
              <div className="space-y-12">
                <section className="border-b border-black/10 dark:border-white/10 pb-8">
                  <div className="mb-3 flex items-center justify-between text-xs font-mono opacity-60 uppercase font-bold">
                    <span>Page 1: Core Combat & Attributes</span>
                    <span>Myth-Weavers Layout Standard</span>
                  </div>
                  <SheetPage1Core
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                    onOpenCMBt={() => setIsCMBtOpen(true)}
                    onOpenNewSheet={() => setIsNewSheetOpen(true)}
                    onOpenImageBrowser={handleOpenImageBrowser}
                  />
                </section>

                <section className="border-b border-black/10 dark:border-white/10 pb-8">
                  <div className="mb-3 flex items-center justify-between text-xs font-mono opacity-60 uppercase font-bold">
                    <span>Page 2: Actions & Skills</span>
                    <span>Action Command Center, Resource Pools & Skills Matrix</span>
                  </div>
                  <SheetPage2ActionsSkills
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                  />
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between text-xs font-mono opacity-60 uppercase font-bold">
                    <span>Page 3: Bio, Storage & Downtime</span>
                    <span>Scratchpad, Narrative, Companions & Storage Equipment Matrix</span>
                  </div>
                  <SheetPage3BioStorage
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                  />
                </section>
              </div>
            ) : (
              // Single Selected Tab View
              <div>
                {layout.activeSheet === 1 && (
                  <SheetPage1Core
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                    onOpenCMBt={() => setIsCMBtOpen(true)}
                    onOpenNewSheet={() => setIsNewSheetOpen(true)}
                    onOpenImageBrowser={handleOpenImageBrowser}
                  />
                )}

                {layout.activeSheet === 2 && (
                  <SheetPage2ActionsSkills
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                  />
                )}

                {layout.activeSheet === 3 && (
                  <SheetPage3BioStorage
                    character={character}
                    derived={derived}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                    visibleModules={layout.visibleModules}
                  />
                )}

                {layout.activeSheet === 4 && (
                  <SheetPage4FormulaStudio
                    character={character}
                    theme={layout.theme}
                    fontClass={getFontClass()}
                    onUpdateCharacter={setCharacter}
                    onRollFormula={handleRollFormula}
                  />
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating Tools & Modals */}
      <DiceRollerTray
        isOpen={isDiceOpen}
        onClose={() => setIsDiceOpen(false)}
        presetFormula={dicePresetFormula}
      />

      <PointBuyModal
        isOpen={isPointBuyOpen}
        onClose={() => setIsPointBuyOpen(false)}
        character={character}
        onApplyBaseScores={handleApplyPointBuy}
      />

      {isQuickHPOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm">
            <QuickHPBar
              character={character}
              hpStatus={derived.hpStatus}
              onClose={() => setIsQuickHPOpen(false)}
              onUpdateHP={(updates) => setCharacter((prev) => ({ ...prev, ...updates }))}
            />
          </div>
        </div>
      )}

      {isBuffBoxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <BuffBoxModule
              buffBox={character.buffBox}
              customBuffs={character.customBuffs}
              onUpdateBuffBox={(newBox) =>
                setCharacter((prev) => ({ ...prev, buffBox: newBox }))
              }
              onUpdateCustomBuffs={(newBuffs) =>
                setCharacter((prev) => {
                  const itemActiveMap = new Map<string, boolean>();
                  newBuffs.forEach((b) => {
                    if (b.itemId) itemActiveMap.set(b.itemId, b.isActive);
                  });
                  const updatedInventory = (prev.inventory || []).map((item) => {
                    if (itemActiveMap.has(item.id)) {
                      return { ...item, buffActive: itemActiveMap.get(item.id), hasBuff: true };
                    }
                    return item;
                  });
                  return { ...prev, customBuffs: newBuffs, inventory: updatedInventory };
                })
              }
              theme={layout.theme}
              fontClass={getFontClass()}
              isToolModal={true}
              onCloseModal={() => setIsBuffBoxOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Stepper Tool Modal */}
      <StepperTool
        isOpen={isStepperOpen}
        onClose={() => setIsStepperOpen(false)}
        character={character}
        derived={derived}
        onUpdateCharacter={setCharacter}
        theme={layout.theme}
      />

      {/* Deck Simulator Tool Modal */}
      <DeckTool
        isOpen={isDeckOpen}
        onClose={() => setIsDeckOpen(false)}
        character={character}
        onUpdateCharacter={setCharacter}
      />

      {/* XDX Compact Macro Center Tool Modal */}
      <XDXTool
        isOpen={isXDXOpen}
        onClose={() => setIsXDXOpen(false)}
        character={character}
        derived={derived}
        onUpdateCharacter={setCharacter}
      />

      {/* Loadout Sectional Save/Load Modal */}
      <LoadoutModal
        isOpen={isLoadoutOpen}
        onClose={() => setIsLoadoutOpen(false)}
        character={character}
        onUpdateCharacter={setCharacter}
        onExportCSV={handleExportCSV}
        onPrint={() => {
          setIsLoadoutOpen(false);
          setIsPrintViewOpen(true);
        }}
        theme={layout.theme}
      />

      {/* Add Class Progression Grid & Auto Level-Up Modal */}
      <AddClassModal
        isOpen={isAddClassOpen}
        onClose={() => setIsAddClassOpen(false)}
        character={character}
        onUpdateCharacter={setCharacter}
        onOpenAITool={(tab) => handleOpenAITool(tab || 'permissions')}
        theme={layout.theme}
      />

      {/* CMBt - Combat Maneuver & Grapple Track Tool */}
      <CMBTool
        isOpen={isCMBtOpen}
        onClose={() => setIsCMBtOpen(false)}
        character={character}
        derived={derived}
        theme={layout.theme}
        onUpdateCharacter={setCharacter}
        onRollFormula={handleRollFormula}
      />

      {/* Start New Sheet / Clear All Confirmation Modal */}
      <NewSheetModal
        isOpen={isNewSheetOpen}
        onClose={() => setIsNewSheetOpen(false)}
        onConfirmBlank={handleConfirmBlankSheet}
        onConfirmDefault={handleConfirmDefaultSheet}
        onExportBackup={handleExportJSON}
        characterName={character.name}
      />

      {/* Universal Image & File Browser Modal (Portraits, Avatars, Gear Art) */}
      <ImageFileBrowserModal
        isOpen={isImageBrowserOpen}
        onClose={() => setIsImageBrowserOpen(false)}
        targetType={imageBrowserConfig.targetType}
        title={imageBrowserConfig.title}
        subtitle={imageBrowserConfig.subtitle}
        itemName={imageBrowserConfig.itemName}
        currentImageUrl={imageBrowserConfig.currentUrl}
        onSelectImage={handleSelectImageFromBrowser}
        characterExistingImages={[
          character.profileData?.avatarUrl || '',
          ...(character.characterBio?.portraits || []),
          ...(character.inventory || []).map((i) => i.imageUrl || ''),
        ].filter(Boolean)}
      />

      {/* Session Journal & Chronicle Modal */}
      <JournalModal
        isOpen={isJournalOpen}
        onClose={() => setIsJournalOpen(false)}
        character={character}
        onUpdateCharacter={(updater) => setCharacter((prev) => updater(prev))}
        onOpenAITool={(tab) => handleOpenAITool(tab || 'journal_settings')}
        theme={layout.theme}
      />

      {/* Standalone AI Companion Module Modal */}
      <AICompanionModal
        isOpen={isAIToolOpen}
        onClose={() => setIsAIToolOpen(false)}
        character={character}
        onUpdateCharacter={(updater) => setCharacter((prev) => updater(prev))}
        onOpenJournal={() => setIsJournalOpen(true)}
        onOpenAddClass={() => setIsAddClassOpen(true)}
        onOpenBuffBox={() => setIsBuffBoxOpen(true)}
        onOpenStepper={() => setIsStepperOpen(true)}
        onNavigateToDSLPage={() => {
          setLayout((prev) => ({ ...prev, activeSheet: 4, showAllSheets: false }));
        }}
        onOpenCompleteSheet={() => setIsCompleteSheetOpen(true)}
        initialTab={aiToolInitialTab as any}
        theme={layout.theme}
      />

      {/* Floating Draggable AI Complete Sheet Mini-Window */}
      <CompleteSheetChatWindow
        isOpen={isCompleteSheetOpen}
        onClose={() => setIsCompleteSheetOpen(false)}
        character={character}
        onUpdateCharacter={(updater) => setCharacter((prev) => updater(prev))}
        onOpenSOTCatalogue={() => handleOpenAITool('lookup_sot')}
        theme={layout.theme}
      />

      {/* Macaroni Floating Alert Cards (<TAG"message">) */}
      {floatingAlerts.map((alert) => (
        <FloatingAlertCard
          key={alert.id}
          message={alert.message}
          preset={alert.preset}
          tag={alert.tag}
          onDismiss={() => {
            setFloatingAlerts((prev) => prev.filter((a) => a.id !== alert.id));
          }}
        />
      ))}

      {/* Macaroni Interactive Decision Query Modal (<?>) */}
      {activeQuery && (
        <InteractiveQueryModal
          query={{
            ...activeQuery,
            onSelect: (val) => {
              activeQuery.onSelect(val);
              setActiveQuery(null);
            },
            onCancel: () => {
              activeQuery.onCancel?.();
              setActiveQuery(null);
            },
          }}
        />
      )}
    </div>
  );
}

