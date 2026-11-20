import React from 'react';
import { useOperational } from '../context/OperationalContext';
import {
  Plane,
  Play,
  Pause,
  RotateCcw,
  Search,
  AlertTriangle,
  Clock,
  Layers,
  ChevronDown,
} from 'lucide-react';

export const TopHeader: React.FC = () => {
  const {
    simTimeStr,
    isPlaying,
    togglePlay,
    speedMultiplier,
    setSpeed,
    restart,
    presets,
    currentPresetId,
    applyPreset,
    resetScenario,
    simState,
    setIsSearchOpen,
    closures,
  } = useOperational();

  const currentPreset = presets.find((p) => p.id === currentPresetId);
  const criticalAlertsCount =
    (simState.ai_briefing?.critical_alerts?.length || 0) + closures.length;

  return (
    <header className="h-14 bg-navy-900 border-b border-occ-border px-4 flex items-center justify-between z-30 select-none">
      {/* Brand Identity & Simulation Disclaimer */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-occ-cyan/40 flex items-center justify-center shadow-cyan-sm">
            <Plane className="w-5 h-5 text-occ-cyan transform -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-white text-base font-mono">
                DOMINO<span className="text-occ-cyan">SKY</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.2 rounded bg-navy-800 text-slate-300 border border-slate-700">
                OCC v2.0
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-tight flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-occ-cyan animate-pulse"></span>
              AIRLINE OPERATIONS CONTROL CENTRE
            </div>
          </div>
        </div>

        {/* Unmistakable Simulation Status Badge */}
        <div className="hidden md:flex items-center ml-4 pl-4 border-l border-occ-border gap-2">
          <div
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 border ${
              isPlaying
                ? 'bg-cyan-950/40 text-occ-cyan border-occ-cyan/40 shadow-cyan-sm'
                : 'bg-amber-950/40 text-occ-amber border-occ-amber/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPlaying ? 'bg-occ-cyan animate-ping' : 'bg-occ-amber'
              }`}
            ></span>
            {isPlaying ? 'ACTIVE SIMULATION' : 'SIMULATION PAUSED'}
          </div>
          <span className="text-[11px] text-slate-400 hidden xl:inline">
            Deterministic Rotations Engine &bull; Indian Network
          </span>
        </div>
      </div>

      {/* Center: Scenario Selector & Global Search */}
      <div className="flex items-center gap-2.5">
        {/* Scenario Preset Selector */}
        <div className="relative group">
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded="false"
            aria-label={`Current Scenario: ${currentPreset?.name || 'Custom Disruption'}. Select to change scenario.`}
            className="flex items-center gap-1.5 bg-navy-850 hover:bg-navy-800 border border-occ-border rounded-lg px-3 py-1.5 text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none"
          >
            <Layers className="w-3.5 h-3.5 text-occ-cyan" aria-hidden="true" />
            <span className="text-slate-400 font-medium">Scenario:</span>
            <span className="text-white font-semibold max-w-[170px] truncate">
              {currentPreset?.name || 'Custom Disruption'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          </button>

          {/* Preset Dropdown Menu */}
          <div
            role="menu"
            aria-label="Disruption Scenarios"
            className="absolute top-full left-0 mt-1 w-72 bg-navy-900 border border-occ-border rounded-xl shadow-2xl p-2 hidden group-hover:block z-50 animate-fadeIn"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Select Disruption Scenario
            </div>
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="menuitem"
                aria-current={currentPresetId === preset.id ? 'true' : undefined}
                aria-label={`Scenario: ${preset.name}. ${preset.description}`}
                onClick={() => applyPreset(preset.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex flex-col gap-0.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none ${
                  currentPresetId === preset.id
                    ? 'bg-cyan-950/40 text-white border border-occ-cyan/30'
                    : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>{preset.name}</span>
                  {currentPresetId === preset.id && (
                    <span className="text-[10px] text-occ-cyan font-mono font-bold">ACTIVE</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-1">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Global Search Button */}
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          aria-label="Open global search palette (Press Ctrl+K)"
          className="flex items-center gap-2 bg-navy-850 hover:bg-navy-800 border border-occ-border rounded-lg px-3 py-1.5 text-xs text-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none"
          title="Search Flights, Tails, Airports (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 text-occ-cyan" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden lg:inline px-1.5 py-0.2 text-[10px] font-mono bg-navy-750 text-slate-400 border border-slate-700 rounded">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Simulation Clock & Quick Controls */}
      <div className="flex items-center gap-3">
        {/* Sim Clock Display */}
        <div className="flex items-center gap-2 bg-navy-950/80 border border-occ-border px-3 py-1 rounded-lg">
          <Clock className="w-3.5 h-3.5 text-occ-cyan" />
          <div className="text-right font-mono">
            <div className="text-xs font-bold text-white tracking-wide">
              {simTimeStr} <span className="text-slate-400 text-[10px]">IST</span>
            </div>
          </div>
        </div>

        {/* Quick Play/Pause & Speed */}
        <div className="flex items-center gap-1 bg-navy-850 border border-occ-border rounded-lg p-0.5">
          <button
            onClick={togglePlay}
            className={`p-1.5 rounded transition-colors ${
              isPlaying
                ? 'bg-cyan-500/20 text-occ-cyan hover:bg-cyan-500/30'
                : 'bg-amber-500/20 text-occ-amber hover:bg-amber-500/30'
            }`}
            title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center gap-0.5 px-1 font-mono text-[11px]">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  speedMultiplier === s
                    ? 'bg-navy-700 text-occ-cyan font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}&times;
              </button>
            ))}
          </div>

          <button
            onClick={restart}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Restart Timeline to 06:00 IST"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Reset Scenario Button */}
        <button
          onClick={resetScenario}
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-navy-850 hover:bg-navy-800 border border-occ-border rounded-lg transition-colors"
          title="Reset to Scheduled Baseline"
        >
          <RotateCcw className="w-3 h-3 text-slate-400" />
          <span>Reset</span>
        </button>

        {/* Alert Bell Badge */}
        {criticalAlertsCount > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/40 border border-occ-red/30 text-occ-red text-xs font-mono font-bold animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{criticalAlertsCount}</span>
          </div>
        )}
      </div>
    </header>
  );
};
