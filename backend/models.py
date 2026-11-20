"""
Pydantic Schemas for DOMINO SKY API
Strict type-safe validation for simulation, recovery, multi-objective optimization,
conflict detection, and AI copilot interactions.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class AirportClosureModel(BaseModel):
    airport_id: str
    start_minute: int = Field(..., description="Start minute from midnight (0-1440 or >1440 for midnight wrap)")
    end_minute: int = Field(..., description="End minute from midnight (0-1440 or >1440 for midnight wrap)")
    reason: str = "Airport Closure"

class SpareDeploymentModel(BaseModel):
    spare_tail: str
    target_flight_id: str
    replace_remaining_rotation: bool = True
    assumed_reposition_minutes: int = 0
    notes: Optional[str] = ""

class SimulationRequest(BaseModel):
    closures: List[AirportClosureModel] = []
    manual_delays: Dict[str, int] = {}
    deployments: List[SpareDeploymentModel] = []
    cancelled_flights: List[str] = []
    current_sim_minute: int = 720 # 12:00 IST default
    enforce_runway_capacity: bool = True
    max_holding_fuel_minutes: int = 45 # Domestic A320 diversion threshold

class SpareFeasibilityRequest(BaseModel):
    target_flight_id: str
    spare_tail: str
    assumed_reposition_minutes: int = 0
    current_sim_minute: int = 720
    closures: List[AirportClosureModel] = []
    manual_delays: Dict[str, int] = {}
    deployments: List[SpareDeploymentModel] = []
    cancelled_flights: List[str] = []

class SimulationFactModel(BaseModel):
    metric: str
    field_name: str
    value: Any
    unit: str
    provenance: str
    confidence: float = 1.0
    verified: bool = True

class CopilotRequest(BaseModel):
    query: str
    current_sim_minute: int = 720
    selected_flight_id: Optional[str] = None
    selected_airport_id: Optional[str] = None
    closures: List[AirportClosureModel] = []
    manual_delays: Dict[str, int] = {}
    deployments: List[SpareDeploymentModel] = []
    cancelled_flights: List[str] = []

class ComparisonRequest(BaseModel):
    closures: List[AirportClosureModel] = []
    manual_delays: Dict[str, int] = {}
    deployments: List[SpareDeploymentModel] = []
    cancelled_flights: List[str] = []
    current_sim_minute: int = 720

class ConflictCheckRequest(BaseModel):
    deployments: List[SpareDeploymentModel] = []
    cancelled_flights: List[str] = []
    closures: List[AirportClosureModel] = []

class RecoveryOptimizationRequest(BaseModel):
    closures: List[AirportClosureModel] = []
    manual_delays: Dict[str, int] = {}
    current_sim_minute: int = 720
    cost_delay_per_min: float = 75.0
    cost_cancellation: float = 12000.0
    cost_broken_pax: float = 250.0
    cost_spare_deployment: float = 4000.0
    cost_ferry_per_min: float = 50.0
    cost_crew_violation: float = 5000.0
    allow_repositioning: bool = True
    max_cancellations: int = 3

class RecoveryPlanModel(BaseModel):
    plan_id: str
    name: str
    strategy_tag: str
    description: str
    deployments: List[SpareDeploymentModel]
    cancelled_flights: List[str]
    total_delay_minutes: int
    delayed_flights: int
    cancelled_count: int
    broken_connections: int
    stranded_passengers: int
    rebooked_passengers: int
    crew_violations: int
    estimated_cost: float
    score: float # 0 - 100 overall composite score
    is_feasible: bool
    feasibility_notes: List[str] = []
    tradeoffs: Dict[str, str] = {}
