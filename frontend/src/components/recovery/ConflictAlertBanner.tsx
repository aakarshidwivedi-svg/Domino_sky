import React from 'react';
import { ConflictWarning } from '../../types';
import { AlertOctagon } from 'lucide-react';

interface ConflictAlertBannerProps {
  conflicts: ConflictWarning[];
}

export const ConflictAlertBanner: React.FC<ConflictAlertBannerProps> = ({ conflicts }) => {
  if (!conflicts || conflicts.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-red-950/40 border-2 border-red-500/70 rounded-xl p-4 space-y-3 shadow-lg shadow-red-950/40"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-red-300 font-mono font-bold text-sm tracking-wider uppercase">
          <AlertOctagon className="w-5 h-5 text-red-400 flex-shrink-0" aria-hidden="true" />
          <span>Recovery Action Conflicts Detected ({conflicts.length})</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-900/60 text-red-200 border border-red-500">
          OCC INFEASIBILITY
        </span>
      </div>
      <div className="space-y-2">
        {conflicts.map((conf, idx) => (
          <div
            key={idx}
            className="bg-slate-950/80 border border-red-800/60 rounded-lg p-3 text-xs space-y-1"
          >
            <div className="flex items-center justify-between font-mono">
              <span className="font-bold text-red-400">
                [{conf.severity}] {conf.conflict_type.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">{conf.message}</p>
            <div className="flex flex-wrap gap-2 pt-1" aria-label="Conflicting operational actions">
              {conf.conflicting_actions.map((act, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-red-950 border border-red-700 text-red-300 font-mono text-[10px]"
                >
                  {act}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
