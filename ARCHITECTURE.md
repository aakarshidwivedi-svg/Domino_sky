# DOMINO SKY — Technical Architecture & Systems Design
## Hack2Skill | AI-Evaluation-Optimised Airline Disruption Platform

## 1. System Philosophy & Design Principles

**DOMINO SKY** is an airline operations control centre (OCC) system designed for mathematical rigor, visual clarity, and reactive disruption simulation. It implements a **reactive, single-source-of-truth architecture** where every view (Radar, Delay Detective, Passenger Intelligence, Recovery Desk, Network Intelligence, AI Copilot, AI Briefing) shares one unified operational state.

Key architecture principles:
1. **One Connected Application:** No independent pages or isolated data stores. All 9 workspaces derive their view from one shared state model.
2. **Deterministic Dual-Engine Architecture:** A FastAPI Python engine (`backend/sim_engine.py`) and a TypeScript client mirror (`frontend/src/services/deterministicSim.ts`) share bitwise-identical mathematical logic.
3. **100% Offline / Standalone Capability:** If the backend is offline or during evaluation disconnected runs, the TypeScript engine automatically executes full simulation, spare feasibility, scenario comparisons, and copilot fallbacks with zero user-visible degradation.
4. **Grounded AI Operational Copilot:** Copilot responses are never free-form hallucinations; they are bound to real simulation entities, aircraft rotations, delay values, and connection margins.

```
+--------------------------------------------------------------------------------------------------------+
|                                           DOMINO SKY APP SHELL                                         |
+--------------------------------------------------------------------------------------------------------+
|  [ TOP HEADER ]  Simulation Clock | Scenario Switcher | Global Search (Ctrl+K) | Playback Controls     |
+--------------------------------------------------------------------------------------------------------+
|  [ KPI STRIP ]   70 Flights | On-Time OTP | Total Delay Mins | Broken Conns | Spares | Cancellations   |
+--------------------------------------------------------------------------------------------------------+
|  [ SIDEBAR ]          |  [ ACTIVE WORKSPACE CONTAINER ]                         | [ CONTEXT DRAWER ]   |
|  1. Command Center    |  * CommandCenterView (Tactical Radar + Intel + Briefing)| Flight Detail Drawer |
|  2. Live Flight Radar |  * RadarView (100% Airspace Tactical Map)               | Rotation Graph (DAG) |
|  3. Delay Detective   |  * DelayDetectiveView (Full Rotation Root Cause DAG)    | Upstream/Downstream  |
|  4. Passenger Impact  |  * PassengerImpactView (21 Connection Banks & MCTs)     | Turnaround Details   |
|  5. Recovery Desk     |  * RecoveryDeskView (Spares, Cancellations & Comparison)| Crew Duty Exposure   |
|  6. Network Intel     |  * NetworkIntelligenceView (0-100 Risk Ranking)         | Live Action Buttons  |
|  7. AI Copilot        |  * AICopilotView (Decision Support Assistant)           |                      |
|  8. Flight Explorer   |  * FlightExplorerView (Flight Roster & Timetable)       |                      |
|  9. AI Briefing       |  * AIBriefingView (Executive 5-Section Briefing & Export)                      |
+--------------------------------------------------------------------------------------------------------+
|  [ PERSISTENT TIMELINE ]  Play/Pause | Speed (1-10x) | 24-Hour Scrubber (00:00 - 24:00 IST)            |
+--------------------------------------------------------------------------------------------------------+
                                                    |
                                                    v
+--------------------------------------------------------------------------------------------------------+
|                                    SHARED OPERATIONAL CONTEXT STORE                                    |
|  - Clock: simMinute (0-1440)                   - Selection: selectedFlightId, selectedAirportId        |
|  - Disruption: closures[], manualDelays{}      - Recovery: deployments[], cancelledFlights[]           |
|  - Results: flights{}, connections[], crews[], airport_risks[], rotation_risks[], ai_briefing          |
|  - Copilot: messages[], activeActions[]        - Comparison: baseline vs disrupted vs recovered        |
+--------------------------------------------------------------------------------------------------------+
                        |                                                   |
                        v                                                   v
     +----------------------------------+               +----------------------------------+
     |      BACKEND PYTHON ENGINE       |               |    CLIENT SYNCHRONOUS ENGINE     |
     |  - FastAPI (REST API :8000)      | <--- HTTP --- |  - Local Mirror (0ms latency)    |
     |  - sim_engine.py                 |    Sync/Req   |  - deterministicSim.ts           |
     |  - Deterministic Math Engine     |               |  - Smooth 60 FPS scrubber & map  |
     |  - Grounded AI Copilot Engine    |               |  - copilotEngine.ts              |
     +----------------------------------+               +----------------------------------+
```

---

## 2. Shared Operational Context Architecture

Unlike disjointed dashboards where each route or component loads separate data, DOMINO SKY unifies all operational state within `OperationalContext.tsx`:

| State Field | Type | Function |
|---|---|---|
| `simMinute` | `number` | Universal clock minute (0–1440, e.g. 510 = 08:30 IST) |
| `isPlaying` | `boolean` | Clock playback active state |
| `speedMultiplier` | `number` | Playback speed ($1\times, 2\times, 5\times, 10\times$) |
| `selectedFlightId` | `string \| null` | Synchronized flight ID across Radar, Detective, Drawer, Copilot |
| `selectedAirportId` | `string \| null` | Synchronized airport selection |
| `closures` | `AirportClosure[]` | Active closure intervals with start/end minutes and reason |
| `manualDelays` | `Record<string, number>` | Injected maintenance/AOG holds per flight |
| `deployments` | `SpareDeployment[]` | Active spare aircraft assignments (VT-DS17 / VT-DS18) |
| `cancelledFlights` | `string[]` | List of tactically cancelled flight IDs |
| `scenarioComparison` | `ScenarioComparison \| null` | 3-way comparative matrix (Baseline vs Disrupted vs Recovered) |
| `copilotMessages` | `CopilotMessage[]` | Interactive chat history with quick actions |
| `simState` | `SimulationState` | Evaluated operational state (KPIs, flight delays, risks, briefing) |

---

## 3. Workspaces & Navigation Structure

DOMINO SKY provides 9 integrated operational views accessible via the sidebar:

1. **Command Center (`CommandCenterView.tsx`):**
   - Main operational landing view.
   - Combines 68% tactical radar airspace with 32% live intelligence widgets (Event Feed, Airport Risk Leaderboard, AI Briefing Card).
2. **Live Flight Radar (`RadarView.tsx`):**
   - Fullscreen tactical airspace display.
   - Great-circle geodesic arcs, bearing-interpolated aircraft markers, closure zones, and visual status filters.
3. **Flight Delay Detective (`DelayDetectiveView.tsx`):**
   - Full-workspace investigation workbench.
   - Clickable aircraft rotation dependency DAG, root cause attribution, turnaround buffer absorption vs inheritance analysis, upstream/downstream impact cards.
4. **Passenger Connection Intelligence (`PassengerImpactView.tsx`):**
   - Analysis workbench for all 21 connection banks.
   - MCT margin gauges, broken connection alarms, stranded passenger metrics, and hub filter buttons.
5. **Recovery Desk (`RecoveryDeskView.tsx`):**
   - Multi-objective Pareto optimizer evaluating 4 candidate plans (Spares Priority, Minimum Cost, Pareto-Balanced OCC, Cascade Isolation).
   - Real-time recovery action conflict detector (flags double booking, contradictory actions, infeasible ferry repositions).
   - Dual-strategy manual configurator: Standby Spare Aircraft Takeover or Tactical Flight Cancellation.
   - Repositioning flight assumption configurator and 3-way scenario comparison matrix.
6. **Network Risk Intelligence (`NetworkIntelligenceView.tsx`):**
   - Deterministic 0–100 risk scoring index per airport and aircraft rotation.
   - Identification of tight turnaround buffer rotations ($\le 35$m) and crew duty exposure.
7. **AI Operations Copilot (`AICopilotView.tsx`):**
   - Fullscreen interactive OCC decision-support copilot.
   - Context-aware natural language queries, prompt chips, deterministic grounded badges, and actionable execution pills.
8. **Flight Explorer (`FlightExplorerView.tsx`):**
   - Comprehensive searchable flight roster with multi-column sorting, status filters, and one-click flight drawer triggers.
9. **AI Operations Briefing (`AIBriefingView.tsx`):**
   - Full 5-section executive operations report with live IST status and one-click JSON/CSV report downloads.

---

## 4. Dual-Engine Parity & Offline Resilience

Both the Python backend (`backend/sim_engine.py`) and TypeScript client (`frontend/src/services/deterministicSim.ts`) implement identical logic:
- Same sorting orders for rotation legs.
- Same turnaround buffer absorption math.
- Same airborne holding queue spacing (3 minutes per aircraft upon reopening).
- Same passenger connection MCT evaluation.
- Same crew duty expiration formulas.
- Same spare aircraft feasibility checks (home base match vs explicitly labeled ferry assumption).
- Same tactical cancellation delay containment logic.

If the FastAPI backend is running, the frontend calls the REST API; if the backend process terminates or is unreachable, the frontend seamlessly executes locally without throwing errors or showing broken views.

---

## 5. Security & Code Quality

- **Zero Secrets / API Keys in Repo:** No hardcoded credentials, API keys, or private tokens.
- **Strict Input Validation:** Pydantic models on backend, TypeScript interfaces on frontend.
- **Sanitized Natural Language Grounding:** AI Copilot parses operational queries using strictly bounded deterministic rule sets.
- **Strict Size Constraint:** Total repository source code is ~628 KB, well below the 10 MB limit for Hack2Skill submission.
- **Zero Hallucination Guarantee:** Flight numbers, delays, passenger counts, and tail assignments are strictly verified against `dataset.json`.
