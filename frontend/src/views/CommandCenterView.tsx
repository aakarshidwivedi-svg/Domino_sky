import React from 'react';
import { useOperational } from '../context/OperationalContext';
import { FlightRadar } from '../components/radar/FlightRadar';
import { AIBriefingPanel } from '../components/briefing/AIBriefingPanel';
import { EventFeed } from '../components/EventFeed';
import { KpiStrip } from '../components/KpiStrip';
import {
  ShieldAlert,
  Plane,
  Building2,
  Wrench,
  AlertTriangle,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react';

export const CommandCenterView: React.FC = () => {
  const {
    simState,
    selectedAirport,
    selectedFlight,
    selectFlight,
    setWorkspace,
    closeAirport,
    reopenAirport,
    closures,
  } = useOperational();

  const isSelectedAirportClosed = selectedAirport
    ? closures.some((c) => c.airport_id === selectedAirport.id)
    : false;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-navy-950 select-none font-sans">
      {/* 1. Operational KPI Strip */}
      <KpiStrip />

      {/* 2. Main OCC Work Area: Radar (Center) + Intelligence Panel (Right) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
        {/* CENTER: Signature India Flight Radar (~68% width on desktop) */}
        <div className="flex-1 min-h-0 lg:w-[68%] h-full relative border-r border-occ-border flex flex-col">
          <FlightRadar />
        </div>

        {/* RIGHT: Contextual Operational Intelligence Panel (~32% width) */}
        <div className="w-full lg:w-[32%] h-[45vh] lg:h-full bg-navy-900 border-t lg:border-t-0 border-occ-border flex flex-col overflow-y-auto p-3.5 space-y-3.5">
          {/* A. If an Airport is Selected on the Radar */}
          {selectedAirport ? (
            <div className="p-4 rounded-xl bg-navy-850 border border-occ-cyan/40 space-y-3 font-mono text-xs shadow-occ-card animate-fadeIn">
              <div className="flex items-center justify-between border-b border-occ-border pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-navy-900 border border-occ-cyan/40 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-occ-cyan" />
                  </div>
                  <div>
                    <div className="font-extrabold text-white text-sm">
                      {selectedAirport.city} ({selectedAirport.id})
                    </div>
                    <div className="text-[10px] text-slate-400 capitalize">
                      {selectedAirport.tier.replace('_', ' ')} &bull; {selectedAirport.capacity_per_hour} mvts/hr
                    </div>
                  </div>
                </div>

                {isSelectedAirportClosed ? (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-red-950 text-occ-red font-bold border border-occ-red/40 animate-pulse">
                    CLOSED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-occ-green font-bold border border-occ-green/30">
                    OPERATIONAL
                  </span>
                )}
              </div>

              {/* Connected Movements */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-navy-950 p-2.5 rounded-lg border border-occ-border">
                <div>
                  <span className="text-slate-400 text-[10px]">DEPARTURES</span>
                  <div className="text-white font-bold">
                    {
                      Object.values(simState.flights).filter(
                        (f) => f.origin === selectedAirport.id
                      ).length
                    }{' '}
                    flights
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">ARRIVALS</span>
                  <div className="text-white font-bold">
                    {
                      Object.values(simState.flights).filter(
                        (f) => f.destination === selectedAirport.id
                      ).length
                    }{' '}
                    flights
                  </div>
                </div>
              </div>

              {/* Close Airport Simulation Trigger Action */}
              <div className="pt-1">
                {isSelectedAirportClosed ? (
                  <button
                    onClick={() => reopenAirport(selectedAirport.id)}
                    className="w-full py-2 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-occ-green font-bold border border-occ-green/40 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Lift Closure & Reopen {selectedAirport.id}</span>
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      closeAirport(
                        selectedAirport.id,
                        simState.meta.current_sim_minute,
                        simState.meta.current_sim_minute + 90,
                        'Monsoon Thunderstorm Closure'
                      )
                    }
                    className="w-full py-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-occ-red font-bold border border-occ-red/40 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Simulate 90m Runway Closure</span>
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {/* B. AI Operations Briefing Panel */}
          <AIBriefingPanel />

          {/* C. Live Operational Event Stream */}
          <div className="h-64 flex-shrink-0">
            <EventFeed />
          </div>
        </div>
      </div>
    </div>
  );
};
