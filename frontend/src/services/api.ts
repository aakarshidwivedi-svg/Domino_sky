import {
  SimulationState,
  AirportClosure,
  SpareDeployment,
  ScenarioPreset,
  ScenarioComparison,
} from '../types';
import { localSimulator } from './deterministicSim';

const API_BASE = '/api';

export const apiService = {
  async runSimulation(
    closures: AirportClosure[] = [],
    manualDelays: Record<string, number> = {},
    deployments: SpareDeployment[] = [],
    cancelledFlights: string[] = [],
    currentSimMinute: number = 720
  ): Promise<SimulationState> {
    try {
      const res = await fetch(`${API_BASE}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closures,
          manual_delays: manualDelays,
          deployments,
          cancelled_flights: cancelledFlights,
          current_sim_minute: currentSimMinute,
        }),
      });
      if (!res.ok) throw new Error(`Backend HTTP error: ${res.status}`);
      return await res.json();
    } catch (err) {
      // Seamless deterministic client-side execution fallback
      return localSimulator.simulate(closures, manualDelays, deployments, cancelledFlights, currentSimMinute);
    }
  },

  async getPresets(): Promise<ScenarioPreset[]> {
    try {
      const res = await fetch(`${API_BASE}/scenarios/presets`);
      if (!res.ok) throw new Error('Failed to fetch presets');
      return await res.json();
    } catch (err) {
      return [
        {
          id: 'baseline',
          name: 'Normal Scheduled Operations',
          description: 'Baseline Indian domestic flight network with all 70 flights on schedule, 0 closures, and full rotation buffers intact.',
          closures: [],
          manual_delays: {},
          default_sim_minute: 360,
        },
        {
          id: 'bom_thunderstorm',
          name: 'Mumbai (BOM) Monsoon Storm Closure',
          description: 'Chhatrapati Shivaji Maharaj Intl (BOM) closed 08:30–10:00 (90 mins). Demonstrates severe delay cascade along VT-DS02, VT-DS04, VT-DS07, and broken connections.',
          closures: [
            {
              airport_id: 'BOM',
              start_minute: 510,
              end_minute: 600,
              reason: 'Severe Monsoon Thunderstorm / Waterlogging',
            },
          ],
          manual_delays: {},
          default_sim_minute: 540,
        },
        {
          id: 'del_winter_fog',
          name: 'Delhi (DEL) Dense Winter Fog CAT III',
          description: 'Indira Gandhi Intl (DEL) closed 07:00–09:30 (150 mins) due to zero RVR visibility. Cascades delay across Northern and Central rotations.',
          closures: [
            {
              airport_id: 'DEL',
              start_minute: 420,
              end_minute: 570,
              reason: 'Dense Radiation Fog / CAT III Holding',
            },
          ],
          manual_delays: {},
          default_sim_minute: 480,
        },
        {
          id: 'blr_afternoon_squall',
          name: 'Bengaluru (BLR) Convective Squall Line',
          description: 'Kempegowda Intl (BLR) closed 13:00–14:30 (90 mins). Disrupts southern connector flights, threatening 5 passenger connection banks.',
          closures: [
            {
              airport_id: 'BLR',
              start_minute: 780,
              end_minute: 870,
              reason: 'Microburst & Lightning Squall',
            },
          ],
          manual_delays: {},
          default_sim_minute: 810,
        },
        {
          id: 'aog_technical',
          name: 'VT-DS04 Technical AOG at BOM',
          description: 'Aircraft VT-DS04 incurs a 90-minute hydraulic system maintenance hold on flight DS0401 (07:45 dep). Triggers 5-leg cascade through GOI, PNQ, and AMD.',
          closures: [],
          manual_delays: {
            DS0401: 90,
          },
          default_sim_minute: 510,
        },
      ];
    }
  },

  async evaluateSpare(
    targetFlightId: string,
    spareTail: string,
    simState: SimulationState,
    assumedRepositionMinutes: number = 0
  ) {
    try {
      const res = await fetch(`${API_BASE}/spares/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_flight_id: targetFlightId,
          spare_tail: spareTail,
          assumed_reposition_minutes: assumedRepositionMinutes,
          current_sim_minute: simState.meta.current_sim_minute,
          closures: simState.closures,
          deployments: simState.deployments,
          cancelled_flights: simState.cancelled_flights || [],
        }),
      });
      if (!res.ok) throw new Error('Evaluation error');
      return await res.json();
    } catch {
      return localSimulator.evaluateSpareFeasibility(
        targetFlightId,
        spareTail,
        simState,
        assumedRepositionMinutes
      );
    }
  },

  async compareScenarios(
    closures: AirportClosure[] = [],
    manualDelays: Record<string, number> = {},
    deployments: SpareDeployment[] = [],
    cancelledFlights: string[] = [],
    currentSimMinute: number = 720
  ): Promise<ScenarioComparison> {
    try {
      const res = await fetch(`${API_BASE}/scenarios/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closures,
          manual_delays: manualDelays,
          deployments,
          cancelled_flights: cancelledFlights,
          current_sim_minute: currentSimMinute,
        }),
      });
      if (!res.ok) throw new Error('Comparison error');
      return await res.json();
    } catch {
      return localSimulator.compareScenarios(
        closures,
        manualDelays,
        deployments,
        cancelledFlights,
        currentSimMinute
      );
    }
  },
};
