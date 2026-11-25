import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Table2,
  Sparkles,
  Rows,
} from 'lucide-react';
import type {
  CareerIndex,
  CareerIndexTrack,
  PF1Character,
  UserMatrixIndex,
} from '../../../types/character';
import {
  MATRIX_DEFAULT_ROWS,
  MATRIX_MAX_ROWS,
  abilityTypeFromTag,
  createMatrixId,
  deriveMatrix,
  makeColumns,
  materializeTrack,
  migrateClassGrids,
  parseHeaderFill,
  parseIndexToken,
  type MatrixCellState,
} from '../../../engine/matrix/matrixEngine';
import { applyMatrixProgressionToCharacter } from '../../../engine/characterIntegration';
import { loadSrdIngestArtifacts, srdDocFolderName } from '../../../storage/fsAdapter';
import { getActiveHostSrdOwner } from '../../../engine/sotEngine';
import { EditIndexModal, type MatrixSectionRef } from './EditIndexModal';
import { SotClassifiedPicker } from './SotClassifiedPicker';

export interface CharacterMatrixPanelProps {
  character: PF1Character;
  onUpdateCharacter: (updater: (prev: PF1Character) => PF1Character) => void;
  defaultActiveTab?: 'matrix' | 'career' | string;
}

export function resolveMatrixIndexes(character: PF1Character): Record<string, UserMatrixIndex> {
  if (character.matrixIndexes && Object.keys(character.matrixIndexes).length > 0) {
    return character.matrixIndexes;
  }
  return migrateClassGrids(character.customClassGrids);
}

export function createBlankUserMatrixIndex(
  existingIndexes: Record<string, UserMatrixIndex>,
  requestedName?: string
): UserMatrixIndex {
  const count = Object.keys(existingIndexes).length + 1;
  const name = requestedName?.trim() || `Class ${count}`;
  const id = createMatrixId('idx', name, Object.keys(existingIndexes));
  return {
    id,
    name,
    columns: makeColumns(['Level', 'BAB', 'Fort', 'Ref', 'Will', 'Special']),
    rows: [],
  };
}

export function ensureInitialCareerTrack(
  career: CareerIndex | undefined,
  firstIndexName: string,
  rowCount: number = MATRIX_DEFAULT_ROWS
): CareerIndex {
  const currentTracks = career?.tracks || [];
  if (currentTracks.length > 0) {
    return { tracks: currentTracks };
  }
  const initialTrack: CareerIndexTrack = {
    id: createMatrixId('trk', 'Track A', []),
    header: `=${firstIndexName}`,
    cells: Array.from({ length: rowCount }, () => ''),
  };
  return { tracks: [initialTrack] };
}

export function createNewUserIndexInCharacter(
  character: PF1Character,
  name?: string
): {
  nextCharacter: PF1Character;
  createdIndex: UserMatrixIndex;
} {
  const existing = resolveMatrixIndexes(character);
  const createdIndex = createBlankUserMatrixIndex(existing, name);
  const nextIndexes = { ...existing, [createdIndex.id]: createdIndex };
  const nextCareer = ensureInitialCareerTrack(character.careerIndex, createdIndex.name);
  return {
    createdIndex,
    nextCharacter: {
      ...character,
      matrixIndexes: nextIndexes,
      careerIndex: nextCareer,
    },
  };
}

export function getCellStateClasses(state: MatrixCellState | undefined): string {
  if (state === 'red') {
    return 'border-rose-500/80 bg-rose-950/35 text-rose-200';
  }
  if (state === 'yellow') {
    return 'border-amber-500/70 bg-amber-950/30 text-amber-200';
  }
  if (state === 'green') {
    return 'border-emerald-500/60 bg-emerald-950/25 text-emerald-100';
  }
  return 'border-slate-700 bg-slate-900 text-slate-100';
}

export const CharacterMatrixPanel: React.FC<CharacterMatrixPanelProps> = ({
  character,
  onUpdateCharacter,
  defaultActiveTab = 'matrix',
}) => {
  const userIndexes = useMemo(() => resolveMatrixIndexes(character), [character]);
  const indexList = useMemo(() => Object.values(userIndexes), [userIndexes]);
  const careerIndex: CareerIndex = useMemo(
    () => character.careerIndex || { tracks: [] },
    [character.careerIndex]
  );

  const [activeTab, setActiveTab] = useState<'matrix' | 'career' | string>(defaultActiveTab);
  const [rowCount, setRowCount] = useState<number>(MATRIX_DEFAULT_ROWS);
  const [editingIndexId, setEditingIndexId] = useState<string | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    indexId: string;
    x: number;
    y: number;
  } | null>(null);
  const [isSotPickerOpen, setIsSotPickerOpen] = useState(false);
  const [sotSections, setSotSections] = useState<MatrixSectionRef[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const derivedMatrix = useMemo(
    () => deriveMatrix(userIndexes, careerIndex, rowCount),
    [userIndexes, careerIndex, rowCount]
  );

  // Load SOT index.json sections lazily when Edit Index opens so Auto Assign All can match
  useEffect(() => {
    if (!editingIndexId) return;
    const docs = character.sotCatalogue?.overridePages || [];
    if (docs.length === 0) return;
    let cancelled = false;
    const ownerId = getActiveHostSrdOwner() || character.name?.trim() || 'session-default';
    void Promise.all(
      docs.map((doc) =>
        loadSrdIngestArtifacts({
          characterName: character.name,
          characterId: ownerId,
          docFolder: srdDocFolderName(doc.title, doc.id),
        }).then((res) => {
          if (!res.ok) return [] as MatrixSectionRef[];
          const idxObj = (res.artifacts['index.json'] || {}) as {
            sections?: Array<{
              id?: string;
              headingPath?: string[];
              text?: string;
              keywords?: string[];
            }>;
          };
          return (idxObj.sections || []).map((s, i) => ({
            sectionId: s.id || `${doc.id}-sec-${i}`,
            headingPath: s.headingPath || [doc.title],
            text: s.text || '',
            keywords: s.keywords || [],
          }));
        })
      )
    ).then((groups) => {
      if (!cancelled) setSotSections(groups.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [editingIndexId, character.name, character.sotCatalogue?.overridePages]);

  const activeUserIndex: UserMatrixIndex | undefined =
    activeTab !== 'matrix' && activeTab !== 'career' ? userIndexes[activeTab] : undefined;
  const editingIndex = editingIndexId ? userIndexes[editingIndexId] : undefined;

  const commitMatrixState = (
    nextIndexes: Record<string, UserMatrixIndex>,
    nextCareer: CareerIndex = careerIndex
  ) => {
    onUpdateCharacter((prev) => ({
      ...prev,
      matrixIndexes: nextIndexes,
      careerIndex: nextCareer,
    }));
  };

  const handleCreateNewIndex = () => {
    const { createdIndex, nextCharacter } = createNewUserIndexInCharacter(character);
    onUpdateCharacter(() => nextCharacter);
    setActiveTab(createdIndex.id);
    setNotice(`Created User Index "${createdIndex.name}" and synced Career Index Track A.`);
  };

  const handleDeleteIndex = (idxId: string) => {
    const remaining = { ...userIndexes };
    delete remaining[idxId];
    commitMatrixState(remaining);
    if (activeTab === idxId) setActiveTab('matrix');
    setContextMenuState(null);
  };

  const handleUpdateUserCell = (
    index: UserMatrixIndex,
    level: number,
    colId: string,
    nextValue: string
  ) => {
    if (level === 0) {
      const nextRow0 = {
        level: 0,
        values: { ...(index.row0?.values || {}), [colId]: nextValue },
      };
      commitMatrixState({
        ...userIndexes,
        [index.id]: { ...index, row0: nextRow0 },
      });
      return;
    }

    const existingRows = [...index.rows];
    const rowIdx = existingRows.findIndex((r) => r.level === level);
    if (rowIdx >= 0) {
      existingRows[rowIdx] = {
        ...existingRows[rowIdx],
        values: { ...existingRows[rowIdx].values, [colId]: nextValue },
      };
    } else {
      existingRows.push({ level, values: { [colId]: nextValue } });
      existingRows.sort((a, b) => a.level - b.level);
    }

    commitMatrixState({
      ...userIndexes,
      [index.id]: { ...index, rows: existingRows },
    });
  };

  const handleAddCareerTrack = () => {
    const letter = String.fromCharCode(65 + careerIndex.tracks.length);
    const track: CareerIndexTrack = {
      id: createMatrixId('trk', `Track ${letter}`, careerIndex.tracks.map((t) => t.id)),
      header: '',
      cells: Array.from({ length: rowCount }, () => ''),
    };
    commitMatrixState(userIndexes, {
      tracks: [...careerIndex.tracks, track],
    });
  };

  const handleUpdateCareerTrackHeader = (trackId: string, headerValue: string) => {
    const parsedFill = headerValue.trim() ? parseHeaderFill(headerValue) : undefined;
    const nextTracks = careerIndex.tracks.map((trk) => {
      if (trk.id !== trackId) return trk;
      const updated = { ...trk, header: headerValue };
      if (parsedFill && !('error' in parsedFill)) {
        const mat = materializeTrack(updated, rowCount);
        if (!mat.error && headerValue.trim().startsWith('+')) {
          return { ...updated, cells: mat.cells };
        }
      }
      return updated;
    });
    commitMatrixState(userIndexes, { tracks: nextTracks });
  };

  const handleUpdateCareerCell = (trackId: string, rowOffset: number, value: string) => {
    const nextTracks = careerIndex.tracks.map((trk) => {
      if (trk.id !== trackId) return trk;
      const nextCells = [...trk.cells];
      while (nextCells.length < rowCount) nextCells.push('');
      nextCells[rowOffset] = value;
      return { ...trk, cells: nextCells };
    });
    commitMatrixState(userIndexes, { tracks: nextTracks });
  };

  const handleRemoveCareerTrack = (trackId: string) => {
    commitMatrixState(userIndexes, {
      tracks: careerIndex.tracks.filter((t) => t.id !== trackId),
    });
  };

  const handleApplyDerivedMatrix = () => {
    onUpdateCharacter((prev) => applyMatrixProgressionToCharacter(prev, derivedMatrix));
    setNotice('Applied derived Character Matrix (saves, BAB, levels, feats, actions, spells) to character sheet.');
  };

  return (
    <div className="flex flex-col space-y-3 text-xs">
      {/* Top Folder Tab Bar: Matrix, Career Index, User Indexes (with Append overlap), & Empty '+' Tab */}
      <div className="flex items-end justify-between gap-2 border-b border-slate-700 pb-0 flex-wrap">
        <div className="flex items-end gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-t-lg font-mono font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'bg-slate-950 text-emerald-300 border-t-2 border-x border-emerald-400'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-t border-x border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Character Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('career')}
            className={`px-3 py-1.5 rounded-t-lg font-mono font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'career'
                ? 'bg-slate-950 text-amber-300 border-t-2 border-x border-amber-400'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-t border-x border-slate-800'
            }`}
          >
            <Rows className="w-3.5 h-3.5" />
            <span>Career Index ({careerIndex.tracks.length})</span>
          </button>

          {indexList.map((idx) => {
            const isActive = activeTab === idx.id;
            const isAppended = Boolean(idx.appendToIndexId);
            return (
              <div
                key={idx.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenuState({ indexId: idx.id, x: e.clientX, y: e.clientY });
                }}
                className={`relative group flex items-center gap-1 rounded-t-lg px-3 py-1.5 font-mono cursor-pointer transition-colors ${
                  isAppended ? '-ml-2 border-l-2 border-dashed border-purple-400/70' : ''
                } ${
                  isActive
                    ? 'bg-slate-950 text-cyan-300 border-t-2 border-x border-cyan-400 z-10 font-bold'
                    : 'bg-slate-900/80 text-slate-300 hover:bg-slate-900 border-t border-x border-slate-800'
                }`}
                onClick={() => setActiveTab(idx.id)}
                title="Click to open User Index â€¢ Right-click for Edit Index menu"
              >
                <span>{idx.name}</span>
                {isAppended && (
                  <span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-300">
                    +App
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingIndexId(idx.id);
                  }}
                  aria-label={`Edit Index ${idx.name}`}
                  title="Edit Index"
                  className="p-0.5 rounded opacity-65 hover:opacity-100 hover:text-cyan-300"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Empty '+' Tab at far right edge */}
          <button
            type="button"
            onClick={handleCreateNewIndex}
            aria-label="New Index"
            title="Create blank User Index (populates Career Index Track A first time)"
            className="px-2.5 py-1.5 rounded-t-lg border-t border-x border-dashed border-slate-700 bg-slate-900/40 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 font-mono flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 pb-1.5">
          <button
            type="button"
            onClick={() =>
              setRowCount((cur) =>
                cur === MATRIX_DEFAULT_ROWS ? MATRIX_MAX_ROWS : MATRIX_DEFAULT_ROWS
              )
            }
            className="px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-[11px]"
          >
            Rows: 1â€“{rowCount}
          </button>
          <button
            type="button"
            onClick={() => setIsSotPickerOpen(true)}
            className="px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-mono text-[11px] flex items-center gap-1"
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>Populate from SOT</span>
          </button>
        </div>
      </div>

      {/* Dismissable Feedback Notice */}
      {notice && (
        <div className="px-3 py-1.5 rounded border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 font-mono flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} className="underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Diagnostics Banner */}
      {derivedMatrix.diagnostics.length > 0 && (
        <div className="px-3 py-2 rounded border border-rose-500/40 bg-rose-950/30 text-rose-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-[11px] font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Matrix Diagnostics ({derivedMatrix.diagnostics.length})
          </div>
          {derivedMatrix.diagnostics.slice(0, 4).map((d, i) => (
            <div key={i} className="text-[11px] font-mono opacity-90">
              â€¢ Row {d.row || 'Header'} ({d.trackId}): {d.message}
            </div>
          ))}
        </div>
      )}

      {/* Right-Click Context Menu */}
      {contextMenuState && (
        <div
          className="fixed z-50 w-44 rounded-lg border border-cyan-500/50 bg-slate-950 shadow-2xl p-1 space-y-0.5 text-xs font-mono"
          style={{ top: Math.max(12, contextMenuState.y), left: Math.max(12, contextMenuState.x) }}
          onMouseLeave={() => setContextMenuState(null)}
        >
          <button
            type="button"
            onClick={() => {
              setEditingIndexId(contextMenuState.indexId);
              setContextMenuState(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-cyan-500/20 text-cyan-200"
          >
            Edit Index...
          </button>
          <button
            type="button"
            onClick={() => handleDeleteIndex(contextMenuState.indexId)}
            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-rose-500/20 text-rose-300"
          >
            Delete Index
          </button>
        </div>
      )}

      {/* TAB VIEW 1: DERIVED CHARACTER MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-mono text-slate-400">
              Derived read-only matrix combining User Indexes &amp; Career Index tracks ({derivedMatrix.columns.filter((c) => !c.hidden).length} visible columns)
            </span>
            <button
              type="button"
              onClick={handleApplyDerivedMatrix}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apply Matrix to Sheet</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto pf1-theme-scrollbar border border-slate-800 rounded-lg">
            <table className="min-w-full border-collapse text-[11px] font-mono">
              <thead className="sticky top-0 bg-slate-950 border-b border-slate-700 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left text-slate-400 border-r border-slate-800">
                    Lvl
                  </th>
                  {derivedMatrix.columns
                    .filter((c) => !c.hidden)
                    .map((col) => (
                      <th
                        key={col.id}
                        className={`px-2 py-1.5 text-left text-cyan-300 border-r border-slate-800 whitespace-nowrap ${
                          col.frozen ? 'sticky left-10 bg-slate-950 z-10' : ''
                        }`}
                      >
                        {col.header}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {derivedMatrix.row0 && (
                  <tr className="bg-amber-950/30 border-b border-amber-500/30">
                    <td className="px-2 py-1 font-bold text-amber-300 border-r border-slate-800">
                      0 (Race)
                    </td>
                    {derivedMatrix.columns
                      .filter((c) => !c.hidden)
                      .map((col) => (
                        <td key={col.id} className="px-2 py-1 border-r border-slate-800">
                          {derivedMatrix.row0?.values[col.id] || ''}
                        </td>
                      ))}
                  </tr>
                )}
                {derivedMatrix.rows.map((row) => (
                  <tr
                    key={row.level}
                    className="border-b border-slate-800/70 hover:bg-slate-900/60"
                    title={
                      row.sourceIndexIds.length > 0
                        ? `Sources: ${row.sourceIndexIds.join(', ')}`
                        : 'Blank row'
                    }
                  >
                    <td className="px-2 py-1 font-bold text-slate-300 border-r border-slate-800">
                      {row.level}
                    </td>
                    {derivedMatrix.columns
                      .filter((c) => !c.hidden)
                      .map((col) => (
                        <td key={col.id} className="px-2 py-1 border-r border-slate-800">
                          {row.values[col.id] || ''}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB VIEW 2: CAREER INDEX */}
      {activeTab === 'career' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-mono text-slate-400">
              Syntax: header shortcuts (=wizard, +1, +1&gt;3, +1!2) â€¢ cells: fighter4, wizard1*2, comma gestalt, +bab, -bab, =bab+special
            </span>
            <button
              type="button"
              onClick={handleAddCareerTrack}
              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Track
            </button>
          </div>

          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto pf1-theme-scrollbar border border-slate-800 rounded-lg">
            <table className="min-w-full border-collapse text-[11px] font-mono">
              <thead className="sticky top-0 bg-slate-950 border-b border-slate-700 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left text-slate-400 border-r border-slate-800 w-16">
                    Level
                  </th>
                  {careerIndex.tracks.map((trk, tIdx) => {
                    const parsedHdr = trk.header.trim() ? parseHeaderFill(trk.header) : undefined;
                    const hdrError = parsedHdr && 'error' in parsedHdr ? parsedHdr.error : null;
                    return (
                      <th
                        key={trk.id}
                        className="px-2 py-1.5 border-r border-slate-800 min-w-[180px]"
                      >
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={trk.header}
                            onChange={(e) => handleUpdateCareerTrackHeader(trk.id, e.target.value)}
                            placeholder={`Track ${String.fromCharCode(65 + tIdx)} (=wizard, +1)`}
                            className={`flex-1 min-w-0 px-2 py-0.5 rounded border text-xs ${
                              hdrError
                                ? 'border-rose-500 bg-rose-950/40 text-rose-200'
                                : 'border-slate-700 bg-slate-900 text-amber-200'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveCareerTrack(trk.id)}
                            title="Remove Track"
                            className="p-0.5 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }, (_, rIdx) => (
                  <tr key={rIdx + 1} className="border-b border-slate-800/70">
                    <td className="px-2 py-1 font-bold text-slate-400 border-r border-slate-800">
                      {rIdx + 1}
                    </td>
                    {careerIndex.tracks.map((trk) => {
                      const val = trk.cells[rIdx] || '';
                      const cellState = derivedMatrix.cellStates[`${trk.id}:${rIdx + 1}`];
                      const tokenCheck = val.trim() ? parseIndexToken(val.split(',')[0]) : null;
                      const cellTitle =
                        tokenCheck && 'error' in tokenCheck
                          ? tokenCheck.error
                          : cellState
                          ? `State: ${cellState}`
                          : '';
                      return (
                        <td key={trk.id} className="p-1 border-r border-slate-800">
                          <input
                            type="text"
                            value={val}
                            onChange={(e) =>
                              handleUpdateCareerCell(trk.id, rIdx, e.target.value)
                            }
                            placeholder="e.g. fighter1 or fighter1, wizard1"
                            title={cellTitle}
                            className={`w-full px-2 py-0.5 rounded border text-[11px] font-mono ${getCellStateClasses(
                              cellState
                            )}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB VIEW 3: USER INDEX EDITOR */}
      {activeUserIndex && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={activeUserIndex.name}
                onChange={(e) =>
                  commitMatrixState({
                    ...userIndexes,
                    [activeUserIndex.id]: { ...activeUserIndex, name: e.target.value },
                  })
                }
                aria-label="Index Name"
                className="px-2.5 py-1 rounded bg-slate-950 border border-cyan-500/40 text-cyan-200 font-bold text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setEditingIndexId(activeUserIndex.id)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 font-mono flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Index
              </button>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Tag cell items with &lt;act&gt;, &lt;rec&gt;, &lt;spell&gt;, &lt;feat&gt; to route on Apply
            </span>
          </div>

          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto pf1-theme-scrollbar border border-slate-800 rounded-lg">
            <table className="min-w-full border-collapse text-[11px] font-mono">
              <thead className="sticky top-0 bg-slate-950 border-b border-slate-700 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left text-slate-400 border-r border-slate-800 w-16">
                    Lvl
                  </th>
                  {activeUserIndex.columns
                    .filter((c) => !c.hidden)
                    .map((col) => (
                      <th
                        key={col.id}
                        className="px-2 py-1.5 text-left text-cyan-300 border-r border-slate-800 min-w-[120px]"
                      >
                        {col.header}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {activeUserIndex.row0 && (
                  <tr className="bg-amber-950/25 border-b border-amber-500/30">
                    <td className="px-2 py-1 font-bold text-amber-300 border-r border-slate-800">
                      0 (Race)
                    </td>
                    {activeUserIndex.columns
                      .filter((c) => !c.hidden)
                      .map((col) => (
                        <td key={col.id} className="p-1 border-r border-slate-800">
                          <input
                            type="text"
                            value={activeUserIndex.row0?.values[col.id] || ''}
                            onChange={(e) =>
                              handleUpdateUserCell(activeUserIndex, 0, col.id, e.target.value)
                            }
                            className="w-full px-1.5 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-amber-100"
                          />
                        </td>
                      ))}
                  </tr>
                )}
                {Array.from({ length: rowCount }, (_, i) => i + 1).map((lvl) => {
                  const rowObj = activeUserIndex.rows.find((r) => r.level === lvl);
                  return (
                    <tr key={lvl} className="border-b border-slate-800/70">
                      <td className="px-2 py-1 font-bold text-slate-400 border-r border-slate-800">
                        {lvl}
                      </td>
                      {activeUserIndex.columns
                        .filter((c) => !c.hidden)
                        .map((col) => {
                          const cellVal = rowObj?.values[col.id] || '';
                          const tagged =
                            col.type === 'ability-list' && cellVal.trim()
                              ? abilityTypeFromTag(cellVal)
                              : null;
                          return (
                            <td key={col.id} className="p-1 border-r border-slate-800">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={cellVal}
                                  onChange={(e) =>
                                    handleUpdateUserCell(
                                      activeUserIndex,
                                      lvl,
                                      col.id,
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-100"
                                />
                                {tagged && (
                                  <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 shrink-0">
                                    {tagged.type}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Index Modal */}
      {editingIndex && (
        <EditIndexModal
          isOpen={true}
          onClose={() => setEditingIndexId(null)}
          index={editingIndex}
          allIndexes={indexList}
          sotSections={sotSections}
          onApplyIndex={(updated) => {
            commitMatrixState({
              ...userIndexes,
              [updated.id]: updated,
            });
          }}
        />
      )}

      {/* Classified SOT Table Picker */}
      <SotClassifiedPicker
        isOpen={isSotPickerOpen}
        onClose={() => setIsSotPickerOpen(false)}
        character={character}
        existingIndexIds={Object.keys(userIndexes)}
        onCreateIndexFromSot={(builtIndex, docTitle) => {
          const nextIndexes = { ...userIndexes, [builtIndex.id]: builtIndex };
          const nextCareer = ensureInitialCareerTrack(careerIndex, builtIndex.name, rowCount);
          commitMatrixState(nextIndexes, nextCareer);
          setActiveTab(builtIndex.id);
          setNotice(`Imported classified SOT tables from "${docTitle}" as Matrix Index "${builtIndex.name}".`);
        }}
      />
    </div>
  );
};
