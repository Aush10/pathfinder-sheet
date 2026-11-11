import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronRight,
  Swords,
  RotateCcw,
  Play,
} from 'lucide-react';
import { PF1Character, StepperRule } from '../../types/character';
import { DerivedCombatStats } from '../../engine/pf1eMath';

interface QuickModularToolsProps {
  character: PF1Character;
  derived: DerivedCombatStats;
  theme: string;
  fontClass: string;
  onUpdateCharacter: (updater: (prev: PF1Character) => PF1Character) => void;
  onRollFormula: (formula: string, label?: string) => void;
  visibleModules: Record<string, boolean>;
  onOpenAddClass?: () => void;
}

export const QuickModularTools: React.FC<QuickModularToolsProps> = ({
  character,
  theme,
  fontClass,
  onUpdateCharacter,
  visibleModules,
}) => {
  const [newStepperExpr] = useState('this + 1');
  const [newStepperLabel, setNewStepperLabel] = useState('');

  const isParchment = theme === 'parchment';
  const isBlueprint = theme === 'blueprint';
  const isMythWeavers = theme === 'mythweavers';

  const cardBg = isParchment
    ? 'bg-amber-50/75 border-amber-800/20 text-stone-900 shadow-sm'
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

  const setField = <K extends keyof PF1Character>(key: K, value: PF1Character[K]) => {
    onUpdateCharacter((prev) => ({ ...prev, [key]: value }));
  };

  // Advance an iterative macro expression on step: e.g. "this + 1" -> "this + 2"
  const advanceIterativeMacro = (rawText: string, delta: number = 1): string => {
    const match = rawText.match(/^(.*\bthis\s*[+-]\s*)(\d+)(.*)$/i);
    if (match) {
      const prefix = match[1];
      const currentNum = parseInt(match[2], 10) || 0;
      const suffix = match[3];
      return `${prefix}${currentNum + delta}${suffix}`;
    }
    return rawText;
  };

  const stepAllActiveSteppers = () => {
    onUpdateCharacter((prev) => {
      const existingRules = prev.stepperRules || [];
      if (existingRules.length === 0) return prev;
      const updatedRules = existingRules.map((rule) => {
        if (!rule.isActive) return rule;
        const stepDelta = rule.stepAmount || 1;
        const nextVal = (rule.currentValue ?? 0) + stepDelta;
        return {
          ...rule,
          currentValue: nextVal,
          rawText: advanceIterativeMacro(rule.rawText, Math.abs(stepDelta)),
        };
      });
      return { ...prev, stepperRules: updatedRules };
    });
  };

  // 2. Turn Stepper (Combat & Iterative Macro Stepper)
  const handleNextTurn = () => {
    const current = character.combatTracker || { round: 1, turn: 1, isInCombat: true };
    const nextTurn = (current.turn || 0) + 1;
    setField('combatTracker', {
      ...current,
      round: Math.max(1, current.round || 1),
      turn: nextTurn,
      isInCombat: true,
    });
    stepAllActiveSteppers();
  };

  const handleNextRound = () => {
    const current = character.combatTracker || { round: 1, turn: 1, isInCombat: true };
    setField('combatTracker', {
      round: (current.round || 0) + 1,
      turn: 1,
      isInCombat: true,
    });
    stepAllActiveSteppers();
  };

  const handleResetCombat = () => {
    setField('combatTracker', {
      round: 0,
      turn: 0,
      isInCombat: false,
    });
  };

  const handleAddStepper = () => {
    const expr = newStepperExpr.trim() || 'this + 1';
    const label = newStepperLabel.trim() || `Stepper ${(character.stepperRules || []).length + 1}`;
    const newRule: StepperRule = {
      id: `step-${Date.now()}`,
      rawText: expr,
      type: 'track',
      label,
      currentValue: 1,
      stepAmount: 1,
      isActive: true,
    };
    setField('stepperRules', [...(character.stepperRules || []), newRule]);
    setNewStepperLabel('');
  };

  const handleStepSingleRule = (id: string) => {
    const existing = character.stepperRules || [];
    setField(
      'stepperRules',
      existing.map((r) =>
        r.id === id
          ? {
              ...r,
              currentValue: (r.currentValue ?? 0) + (r.stepAmount || 1),
              rawText: advanceIterativeMacro(r.rawText, Math.abs(r.stepAmount || 1)),
            }
          : r
      )
    );
  };

  const handleRemoveStepper = (id: string) => {
    setField(
      'stepperRules',
      (character.stepperRules || []).filter((r) => r.id !== id)
    );
  };

  return (
    <div className={`space-y-4 ${fontClass}`}>
      {/* ITERATIVE MACRO STEPPER ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TURN & ITERATIVE MACRO STEPPER (Configurable number of steppers per spec #13 & #14) */}
        {visibleModules.turnStepper !== false && (
          <div className={`pf1-hidden-turn-stepper border rounded-lg p-3 ${cardBg} space-y-2`}>
            <div className={`px-2 py-1 border-b flex items-center justify-between ${headerBg}`}>
              <div className="flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-rose-500" />
                <span className="font-bold text-xs uppercase tracking-wider">Turn &amp; Round Stepper</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddStepper}
                  className="px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold flex items-center gap-0.5"
                  title="Add an iterative macro stepper (e.g. this + 1 -> this + 2)"
                >
                  <Plus className="w-3 h-3" />
                  <span>Stepper</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetCombat}
                  className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  title="Reset round counter"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 font-mono">
              <div>
                <span className="text-xl font-black text-rose-500 tabular-nums">
                  Round {character.combatTracker?.round || 0}
                </span>
                <span className="text-[10px] opacity-70 ml-2">
                  Turn {character.combatTracker?.turn || 0}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNextTurn}
                  className="px-2.5 py-1 bg-black/5 dark:bg-white/10 hover:bg-black/15 text-xs font-bold rounded border border-black/10 dark:border-white/10 flex items-center gap-1 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  <span>Next Turn</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextRound}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded shadow-xs flex items-center gap-1 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>Next Round</span>
                </button>
              </div>
            </div>

            {/* Configurable Iterative Steppers List (e.g. this + 1 -> this + 2) */}
            {(character.stepperRules || []).length > 0 && (
              <div className="pt-1.5 border-t border-black/10 dark:border-white/10 space-y-1 font-mono text-[11px]">
                {(character.stepperRules || []).map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10"
                  >
                    <input
                      type="text"
                      value={rule.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setField(
                          'stepperRules',
                          (character.stepperRules || []).map((r) =>
                            r.id === rule.id ? { ...r, label: val } : r
                          )
                        );
                      }}
                      className={`w-24 px-1 py-0.5 rounded border text-[10px] font-bold ${inputStyle}`}
                      placeholder="Label"
                    />
                    <input
                      type="text"
                      value={rule.rawText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setField(
                          'stepperRules',
                          (character.stepperRules || []).map((r) =>
                            r.id === rule.id ? { ...r, rawText: val } : r
                          )
                        );
                      }}
                      className={`flex-1 px-1.5 py-0.5 rounded border text-[10px] text-amber-400 ${inputStyle}`}
                      title="Iterative macro expression (e.g. this + 1 advances to this + 2)"
                    />
                    <button
                      type="button"
                      onClick={() => handleStepSingleRule(rule.id)}
                      className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold"
                      title="Step this macro forward"
                    >
                      Step ({rule.currentValue ?? 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveStepper(rule.id)}
                      className="p-0.5 text-red-400 hover:text-red-500"
                      title="Remove stepper"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
