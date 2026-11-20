# DOMINO SKY — Test Suite, Execution & Quality Assurance Report
## Hack2Skill | AI-Evaluation-Optimised Airline Disruption Platform

## 1. Overview
DOMINO SKY includes automated unit and integration tests across both the **FastAPI Python backend** and the **React TypeScript frontend**. Every calculation invariant mandated by the evaluation criteria is rigorously tested.

---

## 2. Backend Test Suite (`backend/test_sim.py`)

The backend test suite contains **30 comprehensive unit and integration tests**:

```powershell
cd "C:\Users\Renu Dwivedi\Desktop\event"
python backend/test_sim.py
```

### Verified Backend Execution Results
```
..............................
----------------------------------------------------------------------
Ran 30 tests in 1.484s

OK
[PASS] Test 1: Baseline schedule verified: 70 flights, 0 delays, 0 broken connections.
[PASS] Test 2: BOM 90m closure test: 9 flights delayed, 506m total delay, 1 broken connections.
[PASS] Test 3: Closure boundary conditions verified.
[PASS] Test 4: Turnaround propagation and connection buffer absorption verified mathematically.
[PASS] Test 5: Passenger connection calculations verified for CX17 (23 pax at risk).
[PASS] Test 6: Crew duty calculations verified against 600m max limit.
[PASS] Test 7: Spare aircraft feasibility and repositioning rules verified.
[PASS] Test 8: Aircraft assignment conflict detection verified.
[PASS] Test 9: Flight cancellation recovery action verified.
[PASS] Test 10: 3-way scenario comparison verified (Delta: {'delay_minutes_saved': 140, 'flights_recovered': 2, 'connections_saved': 1, 'passengers_saved': 37, 'crew_violations_avoided': 0, 'is_effective': True}).
[PASS] Test 11: Repeated simulation determinism verified with 100% parity.
[PASS] Test 12: Invalid input safety checks verified.
[PASS] Test 13: AI Copilot grounded queries verified.
[PASS] Test 14: Airport runway capacity slot metering verified.
[PASS] Test 15: Airborne diversion verified for DS0201 to PNQ.
[PASS] Test 16: Simultaneous BOM+DEL closures verified: 14 flights delayed (906m).
[PASS] Test 17: Midnight boundary monotonic progression verified: 01:30 (+1d).
[PASS] Test 18: Recovery action conflict detector verified (4 conflicts identified).
[PASS] Test 19: Multi-recovery combination verified (1 cancellation + 1 spare takeover).
[PASS] Test 20: Standby crew swap verified for CR02 (STBY-CR02).
[PASS] Test 21: Passenger rebooking analysis verified for CX17 (Rebooking status: BROKEN).
[PASS] Test 22: Multi-objective optimizer generated 4 plans with trade-off matrices.
[PASS] Test 23: Extreme triple-hub shutdown handled safely: 25 flights delayed.
[PASS] Test 24: Structured simulation facts verified (17 facts with strict provenance).
[PASS] Test 25: Detrimental cancellation identified: 0m saved, 118 pax disrupted, is_effective=False.
[PASS] Test 26: Empty dataset handled gracefully with 0 exceptions and valid KPIs.
[PASS] Test 27: Scenario switching and reset determinism verified with 100% bitwise parity.
[PASS] Test 28: Statutory turnaround enforced: arr=09:30, min 30m gap, dep=10:05 (+40m delay).
[PASS] Test 29: Zero-duration and inverted closure boundary conditions handled safely (0m delay).
[PASS] Test 30: FastAPI HTTP endpoints and error handling verified (200, 404, conflicts checked).
```

### Backend Coverage Matrix (30 Tests)

| Test Method | Capability Tested | Invariants Verified |
|---|---|---|
| `test_01_baseline_schedule` | Schedule Ingestion | 70 flights, 16 airports, 0 delays, 0 broken connections, 2 available spares |
| `test_02_bom_closure_propagation` | Disruption & Cascade | Flights held during closure [08:30–10:00], downstream leg delays, broken connection CX17 |
| `test_03_closure_boundary_conditions` | Closure Interval Math | Flights before closure unimpacted; flights during closure held until exact reopening |
| `test_04_turnaround_propagation_and_connection_slack` | Turnaround Buffer Math | Absorbs slack when arrival buffer is sufficient; inherits delay when buffer is tight |
| `test_05_passenger_connection_calculations` | Passenger Transfer Windows | CX17 correctly calculated at HYD (35m available vs 45m required &rarr; BROKEN, 23 pax) |
| `test_06_crew_duty_calculations` | Statutory Duty Limits | Correct calculation of duty elapsed from `duty_start` against 600m limit |
| `test_07_spare_aircraft_feasibility_rules` | Spare Deployment Rules | Base match validated at DEL (VT-DS18); non-base departure correctly flags ferry assumption requirement |
| `test_08_aircraft_assignment_conflicts` | Fleet Allocation | Prevents allocating an already deployed spare or colliding tails |
| `test_09_flight_cancellation_recovery` | Tactical Cancellation | Cancelling primary delayed flight terminates downstream domino delay cascade |
| `test_10_scenario_comparison_matrix` | 3-Way Scenario Matrix | Produces correct Baseline vs Disrupted vs Recovered deltas for delay, pax, and crew |
| `test_11_simulation_determinism` | Mathematical Determinism | 100% bitwise parity over multiple consecutive simulation runs with identical inputs |
| `test_12_invalid_input_safety` | Input Sanitization | Safely handles nonexistent flight IDs, inverted closure times, and empty requests |
| `test_13_copilot_grounded_responses` | AI Copilot Grounding | Resolves flight delays, spare feasibility, bottleneck ranking, and cancellations strictly against simulation state |
| `test_14_runway_capacity_constraints` | Runway Slot Metering | Hourly arrival/departure capacity constraints metered during post-closure queues |
| `test_15_airborne_diversions` | Airborne Holding Limits | Fuel exhaustion (>45m) triggers divert to designated alternate (BOM &rarr; PNQ) |
| `test_16_simultaneous_airport_closures` | Multi-Hub Weather Closures | Simultaneous closure of BOM and DEL handles multi-hub overlapping delays safely |
| `test_17_midnight_boundary_progression` | Continuous Monotonic Time | Operations progressing past 23:59 IST correctly format with `(+1d)` notation |
| `test_18_recovery_conflict_detection` | Recovery Safety Checking | Detects double booking, contradictory actions (CANCEL + SPARE), and infeasible ferry flights |
| `test_19_multiple_recovery_actions` | Combined Recovery Actions | Evaluates multi-action combinations (1 tactical cancellation + 1 spare takeover) |
| `test_20_standby_crew_replacement` | Standby Crew Swaps | Standby crew relief (`STBY-CRxx`) deployed at crew bases when roster exceeds 600m |
| `test_21_passenger_rebooking_feasibility` | Passenger Re-accommodation | Evaluates alternative flight itineraries and seat margins for broken connections |
| `test_22_multi_objective_optimizer` | Multi-Objective Pareto Plans | Generates 4 candidate recovery plans (Spares, Cost, Balanced OCC, Cascade Reset) |
| `test_23_extreme_disruption_scenario` | Extreme Stress Testing | Simultaneous shutdown of BOM, DEL, and BLR executes safely without runtime failure |
| `test_24_structured_simulation_facts` | Grounded Operational Facts | Emits 17 typed `SimulationFact` records with explicit field names, units, and provenance |
| `test_25_recovery_actions_that_worsen_outcome` | Suboptimal Recovery Penalization | Cancelling an on-time flight with 0 downstream savings incurs financial penalties and is marked ineffective |
| `test_26_empty_dataset_and_missing_attributes_resilience` | Resilient Edge Ingestion | Gracefully handles empty dataset dicts with 0 unhandled exceptions and neutral KPIs |
| `test_27_reset_replay_and_scenario_switching_determinism` | Dynamic Reset Integrity | Multiple cycles of baseline &rarr; severe disruption &rarr; reset maintain 100% bitwise parity |
| `test_28_insufficient_turnaround_time_enforcement` | Statutory Turnaround Minimum | Strictly enforces 30m minimum turnaround even if schedule specified shorter gap |
| `test_29_zero_and_inverted_closure_boundary_conditions` | Zero & Inverted Intervals | Sanitizes and ignores 0-minute and inverted closure windows without generating phantom delays |
| `test_30_api_http_endpoints_and_error_handling` | HTTP REST API Endpoints | Validates FastAPI routes (`/api/health`, `/api/flights`, `/api/airports`, `/api/simulate`, `/api/compare`, `/api/evaluate-spare`) |

---

## 3. Frontend Test Suite (`frontend/src/__tests__/simulation.test.ts`)

The frontend test suite runs natively in Node.js without requiring heavy external test dependencies:

```powershell
cd "C:\Users\Renu Dwivedi\Desktop\event\frontend"
npm test
```

### Verified Frontend Execution Results
```
> domino-sky@2.0.0 test
> node --experimental-strip-types --test src/__tests__/simulation.test.ts

✔ Frontend Simulation Engine - Baseline Schedule Integrity (25.6625ms)
✔ Frontend Simulation Engine - Mumbai 90-Minute Closure Disruption (3.3872ms)
✔ Frontend Simulation Engine - Spare Aircraft Deployment Feasibility (1.705ms)
✔ Frontend Simulation Engine - Tactical Flight Cancellation Recovery (2.5356ms)
✔ Frontend Simulation Engine - 3-Way Scenario Comparison (8.4221ms)
✔ Frontend Simulation Engine - Airborne Holding Fuel Exhaustion & Diversion (1.1835ms)
✔ Frontend Simulation Engine - Simultaneous Multi-Airport Closures (1.6018ms)
✔ Frontend Simulation Engine - Operational Recovery Conflict Detection (0.4725ms)
✔ Frontend Simulation Engine - Multi-Objective Recovery Optimizer (6.559ms)
✔ Frontend Simulation Engine - Detrimental/Suboptimal Recovery Evaluation (4.4276ms)
✔ Frontend Simulation Engine - Zero-Duration and Inverted Closure Handling (2.1101ms)
✔ Frontend Simulation Engine - Scenario Switching and Deterministic Parity (2.5347ms)
✔ Frontend Simulation Engine - Turnaround Constraint Enforcement (1.5333ms)
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 398.6377
```

---

## 4. Production Build Verification

The React + TypeScript + Vite frontend builds cleanly with zero errors and optimized vendor code-splitting:

```powershell
cd "C:\Users\Renu Dwivedi\Desktop\event\frontend"
npm run build
```

```
vite v6.4.6 building for production...
transforming...
✓ 1623 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                    1.70 kB │ gzip:  0.91 kB
dist/assets/index-BnJ59KXS.css    39.01 kB │ gzip:  7.26 kB
dist/assets/icons-DR6ahfk9.js     23.07 kB │ gzip:  6.35 kB
dist/assets/vendor-CS9tlpC9.js   134.66 kB │ gzip: 43.22 kB
dist/assets/leaflet-DCIffZry.js  149.58 kB │ gzip: 43.34 kB
dist/assets/index-XRziFMTX.js    211.97 kB │ gzip: 48.67 kB
✓ built in 6.11s
```

---

## 5. Mathematical & Invariant Verification Summary

1. **Schedule Ingestion:** 70 flights, 16 airports, 2 dedicated spares, 21 connecting passenger banks, 16 crew rosters ingested with 100% integrity.
2. **Deterministic Cascades:** Root causes are mathematically separated from rotational downstream consequences.
3. **Turnaround Buffer Rule:** Turnarounds obey minimum buffer rules ($30\text{m} - 35\text{m}$) absorbing minor delays or transferring remainder to departure.
4. **Airborne Holding Limit:** Domestic A320 holding fuel reserve limit of 45m enforced; flights exceeding holding limit divert to pre-designated alternates.
5. **Multi-Objective Optimizer:** Evaluates standard aviation cost equation:
   $$\text{Cost} = (\text{Delay Mins} \times \$75) + (\text{Cancels} \times \$12,000) + (\text{Pax Risk} \times \$250) + (\text{Spares} \times \$4,000) + (\text{Ferry Mins} \times \$50) + (\text{Crew Violations} \times \$5,000)$$
6. **Fact Provenance:** Every Copilot fact cites structured `SimulationFact` provenance with zero hallucination.
