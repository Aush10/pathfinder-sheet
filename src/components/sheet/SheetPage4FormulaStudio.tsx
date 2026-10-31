import React, { useState } from 'react';
import {
  Code,
  Plus,
  Trash2,
  Play,
  Dices,
  Sparkles,
  Zap,
  HelpCircle,
  Check,
} from 'lucide-react';
import { PF1Character, CustomFormulaObject } from '../../types/character';
import {
  evaluateFormula,
  buildFormulaContext,
  tokenizeFormula,
  FormulaToken,
} from '../../engine/formula';
import { evaluateConditions } from '../../engine/pf1eMath';

interface SheetPage4FormulaStudioProps {
  character: PF1Character;
  theme: string;
  fontClass: string;
  onUpdateCharacter: (updater: (prev: PF1Character) => PF1Character) => void;
  onRollFormula: (formula: string, label?: string) => void;
}

export const SheetPage4FormulaStudio: React.FC<SheetPage4FormulaStudioProps> = ({
  character,
  theme,
  fontClass,
  onUpdateCharacter,
  onRollFormula,
}) => {
  const [testExpression, setTestExpression] = useState('mainattack_with_fire');
  const [scratchpadText, setScratchpadText] = useState(
    `# Valerius Combat Notes & Custom Equations
- Fire breath attack: {firebreath}
- Base melee: {mainattack}
- Combined combo: {mainattack_with_fire}
- Flurry of claws: {claws_full_attack}
- Power attack scaling damage: +{power_attack_dmg}`
  );

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

  // Context for live evaluation
  const cond = evaluateConditions(character.conditions);
  const context = buildFormulaContext(character, cond);

  const setField = <K extends keyof PF1Character>(key: K, value: PF1Character[K]) => {
    onUpdateCharacter((prev) => ({ ...prev, [key]: value }));
  };

  const addCustomObject = () => {
    const newObj: CustomFormulaObject = {
      id: `obj-${Date.now()}`,
      name: `custom_ability_${character.customObjects.length + 1}`,
      description: 'Player defined mathematical or combat formula object',
      formula: '1d6 + (2 * floor(level / 3)) + " force"',
      category: 'Damage',
    };
    setField('customObjects', [...character.customObjects, newObj]);
  };

  const removeCustomObject = (id: string) => {
    setField(
      'customObjects',
      character.customObjects.filter((o) => o.id !== id)
    );
  };

  const updateCustomObject = (id: string, updates: Partial<CustomFormulaObject>) => {
    setField(
      'customObjects',
      character.customObjects.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
  };

  // Render colored tokens for an expression
  const renderSyntaxHighlightedTokens = (formula: string) => {
    const tokens = tokenizeFormula(formula);
    return (
      <div className="flex flex-wrap items-center font-mono text-xs">
        {tokens.map((tok, idx) => {
          let colorClass = 'text-slate-300';
          if (tok.type === 'dice') colorClass = 'text-amber-400 font-bold';
          else if (tok.type === 'number') colorClass = 'text-cyan-400 font-semibold';
          else if (tok.type === 'operator') colorClass = 'text-sky-300 font-bold';
          else if (tok.type === 'function') colorClass = 'text-pink-400 font-bold';
          else if (tok.type === 'variable') colorClass = 'text-purple-300 font-semibold underline decoration-dotted';
          else if (tok.type === 'string') colorClass = 'text-emerald-400 font-serif';
          else if (tok.type === 'punctuation') colorClass = 'text-slate-400';

          return (
            <span key={idx} className={colorClass}>
              {tok.value}
            </span>
          );
        })}
      </div>
    );
  };

  // Live tester outcome
  const testOutcome = evaluateFormula(testExpression, context);

  // Scratchpad interpolation: replace {formula} with evaluated result
  const renderInterpolatedScratchpad = (text: string) => {
    return text.replace(/\{([^{}]+)\}/g, (_match, expr) => {
      const res = evaluateFormula(expr, context);
      return res.evaluated;
    });
  };

  return (
    <div className={`space-y-4 ${fontClass} transition-colors duration-200`}>
      {/* 1. Header Banner & DSL Documentation */}
      <div className={`border rounded-lg p-4 ${cardBg}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-sm uppercase tracking-wider">
              Player-Friendly Formula & Object Studio (DSL)
            </h3>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
            Reactive PF1e Object Engine
          </span>
        </div>
        <p className="text-xs opacity-80 leading-relaxed mb-3">
          Create named objects and functions that scale automatically with your character level, ability modifiers, and equipment.
          Reference previous abilities (e.g. <code>mainattack + " and " + firebreath</code>) to build concatenated multi-damage strings.
        </p>

        {/* Quick syntax reference guide */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono p-2.5 rounded bg-black/10 dark:bg-black/40 border border-black/10 dark:border-white/10">
          <div>
            <span className="font-bold text-purple-400">Variables:</span> level, bab, str_mod, dex_mod, con_mod, int_mod, wis_mod, cha_mod, hp_max
          </div>
          <div>
            <span className="font-bold text-pink-400">Functions:</span> floor(x), round(x), ceil(x), min(a,b), max(a,b), abs(x)
          </div>
          <div>
            <span className="font-bold text-amber-400">Dice:</span> 1d20, 2d6, 3d8, 1d10
          </div>
          <div>
            <span className="font-bold text-emerald-400">Strings:</span> " fire", " slashing", + concatenation
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Custom Formula Objects List (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className={`border rounded-lg overflow-hidden ${cardBg}`}>
            <div className={`px-4 py-2 border-b flex items-center justify-between ${headerBg}`}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Player-Created Formula Objects
                </span>
              </div>
              <button
                onClick={addCustomObject}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Object</span>
              </button>
            </div>

            <div className="p-3 space-y-3">
              {character.customObjects.map((obj) => {
                const evalResult = evaluateFormula(obj.formula, context);

                return (
                  <div
                    key={obj.id}
                    className="p-3 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-[11px] font-mono opacity-70">Name:</span>
                        <input
                          type="text"
                          value={obj.name}
                          onChange={(e) =>
                            updateCustomObject(obj.id, {
                              name: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                            })
                          }
                          placeholder="e.g. firebreath"
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded border text-amber-500 dark:text-amber-300 w-48 ${inputStyle}`}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={obj.category}
                          onChange={(e) =>
                            updateCustomObject(obj.id, { category: e.target.value as any })
                          }
                          className={`text-xs px-2 py-0.5 rounded border ${inputStyle}`}
                        >
                          <option value="Damage">Damage</option>
                          <option value="Attack">Attack</option>
                          <option value="Buff">Buff</option>
                          <option value="Utility">Utility</option>
                        </select>
                        <button
                          onClick={() => removeCustomObject(obj.id)}
                          className="p-1 rounded text-red-500 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Formula Input */}
                    <div>
                      <span className="text-[10px] font-mono opacity-75 block mb-1">
                        Formula Expression:
                      </span>
                      <input
                        type="text"
                        value={obj.formula}
                        onChange={(e) => updateCustomObject(obj.id, { formula: e.target.value })}
                        placeholder='e.g. 2d6 + (5 * floor(level/2)) + " fire"'
                        className={`w-full font-mono text-xs px-2 py-1 rounded border ${inputStyle}`}
                      />
                    </div>

                    {/* Syntax Highlighted Token Preview */}
                    <div className="p-2 rounded bg-black/20 dark:bg-black/60 border border-black/10 dark:border-white/5">
                      <div className="text-[10px] font-mono text-slate-400 mb-1">
                        Color Tokenized View:
                      </div>
                      {renderSyntaxHighlightedTokens(obj.formula)}
                    </div>

                    {/* Live Evaluation Outcome & Roll Action */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="opacity-70">At Level {character.level}:</span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded ${
                            evalResult.isError
                              ? 'bg-red-950/80 text-red-400 border border-red-800'
                              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {evalResult.evaluated || '(empty)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setTestExpression(obj.name)}
                          className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 text-xs font-mono"
                          title="Load in tester"
                        >
                          Test
                        </button>
                        {evalResult.rollable && (
                          <button
                            onClick={() => onRollFormula(evalResult.evaluated, obj.name)}
                            className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded flex items-center gap-1"
                          >
                            <Dices className="w-3 h-3" />
                            <span>Roll</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Formula Tester & Dynamic Scratchpad (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live Expression Tester */}
          <div className={`border rounded-lg overflow-hidden ${cardBg}`}>
            <div className={`px-4 py-2 border-b flex items-center justify-between ${headerBg}`}>
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Live Expression Tester
                </span>
              </div>
            </div>

            <div className="p-3 space-y-3">
              <div>
                <label className="block text-[11px] font-mono opacity-75 mb-1">
                  Type any formula, equation, or object name:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testExpression}
                    onChange={(e) => setTestExpression(e.target.value)}
                    placeholder="e.g. mainattack_with_fire or 10 + 3 + 2"
                    className={`flex-1 font-mono text-xs px-2 py-1.5 rounded border ${inputStyle}`}
                  />
                  {testOutcome.rollable && (
                    <button
                      onClick={() => onRollFormula(testOutcome.evaluated, testExpression)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded flex items-center gap-1"
                    >
                      <Dices className="w-3.5 h-3.5" />
                      <span>Roll</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Evaluated Result Box */}
              <div className="p-3 rounded-lg bg-black/20 dark:bg-black/60 border border-black/10 dark:border-white/10 space-y-2">
                <div className="text-[10px] font-mono text-slate-400 uppercase">
                  Evaluated Result:
                </div>
                <div className="font-mono text-sm font-bold text-amber-400 break-words">
                  {testOutcome.evaluated}
                </div>
                {testOutcome.isError && (
                  <div className="text-xs text-red-400 font-mono">{testOutcome.errorMessage}</div>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Scratchpad Notepad */}
          <div className={`border rounded-lg overflow-hidden ${cardBg}`}>
            <div className={`px-4 py-2 border-b flex items-center justify-between ${headerBg}`}>
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Live Equation Notepad
                </span>
              </div>
              <span className="text-[10px] font-mono opacity-70">Interpolates &#123;object&#125;</span>
            </div>

            <div className="p-3 space-y-3">
              <textarea
                rows={5}
                value={scratchpadText}
                onChange={(e) => setScratchpadText(e.target.value)}
                placeholder="Type notes and equations..."
                className={`w-full font-mono text-xs px-2 py-1.5 rounded border leading-relaxed ${inputStyle}`}
              />

              {/* Live Rendered Interpolation */}
              <div className="p-3 rounded-lg bg-black/10 dark:bg-black/40 border border-black/10 dark:border-white/10 space-y-1">
                <div className="text-[10px] font-mono text-slate-400 uppercase mb-1">
                  Live Resolved Output:
                </div>
                <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-200 select-text">
                  {renderInterpolatedScratchpad(scratchpadText)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
