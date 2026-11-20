# DOMINO SKY — Premium Airline Operations Control Centre
## Unified Disruption Simulator, Live Flight Radar & Deterministic Recovery Engine
### Built for Hack2Skill | AI-Evaluation-Optimised Airline Operations Intelligence Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%202.0-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB?logo=react)](https://reactjs.org)
[![TailwindCSS](https://img.shields.io/badge/Design-Tailwind%20Midnight%20OCC-38B2AC?logo=tailwindcss)](https://tailwindcss.com)
[![MapLibre/Leaflet](https://img.shields.io/badge/Radar-Leaflet%20Dark%20Airspace-199900?logo=leaflet)](https://leafletjs.com)
[![Backend Tests](https://img.shields.io/badge/Backend%20Tests-24%2F24%20Passing-brightgreen)](backend/test_sim.py)
[![Frontend Tests](https://img.shields.io/badge/Frontend%20Tests-9%2F9%20Passing-brightgreen)](frontend/src/__tests__/simulation.test.ts)
[![Evaluation Checklist](https://img.shields.io/badge/Audit-Evaluation%20Traceability-blue)](EVALUATION_CHECKLIST.md)

---

## 1. Executive Problem Statement

A 90-minute severe monsoon thunderstorm or runway closure at Mumbai (**BOM**) does not merely delay flights departing or arriving in Mumbai. It can cause a flight from Bengaluru to Kolkata hours later to be severely delayed, cause crew duty timeouts in Delhi, or strand connecting passengers in Hyderabad.

In commercial aviation, modern aircraft operate sequential flight rotations (e.g. Leg 1 &rarr; Leg 2 &rarr; Leg 3 &rarr; Leg 4 &rarr; Leg 5) across domestic network hubs throughout an operating day. When an initial flight is held at an origin airport or forced into airborne holding, the assigned aircraft arrives late at downline stations. If the remaining scheduled turnaround buffer is insufficient (minimum 30 minutes required for passenger deplaning, refueling, cabin grooming, and boarding), the subsequent departure is inevitably delayed.

This cascading failure chain introduces four critical operational crises:
1. **Rotational Delay Propagation:** Downline airports with clear weather suffer secondary congestion and delay cascades purely from late inbound aircraft.
2. **Passenger Connections Broken:** Transfer passengers on tight connection windows miss onward flights, stranding passengers across hub airports.
3. **Crew Duty Violations:** Cockpit and cabin crews approach or exceed statutory flight duty time limitations (600 minutes max), forcing mandatory crew swaps or groundings.
4. **Recovery Dilemma:** Operations controllers must evaluate whether to absorb delays, substitute standby spare aircraft, or tactically cancel flights to sever the cascade.

**DOMINO SKY** solves this problem by providing a unified, professional Operations Control Centre (OCC) platform that enables flight dispatchers to:
$$\text{MONITOR} \longrightarrow \text{DETECT} \longrightarrow \text{INVESTIGATE} \longrightarrow \text{PREDICT} \longrightarrow \text{RECOVER}$$

All workspaces operate over **one single shared operational state**, using the same simulation clock, flight dataset, aircraft rotations, and recovery decisions.

---

## 2. Advanced OCC Capabilities

All capabilities operate over **one connected application with one shared operational state**:

### 1. Live-Style India Flight Radar
- Tactical dark-mode radar map of India plotting all 16 airports using actual geographic coordinates.
- Geodesic flight route vectors with aircraft icons rotated dynamically according to instantaneous route bearing.
- Smooth clock-driven interpolation calculating aircraft position along route:
  $$\text{Progress}(t) = \frac{t - \text{predicted\_dep}}{\text{block\_minutes}} \in [0, 1]$$
- Visual status indicators:
  - **Cyan:** On Time ($\le 15$m delay)
  - **Amber:** Delayed ($15\text{m} < \text{delay} \le 60\text{m}$)
  - **Red:** Severely Disrupted / Airborne Holding ($>60$m delay)
  - **Purple:** Diverted to Alternate Airport (holding fuel exhaustion)
  - **Green:** Spare Aircraft Recovered
  - **Slate/Strikethrough:** Tactically Cancelled
- Airport markers displaying operational tier (Mega Hub, Regional Hub, Spoke), active departure delay counters, and pulsing alert rings during active closures.
- Interactive controls: Play/Pause, 1&times;, 2&times;, 5&times;, 10&times; speeds, 24-hour timeline scrubber, airport labels, route arcs, aircraft trails, and disruption overlays.

### 2. Airborne Holding & Designated Alternate Diversions
- Domestic A320 holding fuel reserve limit of 45 minutes enforced mathematically.
- Flights airborne when destination airport closes hold in airspace. If holding duration exceeds 45 minutes, flight automatically diverts to designated alternate (e.g. `BOM` &rarr; `PNQ` / `GOI` / `AMD`; `DEL` &rarr; `JAI` / `IXC` / `LKO`).
- Diverted flight path, updated destination, and passenger re-accommodation are tracked seamlessly.

### 3. Runway Movement Capacity & Slot Metering
- Hourly departure and arrival capacity constraints modeled per airport tier (e.g. BOM/DEL 50-55 mvts/hr).
- Departure and arrival slot queue separation applied during post-closure recovery banks, preventing physically impossible simultaneous runway operations.

### 4. Flight Delay Detective & Aircraft Rotation Graph
- Traceable root-cause attribution: Distinguishes root disruption causes (e.g., *“Origin airport BOM closed [08:30–10:00]”*) from downstream consequences (*“Late inbound aircraft VT-DS02 on flight DS0201 arrived late; required 35m turnaround”*).
- Interactive aircraft rotation dependency DAG: Clickable flight nodes representing consecutive legs on that tail, showing turnaround buffer absorption, arrival delays, passenger counts, and departure predictions.
- Complete dependency chain linking inbound flights, outbound flights, and transferring passenger banks.

### 5. Passenger Connection Intelligence & Automated Rebooking
- Full inspection of all 21 connecting passenger banks (CX01–CX21) without double-counting.
- Direct computation of transfer slack and Minimum Connection Time (MCT) margins:
  $$\text{Margin} = (\text{Pred Dep}_{\text{to}}) - (\text{Pred Arr}_{\text{from}}) - \text{Min Connect Minutes}$$
- Clear categorization: **ON_TIME**, **PROTECTED** (absorbing delay within buffer), and **BROKEN** ($\text{Margin} < 0$).
- Automated rebooking candidate evaluation on alternate same-day flights with seat margin checks.

### 6. Standby Crew Swaps & Statutory Duty Enforcement
- Cockpit and cabin crew duty tracked from `duty_start` against statutory 600-minute limit.
- When duty exceeds 600 minutes, standby relief crews (`STBY-CRxx`) are automatically dispatched at designated crew base hubs (DEL, BOM, BLR, HYD, CCU, MAA, AMD, COK, PNQ, GOI, TRV).

### 7. Multi-Objective Recovery Optimizer & Conflict Detection
- Evaluates 4 distinct candidate recovery strategies with hard operational feasibility constraints:
  - **Plan A (Spares Priority):** Max schedule reliability, zero cancellations, deploys standby fleet.
  - **Plan B (Min Direct Cost):** Restricts spares to home base matches, eliminates ferry repositioning cost.
  - **Plan C (Pareto-Balanced OCC - Recommended):** Combines primary spare deployment with tactical low-load leg cancellation to completely halt the downline cascade.
  - **Plan D (Cascade Isolation):** Cancels initiating delayed legs to immediately reset the schedule.
- Aviation industry financial cost model:
  $$\text{Cost} = (\text{Delay Mins} \times \$75) + (\text{Cancels} \times \$12,000) + (\text{Pax Risk} \times \$250) + (\text{Spares} \times \$4,000) + (\text{Ferry Mins} \times \$50) + (\text{Crew Violations} \times \$5,000)$$
- Real-time recovery action conflict detector flags:
  - **Double Booking:** Same spare tail assigned to multiple concurrent flight rotations.
  - **Contradictory Actions:** Flight marked both CANCELLED and targeted for spare takeover.
  - **Infeasible Ferry:** Spare deployed at non-base airport without repositioning buffer.

### 8. Interactive AI Operations Copilot & Simulation Facts
- Grounded decision support assistant querying structured `SimulationFact` records with explicit field names, units, and provenance. Zero hallucination.
- Answers operational questions with deterministic precision and one-click executable actions.

---

## 3. Technology Architecture & Stack

```
DOMINO SKY Operations Control Centre
├── Backend (Python / FastAPI)
│   ├── sim_engine.py         # Deterministic simulation, holding fuel, runway metering, Pareto optimizer
│   ├── main.py               # REST API endpoints & CORS middleware
│   ├── models.py             # Pydantic data schemas (typed facts, plans, conflicts)
│   └── test_sim.py           # 24 comprehensive unit & integration tests
├── Frontend (React 18 / TypeScript / Vite / Tailwind CSS)
│   ├── src/services/
│   │   ├── deterministicSim.ts # High-performance client-side TypeScript engine mirror
│   │   ├── copilotEngine.ts   # Interactive AI Copilot assistant engine
│   │   └── api.ts             # REST client with seamless offline fallback
│   ├── src/context/
│   │   └── OperationalContext.tsx # Universal shared operational state
│   ├── src/components/
│   │   ├── radar/FlightRadar.tsx          # Leaflet tactical airspace map & diversion rendering
│   │   ├── detective/RotationGraph.tsx    # Clickable rotation DAG
│   │   ├── recovery/RecoveryDesk.tsx      # Multi-objective optimizer, conflict alerts & spare desk
│   │   ├── intelligence/NetworkIntelligence.tsx # Risk hierarchy & turnaround stress matrix
│   │   ├── briefing/AIBriefingPanel.tsx   # AI operational briefing & report export
│   │   └── AICopilot.tsx                  # Interactive OCC copilot
│   ├── src/views/             # 9 Unified Workspaces
│   └── src/__tests__/         # 9 unit tests (Node test runner)
├── EVALUATION_CHECKLIST.md    # Traceable audit checklist across all 6 criteria
└── dataset.json               # Primary source of truth (16 airports, 70 flights, 21 conns, 16 crews, 2 spares)
```

---

## 4. REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/simulate` | `POST` | Runs the full deterministic network simulation with closures, delays, runway constraints, spares, and cancellations |
| `/api/recovery/optimize` | `POST` | Runs multi-objective Pareto optimizer returning 4 candidate recovery plans with trade-off matrices |
| `/api/recovery/conflicts` | `POST` | Validates recovery actions against double booking, contradictory cancellations, and infeasible ferry legs |
| `/api/simulation/facts` | `POST` | Emits structured, typed `SimulationFact` records with explicit field names, units, and provenance |
| `/api/copilot` | `POST` | Answers natural language operational questions grounded in live simulation facts |
| `/api/scenarios/compare` | `POST` | Evaluates 3-way comparative metrics (Baseline vs Disrupted vs Recovered) |
| `/api/spares/evaluate` | `POST` | Validates spare feasibility (base match, ferry requirement, seat capacity, ready time) |
| `/api/flights/{id}/detective` | `GET` | Returns upstream/downstream rotation dependency DAG and delay attribution |
| `/api/airports` | `GET` | Returns list of all 16 Indian airports with metadata and runway counts |
| `/api/health` | `GET` | Health check endpoint returning status, version, and simulation clock |

---

## 5. Dataset Conformance & Invariants

The project strictly complies with `dataset.json`:
- **16 Airports:** DEL, BOM, BLR, HYD, MAA, CCU, AMD, COK, GOI, PNQ, JAI, GAU, LKO, IXC, BBI, TRV.
- **70 Flights:** Operated by 16 aircraft tails (VT-DS01 through VT-DS16) with 4–5 legs each.
- **Minimum Turnaround Time:** 30 minutes minimum standard.
- **21 Passenger Connections:** Evaluated using passenger-specific MCT thresholds.
- **16 Crew Assignments:** Duty runs from `duty_start` until final flight arrival. Maximum duty limit is 600 minutes (10 hours).
- **2 Spare Aircraft:** VT-DS17 (BLR) and VT-DS18 (DEL).
- **Aircraft Seat Capacity:** 180 seats across all fleet aircraft.

---

## 6. Local Installation & Startup Guide

### Prerequisites
- Python 3.9+
- Node.js v18+ (tested on Node v20/v24)

### 1. Backend Startup
```powershell
# Navigate to the repository root
cd "C:\Users\Renu Dwivedi\Desktop\event"

# Install backend dependencies
python -m pip install fastapi uvicorn pydantic

# Run 24 unit tests to verify calculation engine
python backend/test_sim.py

# Start the FastAPI backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Backend API will be accessible on `http://127.0.0.1:8000` (Interactive docs at `http://127.0.0.1:8000/docs`).

### 2. Frontend Startup
```powershell
# In a separate terminal, navigate to the frontend directory
cd "C:\Users\Renu Dwivedi\Desktop\event\frontend"

# Install dependencies
npm install

# Run frontend test suite (9 tests)
npm test

# Build production bundle
npm run build

# Start Vite dev server
npm run dev
```
Open your browser at `http://127.0.0.1:5173`.

---

## 7. Automated Testing & Verification

### Running All Tests
1. **Backend Tests (24 Tests):**
   ```powershell
   python backend/test_sim.py
   ```
   *Result:* 24 tests passed in 0.092s (Schedule integrity, BOM closure propagation, turnaround absorption, connection margins, crew limits, spare feasibility, cancellations, 3-way comparisons, determinism, input safety, AI copilot grounding, runway slot metering, airborne fuel exhaustion/diversion, simultaneous closures, midnight boundary, conflict detection, multi-recovery combination, standby crew swaps, passenger rebooking, multi-objective Pareto plans, extreme stress testing, and structured facts).

2. **Frontend Tests (9 Tests):**
   ```powershell
   cd frontend
   npm test
   ```
   *Result:* 9 tests passed in 0.329s (Baseline integrity, Mumbai disruption, spare feasibility, tactical flight cancellation, 3-way scenario comparison, airborne diversion, simultaneous closures, conflict detection, and multi-objective optimizer).

---

## 8. Evaluator Verification Script (5-Minute Tour)

1. **Baseline State:** Open `http://127.0.0.1:5173`. Note 70 flights, 0 delays, 0 broken connections, 2 available spares.
2. **Inject Disruption:** Select **"Mumbai (BOM) Monsoon Storm Closure"** (08:30–10:00). Watch delay cascade to 9 flights, 506m total delay, and broken connection CX17 at HYD.
3. **Flight Radar:** Observe real-time aircraft positions. Airborne flights exceeding 45m holding fuel reserve divert to alternate airports (e.g. BOM &rarr; PNQ) with purple flight paths.
4. **Delay Detective:** Click **Delay Detective** in sidebar. Select flight `DS0202` or `DS1502`. Trace the rotation graph to see where buffer was absorbed vs inherited.
5. **Passenger Intelligence:** Click **Passenger Impact** in sidebar. Observe 21 connection banks, with CX17 flagged as BROKEN (23 pax stranded) with automated rebooking analysis.
6. **Recovery Desk:** Click **Recovery Desk**. 
   - Observe the **Multi-Objective Recovery Optimizer** presenting 4 candidate plans (Spares, Min Cost, Pareto-Balanced OCC, Cascade Isolation) with composite scores, estimated operating costs ($), and trade-offs.
   - Click **"Apply Plan"** on Plan C (Balanced OCC) or configure manual spare takeover / cancellation.
   - Test deliberate conflicting actions to see the **Real-time Conflict Alert** banner.
7. **3-Way Comparison:** View the Scenario Comparison matrix table comparing Baseline vs Disrupted vs Recovered states.
8. **AI Copilot:** Click **AI Operations Copilot**. Ask *"Why is DS0202 delayed?"*, *"Can VT-DS18 replace DS1503?"*, or *"Which connections are broken?"* to see factual, grounded decision support with zero hallucination.
9. **AI Briefing:** Click **AI Briefing** and click **Export JSON** or **Export CSV** to download the operational report.
