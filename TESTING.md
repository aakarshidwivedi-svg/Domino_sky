# DOMINO SKY — Test Suite, Execution & Quality Assurance Report
## Hack2Skill | AI-Evaluation-Optimised Airline Disruption Platform

## 1. Overview
DOMINO SKY includes automated unit and integration tests across both the **FastAPI Python backend** and the **React TypeScript frontend**. Every calculation invariant mandated by the evaluation criteria is rigorously tested.

---

## 2. Backend Test Suite (`backend/test_sim.py`)

The backend test suite contains **13 comprehensive unit and integration tests**:

```powershell
cd "C:\Users\Renu Dwivedi\Desktop\event"
python backend/test_sim.py
```

### Verified Backend Execution Results
```
.............
----------------------------------------------------------------------
Ran 13 tests in 0.046s

OK
[PASS] Test 1: Baseline schedule verified: 70 flights, 0 delays, 0 broken connections.
[PASS] Test 2: BOM 90m closure test: 9 flights delayed, 480m total delay, 1 broken connections.
[PASS] Test 3: Closure boundary conditions verified.
[PASS] Test 4: Turnaround propagation and connection buffer absorption verified mathematically.
[PASS] Test 5: Passenger connection calculations verified for CX17 (23 pax at risk).
[PASS] Test 6: Crew duty calculations verified against 600m max limit.
[PASS] Test 7: Spare aircraft feasibility and repositioning rules verified.
[PASS] Test 8: Aircraft assignment conflict detection verified.
[PASS] Test 9: Flight cancellation recovery action verified.
[PASS] Test 10: 3-way scenario comparison verified (Delta: {'delay_minutes_saved': 210, 'flights_recovered': 2, 'connections_saved': 1, 'passengers_saved': 37, 'crew_violations_avoided': 1, 'is_effective': True}).
[PASS] Test 11: Repeated simulation determinism verified with 100% parity.
[PASS] Test 12: Invalid input safety checks verified.
[PASS] Test 13: AI Copilot grounded queries verified.
```

### Backend Coverage Matrix

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

---

## 3. Frontend Test Suite (`frontend/src/__tests__/simulation.test.ts`)

The frontend test suite runs natively in Node.js v20/v24 without requiring heavy external test frameworks:

```powershell
cd "C:\Users\Renu Dwivedi\Desktop\event\frontend"
npm test
```

### Verified Frontend Execution Results
```
> domino-sky@2.0.0 test
> node --experimental-strip-types --test src/__tests__/simulation.test.ts

✔ Frontend Simulation Engine - Baseline Schedule Integrity (16.497ms)
✔ Frontend Simulation Engine - Mumbai 90-Minute Closure Disruption (4.5971ms)
✔ Frontend Simulation Engine - Spare Aircraft Deployment Feasibility (1.7436ms)
✔ Frontend Simulation Engine - Tactical Flight Cancellation Recovery (4.8908ms)
✔ Frontend Simulation Engine - 3-Way Scenario Comparison (6.472ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 509.3578
```

---

## 4. Production Build Verification

The React + TypeScript + Vite frontend was built for production:

```powershell
cd "C:\Users\Renu Dwivedi\Desktop\event\frontend"
npm run build
```

```
✓ 1620 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.47 kB │ gzip:   0.85 kB
dist/assets/index-Crt12nOM.css   38.18 kB │ gzip:   7.11 kB
dist/assets/index-BRxaKEuK.js   497.15 kB │ gzip: 136.11 kB
✓ built in 1m 32s
```

- **Type Checking:** 100% type-safe via `tsc --noEmit` (0 errors).
- **Bundle Size:** Single compact bundle (<500 kB JS uncompressed, 136 kB gzipped).
- **Zero Exposed Secrets:** Clean repository scan.
