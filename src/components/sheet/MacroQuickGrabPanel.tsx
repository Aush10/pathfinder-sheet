import React from 'react';
import { Zap, Dices } from 'lucide-react';
import { PF1Character } from '../../types/character';
import { DerivedCombatStats } from '../../engine/pf1eMath';
import { evaluateFormula, buildFormulaContext } from '../../engine/formula';

interface MacroQuickGrabPanelProps {
  character: PF1Character;
  derived: DerivedCombatStats;
  theme?: string;
  fontClass?: string;
  onRollFormula?: (formula: string, label?: string) => void;
  onSelectToken?: (token: string) => void;
}

const QUICK_MACRO_ITEMS = [
  { label: '#hp', formula: '#hp', desc: 'Current HP' },
  { label: '#str', formula: '#str', desc: 'STR Bonus' },
  { label: '#strength', formula: '#strength', desc: 'STR Score' },
  { label: '#ac', formula: '#ac', desc: 'Total AC' },
  { label: '#mattack', formula: '#mattack', desc: 'Melee Attack' },
  { label: '#rattack', formula: '#rattack', desc: 'Ranged Attack' },
  { label: '#fort', formula: '#fort', desc: 'Fortitude Save' },
  { label: '#ref', formula: '#ref', desc: 'Reflex Save' },
  { label: '#will', formula: '#will', desc: 'Will Save' },
  { label: '#init', formula: '#init', desc: 'Initiative' },
  { label: '<<HDmath', formula: '<<HDmath', desc: 'Max HD Base HP' },
  { label: '#firebreath', formula: 'firebreath', desc: 'Fire Breath' },
  { label: '#mainattack', formula: 'mainattack', desc: 'Main Melee Attack' },
];

export const MacroQuickGrabPanel: React.FC<MacroQuickGrabPanelProps> = ({
  character,
  derived,
  theme = 'blueprint',
  fontClass = '',
  onRollFormula,
  onSelectToken,
}) => {
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

  const context = buildFormulaContext(
    character,
    { strPenalty: 0, dexPenalty: 0, attackPenalty: 0 },
    derived
  );

  return (
    <div className={`border rounded-lg p-3 ${cardBg} ${fontClass}`}>
      <div className={`px-2 py-1 border-b mb-2 flex items-center justify-between ${headerBg}`}>
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-purple-400" />
          <span className="font-bold text-xs uppercase tracking-wider">
            Macro Quick-Grab &amp; Dynamic Core Calls
          </span>
        </div>
        <span className="text-[10px] font-mono opacity-80">
          Click to insert or roll live-resolved #macro tokens
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 font-mono text-xs">
        {QUICK_MACRO_ITEMS.map((item) => {
          const res = evaluateFormula(item.formula, context);
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (onSelectToken) {
                  onSelectToken(item.label);
                } else if (res.rollable && onRollFormula) {
                  onRollFormula(res.evaluated, item.label);
                }
              }}
              className="p-2 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-amber-500/50 text-left transition-all group"
              title={`Call ${item.label} -> ${res.evaluated}`}
            >
              <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                <span>{item.label}</span>
                {res.rollable && <Dices className="w-3 h-3 opacity-60 group-hover:opacity-100" />}
              </div>
              <div className="text-[11px] font-semibold opacity-90 truncate mt-0.5">
                = {res.evaluated}
              </div>
              <div className="text-[9px] opacity-60 truncate">{item.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
