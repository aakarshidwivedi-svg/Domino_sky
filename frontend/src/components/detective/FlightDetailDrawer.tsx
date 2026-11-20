import React, { useState } from 'react';
import { useOperational } from '../../context/OperationalContext';
import { RotationGraph } from './RotationGraph';
import {
  X,
  Plane,
  Clock,
  Users,
  ShieldAlert,
  ArrowRight,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
} from 'lucide-react';

export const FlightDetailDrawer: React.FC = () => {
  const {
    selectedFlight,
    clearSelection,
    investigatorOpen,
    setInvestigatorOpen,
    simState,
    selectFlight,
    setWorkspace,
  } = useOperational();

  if (!investigatorOpen || !selectedFlight) return null;

  const f = selectedFlight;

  // Inbound & outbound passenger connections
  const inboundConns = simState.connections.filter((c) => c.to_flight === f.flight_id);
  const outboundConns = simState.connections.filter((c) => c.from_flight === f.flight_id);

  // Crew info
  const crewInfo = simState.crews.find((cr) => cr.flight_ids.includes(f.flight_id));

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-navy-900 border-l border-occ-border shadow-2xl flex flex-col overflow-hidden animate-slideLeft">
      {/* Drawer Top Header */}
      <div className="h-14 px-4 bg-navy-850 border-b border-occ-border flex items-center justify-between select-none">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-occ-cyan/40">
            <Plane className="w-4 h-4 text-occ-cyan" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-base text-white">
                {f.flight_id}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-navy-750 text-slate-300 border border-slate-700">
                {f.tail_id}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                  f.status === 'ON_TIME'
                    ? 'bg-cyan-950 text-occ-cyan border border-occ-cyan/30'
                    : f.status === 'RECOVERED'
                    ? 'bg-emerald-950 text-occ-green border border-occ-green/30'
                    : f.status === 'DELAYED'
                    ? 'bg-amber-950 text-occ-amber border border-occ-amber/30'
                    : 'bg-red-950 text-occ-red border border-occ-red/30'
                }`}
              >
                {f.status} {f.delay_minutes > 0 ? `+${f.delay_minutes}m` : ''}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Leg {f.leg_order} &bull; {f.origin} to {f.destination}
            </div>
          </div>
        </div>

        <button
          onClick={() => setInvestigatorOpen(false)}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-navy-750 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {/* Core Flight Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-xl bg-navy-950/70 border border-occ-border font-mono">
            <div className="text-[10px] text-slate-400">ROUTE</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {f.origin} &rarr; {f.destination}
            </div>
            <div className="text-[10px] text-slate-500">{f.block_minutes}m block</div>
          </div>

          <div className="p-2.5 rounded-xl bg-navy-950/70 border border-occ-border font-mono">
            <div className="text-[10px] text-slate-400">SCHEDULED</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {f.dep} - {f.arr}
            </div>
            <div className="text-[10px] text-slate-500">Plan IST</div>
          </div>

          <div className="p-2.5 rounded-xl bg-navy-950/70 border border-occ-border font-mono">
            <div className="text-[10px] text-slate-400">PREDICTED</div>
            <div
              className={`text-sm font-bold mt-0.5 ${
                f.delay_minutes > 0 ? 'text-occ-amber' : 'text-occ-green'
              }`}
            >
              {f.pred_dep} - {f.pred_arr}
            </div>
            <div className="text-[10px] text-slate-500">
              {f.delay_minutes > 0 ? `+${f.delay_minutes}m delay` : 'On schedule'}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-navy-950/70 border border-occ-border font-mono">
            <div className="text-[10px] text-slate-400">PASSENGERS</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {f.pax} <span className="text-xs text-slate-500">/ 180</span>
            </div>
            <div className="text-[10px] text-slate-500">
              {Math.round((f.pax / 180) * 100)}% Load Factor
            </div>
          </div>
        </div>

        {/* Flight Delay Detective Root Cause Box */}
        <div className="p-3.5 rounded-xl bg-navy-850 border border-occ-border space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-white">
            <ShieldAlert className="w-4 h-4 text-occ-cyan" />
            <span>ROOT CAUSE & DELAY EXPLANATION</span>
          </div>

          <div className="p-2.5 rounded-lg bg-navy-950 text-slate-200 font-mono text-[11px] leading-relaxed border border-slate-800">
            {f.root_cause}
          </div>

          {/* Delay Breakdown Steps */}
          {f.delay_reasons.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Contributing Delay Triggers:
              </div>
              {f.delay_reasons.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-[11px] text-slate-300 font-mono bg-navy-900 px-2 py-1.5 rounded border border-occ-border"
                >
                  <span className="text-occ-amber font-bold">&bull;</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Aircraft Rotation Graph */}
        <div>
          <RotationGraph flight={f} onSelectFlightNode={(id) => selectFlight(id)} />
        </div>

        {/* Passenger Connections Section */}
        <div className="p-3.5 rounded-xl bg-navy-850 border border-occ-border space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white">
              <Users className="w-4 h-4 text-occ-cyan" />
              <span>PASSENGER CONNECTIONS</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {inboundConns.length + outboundConns.length} Total Connections
            </span>
          </div>

          {inboundConns.length === 0 && outboundConns.length === 0 ? (
            <div className="text-[11px] text-slate-400 font-mono py-2 text-center bg-navy-950 rounded-lg">
              No connecting itineraries scheduled for this flight.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Outbound Transfers */}
              {outboundConns.map((c) => (
                <div
                  key={c.connection_id}
                  className={`p-2.5 rounded-lg border font-mono text-[11px] flex flex-col gap-1 ${
                    c.is_broken
                      ? 'bg-red-950/30 border-occ-red/40 text-red-200'
                      : 'bg-navy-950 border-occ-border text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      {c.connection_id} &bull; {c.passengers} Pax connecting to {c.to_flight} at {c.airport}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        c.is_broken
                          ? 'bg-occ-red text-navy-950'
                          : 'bg-emerald-950 text-occ-green border border-occ-green/30'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">{c.details}</div>
                </div>
              ))}

              {/* Inbound Transfers */}
              {inboundConns.map((c) => (
                <div
                  key={c.connection_id}
                  className={`p-2.5 rounded-lg border font-mono text-[11px] flex flex-col gap-1 ${
                    c.is_broken
                      ? 'bg-red-950/30 border-occ-red/40 text-red-200'
                      : 'bg-navy-950 border-occ-border text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">
                      {c.connection_id} &bull; {c.passengers} Pax transfer from {c.from_flight} at {c.airport}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        c.is_broken
                          ? 'bg-occ-red text-navy-950'
                          : 'bg-emerald-950 text-occ-green border border-occ-green/30'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">{c.details}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assigned Crew Duty Exposure */}
        {crewInfo && (
          <div className="p-3.5 rounded-xl bg-navy-850 border border-occ-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-occ-cyan" />
                <span>CREW DUTY &bull; {crewInfo.crew_id} ({crewInfo.base} Base)</span>
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  crewInfo.is_exceeded
                    ? 'bg-red-950 text-occ-red border border-occ-red/30'
                    : crewInfo.is_warning
                    ? 'bg-amber-950 text-occ-amber border border-occ-amber/30'
                    : 'bg-cyan-950 text-occ-cyan border border-occ-cyan/30'
                }`}
              >
                {crewInfo.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-[11px] bg-navy-950 p-2 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-400 text-[10px]">DUTY START</span>
                <div className="text-white font-bold">{crewInfo.duty_start}</div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">SIMULATED DUTY</span>
                <div className="text-white font-bold">
                  {crewInfo.simulated_duty_minutes}m / {crewInfo.max_duty_mins}m
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">MARGIN</span>
                <div
                  className={`font-bold ${
                    crewInfo.margin_remaining < 0
                      ? 'text-occ-red'
                      : crewInfo.margin_remaining < 45
                      ? 'text-occ-amber'
                      : 'text-occ-green'
                  }`}
                >
                  {crewInfo.margin_remaining}m
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Spare Aircraft Recovery CTA */}
        {f.delay_minutes > 15 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 to-navy-850 border border-occ-cyan/40 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-occ-cyan" />
                <span>SPARE AIRCRAFT RECOVERY AVAILABLE</span>
              </div>
              <div className="text-[11px] text-slate-300 font-mono mt-0.5">
                Test deploying VT-DS17 (BLR) or VT-DS18 (DEL) to eliminate delay cascade.
              </div>
            </div>

            <button
              onClick={() => {
                setInvestigatorOpen(false);
                setWorkspace('recovery');
              }}
              className="px-3.5 py-2 rounded-lg bg-occ-cyan hover:bg-cyan-400 text-navy-950 font-mono text-xs font-extrabold flex items-center gap-1.5 shadow-cyan-sm transition-all"
            >
              <span>Recovery Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
