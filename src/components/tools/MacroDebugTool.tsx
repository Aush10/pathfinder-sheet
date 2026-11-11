import React, { useMemo, useState } from 'react';
import { Bug, ChevronDown, ChevronUp, Play, RotateCcw, X } from 'lucide-react';
import { evaluateConditions } from '../../engine/pf1eMath';
import { buildFormulaContext, evaluateFormula } from '../../engine/formula';
import { executeMacaroni } from '../../engine/macaroni';
import { projectMacaroniResult } from '../../engine/characterIntegration';
import { useCharacter } from '../../context/CharacterContext';

interface MacroDebugToolProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TraceSnapshot {
  timestamp: string;
  expression: string;
  contextEntries: Array<[string, unknown]>;
  formulaOutput: string;
  formulaError?: string;
  macroOutput: string;
  slots: Array<{ slot: number; raw: string; evaluated: string }>;
  tokens: Array<{ type: string; raw: string }>;
  mutations: Array<{ field: string; delta: number; description: string }>;
  pushes: string[];
  buffs: string[];
}

const DEFAULT_EXPRESSION = '[1d20 + #BAB + #STR] & [1d8 + #STR]';

function referencedContext(expression: string, context: Record<string, unknown>): Array<[string, unknown]> {
  const builtin = new Set(['floor', 'round', 'ceil', 'min', 'max', 'abs', 'sqrt', 'dc', 'this']);
  const names = expression.match(/(?:<<|[#@{])?[A-Za-z_][A-Za-z0-9_]*/g) || [];
  const resolved = new Set<string>();

  names.forEach((token) => {
    const clean = token.replace(/^(<<|[#@{])/, '').replace(/[>}]+$/, '').toLowerCase();
    if (clean && !builtin.has(clean) && clean in context) resolved.add(clean);
  });

  return [...resolved]
    .sort()
    .map((key): [string, unknown] => [key, context[key]])
    .filter(([, value]) => typeof value !== 'function');
}

export const MacroDebugTool: React.FC<MacroDebugToolProps> = ({ isOpen, onClose }) => {
  const { character, derived, updateCharacter } = useCharacter();
  const [expression, setExpression] = useState(DEFAULT_EXPRESSION);
  const [trace, setTrace] = useState<TraceSnapshot | null>(null);
  const [showAllInputs, setShowAllInputs] = useState(false);
  const [status, setStatus] = useState('Trace mode does not change the character.');

  const formulaContext = useMemo(() => {
    const conditions = evaluateConditions(character.conditions);
    return buildFormulaContext(character, conditions, derived);
  }, [character, derived]);

  if (!isOpen) return null;

  const createTrace = () => {
    const formula = evaluateFormula(expression, formulaContext);
    const macro = executeMacaroni(expression, {
      character,
      formulaContext,
      uiPresets: character.uiMakePresets,
    });

    return {
      timestamp: new Date().toLocaleTimeString(),
      expression,
      contextEntries: referencedContext(expression, formulaContext),
      formulaOutput: formula.evaluated || '(empty)',
      formulaError: formula.errorMessage,
      macroOutput: macro.fullOutput || '(empty)',
      slots: macro.slots.map((slot) => ({
        slot: slot.slot,
        raw: slot.raw,
        evaluated: slot.evaluated,
      })),
      tokens: macro.tokens.map((token) => ({ type: token.type, raw: token.raw })),
      mutations: macro.stateMutations || [],
      pushes: macro.appliedPushes || [],
      buffs: (macro.buffMakeEvents || []).map((buff) => buff.summaryText),
    } satisfies TraceSnapshot;
  };

  const handleTrace = () => {
    setTrace(createTrace());
    setStatus('Trace captured. No character data was changed.');
  };

  const handleApply = () => {
    const nextTrace = createTrace();
    const macro = executeMacaroni(expression, {
      character,
      formulaContext,
      uiPresets: character.uiMakePresets,
    });
    const canApply = (macro.buffMakeEvents?.length || 0) > 0 || (macro.stateMutations?.length || 0) > 0;

    setTrace(nextTrace);
    if (!canApply) {
      setStatus('Nothing to apply: this expression produced no state mutation or buff.');
      return;
    }

    const applied = projectMacaroniResult(character, macro);
    updateCharacter(applied.character);
    setStatus(`Applied: ${applied.statusMessage}`);
  };

  const displayedInputs = showAllInputs
    ? Object.entries(formulaContext)
        .filter(([key, value]) => !/^[#@]|^<</.test(key) && typeof value !== 'function')
        .sort(([a], [b]) => a.localeCompare(b))
    : trace?.contextEntries || referencedContext(expression, formulaContext);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-cyan-500/50 bg-slate-950 text-slate-100 shadow-2xl">
        <header className="flex items-center justify-between border-b border-cyan-500/30 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-cyan-200">Macro Trace</h2>
              <p className="text-xs text-slate-400">Inputs → evaluation → action output. Trace is read-only unless you choose Apply.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close macro trace">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block font-mono text-xs font-bold uppercase text-cyan-300">Action / macro input</span>
              <textarea
                value={expression}
                onChange={(event) => setExpression(event.target.value)}
                rows={5}
                spellCheck={false}
                className="w-full rounded-md border border-slate-700 bg-slate-900 p-3 font-mono text-sm text-amber-200 outline-none focus:border-cyan-400"
                aria-label="Macro expression to trace"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button onClick={handleTrace} className="inline-flex items-center gap-2 rounded bg-cyan-700 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-600">
                <Play className="h-4 w-4" /> Trace action
              </button>
              <button onClick={handleApply} className="rounded border border-amber-500/60 bg-amber-950/60 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/70">
                Apply mutation
              </button>
              <button onClick={() => { setExpression(DEFAULT_EXPRESSION); setTrace(null); setStatus('Reset to the sample expression.'); }} className="inline-flex items-center gap-1 rounded border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">
                <RotateCcw className="h-3.5 w-3.5" /> Reset sample
              </button>
            </div>
            <p className="rounded border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">{status}</p>

            <section className="rounded-lg border border-slate-800 bg-slate-900/50">
              <button onClick={() => setShowAllInputs((value) => !value)} className="flex w-full items-center justify-between px-3 py-2 text-left">
                <span className="font-mono text-xs font-bold uppercase text-cyan-300">{showAllInputs ? 'All live inputs' : 'Inputs used by this action'}</span>
                {showAllInputs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <div className="grid max-h-72 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto border-t border-slate-800 px-3 py-2 font-mono text-xs">
                {displayedInputs.length ? displayedInputs.map(([key, value]) => (
                  <React.Fragment key={key}>
                    <span className="truncate text-slate-400">#{key}</span>
                    <span className="truncate text-amber-200" title={String(value)}>{String(value)}</span>
                  </React.Fragment>
                )) : <span className="col-span-2 text-slate-500">No live inputs were recognized. Use calls such as #STR, #BAB, or &lt;&lt;HDmath.</span>}
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <h3 className="font-mono text-xs font-bold uppercase text-cyan-300">Output</h3>
              <div className="mt-2 space-y-2 font-mono text-sm">
                <p><span className="text-slate-500">Formula:</span> <span className="text-cyan-100">{trace?.formulaOutput || 'Trace an action to inspect output.'}</span></p>
                <p><span className="text-slate-500">Macaroni:</span> <span className="text-amber-200">{trace?.macroOutput || '—'}</span></p>
                {trace?.formulaError && <p className="text-rose-300">Formula error: {trace.formulaError}</p>}
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <h3 className="font-mono text-xs font-bold uppercase text-cyan-300">Execution detail</h3>
              {!trace ? <p className="mt-2 text-xs text-slate-500">The trace will show slots, tokens, pushes, buffs, and state changes here.</p> : (
                <div className="mt-2 space-y-3 text-xs">
                  <p className="text-slate-500">Captured at {trace.timestamp}</p>
                  <div><span className="font-mono text-slate-400">Slots</span>{trace.slots.length ? trace.slots.map((slot) => <p key={slot.slot} className="mt-1 rounded bg-slate-950 px-2 py-1 font-mono text-slate-200">.{slot.slot} {slot.raw} → <span className="text-amber-200">{slot.evaluated}</span></p>) : <p className="text-slate-500">None</p>}</div>
                  <div><span className="font-mono text-slate-400">State mutations</span>{trace.mutations.length ? trace.mutations.map((mutation, index) => <p key={`${mutation.field}-${index}`} className="mt-1 rounded bg-amber-950/40 px-2 py-1 text-amber-100">{mutation.description || `${mutation.field} ${mutation.delta >= 0 ? '+' : ''}${mutation.delta}`}</p>) : <p className="text-slate-500">None; Trace did not write anything.</p>}</div>
                  {trace.pushes.length > 0 && <div><span className="font-mono text-slate-400">Pushes</span>{trace.pushes.map((push, index) => <p key={`${push}-${index}`} className="mt-1 text-cyan-200">{push}</p>)}</div>}
                  {trace.buffs.length > 0 && <div><span className="font-mono text-slate-400">Buffs created</span>{trace.buffs.map((buff, index) => <p key={`${buff}-${index}`} className="mt-1 text-emerald-200">{buff}</p>)}</div>}
                  <div><span className="font-mono text-slate-400">Parsed tokens</span><p className="mt-1 break-words font-mono text-[11px] text-slate-300">{trace.tokens.map((token) => `${token.raw} (${token.type})`).join(' · ') || 'None'}</p></div>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </div>
  );
};
