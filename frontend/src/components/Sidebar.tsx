import React, { useState } from 'react';
import { useOperational, WorkspaceView } from '../context/OperationalContext';
import {
  LayoutDashboard,
  Radar,
  ListFilter,
  Wrench,
  ShieldAlert,
  Bot,
  ChevronLeft,
  ChevronRight,
  Plane,
  AlertCircle,
  Sparkles,
  Search,
  Users,
  Compass,
} from 'lucide-react';

interface NavItem {
  id: WorkspaceView;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeColor?: string;
}

export const Sidebar: React.FC = () => {
  const { workspace, setWorkspace, simState } = useOperational();
  const [collapsed, setCollapsed] = useState(false);

  const kpis = simState.kpis;
  const severeCount = kpis.severely_delayed_flights;
  const delayedCount = kpis.delayed_flights;
  const spareCount = kpis.available_spares;
  const brokenCx = kpis.broken_connections;

  const navItems: NavItem[] = [
    {
      id: 'command',
      label: 'Command Center',
      shortLabel: 'Overview',
      icon: LayoutDashboard,
      badge: severeCount > 0 ? severeCount : undefined,
      badgeColor: 'bg-red-500/20 text-red-400 border border-red-500/30',
    },
    {
      id: 'radar',
      label: 'Live Flight Radar',
      shortLabel: 'Radar',
      icon: Radar,
      badge: delayedCount > 0 ? `${delayedCount} del` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    },
    {
      id: 'detective',
      label: 'Delay Detective',
      shortLabel: 'Detective',
      icon: Compass,
      badge: delayedCount > 0 ? delayedCount : undefined,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
    },
    {
      id: 'passenger',
      label: 'Passenger Impact',
      shortLabel: 'Passengers',
      icon: Users,
      badge: brokenCx > 0 ? `${brokenCx} broken` : '21 banks',
      badgeColor: brokenCx > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400',
    },
    {
      id: 'recovery',
      label: 'Recovery Desk',
      shortLabel: 'Recovery',
      icon: Wrench,
      badge: `${spareCount} Spares`,
      badgeColor: spareCount > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400',
    },
    {
      id: 'intelligence',
      label: 'Network Intelligence',
      shortLabel: 'Risk',
      icon: ShieldAlert,
      badge: '16 Hubs',
      badgeColor: 'bg-slate-800 text-slate-300',
    },
    {
      id: 'copilot',
      label: 'AI Operations Copilot',
      shortLabel: 'Copilot',
      icon: Bot,
      badge: 'LIVE',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold',
    },
    {
      id: 'explorer',
      label: 'Flight Explorer',
      shortLabel: 'Flights',
      icon: ListFilter,
      badge: 70,
      badgeColor: 'bg-slate-800 text-slate-300',
    },
    {
      id: 'briefing',
      label: 'AI Operations Briefing',
      shortLabel: 'Briefing',
      icon: Sparkles,
      badge: 'Export',
      badgeColor: 'bg-slate-800 text-slate-400',
    },
  ];

  return (
    <aside
      className={`h-[calc(100vh-3.5rem)] bg-slate-950/90 border-r border-slate-800 flex flex-col justify-between transition-all duration-300 z-20 select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
      role="navigation"
      aria-label="Operations Control Workspaces"
    >
      {/* Top Nav Items */}
      <div className="p-3 space-y-1 flex-1 overflow-y-auto no-scrollbar">
        <div className={`px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${collapsed ? 'hidden' : 'block'}`}>
          OCC Workspaces
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = workspace === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setWorkspace(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-mono text-xs transition-all text-left focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                isActive
                  ? 'bg-cyan-950/80 text-cyan-200 border border-cyan-500/40 font-semibold shadow-lg shadow-cyan-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>

              {!collapsed && item.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-none flex-shrink-0 ${
                    item.badgeColor || 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer & Collapse Toggle */}
      <div className="p-3 border-t border-slate-800 space-y-3">
        {!collapsed && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-xs font-mono space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span>Network Status</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                ACTIVE
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>On-Time Rate:</span>
              <span className="text-slate-200 font-semibold">
                {kpis.on_time_flights} / {kpis.total_flights} ({Math.round((kpis.on_time_flights / kpis.total_flights) * 100)}%)
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Total Delay:</span>
              <span className={kpis.total_delay_minutes > 0 ? 'text-amber-400 font-semibold' : 'text-slate-200'}>
                {kpis.total_delay_minutes} mins
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/60 transition-colors text-xs font-mono"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
