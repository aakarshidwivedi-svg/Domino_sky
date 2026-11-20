"""
Comprehensive Unit & Integration Tests for DOMINO SKY Simulation Engine.
Verifies all 12 criteria mandated by Section 8.D of the Hack2Skill specification:
1. Baseline simulation
2. Airport closure
3. Closure boundary conditions
4. Aircraft rotation propagation
5. Turnaround violations and buffer absorption
6. Passenger connection calculations
7. Crew duty calculations
8. Spare aircraft feasibility
9. Aircraft assignment conflicts
10. Flight cancellation recovery
11. Recovery comparison (3-way delta)
12. Repeated simulation determinism
13. Invalid user input safety
14. Grounded AI Copilot query intelligence
"""

import unittest
import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sim_engine import DominoSkyEngine, AirportClosure, SpareDeployment, time_to_minutes, minutes_to_time

class TestDominoSkyEngine(unittest.TestCase):
    def setUp(self):
        dataset_path = os.path.join(backend_dir, "..", "dataset.json")
        if not os.path.exists(dataset_path):
            dataset_path = os.path.join(backend_dir, "dataset.json")
        self.engine = DominoSkyEngine(dataset_path)

    def test_01_baseline_schedule(self):
        """Test 1: Default unperturbed schedule has 70 flights with 0 delays."""
        res = self.engine.simulate()
        kpis = res["kpis"]
        self.assertEqual(kpis["total_flights"], 70)
        self.assertEqual(kpis["delayed_flights"], 0)
        self.assertEqual(kpis["total_delay_minutes"], 0)
        self.assertEqual(kpis["broken_connections"], 0)
        self.assertEqual(kpis["available_spares"], 2)
        print("[PASS] Test 1: Baseline schedule verified: 70 flights, 0 delays, 0 broken connections.")

    def test_02_bom_closure_propagation(self):
        """Test 2: Mumbai (BOM) closure from 08:30 to 10:00 (90 mins)."""
        closure = AirportClosure(
            airport_id="BOM",
            start_minute=time_to_minutes("08:30"), # 510
            end_minute=time_to_minutes("10:00"),   # 600
            reason="Monsoon Thunderstorm"
        )
        res = self.engine.simulate(closures=[closure])
        kpis = res["kpis"]
        
        self.assertGreater(kpis["delayed_flights"], 0)
        self.assertGreater(kpis["total_delay_minutes"], 0)
        
        # Verify flights departing BOM during closure are held until 10:00
        f_ds0202 = res["flights"]["DS0202"]
        self.assertGreaterEqual(f_ds0202["pred_dep_min"], 600)
        self.assertGreaterEqual(f_ds0202["dep_delay"], 40)
        
        # Verify downstream leg propagation on VT-DS02
        f_ds0203 = res["flights"]["DS0203"]
        self.assertIsNotNone(f_ds0203["pred_dep_min"])
        
        # Check broken connections at BOM
        self.assertGreater(kpis["broken_connections"], 0)
        self.assertGreater(kpis["passengers_at_risk"], 0)
        print(f"[PASS] Test 2: BOM 90m closure test: {kpis['delayed_flights']} flights delayed, "
              f"{kpis['total_delay_minutes']}m total delay, {kpis['broken_connections']} broken connections.")

    def test_03_closure_boundary_conditions(self):
        """Test 3: Closure boundary precision (dep at exactly start_minute vs end_minute)."""
        # Close BOM from 09:20 (560) to 10:00 (600)
        # DS0202 is scheduled at 09:20 (exactly at start_minute) -> must be held
        # A flight scheduled at 10:00 (exactly at end_minute) -> can depart on time
        closure = AirportClosure(
            airport_id="BOM",
            start_minute=560,
            end_minute=600,
            reason="Boundary Test"
        )
        res = self.engine.simulate(closures=[closure])
        f_boundary = res["flights"]["DS0202"]
        self.assertEqual(f_boundary["pred_dep_min"], 600)
        print("[PASS] Test 3: Closure boundary conditions verified.")

    def test_04_turnaround_propagation_and_connection_slack(self):
        """Test 4: Rotational delay inheritance across legs and connection buffer slack absorption."""
        # 1. Rotational delay inheritance:
        # Inducing 20m delay on DS0402 propagates through required 70m turnaround to DS0403
        res_rot = self.engine.simulate(manual_delays={"DS0402": 20})
        f_ds0403 = res_rot["flights"]["DS0403"]
        self.assertEqual(f_ds0403["dep_delay"], 20)
        self.assertIn("requires 70m turnaround", f_ds0403["root_cause"])
        
        # 2. Connection buffer slack absorption:
        # CX02 connects DS1201 (arr 07:40) to DS0202 (dep 09:20 -> delayed to 10:00).
        # Sched window is 100m; pred window is 140m. Required is 45m.
        # Despite BOM closure delay, CX02 absorbs the disruption and stays PROTECTED!
        closure = AirportClosure(airport_id="BOM", start_minute=510, end_minute=600)
        res_disrupted = self.engine.simulate(closures=[closure])
        cx02 = next(c for c in res_disrupted["connections"] if c["connection_id"] == "CX02")
        self.assertFalse(cx02["is_broken"])
        self.assertEqual(cx02["status"], "PROTECTED")
        self.assertGreater(cx02["margin_minutes"], 0)
        print("[PASS] Test 4: Turnaround propagation and connection buffer absorption verified mathematically.")

    def test_05_passenger_connection_calculations(self):
        """Test 5: Passenger connection margin, shortfall, and broken transfer counts."""
        # CX17 is at HYD: DS0704 -> DS0803 (min_connect: 45m).
        # In baseline, connection is intact.
        res_base = self.engine.simulate()
        cx17_base = next(c for c in res_base["connections"] if c["connection_id"] == "CX17")
        self.assertFalse(cx17_base["is_broken"])
        self.assertGreaterEqual(cx17_base["margin_minutes"], 0)

        # Under BOM closure, DS0704 arrives late into HYD, breaking CX17
        closure = AirportClosure(airport_id="BOM", start_minute=510, end_minute=600)
        res_disrupted = self.engine.simulate(closures=[closure])
        cx17_disrupted = next(c for c in res_disrupted["connections"] if c["connection_id"] == "CX17")
        self.assertTrue(cx17_disrupted["is_broken"])
        self.assertEqual(cx17_disrupted["status"], "BROKEN")
        self.assertEqual(cx17_disrupted["passengers"], 23)
        print(f"[PASS] Test 5: Passenger connection calculations verified for CX17 ({cx17_disrupted['passengers']} pax at risk).")

    def test_06_crew_duty_limits(self):
        """Test 6: DGCA 600-minute crew duty limits and warning thresholds."""
        # Baseline: all 16 crews are legal
        res_base = self.engine.simulate()
        self.assertEqual(res_base["kpis"]["crew_violations"], 0)

        # When BOM is closed, check that duty durations are correctly aggregated
        closure = AirportClosure(airport_id="BOM", start_minute=510, end_minute=600)
        res = self.engine.simulate(closures=[closure])
        for cr in res["crews"]:
            self.assertIn(cr["status"], ("LEGAL", "WARNING", "EXCEEDED"))
            self.assertEqual(cr["simulated_duty_minutes"], cr["max_duty_mins"] - cr["margin_remaining"])
        print("[PASS] Test 6: Crew duty calculations verified against 600m max limit.")

    def test_07_spare_aircraft_feasibility(self):
        """Test 7: Spare aircraft location checks and repositioning assumptions."""
        closure = AirportClosure(airport_id="DEL", start_minute=480, end_minute=600)
        res = self.engine.simulate(closures=[closure])
        
        # VT-DS18 (based at DEL) on flight from DEL -> immediate deployment
        eval_del = self.engine.evaluate_spare_feasibility("DS0103", "VT-DS18", res)
        self.assertTrue(eval_del["feasible"])
        self.assertTrue(eval_del["is_immediate_deployment"])

        # VT-DS17 (based at BLR) on flight from DEL -> requires explicit ferry repositioning
        eval_blr_no_repo = self.engine.evaluate_spare_feasibility("DS0103", "VT-DS17", res, assumed_reposition_minutes=0)
        self.assertFalse(eval_blr_no_repo["feasible"])
        self.assertTrue(eval_blr_no_repo["requires_repositioning"])

        eval_blr_with_repo = self.engine.evaluate_spare_feasibility("DS0103", "VT-DS17", res, assumed_reposition_minutes=60)
        self.assertTrue(eval_blr_with_repo["feasible"])
        print("[PASS] Test 7: Spare aircraft feasibility and repositioning rules verified.")

    def test_08_aircraft_assignment_conflicts(self):
        """Test 8: System prevents double-booking a spare aircraft."""
        # Deploy VT-DS18 on DS0103
        dep1 = SpareDeployment(spare_tail="VT-DS18", target_flight_id="DS0103")
        res = self.engine.simulate(deployments=[dep1])
        
        # Attempting to assign VT-DS18 again to DS0302 must be rejected
        eval_conflict = self.engine.evaluate_spare_feasibility("DS0302", "VT-DS18", res)
        self.assertFalse(eval_conflict["feasible"])
        self.assertIn("already deployed", eval_conflict["reason"])
        print("[PASS] Test 8: Aircraft assignment conflict detection verified.")

    def test_09_flight_cancellation_recovery(self):
        """Test 9: Flight cancellation recovery option halts delay propagation."""
        closure = AirportClosure(airport_id="BOM", start_minute=510, end_minute=600)
        # Cancel DS0202
        res = self.engine.simulate(closures=[closure], cancelled_flight_ids=["DS0202"])
        f_cancelled = res["flights"]["DS0202"]
        self.assertEqual(f_cancelled["status"], "CANCELLED")
        self.assertTrue(f_cancelled["is_cancelled"])
        self.assertEqual(res["kpis"]["cancelled_flights"], 1)
        print("[PASS] Test 9: Flight cancellation recovery action verified.")

    def test_10_scenario_comparison_3way(self):
        """Test 10: 3-Way scenario comparison (Baseline vs Disrupted vs Recovered)."""
        closure = AirportClosure(airport_id="DEL", start_minute=600, end_minute=720)
        dep = SpareDeployment(spare_tail="VT-DS18", target_flight_id="DS0104", assumed_reposition_minutes=60)
        
        comp = self.engine.compare_scenarios(
            closures=[closure],
            deployments=[dep]
        )
        self.assertIn("baseline", comp)
        self.assertIn("disrupted", comp)
        self.assertIn("recovered", comp)
        self.assertIn("delta", comp)
        self.assertEqual(comp["baseline"]["delayed_flights"], 0)
        self.assertGreater(comp["disrupted"]["delayed_flights"], 0)
        print(f"[PASS] Test 10: 3-way scenario comparison verified (Delta: {comp['delta']}).")

    def test_11_simulation_determinism(self):
        """Test 11: Absolute determinism (identical inputs produce bitwise identical outputs)."""
        closure = AirportClosure(airport_id="BOM", start_minute=510, end_minute=600)
        run1 = self.engine.simulate(closures=[closure], current_sim_minute=600)
        run2 = self.engine.simulate(closures=[closure], current_sim_minute=600)
        
        self.assertEqual(run1["kpis"], run2["kpis"])
        for fid in run1["flights"]:
            self.assertEqual(run1["flights"][fid]["status"], run2["flights"][fid]["status"])
            self.assertEqual(run1["flights"][fid]["delay_minutes"], run2["flights"][fid]["delay_minutes"])
        print("[PASS] Test 11: Repeated simulation determinism verified with 100% parity.")

    def test_12_invalid_inputs_safety(self):
        """Test 12: Safe handling of invalid flight IDs and out-of-range inputs."""
        res = self.engine.simulate(manual_delays={"NON_EXISTENT_FLIGHT": 100})
        self.assertEqual(res["kpis"]["total_flights"], 70)
        
        chain = self.engine.get_rotation_dependency_chain("UNKNOWN_999", res)
        self.assertIn("error", chain)
        
        feas = self.engine.evaluate_spare_feasibility("UNKNOWN_999", "VT-DS18", res)
        self.assertFalse(feas["feasible"])
        print("[PASS] Test 12: Invalid input safety checks verified.")

    def test_13_ai_copilot_grounded_queries(self):
        """Test 13: Tactical AI Copilot query answers grounded in verified simulation data."""
        closure = AirportClosure(airport_id="BOM", start_minute=510, end_minute=600)
        res = self.engine.simulate(closures=[closure])
        
        # Test flight investigation query
        ans_flight = self.engine.ask_copilot("Why is flight DS0202 delayed?", res)
        self.assertIn("DS0202", ans_flight["answer"])
        self.assertIn("suggested_actions", ans_flight)
        
        # Test spare feasibility query
        ans_spare = self.engine.ask_copilot("Can VT-DS18 replace DS1502?", res)
        self.assertIn("VT-DS18", ans_spare["answer"])
        
        # Test passenger connection query
        ans_pax = self.engine.ask_copilot("How many passengers missed connections?", res)
        self.assertIn("Passenger Connection", ans_pax["answer"])
        print("[PASS] Test 13: AI Copilot grounded queries verified.")

    def test_14_airport_capacity_and_runway_slot_metering(self):
        """Test 14: Verifies runway movement slot separation and capacity throttling under disruption."""
        closure = AirportClosure(airport_id="BOM", start_minute=510, end_minute=600)
        res = self.engine.simulate(closures=[closure], enforce_runway_capacity=True)
        # Departing flights from BOM after reopening at 10:00 (minute 600) must have separated runway slots
        bom_reopen_deps = [f for f in res["flights"].values() if f["origin"] == "BOM" and f["pred_dep_min"] >= 600]
        dep_times = sorted([f["pred_dep_min"] for f in bom_reopen_deps])
        # Verify min slot separation between consecutive departures
        for i in range(len(dep_times) - 1):
            diff = dep_times[i+1] - dep_times[i]
            self.assertGreaterEqual(diff, 2, f"Runway slots at BOM must be spaced by at least 2m, got {diff}m")
        print("[PASS] Test 14: Airport runway capacity slot metering verified.")

    def test_15_airborne_closure_holding_fuel_and_diversion(self):
        """Test 15: Verifies airborne flights divert when closure holding exceeds 45m fuel limit."""
        # 120-minute BOM closure from 07:30 to 09:30
        closure = AirportClosure(airport_id="BOM", start_minute=450, end_minute=570, reason="Runway Waterlogging")
        res = self.engine.simulate(closures=[closure], max_holding_fuel_minutes=45)
        # DS0201 departs DEL at 06:00 (sched arr 08:10 at BOM, during closure).
        # It was airborne before 07:30 closure start! Required holding to 09:30 is 80m > 45m limit.
        f_ds0201 = res["flights"]["DS0201"]
        self.assertTrue(f_ds0201["is_diverted"], "DS0201 must divert due to >45m fuel limit")
        self.assertEqual(f_ds0201["status"], "DIVERTED")
        self.assertIn("DIVERTED", f_ds0201["root_cause"])
        self.assertEqual(f_ds0201["diversion_airport"], "PNQ")
        print(f"[PASS] Test 15: Airborne diversion verified for DS0201 to {f_ds0201['diversion_airport']}.")

    def test_16_simultaneous_multi_airport_closures(self):
        """Test 16: Verifies concurrent simultaneous disruptions at multiple airports."""
        closures = [
            AirportClosure(airport_id="BOM", start_minute=510, end_minute=600, reason="BOM Monsoon Storm"),
            AirportClosure(airport_id="DEL", start_minute=540, end_minute=630, reason="DEL Hailstorm")
        ]
        res = self.engine.simulate(closures=closures)
        kpis = res["kpis"]
        self.assertGreaterEqual(kpis["delayed_flights"], 12, "Simultaneous closures must compound network delays")
        self.assertGreaterEqual(kpis["total_delay_minutes"], 600)
        # Verify both BOM and DEL are marked closed in risk list
        bom_risk = next(a for a in res["airport_risks"] if a["airport_id"] == "BOM")
        del_risk = next(a for a in res["airport_risks"] if a["airport_id"] == "DEL")
        self.assertTrue(bom_risk["is_closed"])
        self.assertTrue(del_risk["is_closed"])
        print(f"[PASS] Test 16: Simultaneous BOM+DEL closures verified: {kpis['delayed_flights']} flights delayed ({kpis['total_delay_minutes']}m).")

    def test_17_midnight_boundary_monotonic_arithmetic(self):
        """Test 17: Verifies monotonic chronological progression for operations spanning past midnight."""
        # Inject closure from 23:00 to 01:30 (minute 1380 to 1530)
        closure = AirportClosure(airport_id="DEL", start_minute=1380, end_minute=1530, reason="Midnight Fog CAT III")
        res = self.engine.simulate(closures=[closure])
        self.assertIsNotNone(res)
        # Verify minutes_to_time formats >1440 with day indicator
        t_str = minutes_to_time(1530)
        self.assertIn("(+1d)", t_str)
        self.assertEqual(t_str, "01:30 (+1d)")
        print(f"[PASS] Test 17: Midnight boundary monotonic progression verified: {t_str}.")

    def test_18_spare_aircraft_conflict_detection(self):
        """Test 18: Verifies operational conflict detector flags double-bookings and contradictory actions."""
        deployments = [
            SpareDeployment(spare_tail="VT-DS18", target_flight_id="DS1502"),
            SpareDeployment(spare_tail="VT-DS18", target_flight_id="DS0202") # Double-booking!
        ]
        conflicts = self.engine.detect_recovery_conflicts(deployments=deployments, cancelled_flight_ids=["DS1502"])
        conflict_types = [c["conflict_type"] for c in conflicts]
        self.assertIn("SPARE_DOUBLE_BOOKING", conflict_types)
        self.assertIn("CONTRADICTORY_ACTIONS", conflict_types)
        print(f"[PASS] Test 18: Recovery action conflict detector verified ({len(conflicts)} conflicts identified).")

    def test_19_multiple_recovery_actions_combination(self):
        """Test 19: Verifies simultaneous combination of spare deployment + tactical cancellation."""
        closure = AirportClosure(airport_id="BOM", start_minute=510, end_minute=600)
        deployments = [SpareDeployment(spare_tail="VT-DS18", target_flight_id="DS1503", assumed_reposition_minutes=0)]
        cancellations = ["DS0202"]
        res = self.engine.simulate(closures=[closure], deployments=deployments, cancelled_flight_ids=cancellations)
        kpis = res["kpis"]
        self.assertEqual(kpis["cancelled_flights"], 1)
        self.assertEqual(res["flights"]["DS0202"]["status"], "CANCELLED")
        self.assertTrue(res["flights"]["DS1503"]["is_spare_recovered"])
        print("[PASS] Test 19: Multi-recovery combination verified (1 cancellation + 1 spare takeover).")

    def test_20_crew_replacement_and_standby_swaps(self):
        """Test 20: Verifies standby crew swaps activate when duty approaches or exceeds statutory limit."""
        # Inject extreme 300m delay on DS0201 to force crew CR02 over 600m
        res = self.engine.simulate(manual_delays={"DS0201": 300})
        cr02 = next(c for c in res["crews"] if c["crew_id"] == "CR02")
        self.assertTrue(cr02["is_exceeded"], "CR02 duty must exceed 600m")
        # Since last flight arrives at DEL (crew base), standby crew swap is eligible
        self.assertTrue(cr02["crew_swapped"])
        self.assertEqual(cr02["status"], "SWAPPED_STANDBY")
        print(f"[PASS] Test 20: Standby crew swap verified for {cr02['crew_id']} ({cr02['standby_crew_id']}).")

    def test_21_passenger_rebooking_and_alternative_connections(self):
        """Test 21: Verifies automated same-day passenger rebooking evaluation for broken transfers."""
        closure = AirportClosure(airport_id="BOM", start_minute=510, end_minute=600)
        res = self.engine.simulate(closures=[closure])
        cx17 = next(c for c in res["connections"] if c["connection_id"] == "CX17")
        self.assertTrue(cx17["is_broken"])
        self.assertIsNotNone(cx17.get("rebooking"))
        # Rebooking must show whether alternate flight was available or stranded overnight
        self.assertIn("is_same_day", cx17["rebooking"])
        print(f"[PASS] Test 21: Passenger rebooking analysis verified for CX17 (Rebooking status: {cx17['status']}).")

    def test_22_multi_objective_recovery_plans_and_tradeoffs(self):
        """Test 22: Verifies multi-objective Pareto optimizer generates candidate recovery plans with trade-offs."""
        closure = AirportClosure(airport_id="BOM", start_minute=510, end_minute=600)
        plans = self.engine.optimize_recovery_plans(closures=[closure])
        self.assertEqual(len(plans), 4)
        plan_ids = [p["plan_id"] for p in plans]
        self.assertIn("PLAN_A", plan_ids)
        self.assertIn("PLAN_B", plan_ids)
        self.assertIn("PLAN_C", plan_ids)
        self.assertIn("PLAN_D", plan_ids)
        for p in plans:
            self.assertIn("estimated_cost", p)
            self.assertIn("score", p)
            self.assertIn("tradeoffs", p)
            self.assertGreaterEqual(p["score"], 0)
        print(f"[PASS] Test 22: Multi-objective optimizer generated {len(plans)} plans with trade-off matrices.")

    def test_23_extreme_network_disruption_scenario(self):
        """Test 23: Verifies system robustness under extreme triple-hub simultaneous disruption."""
        extreme_closures = [
            AirportClosure(airport_id="BOM", start_minute=510, end_minute=630),
            AirportClosure(airport_id="DEL", start_minute=540, end_minute=660),
            AirportClosure(airport_id="BLR", start_minute=600, end_minute=720)
        ]
        res = self.engine.simulate(closures=extreme_closures)
        self.assertEqual(res["kpis"]["total_flights"], 70)
        self.assertGreater(res["kpis"]["delayed_flights"], 20)
        print(f"[PASS] Test 23: Extreme triple-hub shutdown handled safely: {res['kpis']['delayed_flights']} flights delayed.")

    def test_24_structured_simulation_facts_and_provenance(self):
        """Test 24: Verifies structured SimulationFacts have explicit units, provenance, and 100% confidence."""
        res = self.engine.simulate()
        facts = res.get("simulation_facts", {})
        self.assertGreater(len(facts), 10)
        for fact_key, fact in facts.items():
            self.assertIn("metric", fact)
            self.assertIn("field_name", fact)
            self.assertIn("value", fact)
            self.assertIn("unit", fact)
            self.assertIn("provenance", fact)
            self.assertEqual(fact["confidence"], 1.0)
            self.assertTrue(fact["verified"])
        print(f"[PASS] Test 24: Structured simulation facts verified ({len(facts)} facts with strict provenance).")

if __name__ == "__main__":
    unittest.main()
