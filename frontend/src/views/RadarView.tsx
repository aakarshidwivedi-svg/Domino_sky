import React, { useState } from 'react';
import { useOperational } from '../context/OperationalContext';
import { FlightRadar } from '../components/radar/FlightRadar';
import {
  Radar,
  Plane,
  Building2,
  AlertTriangle,
  Clock,
  Filter,
  X,
  ChevronRight,
} from 'lucide-react';
import { minutesToTime } from '../services/deterministicSim';

export const RadarView: React.FC = () => {
  const {
    simState,
    airports,
    selectFlight,
    selectAirport,
    closeAirport,
    reopenAirport,
    closures,
    simMinute,
  } = useOperational();

  const [sideTrayOpen, setSideTrayOpen] = useState(true);
  const [selectedQuickAirport, setSelectedQuickAirport] = useState('BOM');
  const [closureDurationMins, setClosureDurationMins] = useState(90);

  const airborneFlights = Object.values(simState.flights).filter(
    (f) =>
      f.current_phase === 'AIRBORNE' ||
      f.current_phase === 'HOLDING' ||
      f.current_phase === 'DIVERTED' ||
      f.status === 'DIVERTED'
  );

  const handleQuickClose = () => {
    closeAirport(
      selectedQuickAirport,
      simMinute,
      simMinute + closureDurationMins,
      'Monsoon Runway Closure'
    );
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden relative bg-navy-950 font-sans select-none">
      {/* 100% Full Interactive Map */}
      <div className="flex-1 h-full relative">
        <FlightRadar isFullView={true} />
      </div>

      {/* Collapsible Radar Side Control Tray */}
      <div
        className={`h-full bg-navy-900 border-l border-occ-border flex flex-col transition-all duration-300 z-10 ${
          sideTrayOpen ? 'w-80' : 'w-10'
        }`}
      >
        {/* Tray Toggle Tab */}
        <div className="h-12 border-b border-occ-border flex items-center justify-between px-3 bg-navy-850">
          {sideTrayOpen ? (
            <>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-white">
                <Radar className="w-4 h-4 text-occ-cyan" />
                <span>RADAR OPERATIONS</span>
              </div>
              <button
                onClick={() => setSideTrayOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSideTrayOpen(true)}
              className="w-full flex items-center justify-center p-1 text-slate-400 hover:text-occ-cyan"
              title="Expand Radar Operations Tray"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {sideTrayOpen && (
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs font-mono">
            {/* 1. Quick Disruption Injector */}
            <div className="p-3.5 rounded-xl bg-navy-950 border border-occ-border space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-white text-[11px] uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5 text-occ-amber" />
                <span>Simulate Airport Disruption</span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">CHOOSE AIRPORT:</label>
                <select
                  value={selectedQuickAirport}
                  onChange={(e) => setSelectedQuickAirport(e.target.value)}
                  className="w-full bg-navy-850 border border-occ-border rounded-lg p-2 text-white font-mono text-xs focus:outline-none"
                >
                  {Object.values(airports).map((apt) => (
                    <option key={apt.id} value={apt.id}>
                      {apt.id} &bull; {apt.city} ({apt.tier.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>CLOSURE DURATION:</span>
                  <span className="text-white font-bold">{closureDurationMins}m</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="180"
                  step="15"
                  value={closureDurationMins}
                  onChange={(e) => setClosureDurationMins(Number(e.target.value))}
                  className="w-full accent-occ-cyan cursor-pointer"
                />
              </div>

              {closures.some((c) => c.airport_id === selectedQuickAirport) ? (
                <button
                  onClick={() => reopenAirport(selectedQuickAirport)}
                  className="w-full py-2 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-occ-green font-bold border border-occ-green/40 transition-colors"
                >
                  Lift Closure on {selectedQuickAirport}
                </button>
              ) : (
                <button
                  onClick={handleQuickClose}
                  className="w-full py-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-occ-red font-bold border border-occ-red/40 transition-colors flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Close {selectedQuickAirport} ({closureDurationMins}m)</span>
                </button>
              )}
            </div>

            {/* 2. Active Airport Closures List */}
            {closures.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Active Closure Zones ({closures.length})
                </div>
                {closures.map((c) => (
                  <div
                    key={c.airport_id}
                    className="p-2.5 rounded-lg bg-red-950/20 border border-occ-red/40 text-red-200 space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{c.airport_id} CLOSED</span>
                      <button
                        onClick={() => reopenAirport(c.airport_id)}
                        className="text-[10px] underline text-slate-300 hover:text-white"
                      >
                        Reopen
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {minutesToTime(c.start_minute)} - {minutesToTime(c.end_minute)} IST &bull; {c.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Airborne Flights Stream */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Active Airborne ({airborneFlights.length})</span>
                <span className="text-occ-cyan font-normal">{minutesToTime(simMinute)} IST</span>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {airborneFlights.map((f) => (
                  <div
                    key={f.flight_id}
                    onClick={() => selectFlight(f.flight_id)}
                    className="p-2 rounded-lg bg-navy-950 hover:bg-navy-800 border border-occ-border transition-colors cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-white group-hover:text-occ-cyan">
                        {f.flight_id} &bull; {f.origin}&rarr;{f.destination}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {f.tail_id} &bull; Arr {f.pred_arr}
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          f.status === 'DIVERTED'
                            ? 'bg-purple-950 text-purple-300 border border-purple-500/50'
                            : f.is_holding
                            ? 'bg-red-950 text-occ-red border border-occ-red/40 animate-pulse'
                            : f.delay_minutes > 15
                            ? 'bg-amber-950 text-occ-amber'
                            : 'bg-cyan-950 text-occ-cyan'
                        }`}
                      >
                        {f.status === 'DIVERTED'
                          ? `DIVERTED`
                          : f.is_holding
                          ? 'HOLDING'
                          : f.delay_minutes > 0
                          ? `+${f.delay_minutes}m`
                          : 'ON TIME'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
