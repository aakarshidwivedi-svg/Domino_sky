import React, { useMemo } from 'react';
import { useOperational } from '../context/OperationalContext';
import { RotationGraph } from '../components/detective/RotationGraph';
import {
  Search,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Users,
  Compass,
  Zap,
  RotateCcw,
  Plane,
} from 'lucide-react';

export const DelayDetectiveView: React.FC = () => {
  const {
    simState,
    selectedFlightId,
    selectFlight,
    selectedFlight,
    setWorkspace,
    deploySpare,
    cancelFlight,
    simTimeStr,
  } = useOperational();

  const allFlights = useMemo(() => {
    return Object.values(simState.flights).sort((a, b) => b.delay_minutes - a.delay_minutes);
  }, [simState.flights]);

  const delayedFlights = useMemo(() => {
    return allFlights.filter((f) => f.delay_minutes > 0 || f.status === 'SEVERELY_DELAYED');
  }, [allFlights]);

  const currentFlight = selectedFlight || (delayedFlights.length > 0 ? delayedFlights[0] : allFlights[0]);

  // Rotation sequence for the selected aircraft
  const rotationFlights = useMemo(() => {
    if (!currentFlight) return [];
    return Object.values(simState.flights)
      .filter((f) => f.tail_id === currentFlight.tail_id)
      .sort((a, b) => a.leg_order - b.leg_order);
  }, [simState.flights, currentFlight]);

  // Connected passenger transfers
  const inboundConns = useMemo(() => {
    if (!currentFlight) return [];
    return simState.connections.filter((c) => c.to_flight === currentFlight.flight_id);
  }, [simState.connections, currentFlight]);

  const outboundConns = useMemo(() => {
    if (!currentFlight) return [];
    return simState.connections.filter((c) => c.from_flight === currentFlight.flight_id);
  }, [simState.connections, currentFlight]);

  // Crew assignment
  const crewInfo = useMemo(() => {
    if (!currentFlight) return null;
    return simState.crews.find((cr) => cr.flight_ids.includes(currentFlight.flight_id)) || null;
  }, [simState.crews, currentFlight]);

  const upstreamLegs = rotationFlights.filter((f) => f.leg_order < currentFlight.leg_order);
  const downstreamLegs = rotationFlights.filter((f) => f.leg_order > currentFlight.leg_order);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 tracking-wider">
              FLIGHT DELAY DETECTIVE & ROTATION DAG
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">
              Root-Cause Explainability
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Trace delay inheritance backwards to root disruption and forward through aircraft rotation domino chains.
          </p>
        </div>

        {/* Flight Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Select Flight:</span>
          <select
            value={currentFlight?.flight_id || ''}
            onChange={(e) => selectFlight(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
          >
            <optgroup label="Disrupted Flights">
              {delayedFlights.map((df) => (
                <option key={df.flight_id} value={df.flight_id}>
                  {df.flight_id} ({df.origin}→{df.destination}) +{df.delay_minutes}m [{df.tail_id}]
                </option>
              ))}
            </optgroup>
            <optgroup label="All Scheduled Flights">
              {allFlights.map((af) => (
                <option key={af.flight_id} value={af.flight_id}>
                  {af.flight_id} ({af.origin}→{af.destination}) [{af.tail_id}]
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {currentFlight && (
        <>
          {/* Target Flight Operational Summary Banner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-center justify-center font-mono font-bold text-lg text-cyan-400">
                  {currentFlight.flight_id}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-100">
                      {currentFlight.origin} → {currentFlight.destination}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase ${
                        currentFlight.status === 'SEVERELY_DELAYED'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : currentFlight.status === 'DELAYED'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : currentFlight.status === 'RECOVERED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : currentFlight.status === 'CANCELLED'
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {currentFlight.status} (+{currentFlight.delay_minutes}m)
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">
                    Aircraft: <strong className="text-slate-200">{currentFlight.tail_id}</strong> • Leg {currentFlight.leg_order} of {rotationFlights.length} • {currentFlight.pax} passengers
                  </div>
                </div>
              </div>

              {/* Schedule vs Predicted times */}
              <div className="flex items-center gap-6 text-xs font-mono">
                <div>
                  <div className="text-slate-500 uppercase text-[10px]">Scheduled Block</div>
                  <div className="text-slate-200 font-bold mt-0.5">
                    {currentFlight.dep} — {currentFlight.arr} IST
                  </div>
                </div>
                <div className="border-l border-slate-800 pl-6">
                  <div className="text-slate-500 uppercase text-[10px]">Predicted / Simulated</div>
                  <div className={`font-bold mt-0.5 ${currentFlight.delay_minutes > 15 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {currentFlight.pred_dep} — {currentFlight.pred_arr} IST
                  </div>
                </div>
              </div>
            </div>

            {/* Root Cause Card */}
            <div className="mt-4 pt-2">
              <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" /> Deterministic Root-Cause Explanation:
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-200 leading-relaxed font-mono">
                {currentFlight.root_cause}
              </div>
            </div>
          </div>

          {/* Interactive Rotation Chain Visualization */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-mono text-slate-300 font-semibold uppercase tracking-wider">
                Aircraft Rotation Sequence • Tail {currentFlight.tail_id} ({rotationFlights.length} Legs)
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Click any node to navigate inspection
              </span>
            </div>

            <RotationGraph
              flight={currentFlight}
              onSelectFlightNode={(fid) => selectFlight(fid)}
            />
          </div>

          {/* Upstream Cause vs Downstream Domino Impact Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Upstream Dependency Analysis */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Upstream Rotation Inbound Legs ({upstreamLegs.length})</span>
              </div>

              {upstreamLegs.length === 0 ? (
                <div className="bg-slate-950/50 rounded-lg p-4 text-xs text-slate-400 font-mono">
                  This is Leg 1 (first leg of the day for {currentFlight.tail_id}). Delay is newly originated, not inherited from earlier flights.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upstreamLegs.map((uf) => (
                    <div
                      key={uf.flight_id}
                      onClick={() => selectFlight(uf.flight_id)}
                      className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg p-3 cursor-pointer transition-all flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-slate-200">
                          Leg {uf.leg_order}: {uf.flight_id} ({uf.origin} → {uf.destination})
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          Arr: {uf.pred_arr} IST (Delay: +{uf.arr_delay}m)
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          uf.delay_minutes > 15 ? 'text-amber-400 bg-amber-950/50' : 'text-cyan-400 bg-cyan-950/50'
                        }`}
                      >
                        +{uf.delay_minutes}m
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Turnaround buffer analysis */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs font-mono space-y-1.5">
                <div className="text-slate-400">Scheduled Turnaround Buffer: <strong className="text-slate-200">{currentFlight.turnaround_before_min || 30} mins</strong></div>
                <div className="text-slate-400">Operational Minimum Turnaround: <strong className="text-slate-200">30 mins</strong></div>
                <div className="text-slate-500 text-[11px] pt-1 border-t border-slate-800">
                  {currentFlight.turnaround_before_min && currentFlight.turnaround_before_min <= 35
                    ? '⚠️ TIGHT TURNAROUND: High vulnerability to delay propagation due to limited buffer slack.'
                    : 'Turnaround buffer can absorb modest upstream arrival variances before transferring delay.'}
                </div>
              </div>
            </div>

            {/* Right: Downstream Cascade Analysis */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                <ArrowRight className="w-4 h-4 text-amber-400" />
                <span>Downstream Cascade Legs ({downstreamLegs.length})</span>
              </div>

              {downstreamLegs.length === 0 ? (
                <div className="bg-slate-950/50 rounded-lg p-4 text-xs text-slate-400 font-mono">
                  This is the final leg of the day for {currentFlight.tail_id}. No subsequent legs are threatened.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {downstreamLegs.map((df) => (
                    <div
                      key={df.flight_id}
                      onClick={() => selectFlight(df.flight_id)}
                      className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg p-3 cursor-pointer transition-all flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-slate-200">
                          Leg {df.leg_order}: {df.flight_id} ({df.origin} → {df.destination})
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          Dep: {df.pred_dep} IST (Downstream delay: +{df.dep_delay}m)
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          df.delay_minutes > 15 ? 'text-amber-400 bg-amber-950/50' : 'text-cyan-400 bg-cyan-950/50'
                        }`}
                      >
                        +{df.delay_minutes}m
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Crew exposure status */}
              {crewInfo && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs font-mono space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Assigned Crew: <strong>{crewInfo.crew_id}</strong> ({crewInfo.base} Base)</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${crewInfo.is_exceeded ? 'bg-red-500/20 text-red-400' : crewInfo.is_warning ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {crewInfo.status}
                    </span>
                  </div>
                  <div className="text-slate-400">Simulated Duty: <strong className="text-slate-200">{crewInfo.simulated_duty_minutes}m / {crewInfo.max_duty_mins}m</strong></div>
                  <div className="text-slate-400">Duty Margin: <strong className={crewInfo.margin_remaining < 45 ? 'text-amber-400' : 'text-emerald-400'}>{crewInfo.margin_remaining}m remaining</strong></div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Footer */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              Recovery Action Options for <strong className="text-cyan-400 font-mono">{currentFlight.flight_id}</strong>:
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setWorkspace('recovery');
                }}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Open Recovery Desk</span>
              </button>
              <button
                onClick={() => cancelFlight(currentFlight.flight_id)}
                className="px-4 py-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 font-semibold text-xs transition-all focus-visible:ring-2 focus-visible:ring-red-400"
              >
                Simulate Flight Cancellation
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
