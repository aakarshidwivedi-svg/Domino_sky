import React from 'react';
import { useOperational } from '../context/OperationalContext';
import {
  Plane,
  CheckCircle2,
  Clock,
  Users,
  AlertOctagon,
  Wrench,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export const KpiStrip: React.FC = () => {
  const { simState, setWorkspace } = useOperational();
  const kpis = simState.kpis;
  const closures = simState.closures;

  const cards = [
    {
      id: 'total',
      label: 'SCHEDULED FLIGHTS',
      value: kpis.total_flights,
      subtext: '16 Tails • 16 Airports',
      icon: Plane,
      color: 'text-occ-cyan',
      borderColor: 'border-occ-cyan/30',
      bgColor: 'bg-cyan-950/20',
      onClick: () => setWorkspace('explorer'),
    },
    {
      id: 'ontime',
      label: 'ON-TIME / RECOVERED',
      value: `${kpis.on_time_flights}`,
      subtext: `${Math.round((kpis.on_time_flights / kpis.total_flights) * 100)}% OTP Rate`,
      icon: CheckCircle2,
      color: 'text-occ-green',
      borderColor: 'border-occ-green/30',
      bgColor: 'bg-emerald-950/20',
      onClick: () => setWorkspace('explorer'),
    },
    {
      id: 'delayed',
      label: 'DELAYED FLIGHTS',
      value: kpis.delayed_flights,
      subtext: `${kpis.severely_delayed_flights} Severe (>60m) • ${kpis.total_delay_minutes}m total`,
      icon: Clock,
      color: kpis.delayed_flights > 0 ? 'text-occ-amber' : 'text-slate-400',
      borderColor: kpis.delayed_flights > 0 ? 'border-occ-amber/40' : 'border-occ-border',
      bgColor: kpis.delayed_flights > 0 ? 'bg-amber-950/20' : 'bg-navy-850',
      onClick: () => setWorkspace('explorer'),
    },
    {
      id: 'pax',
      label: 'PAX CONNECTIONS AT RISK',
      value: kpis.passengers_at_risk,
      subtext: `${kpis.broken_connections} Broken Connection(s)`,
      icon: Users,
      color: kpis.passengers_at_risk > 0 ? 'text-occ-red' : 'text-slate-400',
      borderColor: kpis.passengers_at_risk > 0 ? 'border-occ-red/40' : 'border-occ-border',
      bgColor: kpis.passengers_at_risk > 0 ? 'bg-red-950/20' : 'bg-navy-850',
      onClick: () => setWorkspace('intelligence'),
    },
    {
      id: 'disruptions',
      label: 'ACTIVE CLOSURES',
      value: closures.length,
      subtext: closures.length > 0 ? `${closures.map((c) => c.airport_id).join(', ')} Closed` : 'All Hubs Open',
      icon: AlertOctagon,
      color: closures.length > 0 ? 'text-occ-red' : 'text-occ-green',
      borderColor: closures.length > 0 ? 'border-occ-red/40' : 'border-occ-border',
      bgColor: closures.length > 0 ? 'bg-red-950/20' : 'bg-navy-850',
      onClick: () => setWorkspace('radar'),
    },
    {
      id: 'spares',
      label: 'SPARE AIRCRAFT',
      value: `${kpis.available_spares} / 2`,
      subtext: kpis.recovered_flights > 0 ? `${kpis.recovered_flights} Flights Recovered` : 'VT-DS17 (BLR), VT-DS18 (DEL)',
      icon: Wrench,
      color: kpis.available_spares > 0 ? 'text-occ-cyan' : 'text-slate-400',
      borderColor: 'border-occ-border',
      bgColor: 'bg-navy-850',
      onClick: () => setWorkspace('recovery'),
    },
  ];

  return (
    <nav
      role="region"
      aria-label="Operational Key Performance Indicators"
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3 bg-navy-950 border-b border-occ-border select-none"
    >
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <button
            type="button"
            key={c.id}
            onClick={c.onClick}
            aria-label={`${c.label}: ${c.value}. ${c.subtext}. Click to open workspace.`}
            className={`p-3 rounded-xl border text-left ${c.borderColor} ${c.bgColor} hover:bg-navy-800/80 transition-all cursor-pointer flex flex-col justify-between shadow-occ-card group focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider truncate">
                {c.label}
              </span>
              <Icon className={`w-3.5 h-3.5 ${c.color} opacity-80 group-hover:opacity-100 transition-opacity`} aria-hidden="true" />
            </div>

            <div className="mt-1 flex items-baseline gap-2" aria-live="polite">
              <span className={`text-xl font-extrabold font-mono ${c.color}`}>
                {c.value}
              </span>
            </div>

            <div className="mt-1 text-[10px] text-slate-400 font-mono truncate">
              {c.subtext}
            </div>
          </button>
        );
      })}
    </nav>
  );
};
