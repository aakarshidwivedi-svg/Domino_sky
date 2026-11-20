export type FlightStatus = 'ON_TIME' | 'DELAYED' | 'SEVERELY_DELAYED' | 'RECOVERED' | 'CANCELLED' | 'DIVERTED';
export type FlightPhase = 'SCHEDULED' | 'BOARDING' | 'AIRBORNE' | 'HOLDING' | 'ARRIVED' | 'CANCELLED' | 'DIVERTED';
export type RiskTier = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type CrewStatus = 'LEGAL' | 'WARNING' | 'EXCEEDED' | 'SWAPPED_STANDBY';
export type ConnectionStatus = 'ON_TIME' | 'PROTECTED' | 'BROKEN' | 'CANCELLED' | 'REBOOKED' | 'STRANDED_OVERNIGHT';

export interface Airport {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  tier: 'mega_hub' | 'regional_hub' | 'spoke';
  capacity_per_hour: number;
}

export interface Flight {
  flight_id: string;
  tail_id: string;
  original_tail_id?: string;
  leg_order: number;
  origin: string;
  destination: string;
  dep: string;
  arr: string;
  block_minutes: number;
  pax: number;
  turnaround_before_min: number | null;
  effective_turnaround_required?: number;
  scheduled_turnaround_buffer?: number;
  sched_dep_min: number;
  sched_arr_min: number;
  pred_dep: string;
  pred_arr: string;
  pred_dep_min: number;
  pred_arr_min: number;
  dep_delay: number;
  arr_delay: number;
  delay_minutes: number;
  status: FlightStatus;
  current_phase: FlightPhase;
  progress: number;
  is_holding: boolean;
  holding_minutes: number;
  is_cancelled?: boolean;
  is_diverted?: boolean;
  diversion_airport?: string | null;
  crosses_midnight?: boolean;
  root_cause: string;
  delay_reasons: string[];
  prev_flight_id: string | null;
  next_flight_id: string | null;
  is_spare_recovered: boolean;
  assigned_spare_tail: string | null;
  reposition_mins: number;
  causal_chain?: {
    initiating_event: string;
    initiating_station: string;
    primary_delay: number;
    inherited_delay: number;
    absorbed_buffer: number;
    holding_or_slot_delay: number;
    breadcrumbs: string[];
  };
}

export interface PassengerRebooking {
  rebooked_flight_id: string | null;
  rebooked_dep: string | null;
  rebooked_arr: string | null;
  passenger_delay_minutes: number;
  seat_margin: number;
  is_same_day: boolean;
}

export interface Connection {
  connection_id: string;
  airport: string;
  from_flight: string;
  to_flight: string;
  passengers: number;
  min_connect_minutes: number;
  sched_window_minutes: number;
  pred_window_minutes: number;
  margin_minutes: number;
  is_broken: boolean;
  status: ConnectionStatus;
  rebooking_status?: 'REBOOKED' | 'STRANDED_OVERNIGHT' | null;
  rebooking?: PassengerRebooking | null;
  details: string;
}

export interface CrewAssignment {
  crew_id: string;
  base: string;
  tail_id: string;
  duty_start: string;
  duty_start_min: number;
  max_duty_mins: number;
  last_flight_id: string;
  last_flight_arr: string;
  simulated_duty_minutes: number;
  margin_remaining: number;
  status: CrewStatus;
  is_exceeded: boolean;
  is_warning: boolean;
  crew_swapped?: boolean;
  standby_crew_id?: string | null;
  duty_rest_status?: string;
  flight_ids: string[];
}

export interface SpareAircraft {
  tail_id: string;
  base: string;
  available_from: string;
  seats: number;
  is_deployed: boolean;
  assigned_to: string[];
}

export interface AirportClosure {
  airport_id: string;
  start_minute: number;
  end_minute: number;
  reason: string;
}

export interface SpareDeployment {
  spare_tail: string;
  target_flight_id: string;
  replace_remaining_rotation: boolean;
  assumed_reposition_minutes: number;
  notes?: string;
}

export interface OperationalKPIs {
  total_flights: number;
  on_time_flights: number;
  delayed_flights: number;
  severely_delayed_flights: number;
  recovered_flights: number;
  cancelled_flights?: number;
  diverted_flights?: number;
  total_delay_minutes: number;
  broken_connections: number;
  passengers_at_risk: number;
  rebooked_passengers?: number;
  protected_connections: number;
  crew_violations: number;
  crew_warnings: number;
  crew_swaps?: number;
  available_spares: number;
  on_time_pct?: number;
}

export interface RecoveryPlan {
  plan_id: string;
  name: string;
  strategy_tag: string;
  description: string;
  deployments: SpareDeployment[];
  cancelled_flights: string[];
  total_delay_minutes: number;
  delayed_flights: number;
  cancelled_count: number;
  broken_connections: number;
  stranded_passengers: number;
  rebooked_passengers: number;
  crew_violations: number;
  estimated_cost: number;
  score: number;
  is_feasible: boolean;
  feasibility_notes: string[];
  tradeoffs: {
    pros: string;
    cons: string;
  };
}

export interface ConflictWarning {
  conflict_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  message: string;
  conflicting_actions: string[];
}

export interface SimulationFact {
  metric: string;
  field_name: string;
  value: string | number | boolean | Record<string, unknown> | null;
  unit: string;
  provenance: string;
  confidence: number;
  verified: boolean;
}

export interface ScenarioComparison {
  baseline: OperationalKPIs;
  disrupted: OperationalKPIs;
  recovered: OperationalKPIs;
  delta: {
    delay_minutes_saved: number;
    flights_recovered: number;
    connections_saved: number;
    passengers_saved: number;
    crew_violations_avoided: number;
    is_effective: boolean;
  };
}

export interface AirportRisk {
  airport_id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  tier: 'mega_hub' | 'regional_hub' | 'spoke';
  capacity_per_hour: number;
  total_movements: number;
  delayed_departures: number;
  delayed_arrivals: number;
  broken_connections: number;
  tight_turnarounds: number;
  is_closed: boolean;
  risk_score: number;
  risk_tier: RiskTier;
  risk_factors: {
    closure_impact: number;
    delay_volume_impact: number;
    turnaround_pressure: number;
    connection_exposure: number;
  };
}

export interface RotationRisk {
  tail_id: string;
  total_legs: number;
  max_delay_minutes: number;
  final_destination: string;
  final_arrival: string;
  crew_status: string;
  risk_score: number;
  risk_factors: {
    delay_impact: number;
    cascade_potential: number;
    crew_duty_pressure: number;
  };
}

export interface AIBriefingAlert {
  type: 'FLIGHT_DELAY' | 'MISSED_CONNECTION' | 'CREW_DUTY' | 'AIRPORT_CLOSURE';
  severity: 'WARNING' | 'CRITICAL';
  flight_id?: string;
  connection_id?: string;
  crew_id?: string;
  airport?: string;
  tail_id?: string;
  text: string;
}

export interface AIBriefingRecommendation {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action_type: 'DEPLOY_SPARE' | 'INVESTIGATE_FLIGHT' | 'INSPECT_AIRPORT' | 'VIEW_ROTATION';
  title: string;
  description: string;
  target_flight_id?: string;
  spare_tail?: string;
  airport_id?: string;
  button_label: string;
}

export interface AIBriefing {
  timestamp: string;
  network_situation: string;
  critical_alerts: AIBriefingAlert[];
  root_cause_analysis: string;
  recommended_actions: AIBriefingRecommendation[];
  recovery_summary: {
    recovered_flights_count: number;
    deployments_active: number;
    protected_connections: number;
    summary_text: string;
  };
}

export interface SimulationState {
  meta: {
    current_sim_minute: number;
    current_sim_time: string;
    active_closures_count: number;
    deployments_count: number;
  };
  kpis: OperationalKPIs;
  flights: Record<string, Flight>;
  connections: Connection[];
  crews: CrewAssignment[];
  airport_risks: AirportRisk[];
  rotation_risks: RotationRisk[];
  spare_aircraft: SpareAircraft[];
  closures: AirportClosure[];
  deployments: SpareDeployment[];
  cancelled_flights?: string[];
  scenario_comparison?: ScenarioComparison;
  ai_briefing?: AIBriefing;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  closures: AirportClosure[];
  manual_delays: Record<string, number>;
  default_sim_minute: number;
}

export interface CopilotAction {
  label: string;
  action: 'SELECT_FLIGHT' | 'FILTER_AIRPORT' | 'EVALUATE_SPARE' | 'CONFIRM_DEPLOYMENT' | 'NAVIGATE_PASSENGER_IMPACT' | 'NAVIGATE_RECOVERY' | 'NAVIGATE_DETECTIVE' | 'CANCEL_FLIGHT' | 'VIEW_RISK';
  value?: string;
  spare?: string;
  flight?: string;
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
  suggestedActions?: CopilotAction[];
  dataSummary?: Record<string, any>;
}

export type WorkspaceId =
  | 'command_center'
  | 'radar'
  | 'delay_detective'
  | 'flight_explorer'
  | 'passenger_impact'
  | 'recovery_desk'
  | 'network_intel'
  | 'ai_copilot'
  | 'ai_briefing';
