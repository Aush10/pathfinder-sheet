import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Zap,
  FileSpreadsheet,
  Split,
  Layers,
  Table,
  Send,
} from 'lucide-react';
import {
  PF1Character,
  CustomClassGrid,
  ClassGridRow,
  CareerProgressionData,
  ArchetypeConfig,
  CharacterActionItem,
  ResourceTracker,
} from '../../types/character';
import {
  calculateCareerProgression,
  CalculatedCareerResult,
} from '../../engine/multiclassCalculator';
import {
  parseSrdSkillsAndProficiencies,
  adaptArchetypeIntoGrid,
  DEFAULT_AI_MODULE_SETTINGS,
  DEFAULT_SOT_CATALOGUE,
  getSessionApiKey,
} from '../../engine/aiService';
import {
  extractClassFromSrdDoc,
  loadAllHostDeviceSrdDocs,
} from '../../engine/sotEngine';
import { AppleEyeIcon } from '../common/AppleEyeIcon';
import { useCharacter } from '../../context/CharacterContext';
import { applyCareerProgressionToCharacter } from '../../engine/characterIntegration';

export interface ClassArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  character?: PF1Character;
  onUpdateCharacter?: (updater: (prev: PF1Character) => PF1Character) => void;
  onOpenAITool?: (initialTab?: string) => void;
  theme?: string;
}

// Robust line-by-line parser for PF1e progression grids (supports tabs, pipes, spaces)
export function parseClassProgressionGrid(raw: string): ClassGridRow[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ClassGridRow[] = [];

  for (const line of lines) {
    if (/^(level|lvl|bab|base attack|hd)/i.test(line)) continue;

    let parts: string[] = [];
    if (line.includes('\t')) {
      parts = line.split('\t').map((p) => p.trim()).filter((p) => p !== '');
    } else if (line.includes('|')) {
      parts = line.split('|').map((p) => p.trim()).filter((p) => p !== '');
    } else {
      const matched = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)$/);
      if (matched) {
        parts = [matched[1], matched[2], matched[3], matched[4], matched[5], matched[6]];
      } else {
        parts = line.split(/\s+/);
      }
    }

    if (parts.length >= 5) {
      const levelMatch = parts[0].match(/\d+/);
      if (!levelMatch) continue;
      const level = parseInt(levelMatch[0], 10);

      const babStr = parts[1];
      const primaryBabMatch = babStr.match(/[+-]?\d+/);
      const bab = primaryBabMatch ? Math.abs(parseInt(primaryBabMatch[0], 10)) : level;

      const parseSave = (s: string) => {
        const m = s.match(/[+-]?\d+/);
        return m ? parseInt(m[0], 10) : 0;
      };

      const fort = parseSave(parts[2]);
      const ref = parseSave(parts[3]);
      const will = parseSave(parts[4]);
      const special = parts.slice(5).join(' ').trim() || '—';

      rows.push({
        level,
        bab,
        babString: babStr.startsWith('+') ? babStr : `+${babStr}`,
        fort,
        ref,
        will,
        special,
      });
    }
  }

  return rows.sort((a, b) => a.level - b.level);
}

// Generate default 1-20 progression skeleton based on BAB and Save progression
export function generateProgressionSkeleton(
  babProgression: 'full' | '3/4' | '1/2',
  goodFort: boolean,
  goodRef: boolean,
  goodWill: boolean
): ClassGridRow[] {
  const rows: ClassGridRow[] = [];

  const calcBab = (lvl: number): { bab: number; str: string } => {
    let b = 0;
    if (babProgression === 'full') b = lvl;
    else if (babProgression === '3/4') b = Math.floor((lvl * 3) / 4);
    else b = Math.floor(lvl / 2);

    const attacks: number[] = [b];
    let iter = b - 5;
    while (iter > 0) {
      attacks.push(iter);
      iter -= 5;
    }
    const str = attacks.map((a) => `+${a}`).join('/');
    return { bab: b, str };
  };

  const calcSave = (lvl: number, isGood: boolean): number => {
    return isGood ? Math.floor(2 + lvl / 2) : Math.floor(lvl / 3);
  };

  for (let lvl = 1; lvl <= 20; lvl++) {
    const { bab, str } = calcBab(lvl);
    rows.push({
      level: lvl,
      bab,
      babString: str,
      fort: calcSave(lvl, goodFort),
      ref: calcSave(lvl, goodRef),
      will: calcSave(lvl, goodWill),
      special: '—',
    });
  }

  return rows;
}

export const ClassArchitectModal: React.FC<ClassArchitectModalProps> = ({
  isOpen,
  onClose,
  character: propCharacter,
  onUpdateCharacter: propOnUpdateCharacter,
  onOpenAITool,
  theme: propTheme,
}) => {
  const ctx = useCharacter();
  const character = propCharacter ?? ctx.character;
  const onUpdateCharacter = propOnUpdateCharacter ?? ctx.updateCharacter;
  const theme = propTheme ?? ctx.layout.theme;

  // Existing custom class grids (default empty or fallback)
  const classGrids: Record<string, CustomClassGrid> = character.customClassGrids || {};

  // Active Class Tab
  const [activeClassId, setActiveClassId] = useState<string>(() => {
    const keys = Object.keys(classGrids);
    return keys.length > 0 ? keys[0] : 'class1';
  });

  // Fallback / current class object
  const currentClass: CustomClassGrid = classGrids[activeClassId] || {
    id: activeClassId,
    className: 'My class',
    level: 1,
    hitDie: 8,
    skillPointsPerLevel: 4,
    proficiencies: '',
    classSkillsText: '',
    rawText: '',
    rows: [],
  };

  // Career progression state
  const careerData: CareerProgressionData = character.careerData || {
    mode: 'standard',
    useFractionalBab: false,
    useFractionalSaves: false,
    levels: Array.from({ length: Math.max(1, character.level) }, (_, i) => ({
      level: i + 1,
      primaryClassId: activeClassId,
      primaryClassLevel: i + 1,
      isGestalt: false,
      gestaltClassId: 'class2',
      gestaltClassLevel: i + 1,
      favoredClassBonus: 'hp',
    })),
    archetypes: [],
    variantMulticlassing: {
      enabled: false,
      secondaryClass: 'Wizard',
    },
    thirdPartySupport: {
      pathOfWarEnabled: false,
      spheresEnabled: false,
    },
  };

  // Live Career Calculations
  const careerResult: CalculatedCareerResult = useMemo(() => {
    return calculateCareerProgression(character, careerData);
  }, [character, careerData]);

  // AI settings
  const aiSettings = character.installedModules?.aiSettings || DEFAULT_AI_MODULE_SETTINGS;
  const isAIActive = aiSettings.allowedModules?.addClass !== false;

  // Local UI states
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isPasteGridOpen, setIsPasteGridOpen] = useState(false);
  const [pasteGridBuffer, setPasteGridBuffer] = useState('');
  const [isSotPickerOpen, setIsSotPickerOpen] = useState(false);
  const [isSendDirectoryOpen, setIsSendDirectoryOpen] = useState(false);
  const [selectedFeatureForDirectory, setSelectedFeatureForDirectory] = useState<string>('');
  const [directoryTargetType, setDirectoryTargetType] = useState<'action' | 'resource'>('resource');
  const [directoryPoolMax, setDirectoryPoolMax] = useState<number>(3);
  const [directoryActionType, setDirectoryActionType] = useState<CharacterActionItem['actionType']>('Standard');

  // Archetype Adapter
  const [archetypeInput, setArchetypeInput] = useState('');
  const [isAdaptingArchetype, setIsAdaptingArchetype] = useState(false);

  // Selected cell for direct editing in grid
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; col: keyof ClassGridRow } | null>(null);
  const [editingCellValue, setEditingCellValue] = useState<string>('');

  // SOT Documents list
  const sotDocs = useMemo(() => {
    const baseDocs = character.sotCatalogue?.overridePages || DEFAULT_SOT_CATALOGUE.overridePages || [];
    const hostDocs = loadAllHostDeviceSrdDocs();
    const combined = [...baseDocs];
    for (const h of hostDocs) {
      if (!combined.some((b) => b.id === h.id)) {
        combined.push(h);
      }
    }
    return combined;
  }, [character.sotCatalogue?.overridePages]);

  if (!isOpen) return null;

  // Update current class
  const updateCurrentClass = (updates: Partial<CustomClassGrid>) => {
    onUpdateCharacter((prev) => {
      const existing = prev.customClassGrids || classGrids;
      return {
        ...prev,
        customClassGrids: {
          ...existing,
          [activeClassId]: {
            ...currentClass,
            ...updates,
          },
        },
      };
    });
  };

  // Update career data
  const updateCareerData = (updates: Partial<CareerProgressionData>) => {
    onUpdateCharacter((prev) => ({
      ...prev,
      careerData: {
        ...(prev.careerData || careerData),
        ...updates,
      },
    }));
  };

  // Add new class
  const handleAddNewClass = () => {
    const nextNum = Object.keys(classGrids).length + 1;
    const newId = `class${nextNum}`;
    const newGrid: CustomClassGrid = {
      id: newId,
      className: `Class ${nextNum}`,
      level: 1,
      hitDie: 8,
      skillPointsPerLevel: 4,
      proficiencies: 'Simple weapons, light armor.',
      classSkillsText: '',
      rawText: '',
      rows: generateProgressionSkeleton('3/4', false, false, true),
    };
    onUpdateCharacter((prev) => ({
      ...prev,
      customClassGrids: {
        ...(prev.customClassGrids || classGrids),
        [newId]: newGrid,
      },
    }));
    setActiveClassId(newId);
  };

  // Delete current class (if more than 1)
  const handleDeleteClass = (cid: string) => {
    const keys = Object.keys(classGrids);
    if (keys.length <= 1) return;
    const nextKeys = keys.filter((k) => k !== cid);
    const updated = { ...classGrids };
    delete updated[cid];

    onUpdateCharacter((prev) => ({
      ...prev,
      customClassGrids: updated,
    }));
    setActiveClassId(nextKeys[0]);
  };

  // Apply career stats to sheet
  const handleSyncCareerToSheet = () => {
    onUpdateCharacter((prev) => applyCareerProgressionToCharacter(prev, careerData).updatedCharacter);
    setSuccessMessage(
      `Synced Career to Sheet! Level: ${careerResult.totalLevel} (${careerResult.classSummaryTitle}), BAB: ${careerResult.babString}, HP: ${careerResult.totalHp} (${careerResult.hitDiceString}), Saves: Fort +${careerResult.fortBase} / Ref +${careerResult.refBase} / Will +${careerResult.willBase}.`
    );
  };

  // Add Kit: Expand HD, mark skills, register proficiencies
  const handleAddKit = () => {
    const autoParsed = isAIActive
      ? parseSrdSkillsAndProficiencies(
          `${currentClass.proficiencies || ''}\n${currentClass.classSkillsText || ''}`
        )
      : null;

    const effectiveProfs =
      autoParsed?.cleanedProficiencies || currentClass.proficiencies;
    const effectiveSkillsRaw =
      autoParsed && autoParsed.cleanedSkillsList.length > 0
        ? autoParsed.cleanedSkillsText
        : currentClass.classSkillsText || '';

    onUpdateCharacter((prev) => {
      // 1. Proficiencies -> Feats and Abilities
      const updatedFeats = [...(prev.featsAndAbilities || [])];
      if (effectiveProfs && effectiveProfs.trim()) {
        const profTitle = `[${currentClass.className} Proficiencies] ${effectiveProfs.trim()}`;
        if (!updatedFeats.some((f) => f.toLowerCase().includes(currentClass.className.toLowerCase() + ' proficiencies'))) {
          updatedFeats.push(profTitle);
        }
      }

      // 2. Class Skills -> Mark isClassSkill = true
      const rawSkills = effectiveSkillsRaw;
      const skillTokens = rawSkills
        .split(/[,\n;]+/)
        .map((s) => s.replace(/\([a-zA-Z]+\)/g, '').trim().toLowerCase())
        .filter((s) => s.length >= 3);

      let newlyUnlocked = 0;
      const updatedSkills = (prev.skills || []).map((sk) => {
        const sName = sk.name.toLowerCase();
        const matches = skillTokens.some((tok) => {
          return sName === tok || sName.startsWith(tok) || tok === sName.replace(/\s*\([^)]+\)/, '');
        });
        if (matches) {
          if (!sk.isClassSkill) newlyUnlocked++;
          return { ...sk, isClassSkill: true };
        }
        return sk;
      });

      // 3. Multi-class Hit Dice / HP expansion
      const existingClasses =
        prev.classes && prev.classes.length > 0
          ? [...prev.classes]
          : [
              {
                id: 'class1',
                name: prev.characterClass || 'Fighter',
                level: prev.level || 1,
                hitDie: prev.hpBreakdown?.hitDiceSize || 10,
                skillPointsPerLevel: prev.classSkillPointsPerLevel || 2,
                babProgression: 'full' as const,
                isFavoredClass: true,
              },
            ];

      const classIdx = existingClasses.findIndex(
        (c) => c.id === currentClass.id || c.name.toLowerCase() === currentClass.className.toLowerCase()
      );
      const classLvl = currentClass.level || 1;
      const classHd = currentClass.hitDie || 10;
      const classSp = currentClass.skillPointsPerLevel || 2;

      if (classIdx >= 0) {
        existingClasses[classIdx] = {
          ...existingClasses[classIdx],
          name: currentClass.className,
          level: classLvl,
          hitDie: classHd,
          skillPointsPerLevel: classSp,
        };
      } else {
        existingClasses.push({
          id: currentClass.id,
          name: currentClass.className,
          level: classLvl,
          hitDie: classHd,
          skillPointsPerLevel: classSp,
          babProgression: 'full',
          isFavoredClass: false,
        });
      }

      const totalCombinedLevel = existingClasses.reduce((sum, c) => sum + (c.level || 1), 0);
      const expandedHitDiceString = existingClasses.map((c) => `${c.level}d${c.hitDie}`).join(' + ');

      let baseMultiHp = 0;
      let isFirstOverall = true;
      existingClasses.forEach((c) => {
        for (let l = 1; l <= c.level; l++) {
          if (isFirstOverall) {
            baseMultiHp += c.hitDie;
            isFirstOverall = false;
          } else {
            baseMultiHp += Math.floor(c.hitDie / 2) + 1;
          }
        }
      });

      const conScore =
        (prev.abilities?.CON?.base || 10) +
        (prev.abilities?.CON?.raceMod || 0) +
        (prev.abilities?.CON?.levelAsiMod || 0) +
        (prev.abilities?.CON?.miscMod || 0) +
        (prev.abilities?.CON?.enhMod || 0) +
        (prev.abilities?.CON?.tempMod || 0);
      const conMod = Math.floor((conScore - 10) / 2);
      const conHp = conMod * totalCombinedLevel;
      const additionalHpSum = (prev.hpBreakdown?.additionalBonuses || []).reduce(
        (acc, b) => acc + (b.amount || 0),
        0
      );
      const newTotalMaxHp = Math.max(1, baseMultiHp + conHp + additionalHpSum);

      const classSummaryTitle = existingClasses.map((c) => `${c.name} ${c.level}`).join(' / ');

      return {
        ...prev,
        characterClass: classSummaryTitle,
        level: totalCombinedLevel,
        classes: existingClasses,
        hitDice: expandedHitDiceString,
        hpTotalMax: newTotalMaxHp,
        hpCurrent: Math.min(newTotalMaxHp, prev.hpCurrent + Math.max(0, newTotalMaxHp - prev.hpTotalMax)),
        hpBreakdown: {
          hitDiceCount: totalCombinedLevel,
          hitDiceSize: existingClasses[0]?.hitDie || 10,
          hitDiceRolledBase: baseMultiHp,
          additionalBonuses: prev.hpBreakdown?.additionalBonuses || [],
          calcMethod: prev.hpBreakdown?.calcMethod || 'average',
        },
        featsAndAbilities: updatedFeats,
        skills: updatedSkills,
        customClassGrids: {
          ...(prev.customClassGrids || {}),
          [currentClass.id]: currentClass,
        },
      };
    });

    setSuccessMessage(
      `Added Kit for ${currentClass.className}! Registered proficiencies, expanded Hit Dice (d${currentClass.hitDie}), and marked class skills.`
    );
  };

  // AI Clean SRD Text
  const handleRecognizeSrd = () => {
    const combined = `${currentClass.proficiencies || ''}\n${currentClass.classSkillsText || ''}`;
    const parsed = parseSrdSkillsAndProficiencies(combined);

    const updates: Partial<CustomClassGrid> = {};
    if (parsed.cleanedSkillsList.length > 0) {
      updates.classSkillsText = parsed.cleanedSkillsText;
    }
    if (parsed.cleanedProficiencies) {
      updates.proficiencies = parsed.cleanedProficiencies;
    }
    if (parsed.detectedHitDie) {
      updates.hitDie = parsed.detectedHitDie;
    }
    if (parsed.detectedSkillRanksPerLevel) {
      updates.skillPointsPerLevel = parsed.detectedSkillRanksPerLevel;
    }

    updateCurrentClass(updates);
    setNoticeMessage(
      `AI Recognized ${parsed.cleanedSkillsList.length} class skills, ${parsed.detectedSkillRanksPerLevel || currentClass.skillPointsPerLevel} + INT ranks, d${parsed.detectedHitDie || currentClass.hitDie} HD, and cleaned non-field prose.`
    );
  };

  // Populate from SOT SRD Document
  const handlePopulateFromSot = (docId: string) => {
    const doc = sotDocs.find((d) => d.id === docId);
    if (!doc) return;

    const extracted = extractClassFromSrdDoc(doc, currentClass.className);
    const parsedRows =
      extracted.rows.length > 0
        ? extracted.rows
        : extracted.rawGridText
        ? parseClassProgressionGrid(extracted.rawGridText)
        : currentClass.rows;

    onUpdateCharacter((prev) => {
      const existingGrids = prev.customClassGrids || classGrids;
      const updatedClass: CustomClassGrid = {
        ...currentClass,
        className: extracted.className || currentClass.className,
        hitDie: extracted.hitDie || currentClass.hitDie,
        skillPointsPerLevel: extracted.skillPointsPerLevel || currentClass.skillPointsPerLevel,
        proficiencies: extracted.proficiencies || currentClass.proficiencies,
        classSkillsText: extracted.classSkillsText || currentClass.classSkillsText,
        rawText: extracted.rawGridText || currentClass.rawText,
        rows: parsedRows,
      };

      const currentSot = prev.sotCatalogue || DEFAULT_SOT_CATALOGUE;
      const existingSuggs = currentSot.macaroniSuggestions || [];
      const mergedSuggs = [...existingSuggs];
      for (const s of extracted.macaroniSuggestions) {
        if (!mergedSuggs.some((m) => m.abilityName.toLowerCase() === s.abilityName.toLowerCase())) {
          mergedSuggs.unshift(s);
        }
      }

      return {
        ...prev,
        customClassGrids: {
          ...existingGrids,
          [activeClassId]: updatedClass,
        },
        sotCatalogue: {
          ...currentSot,
          macaroniSuggestions: mergedSuggs,
        },
      };
    });

    setIsSotPickerOpen(false);
    setSuccessMessage(
      `Populated "${extracted.className}" from SOT "${doc.title}" with d${extracted.hitDie} HD, ${extracted.skillPointsPerLevel} + INT ranks, and ${parsedRows.length} progression rows.`
    );
  };

  // AI Archetype Grid Adapter
  const handleAdaptArchetype = async () => {
    if (!archetypeInput.trim()) return;
    setIsAdaptingArchetype(true);
    try {
      const result = await adaptArchetypeIntoGrid(
        archetypeInput,
        currentClass.className,
        currentClass.rows,
        getSessionApiKey()
      );

      const updatedRaw = result.adaptedRows
        .map(
          (r) =>
            `${r.level}\t${r.babString || `+${r.bab}`}\t+${r.fort}\t+${r.ref}\t+${r.will}\t${r.special}`
        )
        .join('\n');

      updateCurrentClass({
        rows: result.adaptedRows,
        rawText: updatedRaw,
      });

      const newArch: ArchetypeConfig = {
        id: `arch-${Date.now()}`,
        name: result.archetypeName,
        targetClassId: currentClass.id,
        targetClassName: currentClass.className,
        lostFeatures: result.lostFeatures,
        levelAbilities: result.levelAbilities,
        isActive: true,
      };

      updateCareerData({
        archetypes: [...(careerData.archetypes || []), newArch],
      });

      setSuccessMessage(result.summary);
      setArchetypeInput('');
    } finally {
      setIsAdaptingArchetype(false);
    }
  };

  // Inline cell edit handlers
  const handleStartCellEdit = (rowIdx: number, col: keyof ClassGridRow) => {
    const row = currentClass.rows[rowIdx];
    if (!row) return;
    setEditingCell({ rowIdx, col });
    setEditingCellValue(String(row[col] ?? ''));
  };

  const handleSaveCellEdit = () => {
    if (!editingCell) return;
    const { rowIdx, col } = editingCell;
    const updatedRows = [...currentClass.rows];
    const targetRow = { ...updatedRows[rowIdx] };

    if (col === 'level' || col === 'fort' || col === 'ref' || col === 'will') {
      const parsed = parseInt(editingCellValue.replace(/[^\d-]/g, ''), 10) || 0;
      (targetRow as any)[col] = parsed;
    } else if (col === 'bab') {
      const parsed = parseInt(editingCellValue.replace(/[^\d-]/g, ''), 10) || 0;
      targetRow.bab = parsed;
      targetRow.babString = editingCellValue.trim().startsWith('+') ? editingCellValue.trim() : `+${editingCellValue.trim()}`;
    } else if (col === 'babString') {
      targetRow.babString = editingCellValue.trim();
      const primaryBabMatch = editingCellValue.match(/[+-]?\d+/);
      if (primaryBabMatch) targetRow.bab = Math.abs(parseInt(primaryBabMatch[0], 10));
    } else {
      (targetRow as any)[col] = editingCellValue;
    }

    updatedRows[rowIdx] = targetRow;
    updateCurrentClass({ rows: updatedRows });
    setEditingCell(null);
  };

  // Send Feature to Class Resource / Action Directory
  const handleSendFeatureToDirectory = () => {
    if (!selectedFeatureForDirectory.trim()) return;
    const featureName = selectedFeatureForDirectory.trim();
    const cleanMacroKey = featureName.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 16);

    onUpdateCharacter((prev) => {
      const existingActions = [...(prev.characterActions || [])];
      const existingTrackers = [...(prev.resourceTrackers || [])];
      const id = `act-cls-${Date.now()}`;

      if (directoryTargetType === 'resource') {
        const newAction: CharacterActionItem = {
          id,
          name: featureName,
          category: 'Class Resource',
          actionType: directoryActionType,
          description: `Class feature from ${currentClass.className}.`,
          hasResourcePool: true,
          resourceCurrent: directoryPoolMax,
          resourceMax: directoryPoolMax,
          macroKey: cleanMacroKey,
        };
        const newTracker: ResourceTracker = {
          id: `res-${id}`,
          name: featureName,
          current: directoryPoolMax,
          max: directoryPoolMax,
          macroKey: cleanMacroKey,
          category: 'Class Resource',
          notes: `${currentClass.className} class feature pool`,
        };
        return {
          ...prev,
          characterActions: [...existingActions, newAction],
          resourceTrackers: [...existingTrackers, newTracker],
        };
      } else {
        const newAction: CharacterActionItem = {
          id,
          name: featureName,
          category: 'Class Ability',
          actionType: directoryActionType,
          description: `Class ability from ${currentClass.className}.`,
          macroKey: cleanMacroKey,
        };
        return {
          ...prev,
          characterActions: [...existingActions, newAction],
        };
      }
    });

    setIsSendDirectoryOpen(false);
    setSuccessMessage(`Exported "${featureName}" directly to Page 2 Action & Class Resource Directory!`);
  };

  // Gather unique features from the current class grid
  const allFeaturesInGrid = useMemo(() => {
    const set = new Set<string>();
    (currentClass.rows || []).forEach((r) => {
      if (r.special && r.special !== '—') {
        r.special.split(/,\s*(?![^()]*\))/).forEach((f) => {
          const trimmed = f.trim();
          if (trimmed && trimmed !== '—') set.add(trimmed);
        });
      }
    });
    return Array.from(set);
  }, [currentClass.rows]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3">
      <div className="w-full max-w-7xl max-h-[96vh] flex flex-col rounded-2xl bg-slate-950 border border-cyan-500/40 text-slate-100 shadow-2xl overflow-hidden font-sans">
        {/* ========================================================================= */}
        {/* HEADER: Clean "Class Architect" header with subtitle and close */}
        {/* ========================================================================= */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-400 shadow-xs">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-mono tracking-tight text-white flex items-center gap-2">
                  <span>Class Architect</span>
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-mono">
                  Dominant Progression Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Track dynamic level-by-level progression (HD, Saves, Skill Points, BAB) with true multiclassing and dual Gestalt options.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncCareerToSheet}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              title="Push calculated BAB, saves, HP, class skills, and proficiencies to the sheet"
            >
              <Sparkles className="w-4 h-4" />
              <span>Apply Career to Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FOLDER TABS: Curved folder tabs across top */}
        {/* ========================================================================= */}
        <div className="px-4 pt-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-end gap-1 overflow-x-auto pb-0">
            {Object.keys(classGrids).map((cid) => {
              const c = classGrids[cid];
              const isActive = cid === activeClassId;
              const displayName = c.className?.trim() || `Class ${cid}`;
              return (
                <div
                  key={cid}
                  onClick={() => setActiveClassId(cid)}
                  className={`group relative flex items-center gap-2 px-4 py-2 cursor-pointer transition-all rounded-t-xl font-mono text-xs font-semibold select-none ${
                    isActive
                      ? 'bg-slate-950 text-cyan-300 border-t-2 border-x border-cyan-400 shadow-md translate-y-px z-10'
                      : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-t border-x border-slate-800'
                  }`}
                  style={{
                    borderBottom: isActive ? '1px solid #020617' : 'none',
                  }}
                >
                  <span className="text-[11px] opacity-75">{isActive ? '✦' : '•'}</span>
                  <span>{displayName}</span>
                  {Object.keys(classGrids).length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClass(cid);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400 transition-opacity ml-1"
                      title="Delete this class"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleAddNewClass}
              className="px-3 py-1.5 mb-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700/80 text-xs font-mono flex items-center gap-1 transition-colors"
              title="Add another class tab"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Class</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-1.5">
            {/* SOT Selector Button */}
            <button
              onClick={() => setIsSotPickerOpen(!isSotPickerOpen)}
              className="px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center gap-1.5 shadow-xs"
              title="Quick-load Class SRD from SOT Files catalogue"
            >
              <AppleEyeIcon className="w-3.5 h-3.5" />
              <span>SOT Files ({sotDocs.length})</span>
            </button>

            {/* Paste Grid Button */}
            <button
              onClick={() => {
                setPasteGridBuffer(currentClass.rawText || '');
                setIsPasteGridOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs flex items-center gap-1.5"
              title="Paste or edit raw tab-delimited progression grid"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              <span>Paste SRD Grid</span>
            </button>

            {/* Quick Directory Export */}
            <button
              onClick={() => setIsSendDirectoryOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/50 text-amber-300 font-mono text-xs flex items-center gap-1.5 shadow-xs"
              title="Export a class ability or resource pool to Page 2 Directory"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>+ Directory Feature</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="mx-4 mt-2 p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-mono flex items-center justify-between">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}
        {noticeMessage && (
          <div className="mx-4 mt-2 p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 text-xs font-mono flex items-center justify-between">
            <span>{noticeMessage}</span>
            <button onClick={() => setNoticeMessage(null)} className="text-cyan-400 hover:text-white">✕</button>
          </div>
        )}

        {/* SOT Selector Popover */}
        {isSotPickerOpen && (
          <div className="mx-4 mt-2 p-3 rounded-xl bg-slate-900 border border-cyan-500/50 shadow-xl space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-cyan-300 font-bold">
              <span className="flex items-center gap-1.5">
                <AppleEyeIcon className="w-4 h-4" />
                <span>Populate "{currentClass.className}" from Loaded SOT SRD Documents</span>
              </span>
              <button onClick={() => setIsSotPickerOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-[11px] text-slate-400">
              Select any loaded SRD document to automatically extract Class Name, Hit Die, Skill Points, Proficiencies, Class Skills, and full 1–20 Progression Grid.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pt-1">
              {sotDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handlePopulateFromSot(doc.id)}
                  className="p-2 rounded-lg bg-slate-950 hover:bg-cyan-950/50 border border-slate-800 hover:border-cyan-500/50 text-left transition-colors flex flex-col justify-between"
                >
                  <span className="font-bold text-slate-200 truncate">{doc.title}</span>
                  <span className="text-[10px] text-cyan-400/80">{doc.category}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MAIN BODY: Spreadsheet Grid on Left + Class Kit Stat Block on Right */}
        {/* ========================================================================= */}
        <div className="flex-1 p-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* ========================================================================= */}
          {/* LEFT: Progression Spreadsheet Grid + AI Archetype Grid Adapter */}
          {/* ========================================================================= */}
          <div className="lg:col-span-8 flex flex-col space-y-3 min-w-0">
            {/* Class Name Bar */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase text-slate-400 font-bold shrink-0">
                  Class Name:
                </span>
                <input
                  type="text"
                  value={currentClass.className}
                  onChange={(e) => updateCurrentClass({ className: e.target.value })}
                  placeholder="e.g. Warpriest, Bard, Fighter, Slayer..."
                  className="w-full max-w-sm px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-bold text-cyan-200 focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <button
                  onClick={() => {
                    const skel = generateProgressionSkeleton('full', true, false, false);
                    updateCurrentClass({ rows: skel });
                    setNoticeMessage('Generated Full BAB (d10/Good Fort) 1–20 skeleton.');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                  title="Generate standard Full BAB skeleton"
                >
                  Full BAB
                </button>
                <button
                  onClick={() => {
                    const skel = generateProgressionSkeleton('3/4', false, false, true);
                    updateCurrentClass({ rows: skel });
                    setNoticeMessage('Generated 3/4 BAB (d8/Good Will) 1–20 skeleton.');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                  title="Generate standard 3/4 BAB skeleton"
                >
                  3/4 BAB
                </button>
                <button
                  onClick={() => {
                    const skel = generateProgressionSkeleton('1/2', false, false, true);
                    updateCurrentClass({ rows: skel });
                    setNoticeMessage('Generated 1/2 BAB (d6/Good Will) 1–20 skeleton.');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                  title="Generate standard 1/2 BAB skeleton"
                >
                  1/2 BAB
                </button>
              </div>
            </div>

            {/* SPREADSHEET PROGRESSION GRID */}
            <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col shadow-inner min-h-[320px]">
              <div className="overflow-x-auto overflow-y-auto max-h-[460px] relative">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 text-[10px] uppercase text-cyan-300">
                    <tr>
                      <th className="p-2 text-center w-12 border-r border-slate-800/60 bg-slate-900">Lvl</th>
                      <th className="p-2 text-center w-24 border-r border-slate-800/60 bg-slate-900">BAB</th>
                      <th className="p-2 text-center w-14 border-r border-slate-800/60 bg-slate-900 text-emerald-400">Fort</th>
                      <th className="p-2 text-center w-14 border-r border-slate-800/60 bg-slate-900 text-sky-400">Ref</th>
                      <th className="p-2 text-center w-14 border-r border-slate-800/60 bg-slate-900 text-purple-400">Will</th>
                      <th className="p-2 border-r border-slate-800/60 bg-slate-900 font-sans">Special / Class Features</th>
                      <th className="p-2 text-center w-10 bg-slate-900">Act</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {currentClass.rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 font-mono text-xs">
                          <div className="space-y-2">
                            <Table className="w-8 h-8 mx-auto text-slate-600 opacity-50" />
                            <p>No progression rows in this grid yet.</p>
                            <div className="flex items-center justify-center gap-2 pt-2">
                              <button
                                onClick={() => {
                                  const skel = generateProgressionSkeleton('3/4', false, false, true);
                                  updateCurrentClass({ rows: skel });
                                }}
                                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs"
                              >
                                Generate Standard 1–20 Grid
                              </button>
                              <button
                                onClick={() => setIsPasteGridOpen(true)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                              >
                                Paste SRD Table
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentClass.rows.map((row, idx) => {
                        const isEven = idx % 2 === 0;
                        const isEditingThis = editingCell?.rowIdx === idx;

                        return (
                          <tr
                            key={row.level}
                            className={`group transition-colors ${
                              isEven ? 'bg-slate-950' : 'bg-slate-900/40'
                            } hover:bg-cyan-950/30`}
                          >
                            {/* Level */}
                            <td className="p-2 text-center font-bold text-cyan-300 border-r border-slate-800/60">
                              {row.level}
                            </td>

                            {/* BAB */}
                            <td
                              onClick={() => handleStartCellEdit(idx, 'babString')}
                              className="p-1 text-center font-bold text-cyan-400 border-r border-slate-800/60 cursor-pointer hover:bg-cyan-500/10"
                            >
                              {isEditingThis && editingCell?.col === 'babString' ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingCellValue}
                                  onChange={(e) => setEditingCellValue(e.target.value)}
                                  onBlur={handleSaveCellEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCellEdit();
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full text-center px-1 py-0.5 rounded bg-slate-900 border border-cyan-400 text-xs text-white"
                                />
                              ) : (
                                <span>{row.babString || `+${row.bab}`}</span>
                              )}
                            </td>

                            {/* Fort */}
                            <td
                              onClick={() => handleStartCellEdit(idx, 'fort')}
                              className="p-1 text-center text-emerald-400 border-r border-slate-800/60 cursor-pointer hover:bg-emerald-500/10"
                            >
                              {isEditingThis && editingCell?.col === 'fort' ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingCellValue}
                                  onChange={(e) => setEditingCellValue(e.target.value)}
                                  onBlur={handleSaveCellEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCellEdit();
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full text-center px-1 py-0.5 rounded bg-slate-900 border border-emerald-400 text-xs text-white"
                                />
                              ) : (
                                <span>+{row.fort}</span>
                              )}
                            </td>

                            {/* Ref */}
                            <td
                              onClick={() => handleStartCellEdit(idx, 'ref')}
                              className="p-1 text-center text-sky-400 border-r border-slate-800/60 cursor-pointer hover:bg-sky-500/10"
                            >
                              {isEditingThis && editingCell?.col === 'ref' ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingCellValue}
                                  onChange={(e) => setEditingCellValue(e.target.value)}
                                  onBlur={handleSaveCellEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCellEdit();
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full text-center px-1 py-0.5 rounded bg-slate-900 border border-sky-400 text-xs text-white"
                                />
                              ) : (
                                <span>+{row.ref}</span>
                              )}
                            </td>

                            {/* Will */}
                            <td
                              onClick={() => handleStartCellEdit(idx, 'will')}
                              className="p-1 text-center text-purple-400 border-r border-slate-800/60 cursor-pointer hover:bg-purple-500/10"
                            >
                              {isEditingThis && editingCell?.col === 'will' ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingCellValue}
                                  onChange={(e) => setEditingCellValue(e.target.value)}
                                  onBlur={handleSaveCellEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCellEdit();
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full text-center px-1 py-0.5 rounded bg-slate-900 border border-purple-400 text-xs text-white"
                                />
                              ) : (
                                <span>+{row.will}</span>
                              )}
                            </td>

                            {/* Special */}
                            <td
                              onClick={() => handleStartCellEdit(idx, 'special')}
                              className="p-1 font-sans text-xs text-slate-200 border-r border-slate-800/60 cursor-pointer hover:bg-cyan-500/10"
                            >
                              {isEditingThis && editingCell?.col === 'special' ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingCellValue}
                                  onChange={(e) => setEditingCellValue(e.target.value)}
                                  onBlur={handleSaveCellEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCellEdit();
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full px-2 py-0.5 rounded bg-slate-900 border border-cyan-400 text-xs text-white"
                                />
                              ) : (
                                <span className={row.special === '—' ? 'text-slate-600' : 'text-slate-200'}>
                                  {row.special}
                                </span>
                              )}
                            </td>

                            {/* Row Action */}
                            <td className="p-1 text-center">
                              <button
                                onClick={() => {
                                  const updated = currentClass.rows.filter((_, i) => i !== idx);
                                  updateCurrentClass({ rows: updated });
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity"
                                title="Delete row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* STATUS LINE */}
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
              <span>
                Active Character: <strong className="text-cyan-300">{character.name || 'Hero'}</strong> | Mode:{' '}
                <strong className="text-amber-300">{careerData.mode.toUpperCase()}</strong>
              </span>
              <span className="text-[11px] text-slate-500">
                {currentClass.rows.length} rows | Click any cell to edit inline
              </span>
            </div>

            {/* AI ARCHETYPE GRID ADAPTER */}
            <div className="p-3 rounded-xl bg-cyan-950/25 border border-cyan-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>AI Archetype Grid Adapter (Describe or Paste Archetype)</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-400/80">
                  Swaps features directly in grid
                </span>
              </div>
              <textarea
                rows={2}
                value={archetypeInput}
                onChange={(e) => setArchetypeInput(e.target.value)}
                placeholder="Describe the archetype or paste SRD text (e.g. 'Bard Fencer / Arcane Duelist: Replaces bardic knowledge and versatile performance with Arcane Strike at 1st, Combat Casting at 2nd, Bladethirst at 6th')..."
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-cyan-500/30 text-xs text-slate-100 font-mono focus:border-cyan-400 resize-none"
              />
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[10px] font-mono text-slate-400">
                  Automatically removes replaced features &amp; inserts archetype powers at each level
                </span>
                <button
                  onClick={handleAdaptArchetype}
                  disabled={isAdaptingArchetype || !archetypeInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isAdaptingArchetype ? 'Adapting...' : 'Adapt Archetype into Grid'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT: Class Kit Stat Block + Progression Mode Toggles */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 space-y-3">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-md">
              {/* Box Title + Action Buttons */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 font-bold text-xs font-mono text-amber-300">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Class Kit Stat Block</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isAIActive && (
                    <button
                      onClick={handleRecognizeSrd}
                      className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-mono font-bold text-[11px] flex items-center gap-1 transition-colors"
                      title="Clean raw SRD sentences and detect canonical skills & proficiencies"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>AI Clean SRD Text</span>
                    </button>
                  )}
                  <button
                    onClick={handleAddKit}
                    className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1 shadow-sm transition-all active:scale-95"
                    title="Add kit stat block to character: expands multiclass HD/HP, proficiencies, and marks class skills"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Add Kit</span>
                  </button>
                </div>
              </div>

              {/* Hit Die and Skill Points */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Hit Die</label>
                  <select
                    value={currentClass.hitDie}
                    onChange={(e) => updateCurrentClass({ hitDie: parseInt(e.target.value, 10) })}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-200 font-mono text-xs focus:border-cyan-400"
                  >
                    <option value={6}>d6 (Wizard / Sorcerer)</option>
                    <option value={8}>d8 (Rogue / Cleric / Bard)</option>
                    <option value={10}>d10 (Fighter / Cavalier)</option>
                    <option value={12}>d12 (Barbarian)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Skill Points / Level</label>
                  <select
                    value={currentClass.skillPointsPerLevel}
                    onChange={(e) => updateCurrentClass({ skillPointsPerLevel: parseInt(e.target.value, 10) })}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-200 font-mono text-xs focus:border-cyan-400"
                  >
                    <option value={2}>2 + INT (Fighter, Cleric)</option>
                    <option value={4}>4 + INT (Cavalier, Warpriest)</option>
                    <option value={6}>6 + INT (Bard, Ranger)</option>
                    <option value={8}>8 + INT (Rogue)</option>
                  </select>
                </div>
              </div>

              {/* Proficiencies Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono text-slate-400 font-bold uppercase">Proficiencies</label>
                  <span className="text-[9px] text-emerald-400 font-mono">
                    Ignores non-proficiency SRD prose
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={currentClass.proficiencies || ''}
                  onChange={(e) => updateCurrentClass({ proficiencies: e.target.value })}
                  placeholder="Paste SRD Weapon and Armor Proficiency text..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-cyan-400 font-mono resize-y"
                />
              </div>

              {/* Class Skills Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                    Class Skills (copy-paste SRD block)
                  </label>
                  <span className="text-[9px] text-emerald-400 font-mono">
                    Recognizes skills from messy SRD text
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={currentClass.classSkillsText || ''}
                  onChange={(e) => updateCurrentClass({ classSkillsText: e.target.value })}
                  placeholder="Paste SRD class skills block e.g. 'The warpriest's class skills are Climb (Str), Craft (Int), Diplomacy (Cha), Heal (Wis), Intimidate (Cha), Knowledge (engineering)...'"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-cyan-400 font-mono resize-y"
                />
                <p className="text-[10px] text-slate-400 pt-1 leading-tight">
                  Clicking &ldquo;Add Kit&rdquo; automatically filters out non-skill words, registers proficiencies, expands Hit Dice/HP, and marks class skills.
                </p>
              </div>

              {/* Progression Mode Toggles: Standard vs Gestalt */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase block">
                  Progression Mode:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => updateCareerData({ mode: 'standard' })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all text-center ${
                      careerData.mode === 'standard'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-xs'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    Standard Multiclass
                  </button>
                  <button
                    onClick={() => updateCareerData({ mode: 'gestalt' })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 ${
                      careerData.mode === 'gestalt'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400 shadow-xs'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    <Split className="w-3 h-3 text-amber-400" />
                    <span>Gestalt Mode</span>
                  </button>
                </div>

                {/* Fractional Rules */}
                <div className="flex items-center justify-between text-xs font-mono pt-1 text-slate-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={careerData.useFractionalBab}
                      onChange={(e) => updateCareerData({ useFractionalBab: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                    />
                    <span>Fractional BAB</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={careerData.useFractionalSaves}
                      onChange={(e) => updateCareerData({ useFractionalSaves: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                    />
                    <span>Fractional Saves</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Quick Stats Overview Card */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs font-mono">
              <span className="text-[10px] uppercase text-cyan-400 font-bold block">
                Calculated Progression Snapshot
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">TOTAL LEVEL</span>
                  <span className="text-cyan-300 font-bold text-sm">{careerResult.totalLevel}</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">BASE ATTACK</span>
                  <span className="text-cyan-400 font-bold text-sm">+{careerResult.totalBab}</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">TOTAL HP</span>
                  <span className="text-rose-400 font-bold text-sm">{careerResult.totalHp}</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">SKILL RANKS</span>
                  <span className="text-amber-300 font-bold text-sm">{careerResult.totalSkillPoints}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FOOTER: Active Status + Close */}
        {/* ========================================================================= */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Active Character: {character.name || 'Hero'} | Mode: {careerData.mode.toUpperCase()}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncCareerToSheet}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-colors"
            >
              Apply to Sheet
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL / DIALOG: Paste Raw Grid Table Popover */}
        {/* ========================================================================= */}
        {isPasteGridOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-cyan-500/50 p-5 space-y-3 font-mono text-xs shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Paste SRD Progression Table (Level | BAB | Fort | Ref | Will | Special)</span>
                </span>
                <button onClick={() => setIsPasteGridOpen(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <p className="text-[11px] text-slate-400">
                Copy and paste a 1–20 table directly from Archives of Nethys or d20pfsrd. Tabs, pipes (|), and standard spaces are all supported.
              </p>
              <textarea
                rows={10}
                value={pasteGridBuffer}
                onChange={(e) => setPasteGridBuffer(e.target.value)}
                placeholder="1&#9;+1&#9;+2&#9;+0&#9;+0&#9;Aura, blessings, orisons&#10;2&#9;+2&#9;+3&#9;+0&#9;+0&#9;Fervor 1d6..."
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-100 font-mono text-xs focus:border-cyan-400 resize-y"
              />
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-500">
                  {parseClassProgressionGrid(pasteGridBuffer).length} rows detected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPasteGridOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const rows = parseClassProgressionGrid(pasteGridBuffer);
                      updateCurrentClass({ rawText: pasteGridBuffer, rows });
                      setIsPasteGridOpen(false);
                      setSuccessMessage(`Parsed and loaded ${rows.length} progression rows into the grid!`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold"
                  >
                    Load into Grid
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL / DIALOG: Send Feature to Class Resource / Action Directory */}
        {/* ========================================================================= */}
        {isSendDirectoryOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/50 p-5 space-y-3 font-mono text-xs shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-amber-400" />
                  <span>Send Feature to Page 2 Resource Directory</span>
                </span>
                <button onClick={() => setIsSendDirectoryOpen(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <p className="text-[11px] text-slate-400">
                Select any feature from the {currentClass.className} progression grid to create an action or daily resource pool on Page 2.
              </p>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Select Feature from Grid or Type:</label>
                <div className="space-y-1.5">
                  <select
                    value={selectedFeatureForDirectory}
                    onChange={(e) => setSelectedFeatureForDirectory(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs"
                  >
                    <option value="">-- Choose from grid features --</option>
                    {allFeaturesInGrid.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={selectedFeatureForDirectory}
                    onChange={(e) => setSelectedFeatureForDirectory(e.target.value)}
                    placeholder="or type custom ability name..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Target Type</label>
                  <select
                    value={directoryTargetType}
                    onChange={(e) => setDirectoryTargetType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200"
                  >
                    <option value="resource">Daily Resource Pool</option>
                    <option value="action">Action / Ability</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Action Economy</label>
                  <select
                    value={directoryActionType}
                    onChange={(e) => setDirectoryActionType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Swift">Swift</option>
                    <option value="Move">Move</option>
                    <option value="Immediate">Immediate</option>
                    <option value="Free">Free</option>
                    <option value="Full-Round">Full-Round</option>
                    <option value="Passive / Pool">Passive / Pool</option>
                  </select>
                </div>
              </div>

              {directoryTargetType === 'resource' && (
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Daily Uses / Cap</label>
                  <input
                    type="number"
                    min="1"
                    value={directoryPoolMax}
                    onChange={(e) => setDirectoryPoolMax(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setIsSendDirectoryOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendFeatureToDirectory}
                  disabled={!selectedFeatureForDirectory.trim()}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold"
                >
                  Save to Directory
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
