import React, { useState, useMemo } from 'react';
import { useOperational } from '../../context/OperationalContext';
import { SpareAircraftCard } from './SpareAircraftCard';
import { SpareDeployment, Flight } from '../../types';
import {
  Wrench,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  TrendingDown,
  Info,
  Layers,
  Plane,
  XCircle,
  BarChart3,
  Check,
} from 'lucide-react';
import { timeToMinutes, minutesToTime } from '../../services/deterministicSim';

export const RecoveryDesk: React.FC = () => {
  const {
    simState,
    deployments,
    deploySpare,
    undoDeployment,
    cancelledFlights,
    cancelFlight,
    uncancelFlight,
    resetScenario,
    scenarioComparison,
    selectFlight,
    setWorkspace,
  } = useOperational();

  const [selectedSpareTail, setSelectedSpareTail] = useState<string>('VT-DS18');
  const [targetFlightId, setTargetFlightId] = useState<string>('');
  const [repositionMinutes, setRepositionMinutes] = useState<number>(60);
  const [replaceFullRotation, setReplaceFullRotation] = useState<boolean>(true);
  const [recoveryMode, setRecoveryMode] = useState<'SPARE' | 'CANCEL'>('SPARE');

  // Filter delayed flights that could benefit from spare recovery
  const delayedFlights = useMemo(() => {
    return Object.values(simState.flights)
      .filter((f) => f.delay_minutes > 10 && !f.is_spare_recovered && !f.is_cancelled)
      .sort((a, b) => b.delay_minutes - a.delay_minutes);
  }, [simState.flights]);

  // Default target flight
  const effectiveTargetId = targetFlightId || (delayedFlights[0]?.flight_id ?? 'DS1502');
  const targetFlight: Flight | undefined = simState.flights[effectiveTargetId];

  // Selected spare details
  const spareObj = simState.spare_aircraft.find((s) => s.tail_id === selectedSpareTail);
  const spareBase = spareObj?.base || 'DEL';
  const isSameBase = targetFlight ? spareBase === targetFlight.origin : false;

  // Feasibility Check
  const feasibility = useMemo(() => {
    if (!targetFlight || !spareObj) {
      return { feasible: false, reason: 'Please select a target delayed flight.' };
    }

    if (spareObj.is_deployed) {
      return { feasible: false, reason: `Spare ${selectedSpareTail} is already deployed.` };
    }

    if (targetFlight.pax > 180) {
      return { feasible: false, reason: `Passenger count (${targetFlight.pax}) exceeds 180 seats.` };
    }

    const spareAvailMin = timeToMinutes(spareObj.available_from);
    let readyMin = spareAvailMin;

    if (!isSameBase) {
      if (repositionMinutes <= 0) {
        return {
          feasible: false,
          requiresRepo: true,
          reason: `Spare is based at ${spareBase}, but flight departs ${targetFlight.origin}. Ferry positioning assumption required.`,
        };
      }
      readyMin += repositionMinutes;
    }

    const schedDepMin = targetFlight.sched_dep_min;
    const predDepMin = Math.max(schedDepMin, readyMin);
    const savedDelay = Math.max(0, targetFlight.delay_minutes - (predDepMin - schedDepMin));

    return {
      feasible: true,
      readyMin,
      readyTimeStr: minutesToTime(readyMin),
      predDepMin,
      predDepStr: minutesToTime(predDepMin),
      savedDelay,
      isAssumption: !isSameBase,
    };
  }, [targetFlight, spareObj, selectedSpareTail, isSameBase, repositionMinutes, spareBase]);

  const handleConfirmDeploy = () => {
    if (!feasibility.feasible || !targetFlight) return;

    const newDep: SpareDeployment = {
      spare_tail: selectedSpareTail,
      target_flight_id: targetFlight.flight_id,
      replace_remaining_rotation: replaceFullRotation,
      assumed_reposition_minutes: isSameBase ? 0 : repositionMinutes,
      notes: isSameBase
        ? `Stationed at ${spareBase}. Zero-delay base departure.`
        : `Repositioning from ${spareBase} with assumed ${repositionMinutes}m ferry buffer.`,
    };

    deploySpare(newDep);
  };

  const handleConfirmCancel = () => {
    if (!targetFlight) return;
    cancelFlight(targetFlight.flight_id);
  };

  const kpis = simState.kpis;

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 tracking-wider">
              SPARE AIRCRAFT RECOVERY DESK
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">
              Tactical Disruption Solver
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deploy physical standby spares or evaluate tactical cancellations with 3-way scenario impact modeling.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {deployments.length > 0 && (
            <button
              onClick={() => undoDeployment()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo Last Action</span>
            </button>
          )}

          <button
            onClick={resetScenario}
            className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-mono font-medium transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Scenarios</span>
          </button>
        </div>
      </div>

      {/* Constraints Notice Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-200 tracking-wide uppercase font-mono text-[11px]">
            Operational Data Specification • Standby Positioning Constraints
          </div>
          <p className="text-slate-400 leading-relaxed">
            The dataset specifies spare aircraft bases (<strong>VT-DS17 at BLR</strong>, <strong>VT-DS18 at DEL</strong>) available from <strong>05:00 IST</strong>. Immediate zero-delay deployment is permitted only when departure origin matches the spare base. Repositioning flights require an explicit, configurable ferry time assumption.
          </p>
        </div>
      </div>

      {/* Standby Fleet Status */}
      <div className="space-y-3">
        <div className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Available Standby Aircraft (2 in Fleet)</span>
          <span className="text-cyan-400 font-semibold">{kpis.available_spares} Available</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {simState.spare_aircraft.map((spare) => (
            <SpareAircraftCard
              key={spare.tail_id}
              spare={spare}
              isSelected={selectedSpareTail === spare.tail_id}
              onSelect={() => setSelectedSpareTail(spare.tail_id)}
            />
          ))}
        </div>
      </div>

      {/* Recovery Strategy Configurator */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-mono font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Wrench className="w-4 h-4 text-cyan-400" />
              <span>Configure Recovery Intervention</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select recovery strategy: Spare Aircraft Takeover or Tactical Cancellation
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setRecoveryMode('SPARE')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                recoveryMode === 'SPARE'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Spare Aircraft Takeover
            </button>
            <button
              onClick={() => setRecoveryMode('CANCEL')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                recoveryMode === 'CANCEL'
                  ? 'bg-red-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tactical Cancellation
            </button>
          </div>
        </div>

        {/* Step 1: Select Target Delayed Flight */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-300 font-semibold uppercase flex items-center justify-between">
            <span>1. Choose Candidate Flight to Recover:</span>
            <span className="text-slate-500 font-normal">
              {delayedFlights.length} candidate flights currently delayed
            </span>
          </label>

          {delayedFlights.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 font-mono">
              ✅ All scheduled flights are currently operating on time. No recovery intervention needed.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {delayedFlights.map((df) => {
                const isSelected = effectiveTargetId === df.flight_id;
                return (
                  <button
                    key={df.flight_id}
                    onClick={() => {
                      setTargetFlightId(df.flight_id);
                      selectFlight(df.flight_id);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-950/80 border-cyan-500 text-slate-100 shadow-lg shadow-cyan-950/50'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-cyan-400">
                        {df.flight_id}
                      </span>
                      <span className="font-mono text-[10px] text-amber-400 font-semibold">
                        +{df.delay_minutes}m delay
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {df.origin} &rarr; {df.destination} ({df.pred_dep}) • {df.tail_id}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {targetFlight && recoveryMode === 'SPARE' && (
          <div className="space-y-4 pt-2 border-t border-slate-800">
            {/* Step 2: Choose spare */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-300 font-semibold uppercase">
                2. Choose Spare Aircraft:
              </label>
              <div className="flex gap-3">
                {simState.spare_aircraft.map((s) => (
                  <button
                    key={s.tail_id}
                    disabled={s.is_deployed}
                    onClick={() => setSelectedSpareTail(s.tail_id)}
                    className={`px-4 py-2 rounded-lg border font-mono text-xs transition-all flex items-center gap-2 ${
                      selectedSpareTail === s.tail_id
                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                        : s.is_deployed
                        ? 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-cyan-500'
                    }`}
                  >
                    <span>{s.tail_id} ({s.base})</span>
                    {s.is_deployed && <span className="text-[10px] text-red-400 font-normal">[Deployed]</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Ferry Repositioning Assumption Slider (if bases differ) */}
            {!isSameBase && (
              <div className="space-y-2 bg-slate-950/80 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold">
                    3. Ferry Repositioning Assumption:
                  </span>
                  <span className="text-cyan-400 font-bold">{repositionMinutes}m ferry flight</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="180"
                  step="15"
                  value={repositionMinutes}
                  onChange={(e) => setRepositionMinutes(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="text-[11px] text-slate-500">
                  Spare {selectedSpareTail} stationed at {spareBase}; flight departs {targetFlight.origin}. Requires explicit repositioning flight time assumption.
                </div>
              </div>
            )}

            {/* Checkbox: downstream rotation replacement */}
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={replaceFullRotation}
                onChange={(e) => setReplaceFullRotation(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950 bg-slate-900"
              />
              <span>
                Replace complete downstream rotation on this aircraft (recommended to halt domino delay cascade)
              </span>
            </label>

            {/* Feasibility Verdict Box */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                feasibility.feasible
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/20 border-red-500/40 text-red-300'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {feasibility.feasible ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="font-bold text-sm tracking-wide font-mono">
                    {feasibility.feasible ? 'DEPLOYMENT FEASIBLE' : 'DEPLOYMENT NOT FEASIBLE'}
                  </span>
                  {feasibility.isAssumption && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-500/40 font-bold">
                      ASSUMPTION-BASED FERRY
                    </span>
                  )}
                </div>

                <div className="text-slate-300 mt-1 text-xs leading-relaxed">
                  {feasibility.feasible ? (
                    <span>
                      Deploying <strong>{selectedSpareTail}</strong> on Flight{' '}
                      <strong>{targetFlight.flight_id}</strong> ({targetFlight.origin}&rarr;
                      {targetFlight.destination}). Achieves departure at{' '}
                      <strong>{feasibility.predDepStr} IST</strong>, saving approximately{' '}
                      <strong className="text-emerald-400">+{feasibility.savedDelay} minutes</strong> of delay.
                    </span>
                  ) : (
                    <span className="text-red-400">{feasibility.reason}</span>
                  )}
                </div>
              </div>

              {feasibility.feasible && (
                <button
                  onClick={handleConfirmDeploy}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Deployment</span>
                </button>
              )}
            </div>
          </div>
        )}

        {targetFlight && recoveryMode === 'CANCEL' && (
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs font-mono uppercase">
                <XCircle className="w-4 h-4 text-red-400" />
                <span>Simulate Flight Cancellation for {targetFlight.flight_id}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Cancelling flight <strong>{targetFlight.flight_id}</strong> ({targetFlight.origin}&rarr;{targetFlight.destination}) stops delay accumulation on this leg. However, <strong>{targetFlight.pax} passengers</strong> will be stranded, and the aircraft remains at <strong>{targetFlight.origin}</strong>. Downstream rotations dependent on arrival at {targetFlight.destination} will require further intervention.
              </p>
            </div>

            <button
              onClick={handleConfirmCancel}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <XCircle className="w-4 h-4" />
              <span>Confirm Flight Cancellation ({targetFlight.flight_id})</span>
            </button>
          </div>
        )}
      </div>

      {/* Currently Cancelled Flights Table (if any) */}
      {cancelledFlights.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span>Active Flight Cancellations ({cancelledFlights.length})</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {cancelledFlights.map((cfId) => (
              <div
                key={cfId}
                className="bg-slate-950 border border-red-900/40 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <span className="font-bold text-red-400">{cfId}</span>
                  <span className="text-slate-500 ml-2">CANCELLED</span>
                </div>
                <button
                  onClick={() => uncancelFlight(cfId)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-sans"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3-Way Scenario Comparison Table */}
      {scenarioComparison && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="text-sm font-mono font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>3-WAY SCENARIO COMPARISON (MEASURABLE IMPACT)</span>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-semibold">
              Delta: {scenarioComparison.delta.delay_minutes_saved}m delay saved
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Metric</th>
                  <th className="py-2.5 px-3 text-slate-300">1. Baseline Nominal</th>
                  <th className="py-2.5 px-3 text-red-400">2. Disrupted (Pre-Recovery)</th>
                  <th className="py-2.5 px-3 text-emerald-400">3. Recovered (Current)</th>
                  <th className="py-2.5 px-3 text-cyan-400 font-bold">Net Operational Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-200">On-Time Performance Rate</td>
                  <td className="py-2.5 px-3">100% (70/70)</td>
                  <td className="py-2.5 px-3 text-red-400">
                    {Math.round((scenarioComparison.disrupted.on_time_flights / 70) * 100)}% ({scenarioComparison.disrupted.on_time_flights}/70)
                  </td>
                  <td className="py-2.5 px-3 text-emerald-400">
                    {Math.round((scenarioComparison.recovered.on_time_flights / 70) * 100)}% ({scenarioComparison.recovered.on_time_flights}/70)
                  </td>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">
                    +{Math.round((scenarioComparison.recovered.on_time_flights / 70) * 100) - Math.round((scenarioComparison.disrupted.on_time_flights / 70) * 100)}% OTP
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Delayed Flights</td>
                  <td className="py-2.5 px-3">0</td>
                  <td className="py-2.5 px-3 text-red-400">{scenarioComparison.disrupted.delayed_flights}</td>
                  <td className="py-2.5 px-3 text-emerald-400">{scenarioComparison.recovered.delayed_flights}</td>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">
                    -{scenarioComparison.disrupted.delayed_flights - scenarioComparison.recovered.delayed_flights} flights
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Total Propagated Delay</td>
                  <td className="py-2.5 px-3">0 mins</td>
                  <td className="py-2.5 px-3 text-red-400">{scenarioComparison.disrupted.total_delay_minutes} mins</td>
                  <td className="py-2.5 px-3 text-emerald-400">{scenarioComparison.recovered.total_delay_minutes} mins</td>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">
                    -{scenarioComparison.delta.delay_minutes_saved} mins saved
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Broken Passenger Connections</td>
                  <td className="py-2.5 px-3">0</td>
                  <td className="py-2.5 px-3 text-red-400">{scenarioComparison.disrupted.broken_connections}</td>
                  <td className="py-2.5 px-3 text-emerald-400">{scenarioComparison.recovered.broken_connections}</td>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">
                    -{scenarioComparison.delta.connections_saved} broken banks
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Connecting Pax at Risk</td>
                  <td className="py-2.5 px-3">0 pax</td>
                  <td className="py-2.5 px-3 text-red-400">{scenarioComparison.disrupted.passengers_at_risk} pax</td>
                  <td className="py-2.5 px-3 text-emerald-400">{scenarioComparison.recovered.passengers_at_risk} pax</td>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">
                    -{scenarioComparison.delta.passengers_saved} pax protected
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-slate-200">Crew Duty Violations</td>
                  <td className="py-2.5 px-3">0</td>
                  <td className="py-2.5 px-3 text-red-400">{scenarioComparison.disrupted.crew_violations}</td>
                  <td className="py-2.5 px-3 text-emerald-400">{scenarioComparison.recovered.crew_violations}</td>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">
                    {scenarioComparison.delta.crew_violations_avoided > 0
                      ? `-${scenarioComparison.delta.crew_violations_avoided} avoided`
                      : '0 violations'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
