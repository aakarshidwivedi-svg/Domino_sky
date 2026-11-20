import React from 'react';
import { useOperational } from '../context/OperationalContext';
import { AIBriefingPanel } from '../components/briefing/AIBriefingPanel';
import { Bot, Download, FileJson, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';

export const AIBriefingView: React.FC = () => {
  const { simState } = useOperational();

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(simState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `domino_sky_scenario_${simState.meta.current_sim_time.replace(':', '')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    const headers = [
      'flight_id',
      'tail_id',
      'leg_order',
      'origin',
      'destination',
      'scheduled_dep',
      'scheduled_arr',
      'predicted_dep',
      'predicted_arr',
      'delay_minutes',
      'status',
      'pax',
      'root_cause',
    ];
    const rows = Object.values(simState.flights).map((f) => [
      f.flight_id,
      f.tail_id,
      f.leg_order,
      f.origin,
      f.destination,
      f.dep,
      f.arr,
      f.pred_dep,
      f.pred_arr,
      f.delay_minutes,
      f.status,
      f.pax,
      `"${f.root_cause.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `domino_sky_flights_${simState.meta.current_sim_time.replace(':', '')}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="h-full flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-navy-950 font-sans select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-occ-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-occ-cyan/40">
            <Bot className="w-5 h-5 text-occ-cyan" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-white tracking-wide">
              AI OPERATIONS BRIEFING & REPORTING
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Verified Deterministic Intelligence &bull; Downstream Impact Summary &bull; Scenario Export
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded-lg bg-navy-850 hover:bg-navy-800 text-slate-200 border border-occ-border transition-colors flex items-center gap-1.5"
            title="Export full scenario JSON data"
          >
            <FileJson className="w-4 h-4 text-occ-cyan" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg bg-navy-850 hover:bg-navy-800 text-slate-200 border border-occ-border transition-colors flex items-center gap-1.5"
            title="Export 70 flights schedule CSV"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Full Briefing Document */}
      <div className="max-w-4xl mx-auto">
        <AIBriefingPanel isFullView={true} />
      </div>
    </div>
  );
};
