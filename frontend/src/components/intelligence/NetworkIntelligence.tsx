import React, { useState } from 'react';
import { useOperational } from '../../context/OperationalContext';
import {
  ShieldAlert,
  Building2,
  Plane,
  Clock,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  BarChart2,
} from 'lucide-react';

export const NetworkIntelligence: React.FC = () => {
  const {
    simState,
    selectAirport,
    selectFlight,
    setWorkspace,
    closures,
  } = useOperational();

  const [activeTab, setActiveTab] = useState<'airports' | 'rotations' | 'tight_turns' | 'connections'>('airports');

  const airportRisks = simState.airport_risks;
  const rotationRisks = simState.rotation_risks;
  const connections = simState.connections;
  const flights = simState.flights;

  // Filter tight turnaround flights (<= 35m)
  const tightTurnFlights = Object.values(flights)
    .filter((f) => (f.turnaround_before_min || 0) > 0 && (f.turnaround_before_min || 0) <= 35)
    .sort((a, b) => (a.turnaround_before_min || 0) - (b.turnaround_before_min || 0));

  return (
    <div className="h-full flex-1 overflow-y-auto p-4 md:p-6 space-y-6 select-none bg-navy-950 font-sans">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-occ-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-occ-cyan/40">
            <ShieldAlert className="w-5 h-5 text-occ-cyan" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-white tracking-wide">
              NETWORK RISK INTELLIGENCE
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Deterministic Vulnerability Scoring &bull; Cascade Propagation Exposure &bull; Connection Bottlenecks
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-navy-900 border border-occ-border rounded-xl p-1 text-xs font-mono">
          <button
            onClick={() => setActiveTab('airports')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'airports'
                ? 'bg-cyan-950 text-occ-cyan font-bold border border-occ-cyan/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Airports ({airportRisks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rotations')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'rotations'
                ? 'bg-cyan-950 text-occ-cyan font-bold border border-occ-cyan/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plane className="w-3.5 h-3.5" />
            <span>Rotations ({rotationRisks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tight_turns')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'tight_turns'
                ? 'bg-cyan-950 text-occ-cyan font-bold border border-occ-cyan/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Tight Turnarounds ({tightTurnFlights.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('connections')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'connections'
                ? 'bg-cyan-950 text-occ-cyan font-bold border border-occ-cyan/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Connections ({connections.length})</span>
          </button>
        </div>
      </div>

      {/* Methodology Callout */}
      <div className="p-3.5 rounded-xl bg-navy-900 border border-occ-border text-xs font-mono flex items-center justify-between">
        <div className="text-slate-300">
          <strong className="text-white">Deterministic Scoring Engine:</strong> Scores are transparently derived from verified simulation variables: active closures (45 pts), delay volume (up to 25 pts), turnaround buffer pressure (15 pts), and broken connection exposure (15 pts).
        </div>
        <div className="text-slate-400 text-[10px] hidden lg:block">
          Scale: 0 (Nominal) - 100 (Critical)
        </div>
      </div>

      {/* TAB 1: Airport Risk Rankings */}
      {activeTab === 'airports' && (
        <div className="bg-navy-900 border border-occ-border rounded-2xl overflow-hidden shadow-occ-card">
          <div className="p-4 border-b border-occ-border flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Airport Operational Risk Hierarchy
            </span>
            <span className="text-xs font-mono text-slate-400">
              Ranked by Aggregate Exposure Index
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-navy-850 text-slate-400 text-[10px] uppercase border-b border-occ-border">
                <tr>
                  <th className="py-3 px-4">Airport</th>
                  <th className="py-3 px-4">Tier & Capacity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Delay Volume</th>
                  <th className="py-3 px-4">Tight Turns</th>
                  <th className="py-3 px-4">Risk Score</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-occ-border/60">
                {airportRisks.map((apt) => (
                  <tr
                    key={apt.airport_id}
                    className="hover:bg-navy-800/60 transition-colors group cursor-pointer"
                    onClick={() => selectAirport(apt.airport_id)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white group-hover:text-occ-cyan text-sm">
                          {apt.airport_id}
                        </span>
                        <span className="text-slate-300">{apt.city}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">{apt.name}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-slate-300 capitalize">{(apt.tier || 'hub').replace('_', ' ')}</span>
                      <div className="text-[10px] text-slate-500">
                        {apt.capacity_per_hour} mvts/hr cap
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {apt.is_closed ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-red-950 text-occ-red font-bold border border-occ-red/40 animate-pulse">
                          RUNWAY CLOSED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-occ-green font-bold border border-occ-green/30">
                          NORMAL OPEN
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-white font-semibold">
                        {apt.delayed_departures + apt.delayed_arrivals} delayed
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {apt.delayed_departures} dep &bull; {apt.delayed_arrivals} arr
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={apt.tight_turnarounds > 0 ? 'text-occ-amber font-bold' : 'text-slate-400'}>
                        {apt.tight_turnarounds} flights
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-20 bg-navy-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              apt.risk_tier === 'CRITICAL'
                                ? 'bg-occ-red'
                                : apt.risk_tier === 'HIGH'
                                ? 'bg-occ-amber'
                                : apt.risk_tier === 'MODERATE'
                                ? 'bg-sky-400'
                                : 'bg-occ-green'
                            }`}
                            style={{ width: `${apt.risk_score}%` }}
                          />
                        </div>
                        <span className="font-bold text-white">{apt.risk_score}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            apt.risk_tier === 'CRITICAL'
                              ? 'bg-red-950 text-occ-red'
                              : apt.risk_tier === 'HIGH'
                              ? 'bg-amber-950 text-occ-amber'
                              : 'bg-navy-800 text-slate-400'
                          }`}
                        >
                          {apt.risk_tier}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAirport(apt.airport_id);
                          setWorkspace('radar');
                        }}
                        className="px-2.5 py-1 rounded bg-navy-800 hover:bg-cyan-950 hover:text-occ-cyan text-slate-300 border border-occ-border transition-colors text-[11px]"
                      >
                        Inspect Radar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Aircraft Rotation Vulnerabilities */}
      {activeTab === 'rotations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rotationRisks.map((rot) => (
            <div
              key={rot.tail_id}
              className="p-4 rounded-2xl bg-navy-900 border border-occ-border hover:border-slate-600 transition-all space-y-3 font-mono text-xs shadow-occ-card"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-navy-800 border border-occ-border">
                    <Plane className="w-4 h-4 text-occ-cyan" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{rot.tail_id}</div>
                    <div className="text-[10px] text-slate-400">{rot.total_legs} Scheduled Legs</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-base font-extrabold text-white">{rot.risk_score}</div>
                  <div className="text-[9px] text-slate-500 uppercase">RISK INDEX</div>
                </div>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-2 gap-2 bg-navy-950 p-2.5 rounded-xl border border-occ-border text-[11px]">
                <div>
                  <span className="text-slate-400 text-[10px]">MAX DELAY</span>
                  <div className={rot.max_delay_minutes > 0 ? 'text-occ-amber font-bold' : 'text-slate-300'}>
                    +{rot.max_delay_minutes}m
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px]">CREW STATUS</span>
                  <div
                    className={`font-bold ${
                      rot.crew_status === 'EXCEEDED'
                        ? 'text-occ-red'
                        : rot.crew_status === 'WARNING'
                        ? 'text-occ-amber'
                        : 'text-occ-green'
                    }`}
                  >
                    {rot.crew_status}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-occ-border">
                <span className="text-[11px] text-slate-400">Final: {rot.final_destination} ({rot.final_arrival})</span>
                <button
                  onClick={() => {
                    const firstFlight = Object.values(flights).find((f) => f.tail_id === rot.tail_id);
                    if (firstFlight) selectFlight(firstFlight.flight_id);
                  }}
                  className="px-2.5 py-1 rounded bg-navy-800 hover:bg-navy-750 text-occ-cyan font-semibold text-[11px] border border-occ-border transition-colors flex items-center gap-1"
                >
                  <span>View Chain</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: Tight Turnarounds Matrix */}
      {activeTab === 'tight_turns' && (
        <div className="bg-navy-900 border border-occ-border rounded-2xl overflow-hidden shadow-occ-card font-mono text-xs">
          <div className="p-4 border-b border-occ-border flex items-center justify-between">
            <span className="font-bold text-white uppercase tracking-wider">
              High-Risk Tight Turnaround Flights (&le; 35m Buffer)
            </span>
            <span className="text-slate-400 text-[11px]">
              Minimum Required Turnaround: 30 minutes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-navy-850 text-slate-400 text-[10px] uppercase border-b border-occ-border">
                <tr>
                  <th className="py-3 px-4">Flight</th>
                  <th className="py-3 px-4">Tail</th>
                  <th className="py-3 px-4">Airport</th>
                  <th className="py-3 px-4">Turnaround Buffer</th>
                  <th className="py-3 px-4">Scheduled Dep</th>
                  <th className="py-3 px-4">Current Delay</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-occ-border/60">
                {tightTurnFlights.map((f) => {
                  const slack = (f.turnaround_before_min || 30) - 30;
                  return (
                    <tr key={f.flight_id} className="hover:bg-navy-800/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{f.flight_id}</td>
                      <td className="py-3 px-4 text-slate-300">{f.tail_id}</td>
                      <td className="py-3 px-4 text-occ-cyan font-bold">{f.origin}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-occ-amber">{f.turnaround_before_min}m</span>
                        <span className="text-slate-500 text-[10px] ml-1.5">(Slack: +{slack}m)</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{f.dep}</td>
                      <td className="py-3 px-4">
                        <span className={f.delay_minutes > 0 ? 'text-occ-amber font-bold' : 'text-occ-green'}>
                          +{f.delay_minutes}m
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => selectFlight(f.flight_id)}
                          className="px-2.5 py-1 rounded bg-navy-800 hover:bg-cyan-950 hover:text-occ-cyan text-slate-300 border border-occ-border transition-colors text-[11px]"
                        >
                          Detective
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Connections */}
      {activeTab === 'connections' && (
        <div className="bg-navy-900 border border-occ-border rounded-2xl overflow-hidden shadow-occ-card font-mono text-xs">
          <div className="p-4 border-b border-occ-border flex items-center justify-between">
            <span className="font-bold text-white uppercase tracking-wider">
              Passenger Connection Banks & Missed Transfer Exposure
            </span>
            <span className="text-slate-400 text-[11px]">
              {connections.filter((c) => c.is_broken).length} Broken of {connections.length} Total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-navy-850 text-slate-400 text-[10px] uppercase border-b border-occ-border">
                <tr>
                  <th className="py-3 px-4">Connection</th>
                  <th className="py-3 px-4">Hub Airport</th>
                  <th className="py-3 px-4">Itinerary</th>
                  <th className="py-3 px-4">Passengers</th>
                  <th className="py-3 px-4">Available Window</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-occ-border/60">
                {connections.map((c) => (
                  <tr key={c.connection_id} className="hover:bg-navy-800/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">{c.connection_id}</td>
                    <td className="py-3 px-4 text-occ-cyan font-bold">{c.airport}</td>
                    <td className="py-3 px-4 text-slate-300">
                      {c.from_flight} &rarr; {c.to_flight}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">{c.passengers} pax</td>
                    <td className="py-3 px-4">
                      <span className={c.is_broken ? 'text-occ-red font-bold' : 'text-slate-300'}>
                        {c.pred_window_minutes}m (Req: {c.min_connect_minutes}m)
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.is_broken
                            ? 'bg-red-950 text-occ-red border border-occ-red/40'
                            : c.status === 'PROTECTED'
                            ? 'bg-emerald-950 text-occ-green border border-occ-green/30'
                            : 'bg-navy-800 text-slate-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => selectFlight(c.from_flight)}
                        className="px-2.5 py-1 rounded bg-navy-800 hover:bg-cyan-950 hover:text-occ-cyan text-slate-300 border border-occ-border transition-colors text-[11px]"
                      >
                        Inspect Inbound
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
