import React, { useState } from 'react';
import {
  Dices,
  Plus,
  Trash2,
  Shield,
  Swords,
  Heart,
  Zap,
  Minus,
  FilePlus,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import {
  PF1Character,
  AbilityName,
  WeaponAttack,
  ArmorItem,
  StepperRule,
} from '../../types/character';
import { DerivedCombatStats, getPointBuyCost } from '../../engine/pf1eMath';
import { evaluateFormula, buildFormulaContext } from '../../engine/formula';
import { executeMacaroni } from '../../engine/macaroni';
import { BuffBoxModule } from './BuffBoxModule';
import { QuickModularTools } from '../workspace/QuickModularTools';
import { FieldCallTooltip } from '../common/FieldCallTooltip';
import { IdentityLoadFields } from '../storage/IdentityLoadFields';
import { useCharacter } from '../../context/CharacterContext';

interface SheetPage1CoreProps {
  character?: PF1Character;
  derived?: DerivedCombatStats;
  theme?: string;
  fontClass: string;
  onUpdateCharacter?: (updater: (prev: PF1Character) => PF1Character) => void;
  onRollFormula: (formula: string, label?: string) => void;
  visibleModules?: Record<string, boolean>;
  onOpenCMBt?: () => void;
  onOpenAddClass?: () => void;
  onOpenNewSheet?: () => void;
  onOpenImageBrowser?: (config?: {
    targetType: 'profile' | 'portrait' | 'item';
    itemName?: string;
    currentUrl?: string;
  }) => void;
}

export const SheetPage1Core: React.FC<SheetPage1CoreProps> = ({
  character: propCharacter,
  derived: propDerived,
  theme: propTheme,
  fontClass,
  onUpdateCharacter: propOnUpdateCharacter,
  onRollFormula,
  visibleModules: propVisibleModules,
  onOpenAddClass,
  onOpenNewSheet,
  onOpenImageBrowser,
}) => {
  const ctx = useCharacter();
  const character = propCharacter ?? ctx.character;
  const derived = propDerived ?? ctx.derived;
  const theme = propTheme ?? ctx.layout.theme;
  const visibleModules = propVisibleModules ?? ctx.layout.visibleModules;
  const onUpdateCharacter = propOnUpdateCharacter ?? ctx.updateCharacter;
  const abilitiesList: AbilityName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

  // Single shared numeric input for Heal (+) and Damage (-) per Spec #34
  const [healthDeltaInput, setHealthDeltaInput] = useState<number>(5);
  // Fold-out panel toggle for Race & ASI in Ability Scores per Spec #21
  const [showRaceAndAsi, setShowRaceAndAsi] = useState<boolean>(false);
  // Optional secondary profile details fold-out per Spec #11
  const [showSecondaryIdentity, setShowSecondaryIdentity] = useState<boolean>(false);

  const formulaContext = buildFormulaContext(
    character,
    { strPenalty: 0, dexPenalty: 0, attackPenalty: 0 },
    derived
  );

  // Handle direct field updates
  const setField = <K extends keyof PF1Character>(key: K, value: PF1Character[K]) => {
    onUpdateCharacter((prev) => ({ ...prev, [key]: value }));
  };

  // Click Heart icon to restore/reset HP to maximum per Spec #37 & Screenshot 1
  const handleResetToMax = () => {
    const maxHp = derived.hpBreakdownDetails.calculatedTotalMaxHP;
    onUpdateCharacter((prev) => ({
      ...prev,
      hpCurrent: maxHp,
      hpTotalMax: maxHp,
      hpNonlethal: 0,
      deathSaves: [false, false, false],
    }));
  };

  const toggleDeathSave = (index: number) => {
    onUpdateCharacter((prev) => {
      const current = prev.deathSaves || [false, false, false];
      const next: [boolean, boolean, boolean] = [current[0], current[1], current[2]];
      next[index] = !next[index];
      return { ...prev, deathSaves: next };
    });
  };

  const rollHitDice = () => {
    const count = character.hpBreakdown?.hitDiceCount || character.level;
    const size = character.hpBreakdown?.hitDiceSize || 10;
    let totalBase = size;
    if (count > 1) {
      for (let i = 2; i <= count; i++) {
        totalBase += Math.floor(Math.random() * size) + 1;
      }
    }
    setField('hpBreakdown', {
      ...character.hpBreakdown,
      calcMethod: 'rolled',
      hitDiceRolledBase: totalBase,
    });
    onRollFormula(`${count}d${size}`, `Rolled Hit Dice Base HP: ${totalBase}`);
  };

  const updateAbility = (
    name: AbilityName,
    field: 'base' | 'raceMod' | 'levelAsiMod' | 'enhMod' | 'miscMod' | 'tempMod' | 'directMod',
    val: number
  ) => {
    onUpdateCharacter((prev) => ({
      ...prev,
      abilities: {
        ...prev.abilities,
        [name]: {
          ...prev.abilities[name],
          [field]: val,
        },
      },
    }));
  };

  // Damage dissolves TEMP HP first before reducing Current HP
  const applyDamage = (amount: number) => {
    let remaining = Math.max(0, amount);
    let newTemp = character.hpTemp;
    let newCurrent = character.hpCurrent;

    if (newTemp > 0) {
      if (newTemp >= remaining) {
        newTemp -= remaining;
        remaining = 0;
      } else {
        remaining -= newTemp;
        newTemp = 0;
      }
    }
    newCurrent -= remaining;
    onUpdateCharacter((prev) => ({ ...prev, hpCurrent: newCurrent, hpTemp: newTemp }));
  };

  const applyHealing = (amount: number) => {
    const cleanAmount = Math.max(0, amount);
    onUpdateCharacter((prev) => ({
      ...prev,
      hpCurrent: Math.min(
        derived.hpBreakdownDetails.calculatedTotalMaxHP,
        prev.hpCurrent + cleanAmount
      ),
      hpNonlethal: Math.max(0, prev.hpNonlethal - cleanAmount),
    }));
  };

  const removeAdditionalHpBonus = (id: string) => {
    const currentList = character.hpBreakdown?.additionalBonuses || [];
    setField('hpBreakdown', {
      ...character.hpBreakdown,
      additionalBonuses: currentList.filter((b) => b.id !== id),
    });
  };

  // Default auto-generated HP macro per Spec #27 & #28
  const DEFAULT_AUTO_HP_MACRO = '[[[[<<HDmath + #CON] + <<HDbonus] + <<BhP]';
  const activeHpMacro = character.hpBreakdown?.isCustomMacroManual
    ? character.hpBreakdown?.customMacro || DEFAULT_AUTO_HP_MACRO
    : DEFAULT_AUTO_HP_MACRO;

  const updateHpBreakdownFields = (
    updates: Partial<PF1Character['hpBreakdown']>,
    markManualMacro: boolean = false
  ) => {
    onUpdateCharacter((prev) => {
      const nextBreakdown = {
        ...prev.hpBreakdown,
        ...updates,
      };
      if (markManualMacro) {
        nextBreakdown.isCustomMacroManual = true;
      } else if (!prev.hpBreakdown?.isCustomMacroManual) {
        nextBreakdown.customMacro = DEFAULT_AUTO_HP_MACRO;
      }
      return {
        ...prev,
        hpBreakdown: nextBreakdown,
      };
    });
  };

  // Clickable Initiative: rolls initiative and adds/advances an initiative stepper macro (Spec #39 & #40)
  const handleRollInitiativeAndStep = () => {
    const initExpr = character.initMacro?.trim() || '#INIT';
    const evalInit = evaluateFormula(initExpr, formulaContext);
    const modNum = parseInt(evalInit.evaluated, 10);
    const effectiveInitMod = Number.isNaN(modNum) ? derived.initiativeTotal : modNum;

    onRollFormula(
      `1d20${effectiveInitMod >= 0 ? `+${effectiveInitMod}` : effectiveInitMod}`,
      'Initiative Check'
    );

    onUpdateCharacter((prev) => {
      const tracker = prev.combatTracker || { round: 0, turn: 0, isInCombat: false };
      const nextRound = tracker.isInCombat ? tracker.round : Math.max(1, tracker.round || 1);
      const nextTurn = (tracker.turn || 0) + 1;

      const existingRules = prev.stepperRules || [];
      const hasInitStepper = existingRules.some((r) => r.id === 'step-init' || r.label === 'Initiative');
      const nextRules: StepperRule[] = hasInitStepper
        ? existingRules.map((r) =>
            r.id === 'step-init' || r.label === 'Initiative'
              ? {
                  ...r,
                  isActive: true,
                  currentValue: (r.currentValue ?? 0) + 1,
                }
              : r
          )
        : [
            ...existingRules,
            {
              id: 'step-init',
              rawText: 'this + 1',
              type: 'track',
              label: 'Initiative',
              currentValue: 1,
              stepAmount: 1,
              isActive: true,
            },
          ];

      return {
        ...prev,
        combatTracker: {
          round: nextRound,
          turn: nextTurn,
          isInCombat: true,
        },
        stepperRules: nextRules,
      };
    });
  };

  const addWeapon = () => {
    const newWeapon: WeaponAttack = {
      id: `wp-${Date.now()}`,
      name: 'New Weapon',
      category: 'Melee',
      attackFormula: '[1d20+#MATTACK]',
      damageFormula: '[1d8+#STR]',
      critical: '20/x2',
      range: 'Melee',
      damageType: 'Slashing',
      weight: 0,
      isEquipped: true,
    };
    setField('weapons', [...character.weapons, newWeapon]);
  };

  const removeWeapon = (id: string) => {
    setField('weapons', character.weapons.filter((w) => w.id !== id));
  };

  const updateWeapon = (id: string, updates: Partial<WeaponAttack>) => {
    setField(
      'weapons',
      character.weapons.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );
  };

  const defaultAttackFormula = (wp: WeaponAttack): string =>
    wp.attackFormula ??
    (wp.category === 'Ranged' ? '[1d20+#RATTACK]' : '[1d20+#MATTACK]');

  // Evaluate attack/damage macros with Macaroni & Formula engine support
  const evaluateWeaponMacro = (raw: string, fallback: string): string => {
    const text = (raw || fallback).trim() || fallback;
    const unwrapped = text.replace(/^\[+/, '').replace(/\]+$/, '').trim();
    const macRes = executeMacaroni(text, {
      character,
      formulaContext,
    });
    const evalRes = evaluateFormula(unwrapped || text, formulaContext);
    return evalRes.evaluated || macRes.fullOutput || unwrapped || fallback;
  };

  const addArmor = () => {
    const newArmor: ArmorItem = {
      id: `ar-${Date.now()}`,
      name: 'New Armor',
      type: 'Light',
      acBonus: 3,
      maxDex: 4,
      checkPenalty: -1,
      spellFailure: 10,
      speed30: 30,
      weight: 15,
      isEquipped: true,
    };
    setField('armor', [...character.armor, newArmor]);
  };

  const removeArmor = (id: string) => {
    setField('armor', character.armor.filter((a) => a.id !== id));
  };

  const updateArmor = (id: string, updates: Partial<ArmorItem>) => {
    setField(
      'armor',
      character.armor.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  };

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

  return (
    <div className={`space-y-4 ${fontClass} transition-colors duration-200`}>
      {/* 1. Top Profile Block: Reduced to Profile Name, Class, and Level per Spec #11 */}
      <div className={`border rounded-lg p-3.5 ${cardBg}`}>
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Profile
            </span>
            <button
              type="button"
              onClick={() => setShowSecondaryIdentity((prev) => !prev)}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-black/15 dark:border-white/15 opacity-75 hover:opacity-100 flex items-center gap-1"
            >
              {showSecondaryIdentity ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>Details</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onOpenImageBrowser && (
              <button
                type="button"
                onClick={() =>
                  onOpenImageBrowser({
                    targetType: 'profile',
                    currentUrl:
                      character.profileData?.avatarUrl || character.characterBio?.portraits?.[0],
                  })
                }
                className="text-[11px] font-mono px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 flex items-center gap-1 transition-colors"
                title="Open image file browser to set character portrait"
              >
                <ImageIcon className="w-3 h-3 text-cyan-400" />
                <span>Profile Pic</span>
              </button>
            )}

            {onOpenNewSheet && (
              <button
                type="button"
                onClick={onOpenNewSheet}
                className="text-[11px] font-mono px-2 py-0.5 rounded border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 flex items-center gap-1 transition-colors"
                title="Start a fresh blank sheet or reset character"
              >
                <FilePlus className="w-3 h-3 text-rose-400" />
                <span>New Sheet / Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Core 3 Profile Fields: Profile Name (IdentityLoadFields), Class, and Level */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <IdentityLoadFields
            character={character}
            inputStyle={inputStyle}
            onChangeName={(val) => setField('name', val)}
            onChangePlayer={(val) => setField('player', val)}
            onCharacterLoaded={(loaded) => onUpdateCharacter(() => loaded)}
            onOpenImageBrowser={
              onOpenImageBrowser
                ? () =>
                    onOpenImageBrowser({
                      targetType: 'profile',
                      currentUrl:
                        character.profileData?.avatarUrl || character.characterBio?.portraits?.[0],
                    })
                : undefined
            }
          />

          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
              Class
            </label>
            <input
              type="text"
              value={character.characterClass}
              onChange={(e) => setField('characterClass', e.target.value)}
              className={`w-full text-xs font-semibold px-2 py-1 rounded border ${inputStyle}`}
            />
          </div>

          <FieldCallTooltip callName="#LEVEL" description="Character Level" className="block">
            <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75 cursor-help">
              Level
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={character.level}
              onChange={(e) => setField('level', Math.max(0, parseInt(e.target.value) || 0))}
              className={`w-full text-xs font-bold font-mono px-2 py-1 rounded border ${inputStyle}`}
            />
          </FieldCallTooltip>
        </div>

        {/* Fold-out Secondary Lineage Details */}
        {showSecondaryIdentity && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-3 mt-3 border-t border-black/10 dark:border-white/10">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
                Race
              </label>
              <input
                type="text"
                value={character.race}
                onChange={(e) => setField('race', e.target.value)}
                className={`w-full text-xs px-2 py-1 rounded border ${inputStyle}`}
              />
            </div>

            <FieldCallTooltip callName="#SIZE" description="Size Modifier" className="block">
              <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75 cursor-help">
                Size
              </label>
              <select
                value={character.size}
                onChange={(e) => setField('size', e.target.value as any)}
                className={`w-full text-xs px-2 py-1 rounded border ${inputStyle}`}
              >
                <option value="Fine">Fine</option>
                <option value="Diminutive">Diminutive</option>
                <option value="Tiny">Tiny</option>
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
                <option value="Huge">Huge</option>
                <option value="Gargantuan">Gargantuan</option>
                <option value="Colossal">Colossal</option>
              </select>
            </FieldCallTooltip>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
                Alignment
              </label>
              <input
                type="text"
                value={character.alignment}
                onChange={(e) => setField('alignment', e.target.value)}
                className={`w-full text-xs px-2 py-1 rounded border ${inputStyle}`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
                Deity
              </label>
              <input
                type="text"
                value={character.deity}
                onChange={(e) => setField('deity', e.target.value)}
                className={`w-full text-xs px-2 py-1 rounded border ${inputStyle}`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
                Current XP
              </label>
              <input
                type="number"
                value={character.currentXP}
                onChange={(e) => setField('currentXP', parseInt(e.target.value) || 0)}
                className={`w-full text-xs px-2 py-1 rounded border font-mono tabular-nums ${inputStyle}`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
                Next Level XP
              </label>
              <input
                type="number"
                value={character.nextLevelXP}
                onChange={(e) => setField('nextLevelXP', parseInt(e.target.value) || 0)}
                className={`w-full text-xs px-2 py-1 rounded border font-mono tabular-nums ${inputStyle}`}
              />
            </div>
          </div>
        )}
      </div>

      {/* BUFF BOX MODULE */}
      {visibleModules.buffBox && (
        <BuffBoxModule
          buffBox={character.buffBox}
          customBuffs={character.customBuffs}
          onUpdateBuffBox={(newBox) => setField('buffBox', newBox)}
          onUpdateCustomBuffs={(newBuffs) => {
            onUpdateCharacter((prev) => {
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
            });
          }}
          theme={theme}
          fontClass={fontClass}
        />
      )}

      {/* Turn Stepper is temporarily hidden in index.css while it is being fixed. */}
      {visibleModules.turnStepper !== false && (
        <QuickModularTools
          character={character}
          derived={derived}
          theme={theme}
          fontClass={fontClass}
          onUpdateCharacter={onUpdateCharacter}
          onRollFormula={onRollFormula}
          visibleModules={visibleModules}
          onOpenAddClass={onOpenAddClass}
        />
      )}

      {/* 2. Top Combat Row: Left Column (Abilities, BAB Module, Attacks) | Right Column (HP & Vitals, AC & Defenses, Saves) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (lg:col-span-6): Abilities, BAB Module, Attacks & Weapons */}
        <div className="lg:col-span-6 min-w-0 space-y-4">
          {/* Ability Scores Table (Compact view + Fold-out tab for Race & ASI per Spec #18-#22) */}
          <div className={`border rounded-lg overflow-hidden ${cardBg}`}>
            <div className={`px-3 py-2 border-b flex items-center justify-between ${headerBg}`}>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-xs uppercase tracking-wider">Ability Scores</span>
                <span className="text-sm font-mono font-black text-amber-500 dark:text-amber-400">
                  Point Buy: {derived.pointBuySpent}p
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowRaceAndAsi((prev) => !prev)}
                className="px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-[10px] font-mono font-bold text-cyan-300 flex items-center gap-1 transition-colors"
                title="Toggle fold-out panel for Race and ASI modifiers"
              >
                {showRaceAndAsi ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>Race &amp; ASI</span>
              </button>
            </div>

            <div className="p-3 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-[10px] uppercase opacity-75">
                    <th className="pb-1">Ability</th>
                    <th className="pb-1 text-center" title="Base Point Buy 6 to 18">Base</th>
                    {showRaceAndAsi && (
                      <>
                        <th className="pb-1 text-center" title="Racial Modifier (+2 or +4)">Race</th>
                        <th className="pb-1 text-center" title="Level ASI (+1 per 4 lvls)">ASI</th>
                      </>
                    )}
                    <th className="pb-1 text-center font-bold">Total ABS</th>
                    <th className="pb-1 text-center font-bold text-amber-600 dark:text-amber-400">Mod</th>
                    <th className="pb-1 text-center font-bold text-cyan-600 dark:text-cyan-400" title="Direct modifier bonus not calculated with total score">Mod Adj</th>
                    <th className="pb-1 text-center">Roll</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {abilitiesList.map((ab) => {
                    const scoreObj = character.abilities[ab];
                    const totalScore = (derived as any)[`${ab.toLowerCase()}Total`] ?? 0;
                    const baseMod =
                      (derived as any)[`base${ab.charAt(0) + ab.slice(1).toLowerCase()}Mod`] ??
                      (totalScore === 0 ? 0 : Math.floor((totalScore - 10) / 2));
                    const directMod = scoreObj.directMod || 0;
                    const effectiveMod = baseMod + directMod;
                    const cost = getPointBuyCost(scoreObj.base);

                    return (
                      <tr key={ab} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2 font-bold font-serif text-sm">
                          <FieldCallTooltip callName={`#${ab}`} description={`${ab} modifier`}>
                            <span className="cursor-help hover:text-amber-500 transition-colors">{ab}</span>
                          </FieldCallTooltip>
                        </td>

                        {/* Base Point Buy (0 or 6 to 18) */}
                        <td className="py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="18"
                            value={scoreObj.base}
                            onChange={(e) =>
                              updateAbility(
                                ab,
                                'base',
                                Math.max(0, Math.min(18, parseInt(e.target.value) || 0))
                              )
                            }
                            className={`w-11 text-center py-0.5 text-xs rounded border tabular-nums ${inputStyle}`}
                            title={`Point buy cost: ${cost} pts`}
                          />
                        </td>

                        {/* Fold-out Race & ASI columns */}
                        {showRaceAndAsi && (
                          <>
                            <td className="py-2 text-center">
                              <input
                                type="number"
                                value={scoreObj.raceMod}
                                onChange={(e) =>
                                  updateAbility(ab, 'raceMod', parseInt(e.target.value) || 0)
                                }
                                className={`w-10 text-center py-0.5 text-xs rounded border tabular-nums ${inputStyle}`}
                              />
                            </td>

                            <td className="py-2 text-center">
                              <input
                                type="number"
                                min="0"
                                value={scoreObj.levelAsiMod || 0}
                                onChange={(e) =>
                                  updateAbility(
                                    ab,
                                    'levelAsiMod',
                                    Math.max(0, parseInt(e.target.value) || 0)
                                  )
                                }
                                className={`w-9 text-center py-0.5 text-xs rounded border tabular-nums text-cyan-600 dark:text-cyan-400 ${inputStyle}`}
                              />
                            </td>
                          </>
                        )}

                        {/* Total ABS */}
                        <td className="py-2 text-center font-bold text-sm tabular-nums">
                          <FieldCallTooltip callName={`#${ab}_SCORE`} description={`${ab} Total Score`}>
                            <span className="cursor-help px-1 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5">
                              {totalScore}
                            </span>
                          </FieldCallTooltip>
                        </td>

                        {/* Mod (Calculated from Total ABS) */}
                        <td className="py-2 text-center">
                          <FieldCallTooltip callName={`#${ab}`} description={`${ab} Modifier: floor((Score - 10) / 2)`}>
                            <span className="font-bold text-xs px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 tabular-nums cursor-help">
                              {baseMod >= 0 ? `+${baseMod}` : baseMod}
                            </span>
                          </FieldCallTooltip>
                        </td>

                        {/* Mod Adj */}
                        <td className="py-2 text-center">
                          <input
                            type="number"
                            value={scoreObj.directMod || 0}
                            onChange={(e) =>
                              updateAbility(ab, 'directMod', parseInt(e.target.value) || 0)
                            }
                            className={`w-10 text-center py-0.5 text-xs rounded border tabular-nums ${
                              directMod !== 0
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                                : ''
                            } ${inputStyle}`}
                            title="Direct modifier bonus not calculated with total score"
                            placeholder="0"
                          />
                        </td>

                        {/* Dice Roll with Effective Mod */}
                        <td className="py-2 text-center">
                          <FieldCallTooltip callName={`#${ab}`} description={`${ab} Check / Modifier`}>
                            <button
                              type="button"
                              onClick={() =>
                                onRollFormula(
                                  `1d20+${effectiveMod}`,
                                  `${ab} Check (Mod ${effectiveMod >= 0 ? `+${effectiveMod}` : effectiveMod})`
                                )
                              }
                              className="p-1 rounded hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors inline-flex items-center gap-1 font-bold text-xs"
                            >
                              <span>{effectiveMod >= 0 ? `+${effectiveMod}` : effectiveMod}</span>
                              <Dices className="w-3.5 h-3.5" />
                            </button>
                          </FieldCallTooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* BASE ATTACK & MANEUVERS (BAB) MODULE (Spec #39-#49) */}
          <div className={`border rounded-lg p-3.5 ${cardBg} space-y-3`}>
            {/* Header (Iteratives text & CMBt link removed per Spec #43) */}
            <div className={`flex items-center justify-between border-b pb-1.5 ${headerBg} px-2 py-1 -mx-3.5 -mt-3.5 rounded-t-lg mb-2`}>
              <div className="flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Base Attack &amp; Maneuvers (BAB)
                </span>
              </div>
            </div>

            {/* Initiative Bonus + Character Speed Input (Spec #39, #40, #44) */}
            <FieldCallTooltip
              callName="#INIT"
              description={`Initiative Bonus: DEX (${derived.dexMod >= 0 ? `+${derived.dexMod}` : derived.dexMod}) + Misc (${character.initMiscMod || 0})`}
              className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-between flex-wrap gap-2 font-mono text-xs w-full"
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleRollInitiativeAndStep}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 transition-colors"
                  title="Click to roll Initiative and advance/add Initiative stepper"
                >
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-xs uppercase tracking-wider">
                    Initiative
                  </span>
                  <span className="font-mono font-black text-lg">
                    {derived.initiativeTotal >= 0 ? `+${derived.initiativeTotal}` : derived.initiativeTotal}
                  </span>
                  <Dices className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Clickable / Editable Initiative Macro Call (#INIT) */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] opacity-75">Macro:</span>
                  <input
                    type="text"
                    value={character.initMacro ?? '#INIT'}
                    onChange={(e) => setField('initMacro', e.target.value)}
                    className={`w-20 text-center py-0.5 text-xs rounded border font-bold text-amber-400 ${inputStyle}`}
                    title="Initiative macro call (#INIT)"
                  />
                </div>

                {/* Character Speed Input (Spec #44) */}
                <FieldCallTooltip callName="#SPEED" description="Base Character Speed (ft)">
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-[10px] uppercase font-bold opacity-75">Speed:</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={character.speedBase}
                      onChange={(e) => setField('speedBase', Math.max(0, parseInt(e.target.value) || 0))}
                      className={`w-12 text-center py-0.5 text-xs rounded border tabular-nums ${inputStyle}`}
                    />
                    <span className="text-[10px] opacity-60">ft</span>
                  </div>
                </FieldCallTooltip>
              </div>
            </FieldCallTooltip>

            {/* BAB Input Row & Iteratives (Spec #41, #45, #46) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center font-mono text-xs">
              {/* BAB Input ("Player Provided" footer removed per Spec #46) */}
              <FieldCallTooltip
                callName="#BAB"
                description="Base Attack Bonus"
                className="sm:col-span-5 p-2 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-between w-full"
              >
                <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300 cursor-help">
                  Base Attack (BAB)
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold opacity-60">+</span>
                  <input
                    type="number"
                    value={character.baseAttackBonus}
                    onChange={(e) => setField('baseAttackBonus', parseInt(e.target.value) || 0)}
                    className={`w-14 text-center font-mono font-black text-xl py-0.5 rounded border tabular-nums ${inputStyle}`}
                  />
                </div>
              </FieldCallTooltip>

              {/* Iterative Attack Chain Object (#BAB macro field per Spec #41 & #45) */}
              <FieldCallTooltip
                callName="#BAB"
                description="Iterative Attack Chain (#BAB)"
                className="sm:col-span-7 p-2 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 block w-full"
              >
                <div className="text-[10px] font-semibold uppercase opacity-75 mb-0.5">
                  Iterative Attack Chain
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {derived.iterativeAttacks.map((it, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold text-xs text-amber-600 dark:text-amber-400"
                    >
                      {it >= 0 ? `+${it}` : it}
                    </span>
                  ))}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold ml-auto">
                    #BAB
                  </span>
                </div>
              </FieldCallTooltip>
            </div>

            {/* CMB & CMD Maneuvers Grid (Spec #47, #48, #49) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
              {/* CMB Box: #CMB centered, formula breakdown in hover tooltip */}
              <FieldCallTooltip
                callName="#CMB"
                description={`CMB = STR (${derived.strMod >= 0 ? `+${derived.strMod}` : derived.strMod}) + BAB (+${character.baseAttackBonus}) + SIZE (+0) + Misc (${character.cmbMiscMod || 0})`}
                className="p-2.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex flex-col justify-between min-w-0 overflow-hidden w-full"
              >
                <div className="flex items-center justify-between gap-1.5 mb-1 min-w-0">
                  <span className="font-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-300 cursor-help leading-tight">
                    CMB (Maneuver Bonus)
                  </span>
                  <button
                    type="button"
                    onClick={() => onRollFormula(`1d20+${derived.cmbTotal}`, 'Combat Maneuver Bonus (CMB)')}
                    className="p-1 rounded hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0"
                  >
                    <Dices className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 my-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => onRollFormula(`1d20+${derived.cmbTotal}`, 'CMB Check')}
                    className="font-mono font-black text-xl sm:text-2xl text-amber-600 dark:text-amber-400 hover:underline text-left shrink-0"
                  >
                    {derived.cmbTotal >= 0 ? `+${derived.cmbTotal}` : derived.cmbTotal}
                  </button>
                  <div className="flex justify-center flex-1 min-w-0">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold cursor-help shrink-0">
                      #CMB
                    </span>
                  </div>
                  <div className="w-6 shrink-0" />
                </div>

                <div className="text-[10px] opacity-80 pt-1 border-t border-black/10 dark:border-white/10">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">CMB Misc:</span>
                    <input
                      type="number"
                      value={character.cmbMiscMod || 0}
                      onChange={(e) => setField('cmbMiscMod', parseInt(e.target.value) || 0)}
                      className={`w-12 text-center py-0.5 text-xs rounded border shrink-0 ${inputStyle}`}
                    />
                  </div>
                </div>
              </FieldCallTooltip>

              {/* CMD Box: User input for CMD, #CMD centered, formula breakdown in hover tooltip */}
              <FieldCallTooltip
                callName="#CMD"
                description={`CMD = 10 + BAB (+${character.baseAttackBonus}) + STR (${derived.strMod >= 0 ? `+${derived.strMod}` : derived.strMod}) + DEX (${derived.dexMod >= 0 ? `+${derived.dexMod}` : derived.dexMod}) + SIZE (+0) + Misc (${character.cmdMiscMod ?? character.acMiscMod})`}
                className="p-2.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex flex-col justify-between min-w-0 overflow-hidden w-full"
              >
                <div className="flex items-center justify-between gap-1 mb-1 min-w-0">
                  <span className="font-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-300 cursor-help leading-tight min-w-0">
                    CMD (Defense)
                  </span>
                  <div className="inline-flex rounded border border-black/15 dark:border-white/15 overflow-hidden text-[8px] sm:text-[9px] shrink-0">
                    {(['STR', 'DEX', 'BOTH'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setField('cmdAbilityChoice', mode)}
                        className={`px-1 py-0.5 transition-colors whitespace-nowrap ${
                          (character.cmdAbilityChoice || 'STR') === mode
                            ? 'bg-amber-600 text-slate-950 font-bold'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {mode === 'BOTH' ? 'STR+DEX' : mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 my-1.5 min-w-0">
                  <div className="flex items-center shrink-0">
                    <input
                      type="number"
                      value={character.cmdManualOverride ?? derived.cmdTotal}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setField('cmdManualOverride', undefined);
                        } else {
                          setField('cmdManualOverride', parseInt(raw, 10) || 0);
                        }
                      }}
                      className={`w-12 sm:w-14 text-center font-mono font-black text-lg sm:text-xl py-0.5 rounded border text-amber-600 dark:text-amber-400 ${inputStyle}`}
                      title="User-editable CMD value"
                    />
                  </div>
                  <div className="flex justify-center flex-1 min-w-0">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold cursor-help shrink-0">
                      #CMD
                    </span>
                  </div>
                  <div className="w-6 text-right shrink-0">
                    {character.cmdManualOverride !== undefined && (
                      <button
                        type="button"
                        onClick={() => setField('cmdManualOverride', undefined)}
                        className="text-[9px] opacity-60 hover:opacity-100"
                        title="Reset to calculated CMD"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[10px] opacity-80 pt-1 border-t border-black/10 dark:border-white/10">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">CMD Misc:</span>
                    <input
                      type="number"
                      value={character.cmdMiscMod ?? character.acMiscMod}
                      onChange={(e) => setField('cmdMiscMod', parseInt(e.target.value) || 0)}
                      className={`w-12 text-center py-0.5 text-xs rounded border shrink-0 ${inputStyle}`}
                    />
                  </div>
                </div>
              </FieldCallTooltip>
            </div>
          </div>

          {/* ATTACKS & WEAPONS: name + attack macro + damage macro, one roll for both */}
          {visibleModules.weapons && (
            <div className={`border rounded-lg overflow-hidden ${cardBg}`}>
              <div className={`px-3 py-2 border-b flex items-center justify-between ${headerBg}`}>
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-xs uppercase tracking-wider">
                    Attacks &amp; Weapons
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addWeapon}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Attack / Weapon</span>
                </button>
              </div>

              <div className="p-3 space-y-2.5">
                {character.weapons.length === 0 ? (
                  <div className="p-4 text-center text-xs opacity-60">
                    No attacks added. Click "Add Attack / Weapon" to add an attack roll.
                  </div>
                ) : (
                  character.weapons.map((wp) => {
                    const attackMacro = defaultAttackFormula(wp);
                    const evaluatedAttack = evaluateWeaponMacro(attackMacro, '1d20');
                    const evaluatedDamage = evaluateWeaponMacro(wp.damageFormula, '1d8');

                    return (
                      <div
                        key={wp.id}
                        className="p-2.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <input
                              type="text"
                              value={wp.name}
                              onChange={(e) => updateWeapon(wp.id, { name: e.target.value })}
                              placeholder="Weapon Name"
                              className={`w-full font-bold text-xs px-2 py-0.5 rounded border ${inputStyle}`}
                            />
                            <div className="flex items-center gap-1">
                              <span className="w-8 shrink-0 text-[10px] font-mono opacity-75">
                                Atk:
                              </span>
                              <input
                                type="text"
                                value={attackMacro}
                                onChange={(e) =>
                                  updateWeapon(wp.id, { attackFormula: e.target.value })
                                }
                                placeholder="[1d20+#MATTACK]"
                                className={`w-full font-mono text-xs px-1.5 py-0.5 rounded border ${inputStyle}`}
                                title={`Evaluates to: ${evaluatedAttack}`}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-8 shrink-0 text-[10px] font-mono opacity-75">
                                Dmg:
                              </span>
                              <input
                                type="text"
                                value={wp.damageFormula}
                                onChange={(e) =>
                                  updateWeapon(wp.id, { damageFormula: e.target.value })
                                }
                                placeholder="[1d8+#STR]"
                                className={`w-full font-mono text-xs px-1.5 py-0.5 rounded border ${inputStyle}`}
                                title={`Evaluates to: ${evaluatedDamage}`}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                onRollFormula(
                                  `${wp.name} Attack: ${evaluatedAttack}\n${wp.name} Damage: ${evaluatedDamage}`,
                                  wp.name
                                )
                              }
                              className="p-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                              title={`Roll ${wp.name} attack and damage`}
                            >
                              <Dices className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeWeapon(wp.id)}
                              className="p-1 rounded hover:bg-red-500/20 text-red-500 transition-colors"
                              title="Delete Attack"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (lg:col-span-6): HP & Vitals, AC & Defenses, Saves */}
        <div className="lg:col-span-6 min-w-0 space-y-4">
          {/* 3. HIT POINTS & VITALS (Spec #17, #23-#38) */}
          <div className={`border rounded-lg p-3.5 ${cardBg} space-y-3`}>
            {/* Header: Clickable Heart resets HP to max, Disabled/Staggered status badge retained */}
            <div className="flex items-center justify-between border-b pb-2 border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToMax}
                  className="p-1 rounded hover:bg-rose-500/20 text-rose-500 transition-colors"
                  title="Click heart to restore HP to Maximum and clear Nonlethal"
                >
                  <Heart className="w-4 h-4 fill-rose-500/30" />
                </button>
                <span className="font-bold text-xs uppercase tracking-wider">
                  Hit Points &amp; Vitals
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${derived.hpStatus.color}`}>
                  {derived.hpStatus.label}
                </span>
              </div>
            </div>

            {/* Primary HP Row: HP Bar in header space + Current/Max + Nonlethal beside Max HP + TEMP HP */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* [Current / Max HP + Nonlethal] - 8 cols (Spec #24, #31, #38) */}
              <FieldCallTooltip
                callName="#HP"
                description="Current Hit Points (#HP) / Maximum Hit Points (#MAXHP)"
                className="sm:col-span-8 p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex flex-col justify-between gap-2.5 w-full"
              >
                {/* HP Bar placed in the header space instead of redundant label text (Spec #24) */}
                <div className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 bg-black/15 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        character.hpCurrent <= 0
                          ? 'bg-rose-600'
                          : character.hpCurrent <=
                            derived.hpBreakdownDetails.calculatedTotalMaxHP * 0.3
                          ? 'bg-orange-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round(
                              (character.hpCurrent /
                                Math.max(1, derived.hpBreakdownDetails.calculatedTotalMaxHP)) *
                                100
                            )
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono opacity-75 tabular-nums">
                    {derived.hpBreakdownDetails.calculatedTotalMaxHP > 0
                      ? `${Math.round(
                          (character.hpCurrent /
                            Math.max(1, derived.hpBreakdownDetails.calculatedTotalMaxHP)) *
                            100
                        )}%`
                      : '0%'}
                  </span>
                </div>

                {/* Distributed HP Controls + Nonlethal right of Max HP (Spec #31 & #38) */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={character.hpCurrent}
                      onChange={(e) => setField('hpCurrent', parseInt(e.target.value) || 0)}
                      className={`w-20 text-center font-mono font-black text-2xl py-1 rounded border tabular-nums ${inputStyle} ${
                        character.hpCurrent < 0 ? 'text-rose-600 font-black' : ''
                      }`}
                    />
                    <span className="text-2xl font-bold opacity-40">/</span>
                    <FieldCallTooltip callName="#MAXHP" description="Maximum Hit Points">
                      <span className="font-mono font-black text-2xl tabular-nums text-amber-600 dark:text-amber-400 cursor-help">
                        {derived.hpBreakdownDetails.calculatedTotalMaxHP}
                      </span>
                    </FieldCallTooltip>
                    <span className="text-xs font-mono opacity-60">HP</span>
                  </div>

                  {/* Nonlethal moved beside Max HP (Spec #38) */}
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="text-[10px] uppercase opacity-75">Nonlethal:</span>
                    <input
                      type="number"
                      min="0"
                      value={character.hpNonlethal}
                      onChange={(e) =>
                        setField('hpNonlethal', Math.max(0, parseInt(e.target.value) || 0))
                      }
                      className={`w-14 text-center py-1 rounded border font-bold tabular-nums ${inputStyle}`}
                    />
                  </div>
                </div>
              </FieldCallTooltip>

              {/* [TEMP HP] - 4 cols (Spec #25: labeled "TEMP HP", no sparkle star, no footer text) */}
              <FieldCallTooltip
                callName="#THP"
                description="Temporary Hit Points"
                className="sm:col-span-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex flex-col justify-center gap-1.5 w-full"
              >
                <div className="text-[11px] font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase text-center">
                  TEMP HP
                </div>
                <input
                  type="number"
                  min="0"
                  value={character.hpTemp}
                  onChange={(e) =>
                    setField('hpTemp', Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className={`w-full text-center font-mono font-black text-2xl py-1 rounded border tabular-nums text-cyan-600 dark:text-cyan-400 ${inputStyle}`}
                />
              </FieldCallTooltip>
            </div>

            {/* Death Saves + Shared Heal/Damage Controls (Heal on top, Damage on bottom per Spec #34-#37) */}
            <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
              {/* 3 Death Saves Checkboxes */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-[11px] uppercase opacity-75">Death Saves:</span>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((idx) => {
                    const isChecked = Boolean(character.deathSaves?.[idx]);
                    return (
                      <label
                        key={idx}
                        className="inline-flex items-center gap-1 cursor-pointer select-none px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDeathSave(idx)}
                          className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 border-black/30 dark:border-white/30"
                        />
                        <span
                          className={`text-[10px] font-bold ${
                            isChecked ? 'text-rose-600 dark:text-rose-400' : 'opacity-40'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Shared numeric input for Heal (top, +) and Damage (bottom, -) (Spec #34, #35, #36) */}
              <div className="flex items-center gap-2 ml-auto">
                <input
                  type="number"
                  min="1"
                  value={healthDeltaInput}
                  onChange={(e) =>
                    setHealthDeltaInput(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  className={`w-16 text-center py-1.5 text-sm font-bold rounded border tabular-nums ${inputStyle}`}
                  title="Shared amount for Heal (+) and Damage (-)"
                />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => applyHealing(healthDeltaInput)}
                    className="px-3 py-0.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-700 rounded font-bold flex items-center justify-center transition-colors"
                    title="Heal (+)"
                    aria-label="Heal"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDamage(healthDeltaInput)}
                    className="px-3 py-0.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700 rounded font-bold flex items-center justify-center transition-colors"
                    title="Damage (-)"
                    aria-label="Damage"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Vitals Macro Maker & HP Breakdown Inputs (Spec #23, #26-#33) */}
            <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2.5 font-mono text-xs">
              {/* Auto-populating Programmable HP Macro Bar + Bonus Source */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={activeHpMacro}
                  onChange={(e) =>
                    updateHpBreakdownFields({ customMacro: e.target.value }, true)
                  }
                  className={`flex-1 px-2 py-1 rounded border text-xs font-mono text-amber-400 ${inputStyle}`}
                  title="Auto-populated HP Macro (direct player edits take priority)"
                />
                {character.hpBreakdown?.isCustomMacroManual && (
                  <button
                    type="button"
                    onClick={() =>
                      setField('hpBreakdown', {
                        ...character.hpBreakdown,
                        customMacro: DEFAULT_AUTO_HP_MACRO,
                        isCustomMacroManual: false,
                      })
                    }
                    className="p-1 rounded border border-black/15 dark:border-white/15 opacity-75 hover:opacity-100"
                    title="Reset HP macro to automatic sync"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Bonus Sources Tags */}
              {(character.hpBreakdown?.additionalBonuses || []).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(character.hpBreakdown?.additionalBonuses || []).map((bonus) => (
                    <span
                      key={bonus.id}
                      className="inline-flex items-center gap-1 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-800 dark:text-amber-200 text-[11px]"
                    >
                      <span>
                        +{bonus.amount} "{bonus.source}"
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAdditionalHpBonus(bonus.id)}
                        className="text-red-400 hover:text-red-600 ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* 4 Editable Vitals Inputs: HD Size (with Calc Mode directly beneath), Ability Bonus, HD Bonus, Static Bonus (Spec #26 & #30) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 text-[10px] sm:text-[11px] items-start">
                <div className="flex flex-col min-w-0 space-y-1">
                  <div className="flex items-baseline justify-between gap-1 min-w-0 leading-tight">
                    <span className="opacity-75 truncate">HD Size:</span>
                    <span className="text-[9px] opacity-55 truncate">&lt;&lt;HDmath</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={character.hpBreakdown?.hitDiceSize ?? 0}
                    onChange={(e) =>
                      updateHpBreakdownFields({
                        hitDiceSize: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className={`w-full text-center py-0.5 rounded border ${inputStyle}`}
                  />
                  {/* HP Calculation Mode Switches directly under the HD input field (Spec #30) */}
                  <div className="grid grid-cols-3 rounded border border-black/15 dark:border-white/15 overflow-hidden text-[8px] sm:text-[9px]">
                    {(['average', 'max', 'rolled'] as const).map((method) => {
                      const isActive = (character.hpBreakdown?.calcMethod || 'max') === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            if (method === 'rolled') {
                              rollHitDice();
                            } else {
                              updateHpBreakdownFields({ calcMethod: method });
                            }
                          }}
                          className={`py-0.5 capitalize transition-colors truncate ${
                            isActive
                              ? 'bg-amber-600 text-slate-950 font-bold'
                              : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-75'
                          }`}
                        >
                          {method === 'average' ? 'Avg' : method === 'max' ? 'Max' : 'Roll'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col min-w-0 space-y-1">
                  <div className="flex items-baseline justify-between gap-1 min-w-0 leading-tight">
                    <span className="opacity-75 truncate">Ability:</span>
                    <span className="text-[9px] opacity-55 truncate">#CON</span>
                  </div>
                  <input
                    type="number"
                    value={character.hpBreakdown?.abilityBonus ?? derived.conMod}
                    onChange={(e) =>
                      updateHpBreakdownFields({
                        abilityBonus: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className={`w-full text-center py-0.5 rounded border ${inputStyle}`}
                  />
                </div>

                <div className="flex flex-col min-w-0 space-y-1">
                  <div className="flex items-baseline justify-between gap-1 min-w-0 leading-tight">
                    <span className="opacity-75 truncate">HD Bonus:</span>
                    <span className="text-[9px] opacity-55 truncate">&lt;&lt;HDbonus</span>
                  </div>
                  <input
                    type="number"
                    value={character.hpBreakdown?.hdBonus ?? 0}
                    onChange={(e) =>
                      updateHpBreakdownFields({
                        hdBonus: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className={`w-full text-center py-0.5 rounded border ${inputStyle}`}
                  />
                </div>

                <div className="flex flex-col min-w-0 space-y-1">
                  <div className="flex items-baseline justify-between gap-1 min-w-0 leading-tight">
                    <span className="opacity-75 truncate">Static:</span>
                    <span className="text-[9px] opacity-55 truncate">&lt;&lt;BhP</span>
                  </div>
                  <input
                    type="number"
                    value={character.hpBreakdown?.staticBonus ?? 0}
                    onChange={(e) =>
                      updateHpBreakdownFields({
                        staticBonus: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className={`w-full text-center py-0.5 rounded border ${inputStyle}`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Armor Class & Defenses Block */}
          <div className={`border rounded-lg p-3.5 ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-1.5 mb-2 border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Armor Class &amp; Defenses
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <FieldCallTooltip callName="#SPEED" description="Base Speed">
                  <span className="cursor-help">Speed: {character.speedBase} ft</span>
                </FieldCallTooltip>
              </div>
            </div>

            {/* Big 3 AC metrics */}
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <FieldCallTooltip
                callName="#AC"
                description={`Total AC: 10 + Armor (+${derived.totalArmorBonus}) + DEX (+${derived.effectiveDexModForAC}) + Misc (+${derived.totalAcMiscBonus})`}
                className="p-2 rounded bg-amber-500/10 border border-amber-500/30 block w-full"
              >
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 cursor-help block">
                  Total AC
                </span>
                <div className="text-2xl font-mono font-black tabular-nums cursor-help">
                  {derived.acTotal}
                </div>
              </FieldCallTooltip>
              <FieldCallTooltip
                callName="#TOUCH"
                description="Touch Armor Class"
                className="p-2 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 block w-full"
              >
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 cursor-help block">
                  Touch AC
                </span>
                <div className="text-2xl font-mono font-black tabular-nums cursor-help">
                  {derived.touchAC}
                </div>
              </FieldCallTooltip>
              <FieldCallTooltip
                callName="#FF"
                description="Flat-Footed Armor Class"
                className="p-2 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 block w-full"
              >
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 cursor-help block">
                  Flat-Footed
                </span>
                <div className="text-2xl font-mono font-black tabular-nums cursor-help">
                  {derived.flatFootedAC}
                </div>
              </FieldCallTooltip>
            </div>

            {/* Mathematical Breakdown Row */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono p-2 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
              <div className="p-1 rounded bg-black/10 dark:bg-white/10">
                <span className="text-[9px] uppercase opacity-75 block">Base</span>
                <div className="font-bold text-sm">10</div>
              </div>

              <div className="p-1 rounded bg-amber-500/15 border border-amber-500/30">
                <span className="text-[9px] uppercase font-bold text-amber-700 dark:text-amber-300 block">
                  Armor Bonus
                </span>
                <div className="font-bold text-sm text-amber-700 dark:text-amber-300">
                  +{derived.totalArmorBonus}
                </div>
              </div>

              <div className="p-1 rounded bg-black/10 dark:bg-white/10">
                <span className="text-[9px] uppercase opacity-75 block">Dex ASB</span>
                <div className="font-bold text-sm">
                  {derived.effectiveDexModForAC >= 0
                    ? `+${derived.effectiveDexModForAC}`
                    : derived.effectiveDexModForAC}
                </div>
              </div>

              <div className="p-1 rounded bg-black/10 dark:bg-white/10">
                <span className="text-[9px] uppercase opacity-75 block">Misc / Other</span>
                <div className="font-bold text-sm">
                  {derived.totalAcMiscBonus >= 0
                    ? `+${derived.totalAcMiscBonus}`
                    : derived.totalAcMiscBonus}
                </div>
              </div>
            </div>

            {/* Small Misc AC Macro Box across the bottom of the slate (Natural Armor, Deflection, and Dodge are handled in Buff Box) */}
            <div className="pt-2">
              <div className="flex items-center gap-2 p-2 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs font-mono min-w-0">
                <span className="text-[10px] uppercase font-bold opacity-75 shrink-0">
                  Misc AC:
                </span>
                <input
                  type="text"
                  value={character.acMiscMacro ?? String(character.acMiscMod || 0)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const evalRes = evaluateFormula(raw || '0', formulaContext);
                    const parsed = parseInt(evalRes.evaluated, 10);
                    const fallback = parseInt(raw, 10);
                    const resolvedMod = !Number.isNaN(parsed)
                      ? parsed
                      : !Number.isNaN(fallback)
                      ? fallback
                      : 0;
                    onUpdateCharacter((prev) => ({
                      ...prev,
                      acMiscMacro: raw,
                      acMiscMod: resolvedMod,
                    }));
                  }}
                  placeholder="0 or macro (e.g. #WIS)"
                  className={`flex-1 min-w-0 px-2 py-0.5 rounded border text-xs font-mono text-amber-400 ${inputStyle}`}
                  title="Macro-sensitive Misc AC bonus (other armor bonuses like Natural Armor, Deflection, and Dodge are managed in the Buff Box)"
                />
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold shrink-0">
                  {character.acMiscMod >= 0 ? `+${character.acMiscMod}` : character.acMiscMod}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Saving Throws (#FORT, #REF, #WILL preserved with base-stat components per Spec #54) */}
          <div className={`border rounded-lg p-3.5 ${cardBg} space-y-2`}>
            <div className="flex items-center justify-between border-b pb-1.5 border-black/10 dark:border-white/10">
              <span className="font-bold text-xs uppercase tracking-wider">Saving Throws</span>
              <span className="text-[10px] opacity-75 font-mono">
                Macros: #FORT, #REF, #WILL
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  key: 'fortitude' as const,
                  name: 'Fortitude',
                  abName: 'CON',
                  asb: derived.conMod,
                  macroCall: '#FORT',
                  total: derived.fortitudeTotal,
                  saveObj: character.saves.fortitude,
                },
                {
                  key: 'reflex' as const,
                  name: 'Reflex',
                  abName: 'DEX',
                  asb: derived.dexMod,
                  macroCall: '#REF',
                  total: derived.reflexTotal,
                  saveObj: character.saves.reflex,
                },
                {
                  key: 'will' as const,
                  name: 'Will',
                  abName: 'WIS',
                  asb: derived.wisMod,
                  macroCall: '#WILL',
                  total: derived.willTotal,
                  saveObj: character.saves.will,
                },
              ].map((save) => (
                <FieldCallTooltip
                  key={save.key}
                  callName={save.macroCall}
                  description={`${save.name} Save = Base (${save.saveObj.base}) + ${save.abName} (${save.asb >= 0 ? `+${save.asb}` : save.asb})`}
                  className="p-2.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex flex-col justify-between text-center font-mono w-full"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold uppercase tracking-wider opacity-80 cursor-help">
                      {save.name}
                    </span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold cursor-help hover:underline">
                      {save.macroCall}
                    </span>
                  </div>

                  <input
                    type="number"
                    value={save.total}
                    onChange={(e) => {
                      const total = parseInt(e.target.value, 10) || 0;
                      onUpdateCharacter((prev) => ({
                        ...prev,
                        saves: {
                          ...prev.saves,
                          [save.key]: {
                            ...prev.saves[save.key],
                            miscMod: total - (save.total - save.saveObj.miscMod),
                          },
                        },
                      }));
                    }}
                    aria-label={`${save.name} saving throw total`}
                    className={`my-1.5 w-full min-w-0 px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded font-black text-xl text-center tabular-nums ${inputStyle}`}
                  />

                  {/* Base & Ability Component */}
                  <div className="text-[10px] space-y-1 pt-1 border-t border-black/10 dark:border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="opacity-75">Base: {save.saveObj.base}</span>
                      <button
                        type="button"
                        onClick={() =>
                          onRollFormula(
                            `1d20+${save.total}`,
                            `${save.name} Save (${save.abName} ASB ${
                              save.asb >= 0 ? `+${save.asb}` : save.asb
                            })`
                          )
                        }
                        aria-label={`Roll ${save.name} save`}
                        title={`Roll ${save.name} save`}
                        className="w-11 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center hover:bg-amber-500/20 transition-colors"
                      >
                        <Dices className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[9px] opacity-75 text-left">
                      + {save.abName} ({save.asb >= 0 ? `+${save.asb}` : save.asb})
                      {save.saveObj.magicMod !== 0 && ` + Magic (${save.saveObj.magicMod})`}
                    </div>
                  </div>
                </FieldCallTooltip>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Armor & Protective Items */}
      {visibleModules.armor && (
        <div className={`border rounded-lg overflow-hidden ${cardBg}`}>
          <div className={`px-4 py-2 border-b flex items-center justify-between ${headerBg}`}>
            <span className="font-bold text-xs uppercase tracking-wider">
              Armor &amp; Protective Items
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono opacity-75">
                Total Check Penalty: {derived.armorCheckPenaltyTotal} | Max Dex:{' '}
                {derived.maxDexAllowance}
              </span>
              <button
                type="button"
                onClick={addArmor}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Armor</span>
              </button>
            </div>
          </div>

          <div className="p-3">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-[10px] uppercase opacity-75">
                  <th className="pb-1 w-8 text-center">Worn</th>
                  <th className="pb-1">Item Name</th>
                  <th className="pb-1 text-center">Type</th>
                  <th className="pb-1 text-center font-bold">AC Bonus</th>
                  <th className="pb-1 text-center">Max Dex</th>
                  <th className="pb-1 text-center">ACP</th>
                  <th className="pb-1 text-center">Spell Fail</th>
                  <th className="pb-1 text-center">Weight</th>
                  <th className="pb-1 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {character.armor.map((ar) => (
                  <tr key={ar.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={ar.isEquipped}
                        onChange={(e) => updateArmor(ar.id, { isEquipped: e.target.checked })}
                        className="rounded text-amber-500"
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="text"
                        value={ar.name}
                        onChange={(e) => updateArmor(ar.id, { name: e.target.value })}
                        className={`w-full font-semibold text-xs px-2 py-0.5 rounded border ${inputStyle}`}
                      />
                    </td>
                    <td className="py-1.5 text-center">
                      <select
                        value={ar.type}
                        onChange={(e) => updateArmor(ar.id, { type: e.target.value as any })}
                        className={`text-xs px-1 py-0.5 rounded border ${inputStyle}`}
                      >
                        <option value="Light">Light</option>
                        <option value="Medium">Medium</option>
                        <option value="Heavy">Heavy</option>
                        <option value="Shield">Shield</option>
                        <option value="Other">Other</option>
                      </select>
                    </td>
                    <td className="py-1.5 text-center">
                      <input
                        type="number"
                        value={ar.acBonus}
                        onChange={(e) =>
                          updateArmor(ar.id, { acBonus: parseInt(e.target.value) || 0 })
                        }
                        className={`w-12 text-center font-bold py-0.5 rounded border ${inputStyle}`}
                      />
                    </td>
                    <td className="py-1.5 text-center">
                      <input
                        type="number"
                        value={ar.maxDex}
                        onChange={(e) =>
                          updateArmor(ar.id, { maxDex: parseInt(e.target.value) || 0 })
                        }
                        className={`w-12 text-center py-0.5 rounded border ${inputStyle}`}
                      />
                    </td>
                    <td className="py-1.5 text-center">
                      <input
                        type="number"
                        value={ar.checkPenalty}
                        onChange={(e) =>
                          updateArmor(ar.id, { checkPenalty: parseInt(e.target.value) || 0 })
                        }
                        className={`w-12 text-center py-0.5 rounded border ${inputStyle}`}
                      />
                    </td>
                    <td className="py-1.5 text-center text-xs">{ar.spellFailure}%</td>
                    <td className="py-1.5 text-center text-xs">{ar.weight} lbs</td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeArmor(ar.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
