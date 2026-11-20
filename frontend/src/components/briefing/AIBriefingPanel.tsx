import React from 'react';
import { useOperational } from '../../context/OperationalContext';
import { AIBriefingRecommendation } from '../../types';
import {
  Bot,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Wrench,
  ArrowRight,
  Plane,
  Building2,
  Clock,
  Sparkles,
} from 'lucide-react';

interface AIBriefingPanelProps {
  isFullView?: boolean;
}

export const AIBriefingPanel: React.FC<AIBriefingPanelProps> = ({ isFullView = false }) => {
  const {
    simState,
    selectFlight,
    selectAirport,
    setWorkspace,
    deployments,
    deploySpare,
  } = useOperational();

  const briefing = simState.ai_briefing;
  if (!briefing) return null;

  const handleActionClick = (rec: AIBriefingRecommendation) => {
    if (rec.action_type === 'DEPLOY_SPARE') {
      if (rec.target_flight_id) selectFlight(rec.target_flight_id);
      setWorkspace('recovery');
    } else if (rec.action_type === 'INVESTIGATE_FLIGHT' && rec.target_flight_id) {
      selectFlight(rec.target_flight_id);
    } else if (rec.action_type === 'INSPECT_AIRPORT' && rec.airport_id) {
      selectAirport(rec.airport_id);
      setWorkspace('radar');
    }
  };

  return (
    <div
      className={`bg-navy-900 border border-occ-border rounded-2xl flex flex-col overflow-hidden shadow-occ-card font-sans select-none ${
        isFullView ? 'h-full flex-1 p-6' : 'p-4 space-y-4'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-occ-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-occ-cyan/40">
            <Bot className="w-4 h-4 text-occ-cyan" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
              <span>AI OPERATIONS BRIEFING</span>
              <span className="text-[10px] text-occ-cyan font-normal bg-cyan-950/60 px-1.5 py-0.2 rounded border border-occ-cyan/30">
                VERIFIED DETERMINISTIC
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Live IST &bull; Tactical Flight Analyst
            </div>
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-400">
          Generated: <strong className="text-white">{briefing.timestamp} IST</strong>
        </span>
      </div>

      <div className="space-y-4 overflow-y-auto pr-1 text-xs">
        {/* 1. Network Situation */}
        <div className="p-3 rounded-xl bg-navy-950/70 border border-occ-border space-y-1.5 font-mono">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Plane className="w-3.5 h-3.5 text-occ-cyan" />
            <span>Network Situation Overview</span>
          </div>
          <p className="text-slate-200 text-xs leading-relaxed">
            {briefing.network_situation}
          </p>
        </div>

        {/* 2. Critical Alerts */}
        {briefing.critical_alerts.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-occ-red" />
              <span>Critical Operational Alerts ({briefing.critical_alerts.length})</span>
            </div>

            <div className="space-y-1.5">
              {briefing.critical_alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-xl border font-mono text-[11px] flex items-start justify-between gap-2 transition-all ${
                    alert.severity === 'CRITICAL'
                      ? 'bg-red-950/20 border-occ-red/40 text-red-200'
                      : 'bg-amber-950/20 border-occ-amber/40 text-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-occ-red mt-0.5">&bull;</span>
                    <span className="leading-snug">{alert.text}</span>
                  </div>

                  {alert.flight_id && (
                    <button
                      onClick={() => selectFlight(alert.flight_id!)}
                      className="px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-700 text-white text-[10px] font-mono flex-shrink-0 border border-slate-700 transition-colors"
                    >
                      Investigate
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Root Cause Analysis */}
        <div className="p-3 rounded-xl bg-navy-950/70 border border-occ-border space-y-1.5 font-mono">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-occ-cyan" />
            <span>Root Cause & Propagation Analysis</span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            {briefing.root_cause_analysis}
          </p>
        </div>

        {/* 4. Prioritized Recommended Actions */}
        {briefing.recommended_actions.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-occ-cyan" />
              <span>Prioritized Recommended Actions</span>
            </div>

            <div className="space-y-2">
              {briefing.recommended_actions.map((rec, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-navy-850 border border-occ-border hover:border-occ-cyan/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                          rec.priority === 'HIGH'
                            ? 'bg-red-950 text-occ-red border border-occ-red/30'
                            : 'bg-cyan-950 text-occ-cyan border border-occ-cyan/30'
                        }`}
                      >
                        {rec.priority} PRIORITY
                      </span>
                      <span className="font-bold text-white text-xs font-mono">
                        {rec.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {rec.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleActionClick(rec)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-occ-cyan hover:text-navy-950 text-occ-cyan font-mono text-[11px] font-bold border border-occ-cyan/40 transition-all flex items-center gap-1.5 flex-shrink-0 self-start sm:self-auto"
                  >
                    <span>{rec.button_label}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Recovery Summary */}
        <div className="p-3 rounded-xl bg-navy-950/70 border border-occ-border space-y-1 font-mono text-[11px]">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-occ-green" />
            <span>Recovery Summary</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            {briefing.recovery_summary.summary_text}
          </p>
        </div>
      </div>
    </div>
  );
};
