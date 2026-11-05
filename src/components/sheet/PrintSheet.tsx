import React from 'react';
import { Printer, ArrowLeft, Eye } from 'lucide-react';
import { PF1Character, AbilityName } from '../../types/character';
import { DerivedCombatStats, evaluateConditions } from '../../engine/pf1eMath';
import { buildFormulaContext, evaluateFormula } from '../../engine/formula';

export interface PrintSheetProps {
  character: PF1Character;
  derived: DerivedCombatStats;
  isReadOnlySnapshot?: boolean;
  onExitPrintView?: () => void;
}

/**
 * Evaluates a formula containing dice or variables into a static read-only representation:
 * displays the fixed modifier/total first and, in smaller text next to it, the resolved dice expression,
 * e.g. "+12 to hit (1d20 + 12)" or "+7 (1d8 + 7)".
 */
function formatStaticFormulaDisplay(
  rawFormula: string,
  context: Record<string, any>,
  defaultLabel?: string
): { fixedSummary: string; diceExpr: string | null } {
  if (!rawFormula || !rawFormula.trim()) {
    return { fixedSummary: '—', diceExpr: null };
  }

  // Strip Macaroni bracket wrappers like [d20 + #BAB + #STR] for clean static display
  const cleaned = rawFormula
    .replace(/\[|\]/g, '')
    .replace(/#([A-Za-z_]+)/g, (_, v) => v.toLowerCase())
    .trim();

  // Check if formula contains dice notation such as 1d20, d20, 2d6, etc.
  const diceRegex = /\b(\d*)d(\d+)(?:k\d+)?\b/gi;
  const diceMatches = Array.from(cleaned.matchAll(diceRegex));

  if (diceMatches.length === 0) {
    const evalRes = evaluateFormula(cleaned, context);
    return {
      fixedSummary: evalRes.isError ? rawFormula : evalRes.evaluated,
      diceExpr: null,
    };
  }

  // Extract trailing string literal label if present (e.g. "to hit" or "slashing")
  let extractedLabel = defaultLabel || '';
  const quoteMatch = cleaned.match(/"([^"]+)"/);
  if (quoteMatch && !extractedLabel) {
    extractedLabel = quoteMatch[1].trim();
  }

  const mathOnly = cleaned.replace(/"[^"]*"/g, '').trim();

  // Replace all dice terms with 0 to compute the fixed numeric modifier
  const fixedOnlyExpr = mathOnly.replace(diceRegex, '0');
  const fixedEval = evaluateFormula(fixedOnlyExpr, context);
  const fixedNum = Number(fixedEval.evaluated);

  // Build resolved dice string (e.g., "1d20 + 12" or "2d6 + 7")
  const primaryDice = diceMatches
    .map((m) => `${m[1] || '1'}d${m[2]}`)
    .join(' + ');

  if (!Number.isNaN(fixedNum)) {
    const signedFixed = fixedNum >= 0 ? `+${fixedNum}` : `${fixedNum}`;
    const diceWithMod =
      fixedNum === 0
        ? primaryDice
        : fixedNum > 0
        ? `${primaryDice} + ${fixedNum}`
        : `${primaryDice} - ${Math.abs(fixedNum)}`;
    return {
      fixedSummary: `${signedFixed}${extractedLabel ? ` ${extractedLabel}` : ''}`,
      diceExpr: `(${diceWithMod})`,
    };
  }

  // Fallback if expression has multiple segments
  const fullEval = evaluateFormula(cleaned, context);
  return {
    fixedSummary: fullEval.isError ? rawFormula : fullEval.evaluated,
    diceExpr: `(${mathOnly})`,
  };
}

/**
 * Static, Read-Only PrintSheet & Snapshot View.
 * Renders three sections with page breaks between them:
 * 1. Core Combat
 * 2. Actions List
 * 3. Bio / Profile
 */
export const PrintSheet: React.FC<PrintSheetProps> = ({
  character,
  derived,
  isReadOnlySnapshot = false,
  onExitPrintView,
}) => {
  const cond = evaluateConditions(character.conditions);
  const formulaContext = buildFormulaContext(character, cond, derived);
  const abilitiesList: AbilityName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

  const handleDownloadPdf = () => {
    // TODO(backend): Replace window.print() with dedicated PDF export pipeline if needed
    window.print();
  };

  const avatarUrl =
    character.profileData?.avatarUrl || character.characterBio?.portraits?.[0] || '';

  const actionsList = character.characterActions || [];
  const customObjects = character.customObjects || [];
  const bioSections = character.characterBio?.bioSections || [];
  const profileCustomFields = character.profileData?.customFields || [];

  return (
    <div className="print-sheet-root min-h-screen bg-[#faf7f0] text-stone-900 font-serif print:bg-white print:text-black">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="no-print print:hidden sticky top-0 z-30 bg-slate-950 border-b border-slate-800 text-slate-100 px-4 md:px-8 py-2.5 flex items-center justify-between gap-4 font-sans">
        <div className="flex items-center gap-3">
          {!isReadOnlySnapshot && onExitPrintView && (
            <button
              type="button"
              onClick={onExitPrintView}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Editable Sheet</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            {isReadOnlySnapshot ? (
              <span className="px-2.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>Read-Only Character Snapshot</span>
              </span>
            ) : (
              <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                Print Preview (3-Section Static Layout)
              </span>
            )}
            <span className="text-xs text-slate-400 hidden sm:inline">
              {character.name} — Level {character.level} {character.characterClass}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Main Printable Document Container */}
      <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-8 print:p-0 print:max-w-none print:space-y-0">
        {/* ================================================================= */}
        {/* SECTION 1: CORE COMBAT                                            */}
        {/* ================================================================= */}
        <section className="print-section space-y-4">
          <div className="border-b-2 border-stone-900 pb-3 flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-stone-600">
                Section 1 • Core Combat &amp; Attributes
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-950">
                {character.name || 'Unnamed Character'}
              </h1>
              <div className="text-xs text-stone-700 mt-0.5">
                <strong>Class &amp; Level:</strong> {character.characterClass} (Level{' '}
                {character.level}) • <strong>Race:</strong> {character.race} •{' '}
                <strong>Alignment:</strong> {character.alignment}
              </div>
            </div>
            <div className="text-right text-xs font-mono space-y-0.5">
              <div>
                <strong>Player:</strong> {character.player || '—'}
              </div>
              <div>
                <strong>Deity:</strong> {character.deity || '—'} • <strong>Size:</strong>{' '}
                {character.size}
              </div>
              <div>
                <strong>XP:</strong> {character.currentXP} / {character.nextLevelXP}
              </div>
            </div>
          </div>

          {/* Ability Scores Row */}
          <div className="grid grid-cols-6 gap-2 text-center">
            {abilitiesList.map((ab) => {
              const totalKey = `${ab.toLowerCase()}Total` as keyof DerivedCombatStats;
              const modKey = `${ab.toLowerCase()}Mod` as keyof DerivedCombatStats;
              const totalVal = Number(derived[totalKey] ?? 10);
              const modVal = Number(derived[modKey] ?? 0);
              const signedMod = modVal >= 0 ? `+${modVal}` : `${modVal}`;
              return (
                <div
                  key={ab}
                  className="border border-stone-400 rounded p-2 bg-white/80 print:border-black"
                >
                  <div className="text-[10px] font-mono font-bold uppercase text-stone-600">
                    {ab}
                  </div>
                  <div className="text-lg font-bold text-stone-950">{ signedMod }</div>
                  <div className="text-xs font-mono text-stone-700">Score: {totalVal}</div>
                </div>
              );
            })}
          </div>

          {/* Vitals, AC, Saves & Combat Maneuvers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
            {/* HP & Vitals */}
            <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-1.5 print:border-black">
              <div className="text-xs font-mono font-bold uppercase border-b border-stone-300 pb-1">
                Hit Points &amp; Vitals
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs">Current / Max HP:</span>
                <span className="text-base font-bold font-mono">
                  {character.hpCurrent} / {derived.hpBreakdownDetails.calculatedTotalMaxHP}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span>Temp HP / Nonlethal:</span>
                <span className="font-mono">
                  +{character.hpTemp || 0} THP / {character.hpNonlethal || 0} NL
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span>Hit Dice:</span>
                <span className="font-mono">{character.hitDice || `${character.level}d10`}</span>
              </div>
              <div className="text-xs pt-1 border-t border-stone-200">
                <div>
                  <strong>DR:</strong> {character.damageReduction || 'None'} •{' '}
                  <strong>SR:</strong> {character.spellResistance || 0}
                </div>
                <div>
                  <strong>Resistances:</strong> {character.resistances || 'None'}
                </div>
              </div>
            </div>

            {/* Armor Class */}
            <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-1.5 print:border-black">
              <div className="text-xs font-mono font-bold uppercase border-b border-stone-300 pb-1">
                Armor Class &amp; Defenses
              </div>
              <div className="grid grid-cols-3 gap-2 text-center py-1">
                <div className="border border-stone-300 rounded p-1">
                  <div className="text-[10px] font-mono uppercase">Total AC</div>
                  <div className="text-base font-bold">{derived.acTotal}</div>
                </div>
                <div className="border border-stone-300 rounded p-1">
                  <div className="text-[10px] font-mono uppercase">Touch</div>
                  <div className="text-base font-bold">{derived.touchAC}</div>
                </div>
                <div className="border border-stone-300 rounded p-1">
                  <div className="text-[10px] font-mono uppercase">Flat-Footed</div>
                  <div className="text-base font-bold">{derived.flatFootedAC}</div>
                </div>
              </div>
              <div className="text-[11px] font-mono text-stone-700">
                Armor +{derived.armorBonusTotal} | Shield +{derived.shieldBonusTotal} | Dex{' '}
                {derived.effectiveDexModForAC >= 0
                  ? `+${derived.effectiveDexModForAC}`
                  : derived.effectiveDexModForAC}{' '}
                | Nat +{character.naturalArmorMod} | Defl +{character.deflectionMod}
              </div>
            </div>

            {/* Saving Throws & Combat */}
            <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-1.5 print:border-black">
              <div className="text-xs font-mono font-bold uppercase border-b border-stone-300 pb-1">
                Saves, Initiative &amp; Maneuvers
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] font-mono uppercase">Fortitude</div>
                  <div className="text-sm font-bold">
                    {derived.fortitudeTotal >= 0
                      ? `+${derived.fortitudeTotal}`
                      : derived.fortitudeTotal}{' '}
                    <span className="text-[10px] font-normal font-mono opacity-75">
                      (1d20{derived.fortitudeTotal >= 0 ? `+${derived.fortitudeTotal}` : derived.fortitudeTotal})
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase">Reflex</div>
                  <div className="text-sm font-bold">
                    {derived.reflexTotal >= 0 ? `+${derived.reflexTotal}` : derived.reflexTotal}{' '}
                    <span className="text-[10px] font-normal font-mono opacity-75">
                      (1d20{derived.reflexTotal >= 0 ? `+${derived.reflexTotal}` : derived.reflexTotal})
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase">Will</div>
                  <div className="text-sm font-bold">
                    {derived.willTotal >= 0 ? `+${derived.willTotal}` : derived.willTotal}{' '}
                    <span className="text-[10px] font-normal font-mono opacity-75">
                      (1d20{derived.willTotal >= 0 ? `+${derived.willTotal}` : derived.willTotal})
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-mono pt-1 border-t border-stone-200 flex flex-wrap justify-between gap-2">
                <span>
                  <strong>Init:</strong>{' '}
                  {derived.initiativeTotal >= 0
                    ? `+${derived.initiativeTotal}`
                    : derived.initiativeTotal}{' '}
                  <span className="text-[10px] opacity-75">
                    (1d20{derived.initiativeTotal >= 0 ? `+${derived.initiativeTotal}` : derived.initiativeTotal})
                  </span>
                </span>
                <span>
                  <strong>BAB:</strong> +{character.baseAttackBonus}
                </span>
                <span>
                  <strong>CMB:</strong> +{derived.cmbTotal}
                </span>
                <span>
                  <strong>CMD:</strong> {derived.cmdTotal}
                </span>
                <span>
                  <strong>Speed:</strong> {character.speedBase || 30} ft.
                </span>
              </div>
            </div>
          </div>

          {/* Weapons Table (With Fixed Total + Smaller Dice Expression) */}
          <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-2 print:border-black">
            <div className="text-xs font-mono font-bold uppercase border-b border-stone-300 pb-1">
              Weapons &amp; Attacks
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-300 font-mono text-[10px] uppercase text-stone-600">
                  <th className="py-1 pr-2">Weapon</th>
                  <th className="py-1 px-2">Category</th>
                  <th className="py-1 px-2">Attack Bonus (Fixed &amp; Dice)</th>
                  <th className="py-1 px-2">Damage (Fixed &amp; Dice)</th>
                  <th className="py-1 px-2">Critical</th>
                  <th className="py-1 pl-2">Range / Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {character.weapons.map((w) => {
                  const baseAtkBonus =
                    w.category === 'Ranged'
                      ? derived.rangedAttackBonusTotal
                      : derived.meleeAttackBonusTotal;
                  const atkSigned = baseAtkBonus >= 0 ? `+${baseAtkBonus}` : `${baseAtkBonus}`;
                  const atkDice = `1d20 ${baseAtkBonus >= 0 ? `+ ${baseAtkBonus}` : `- ${Math.abs(baseAtkBonus)}`}`;
                  const dmgFormatted = formatStaticFormulaDisplay(
                    w.damageFormula,
                    formulaContext
                  );

                  return (
                    <tr key={w.id}>
                      <td className="py-1.5 pr-2 font-bold">{w.name}</td>
                      <td className="py-1.5 px-2 font-mono text-[11px]">{w.category}</td>
                      <td className="py-1.5 px-2 font-mono">
                        <span className="font-bold">{atkSigned} to hit</span>{' '}
                        <span className="text-[10px] text-stone-600">({atkDice})</span>
                      </td>
                      <td className="py-1.5 px-2 font-mono">
                        <span className="font-bold">{dmgFormatted.fixedSummary}</span>{' '}
                        {dmgFormatted.diceExpr && (
                          <span className="text-[10px] text-stone-600">
                            {dmgFormatted.diceExpr}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[11px]">{w.critical}</td>
                      <td className="py-1.5 pl-2 text-[11px]">
                        {w.range} • {w.damageType}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Equipped Armor & Feats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
            <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-1.5 print:border-black">
              <div className="text-xs font-mono font-bold uppercase border-b border-stone-300 pb-1">
                Equipped Armor &amp; Shields
              </div>
              {character.armor.length === 0 ? (
                <div className="text-xs italic opacity-70">No armor entries recorded.</div>
              ) : (
                <ul className="space-y-1 text-xs">
                  {character.armor.map((a) => (
                    <li key={a.id} className="flex items-center justify-between">
                      <span>
                        <strong>{a.name}</strong> ({a.type})
                      </span>
                      <span className="font-mono text-[11px]">
                        AC +{a.acBonus} | Max Dex +{a.maxDex} | ACP {a.checkPenalty}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-1.5 print:border-black">
              <div className="text-xs font-mono font-bold uppercase border-b border-stone-300 pb-1">
                Feats &amp; Special Qualities
              </div>
              <div className="text-xs leading-relaxed">
                {(character.characterFeats && character.characterFeats.length > 0
                  ? character.characterFeats.map((f) => f.name)
                  : character.featsAndAbilities
                ).join(' • ') || 'None recorded'}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECTION 2: ACTIONS LIST                                           */}
        {/* ================================================================= */}
        <section className="print-section print-section-break space-y-4 pt-6 print:pt-0">
          <div className="border-b-2 border-stone-900 pb-2 flex items-baseline justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-stone-600">
                Section 2 • Combat Actions, Class Resources &amp; Formula Objects
              </div>
              <h2 className="text-xl font-bold text-stone-950">
                Actions &amp; Class Resource Directory ({character.name})
              </h2>
            </div>
            <span className="text-xs font-mono text-stone-600">
              {actionsList.length} Actions • {customObjects.length} Formula Objects
            </span>
          </div>

          {/* Character Actions Table */}
          <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-2 print:border-black">
            <div className="text-xs font-mono font-bold uppercase border-b border-stone-300 pb-1">
              Action &amp; Resource Directory
            </div>
            {actionsList.length === 0 ? (
              <div className="text-xs italic opacity-70">No actions recorded.</div>
            ) : (
              <div className="divide-y divide-stone-200">
                {actionsList.map((act) => {
                  const macroDisplay = act.macroFormula
                    ? formatStaticFormulaDisplay(act.macroFormula, formulaContext)
                    : null;
                  return (
                    <div key={act.id} className="py-2 space-y-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-sm text-stone-950">{act.name}</span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 border border-stone-400 rounded">
                            {act.category} • {act.actionType}
                          </span>
                          {act.hasResourcePool && (
                            <span className="text-[11px] font-mono font-bold">
                              Uses: {act.resourceCurrent ?? 0} / {act.resourceMax ?? 0}
                            </span>
                          )}
                        </div>

                        {macroDisplay && (
                          <div className="font-mono text-xs">
                            <span className="font-bold">{macroDisplay.fixedSummary}</span>{' '}
                            {macroDisplay.diceExpr && (
                              <span className="text-[10px] text-stone-600">
                                {macroDisplay.diceExpr}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-stone-800 leading-relaxed">
                        {act.shortSummary || act.description}
                        {(act.range || act.saveDC) && (
                          <span className="ml-2 font-mono text-[11px] text-stone-600">
                            {act.range ? `[Range: ${act.range}] ` : ''}
                            {act.saveDC ? `[Save: ${act.saveDC}]` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Formula Objects (With Fixed Total + Smaller Dice Expression) */}
          {customObjects.length > 0 && (
            <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-2 print:border-black">
              <div className="text-xs font-mono font-bold uppercase border-b border-stone-300 pb-1">
                Custom Formula Objects
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-300 font-mono text-[10px] uppercase text-stone-600">
                    <th className="py-1 pr-2">Object Call</th>
                    <th className="py-1 px-2">Description</th>
                    <th className="py-1 pl-2">Static Value &amp; Dice Expression</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {customObjects.map((obj) => {
                    const formatted = formatStaticFormulaDisplay(obj.formula, formulaContext);
                    return (
                      <tr key={obj.id}>
                        <td className="py-1.5 pr-2 font-mono font-bold">#{obj.name}</td>
                        <td className="py-1.5 px-2">{obj.description}</td>
                        <td className="py-1.5 pl-2 font-mono">
                          <span className="font-bold">{formatted.fixedSummary}</span>{' '}
                          {formatted.diceExpr && (
                            <span className="text-[10px] text-stone-600">
                              {formatted.diceExpr}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ================================================================= */}
        {/* SECTION 3: BIO / PROFILE                                          */}
        {/* ================================================================= */}
        <section className="print-section print-section-break space-y-4 pt-6 print:pt-0">
          <div className="border-b-2 border-stone-900 pb-2 flex items-baseline justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-stone-600">
                Section 3 • Biography, Profile &amp; Chronicle Notes
              </div>
              <h2 className="text-xl font-bold text-stone-950">
                Character Biography &amp; Profile ({character.name})
              </h2>
            </div>
            <span className="text-xs font-mono text-stone-600">
              Campaign: {character.campaign || 'Pathfinder 1e'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
            {/* Avatar & Physical Details */}
            <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-2 print:border-black">
              {avatarUrl && (
                <div className="w-28 h-28 mx-auto rounded overflow-hidden border border-stone-400">
                  <img
                    src={avatarUrl}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="text-xs space-y-1 font-mono">
                <div>
                  <strong>Gender:</strong> {character.gender || '—'}
                </div>
                <div>
                  <strong>Age:</strong> {character.age || '—'}
                </div>
                <div>
                  <strong>Height / Weight:</strong> {character.height || '—'} /{' '}
                  {character.weight || '—'}
                </div>
                <div>
                  <strong>Eyes / Hair:</strong> {character.eyes || '—'} / {character.hair || '—'}
                </div>
                <div>
                  <strong>Languages:</strong> {(character.languages || []).join(', ') || 'Common'}
                </div>
              </div>
            </div>

            {/* Narrative & Bio Blocks */}
            <div className="md:col-span-3 print:col-span-3 space-y-3">
              {bioSections.length > 0 && (
                <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-2 print:border-black">
                  <div className="text-xs font-mono font-bold uppercase border-b border-stone-300 pb-1">
                    Profile Dossier Sections
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print:grid-cols-2">
                    {bioSections.map((sec) => (
                      <div key={sec.id} className="text-xs space-y-0.5">
                        <div className="font-mono font-bold uppercase text-[10px] text-stone-600">
                          {sec.title}
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {sec.content || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profileCustomFields.length > 0 && (
                <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-2 print:border-black">
                  <div className="text-xs font-mono font-bold uppercase border-b border-stone-300 pb-1">
                    Custom Profile Attributes
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 print:grid-cols-2 text-xs">
                    {profileCustomFields.map((field) => (
                      <div key={field.id}>
                        <strong>{field.title}:</strong> {field.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-stone-400 rounded p-3 bg-white/80 space-y-2 text-xs print:border-black">
                <div className="font-mono font-bold uppercase border-b border-stone-300 pb-1">
                  Backstory, Personality &amp; Notes
                </div>
                {character.biography?.description && (
                  <div>
                    <strong>Appearance &amp; Backstory:</strong>{' '}
                    <span className="whitespace-pre-wrap">{character.biography.description}</span>
                  </div>
                )}
                {character.biography?.personality && (
                  <div>
                    <strong>Personality:</strong> {character.biography.personality}
                  </div>
                )}
                {character.biography?.traits && (
                  <div>
                    <strong>Traits:</strong> {character.biography.traits}
                  </div>
                )}
                {character.biography?.flaws && (
                  <div>
                    <strong>Flaws / Drawbacks:</strong> {character.biography.flaws}
                  </div>
                )}
                {(character.characterBio?.scratchpad || character.biography?.notes) && (
                  <div className="pt-1 border-t border-stone-200">
                    <strong>Session Scratchpad &amp; Notes:</strong>
                    <div className="whitespace-pre-wrap mt-0.5 font-mono text-[11px]">
                      {character.characterBio?.scratchpad || character.biography?.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
