import React, { useState, useMemo } from 'react';
import { useOperational } from '../context/OperationalContext';
import {
  Users,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  Filter,
  Search,
  Building2,
  Clock,
  Compass,
} from 'lucide-react';

export const PassengerImpactView: React.FC = () => {
  const { simState, selectFlight, setWorkspace } = useOperational();
  const [filterMode, setFilterMode] = useState<'ALL' | 'BROKEN' | 'PROTECTED'>('ALL');
  const [selectedHub, setSelectedHub] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const connections = simState.connections;

  const hubs = useMemo(() => {
    const set = new Set(connections.map((c) => c.airport));
    return ['ALL', ...Array.from(set).sort()];
  }, [connections]);

  const filteredConnections = useMemo(() => {
    return connections.filter((c) => {
      if (filterMode === 'BROKEN' && !c.is_broken) return false;
      if (filterMode === 'PROTECTED' && c.is_broken) return false;
      if (selectedHub !== 'ALL' && c.airport !== selectedHub) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.connection_id.toLowerCase().includes(q) ||
          c.from_flight.toLowerCase().includes(q) ||
          c.to_flight.toLowerCase().includes(q) ||
          c.airport.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [connections, filterMode, selectedHub, searchQuery]);

  const totalPaxAtRisk = simState.kpis.passengers_at_risk;
  const brokenCount = connections.filter((c) => c.is_broken).length;
  const protectedCount = connections.filter((c) => c.status === 'PROTECTED').length;
  const onTimeCount = connections.filter((c) => c.status === 'ON_TIME').length;

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Title & Subhead */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 tracking-wider">
              PASSENGER CONNECTION INTELLIGENCE
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">
              Verified Transfer Cohorts
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic evaluation of all 21 connecting itineraries across Indian hubs • Distinguishes broken transfers from protected slack margins.
          </p>
        </div>

        {/* Data Limitation Notice */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 max-w-md text-[11px] text-slate-400">
          <span className="text-amber-400 font-semibold">Operational Data Rule: </span>
          The supplied dataset provides transfer group sizes per flight pair without individual ticketed names. Metrics report transfer passenger groups at risk without duplicate counting.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Total Connection Banks
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{connections.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Across Indian transfer hubs</div>
        </div>

        <div className="bg-slate-900/80 border border-red-900/40 rounded-xl p-4">
          <div className="text-[11px] font-mono text-red-400 uppercase tracking-wider flex items-center justify-between">
            <span>Broken Transfers</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400 mt-1">{brokenCount}</div>
          <div className="text-xs text-red-300/70 mt-0.5">{totalPaxAtRisk} passengers stranded / at risk</div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-900/40 rounded-xl p-4">
          <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span>Protected Margin Slack</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{protectedCount}</div>
          <div className="text-xs text-emerald-300/70 mt-0.5">Buffer absorbed inbound delay</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider flex items-center justify-between">
            <span>On-Time Nominal Banks</span>
            <CheckCircle className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{onTimeCount}</div>
          <div className="text-xs text-slate-500 mt-0.5">Both flights on schedule</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                filterMode === 'ALL'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Banks ({connections.length})
            </button>
            <button
              onClick={() => setFilterMode('BROKEN')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                filterMode === 'BROKEN'
                  ? 'bg-red-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Broken Only ({brokenCount})
            </button>
            <button
              onClick={() => setFilterMode('PROTECTED')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                filterMode === 'PROTECTED'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Protected / On-Time ({protectedCount + onTimeCount})
            </button>
          </div>

          {/* Hub filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 pl-2">
            <Building2 className="w-3.5 h-3.5" />
            <select
              value={selectedHub}
              onChange={(e) => setSelectedHub(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              {hubs.map((h) => (
                <option key={h} value={h}>
                  {h === 'ALL' ? 'All Connecting Hubs' : `${h} Hub`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search flight, bank ID, hub..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Connection Itineraries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredConnections.map((cx) => {
          const fromFlight = simState.flights[cx.from_flight];
          const toFlight = simState.flights[cx.to_flight];

          return (
            <div
              key={cx.connection_id}
              className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
                cx.is_broken
                  ? 'bg-red-950/20 border-red-500/40 hover:border-red-400'
                  : cx.status === 'PROTECTED'
                  ? 'bg-emerald-950/10 border-emerald-500/30 hover:border-emerald-400'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header: ID, Station, Status */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-200 tracking-wider">
                      {cx.connection_id}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-cyan-300 font-semibold">
                      {cx.airport} HUB
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase ${
                      cx.is_broken
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : cx.status === 'PROTECTED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {cx.is_broken ? (
                      <>
                        <AlertTriangle className="w-3 h-3" /> MISSED / BROKEN
                      </>
                    ) : cx.status === 'PROTECTED' ? (
                      <>
                        <ShieldCheck className="w-3 h-3" /> PROTECTED
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3" /> ON TIME
                      </>
                    )}
                  </span>
                </div>

                {/* Transfer Flight Legs */}
                <div className="py-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-mono">Inbound:</span>
                      <button
                        onClick={() => {
                          selectFlight(cx.from_flight);
                          setWorkspace('detective');
                        }}
                        className="font-bold text-cyan-400 hover:underline font-mono"
                      >
                        {cx.from_flight}
                      </button>
                    </div>
                    <div className="text-slate-300 font-mono text-right">
                      {fromFlight ? `${fromFlight.origin} → ${fromFlight.destination} (${fromFlight.pred_arr})` : 'N/A'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-mono">Outbound:</span>
                      <button
                        onClick={() => {
                          selectFlight(cx.to_flight);
                          setWorkspace('detective');
                        }}
                        className="font-bold text-cyan-400 hover:underline font-mono"
                      >
                        {cx.to_flight}
                      </button>
                    </div>
                    <div className="text-slate-300 font-mono text-right">
                      {toFlight ? `${toFlight.origin} → ${toFlight.destination} (${toFlight.pred_dep})` : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Margins & Pax Metrics */}
                <div className="bg-slate-950/60 rounded-lg p-2.5 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Passenger Count:</span>
                    <span className="text-slate-200 font-bold">{cx.passengers} pax</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Available Transfer Time:</span>
                    <span className="text-slate-200">{cx.pred_window_minutes} mins</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Required Min Connect (MCT):</span>
                    <span className="text-slate-200">{cx.min_connect_minutes} mins</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span>Slack Margin:</span>
                    <span
                      className={`font-bold ${
                        cx.margin_minutes < 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {cx.margin_minutes >= 0 ? `+${cx.margin_minutes}m` : `${cx.margin_minutes}m (SHORTFALL)`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Trigger */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-sans truncate max-w-[180px]">
                  {cx.details}
                </span>
                <button
                  onClick={() => {
                    selectFlight(cx.from_flight);
                    setWorkspace('detective');
                  }}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 font-medium transition-colors flex items-center gap-1"
                >
                  <span>Investigate</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredConnections.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
          No passenger connection banks matching the selected filters.
        </div>
      )}
    </div>
  );
};
