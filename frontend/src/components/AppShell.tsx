import React from 'react';
import { useOperational } from '../context/OperationalContext';
import { TopHeader } from './TopHeader';
import { Sidebar } from './Sidebar';
import { SimulationTimeline } from './SimulationTimeline';
import { CommandPalette } from './CommandPalette';
import { FlightDetailDrawer } from './detective/FlightDetailDrawer';
import { CommandCenterView } from '../views/CommandCenterView';
import { RadarView } from '../views/RadarView';
import { FlightExplorerView } from '../views/FlightExplorerView';
import { RecoveryDeskView } from '../views/RecoveryDeskView';
import { NetworkIntelligenceView } from '../views/NetworkIntelligenceView';
import { AIBriefingView } from '../views/AIBriefingView';
import { DelayDetectiveView } from '../views/DelayDetectiveView';
import { PassengerImpactView } from '../views/PassengerImpactView';
import { AICopilotView } from '../views/AICopilotView';
import { X, CheckCircle2 } from 'lucide-react';

export const AppShell: React.FC = () => {
  const { workspace, lastActionMessage, dismissActionMessage } = useOperational();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 text-slate-100 font-sans antialiased">
      {/* 1. Unified Top Navigation Header */}
      <TopHeader />

      {/* 2. Middle Main Workspace Shell: Sidebar + Active View */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        <Sidebar />

        <main className="flex-1 min-h-0 flex flex-col h-full overflow-hidden relative">
          {workspace === 'command' && <CommandCenterView />}
          {workspace === 'radar' && <RadarView />}
          {workspace === 'detective' && <DelayDetectiveView />}
          {workspace === 'passenger' && <PassengerImpactView />}
          {workspace === 'recovery' && <RecoveryDeskView />}
          {workspace === 'intelligence' && <NetworkIntelligenceView />}
          {workspace === 'copilot' && <AICopilotView />}
          {workspace === 'explorer' && <FlightExplorerView />}
          {workspace === 'briefing' && <AIBriefingView />}
        </main>

        {/* Global Contextual Flight Detail Drawer */}
        <FlightDetailDrawer />

        {/* Global Action Feedback Toast */}
        {lastActionMessage && (
          <div className="fixed bottom-16 right-6 z-50 bg-navy-850 border border-occ-cyan/40 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 font-mono text-xs animate-bounce">
            <CheckCircle2 className="w-4 h-4 text-occ-cyan flex-shrink-0" />
            <span>{lastActionMessage}</span>
            <button
              onClick={dismissActionMessage}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Persistent Global Simulation Timeline & Scrubber */}
      <SimulationTimeline />

      {/* 4. Global Command Search Palette (Ctrl+K) */}
      <CommandPalette />
    </div>
  );
};
