"""
Pydantic Schemas for DOMINO SKY API
Strict type-safe validation for simulation, recovery, and AI copilot interactions.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class AirportClosureModel(BaseModel):
    airport_id: str
    start_minute: int = Field(..., description="Start minute from midnight (0-1440)")
    end_minute: int = Field(..., description="End minute from midnight (0-1440)")
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

class SpareFeasibilityRequest(BaseModel):
    target_flight_id: str
    spare_tail: str
    assumed_reposition_minutes: int = 0
    current_sim_minute: int = 720
    closures: List[AirportClosureModel] = []
    manual_delays: Dict[str, int] = {}
    deployments: List[SpareDeploymentModel] = []
    cancelled_flights: List[str] = []

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
