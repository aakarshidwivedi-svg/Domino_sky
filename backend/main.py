"""
FastAPI Server for DOMINO SKY - Airline Operations Control Centre
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List

try:
    from backend.sim_engine import DominoSkyEngine, AirportClosure, SpareDeployment, time_to_minutes, minutes_to_time
    from backend.models import (
        SimulationRequest, SpareFeasibilityRequest, AirportClosureModel,
        SpareDeploymentModel, CopilotRequest, ComparisonRequest
    )
except ImportError:
    from sim_engine import DominoSkyEngine, AirportClosure, SpareDeployment, time_to_minutes, minutes_to_time
    from models import (
        SimulationRequest, SpareFeasibilityRequest, AirportClosureModel,
        SpareDeploymentModel, CopilotRequest, ComparisonRequest
    )

app = FastAPI(
    title="DOMINO SKY API",
    description="Deterministic Aviation Operations & Disruption Simulator",
    version="2.0.0"
)

# Enable CORS for frontend Vite development & local hosting
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize simulation engine
dataset_path = os.path.join(os.path.dirname(__file__), "..", "dataset.json")
if not os.path.exists(dataset_path):
    dataset_path = "dataset.json"

engine = DominoSkyEngine(dataset_path=dataset_path)

@app.get("/api/health")
def health_check():
    return {
        "status": "ONLINE",
        "service": "DOMINO SKY OCC Backend",
        "airports_count": len(engine.airports),
        "flights_count": len(engine.base_flights),
        "crews_count": len(engine.crews),
        "connections_count": len(engine.connections),
        "spares_count": len(engine.spare_aircraft)
    }

@app.get("/api/airports")
def get_airports():
    return list(engine.airports.values())

@app.get("/api/spares")
def get_spares():
    return list(engine.spare_aircraft.values())

@app.get("/api/scenarios/presets")
def get_scenario_presets():
    return [
        {
            "id": "baseline",
            "name": "Normal Scheduled Operations",
            "description": "Baseline Indian domestic flight network with all 70 flights on schedule, 0 closures, and full rotation buffers intact.",
            "closures": [],
            "manual_delays": {},
            "default_sim_minute": 360 # 06:00 IST
        },
        {
            "id": "bom_thunderstorm",
            "name": "Mumbai (BOM) Monsoon Storm Closure",
            "description": "Chhatrapati Shivaji Maharaj Intl (BOM) closed 08:30–10:00 (90 mins). Demonstrates severe delay cascade along VT-DS02, VT-DS04, VT-DS07, and broken connections.",
            "closures": [
                {
                    "airport_id": "BOM",
                    "start_minute": time_to_minutes("08:30"),
                    "end_minute": time_to_minutes("10:00"),
                    "reason": "Severe Monsoon Thunderstorm / Waterlogging"
                }
            ],
            "manual_delays": {},
            "default_sim_minute": 540 # 09:00 IST
        },
        {
            "id": "del_winter_fog",
            "name": "Delhi (DEL) Dense Winter Fog CAT III",
            "description": "Indira Gandhi Intl (DEL) closed 07:00–09:30 (150 mins) due to zero RVR visibility. Cascades delay across Northern and Central rotations.",
            "closures": [
                {
                    "airport_id": "DEL",
                    "start_minute": time_to_minutes("07:00"),
                    "end_minute": time_to_minutes("09:30"),
                    "reason": "Dense Radiation Fog / CAT III Holding"
                }
            ],
            "manual_delays": {},
            "default_sim_minute": 480 # 08:00 IST
        },
        {
            "id": "blr_afternoon_squall",
            "name": "Bengaluru (BLR) Convective Squall Line",
            "description": "Kempegowda Intl (BLR) closed 13:00–14:30 (90 mins). Disrupts southern connector flights, threatening 5 passenger connection banks.",
            "closures": [
                {
                    "airport_id": "BLR",
                    "start_minute": time_to_minutes("13:00"),
                    "end_minute": time_to_minutes("14:30"),
                    "reason": "Microburst & Lightning Squall"
                }
            ],
            "manual_delays": {},
            "default_sim_minute": 810 # 13:30 IST
        },
        {
            "id": "aog_technical",
            "name": "VT-DS04 Technical AOG at BOM",
            "description": "Aircraft VT-DS04 incurs a 90-minute hydraulic system maintenance hold on flight DS0401 (07:45 dep). Triggers 5-leg cascade through GOI, PNQ, and AMD.",
            "closures": [],
            "manual_delays": {
                "DS0401": 90
            },
            "default_sim_minute": 510 # 08:30 IST
        }
    ]

@app.post("/api/simulate")
def run_simulation(req: SimulationRequest):
    closures = [
        AirportClosure(
            airport_id=c.airport_id,
            start_minute=c.start_minute,
            end_minute=c.end_minute,
            reason=c.reason
        )
        for c in req.closures
    ]
    deployments = [
        SpareDeployment(
            spare_tail=d.spare_tail,
            target_flight_id=d.target_flight_id,
            replace_remaining_rotation=d.replace_remaining_rotation,
            assumed_reposition_minutes=d.assumed_reposition_minutes,
            notes=d.notes or ""
        )
        for d in req.deployments
    ]

    sim_res = engine.simulate(
        closures=closures,
        manual_delays=req.manual_delays,
        deployments=deployments,
        cancelled_flight_ids=req.cancelled_flights,
        current_sim_minute=req.current_sim_minute
    )

    # Attach AI briefing
    sim_res["ai_briefing"] = engine.generate_ai_briefing(sim_res)

    return sim_res

@app.get("/api/flights/{flight_id}/detective")
def get_flight_detective(flight_id: str, sim_minute: int = 720):
    sim_res = engine.simulate(current_sim_minute=sim_minute)
    chain = engine.get_rotation_dependency_chain(flight_id, sim_res)
    if "error" in chain:
        raise HTTPException(status_code=404, detail=chain["error"])
    return chain

@app.post("/api/spares/evaluate")
def evaluate_spare(req: SpareFeasibilityRequest):
    closures = [
        AirportClosure(airport_id=c.airport_id, start_minute=c.start_minute, end_minute=c.end_minute, reason=c.reason)
        for c in req.closures
    ]
    deployments = [
        SpareDeployment(spare_tail=d.spare_tail, target_flight_id=d.target_flight_id, replace_remaining_rotation=d.replace_remaining_rotation, assumed_reposition_minutes=d.assumed_reposition_minutes, notes=d.notes or "")
        for d in req.deployments
    ]
    sim_res = engine.simulate(
        closures=closures,
        manual_delays=req.manual_delays,
        deployments=deployments,
        cancelled_flight_ids=req.cancelled_flights,
        current_sim_minute=req.current_sim_minute
    )
    result = engine.evaluate_spare_feasibility(
        target_flight_id=req.target_flight_id,
        spare_tail=req.spare_tail,
        sim_state=sim_res,
        assumed_reposition_minutes=req.assumed_reposition_minutes
    )
    return result

@app.post("/api/copilot")
def ask_copilot(req: CopilotRequest):
    closures = [
        AirportClosure(airport_id=c.airport_id, start_minute=c.start_minute, end_minute=c.end_minute, reason=c.reason)
        for c in req.closures
    ]
    deployments = [
        SpareDeployment(spare_tail=d.spare_tail, target_flight_id=d.target_flight_id, replace_remaining_rotation=d.replace_remaining_rotation, assumed_reposition_minutes=d.assumed_reposition_minutes, notes=d.notes or "")
        for d in req.deployments
    ]
    sim_res = engine.simulate(
        closures=closures,
        manual_delays=req.manual_delays,
        deployments=deployments,
        cancelled_flight_ids=req.cancelled_flights,
        current_sim_minute=req.current_sim_minute
    )
    return engine.ask_copilot(
        query=req.query,
        sim_state=sim_res,
        selected_flight_id=req.selected_flight_id,
        selected_airport_id=req.selected_airport_id
    )

@app.post("/api/scenarios/compare")
def compare_scenarios(req: ComparisonRequest):
    closures = [
        AirportClosure(airport_id=c.airport_id, start_minute=c.start_minute, end_minute=c.end_minute, reason=c.reason)
        for c in req.closures
    ]
    deployments = [
        SpareDeployment(spare_tail=d.spare_tail, target_flight_id=d.target_flight_id, replace_remaining_rotation=d.replace_remaining_rotation, assumed_reposition_minutes=d.assumed_reposition_minutes, notes=d.notes or "")
        for d in req.deployments
    ]
    return engine.compare_scenarios(
        closures=closures,
        manual_delays=req.manual_delays,
        deployments=deployments,
        cancelled_flight_ids=req.cancelled_flights,
        current_sim_minute=req.current_sim_minute
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
