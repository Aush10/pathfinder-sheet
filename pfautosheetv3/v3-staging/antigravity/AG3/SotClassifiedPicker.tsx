import React, { useEffect, useMemo, useState } from 'react';
import { Table2, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { PF1Character, SOTRichTextPage, UserMatrixIndex } from '../../../../src/types/character';
import {
  getActiveHostSrdOwner,
  loadHostSrdDocsForCharacter,
} from '../../../../src/engine/sotEngine';
import {
  loadSrdIngestArtifacts,
  srdDocFolderName,
  type SrdIngestArtifacts,
} from '../../../../src/storage/fsAdapter';
import {
  createMatrixId,
  indexFromClassifiedTables,
} from '../../codex/CX3/matrixEngine';

export type IngestTable = Parameters<typeof indexFromClassifiedTables>[2][number];

export interface SotClassifiedPickerProps {
  isOpen: boolean;
  onClose: () => void;
  character: PF1Character;
  existingIndexIds: string[];
  onCreateIndexFromSot: (index: UserMatrixIndex, docTitle: string) => void;
}

export interface ClassifiedDocEntry {
  doc: SOTRichTextPage;
  eligibleTables: IngestTable[];
  lookupTables: IngestTable[];
  source: 'artifact' | 'none';
}

export function splitIngestTablesByEligibility(artifacts: SrdIngestArtifacts | null | undefined): {
  eligibleTables: IngestTable[];
  lookupTables: IngestTable[];
} {
  if (!artifacts) return { eligibleTables: [], lookupTables: [] };
  const rawObj = (artifacts['table.json'] || {}) as { tables?: IngestTable[] };
  const tables = Array.isArray(rawObj.tables) ? rawObj.tables : [];
  const eligibleTables = tables.filter(
    (t) =>
      t.kind === 'class-grid' ||
      t.kind === 'extended-grid' ||
      t.kind === 'casting-subgrid'
  );
  const lookupTables = tables.filter((t) => t.kind === 'lookup-table');
  return { eligibleTables, lookupTables };
}

export const SotClassifiedPicker: React.FC<SotClassifiedPickerProps> = ({
  isOpen,
  onClose,
  character,
  existingIndexIds,
  onCreateIndexFromSot,
}) => {
  const [entries, setEntries] = useState<ClassifiedDocEntry[]>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // B9: per-character host docs only, never DEFAULT_SOT_CATALOGUE
  const sotDocs = useMemo(() => {
    const ownerId = getActiveHostSrdOwner() || '';
    const hostDocs =
      typeof window !== 'undefined' && ownerId ? loadHostSrdDocsForCharacter(ownerId) : [];
    const base = character.sotCatalogue?.overridePages || [];
    const byId = new Map<string, SOTRichTextPage>();
    hostDocs.forEach((d) => byId.set(d.id, d));
    base.forEach((d) => byId.set(d.id, d));
    return Array.from(byId.values());
  }, [character.name, character.sotCatalogue?.overridePages]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const ownerId = getActiveHostSrdOwner() || character.name?.trim() || 'session-default';
    void Promise.all(
      sotDocs.map(async (doc): Promise<ClassifiedDocEntry> => {
        const res = await loadSrdIngestArtifacts({
          characterName: character.name,
          characterId: ownerId,
          docFolder: srdDocFolderName(doc.title, doc.id),
        });
        if (!res.ok) {
          return { doc, eligibleTables: [], lookupTables: [], source: 'none' };
        }
        const split = splitIngestTablesByEligibility(res.artifacts);
        return {
          doc,
          eligibleTables: split.eligibleTables,
          lookupTables: split.lookupTables,
          source: 'artifact',
        };
      })
    ).then((resolved) => {
      if (cancelled) return;
      setEntries(resolved);
      const defaults: Record<string, boolean> = {};
      resolved.forEach((entry) => {
        entry.eligibleTables.forEach((tbl) => {
          defaults[`${entry.doc.id}:${tbl.id}`] = true;
        });
      });
      setSelectedTableIds(defaults);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, sotDocs, character.name]);

  if (!isOpen) return null;

  const handleImportDoc = (entry: ClassifiedDocEntry) => {
    setErrorMsg(null);
    const picked = entry.eligibleTables.filter(
      (tbl) => selectedTableIds[`${entry.doc.id}:${tbl.id}`] !== false
    );
    if (picked.length === 0) {
      setErrorMsg(
        `"${entry.doc.title}" has no Matrix-eligible class/casting/extended tables selected (lookup-table tables stay Reference Only).`
      );
      return;
    }
    const newId = createMatrixId('idx', entry.doc.title, existingIndexIds);
    const built = indexFromClassifiedTables(newId, entry.doc.title, picked);
    if ('error' in built) {
      setErrorMsg(built.error);
      return;
    }
    onCreateIndexFromSot(built, entry.doc.title);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Import Classified SOT Tables into Matrix Index"
    >
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl border border-cyan-500/40 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden text-xs">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-cyan-300">
              Create Matrix Index from Classified SOT Tables
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="px-5 py-2 bg-amber-500/15 border-b border-amber-500/40 text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pf1-theme-scrollbar p-4 space-y-3">
          {entries.length === 0 ? (
            <div className="p-4 rounded border border-slate-800 bg-slate-950/60 text-slate-400">
              No per-character SOT documents found. Use the Source of Truth (SOT) Library to import HTML/MD class documents first.
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.doc.id}
                className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-bold text-slate-100">{entry.doc.title}</div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {entry.eligibleTables.length} eligible progression tables •{' '}
                      {entry.lookupTables.length} reference-only lookup tables
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleImportDoc(entry)}
                    disabled={entry.eligibleTables.length === 0}
                    className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-45 text-white font-semibold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Import into Matrix
                  </button>
                </div>

                {entry.eligibleTables.length > 0 && (
                  <div className="space-y-1">
                    {entry.eligibleTables.map((tbl) => {
                      const key = `${entry.doc.id}:${tbl.id}`;
                      return (
                        <label
                          key={tbl.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTableIds[key] !== false}
                              onChange={(e) =>
                                setSelectedTableIds((prev) => ({ ...prev, [key]: e.target.checked }))
                              }
                            />
                            <span className="font-mono text-slate-200">
                              {tbl.caption || tbl.id}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                            {tbl.kind} ({tbl.rows.length} rows)
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {entry.lookupTables.length > 0 && (
                  <div className="pt-1 border-t border-slate-800 space-y-1">
                    <div className="text-[10px] font-mono text-amber-400 uppercase">
                      Reference Only (Excluded from Matrix — View in Journal/SOT)
                    </div>
                    {entry.lookupTables.map((tbl) => (
                      <div
                        key={tbl.id}
                        className="flex items-center justify-between px-2.5 py-1 rounded bg-amber-950/20 border border-amber-500/25 text-amber-200/80 font-mono text-[11px]"
                      >
                        <span>{tbl.caption || tbl.id}</span>
                        <span>lookup-table</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
