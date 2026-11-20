import React, { useMemo } from 'react';
import { useOperational } from '../context/OperationalContext';
import { Clock, AlertTriangle, CheckCircle2, Plane, Wrench, ShieldAlert } from 'lucide-react';
import { minutesToTime } from '../services/deterministicSim';

export const EventFeed: React.FC = () => {
  const { simState, selectFlight, selectAirport } = useOperational();

  const events = useMemo(() => {
    const list: Array<{
      id: string;
      minute: number;
      timeStr: string;
      type: 'CLOSURE' | 'DELAY' | 'RECOVERY' | 'HOLDING' | 'CONNECTION';
      title: string;
      details: string;
      flightId?: string;
      airportId?: string;
    }> = [];

    // 1. Closures
    simState.closures.forEach((c) => {
      list.push({
        id: `close-${c.airport_id}-${c.start_minute}`,
        minute: c.start_minute,
        timeStr: minutesToTime(c.start_minute),
        type: 'CLOSURE',
        title: `AIRPORT CLOSED: ${c.airport_id}`,
        details: `${c.airport_id} closed until ${minutesToTime(c.end_minute)} (${c.reason})`,
        airportId: c.airport_id,
      });
      list.push({
        id: `reopen-${c.airport_id}-${c.end_minute}`,
        minute: c.end_minute,
        timeStr: minutesToTime(c.end_minute),
        type: 'CLOSURE',
        title: `AIRPORT REOPENED: ${c.airport_id}`,
        details: `${c.airport_id} resumed departures & sequenced arrivals`,
        airportId: c.airport_id,
      });
    });

    // 2. Deployments
    simState.deployments.forEach((d) => {
      list.push({
        id: `deploy-${d.spare_tail}-${d.target_flight_id}`,
        minute: 360,
        timeStr: 'OCC ACT',
        type: 'RECOVERY',
        title: `SPARE DEPLOYED: ${d.spare_tail}`,
        details: `Dispatched to recover flight ${d.target_flight_id} & rotation`,
        flightId: d.target_flight_id,
      });
    });

    // 3. Significant delays & holdings
    Object.values(simState.flights)
      .filter((f) => f.delay_minutes > 30)
      .slice(0, 15)
      .forEach((f) => {
        list.push({
          id: `del-${f.flight_id}`,
          minute: f.pred_dep_min,
          timeStr: f.pred_dep,
          type: f.is_holding ? 'HOLDING' : 'DELAY',
          title: f.is_holding ? `HOLDING PATTERN: ${f.flight_id}` : `DELAY CASCADE: ${f.flight_id}`,
          details: `${f.flight_id} (${f.origin}&rarr;${f.destination}) +${f.delay_minutes}m delay. ${f.root_cause}`,
          flightId: f.flight_id,
          airportId: f.origin,
        });
      });

    // 4. Broken Connections
    simState.connections
      .filter((c) => c.is_broken)
      .forEach((c) => {
        list.push({
          id: `cx-${c.connection_id}`,
          minute: 450,
          timeStr: 'MISSED',
          type: 'CONNECTION',
          title: `MISSED TRANSFER: ${c.connection_id}`,
          details: `${c.passengers} pax from ${c.from_flight} missed ${c.to_flight} at ${c.airport}`,
          flightId: c.from_flight,
          airportId: c.airport,
        });
      });

    list.sort((a, b) => b.minute - a.minute);
    return list.slice(0, 25);
  }, [simState]);

  return (
    <div className="bg-navy-900 border border-occ-border rounded-2xl p-4 flex flex-col h-full shadow-occ-card select-none">
      <div className="flex items-center justify-between border-b border-occ-border pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-occ-cyan" />
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Live Operational Event Log
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Chronological Event Stream
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
        {events.map((evt) => (
          <div
            key={evt.id}
            onClick={() => {
              if (evt.flightId) selectFlight(evt.flightId);
              else if (evt.airportId) selectAirport(evt.airportId);
            }}
            className="p-2 rounded-lg bg-navy-950/70 border border-occ-border/80 hover:border-slate-600 hover:bg-navy-850 transition-colors cursor-pointer flex items-start gap-2.5 group"
          >
            <div className="mt-0.5">
              {evt.type === 'CLOSURE' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-occ-red" />
              ) : evt.type === 'RECOVERY' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-occ-green" />
              ) : evt.type === 'HOLDING' ? (
                <ShieldAlert className="w-3.5 h-3.5 text-occ-amber" />
              ) : (
                <Plane className="w-3.5 h-3.5 text-slate-400 group-hover:text-occ-cyan" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-[11px] group-hover:text-occ-cyan truncate">
                  {evt.title}
                </span>
                <span className="text-[10px] text-slate-400 font-bold ml-2 flex-shrink-0">
                  {evt.timeStr}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                {evt.details}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
