import React, { useState, useMemo } from 'react';
import { useOperational } from '../context/OperationalContext';
import { Flight } from '../types';
import {
  ListFilter,
  Search,
  Plane,
  Clock,
  Users,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Filter,
} from 'lucide-react';

export const FlightExplorerView: React.FC = () => {
  const { simState, selectFlight, selectedFlightId } = useOperational();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [airportFilter, setAirportFilter] = useState<string>('ALL');

  // Filter flights
  const filteredFlights = useMemo(() => {
    let list = Object.values(simState.flights);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.flight_id.toLowerCase().includes(q) ||
          f.tail_id.toLowerCase().includes(q) ||
          f.origin.toLowerCase().includes(q) ||
          f.destination.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'ALL') {
      list = list.filter((f) => f.status === statusFilter);
    }

    if (airportFilter !== 'ALL') {
      list = list.filter((f) => f.origin === airportFilter || f.destination === airportFilter);
    }

    // Sort by leg order within tail, or by scheduled departure
    list.sort((a, b) => a.sched_dep_min - b.sched_dep_min);
    return list;
  }, [simState.flights, searchQuery, statusFilter, airportFilter]);

  // Unique airports for filter
  const uniqueAirports = useMemo(() => {
    const set = new Set<string>();
    Object.values(simState.flights).forEach((f) => {
      set.add(f.origin);
      set.add(f.destination);
    });
    return Array.from(set).sort();
  }, [simState.flights]);

  return (
    <div className="h-full flex-1 overflow-y-auto p-4 md:p-6 space-y-5 bg-navy-950 font-sans select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-occ-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-occ-cyan/40">
            <ListFilter className="w-5 h-5 text-occ-cyan" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-white tracking-wide">
              FLIGHT EXPLORER & ROTATION ROSTER
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              All 70 Scheduled Flights &bull; 16 Aircraft Rotations &bull; Dynamic Turnaround Constraints
            </p>
          </div>
        </div>

        {/* Filter Bar Controls */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by flight, tail, airport..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-navy-900 border border-occ-border text-white placeholder-slate-500 text-xs focus:outline-none focus:border-occ-cyan w-56"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-navy-900 border border-occ-border rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none"
          >
            <option value="ALL">All Statuses ({Object.keys(simState.flights).length})</option>
            <option value="ON_TIME">On Time</option>
            <option value="DELAYED">Delayed (15-60m)</option>
            <option value="SEVERELY_DELAYED">Severely Delayed (&gt;60m)</option>
            <option value="RECOVERED">Spare Recovered</option>
          </select>

          {/* Airport Filter */}
          <select
            value={airportFilter}
            onChange={(e) => setAirportFilter(e.target.value)}
            className="bg-navy-900 border border-occ-border rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none"
          >
            <option value="ALL">All Airports</option>
            {uniqueAirports.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Flight Explorer Roster Table */}
      <div className="bg-navy-900 border border-occ-border rounded-2xl overflow-hidden shadow-occ-card font-mono text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-navy-850 text-slate-400 text-[10px] uppercase border-b border-occ-border">
              <tr>
                <th className="py-3 px-4">Flight & Tail</th>
                <th className="py-3 px-4">Leg</th>
                <th className="py-3 px-4">Route</th>
                <th className="py-3 px-4">Scheduled</th>
                <th className="py-3 px-4">Predicted</th>
                <th className="py-3 px-4">Delay & Status</th>
                <th className="py-3 px-4">Pax</th>
                <th className="py-3 px-4">Root Cause / Trigger</th>
                <th className="py-3 px-4 text-right">Detective</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-occ-border/60">
              {filteredFlights.map((f) => {
                const isSelected = selectedFlightId === f.flight_id;
                return (
                  <tr
                    key={f.flight_id}
                    onClick={() => selectFlight(f.flight_id)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected
                        ? 'bg-cyan-950/40 text-white'
                        : 'hover:bg-navy-800/60 text-slate-300'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-white group-hover:text-occ-cyan flex items-center gap-1.5">
                        <span>{f.flight_id}</span>
                        {f.is_spare_recovered && (
                          <span className="text-[9px] px-1 bg-emerald-950 text-occ-green border border-occ-green/30 rounded font-bold">
                            SPARE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{f.tail_id}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-1.5 py-0.5 rounded bg-navy-800 text-slate-300 border border-slate-700 font-bold">
                        L{f.leg_order}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-white">
                        {f.origin} &rarr; {f.destination}
                      </span>
                      <div className="text-[10px] text-slate-500">{f.block_minutes}m block</div>
                    </td>

                    <td className="py-3 px-4 text-slate-300">
                      {f.dep} - {f.arr}
                    </td>

                    <td className="py-3 px-4 font-bold">
                      <span className={f.delay_minutes > 0 ? 'text-occ-amber' : 'text-slate-200'}>
                        {f.pred_dep} - {f.pred_arr}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          f.status === 'ON_TIME'
                            ? 'bg-cyan-950 text-occ-cyan border border-occ-cyan/30'
                            : f.status === 'RECOVERED'
                            ? 'bg-emerald-950 text-occ-green border border-occ-green/30'
                            : f.status === 'DELAYED'
                            ? 'bg-amber-950 text-occ-amber border border-occ-amber/30'
                            : 'bg-red-950 text-occ-red border border-occ-red/40 animate-pulse'
                        }`}
                      >
                        {f.status} {f.delay_minutes > 0 ? `+${f.delay_minutes}m` : ''}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-white font-semibold">
                      {f.pax} <span className="text-[10px] text-slate-500">/ 180</span>
                    </td>

                    <td className="py-3 px-4 max-w-xs truncate text-[11px] text-slate-400">
                      {f.root_cause}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectFlight(f.flight_id);
                        }}
                        className="px-2.5 py-1 rounded bg-navy-800 hover:bg-cyan-950 hover:text-occ-cyan text-slate-300 border border-occ-border transition-colors text-[11px] flex items-center gap-1 ml-auto"
                      >
                        <span>Investigate</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
