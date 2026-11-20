import React, { useState, useEffect, useMemo } from 'react';
import { useOperational } from '../context/OperationalContext';
import { Search, Plane, Building2, Wrench, Play, RotateCcw, ShieldAlert, ArrowRight, X } from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    simState,
    airports,
    selectFlight,
    selectAirport,
    setWorkspace,
    togglePlay,
    resetScenario,
    isPlaying,
  } = useOperational();

  const [query, setQuery] = useState('');

  // Close palette when opening
  useEffect(() => {
    if (isSearchOpen) {
      setQuery('');
    }
  }, [isSearchOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Show default top suggestions
      return {
        flights: Object.values(simState.flights).slice(0, 4),
        airports: Object.values(airports).slice(0, 4),
        actions: [
          { id: 'toggle-play', label: isPlaying ? 'Pause Simulation' : 'Resume Simulation', icon: Play, action: togglePlay },
          { id: 'ws-radar', label: 'Open Live Flight Radar Workspace', icon: Plane, action: () => setWorkspace('radar') },
          { id: 'ws-recovery', label: 'Open Recovery Desk (Spare Aircraft)', icon: Wrench, action: () => setWorkspace('recovery') },
          { id: 'ws-intel', label: 'Open Network Risk Intelligence', icon: ShieldAlert, action: () => setWorkspace('intelligence') },
          { id: 'reset', label: 'Reset Demo / Scenario to Baseline', icon: RotateCcw, action: resetScenario },
        ],
      };
    }

    const matchedFlights = Object.values(simState.flights)
      .filter(
        (f) =>
          f.flight_id.toLowerCase().includes(q) ||
          f.tail_id.toLowerCase().includes(q) ||
          f.origin.toLowerCase().includes(q) ||
          f.destination.toLowerCase().includes(q)
      )
      .slice(0, 6);

    const matchedAirports = Object.values(airports)
      .filter((a) => a.id.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      .slice(0, 4);

    const actions = [
      { id: 'toggle-play', label: isPlaying ? 'Pause Simulation' : 'Resume Simulation', icon: Play, action: togglePlay },
      { id: 'ws-command', label: 'Switch to Command Center', icon: ArrowRight, action: () => setWorkspace('command') },
      { id: 'ws-radar', label: 'Switch to Live Radar View', icon: ArrowRight, action: () => setWorkspace('radar') },
      { id: 'ws-explorer', label: 'Switch to Flight Explorer', icon: ArrowRight, action: () => setWorkspace('explorer') },
      { id: 'ws-recovery', label: 'Switch to Spare Aircraft Recovery Desk', icon: ArrowRight, action: () => setWorkspace('recovery') },
      { id: 'ws-intel', label: 'Switch to Network Risk Intelligence', icon: ArrowRight, action: () => setWorkspace('intelligence') },
      { id: 'ws-briefing', label: 'Switch to AI Briefing Panel', icon: ArrowRight, action: () => setWorkspace('briefing') },
      { id: 'reset', label: 'Reset Scenario to Normal Baseline', icon: RotateCcw, action: resetScenario },
    ].filter((act) => act.label.toLowerCase().includes(q));

    return {
      flights: matchedFlights,
      airports: matchedAirports,
      actions,
    };
  }, [query, simState.flights, airports, isPlaying, togglePlay, setWorkspace, resetScenario]);

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-navy-900 border border-occ-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-occ-border gap-3 bg-navy-850">
          <Search className="w-5 h-5 text-occ-cyan" />
          <input
            type="text"
            className="flex-1 bg-transparent text-white placeholder-slate-400 text-sm focus:outline-none"
            placeholder="Type a flight ID (DS0202), aircraft tail (VT-DS02), airport (BOM), or command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-navy-750 text-slate-400 border border-slate-700 rounded">
            ESC
          </kbd>
          <button
            onClick={() => setIsSearchOpen(false)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          {/* Flights */}
          {results.flights.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Plane className="w-3.5 h-3.5 text-occ-cyan" /> Flights & Aircraft
              </div>
              <div className="space-y-1 mt-1">
                {results.flights.map((f) => (
                  <button
                    key={f.flight_id}
                    onClick={() => {
                      selectFlight(f.flight_id);
                      setIsSearchOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-navy-750 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-white group-hover:text-occ-cyan">
                        {f.flight_id}
                      </span>
                      <span className="font-mono text-slate-400 text-[11px]">
                        ({f.tail_id})
                      </span>
                      <span className="text-slate-300">
                        {f.origin} &rarr; {f.destination}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-slate-400">{f.dep} - {f.arr}</span>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                          f.status === 'ON_TIME'
                            ? 'bg-occ-green/10 text-occ-green border border-occ-green/30'
                            : f.status === 'RECOVERED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : f.status === 'DELAYED'
                            ? 'bg-occ-amber/10 text-occ-amber border border-occ-amber/30'
                            : 'bg-occ-red/10 text-occ-red border border-occ-red/30'
                        }`}
                      >
                        {f.status} {f.delay_minutes > 0 ? `+${f.delay_minutes}m` : ''}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Airports */}
          {results.airports.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" /> Airports
              </div>
              <div className="space-y-1 mt-1">
                {results.airports.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      selectAirport(a.id);
                      setIsSearchOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-navy-750 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-occ-cyan group-hover:text-white">
                        {a.id}
                      </span>
                      <span className="text-white font-medium">{a.city}</span>
                      <span className="text-slate-400 text-[11px]">{a.name}</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[10px] bg-navy-700 text-slate-300 rounded font-mono uppercase">
                      {a.tier.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Commands & Actions */}
          {results.actions.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                System Commands
              </div>
              <div className="space-y-1 mt-1">
                {results.actions.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.id}
                      onClick={() => {
                        act.action();
                        setIsSearchOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-navy-750 flex items-center gap-3 text-slate-200 hover:text-white transition-colors"
                    >
                      <Icon className="w-4 h-4 text-occ-cyan" />
                      <span>{act.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-occ-border bg-navy-850 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div>Press <kbd className="px-1 py-0.5 bg-navy-750 rounded border border-slate-700">ESC</kbd> to exit</div>
          <div>DOMINO SKY OCC Global Search</div>
        </div>
      </div>
    </div>
  );
};
