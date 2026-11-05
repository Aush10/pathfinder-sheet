import React from 'react';
import { RotateCcw, X } from 'lucide-react';

export interface CrashRecoveryBannerProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Banner displayed on startup when loadCrash() returns a character snapshot.
 *
 * // TODO(backend): Optionally allow clearing or archiving the disk crash file on dismiss.
 */
export const CrashRecoveryBanner: React.FC<CrashRecoveryBannerProps> = ({
  visible,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <div
      role="status"
      className="bg-amber-950/90 border-b border-amber-500/40 text-amber-200 px-4 py-1.5 text-xs font-mono flex items-center justify-between gap-3 print:hidden"
    >
      <div className="flex items-center gap-2">
        <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="font-semibold">Recovered from autosave</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800/80 border border-amber-500/40 text-amber-100 text-[11px] font-bold flex items-center gap-1 transition-colors"
      >
        <span>Dismiss</span>
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
