import React, { useState } from 'react';
import {
  Terminal,
  Dices,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  FileText,
  HelpCircle,
  X,
  Sparkles,
  Save,
  Copy,
} from 'lucide-react';
import { PF1Character, XdxMacroEntry } from '../../types/character';
import { DerivedCombatStats } from '../../engine/pf1eMath';

interface XDXToolProps {
  isOpen: boolean;
  onClose: () => void;
  character: PF1Character;
  derived: DerivedCombatStats;
  onUpdateCharacter: (updater: (prev: PF1Character) => PF1Character) => void;
  isDocked?: boolean;
}

interface RollLogItem {
  id: string;
  timestamp: string;
  rawInput: string;
  resultOutput: string;
  appliedPushes?: string[];
}

export const XDXTool: React.FC<XDXToolProps> = ({
  isOpen,
  onClose,
  character,
  derived,
  onUpdateCharacter,
  isDocked = false,
}) => {
  const [macroInput, setMacroInput] = useState('');
  const [rollLogs, setRollLogs] = useState<RollLogItem[]>([
    {
      id: 'log-init',
      timestamp: 'Ready',
      rawInput: '"to hit " d20+10 | 4d6+5 "fire damage"',
      resultOutput: 'to hit 22, 19 fire damage',
    },
  ]);
  const [showMemoryTxt, setShowMemoryTxt] = useState(false);
  const [memoryTxtContent, setMemoryTxtContent] = useState<string>(
    `firebreath: 2d6+(5*floor(#level/2)+1) "fire"\nmainattack: d20+#bab+#str | 1d8+#str "slashing"\npower_strike: d20+#bab+4 | 2d6+12 "bludgeoning"\npoison_save: DC+#CON "Fort save DC"\nblood_drain: "blood" >>HP-5`
  );
  const [showHelp, setShowHelp] = useState(false);

  // Saved macros list
  const savedMacros: XdxMacroEntry[] = character.xdxMacros || [
    { id: 'm-1', name: 'firebreath', formula: '2d6+(5*floor(#level/2)+1) "fire"', description: 'Dragon fire breath' },
    { id: 'm-2', name: 'mainattack', formula: 'd20+#bab+#str | 1d8+#str "slashing"', description: 'Primary weapon attack' },
    { id: 'm-3', name: 'blood_drain', formula: '"blood" >>HP-5', description: 'Drain 5 HP from character' },
    { id: 'm-4', name: 'spell_dc', formula: 'DC+#CON "Fort DC"', description: 'Standard ability DC' },
  ];

  const updateSavedMacros = (newMacros: XdxMacroEntry[]) => {
    onUpdateCharacter((prev) => ({
      ...prev,
      xdxMacros: newMacros,
    }));
  };

  // Roll single die
  const rollDie = (sides: number) => {
    if (sides <= 1) return 1;
    return Math.floor(Math.random() * sides) + 1;
  };

  // Roll dice expression e.g. "10d6" or "1d20"
  const evaluateDiceExpr = (expr: string): number => {
    const match = expr.match(/^(\d*)[dD](\d+)$/);
    if (!match) return 0;
    const count = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]) || 6;
    let sum = 0;
    for (let i = 0; i < count; i++) {
      sum += rollDie(sides);
    }
    return sum;
  };

  // Get sheet call value
  const getCallValue = (token: string): number | null => {
    const clean = token.replace(/^#/, '').toUpperCase();
    switch (clean) {
      case 'HP':
        return character.hpCurrent;
      case 'MAXHP':
      case 'HPMAX':
        return character.hpTotalMax;
      case 'THP':
      case 'TEMP':
        return character.hpTemp;
      case 'STR':
      case 'STRENGTH':
        return derived.strMod;
      case 'DEX':
      case 'DEXTERITY':
        return derived.dexMod;
      case 'CON':
      case 'CONSTITUTION':
        return derived.conMod;
      case 'INT':
      case 'INTELLIGENCE':
        return derived.intMod;
      case 'WIS':
      case 'WISDOM':
        return derived.wisMod;
      case 'CHA':
      case 'CHARISMA':
        return derived.chaMod;
      case 'BAB':
        return character.baseAttackBonus;
      case 'FORT':
      case 'FORTITUDE':
        return derived.fortitudeTotal;
      case 'REF':
      case 'REFLEX':
        return derived.reflexTotal;
      case 'WILL':
        return derived.willTotal;
      case 'AC':
        return derived.acTotal;
      case 'TOUCH':
        return derived.touchAC;
      case 'FF':
      case 'FLATFOOTED':
        return derived.flatFootedAC;
      case 'CMB':
        return derived.cmbTotal;
      case 'CMD':
        return derived.cmdTotal;
      case 'LEVEL':
      case 'LVL':
        return character.level;
      case 'SIZE':
        return 0;
      default:
        return null;
    }
  };

  // Parse arithmetic with floor (/) and ceil (/+)
  const evaluateMathChunk = (chunk: string): number => {
    try {
      // Replace dice rolls first, e.g. 10(d6+5) or 10d6
      let parsed = chunk;

      // Handle grouped multiplication like 10(d6+5)
      parsed = parsed.replace(/(\d+)\s*\(\s*([dD]\d+)\s*([+-]\s*\d+)\s*\)/g, (_, mult, dPart, bonus) => {
        const m = parseInt(mult);
        const b = parseInt(bonus.replace(/\s+/g, ''));
        const sides = parseInt(dPart.substring(1));
        let rollSum = 0;
        for (let i = 0; i < m; i++) {
          rollSum += rollDie(sides) + b;
        }
        return String(rollSum);
      });

      // Handle standard dice: 10d6, d20, etc.
      parsed = parsed.replace(/(\d*)[dD](\d+)/g, (match) => {
        return String(evaluateDiceExpr(match));
      });

      // Handle DC calculation: DC+#CON or DC+CON
      // DC equation: 10 + 1/2 level + abilityMod
      parsed = parsed.replace(/DC\s*\+?\s*#?([A-Za-z]+)?/gi, (_, abName) => {
        const halfLevel = Math.floor(character.level / 2);
        let abMod = 0;
        if (abName) {
          const val = getCallValue(abName);
          if (val !== null) abMod = val;
        }
        return String(10 + halfLevel + abMod);
      });

      // Handle calls #CALL or ALL-CAPS words
      parsed = parsed.replace(/#([A-Za-z_]+)/g, (_, name) => {
        const val = getCallValue(name);
        return String(val ?? 0);
      });

      // Handle all-caps calls not in quotes
      parsed = parsed.replace(/\b([A-Z]{2,})\b/g, (match) => {
        const val = getCallValue(match);
        return val !== null ? String(val) : match;
      });

      // Handle /+ as round UP (replace with ceil division pattern)
      if (parsed.includes('/+')) {
        parsed = parsed.replace(/(\d+)\s*\/\+\s*(\d+)/g, (_, a, b) => {
          return String(Math.ceil(parseInt(a) / parseInt(b)));
        });
      }

      // Standard division rounds down (floor) per PF1e rules
      if (parsed.includes('/')) {
        parsed = parsed.replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => {
          return String(Math.floor(parseInt(a) / parseInt(b)));
        });
      }

      // Safe arithmetic evaluator for remaining numbers and +, -, *
      if (/^[0-9+\-*()\s]+$/.test(parsed)) {
        // eslint-disable-next-line no-eval
        const result = Function(`"use strict"; return Math.floor(${parsed});`)();
        return typeof result === 'number' && !isNaN(result) ? result : 0;
      }
    } catch {
      // fallback
    }
    return 0;
  };

  // Evaluate a single sub-macro inside pipes
  // Supports text literals in quotes "", pushes >>, and math/dice
  const evaluateSegment = (seg: string, pushesOut: string[]): string => {
    let output = '';
    let remaining = seg.trim();

    // 1. Check for << macro pull (e.g. <<firebreath)
    if (remaining.startsWith('<<')) {
      const macroName = remaining.substring(2).trim();
      const found = savedMacros.find((m) => m.name.toLowerCase() === macroName.toLowerCase());
      if (found) {
        return evaluateSegment(found.formula, pushesOut);
      }
    }

    // 2. Extract and handle >> pushes
    // User rule: >>HP-5 will send -5 to HP. No spaces between call and equation.
    // If spaces like >>HP +5 or >>HP+ 5, it prints +5 or 5 instead of pushing!
    const strictPushMatch = remaining.match(/>>([A-Za-z]+)([+-]\d+)/);
    const loosePushMatch = remaining.match(/>>([A-Za-z]+)\s+([+-]?\s*\d+)/);

    if (strictPushMatch) {
      const target = strictPushMatch[1].toUpperCase();
      const delta = parseInt(strictPushMatch[2]);
      pushesOut.push(`Applied ${delta >= 0 ? `+${delta}` : delta} to ${target}`);

      // Apply directly to character
      if (target === 'HP') {
        onUpdateCharacter((prev) => ({
          ...prev,
          hpCurrent: prev.hpCurrent + delta,
        }));
      }

      // Remove the strict push command from printed output
      remaining = remaining.replace(strictPushMatch[0], '').trim();
    } else if (loosePushMatch) {
      // User rule: if spaces like >>HP +5, prints +5 or 5 instead of pushing!
      const printedVal = loosePushMatch[2].trim();
      remaining = remaining.replace(loosePushMatch[0], printedVal).trim();
    }

    // 3. Extract text in quotes vs math
    // e.g. "to hit " d20+10
    const tokens: string[] = [];
    let currentIdx = 0;
    const textRegex = /"([^"]*)"/g;
    let match: RegExpExecArray | null;

    while ((match = textRegex.exec(remaining)) !== null) {
      const beforeText = remaining.substring(currentIdx, match.index).trim();
      if (beforeText) {
        tokens.push(beforeText);
      }
      tokens.push(`"${match[1]}"`);
      currentIdx = match.index + match[0].length;
    }
    const afterText = remaining.substring(currentIdx).trim();
    if (afterText) {
      tokens.push(afterText);
    }

    const evaluatedParts: string[] = [];
    for (const tok of tokens) {
      if (tok.startsWith('"') && tok.endsWith('"')) {
        // Literal text
        evaluatedParts.push(tok.slice(1, -1));
      } else {
        // Dice and math
        const num = evaluateMathChunk(tok);
        evaluatedParts.push(String(num));
      }
    }

    return evaluatedParts.join(' ').replace(/\s+/g, ' ').trim();
  };

  // Evaluate full macro pipeline with | (pipes)
  const executeXdxMacro = (raw: string) => {
    if (!raw.trim()) return;

    const pushesOut: string[] = [];
    // Split by pipe |
    const segments = raw.split('|').map((s) => s.trim()).filter(Boolean);

    const results = segments.map((seg) => evaluateSegment(seg, pushesOut));
    const combinedOutput = results.join(', ');

    const newLogItem: RollLogItem = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      rawInput: raw,
      resultOutput: combinedOutput,
      appliedPushes: pushesOut.length > 0 ? pushesOut : undefined,
    };

    setRollLogs((prev) => [newLogItem, ...prev].slice(0, 50));
  };

  // Add macro to saved list
  const handleSaveCurrentMacro = () => {
    if (!macroInput.trim()) return;
    const name = `macro_${Date.now().toString(36).substring(2, 6)}`;
    const newEntry: XdxMacroEntry = {
      id: `m-${Date.now()}`,
      name,
      formula: macroInput.trim(),
    };
    updateSavedMacros([...savedMacros, newEntry]);
  };

  // Save memory.txt
  const handleSaveMemoryTxt = () => {
    const lines = memoryTxtContent.split('\n').filter((l) => l.trim());
    const parsedEntries: XdxMacroEntry[] = lines.map((l, i) => {
      const [name, ...rest] = l.split(':');
      return {
        id: `txt-${i}`,
        name: name ? name.trim() : `macro_${i}`,
        formula: rest.join(':').trim(),
      };
    });
    updateSavedMacros(parsedEntries);
    setShowMemoryTxt(false);
  };

  if (!isOpen && !isDocked) return null;

  const content = (
    <div className="flex flex-col h-full space-y-3 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-amber-400" />
          <div>
            <div className="font-bold text-sm tracking-wide uppercase flex items-center gap-2">
              <span>XDX Macro Center</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-normal">
                Mini DSL Engine
              </span>
            </div>
            <div className="text-[10px] opacity-70">
              Compact dice evaluator · Pipes | · Literals &quot;&quot; · Calls # · Pushes &gt;&gt;
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowMemoryTxt(!showMemoryTxt)}
            className="px-2.5 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 border border-black/10 dark:border-white/10 flex items-center gap-1 text-[11px]"
            title="Open macros.txt memory slot"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>macros.txt</span>
          </button>

          {!isDocked && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Memory Slot TXT Drawer */}
      {showMemoryTxt && (
        <div className="p-3 rounded-lg bg-black/20 dark:bg-black/40 border border-cyan-500/30 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-cyan-300 uppercase">Memory Slot: macros.txt</span>
            <span className="text-[10px] opacity-60">Format: name: formula</span>
          </div>

          <textarea
            value={memoryTxtContent}
            onChange={(e) => setMemoryTxtContent(e.target.value)}
            rows={6}
            className="w-full p-2 rounded bg-black/40 border border-cyan-500/30 font-mono text-xs text-cyan-100 resize-none"
            placeholder={`firebreath: 2d6+(5*floor(#level/2)+1) "fire"\nmainattack: d20+#bab+#str | 1d8+#str`}
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowMemoryTxt(false)}
              className="px-2.5 py-1 rounded bg-slate-800 text-[11px]"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMemoryTxt}
              className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[11px] flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              <span>Save & Load Macros</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Terminal Command Line Input */}
      <div className="p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold uppercase tracking-wider opacity-80">Command / Macro Line</span>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-amber-500 hover:underline flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Syntax Reference</span>
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={macroInput}
            onChange={(e) => setMacroInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executeXdxMacro(macroInput)}
            placeholder={`"to hit " d20+10 | 4d6 "damage"  OR  10(D6+5)  OR  "blood" >>HP-5`}
            className="flex-1 px-3 py-1.5 rounded border border-black/20 dark:border-white/20 bg-black/10 dark:bg-white/10 text-xs font-mono text-amber-200"
          />
          <button
            onClick={() => executeXdxMacro(macroInput)}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded flex items-center gap-1 transition-colors text-xs"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Roll</span>
          </button>
          <button
            onClick={handleSaveCurrentMacro}
            className="p-1.5 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 border border-black/10 dark:border-white/10"
            title="Save to macros list"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>

        {/* Quick Quickmacros presets */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
          <span className="opacity-60">Examples:</span>
          {[
            { label: 'Attack & Dmg', f: '"to hit " d20+#bab+#str | 1d8+#str "slashing"' },
            { label: 'Multi-Die |', f: '2d6 | 2d4' },
            { label: 'Grouped 10(D6+5)', f: '10(d6+5)' },
            { label: 'Push >>HP-5', f: '"blood" >>HP-5' },
            { label: 'Spell DC+CON', f: 'DC+#CON "Fort DC"' },
            { label: 'Round Up /+', f: '15/+2' },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setMacroInput(item.f);
                executeXdxMacro(item.f);
              }}
              className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 hover:bg-amber-500/20 hover:text-amber-400 border border-black/10 dark:border-white/10"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Syntax Help */}
        {showHelp && (
          <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] leading-relaxed space-y-1">
            <p><strong>10D6+5</strong> : Rolls 10d6 and adds 5.</p>
            <p><strong>10(D6+5)</strong> : Grouped roll multiplication (10 * (d6+5)).</p>
            <p><strong>|</strong> : Divides multiple macros in one roll (e.g. <code>2d6|2d4</code> displays results side by side).</p>
            <p><strong>&quot;&quot;</strong> : Prints text literals (e.g. <code>&quot;to hit &quot; d20+10 | 4d6 &quot;damage&quot;</code>).</p>
            <p><strong>#CALLS &amp; ALL-CAPS</strong> : Calls sheet values like <code>#HP</code>, <code>STR</code>, <code>BAB</code>, <code>FORT</code>, <code>LEVEL</code>, <code>AC</code>.</p>
            <p><strong>&gt;&gt;HP-5</strong> : Pushes value to sheet stat directly (numeric check, no spaces between call &amp; equation).</p>
            <p><strong>&lt;&lt;name</strong> : Pulls and evaluates saved macro by name (e.g. <code>&lt;&lt;firebreath</code>).</p>
            <p><strong>DC</strong> : Ability DC = <code>10 + floor(1/2*level) + abilityMod</code> (e.g. <code>DC+#CON</code>).</p>
            <p><strong>/+</strong> : Divides and rounds UP (standard <code>/</code> rounds down).</p>
          </div>
        )}
      </div>

      {/* Output Console / Roll History Log */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-75 flex items-center justify-between">
          <span>Terminal Output Log</span>
          <button
            onClick={() => setRollLogs([])}
            className="text-[10px] opacity-60 hover:opacity-100"
          >
            Clear Log
          </button>
        </div>

        {rollLogs.map((log) => (
          <div
            key={log.id}
            className="p-2.5 rounded-lg bg-black/10 dark:bg-white/5 border border-black/15 dark:border-white/15 space-y-1 font-mono"
          >
            <div className="flex items-center justify-between text-[10px] opacity-60">
              <span className="font-bold text-amber-500">&gt; {log.rawInput}</span>
              <span>{log.timestamp}</span>
            </div>

            <div className="font-bold text-sm text-cyan-400 dark:text-cyan-300">
              {log.resultOutput}
            </div>

            {log.appliedPushes && (
              <div className="text-[10px] text-rose-400 font-semibold pt-0.5 border-t border-black/10 dark:border-white/10">
                ⚡ {log.appliedPushes.join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Saved Macros Quick List */}
      <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase opacity-75">
          <span>Stored Macros ({savedMacros.length})</span>
          <span className="opacity-60">Call with &lt;&lt;name</span>
        </div>

        <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto text-[11px]">
          {savedMacros.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMacroInput(`<<${m.name}`);
                executeXdxMacro(`<<${m.name}`);
              }}
              className="p-1.5 rounded bg-black/10 dark:bg-white/10 hover:bg-amber-500/20 text-left border border-black/10 dark:border-white/10 flex items-center justify-between group transition-colors"
            >
              <div className="truncate min-w-0">
                <span className="font-bold text-amber-500 group-hover:underline">
                  &lt;&lt;{m.name}
                </span>
                <span className="text-[9px] opacity-60 block truncate">{m.formula}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (isDocked) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl max-h-[92vh] bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl p-4 overflow-y-auto text-slate-100">
        {content}
      </div>
    </div>
  );
};
