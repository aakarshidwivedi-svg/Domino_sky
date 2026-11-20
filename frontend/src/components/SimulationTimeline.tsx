import React, { useRef } from 'react';
import { useOperational } from '../context/OperationalContext';
import { Play, Pause, RotateCcw, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { minutesToTime } from '../services/deterministicSim';

export const SimulationTimeline: React.FC = () => {
  const {
    simMinute,
    simTimeStr,
    isPlaying,
    togglePlay,
    speedMultiplier,
    setSpeed,
    scrubTime,
    restart,
    closures,
    simState,
  } = useOperational();

  const barRef = useRef<HTMLDivElement>(null);

  // Operating day runs from 05:00 (300m) to 23:30 (1410m) = 1110 total minutes
  const DAY_START = 300;
  const DAY_END = 1410;
  const TOTAL_SPAN = DAY_END - DAY_START;

  const currentPercent = Math.min(100, Math.max(0, ((simMinute - DAY_START) / TOTAL_SPAN) * 100));

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, clickX / rect.width));
    const targetMin = Math.round(DAY_START + ratio * TOTAL_SPAN);
    scrubTime(targetMin);
  };

  // Hour markers
  const hours = [5, 7, 9, 11, 13, 15, 17, 19, 21, 23];

  return (
    <div className="h-14 bg-navy-900 border-t border-occ-border px-4 flex items-center justify-between gap-4 z-20 select-none">
      {/* Play/Pause & Speed Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className={`p-2 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all ${
            isPlaying
              ? 'bg-cyan-500/20 text-occ-cyan border border-occ-cyan/40 hover:bg-cyan-500/30 shadow-cyan-sm'
              : 'bg-amber-500/20 text-occ-amber border border-occ-amber/40 hover:bg-amber-500/30'
          }`}
          title={isPlaying ? 'Pause Simulation' : 'Run Simulation'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isPlaying ? 'PAUSE' : 'RESUME'}</span>
        </button>

        <div className="flex items-center gap-1 bg-navy-800 p-0.5 rounded-lg border border-occ-border text-xs font-mono">
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded transition-colors ${
                speedMultiplier === s
                  ? 'bg-occ-cyan text-navy-950 font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s}&times;
            </button>
          ))}
        </div>

        <button
          onClick={restart}
          className="p-2 text-slate-400 hover:text-white bg-navy-800 border border-occ-border rounded-lg transition-colors"
          title="Restart from 06:00 IST"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrubbing Bar & Event Markers */}
      <div className="flex-1 max-w-4xl mx-2 flex flex-col justify-center">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold">{simTimeStr} IST</span>
            <span className="text-slate-400 hidden md:inline">
              &bull; Active Flights:{' '}
              {
                Object.values(simState.flights).filter(
                  (f) => f.current_phase === 'AIRBORNE' || f.current_phase === 'HOLDING'
                ).length
              }
            </span>
          </div>

          <div className="flex items-center gap-3">
            {closures.map((c) => (
              <span
                key={c.airport_id}
                className="flex items-center gap-1 text-occ-red font-semibold bg-red-950/40 px-1.5 py-0.2 rounded border border-occ-red/30"
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                {c.airport_id} [{minutesToTime(c.start_minute)}-{minutesToTime(c.end_minute)}]
              </span>
            ))}
          </div>
        </div>

        {/* The interactive bar */}
        <div
          ref={barRef}
          onClick={handleBarClick}
          className="relative h-2.5 bg-navy-800 hover:bg-navy-750 rounded-full cursor-pointer overflow-visible group"
        >
          {/* Progress fill */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-cyan-600 to-occ-cyan rounded-full transition-all"
            style={{ width: `${currentPercent}%` }}
          />

          {/* Closure Zones on timeline */}
          {closures.map((c) => {
            const startPct = Math.max(0, ((c.start_minute - DAY_START) / TOTAL_SPAN) * 100);
            const endPct = Math.min(100, ((c.end_minute - DAY_START) / TOTAL_SPAN) * 100);
            const widthPct = Math.max(1, endPct - startPct);
            return (
              <div
                key={c.airport_id}
                className="absolute top-0 bottom-0 bg-red-500/40 border-x border-red-500 pointer-events-none"
                style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                title={`${c.airport_id} Closure: ${minutesToTime(c.start_minute)} - ${minutesToTime(c.end_minute)}`}
              />
            );
          })}

          {/* Scrubber Knob */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-occ-cyan border-2 border-navy-950 shadow-cyan-sm pointer-events-none group-hover:scale-125 transition-transform"
            style={{ left: `calc(${currentPercent}% - 8px)` }}
          />
        </div>

        {/* Hour Ticks */}
        <div className="relative flex justify-between text-[9px] font-mono text-slate-400 mt-1">
          {hours.map((h) => {
            const min = h * 60;
            const pct = ((min - DAY_START) / TOTAL_SPAN) * 100;
            return (
              <span key={h} className="hover:text-white cursor-pointer" onClick={() => scrubTime(min)}>
                {h.toString().padStart(2, '0')}:00
              </span>
            );
          })}
        </div>
      </div>

      {/* Right Stats Quick Glance */}
      <div className="hidden lg:flex items-center gap-3 font-mono text-xs text-right pl-3 border-l border-occ-border">
        <div>
          <div className="text-[10px] text-slate-400">DELAY / RECOVERED</div>
          <div className="font-bold flex items-center justify-end gap-1.5">
            <span className={simState.kpis.delayed_flights > 0 ? 'text-occ-amber' : 'text-slate-300'}>
              {simState.kpis.delayed_flights} delayed
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-occ-green">{simState.kpis.recovered_flights} rec</span>
          </div>
        </div>
      </div>
    </div>
  );
};
