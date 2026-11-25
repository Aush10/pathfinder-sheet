import React, { useMemo, useState } from 'react';
import {
  X,
  Trash2,
  Replace,
  Plus,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Lock,
  EyeOff,
  Link,
  Hash,
  Wand2,
} from 'lucide-react';
import type {
  MatrixColumn,
  MatrixColumnType,
  UserMatrixIndex,
} from '../../../types/character';
import {
  addRow0,
  appendIndex,
  assignMatrixValue,
  autoAssignIndex,
  autofillIndexColumn,
  bindMatrixValue,
  clearIndex,
  createMatrixId,
  insertIndexRow,
  replaceIndexValues,
  updateIndexColumns,
} from '../../../engine/matrix/matrixEngine';

export interface MatrixSectionRef {
  sectionId: string;
  headingPath: string[];
  text: string;
  keywords: string[];
}

export interface EditIndexModalProps {
  isOpen: boolean;
  onClose: () => void;
  index: UserMatrixIndex;
  allIndexes: UserMatrixIndex[];
  sotSections?: MatrixSectionRef[];
  onApplyIndex: (updated: UserMatrixIndex) => void;
}

export function buildAutoAssignLookup(
  sections: MatrixSectionRef[]
): (value: string) => { sectionId: string; text?: string } | undefined {
  return (rawVal: string) => {
    const clean = rawVal
      .replace(/<(?:act|rec|spell|feat)>\s*$/i, '')
      .trim()
      .toLowerCase();
    if (!clean) return undefined;
    const hit = sections.find((sec) => {
      const heading = sec.headingPath.join(' ').toLowerCase();
      return (
        heading.includes(clean) ||
        sec.keywords.some((k) => k.toLowerCase() === clean) ||
        sec.text.toLowerCase().includes(clean)
      );
    });
    return hit ? { sectionId: hit.sectionId, text: hit.text.slice(0, 280) } : undefined;
  };
}

export const EditIndexModal: React.FC<EditIndexModalProps> = ({
  isOpen,
  onClose,
  index,
  allIndexes,
  sotSections = [],
  onApplyIndex,
}) => {
  const [replaceFrom, setReplaceFrom] = useState('');
  const [replaceTo, setReplaceTo] = useState('');
  const [newColHeader, setNewColHeader] = useState('');
  const [newColType, setNewColType] = useState<MatrixColumnType>('text');
  const [insertRowLevel, setInsertRowLevel] = useState('1');
  const [autofillColId, setAutofillColId] = useState(index.columns[0]?.id || '');
  const [autofillInstruction, setAutofillInstruction] = useState('+1');
  const [assignValueInput, setAssignValueInput] = useState('');
  const [assignSectionId, setAssignSectionId] = useState(sotSections[0]?.sectionId || '');
  const [assignText, setAssignText] = useState('');
  const [bindValueInput, setBindValueInput] = useState('');
  const [bindMode, setBindMode] = useState<'take-highest' | 'count-total'>('take-highest');
  const [bindKeyInput, setBindKeyInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const distinctCellTokens = useMemo(() => {
    const set = new Set<string>();
    const allRows = index.row0 ? [index.row0, ...index.rows] : index.rows;
    allRows.forEach((r) => {
      Object.values(r.values).forEach((v) => {
        if (v && v.trim()) set.add(v.trim());
      });
    });
    return Array.from(set).sort();
  }, [index]);

  if (!isOpen) return null;

  const commit = (next: UserMatrixIndex, msg: string) => {
    onApplyIndex(next);
    setStatusMsg(msg);
  };

  const handleMoveCol = (colIdx: number, dir: -1 | 1) => {
    const nextIdx = colIdx + dir;
    if (nextIdx < 0 || nextIdx >= index.columns.length) return;
    const cols = [...index.columns];
    const [moved] = cols.splice(colIdx, 1);
    cols.splice(nextIdx, 0, moved);
    commit(updateIndexColumns(index, cols), `Moved column "${moved.header}".`);
  };

  const handleToggleColFlag = (colId: string, flag: 'frozen' | 'hidden') => {
    const cols = index.columns.map((c) => (c.id === colId ? { ...c, [flag]: !c[flag] } : c));
    commit(updateIndexColumns(index, cols), `Updated column ${flag} flag.`);
  };

  const handleAddColumn = () => {
    const clean = newColHeader.trim();
    if (!clean) return;
    const newCol: MatrixColumn = {
      id: createMatrixId('col', clean, index.columns.map((c) => c.id)),
      header: clean,
      type: newColType,
    };
    commit(updateIndexColumns(index, [...index.columns, newCol]), `Added column "${clean}".`);
    setNewColHeader('');
  };

  const handleRemoveColumn = (colId: string) => {
    if (index.columns.length <= 1) return;
    const cols = index.columns.filter((c) => c.id !== colId);
    commit(updateIndexColumns(index, cols), 'Removed column.');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit Index ${index.name}`}
    >
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl border border-cyan-500/40 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden text-xs">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-cyan-300">Edit Index: {index.name}</h3>
            <p className="text-[11px] font-mono text-slate-400">
              ID: {index.id} â€¢ {index.columns.length} cols â€¢ {index.rows.length} rows
              {index.appendToIndexId ? ` â€¢ Appended to ${index.appendToIndexId}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Edit Index"
            className="p-1.5 rounded hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusMsg && (
          <div className="px-5 py-1.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 font-mono text-[11px] flex items-center justify-between">
            <span>{statusMsg}</span>
            <button type="button" onClick={() => setStatusMsg(null)} className="underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pf1-theme-scrollbar p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Clear Index, Row 0, & Template (WIP) */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2.5">
            <div className="font-bold text-cyan-300 uppercase tracking-wider text-[11px]">
              Index Actions &amp; Race Row 0
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => commit(clearIndex(index), 'Cleared all cell values (columns kept).')}
                className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-mono flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Index
              </button>
              <button
                type="button"
                onClick={() => commit(addRow0(index), 'Enabled Row 0 (Race / Starting Level 0).')}
                disabled={Boolean(index.row0)}
                className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 disabled:opacity-45 border border-amber-500/40 text-amber-300 font-mono flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {index.row0 ? 'Row 0 Enabled' : 'Add Row 0 (Race)'}
              </button>
              <button
                type="button"
                disabled
                title="Template presets are deferred past 1.3.0"
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono opacity-60 cursor-not-allowed"
              >
                Template (WIP)
              </button>
            </div>
          </div>

          {/* 2. Cleanup: Remove or Replace values */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2">
            <div className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Replace className="w-3.5 h-3.5" />
              Cleanup (Remove / Replace Values)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={replaceFrom}
                onChange={(e) => setReplaceFrom(e.target.value)}
                placeholder="Exact value to match..."
                list="matrix-cell-tokens"
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
              />
              <input
                type="text"
                value={replaceTo}
                onChange={(e) => setReplaceTo(e.target.value)}
                placeholder="Replacement (blank = remove)"
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
              />
            </div>
            <datalist id="matrix-cell-tokens">
              {distinctCellTokens.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => {
                if (!replaceFrom) return;
                commit(
                  replaceIndexValues(index, replaceFrom, replaceTo),
                  replaceTo
                    ? `Replaced "${replaceFrom}" with "${replaceTo}".`
                    : `Cleared all occurrences of "${replaceFrom}".`
                );
              }}
              className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
            >
              Apply Cleanup
            </button>
          </div>

          {/* 3. RowCol: Columns & Row insertion */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2 md:col-span-2">
            <div className="font-bold text-cyan-300 uppercase tracking-wider text-[11px]">
              RowCol (Reorder, Freeze, Hide, Add Column / Row)
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto pf1-theme-scrollbar">
              {index.columns.map((col, cIdx) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-900 border border-slate-800"
                >
                  <span className="font-mono font-semibold truncate">
                    {col.header} <span className="text-slate-400">({col.type})</span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveCol(cIdx, -1)}
                      disabled={cIdx === 0}
                      className="p-1 rounded hover:bg-slate-800 disabled:opacity-35"
                      title="Move earlier"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveCol(cIdx, 1)}
                      disabled={cIdx === index.columns.length - 1}
                      className="p-1 rounded hover:bg-slate-800 disabled:opacity-35"
                      title="Move later"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleColFlag(col.id, 'frozen')}
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] border flex items-center gap-1 ${
                        col.frozen
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      <Lock className="w-2.5 h-2.5" />
                      Freeze
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleColFlag(col.id, 'hidden')}
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] border flex items-center gap-1 ${
                        col.hidden
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      <EyeOff className="w-2.5 h-2.5" />
                      Hide
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveColumn(col.id)}
                      disabled={index.columns.length <= 1}
                      className="p-1 rounded text-rose-400 hover:bg-rose-500/20 disabled:opacity-35"
                      title="Remove column"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                type="text"
                value={newColHeader}
                onChange={(e) => setNewColHeader(e.target.value)}
                placeholder="New column header..."
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
              />
              <select
                value={newColType}
                onChange={(e) => setNewColType(e.target.value as MatrixColumnType)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
              >
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="ability-list">ability-list</option>
              </select>
              <button
                type="button"
                onClick={handleAddColumn}
                className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
              >
                Add Column
              </button>
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={insertRowLevel}
                  onChange={(e) => setInsertRowLevel(e.target.value)}
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const lvl = Math.max(1, Math.min(40, parseInt(insertRowLevel, 10) || 1));
                    commit(insertIndexRow(index, lvl), `Ensured row level ${lvl}.`);
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-mono"
                >
                  Insert Row Lvl
                </button>
              </div>
            </div>
          </div>

          {/* 4. Autofill + Append */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2.5">
            <div className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Autofill Column &amp; Append Index
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={autofillColId}
                onChange={(e) => setAutofillColId(e.target.value)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono flex-1 min-w-0"
              >
                {index.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.header}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={autofillInstruction}
                onChange={(e) => setAutofillInstruction(e.target.value)}
                placeholder="+1, +1>3, +1!2, =bab+special"
                className="w-32 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (!autofillColId || !autofillInstruction.trim()) return;
                  commit(
                    autofillIndexColumn(index, autofillColId, autofillInstruction),
                    `Autofilled column with "${autofillInstruction}".`
                  );
                }}
                className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shrink-0"
              >
                Fill
              </button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-mono text-slate-400 shrink-0">Append under:</span>
              <select
                value={index.appendToIndexId || ''}
                onChange={(e) =>
                  commit(
                    appendIndex(index, e.target.value || undefined),
                    e.target.value
                      ? `Appended "${index.name}" to parent index.`
                      : `Detached "${index.name}" from parent.`
                  )
                }
                className="flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
              >
                <option value="">Standalone (None)</option>
                {allIndexes
                  .filter((other) => other.id !== index.id)
                  .map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* 5. Assign & Auto Assign All */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5" />
                Assign SOT Sections
              </div>
              <button
                type="button"
                onClick={() => {
                  const lookup = buildAutoAssignLookup(sotSections);
                  const next = autoAssignIndex(index, lookup);
                  commit(
                    next,
                    `Auto Assigned ${next.assignments?.length || 0} terms against SOT index.json.`
                  );
                }}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[11px] flex items-center gap-1"
              >
                <Wand2 className="w-3 h-3" />
                Auto Assign All
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="text"
                value={assignValueInput}
                onChange={(e) => setAssignValueInput(e.target.value)}
                placeholder="Cell token (e.g. Sneak Attack)"
                list="matrix-cell-tokens"
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
              />
              <input
                type="text"
                value={assignSectionId}
                onChange={(e) => setAssignSectionId(e.target.value)}
                placeholder="Section ID (sec-...)"
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
              />
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={assignText}
                onChange={(e) => setAssignText(e.target.value)}
                placeholder="Summary / override text (optional)"
                className="flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-700"
              />
              <button
                type="button"
                onClick={() => {
                  if (!assignValueInput.trim() || !assignSectionId.trim()) return;
                  commit(
                    assignMatrixValue(
                      index,
                      assignValueInput.trim(),
                      assignSectionId.trim(),
                      assignText.trim() || undefined
                    ),
                    `Assigned "${assignValueInput.trim()}" -> section ${assignSectionId.trim()}.`
                  );
                }}
                className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shrink-0"
              >
                Assign
              </button>
            </div>
          </div>

          {/* 6. Bind (take-highest / count-total) */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2 md:col-span-2">
            <div className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" />
              Bind Overlapping / Stacking Terms
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={bindValueInput}
                onChange={(e) => setBindValueInput(e.target.value)}
                placeholder="Ability/term (e.g. Sneak Attack or Evasion)"
                list="matrix-cell-tokens"
                className="flex-1 min-w-[160px] px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
              />
              <select
                value={bindMode}
                onChange={(e) => setBindMode(e.target.value as 'take-highest' | 'count-total')}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
              >
                <option value="take-highest">take-highest (Evasion / Uncanny Dodge)</option>
                <option value="count-total">count-total (Sneak Attack / Channel)</option>
              </select>
              <input
                type="text"
                value={bindKeyInput}
                onChange={(e) => setBindKeyInput(e.target.value)}
                placeholder="Group key (defaults to term)"
                className="w-40 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (!bindValueInput.trim()) return;
                  const next = bindMatrixValue(
                    index,
                    bindValueInput.trim(),
                    bindMode,
                    bindKeyInput.trim() || bindValueInput.trim()
                  );
                  commit(next, `Bound "${bindValueInput.trim()}" using ${bindMode}.`);
                  setBindValueInput('');
                }}
                className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold"
              >
                Add Bind
              </button>
            </div>
            {(index.bindings || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {index.bindings!.map((b) => (
                  <span
                    key={`${b.value}:${b.key}`}
                    className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono text-[10px]"
                  >
                    {b.value} â†’ {b.mode} ({b.key})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
