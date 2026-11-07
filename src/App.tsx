/**
 * Pathfinder 1st Edition Modular Workspace & Character Sheet Application
 *
 * Architecture:
 * - State & Persistence: Managed by `CharacterProvider` (`src/context/CharacterContext.tsx`)
 * - Calculation & Sheet Mapping: Handled by `src/engine/characterIntegration.ts`
 * - `App.tsx` is responsible solely for workspace layout, active sheet switching,
 *   and coordinating modal visibility.
 */

import React, { useState, useEffect } from 'react';
import {
  CharacterProvider,
  useCharacter,
  useOptionalCharacter,
} from './context/CharacterContext';
import { ImageBrowserTargetConfig } from './engine/characterIntegration';
import { FloatingAlertPayload, MacaroniQueryRequest } from './engine/macaroni';

import { WorkspaceHeader } from './components/workspace/WorkspaceHeader';
import { BlueprintSidebar } from './components/workspace/BlueprintSidebar';
import { SheetPage1Core } from './components/sheet/SheetPage1Core';
import { SheetPage2ActionsSkills } from './components/sheet/SheetPage2ActionsSkills';
import { SheetPage3BioStorage } from './components/sheet/SheetPage3BioStorage';
import { SheetPage3SpellsBio } from './components/sheet/SheetPage3SpellsBio';
import { SheetPage4FormulaStudio } from './components/sheet/SheetPage4FormulaStudio';
import { BuffBoxModule } from './components/sheet/BuffBoxModule';
import { PrintSheet } from './components/sheet/PrintSheet';

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
import { CrashRecoveryBanner } from './components/storage/CrashRecoveryBanner';

export interface AppProps {
  readOnly?: boolean;
}

function WorkspaceShell({ isReadOnlyMode }: { isReadOnlyMode: boolean }) {
  const {
    character,
    layout,
    setLayout,
    autosaveState,
    showCrashRecoveredBanner,
    dismissCrashRecoveredBanner,
    installAICompanion,
    applyImageSelection,
    exportStandaloneHTML,
    exportJSON,
    importJSON,
    exportCSV,
  } = useCharacter();

  // Tool & Modal Visibility State
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
  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false);
  const [isImageBrowserOpen, setIsImageBrowserOpen] = useState(false);
  const [imageBrowserConfig, setImageBrowserConfig] = useState<ImageBrowserTargetConfig>({
    targetType: 'profile',
    title: 'Character Profile Picture Browser',
    currentUrl: '',
  });

  // Macaroni Interactive Global Alerts (<TAG"message">) & Decision Queries (<?>)
  const [floatingAlerts, setFloatingAlerts] = useState<FloatingAlertPayload[]>([]);
  const [activeQuery, setActiveQuery] = useState<MacaroniQueryRequest | null>(null);

  useEffect(() => {
    const handleAlert = (e: Event) => {
      const detail = (e as CustomEvent<FloatingAlertPayload>).detail;
      if (detail) {
        setFloatingAlerts((prev) => [...prev, detail]);
      }
    };
    const handleQuery = (e: Event) => {
      const detail = (e as CustomEvent<MacaroniQueryRequest>).detail;
      if (detail) {
        setActiveQuery(detail);
      }
    };

    window.addEventListener('macaroni:alert', handleAlert);
    window.addEventListener('macaroni:query', handleQuery);

    return () => {
      window.removeEventListener('macaroni:alert', handleAlert);
      window.removeEventListener('macaroni:query', handleQuery);
    };
  }, []);

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

  if (isReadOnlyMode) {
    return <PrintSheet isReadOnlySnapshot={true} />;
  }

  if (isPrintViewOpen) {
    return (
      <PrintSheet
        isReadOnlySnapshot={false}
        onExitPrintView={() => setIsPrintViewOpen(false)}
      />
    );
  }

  const handleOpenAITool = (tab: string = 'permissions') => {
    setAiToolInitialTab(tab);
    setIsAIToolOpen(true);
  };

  const handleInstallAITool = () => {
    installAICompanion();
    setAiToolInitialTab('permissions');
    setIsAIToolOpen(true);
  };

  const handleRollFormula = (formula: string) => {
    setDicePresetFormula(formula);
    setIsDiceOpen(true);
  };

  const handleOpenImageBrowser = (config?: Partial<ImageBrowserTargetConfig>) => {
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

  const getFontClass = () => {
    switch (layout.font) {
      case 'times':
        return 'font-serif text-[13px] leading-relaxed';
      case 'cinzel':
        return 'font-serif tracking-tight';
      case 'mono':
        return 'font-mono text-xs';
      case 'sans':
      default:
        return 'font-sans text-xs';
    }
  };

  const getCanvasBgClass = () => {
    switch (layout.theme) {
      case 'blueprint':
        return 'bg-[#08121f] text-cyan-50 bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:24px_24px]';
      case 'mythweavers':
        return 'bg-[#0d0f12] text-slate-100';
      case 'print':
        return 'bg-[#faf7f0] text-stone-900 print:bg-white print:text-black';
      case 'parchment':
      default:
        return 'bg-[#f4efe4] text-[#1c1917]';
    }
  };

  const fontClass = getFontClass();

  return (
    <div
      className={`min-h-screen flex flex-col font-sans ${
        layout.theme === 'blueprint' || layout.theme === 'mythweavers' ? 'dark' : ''
      }`}
    >
      <WorkspaceHeader
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        onOpenImageBrowser={handleOpenImageBrowser}
        onOpenNewSheet={() => setIsNewSheetOpen(true)}
        autosaveState={autosaveState}
      />

      <CrashRecoveryBanner
        visible={showCrashRecoveredBanner}
        onDismiss={dismissCrashRecoveredBanner}
      />

      {/* Hidden PrintSheet rendered automatically if user triggers native Ctrl+P from workspace */}
      <div className="hidden print:block">
        <PrintSheet isReadOnlySnapshot={true} />
      </div>

      {/* Main Workspace Body */}
      <div className="no-print print:hidden flex-1 flex overflow-hidden">
        {!isSidebarCollapsed && (
          <BlueprintSidebar
            onOpenPointBuy={() => setIsPointBuyOpen(true)}
            onOpenDiceRoller={() => setIsDiceOpen(true)}
            onOpenQuickHP={() => setIsQuickHPOpen(true)}
            onOpenBuffBox={() => setIsBuffBoxOpen(true)}
            onOpenConditions={() => setIsConditionsOpen((prev) => !prev)}
            onOpenStepper={() => setIsStepperOpen(true)}
            onOpenDeck={() => setIsDeckOpen(true)}
            onOpenXDX={() => setIsXDXOpen(true)}
            onOpenLoadout={() => setIsLoadoutOpen(true)}
            onOpenAddClass={() => setIsAddClassOpen(true)}
            onOpenCMBt={() => setIsCMBtOpen(true)}
            onOpenJournal={() => setIsJournalOpen(true)}
            onOpenAITool={() => handleOpenAITool('permissions')}
            onOpenCompleteSheet={() => setIsCompleteSheetOpen(true)}
            onInstallAITool={handleInstallAITool}
            onOpenNewSheet={() => setIsNewSheetOpen(true)}
            onOpenImageBrowser={() =>
              handleOpenImageBrowser({
                targetType: 'profile',
                title: 'Image & File Browser (Portraits, Items, Gallery)',
                subtitle:
                  'Browse local files from your computer, choose fantasy items/portraits, or link an image.',
                currentUrl:
                  character.profileData?.avatarUrl || character.characterBio?.portraits?.[0],
              })
            }
            onExportStandaloneHTML={exportStandaloneHTML}
            onExportJSON={exportJSON}
            onImportJSON={importJSON}
            onExportCSV={exportCSV}
            onPrint={() => setIsPrintViewOpen(true)}
          />
        )}

        {/* Center / Main Canvas Viewport */}
        <main
          className={`flex-1 overflow-y-auto p-4 md:p-8 transition-colors duration-200 ${getCanvasBgClass()}`}
        >
          <div className="max-w-6xl mx-auto space-y-6">
            {isConditionsOpen && (
              <div className="mb-4">
                <SheetPage3SpellsBio
                  fontClass={fontClass}
                  visibleModules={{ conditions: true }}
                />
              </div>
            )}

            {layout.showAllSheets ? (
              <div className="space-y-12">
                <section className="border-b border-black/10 dark:border-white/10 pb-8">
                  <div className="mb-3 flex items-center justify-between text-xs font-mono opacity-60 uppercase font-bold">
                    <span>Page 1: Core Combat & Attributes</span>
                    <span>Myth-Weavers Layout Standard</span>
                  </div>
                  <SheetPage1Core
                    fontClass={fontClass}
                    onRollFormula={handleRollFormula}
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
                    fontClass={fontClass}
                    onRollFormula={handleRollFormula}
                  />
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between text-xs font-mono opacity-60 uppercase font-bold">
                    <span>Page 3: Bio, Storage & Downtime</span>
                    <span>Scratchpad, Narrative, Companions & Storage Equipment Matrix</span>
                  </div>
                  <SheetPage3BioStorage
                    fontClass={fontClass}
                    onRollFormula={handleRollFormula}
                  />
                </section>
              </div>
            ) : (
              <div>
                {layout.activeSheet === 1 && (
                  <SheetPage1Core
                    fontClass={fontClass}
                    onRollFormula={handleRollFormula}
                    onOpenCMBt={() => setIsCMBtOpen(true)}
                    onOpenNewSheet={() => setIsNewSheetOpen(true)}
                    onOpenImageBrowser={handleOpenImageBrowser}
                  />
                )}

                {layout.activeSheet === 2 && (
                  <SheetPage2ActionsSkills
                    fontClass={fontClass}
                    onRollFormula={handleRollFormula}
                  />
                )}

                {layout.activeSheet === 3 && (
                  <SheetPage3BioStorage
                    fontClass={fontClass}
                    onRollFormula={handleRollFormula}
                  />
                )}

                {layout.activeSheet === 4 && (
                  <SheetPage4FormulaStudio
                    fontClass={fontClass}
                    onRollFormula={handleRollFormula}
                  />
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating Tools & Modals (consume CharacterContext automatically) */}
      <DiceRollerTray
        isOpen={isDiceOpen}
        onClose={() => setIsDiceOpen(false)}
        presetFormula={dicePresetFormula}
      />

      <PointBuyModal
        isOpen={isPointBuyOpen}
        onClose={() => setIsPointBuyOpen(false)}
      />

      {isQuickHPOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm">
            <QuickHPBar onClose={() => setIsQuickHPOpen(false)} />
          </div>
        </div>
      )}

      {isBuffBoxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <BuffBoxModule
              fontClass={fontClass}
              isToolModal={true}
              onCloseModal={() => setIsBuffBoxOpen(false)}
            />
          </div>
        </div>
      )}

      <StepperTool
        isOpen={isStepperOpen}
        onClose={() => setIsStepperOpen(false)}
        theme={layout.theme}
      />

      <DeckTool
        isOpen={isDeckOpen}
        onClose={() => setIsDeckOpen(false)}
      />

      <XDXTool
        isOpen={isXDXOpen}
        onClose={() => setIsXDXOpen(false)}
      />

      <LoadoutModal
        isOpen={isLoadoutOpen}
        onClose={() => setIsLoadoutOpen(false)}
        onPrint={() => {
          setIsLoadoutOpen(false);
          setIsPrintViewOpen(true);
        }}
        theme={layout.theme}
      />

      <AddClassModal
        isOpen={isAddClassOpen}
        onClose={() => setIsAddClassOpen(false)}
        onOpenAITool={(tab) => handleOpenAITool(tab || 'permissions')}
        theme={layout.theme}
      />

      <CMBTool
        isOpen={isCMBtOpen}
        onClose={() => setIsCMBtOpen(false)}
        theme={layout.theme}
        onRollFormula={handleRollFormula}
      />

      <NewSheetModal
        isOpen={isNewSheetOpen}
        onClose={() => setIsNewSheetOpen(false)}
      />

      <ImageFileBrowserModal
        isOpen={isImageBrowserOpen}
        onClose={() => setIsImageBrowserOpen(false)}
        targetType={imageBrowserConfig.targetType}
        title={imageBrowserConfig.title}
        subtitle={imageBrowserConfig.subtitle}
        itemName={imageBrowserConfig.itemName}
        currentImageUrl={imageBrowserConfig.currentUrl}
        onSelectImage={(url) => applyImageSelection(imageBrowserConfig, url)}
        characterExistingImages={[
          character.profileData?.avatarUrl || '',
          ...(character.characterBio?.portraits || []),
          ...(character.inventory || []).map((i) => i.imageUrl || ''),
        ].filter(Boolean)}
      />

      <JournalModal
        isOpen={isJournalOpen}
        onClose={() => setIsJournalOpen(false)}
        onOpenAITool={(tab) => handleOpenAITool(tab || 'journal_settings')}
        theme={layout.theme}
      />

      <AICompanionModal
        isOpen={isAIToolOpen}
        onClose={() => setIsAIToolOpen(false)}
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

      <CompleteSheetChatWindow
        isOpen={isCompleteSheetOpen}
        onClose={() => setIsCompleteSheetOpen(false)}
        onOpenSOTCatalogue={() => handleOpenAITool('lookup_sot')}
        theme={layout.theme}
      />

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

export default function App({ readOnly: propReadOnly }: AppProps = {}) {
  const existingContext = useOptionalCharacter();
  const isReadOnlyMode =
    Boolean(propReadOnly) ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('readonly') === '1');

  if (existingContext) {
    return <WorkspaceShell isReadOnlyMode={isReadOnlyMode} />;
  }

  return (
    <CharacterProvider isReadOnly={isReadOnlyMode}>
      <WorkspaceShell isReadOnlyMode={isReadOnlyMode} />
    </CharacterProvider>
  );
}
