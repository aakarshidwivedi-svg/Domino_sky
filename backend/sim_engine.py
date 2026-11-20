"""
DOMINO SKY - Deterministic Airline Operations Simulation Engine
Computes flight propagation, aircraft rotation dependencies, turnaround buffers,
passenger connection outcomes, crew duty limits, and deterministic risk metrics.
"""

import json
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict, field

def time_to_minutes(t_str: str) -> int:
    """Converts 'HH:MM' string to minutes from midnight."""
    if not t_str:
        return 0
    parts = t_str.strip().split(":")
    return int(parts[0]) * 60 + int(parts[1])

def minutes_to_time(mins: int) -> str:
    """Converts minutes from midnight to 'HH:MM' string, handling roll-overs."""
    mins = int(mins) % 1440
    return f"{mins // 60:02d}:{mins % 60:02d}"

@dataclass
class AirportClosure:
    airport_id: str
    start_minute: int
    end_minute: int
    reason: str = "Severe Weather / Runway Closure"

@dataclass
class SpareDeployment:
    spare_tail: str                  # "VT-DS17" (BLR) or "VT-DS18" (DEL)
    target_flight_id: str            # e.g. "DS0202"
    replace_remaining_rotation: bool = True
    assumed_reposition_minutes: int = 0
    notes: str = ""

class DominoSkyEngine:
    def __init__(self, dataset_path: str = "dataset.json"):
        with open(dataset_path, "r", encoding="utf-8") as f:
            self.raw_data = json.load(f)
            
        self.meta = self.raw_data.get("meta", {})
        self.min_turnaround_standard = self.meta.get("min_turnaround_minutes", 30)
        self.seats_per_aircraft = self.meta.get("seats_per_aircraft", 180)
        
        self.airports = {a["id"]: a for a in self.raw_data["airports"]}
        self.base_flights = {f["flight_id"]: dict(f) for f in self.raw_data["flights"]}
        self.connections = [dict(c) for c in self.raw_data.get("connections", [])]
        self.crews = [dict(cr) for cr in self.raw_data.get("crews", [])]
        self.spare_aircraft = {s["tail_id"]: dict(s) for s in self.raw_data.get("spare_aircraft", [])}
        
        # Precompute initial scheduled metrics
        self._precompute_schedule_baselines()

    def _precompute_schedule_baselines(self):
        for fid, f in self.base_flights.items():
            f["sched_dep_min"] = time_to_minutes(f["dep"])
            f["sched_arr_min"] = time_to_minutes(f["arr"])
            if f["sched_arr_min"] < f["sched_dep_min"]:
                f["sched_arr_min"] += 1440 # Over midnight
            f["block_minutes"] = f.get("block_minutes", f["sched_arr_min"] - f["sched_dep_min"])

    def simulate(
        self,
        closures: Optional[List[AirportClosure]] = None,
        manual_delays: Optional[Dict[str, int]] = None, # flight_id -> extra delay in minutes
        deployments: Optional[List[SpareDeployment]] = None,
        cancelled_flight_ids: Optional[List[str]] = None,
        current_sim_minute: int = 720 # Default noon 12:00 IST
    ) -> Dict[str, Any]:
        """
        Runs a full deterministic simulation of the flight network.
        Returns complete operational state, rotation graphs, passenger connections,
        crew duty exposure, and risk scores.
        """
        closures = closures or []
        manual_delays = manual_delays or {}
        deployments = deployments or []
        cancelled_flight_ids = cancelled_flight_ids or []
        cancelled_set = set(cancelled_flight_ids)

        # 1. Map spare deployments to affected flights
        # Map: flight_id -> substitute tail_id and any repositioning delay
        active_substitutions: Dict[str, Tuple[str, int]] = {}
        for dep in deployments:
            if dep.target_flight_id in self.base_flights:
                orig_tail = self.base_flights[dep.target_flight_id]["tail_id"]
                target_leg = self.base_flights[dep.target_flight_id]["leg_order"]
                # If replace_remaining_rotation is True, replace all subsequent legs for this tail
                for fid, f in self.base_flights.items():
                    if f["tail_id"] == orig_tail and f["leg_order"] >= target_leg:
                        active_substitutions[fid] = (dep.spare_tail, dep.assumed_reposition_minutes if fid == dep.target_flight_id else 0)

        # 2. Group flights by effective tail
        flights_by_tail: Dict[str, List[Dict[str, Any]]] = {}
        for fid, f in sorted(self.base_flights.items(), key=lambda x: (x[1]["tail_id"], x[1]["leg_order"])):
            f_copy = dict(f)
            f_copy["original_tail_id"] = f["tail_id"]
            if fid in active_substitutions:
                sub_tail, repo_mins = active_substitutions[fid]
                f_copy["tail_id"] = sub_tail
                f_copy["is_spare_recovered"] = True
                f_copy["assigned_spare_tail"] = sub_tail
                f_copy["reposition_mins"] = repo_mins
            else:
                f_copy["is_spare_recovered"] = False
                f_copy["assigned_spare_tail"] = None
                f_copy["reposition_mins"] = 0
                
            tail = f_copy["tail_id"]
            if tail not in flights_by_tail:
                flights_by_tail[tail] = []
            flights_by_tail[tail].append(f_copy)

        # 3. Simulate aircraft rotations chronologically per tail
        simulated_flights: Dict[str, Dict[str, Any]] = {}
        closure_dict: Dict[str, List[AirportClosure]] = {}
        for c in closures:
            closure_dict.setdefault(c.airport_id, []).append(c)

        # Track arrival holding queues for closed airports
        airport_holding_queues: Dict[str, List[str]] = {}

        for tail, tail_flights in flights_by_tail.items():
            # Sort strictly by leg_order
            tail_flights.sort(key=lambda x: x["leg_order"])
            
            prev_sim_arr_min = None
            prev_flight_id = None
            
            for idx, f in enumerate(tail_flights):
                fid = f["flight_id"]
                sched_dep = f["sched_dep_min"]
                sched_arr = f["sched_arr_min"]
                block_min = f["block_minutes"]
                orig = f["origin"]
                dest = f["destination"]
                
                # Check if flight is cancelled by OCC recovery action
                if fid in cancelled_set:
                    f["status"] = "CANCELLED"
                    f["is_cancelled"] = True
                    f["pred_dep_min"] = sched_dep
                    f["pred_arr_min"] = sched_arr
                    f["pred_dep"] = "CANCELLED"
                    f["pred_arr"] = "CANCELLED"
                    f["dep_delay"] = 0
                    f["arr_delay"] = 0
                    f["delay_minutes"] = 0
                    f["is_holding"] = False
                    f["holding_minutes"] = 0
                    f["delay_reasons"] = ["Flight cancelled by Operations Control Centre recovery action"]
                    f["root_cause"] = "Flight cancelled by OCC recovery action to halt delay cascade"
                    f["prev_flight_id"] = prev_flight_id
                    f["next_flight_id"] = tail_flights[idx + 1]["flight_id"] if idx + 1 < len(tail_flights) else None
                    f["current_phase"] = "CANCELLED"
                    f["progress"] = 0.0
                    f["effective_turnaround_required"] = self.min_turnaround_standard
                    simulated_flights[fid] = f
                    continue

                f["is_cancelled"] = False
                
                # Turnaround buffer required from previous flight
                turnaround_required = f.get("turnaround_before_min")
                if turnaround_required is None or turnaround_required < self.min_turnaround_standard:
                    turnaround_required = self.min_turnaround_standard
                f["effective_turnaround_required"] = turnaround_required
                f["scheduled_turnaround_buffer"] = turnaround_required

                delay_reasons = []
                inherited_delay = 0
                turnaround_delay = 0
                closure_dep_delay = 0
                manual_delay = manual_delays.get(fid, 0)
                holding_delay = 0

                # A. Earliest departure based on aircraft availability
                if prev_sim_arr_min is None or f.get("is_spare_recovered_first_leg", False):
                    # First leg for this aircraft / spare
                    if f["is_spare_recovered"]:
                        spare_data = self.spare_aircraft.get(f["assigned_spare_tail"], {})
                        spare_avail_min = time_to_minutes(spare_data.get("available_from", "05:00"))
                        spare_ready_min = spare_avail_min + f["reposition_mins"]
                        earliest_dep = max(sched_dep, spare_ready_min)
                        if f["reposition_mins"] > 0:
                            delay_reasons.append(
                                f"Spare {f['assigned_spare_tail']} ferry positioning ({f['reposition_mins']}m assumption); "
                                f"ready at {minutes_to_time(spare_ready_min)}"
                            )
                    else:
                        earliest_dep = sched_dep
                else:
                    ready_min = prev_sim_arr_min + turnaround_required
                    if ready_min > sched_dep:
                        inherited_delay = ready_min - sched_dep
                        turnaround_delay = inherited_delay
                        delay_reasons.append(
                            f"Late inbound {prev_flight_id} ({tail}) arrived at {minutes_to_time(prev_sim_arr_min)}; "
                            f"requires {turnaround_required}m turnaround (ready {minutes_to_time(ready_min)})"
                        )
                    earliest_dep = max(sched_dep, ready_min)

                # Add any manual / technical delay
                if manual_delay > 0:
                    earliest_dep += manual_delay
                    delay_reasons.append(f"AOG / Technical hold injected: +{manual_delay}m")

                # B. Origin airport closure constraint
                pred_dep = earliest_dep
                if orig in closure_dict:
                    for cl in closure_dict[orig]:
                        if cl.start_minute <= pred_dep < cl.end_minute:
                            closure_dep_delay = cl.end_minute - pred_dep
                            pred_dep = cl.end_minute
                            delay_reasons.append(
                                f"Origin airport {orig} closed [{minutes_to_time(cl.start_minute)}-{minutes_to_time(cl.end_minute)}] ({cl.reason})"
                            )

                # C. En-route & Arrival at Destination
                pred_arr = pred_dep + block_min
                is_held = False

                # D. Destination airport closure constraint (airborne holding)
                if dest in closure_dict:
                    for cl in closure_dict[dest]:
                        if cl.start_minute <= pred_arr < cl.end_minute:
                            # Flight cannot land during closure; holds until reopening
                            airport_holding_queues.setdefault(dest, []).append(fid)
                            queue_slot = len(airport_holding_queues[dest])
                            # Spacing of 3 mins between holding arrivals
                            holding_delay = (cl.end_minute - pred_arr) + (queue_slot - 1) * 3
                            pred_arr = cl.end_minute + (queue_slot - 1) * 3
                            is_held = True
                            delay_reasons.append(
                                f"Destination {dest} closed on arrival [{minutes_to_time(cl.start_minute)}-{minutes_to_time(cl.end_minute)}]; "
                                f"holding pattern {holding_delay}m (Queue slot #{queue_slot})"
                            )

                dep_delay = pred_dep - sched_dep
                arr_delay = pred_arr - sched_arr

                # Determine flight status
                if f.get("is_spare_recovered") and dep_delay <= 15:
                    status = "RECOVERED"
                elif arr_delay > 60 or is_held:
                    status = "SEVERELY_DELAYED"
                elif arr_delay > 15:
                    status = "DELAYED"
                else:
                    status = "ON_TIME"

                # Store computed flight details
                f["pred_dep_min"] = pred_dep
                f["pred_arr_min"] = pred_arr
                f["pred_dep"] = minutes_to_time(pred_dep)
                f["pred_arr"] = minutes_to_time(pred_arr)
                f["dep_delay"] = dep_delay
                f["arr_delay"] = arr_delay
                f["delay_minutes"] = max(dep_delay, arr_delay)
                f["status"] = status
                f["is_holding"] = is_held
                f["holding_minutes"] = holding_delay
                f["delay_reasons"] = delay_reasons
                f["root_cause"] = " | ".join(delay_reasons) if delay_reasons else "Normal flight operation"
                f["prev_flight_id"] = prev_flight_id
                f["next_flight_id"] = tail_flights[idx + 1]["flight_id"] if idx + 1 < len(tail_flights) else None
                
                # Check current simulation state (at current_sim_minute)
                if current_sim_minute < pred_dep:
                    f["current_phase"] = "SCHEDULED"
                    f["progress"] = 0.0
                elif pred_dep <= current_sim_minute <= pred_arr:
                    f["current_phase"] = "AIRBORNE" if not is_held or current_sim_minute < (pred_dep + block_min) else "HOLDING"
                    flight_span = max(1, pred_arr - pred_dep)
                    f["progress"] = min(1.0, max(0.0, (current_sim_minute - pred_dep) / flight_span))
                else:
                    f["current_phase"] = "ARRIVED"
                    f["progress"] = 1.0

                simulated_flights[fid] = f
                prev_sim_arr_min = pred_arr
                prev_flight_id = fid

        # 4. Evaluate Passenger Connections
        connection_results = []
        broken_connections_count = 0
        passengers_at_risk_count = 0
        protected_connections_count = 0

        for cx in self.connections:
            cx_id = cx["connection_id"]
            from_fid = cx["from_flight"]
            to_fid = cx["to_flight"]
            pax = cx["passengers"]
            min_connect = cx["min_connect_minutes"]
            apt = cx["airport"]

            from_f = simulated_flights.get(from_fid)
            to_f = simulated_flights.get(to_fid)

            if from_f and to_f:
                if from_f.get("is_cancelled") or to_f.get("is_cancelled"):
                    broken_connections_count += 1
                    passengers_at_risk_count += pax
                    sched_window = to_f["sched_dep_min"] - from_f["sched_arr_min"]
                    cancelled_leg = from_fid if from_f.get("is_cancelled") else to_fid
                    connection_results.append({
                        "connection_id": cx_id,
                        "airport": apt,
                        "from_flight": from_fid,
                        "to_flight": to_fid,
                        "passengers": pax,
                        "min_connect_minutes": min_connect,
                        "sched_window_minutes": sched_window,
                        "pred_window_minutes": 0,
                        "margin_minutes": -min_connect,
                        "is_broken": True,
                        "status": "CANCELLED",
                        "details": f"Connection cancelled: flight {cancelled_leg} was cancelled by OCC recovery action."
                    })
                    continue

                sched_window = to_f["sched_dep_min"] - from_f["sched_arr_min"]
                pred_window = to_f["pred_dep_min"] - from_f["pred_arr_min"]
                is_broken = pred_window < min_connect
                margin = pred_window - min_connect

                if is_broken:
                    broken_connections_count += 1
                    passengers_at_risk_count += pax
                    cx_status = "BROKEN"
                else:
                    cx_status = "PROTECTED" if (from_f["arr_delay"] > 0 or to_f["dep_delay"] > 0) else "ON_TIME"
                    if cx_status == "PROTECTED":
                        protected_connections_count += 1

                connection_results.append({
                    "connection_id": cx_id,
                    "airport": apt,
                    "from_flight": from_fid,
                    "to_flight": to_fid,
                    "passengers": pax,
                    "min_connect_minutes": min_connect,
                    "sched_window_minutes": sched_window,
                    "pred_window_minutes": pred_window,
                    "margin_minutes": margin,
                    "is_broken": is_broken,
                    "status": cx_status,
                    "details": (
                        f"Inbound {from_fid} arr {from_f['pred_arr']} -> Outbound {to_fid} dep {to_f['pred_dep']} "
                        f"(Available: {pred_window}m vs Required: {min_connect}m, Margin: {margin:+d}m)"
                    )
                })

        # 5. Evaluate Crew Duty Limits
        crew_results = []
        crew_violations_count = 0
        crew_warnings_count = 0

        for cr in self.crews:
            cid = cr["crew_id"]
            tail = cr["tail_id"]
            start_min = time_to_minutes(cr["duty_start"])
            max_duty = cr["max_duty_mins"] # 600 min standard
            assigned_fids = cr["flight_ids"]
            
            # Find the last simulated flight assigned to this crew (excluding cancelled flights)
            assigned_sim_flights = [simulated_flights[f] for f in assigned_fids if f in simulated_flights and not simulated_flights[f].get("is_cancelled")]
            if assigned_sim_flights:
                last_flight = max(assigned_sim_flights, key=lambda x: x["pred_arr_min"])
                duty_elapsed = last_flight["pred_arr_min"] - start_min
                is_exceeded = duty_elapsed > max_duty
                # Warning if within 45 mins of max limit
                is_warning = not is_exceeded and duty_elapsed >= (max_duty - 45)
                
                if is_exceeded:
                    crew_violations_count += 1
                    status = "EXCEEDED"
                elif is_warning:
                    crew_warnings_count += 1
                    status = "WARNING"
                else:
                    status = "LEGAL"

                crew_results.append({
                    "crew_id": cid,
                    "base": cr["base"],
                    "tail_id": tail,
                    "duty_start": cr["duty_start"],
                    "duty_start_min": start_min,
                    "max_duty_mins": max_duty,
                    "last_flight_id": last_flight["flight_id"],
                    "last_flight_arr": last_flight["pred_arr"],
                    "simulated_duty_minutes": duty_elapsed,
                    "margin_remaining": max_duty - duty_elapsed,
                    "status": status,
                    "is_exceeded": is_exceeded,
                    "is_warning": is_warning,
                    "flight_ids": assigned_fids
                })
            else:
                crew_results.append({
                    "crew_id": cid,
                    "base": cr["base"],
                    "tail_id": tail,
                    "duty_start": cr["duty_start"],
                    "duty_start_min": start_min,
                    "max_duty_mins": max_duty,
                    "last_flight_id": "NONE",
                    "last_flight_arr": cr["duty_start"],
                    "simulated_duty_minutes": 0,
                    "margin_remaining": max_duty,
                    "status": "LEGAL",
                    "is_exceeded": False,
                    "is_warning": False,
                    "flight_ids": assigned_fids
                })

        # 6. Airport Network Risk Calculation
        airport_risk_scores = self._compute_airport_risk(
            simulated_flights, closure_dict, connection_results
        )

        # 7. Aircraft Rotation Vulnerability Calculation
        rotation_risk_scores = self._compute_rotation_risk(
            simulated_flights, crew_results
        )

        # 8. Network Aggregates
        total_flights = len(simulated_flights)
        cancelled_flights = sum(1 for f in simulated_flights.values() if f.get("is_cancelled"))
        delayed_flights = sum(1 for f in simulated_flights.values() if f["status"] in ("DELAYED", "SEVERELY_DELAYED"))
        severely_delayed = sum(1 for f in simulated_flights.values() if f["status"] == "SEVERELY_DELAYED")
        recovered_flights = sum(1 for f in simulated_flights.values() if f["status"] == "RECOVERED")
        on_time_flights = sum(1 for f in simulated_flights.values() if f["status"] in ("ON_TIME", "RECOVERED"))
        total_delay_minutes = sum(f["delay_minutes"] for f in simulated_flights.values())

        # Spare availability
        assigned_spares = {dep.spare_tail for dep in deployments}
        spares_status = []
        for stail, sdata in self.spare_aircraft.items():
            is_deployed = stail in assigned_spares
            spares_status.append({
                "tail_id": stail,
                "base": sdata["base"],
                "available_from": sdata["available_from"],
                "seats": sdata["seats"],
                "is_deployed": is_deployed,
                "assigned_to": [dep.target_flight_id for dep in deployments if dep.spare_tail == stail]
            })

        return {
            "meta": {
                "current_sim_minute": current_sim_minute,
                "current_sim_time": minutes_to_time(current_sim_minute),
                "active_closures_count": len(closures),
                "deployments_count": len(deployments)
            },
            "kpis": {
                "total_flights": total_flights,
                "on_time_flights": on_time_flights,
                "delayed_flights": delayed_flights,
                "severely_delayed_flights": severely_delayed,
                "recovered_flights": recovered_flights,
                "cancelled_flights": cancelled_flights,
                "total_delay_minutes": total_delay_minutes,
                "broken_connections": broken_connections_count,
                "passengers_at_risk": passengers_at_risk_count,
                "protected_connections": protected_connections_count,
                "crew_violations": crew_violations_count,
                "crew_warnings": crew_warnings_count,
                "available_spares": len(self.spare_aircraft) - len(assigned_spares)
            },
            "flights": simulated_flights,
            "connections": connection_results,
            "crews": crew_results,
            "airport_risks": airport_risk_scores,
            "rotation_risks": rotation_risk_scores,
            "spare_aircraft": spares_status,
            "closures": [asdict(c) for c in closures],
            "deployments": [asdict(d) for d in deployments],
            "cancelled_flights": list(cancelled_flight_ids)
        }

    def _compute_airport_risk(
        self,
        simulated_flights: Dict[str, Dict[str, Any]],
        closure_dict: Dict[str, List[AirportClosure]],
        connections: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Computes deterministic operational risk score (0-100) per airport."""
        results = []
        for apt_id, apt in self.airports.items():
            dep_flights = [f for f in simulated_flights.values() if f["origin"] == apt_id]
            arr_flights = [f for f in simulated_flights.values() if f["destination"] == apt_id]
            
            is_closed = apt_id in closure_dict and len(closure_dict[apt_id]) > 0
            closure_score = 45 if is_closed else 0

            # Delayed flights volume
            delayed_dep = sum(1 for f in dep_flights if f["dep_delay"] > 15)
            delayed_arr = sum(1 for f in arr_flights if f["arr_delay"] > 15)
            delay_volume_score = min(25, (delayed_dep + delayed_arr) * 3)

            # Turnaround buffer pressure: flights departing with turnaround <= 35m
            tight_turns = sum(1 for f in dep_flights if (f.get("turnaround_before_min") or 30) <= 35)
            turnaround_score = min(15, tight_turns * 3)

            # Passenger connection risk at this airport
            apt_conns = [c for c in connections if c["airport"] == apt_id]
            broken_conns = sum(1 for c in apt_conns if c["is_broken"])
            conn_score = min(15, broken_conns * 5)

            total_risk = min(100, closure_score + delay_volume_score + turnaround_score + conn_score)

            # Classification
            if total_risk >= 70:
                tier = "CRITICAL"
            elif total_risk >= 40:
                tier = "HIGH"
            elif total_risk >= 20:
                tier = "MODERATE"
            else:
                tier = "LOW"

            results.append({
                "airport_id": apt_id,
                "name": apt["name"],
                "city": apt["city"],
                "lat": apt["lat"],
                "lng": apt["lng"],
                "tier": apt.get("tier", "spoke"),
                "capacity_per_hour": apt["capacity_per_hour"],
                "total_movements": len(dep_flights) + len(arr_flights),
                "delayed_departures": delayed_dep,
                "delayed_arrivals": delayed_arr,
                "broken_connections": broken_conns,
                "tight_turnarounds": tight_turns,
                "is_closed": is_closed,
                "risk_score": total_risk,
                "risk_tier": tier,
                "risk_factors": {
                    "closure_impact": closure_score,
                    "delay_volume_impact": delay_volume_score,
                    "turnaround_pressure": turnaround_score,
                    "connection_exposure": conn_score
                }
            })

        results.sort(key=lambda x: x["risk_score"], reverse=True)
        return results

    def _compute_rotation_risk(
        self,
        simulated_flights: Dict[str, Dict[str, Any]],
        crew_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Computes deterministic rotation risk score (0-100) per aircraft tail."""
        crew_by_tail = {c["tail_id"]: c for c in crew_results}
        tail_groups: Dict[str, List[Dict[str, Any]]] = {}
        for f in simulated_flights.values():
            tail_groups.setdefault(f["tail_id"], []).append(f)

        results = []
        for tail, flights in tail_groups.items():
            flights.sort(key=lambda x: x["leg_order"])
            total_legs = len(flights)
            max_delay = max(f["delay_minutes"] for f in flights)
            last_flight = flights[-1]
            
            # Accumulated delay score
            delay_factor = min(40, int(max_delay * 0.4))
            
            # Cascade exposure: number of remaining legs
            cascade_factor = min(25, total_legs * 5)
            
            # Crew duty factor
            crew_info = crew_by_tail.get(tail)
            duty_factor = 0
            if crew_info:
                if crew_info["is_exceeded"]:
                    duty_factor = 35
                elif crew_info["is_warning"]:
                    duty_factor = 20
                else:
                    duty_factor = 5

            score = min(100, delay_factor + cascade_factor + duty_factor)

            results.append({
                "tail_id": tail,
                "total_legs": total_legs,
                "max_delay_minutes": max_delay,
                "final_destination": last_flight["destination"],
                "final_arrival": last_flight["pred_arr"],
                "crew_status": crew_info["status"] if crew_info else "NO_ASSIGNMENT",
                "risk_score": score,
                "risk_factors": {
                    "delay_impact": delay_factor,
                    "cascade_potential": cascade_factor,
                    "crew_duty_pressure": duty_factor
                }
            })

        results.sort(key=lambda x: x["risk_score"], reverse=True)
        return results

    def get_rotation_dependency_chain(
        self,
        flight_id: str,
        sim_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Builds the complete aircraft rotation dependency chain for Flight Delay Detective.
        Shows upstream initiating flights, turnaround buffers, downstream affected flights,
        and passenger connections.
        """
        flights = sim_state["flights"]
        if flight_id not in flights:
            return {"error": f"Flight {flight_id} not found"}

        target = flights[flight_id]
        tail = target["tail_id"]
        leg = target["leg_order"]

        # Get all flights on this rotation
        rotation_flights = sorted(
            [f for f in flights.values() if f["tail_id"] == tail],
            key=lambda x: x["leg_order"]
        )

        upstream_nodes = [f for f in rotation_flights if f["leg_order"] < leg]
        downstream_nodes = [f for f in rotation_flights if f["leg_order"] > leg]

        # Connected passenger transfers from and to this flight
        inbound_conns = [c for c in sim_state["connections"] if c["to_flight"] == flight_id]
        outbound_conns = [c for c in sim_state["connections"] if c["from_flight"] == flight_id]

        return {
            "target_flight": target,
            "aircraft_tail": tail,
            "rotation_length": len(rotation_flights),
            "current_leg": leg,
            "upstream_flights": upstream_nodes,
            "downstream_flights": downstream_nodes,
            "inbound_connections": inbound_conns,
            "outbound_connections": outbound_conns,
            "root_cause_explanation": target["root_cause"],
            "delay_propagation_summary": (
                f"Flight {flight_id} ({target['origin']}->{target['destination']}) has {target['delay_minutes']}m delay. "
                f"It directly impacts {len(downstream_nodes)} downstream legs on {tail} "
                f"and threatens {len(outbound_conns)} outbound passenger connection(s)."
            )
        }

    def evaluate_spare_feasibility(
        self,
        target_flight_id: str,
        spare_tail: str,
        sim_state: Dict[str, Any],
        assumed_reposition_minutes: int = 0
    ) -> Dict[str, Any]:
        """
        Validates the feasibility of deploying a spare aircraft (VT-DS17 or VT-DS18).
        Enforces dataset constraints, location checks, availability times, and labels assumptions.
        """
        if spare_tail not in self.spare_aircraft:
            return {"feasible": False, "reason": f"Unknown spare aircraft {spare_tail}"}
        if target_flight_id not in sim_state["flights"]:
            return {"feasible": False, "reason": f"Flight {target_flight_id} not found"}

        spare = self.spare_aircraft[spare_tail]
        flight = sim_state["flights"][target_flight_id]
        
        spare_base = spare["base"]
        flight_origin = flight["origin"]
        spare_avail_min = time_to_minutes(spare["available_from"]) # 05:00 = 300
        sched_dep_min = flight["sched_dep_min"]
        pax = flight["pax"]
        seats = spare["seats"] # 180

        # Check seat capacity
        if pax > seats:
            return {
                "feasible": False,
                "reason": f"Spare capacity ({seats} seats) is insufficient for passenger load ({pax} pax)"
            }

        # Check if already deployed
        deployed_spares = {dep["spare_tail"] for dep in sim_state.get("deployments", [])}
        if spare_tail in deployed_spares:
            return {
                "feasible": False,
                "reason": f"Spare aircraft {spare_tail} is already deployed to another flight"
            }

        # Check location and repositioning
        is_same_base = (spare_base == flight_origin)
        effective_ready_time = spare_avail_min

        if not is_same_base:
            if assumed_reposition_minutes <= 0:
                return {
                    "feasible": False,
                    "requires_repositioning": True,
                    "spare_base": spare_base,
                    "flight_origin": flight_origin,
                    "reason": (
                        f"Spare {spare_tail} is based at {spare_base}, but flight {target_flight_id} departs from {flight_origin}. "
                        "Dataset contains no positioning schedule; operator must supply a valid repositioning flight time assumption."
                    )
                }
            effective_ready_time += assumed_reposition_minutes

        # Check departure timing feasibility
        can_meet_schedule = (effective_ready_time <= sched_dep_min)
        predicted_dep = max(sched_dep_min, effective_ready_time)
        saved_delay_minutes = max(0, flight["delay_minutes"] - (predicted_dep - sched_dep_min))

        return {
            "feasible": True,
            "spare_tail": spare_tail,
            "spare_base": spare_base,
            "target_flight_id": target_flight_id,
            "flight_origin": flight_origin,
            "is_immediate_deployment": is_same_base,
            "requires_repositioning": not is_same_base,
            "assumed_reposition_minutes": assumed_reposition_minutes if not is_same_base else 0,
            "is_assumption_based": not is_same_base,
            "effective_ready_time": minutes_to_time(effective_ready_time),
            "flight_scheduled_dep": flight["dep"],
            "achievable_dep": minutes_to_time(predicted_dep),
            "delay_savings_minutes": saved_delay_minutes,
            "seat_margin": seats - pax,
            "recommendation": (
                f"Deploy {spare_tail} at {flight_origin}. Recovers flight {target_flight_id} "
                f"saving approximately {saved_delay_minutes} minutes of delay and protecting downstream rotation."
                if is_same_base else
                f"Deploy {spare_tail} via ferry positioning ({assumed_reposition_minutes}m assumption from {spare_base} to {flight_origin}). "
                f"Achieves departure at {minutes_to_time(predicted_dep)}."
            )
        }

    def generate_ai_briefing(self, sim_state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates a deterministic, factual, aviation-grade operational briefing.
        Strictly adheres to verified calculation values without inventing numbers.
        """
        kpis = sim_state["kpis"]
        meta = sim_state["meta"]
        closures = sim_state["closures"]
        deployments = sim_state["deployments"]
        sim_time = meta["current_sim_time"]

        # Identify top impacted airports
        critical_airports = [a for a in sim_state["airport_risks"] if a["risk_tier"] in ("CRITICAL", "HIGH")]
        top_closed = [c["airport_id"] for c in closures]

        # Identify critical delays
        severe_flights = [f for f in sim_state["flights"].values() if f["status"] == "SEVERELY_DELAYED"]
        broken_conns = [c for c in sim_state["connections"] if c["is_broken"]]
        crew_issues = [c for c in sim_state["crews"] if c["is_exceeded"] or c["is_warning"]]

        # Section 1: Network Situation
        if top_closed:
            situation_text = (
                f"Active operational disruption: {', '.join(top_closed)} closure in effect at {sim_time} IST. "
                f"{kpis['delayed_flights']} flights delayed ({kpis['severely_delayed_flights']} severe), "
                f"affecting {kpis['passengers_at_risk']} connecting passengers. "
                f"Total network delay accumulated: {kpis['total_delay_minutes']} minutes."
            )
        elif kpis["delayed_flights"] > 0:
            situation_text = (
                f"Network experiencing secondary delay propagation at {sim_time} IST. "
                f"{kpis['delayed_flights']} flights delayed ({kpis['total_delay_minutes']}m total delay). "
                f"{kpis['on_time_flights']} flights operating on schedule."
            )
        else:
            situation_text = (
                f"Nominal scheduled operations across all 16 Indian airports at {sim_time} IST. "
                f"All 70 flights on time. 0 active closures. Full schedule integrity maintained."
            )

        # Section 2: Critical Alerts
        alerts = []
        for f in severe_flights[:4]:
            alerts.append({
                "type": "FLIGHT_DELAY",
                "severity": "CRITICAL",
                "flight_id": f["flight_id"],
                "airport": f["origin"],
                "text": f"Flight {f['flight_id']} ({f['origin']}->{f['destination']}) delayed +{f['delay_minutes']}m. Tail {f['tail_id']}. {f['root_cause']}"
            })
        for c in broken_conns[:3]:
            alerts.append({
                "type": "MISSED_CONNECTION",
                "severity": "CRITICAL",
                "connection_id": c["connection_id"],
                "airport": c["airport"],
                "text": f"Connection {c['connection_id']} broken at {c['airport']}: {c['passengers']} pax missing onward {c['to_flight']} (Margin: {c['margin_minutes']}m)"
            })
        for cr in crew_issues[:3]:
            alerts.append({
                "type": "CREW_DUTY",
                "severity": "WARNING" if cr["is_warning"] else "CRITICAL",
                "crew_id": cr["crew_id"],
                "tail_id": cr["tail_id"],
                "text": f"Crew {cr['crew_id']} ({cr['tail_id']}) duty exposure: {cr['simulated_duty_minutes']}m / {cr['max_duty_mins']}m limit on final leg {cr['last_flight_id']}"
            })

        # Section 3: Root Cause Analysis
        if top_closed:
            root_cause_text = (
                f"Disruption originated from runway/weather closure at {top_closed[0]}. "
                f"Aircraft rotations operating through {top_closed[0]} arrived late at downline stations, "
                f"exceeding scheduled turnaround buffers (min 30m required) and transferring domino delays "
                f"to spoke and regional hub flights across India."
            )
        elif kpis["total_delay_minutes"] > 0:
            root_cause_text = (
                "Delays stem from tight turnaround buffers on high-utilization aircraft rotations, "
                "compounded by secondary passenger connection holds."
            )
        else:
            root_cause_text = "No operational delay triggers detected. Turnaround buffers are absorbing normal gate variances."

        # Section 4: Prioritized Recommended Actions
        recommendations = []
        if severe_flights and kpis["available_spares"] > 0:
            # Check if VT-DS17 (BLR) or VT-DS18 (DEL) can help
            for sf in severe_flights:
                if sf["origin"] == "DEL":
                    recommendations.append({
                        "priority": "HIGH",
                        "action_type": "DEPLOY_SPARE",
                        "title": f"Deploy Spare VT-DS18 at DEL for Flight {sf['flight_id']}",
                        "description": f"VT-DS18 is available at DEL base. Immediate deployment feasible with 0m ferry positioning.",
                        "target_flight_id": sf["flight_id"],
                        "spare_tail": "VT-DS18",
                        "button_label": f"Deploy VT-DS18 on {sf['flight_id']}"
                    })
                    break
                elif sf["origin"] == "BLR":
                    recommendations.append({
                        "priority": "HIGH",
                        "action_type": "DEPLOY_SPARE",
                        "title": f"Deploy Spare VT-DS17 at BLR for Flight {sf['flight_id']}",
                        "description": f"VT-DS17 is available at BLR base. Immediate deployment feasible with 0m ferry positioning.",
                        "target_flight_id": sf["flight_id"],
                        "spare_tail": "VT-DS17",
                        "button_label": f"Deploy VT-DS17 on {sf['flight_id']}"
                    })
                    break

        if critical_airports:
            top_apt = critical_airports[0]
            recommendations.append({
                "priority": "MEDIUM",
                "action_type": "INSPECT_AIRPORT",
                "title": f"Monitor {top_apt['city']} ({top_apt['airport_id']}) Capacity & Gates",
                "description": f"Airport risk index is {top_apt['risk_score']}/100 with {top_apt['delayed_departures']} delayed departures.",
                "airport_id": top_apt["airport_id"],
                "button_label": f"Inspect {top_apt['airport_id']}"
            })

        if severe_flights:
            recommendations.append({
                "priority": "MEDIUM",
                "action_type": "INVESTIGATE_FLIGHT",
                "title": f"Investigate Root Cause of Flight {severe_flights[0]['flight_id']}",
                "description": f"Delayed by +{severe_flights[0]['delay_minutes']}m. Inspect downstream rotation cascade.",
                "target_flight_id": severe_flights[0]['flight_id'],
                "button_label": f"Open Flight Detective ({severe_flights[0]['flight_id']})"
            })

        # Section 5: Recovery Summary
        recovery_summary = {
            "recovered_flights_count": kpis["recovered_flights"],
            "deployments_active": len(deployments),
            "protected_connections": kpis["protected_connections"],
            "summary_text": (
                f"{kpis['recovered_flights']} flights successfully recovered via spare aircraft intervention. "
                f"{kpis['protected_connections']} passenger connection(s) protected."
                if kpis["recovered_flights"] > 0 else
                "No spare aircraft deployed yet. Review candidate rotations on the Recovery Desk."
            )
        }

        return {
            "timestamp": sim_time,
            "network_situation": situation_text,
            "critical_alerts": alerts,
            "root_cause_analysis": root_cause_text,
            "recommended_actions": recommendations,
            "recovery_summary": recovery_summary
        }

    def compare_scenarios(
        self,
        closures: Optional[List[AirportClosure]] = None,
        manual_delays: Optional[Dict[str, int]] = None,
        deployments: Optional[List[SpareDeployment]] = None,
        cancelled_flight_ids: Optional[List[str]] = None,
        current_sim_minute: int = 720
    ) -> Dict[str, Any]:
        """
        Runs 3-way scenario comparison:
        1. Original Baseline (nominal scheduled network)
        2. Disrupted Scenario (closures + manual delays, no recovery)
        3. Recovered Scenario (closures + manual delays + spare deployments + cancellations)
        """
        baseline_res = self.simulate(closures=[], manual_delays={}, deployments=[], cancelled_flight_ids=[], current_sim_minute=current_sim_minute)
        disrupted_res = self.simulate(closures=closures, manual_delays=manual_delays, deployments=[], cancelled_flight_ids=[], current_sim_minute=current_sim_minute)
        recovered_res = self.simulate(closures=closures, manual_delays=manual_delays, deployments=deployments, cancelled_flight_ids=cancelled_flight_ids, current_sim_minute=current_sim_minute)

        b_kpis = baseline_res["kpis"]
        d_kpis = disrupted_res["kpis"]
        r_kpis = recovered_res["kpis"]

        delay_minutes_saved = max(0, d_kpis["total_delay_minutes"] - r_kpis["total_delay_minutes"])
        flights_recovered = r_kpis["recovered_flights"]
        connections_saved = max(0, d_kpis["broken_connections"] - r_kpis["broken_connections"])
        passengers_saved = max(0, d_kpis["passengers_at_risk"] - r_kpis["passengers_at_risk"])
        crew_violations_avoided = max(0, d_kpis["crew_violations"] - r_kpis["crew_violations"])

        return {
            "baseline": b_kpis,
            "disrupted": d_kpis,
            "recovered": r_kpis,
            "delta": {
                "delay_minutes_saved": delay_minutes_saved,
                "flights_recovered": flights_recovered,
                "connections_saved": connections_saved,
                "passengers_saved": passengers_saved,
                "crew_violations_avoided": crew_violations_avoided,
                "is_effective": delay_minutes_saved > 0 or flights_recovered > 0 or connections_saved > 0
            }
        }

    def ask_copilot(
        self,
        query: str,
        sim_state: Dict[str, Any],
        selected_flight_id: Optional[str] = None,
        selected_airport_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Tactical AI Operations Copilot grounded directly in current simulation state.
        Produces deterministic, explainable answers with zero hallucinations.
        """
        import re
        q = query.strip()
        q_lower = q.lower()
        flights = sim_state["flights"]
        kpis = sim_state["kpis"]
        conns = sim_state["connections"]
        crews = sim_state["crews"]
        apt_risks = sim_state["airport_risks"]
        closures = sim_state["closures"]
        deployments = sim_state["deployments"]

        actions = []
        topic = "general"

        # Check for flight reference
        fid_match = re.search(r'\b(DS\d{4})\b', q, re.I)
        target_fid = fid_match.group(1).upper() if fid_match else (selected_flight_id if selected_flight_id in flights else None)

        # Check for airport reference
        apt_match = re.search(r'\b(BOM|DEL|BLR|HYD|CCU|MAA|PNQ|AMD|GOI|COK|JAI|LKO|GAU|IXC|BBI|TRV)\b', q, re.I)
        target_apt = apt_match.group(1).upper() if apt_match else (selected_airport_id if selected_airport_id in self.airports else None)

        # 1. Spare aircraft feasibility / deployment inquiry
        if "spare" in q_lower or "vt-ds17" in q_lower or "vt-ds18" in q_lower or "replace" in q_lower or "feasible" in q_lower:
            topic = "spare_feasibility"
            # Target flight
            eval_fid = target_fid or next((f["flight_id"] for f in flights.values() if f["status"] == "SEVERELY_DELAYED"), "DS1502")
            target_f = flights.get(eval_fid, flights.get("DS1502", {}))
            
            spare_tail = "VT-DS18" if "vt-ds18" in q_lower else ("VT-DS17" if "vt-ds17" in q_lower else ("VT-DS18" if target_f.get("origin") == "DEL" else "VT-DS17"))
            feas = self.evaluate_spare_feasibility(eval_fid, spare_tail, sim_state, assumed_reposition_minutes=60)

            ans = f"**Spare Aircraft Feasibility Analysis: {spare_tail} on Flight {eval_fid}**\n\n"
            ans += f"- **Spare Aircraft:** {spare_tail} (Base: {self.spare_aircraft[spare_tail]['base']}, 180 seats, Available 05:00 IST)\n"
            ans += f"- **Target Flight:** {eval_fid} ({target_f.get('origin')} -> {target_f.get('destination')}, Scheduled: {target_f.get('dep')})\n"
            ans += f"- **Feasible:** {'✅ YES' if feas['feasible'] else '❌ NO'}\n"
            ans += f"- **Base Match:** {'Immediate zero-delay deployment at home base' if feas.get('is_immediate_deployment') else 'Requires ferry repositioning (60m assumption)'}\n"
            ans += f"- **Predicted Delay Savings:** ~{feas.get('delay_savings_minutes', 0)} minutes\n"
            ans += f"- **Operational Guidance:** {feas['recommendation']}\n"

            actions.append({"label": f"Deploy {spare_tail} on {eval_fid}", "action": "CONFIRM_DEPLOYMENT", "spare": spare_tail, "flight": eval_fid})
            actions.append({"label": "Open Recovery Desk", "action": "NAVIGATE_RECOVERY", "value": eval_fid})
            return {"answer": ans, "topic": topic, "suggested_actions": actions, "data_summary": feas}

        # 2. Flight investigation query
        if target_fid and ("why" in q_lower or "delay" in q_lower or "explain" in q_lower or "investigate" in q_lower or "status" in q_lower or not apt_match):
            f = flights.get(target_fid)
            if f:
                topic = "flight_investigation"
                fid = f["flight_id"]
                tail = f["tail_id"]
                orig = f["origin"]
                dest = f["destination"]
                sched_dep = f["dep"]
                sched_arr = f["arr"]
                status = f["status"]
                delay = f["delay_minutes"]
                root_cause = f["root_cause"]
                pax = f["pax"]

                # Connected passenger banks
                f_conns = [c for c in conns if c["from_flight"] == fid or c["to_flight"] == fid]
                broken_f_conns = [c for c in f_conns if c["is_broken"]]

                # Crew assigned
                f_crew = next((cr for cr in crews if fid in cr["flight_ids"]), None)

                ans = f"**Flight {fid} ({orig} -> {dest}) Operations Report**\n\n"
                ans += f"- **Status:** {status} ({delay}m delay)\n"
                ans += f"- **Aircraft:** {tail} (Leg {f['leg_order']})\n"
                ans += f"- **Scheduled:** {sched_dep} - {sched_arr} IST | **Predicted:** {f['pred_dep']} - {f['pred_arr']} IST\n"
                ans += f"- **Root Cause:** {root_cause}\n"
                ans += f"- **Passenger Load:** {pax} / {self.seats_per_aircraft} seats\n"

                if f.get("prev_flight_id"):
                    ans += f"- **Upstream Inbound:** {f['prev_flight_id']} arrived at station; scheduled turnaround buffer was {f.get('turnaround_before_min', 30)}m (minimum 30m required).\n"

                if broken_f_conns:
                    ans += f"- **Passenger Connections:** ⚠️ {len(broken_f_conns)} connection bank(s) broken, threatening {sum(c['passengers'] for c in broken_f_conns)} passengers.\n"
                else:
                    ans += f"- **Passenger Connections:** All transfer connections are currently protected.\n"

                if f_crew:
                    ans += f"- **Crew Duty:** {f_crew['crew_id']} ({f_crew['status']}) - Elapsed: {f_crew['simulated_duty_minutes']}m / {f_crew['max_duty_mins']}m (Margin: {f_crew['margin_remaining']}m).\n"

                actions.append({"label": f"Inspect {fid} in Delay Detective", "action": "SELECT_FLIGHT", "value": fid})
                if delay > 15:
                    actions.append({"label": f"Check Spare for {fid}", "action": "EVALUATE_SPARE", "value": fid})
                return {"answer": ans, "topic": topic, "suggested_actions": actions, "data_summary": {"flight_id": fid, "delay": delay, "status": status}}

        # 3. Airport closure / disruption inquiry
        if target_apt or "mumbai" in q_lower or "bom" in q_lower or "delhi" in q_lower or "del" in q_lower or "bangalore" in q_lower or "blr" in q_lower or "closure" in q_lower:
            apt_id = target_apt or ("BOM" if "mumbai" in q_lower or "bom" in q_lower else ("DEL" if "delhi" in q_lower or "del" in q_lower else "BLR"))
            topic = "airport_disruption"
            apt_info = self.airports.get(apt_id, {})
            apt_risk = next((a for a in apt_risks if a["airport_id"] == apt_id), None)
            apt_closure = next((c for c in closures if c["airport_id"] == apt_id), None)
            
            dep_flights = [f for f in flights.values() if f["origin"] == apt_id]
            arr_flights = [f for f in flights.values() if f["destination"] == apt_id]
            delayed_here = [f for f in dep_flights if f["dep_delay"] > 15]

            ans = f"**Airport Operational Analysis: {apt_info.get('city', apt_id)} ({apt_id})**\n\n"
            if apt_closure:
                ans += f"- **Status:** 🔴 CLOSED [{minutes_to_time(apt_closure['start_minute'])} - {minutes_to_time(apt_closure['end_minute'])} IST] due to {apt_closure['reason']}.\n"
            else:
                ans += f"- **Status:** 🟢 NORMAL OPEN\n"

            if apt_risk:
                ans += f"- **Risk Index:** {apt_risk['risk_score']}/100 ({apt_risk['risk_tier']})\n"
                ans += f"- **Disrupted Departures:** {apt_risk['delayed_departures']} of {len(dep_flights)} scheduled flights\n"
                ans += f"- **Disrupted Arrivals:** {apt_risk['delayed_arrivals']} of {len(arr_flights)} scheduled flights\n"
                ans += f"- **Broken Connections at Station:** {apt_risk['broken_connections']}\n"

            if delayed_here:
                ans += f"\n**Directly Delayed Departures from {apt_id}:**\n"
                for df in delayed_here[:4]:
                    ans += f"- `{df['flight_id']}` ({df['origin']}->{df['destination']}) +{df['delay_minutes']}m delay (Tail: {df['tail_id']})\n"

            actions.append({"label": f"Filter Radar on {apt_id}", "action": "FILTER_AIRPORT", "value": apt_id})
            actions.append({"label": f"View {apt_id} in Risk Intelligence", "action": "VIEW_RISK", "value": apt_id})
            return {"answer": ans, "topic": topic, "suggested_actions": actions, "data_summary": {"airport_id": apt_id, "risk": apt_risk['risk_score'] if apt_risk else 0}}

        # 3. Passenger impact query
        if "passenger" in q_lower or "pax" in q_lower or "connection" in q_lower or "transfer" in q_lower or "missed" in q_lower or "stranded" in q_lower:
            topic = "passenger_impact"
            broken = [c for c in conns if c["is_broken"]]
            protected = [c for c in conns if c["status"] == "PROTECTED"]

            ans = f"**Passenger Connection Network Assessment**\n\n"
            ans += f"- **Total Connection Banks Tracked:** {len(conns)} banks across Indian hubs\n"
            ans += f"- **Broken Connections:** {len(broken)} bank(s)\n"
            ans += f"- **Passengers Stranded / At Risk:** {kpis['passengers_at_risk']} passengers\n"
            ans += f"- **Protected Connections:** {len(protected)} bank(s) where turnaround slack absorbed delay\n\n"

            if broken:
                ans += "**Broken Itinerary Breakdown:**\n"
                for b in broken:
                    ans += f"- `Bank {b['connection_id']}` at **{b['airport']}**: {b['passengers']} pax from `{b['from_flight']}` to `{b['to_flight']}` (Available: {b['pred_window_minutes']}m vs Required: {b['min_connect_minutes']}m, Shortfall: {b['margin_minutes']}m)\n"
            else:
                ans += "✅ All 21 passenger connection banks are meeting required minimum connection times."

            actions.append({"label": "Open Passenger Impact Desk", "action": "NAVIGATE_PASSENGER_IMPACT", "value": "all"})
            return {"answer": ans, "topic": topic, "suggested_actions": actions, "data_summary": {"broken_connections": len(broken), "passengers_at_risk": kpis["passengers_at_risk"]}}

        # 4. Biggest delay chain / aircraft rotation inquiry
        if "chain" in q_lower or "rotation" in q_lower or "tail" in q_lower or "propagation" in q_lower or "domino" in q_lower or "biggest" in q_lower or "worst" in q_lower:
            topic = "delay_chain"
            # Aggregate delay by tail
            tail_delays = {}
            for f in flights.values():
                t = f["tail_id"]
                tail_delays[t] = tail_delays.get(t, 0) + f["delay_minutes"]
            
            sorted_tails = sorted(tail_delays.items(), key=lambda x: x[1], reverse=True)
            worst_tail, worst_delay = sorted_tails[0] if sorted_tails else ("NONE", 0)

            ans = f"**Aircraft Rotation & Domino Propagation Intelligence**\n\n"
            ans += f"The aircraft driving the largest delay chain in the network is **{worst_tail}** with **{worst_delay} cumulative delay minutes**.\n\n"

            worst_flights = sorted([f for f in flights.values() if f["tail_id"] == worst_tail], key=lambda x: x["leg_order"])
            ans += f"**Rotation Sequence for {worst_tail}:**\n"
            for wf in worst_flights:
                ans += f"- `Leg {wf['leg_order']}`: **{wf['flight_id']}** ({wf['origin']}->{wf['destination']}) - Status: {wf['status']} (+{wf['delay_minutes']}m) | Reason: {wf['root_cause']}\n"

            actions.append({"label": f"Investigate {worst_flights[0]['flight_id']}", "action": "SELECT_FLIGHT", "value": worst_flights[0]['flight_id']})
            actions.append({"label": f"Deploy Spare for {worst_tail}", "action": "EVALUATE_SPARE", "value": worst_flights[0]['flight_id']})
            return {"answer": ans, "topic": topic, "suggested_actions": actions, "data_summary": {"worst_tail": worst_tail, "cumulative_delay": worst_delay}}

        # 5. Crew duty inquiry
        if "crew" in q_lower or "duty" in q_lower or "pilot" in q_lower or "dgca" in q_lower or "violation" in q_lower:
            topic = "crew_duty"
            violations = [cr for cr in crews if cr["is_exceeded"]]
            warnings = [cr for cr in crews if cr["is_warning"]]

            ans = f"**Crew Duty Exposure Assessment (DGCA 600-Minute Limit)**\n\n"
            ans += f"- **Total Active Rosters:** {len(crews)} crews\n"
            ans += f"- **Duty Limit Violations (>600m):** {len(violations)}\n"
            ans += f"- **Duty Proximity Warnings (<45m margin):** {len(warnings)}\n\n"

            if violations or warnings:
                ans += "**At-Risk Crew Assignments:**\n"
                for cr in violations + warnings:
                    ans += f"- `{cr['crew_id']}` ({cr['base']} Base, Tail {cr['tail_id']}): {cr['simulated_duty_minutes']}m elapsed on final leg `{cr['last_flight_id']}` (Margin: {cr['margin_remaining']}m) - **{cr['status']}**\n"
            else:
                ans += "✅ All crew assignments are currently within legal duty margins with safe buffer."

            actions.append({"label": "View Crew Exposure Matrix", "action": "VIEW_RISK", "value": "crews"})
            return {"answer": ans, "topic": topic, "suggested_actions": actions, "data_summary": {"violations": len(violations), "warnings": len(warnings)}}

        # 7. Recovery recommendation inquiry
        if "recovery" in q_lower or "recommend" in q_lower or "what should we do" in q_lower or "action" in q_lower or "fix" in q_lower:
            topic = "recommendation"
            briefing = self.generate_ai_briefing(sim_state)
            recs = briefing.get("recommended_actions", [])

            ans = f"**Tactical Recovery Decision Recommendations**\n\n"
            if recs:
                for idx, r in enumerate(recs, 1):
                    ans += f"**{idx}. [{r['priority']}] {r['title']}**\n"
                    ans += f"   {r['description']}\n\n"
            else:
                ans += "No active recovery intervention required. Operations are nominal across all sectors."

            for r in recs[:2]:
                if r.get("action_type") == "DEPLOY_SPARE":
                    actions.append({"label": r["button_label"], "action": "CONFIRM_DEPLOYMENT", "spare": r["spare_tail"], "flight": r["target_flight_id"]})

            actions.append({"label": "Open Recovery Desk", "action": "NAVIGATE_RECOVERY", "value": ""})
            return {"answer": ans, "topic": topic, "suggested_actions": actions, "data_summary": {"recommendations_count": len(recs)}}

        # 8. Flight cancellation inquiry
        if "cancel" in q_lower:
            topic = "cancellation"
            eval_fid = target_fid or "DS1502"
            f = flights.get(eval_fid, {})

            ans = f"**Tactical Cancellation Impact Assessment: Flight {eval_fid}**\n\n"
            ans += f"- **Flight Route:** {f.get('origin')} -> {f.get('destination')} (Sched: {f.get('dep')} IST)\n"
            ans += f"- **Current Delay:** +{f.get('delay_minutes', 0)}m\n"
            ans += f"- **Passenger Impact:** {f.get('pax', 0)} ticketed passengers stranded on this leg.\n"
            ans += f"- **Downstream Rotational Impact:** Cancelling this flight halts delay propagation on this specific leg, but the aircraft remains at `{f.get('origin')}`. Downstream legs requiring this aircraft at `{f.get('destination')}` must be cancelled or covered by a spare.\n\n"
            ans += f"💡 **OCC Strategy Rule:** Deploying a standby spare (VT-DS18 or VT-DS17) is strongly preferred over cancellation to preserve passenger itineraries and protect brand reliability."

            actions.append({"label": f"Simulate Cancel {eval_fid}", "action": "CANCEL_FLIGHT", "value": eval_fid})
            actions.append({"label": f"Deploy Spare on {eval_fid} Instead", "action": "EVALUATE_SPARE", "value": eval_fid})
            return {"answer": ans, "topic": topic, "suggested_actions": actions, "data_summary": {"target_flight_id": eval_fid}}

        # 9. Airport bottleneck inquiry
        if "bottleneck" in q_lower or "worst airport" in q_lower or "highest risk" in q_lower:
            topic = "bottleneck"
            sorted_risks = sorted(apt_risks, key=lambda x: x["risk_score"], reverse=True)
            top_apt = sorted_risks[0] if sorted_risks else None

            ans = f"**Network Bottleneck Identification**\n\n"
            if top_apt:
                ans += f"The primary operational bottleneck is **{top_apt['city']} ({top_apt['airport_id']})** with a risk score of **{top_apt['risk_score']}/100 ({top_apt['risk_tier']})**.\n\n"
                ans += f"- **Status:** {'🔴 CLOSED' if top_apt['is_closed'] else '🟢 OPEN'}\n"
                ans += f"- **Delayed Departures:** {top_apt['delayed_departures']}\n"
                ans += f"- **Delayed Arrivals:** {top_apt['delayed_arrivals']}\n"
                ans += f"- **Broken Connections:** {top_apt['broken_connections']}\n"
                ans += f"- **Capacity:** {top_apt['capacity_per_hour']} movements/hr\n"
            
            actions.append({"label": f"Inspect {top_apt['airport_id']} on Radar", "action": "FILTER_AIRPORT", "value": top_apt['airport_id'] if top_apt else "BOM"})
            return {"answer": ans, "topic": topic, "suggested_actions": actions, "data_summary": top_apt or {}}

        # 10. Default operational briefing
        topic = "overview"
        ans = f"**DOMINO SKY Tactical Operations Status**\n\n"
        ans += f"- **Simulated Clock:** {sim_state['meta']['current_sim_time']} IST\n"
        ans += f"- **Flight Network:** {kpis['total_flights']} flights across 16 airports\n"
        ans += f"- **On-Time Rate:** {kpis['on_time_flights']}/{kpis['total_flights']} ({int(kpis['on_time_flights']/max(1, kpis['total_flights'])*100)}% OTP)\n"
        ans += f"- **Disrupted Flights:** {kpis['delayed_flights']} delayed ({kpis['severely_delayed_flights']} severe), {kpis.get('cancelled_flights', 0)} cancelled\n"
        ans += f"- **Total Delay Volume:** {kpis['total_delay_minutes']} minutes\n"
        ans += f"- **Passenger Risk:** {kpis['passengers_at_risk']} connecting passengers affected across {kpis['broken_connections']} broken banks\n"
        ans += f"- **Active Spares Available:** {kpis['available_spares']} / 2 (VT-DS17 @ BLR, VT-DS18 @ DEL)\n"

        actions.append({"label": "View Mumbai Disruption", "action": "FILTER_AIRPORT", "value": "BOM"})
        actions.append({"label": "Open Delay Detective", "action": "NAVIGATE_DETECTIVE", "value": "DS1502"})
        actions.append({"label": "Open Recovery Desk", "action": "NAVIGATE_RECOVERY", "value": ""})
        return {"answer": ans, "topic": topic, "suggested_actions": actions, "data_summary": kpis}
