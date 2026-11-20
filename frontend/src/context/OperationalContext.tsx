import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  SimulationState,
  AirportClosure,
  SpareDeployment,
  ScenarioPreset,
  ScenarioComparison,
  Flight,
  Airport,
  CopilotMessage,
  CopilotAction,
} from '../types';
import { localSimulator, timeToMinutes, minutesToTime } from '../services/deterministicSim';
import { apiService } from '../services/api';
import { queryCopilot } from '../services/copilotEngine';

export type WorkspaceView =
  | 'command'
  | 'radar'
  | 'detective'
  | 'explorer'
  | 'passenger'
  | 'recovery'
  | 'intelligence'
  | 'copilot'
  | 'briefing';

interface OperationalContextType {
  workspace: WorkspaceView;
  setWorkspace: (w: WorkspaceView) => void;

  // Clock & Playback
  simMinute: number;
  simTimeStr: string;
  isPlaying: boolean;
  speedMultiplier: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  scrubTime: (minute: number) => void;
  restart: () => void;

  // Selections
  selectedFlightId: string | null;
  selectedAirportId: string | null;
  selectedTailId: string | null;
  selectFlight: (fid: string | null) => void;
  selectAirport: (aid: string | null) => void;
  selectTail: (tail: string | null) => void;
  clearSelection: () => void;

  // Selected entities
  selectedFlight: Flight | null;
  selectedAirport: Airport | null;

  // State & Data
  simState: SimulationState;
  airports: Record<string, Airport>;
  presets: ScenarioPreset[];
  currentPresetId: string;
  applyPreset: (presetId: string) => void;

  // Disruption Actions
  closures: AirportClosure[];
  closeAirport: (airportId: string, startMin: number, endMin: number, reason?: string) => void;
  reopenAirport: (airportId: string) => void;
  injectAOGDelay: (flightId: string, delayMinutes: number) => void;

  // Recovery Actions
  deployments: SpareDeployment[];
  deploySpare: (deployment: SpareDeployment) => void;
  undoDeployment: (targetFlightId?: string) => void;
  cancelledFlights: string[];
  cancelFlight: (flightId: string) => void;
  uncancelFlight: (flightId: string) => void;
  resetScenario: () => void;

  // Scenario 3-Way Comparison
  scenarioComparison: ScenarioComparison | null;

  // AI Copilot
  copilotMessages: CopilotMessage[];
  isCopilotLoading: boolean;
  sendCopilotMessage: (text: string) => Promise<void>;
  handleCopilotAction: (action: CopilotAction) => void;
  isCopilotOpen: boolean;
  setIsCopilotOpen: (open: boolean) => void;

  // UI state
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  investigatorOpen: boolean;
  setInvestigatorOpen: (open: boolean) => void;
  lastActionMessage: string | null;
  dismissActionMessage: () => void;
}

const OperationalContext = createContext<OperationalContextType | null>(null);

export const OperationalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspace, setWorkspace] = useState<WorkspaceView>('command');
  const [simMinute, setSimMinute] = useState<number>(540); // 09:00 IST default
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(2); // 2x default

  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [selectedAirportId, setSelectedAirportId] = useState<string | null>(null);
  const [selectedTailId, setSelectedTailId] = useState<string | null>(null);

  const [closures, setClosures] = useState<AirportClosure[]>([]);
  const [manualDelays, setManualDelays] = useState<Record<string, number>>({});
  const [deployments, setDeployments] = useState<SpareDeployment[]>([]);
  const [cancelledFlights, setCancelledFlights] = useState<string[]>([]);
  const [presets, setPresets] = useState<ScenarioPreset[]>([]);
  const [currentPresetId, setCurrentPresetId] = useState<string>('bom_thunderstorm');

  const [scenarioComparison, setScenarioComparison] = useState<ScenarioComparison | null>(null);

  // Copilot messages
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      sender: 'copilot',
      text: '**Welcome to DOMINO SKY AI Copilot.**\n\nI am connected to the live Indian flight operations network and rotation simulation. Ask me about delays, rotational domino chains, passenger connections, crew duty limits, or spare feasibility.',
      timestamp: '09:00',
      suggestedActions: [
        { label: 'Why is flight DS1502 delayed?', action: 'SELECT_FLIGHT', value: 'DS1502' },
        { label: 'Can VT-DS18 replace DS1502?', action: 'EVALUATE_SPARE', flight: 'DS1502', spare: 'VT-DS18' },
        { label: 'Which airport is the worst bottleneck?', action: 'VIEW_RISK', value: 'BOM' },
        { label: 'How many passenger connections are broken?', action: 'NAVIGATE_PASSENGER_IMPACT' },
      ],
    },
  ]);
  const [isCopilotLoading, setIsCopilotLoading] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [investigatorOpen, setInvestigatorOpen] = useState<boolean>(false);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  const airports = localSimulator.getAirports();

  // Primary operational state calculated deterministically
  const [simState, setSimState] = useState<SimulationState>(() =>
    localSimulator.simulate(closures, manualDelays, deployments, cancelledFlights, simMinute)
  );

  // Load presets on mount
  useEffect(() => {
    apiService.getPresets().then((data) => {
      setPresets(data);
      const bomPreset = data.find((p) => p.id === 'bom_thunderstorm');
      if (bomPreset) {
        setClosures(bomPreset.closures);
        setSimMinute(bomPreset.default_sim_minute);
      }
    });
  }, []);

  // Recalculate simulation state when inputs change
  useEffect(() => {
    let isCancelled = false;
    apiService.runSimulation(closures, manualDelays, deployments, cancelledFlights, simMinute).then((state) => {
      if (!isCancelled) {
        setSimState(state);
      }
    });

    // Also update 3-way comparison
    apiService.compareScenarios(closures, manualDelays, deployments, cancelledFlights, simMinute).then((comp) => {
      if (!isCancelled) {
        setScenarioComparison(comp);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [closures, manualDelays, deployments, cancelledFlights, simMinute]);

  // Simulation Clock Timer
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setSimMinute((prev) => {
        const next = prev + speedMultiplier;
        if (next >= 1440) return 300; // Loop 05:00 to 24:00
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, speedMultiplier]);

  // Keyboard shortcut Ctrl/Cmd+K for global command search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Selection handlers
  const selectFlight = useCallback((fid: string | null) => {
    setSelectedFlightId(fid);
    if (fid) {
      setSelectedAirportId(null);
      setInvestigatorOpen(true);
    }
  }, []);

  const selectAirport = useCallback((aid: string | null) => {
    setSelectedAirportId(aid);
    if (aid) {
      setSelectedFlightId(null);
    }
  }, []);

  const selectTail = useCallback((tail: string | null) => {
    setSelectedTailId(tail);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFlightId(null);
    setSelectedAirportId(null);
    setSelectedTailId(null);
    setInvestigatorOpen(false);
  }, []);

  // Playback handlers
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const setSpeed = useCallback((s: number) => setSpeedMultiplier(s), []);
  const scrubTime = useCallback((m: number) => setSimMinute(m), []);
  const restart = useCallback(() => {
    setSimMinute(360); // 06:00 IST
    setIsPlaying(true);
  }, []);

  // Disruption Actions
  const closeAirport = useCallback(
    (airportId: string, startMin: number, endMin: number, reason: string = 'Weather Closure') => {
      setClosures((prev) => {
        const filtered = prev.filter((c) => c.airport_id !== airportId);
        return [...filtered, { airport_id: airportId, start_minute: startMin, end_minute: endMin, reason }];
      });
      setLastActionMessage(`Airport ${airportId} closed from ${minutesToTime(startMin)} to ${minutesToTime(endMin)} (${reason}).`);
    },
    []
  );

  const reopenAirport = useCallback((airportId: string) => {
    setClosures((prev) => prev.filter((c) => c.airport_id !== airportId));
    setLastActionMessage(`Airport ${airportId} closure lifted. Departures & arrivals resumed.`);
  }, []);

  const injectAOGDelay = useCallback((flightId: string, delayMinutes: number) => {
    setManualDelays((prev) => ({ ...prev, [flightId]: delayMinutes }));
    setLastActionMessage(`Injected +${delayMinutes}m maintenance hold on flight ${flightId}.`);
  }, []);

  // Recovery Actions
  const deploySpare = useCallback((deployment: SpareDeployment) => {
    setDeployments((prev) => {
      const filtered = prev.filter((d) => d.target_flight_id !== deployment.target_flight_id);
      return [...filtered, deployment];
    });
    setLastActionMessage(`Deployed spare ${deployment.spare_tail} on flight ${deployment.target_flight_id}.`);
  }, []);

  const undoDeployment = useCallback((targetFlightId?: string) => {
    setDeployments((prev) => {
      if (targetFlightId) {
        return prev.filter((d) => d.target_flight_id !== targetFlightId);
      }
      return prev.slice(0, -1);
    });
    setLastActionMessage('Spare aircraft deployment undone. Rotation reverted.');
  }, []);

  const cancelFlight = useCallback((flightId: string) => {
    setCancelledFlights((prev) => (prev.includes(flightId) ? prev : [...prev, flightId]));
    setLastActionMessage(`Flight ${flightId} cancelled by OCC order to halt delay propagation.`);
  }, []);

  const uncancelFlight = useCallback((flightId: string) => {
    setCancelledFlights((prev) => prev.filter((id) => id !== flightId));
    setLastActionMessage(`Flight ${flightId} restored to active schedule.`);
  }, []);

  const resetScenario = useCallback(() => {
    setClosures([]);
    setManualDelays({});
    setDeployments([]);
    setCancelledFlights([]);
    setSelectedFlightId(null);
    setSelectedAirportId(null);
    setCurrentPresetId('baseline');
    setSimMinute(360);
    setLastActionMessage('Simulation reset to nominal scheduled baseline.');
  }, []);

  const applyPreset = useCallback(
    (presetId: string) => {
      const p = presets.find((x) => x.id === presetId);
      if (p) {
        setClosures(p.closures);
        setManualDelays(p.manual_delays || {});
        setDeployments([]);
        setCancelledFlights([]);
        setSimMinute(p.default_sim_minute);
        setCurrentPresetId(presetId);
        setSelectedFlightId(null);
        setSelectedAirportId(null);
        setLastActionMessage(`Loaded scenario preset: "${p.name}".`);
      }
    },
    [presets]
  );

  // Copilot Message Dispatcher
  const sendCopilotMessage = useCallback(
    async (text: string) => {
      const userMsg: CopilotMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: minutesToTime(simMinute),
      };
      setCopilotMessages((prev) => [...prev, userMsg]);
      setIsCopilotLoading(true);

      try {
        const copilotResponse = await queryCopilot(text, simState, selectedFlightId, selectedAirportId);
        setCopilotMessages((prev) => [...prev, copilotResponse]);
      } finally {
        setIsCopilotLoading(false);
      }
    },
    [simState, selectedFlightId, selectedAirportId, simMinute]
  );

  const handleCopilotAction = useCallback(
    (action: CopilotAction) => {
      switch (action.action) {
        case 'SELECT_FLIGHT':
          if (action.value) selectFlight(action.value);
          break;
        case 'FILTER_AIRPORT':
          if (action.value) selectAirport(action.value);
          break;
        case 'NAVIGATE_PASSENGER_IMPACT':
          setWorkspace('passenger');
          break;
        case 'NAVIGATE_RECOVERY':
          setWorkspace('recovery');
          if (action.value) selectFlight(action.value);
          break;
        case 'NAVIGATE_DETECTIVE':
          setWorkspace('detective');
          if (action.value) selectFlight(action.value);
          break;
        case 'VIEW_RISK':
          setWorkspace('intelligence');
          if (action.value) selectAirport(action.value);
          break;
        case 'CANCEL_FLIGHT':
          if (action.value) cancelFlight(action.value);
          break;
        case 'CONFIRM_DEPLOYMENT':
          if (action.spare && action.flight) {
            deploySpare({
              spare_tail: action.spare,
              target_flight_id: action.flight,
              replace_remaining_rotation: true,
              assumed_reposition_minutes: 0,
            });
          }
          break;
      }
    },
    [selectFlight, selectAirport, cancelFlight, deploySpare]
  );

  const selectedFlight = selectedFlightId ? simState.flights[selectedFlightId] || null : null;
  const selectedAirport = selectedAirportId ? airports[selectedAirportId] || null : null;

  return (
    <OperationalContext.Provider
      value={{
        workspace,
        setWorkspace,
        simMinute,
        simTimeStr: minutesToTime(simMinute),
        isPlaying,
        speedMultiplier,
        play,
        pause,
        togglePlay,
        setSpeed,
        scrubTime,
        restart,
        selectedFlightId,
        selectedAirportId,
        selectedTailId,
        selectFlight,
        selectAirport,
        selectTail,
        clearSelection,
        selectedFlight,
        selectedAirport,
        simState,
        airports,
        presets,
        currentPresetId,
        applyPreset,
        closures,
        closeAirport,
        reopenAirport,
        injectAOGDelay,
        deployments,
        deploySpare,
        undoDeployment,
        cancelledFlights,
        cancelFlight,
        uncancelFlight,
        resetScenario,
        scenarioComparison,
        copilotMessages,
        isCopilotLoading,
        sendCopilotMessage,
        handleCopilotAction,
        isCopilotOpen,
        setIsCopilotOpen,
        isSearchOpen,
        setIsSearchOpen,
        investigatorOpen,
        setInvestigatorOpen,
        lastActionMessage,
        dismissActionMessage: () => setLastActionMessage(null),
      }}
    >
      {children}
    </OperationalContext.Provider>
  );
};

export const useOperational = () => {
  const context = useContext(OperationalContext);
  if (!context) {
    throw new Error('useOperational must be used within an OperationalProvider');
  }
  return context;
};
