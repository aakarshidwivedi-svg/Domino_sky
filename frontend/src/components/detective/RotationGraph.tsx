import React from 'react';
import { useOperational } from '../../context/OperationalContext';
import { Flight } from '../../types';
import { Plane, ArrowRight, Clock, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface RotationGraphProps {
  flight: Flight;
  onSelectFlightNode?: (flightId: string) => void;
}

export const RotationGraph: React.FC<RotationGraphProps> = ({ flight, onSelectFlightNode }) => {
  const { simState, selectFlight } = useOperational();

  // Find all flights on this aircraft rotation ordered by leg_order
  const rotationFlights = Object.values(simState.flights)
    .filter((f) => f.tail_id === flight.tail_id)
    .sort((a, b) => a.leg_order - b.leg_order);

  const handleNodeClick = (fid: string) => {
    if (onSelectFlightNode) onSelectFlightNode(fid);
    else selectFlight(fid);
  };

  return (
    <div className="w-full bg-navy-950/80 border border-occ-border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-occ-border pb-2.5">
        <div>
          <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
            <Plane className="w-4 h-4 text-occ-cyan" />
            <span>AIRCRAFT ROTATION CHAIN &bull; {flight.tail_id}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {rotationFlights.length} Scheduled Legs &bull; Min Turnaround: 30m
          </div>
        </div>

        <div className="text-right text-[11px] font-mono">
          <span className="text-slate-400">Max Rotation Delay: </span>
          <span className="text-occ-amber font-bold">
            {Math.max(...rotationFlights.map((f) => f.delay_minutes))}m
          </span>
        </div>
      </div>

      {/* Horizontal / Wrapped Interactive Nodes Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {rotationFlights.map((f, idx) => {
          const isCurrentSelected = f.flight_id === flight.flight_id;
          const isUpstream = f.leg_order < flight.leg_order;
          const isDownstream = f.leg_order > flight.leg_order;

          let statusBadge = (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950 text-occ-cyan border border-occ-cyan/30">
              ON TIME
            </span>
          );
          if (f.status === 'RECOVERED') {
            statusBadge = (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-occ-green border border-occ-green/30">
                RECOVERED
              </span>
            );
          } else if (f.status === 'SEVERELY_DELAYED') {
            statusBadge = (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-950 text-occ-red border border-occ-red/30">
                +{f.delay_minutes}m SEVERE
              </span>
            );
          } else if (f.status === 'DELAYED') {
            statusBadge = (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950 text-occ-amber border border-occ-amber/30">
                +{f.delay_minutes}m DELAY
              </span>
            );
          }

          return (
            <div
              key={f.flight_id}
              onClick={() => handleNodeClick(f.flight_id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isCurrentSelected
                  ? 'bg-navy-850 border-occ-cyan shadow-cyan-sm ring-1 ring-occ-cyan'
                  : 'bg-navy-900/90 border-occ-border hover:border-slate-600 hover:bg-navy-850'
              }`}
            >
              <div>
                {/* Leg Badge & Status */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    LEG {f.leg_order}
                  </span>
                  {statusBadge}
                </div>

                {/* Flight ID & Route */}
                <div className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                  <span className={isCurrentSelected ? 'text-occ-cyan' : 'text-white'}>
                    {f.flight_id}
                  </span>
                  <span className="text-slate-400 text-xs font-normal">
                    {f.origin} &rarr; {f.destination}
                  </span>
                </div>

                {/* Scheduled vs Predicted */}
                <div className="mt-2 text-[11px] font-mono space-y-0.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Sched:</span>
                    <span>{f.dep} - {f.arr}</span>
                  </div>
                  <div className="flex justify-between text-slate-300 font-semibold">
                    <span>Pred:</span>
                    <span className={f.delay_minutes > 0 ? 'text-occ-amber' : 'text-slate-200'}>
                      {f.pred_dep} - {f.pred_arr}
                    </span>
                  </div>
                </div>
              </div>

              {/* Turnaround buffer from previous leg */}
              {f.turnaround_before_min !== null && (
                <div className="mt-2.5 pt-2 border-t border-occ-border/60 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Turnaround buffer:</span>
                  <span className="text-slate-300 font-semibold">
                    {f.turnaround_before_min}m (min 30m)
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
