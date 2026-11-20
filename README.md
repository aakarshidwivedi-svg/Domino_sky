# DOMINO SKY — Premium Airline Operations Control Centre
## Unified Disruption Simulator, Live Flight Radar & Deterministic Recovery Engine
### Built for Hack2Skill | AI-Evaluation-Optimised Airline Operations Intelligence Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%202.0-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB?logo=react)](https://reactjs.org)
[![TailwindCSS](https://img.shields.io/badge/Design-Tailwind%20Midnight%20OCC-38B2AC?logo=tailwindcss)](https://tailwindcss.com)
[![MapLibre/Leaflet](https://img.shields.io/badge/Radar-Leaflet%20Dark%20Airspace-199900?logo=leaflet)](https://leafletjs.com)
[![Backend Tests](https://img.shields.io/badge/Backend%20Tests-13%2F13%20Passing-brightgreen)](backend/test_sim.py)
[![Frontend Tests](https://img.shields.io/badge/Frontend%20Tests-5%2F5%20Passing-brightgreen)](frontend/src/__tests__/simulation.test.ts)

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

## 2. Seven Core OCC Capabilities

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
  - **Green:** Spare Aircraft Recovered
  - **Slate/Strikethrough:** Tactically Cancelled
- Airport markers displaying operational tier (Mega Hub, Regional Hub, Spoke), active departure delay counters, and pulsing red alert rings during active closures.
- Interactive controls: Play/Pause, 1&times;, 2&times;, 5&times;, 10&times; speeds, 24-hour timeline scrubber, airport labels, route arcs, aircraft trails, and disruption overlays.

### 2. Flight Delay Detective & Aircraft Rotation Graph
- Traceable root-cause attribution: Distinguishes root disruption causes (e.g., *“Origin airport BOM closed [08:30–10:00]”*) from downstream consequences (*“Late inbound aircraft VT-DS02 on flight DS0201 arrived late; required 35m turnaround”*).
- Interactive aircraft rotation dependency DAG: Clickable flight nodes representing consecutive legs on that tail, showing turnaround buffer absorption, arrival delays, passenger counts, and departure predictions.
- Complete dependency chain linking inbound flights, outbound flights, and transferring passenger banks.

### 3. Dedicated Passenger Connection Intelligence
- Full inspection of all 21 connecting passenger banks (CX01–CX21) without double-counting.
- Direct computation of transfer slack and Minimum Connection Time (MCT) margins:
  $$\text{Margin} = (\text{Pred Dep}_{\text{to}}) - (\text{Pred Arr}_{\text{from}}) - \text{Min Connect Minutes}$$
- Clear categorization: **ON_TIME**, **PROTECTED** (absorbing delay within buffer), and **BROKEN** ($\text{Margin} < 0$).
- Filterable by Hub Airport (BOM, DEL, BLR, HYD, CCU, MAA) and connection health status.

### 4. Spare Aircraft Control & Recovery Desk
- Manages the 2 dedicated standby spare aircraft from the dataset:
  - **VT-DS17:** Stationed at Bengaluru (**BLR**), available from 05:00 IST, 180 seats.
  - **VT-DS18:** Stationed at Delhi (**DEL**), available from 05:00 IST, 180 seats.
- **Enforced Positioning Policy:**
  - If a spare is deployed at its home base airport (e.g. VT-DS18 at DEL), immediate zero-delay deployment is confirmed.
  - If deployed at a different origin, the system enforces and explicitly labels a configurable ferry repositioning flight assumption (e.g., 60m ferry flight).
- **Tactical Flight Cancellation:** Allows operators to cancel a severely delayed initiating flight to sever the cascade and protect downstream legs.
- **3-Way Scenario Comparison:** Side-by-side comparative matrix evaluating **Baseline** vs **Disrupted** vs **Recovered** states, calculating exact deltas: delay minutes saved, flights recovered, connections preserved, and passenger disruption avoided.

### 5. Network Risk Intelligence
- Deterministic, transparent operational risk index ($0 - 100$ scale) computed from 4 verified factors:
  $$\text{Airport Risk} = \text{Closure}(45\text{ pts}) + \text{Delay Volume}(25\text{ pts}) + \text{Turnaround Pressure}(15\text{ pts}) + \text{Connection Exposure}(15\text{ pts})$$
- Aircraft rotation vulnerability hierarchy ranking tails by cascade exposure and remaining duty margin.
- Tight turnaround buffer matrix identifying high-risk rotations with $\le 35$m buffers.
- Crew duty margin exposure tracking all 16 crew rosters against the 600-minute maximum duty limit.

### 6. Interactive AI Operations Copilot
- Context-aware natural-language decision support assistant grounded 100% in live simulation state.
- Answers operational questions with deterministic factual precision:
  - *"Why is DS0202 delayed?"* &rarr; Root cause attribution, origin closure timing, and rotational consequences.
  - *"Can VT-DS18 replace DS1503?"* &rarr; Home-base feasibility check, seat capacity check (180 vs pax), and delay savings calculation.
  - *"What are the top 3 bottleneck airports right now?"* &rarr; Dynamic ranking by delay count and risk score.
  - *"What happens if I cancel DS1502?"* &rarr; Downstream impact analysis and delay minute savings.
- One-click actionable prompt chips and interactive action buttons that execute directly in the UI.

### 7. AI Operations Briefing & Reports
- Aviation-grade executive briefing structured into 5 standard operational sections:
  1. **Network Situation:** Live IST status, active closure details, total affected flights, and delay minutes.
  2. **Critical Alerts:** Severe flight delays, broken connections, and crew duty warnings.
  3. **Root Cause Analysis:** Mathematical explanation of initiating event and downstream domino cascade.
  4. **Recommended Actions:** Actionable operational recommendations with direct interactive buttons.
  5. **Recovery Summary:** Quantified results of spare aircraft interventions and cancellations.
- One-click export to **JSON** or **CSV** for auditing and external post-ops reporting.

---

## 3. Technology Architecture & Stack

```
DOMINO SKY Operations Control Centre
├── Backend (Python / FastAPI)
│   ├── sim_engine.py         # Deterministic event-based simulation & copilot engine
│   ├── main.py               # REST API endpoints & CORS middleware
│   ├── models.py             # Pydantic data schemas
│   └── test_sim.py           # 13 comprehensive unit tests
├── Frontend (React 18 / TypeScript / Vite / Tailwind CSS)
│   ├── src/services/
│   │   ├── deterministicSim.ts # Client-side deterministic engine mirror
│   │   ├── copilotEngine.ts   # Interactive AI Copilot assistant engine
│   │   └── api.ts             # REST client with seamless offline fallback
│   ├── src/context/
│   │   └── OperationalContext.tsx # Universal shared operational state
│   ├── src/components/
│   │   ├── radar/FlightRadar.tsx          # Leaflet tactical airspace map
│   │   ├── detective/RotationGraph.tsx    # Clickable dependency DAG
│   │   ├── recovery/RecoveryDesk.tsx      # Spare aircraft & cancellation desk
│   │   ├── intelligence/NetworkIntelligence.tsx # Risk hierarchy
│   │   ├── briefing/AIBriefingPanel.tsx   # AI operational briefing
│   │   └── AICopilot.tsx                  # Interactive OCC copilot
│   ├── src/views/             # 9 Unified Workspaces
│   └── src/__tests__/         # Frontend test suite (Node test runner)
└── dataset.json               # Primary source of truth (16 airports, 70 flights, 21 conns, 16 crews, 2 spares)
```

---

## 4. REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/simulate` | `POST` | Runs the full deterministic network simulation with closures, delays, spares, and cancellations |
| `/api/copilot` | `POST` | Answers natural language operational questions grounded in live simulation state |
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

# Run unit tests to verify calculation engine (13 tests)
python backend/test_sim.py

# Start the FastAPI backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Backend API will be accessible on `http://127.0.0.1:8000` (Swagger interactive docs at `http://127.0.0.1:8000/docs`).

### 2. Frontend Startup
```powershell
# In a separate terminal, navigate to the frontend directory
cd "C:\Users\Renu Dwivedi\Desktop\event\frontend"

# Install dependencies
npm install

# Run frontend test suite (5 tests)
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
1. **Backend Tests:**
   ```powershell
   python backend/test_sim.py
   ```
   *Result:* 13 tests passed in <0.05s (Schedule integrity, BOM closure propagation, turnaround absorption, connection margins, crew limits, spare feasibility, cancellations, 3-way comparisons, determinism, input safety, AI copilot grounding).

2. **Frontend Tests:**
   ```powershell
   cd frontend
   npm test
   ```
   *Result:* 5 tests passed in <0.8s (Baseline integrity, Mumbai disruption, spare feasibility, tactical flight cancellation, 3-way scenario comparison).

---

## 8. Evaluator Verification Script (5-Minute Tour)

1. **Baseline State:** Open `http://127.0.0.1:5173`. Note 70 flights, 0 delays, 0 broken connections, 2 available spares.
2. **Inject Disruption:** Select **"Mumbai (BOM) Monsoon Storm Closure"** (08:30–10:00). Watch delay cascade to 9 flights, 480m total delay, and broken connection CX17 at HYD.
3. **Delay Detective:** Click **Delay Detective** in sidebar. Select flight `DS0202` or `DS1502`. Trace the rotation graph to see where buffer was absorbed vs inherited.
4. **Passenger Intelligence:** Click **Passenger Impact** in sidebar. Observe 21 connection banks, with CX17 flagged as BROKEN (23 pax stranded).
5. **Recovery Desk:** Click **Recovery Desk**. Observe available standby spares VT-DS17 and VT-DS18. Test spare takeover or cancel `DS1502`. Observe total delay drop from 480m down to 270m.
6. **3-Way Comparison:** View the Scenario Comparison matrix table comparing Baseline vs Disrupted vs Recovered states.
7. **AI Copilot:** Click **AI Operations Copilot**. Click prompt chips or ask *"Why is DS0202 delayed?"* or *"Can VT-DS18 replace DS1503?"* to see factual, grounded decision support.
8. **AI Briefing:** Click **AI Briefing** and click **Export JSON** or **Export CSV** to download the operational report.
