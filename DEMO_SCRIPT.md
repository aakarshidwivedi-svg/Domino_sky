# DOMINO SKY — AI Evaluation Demo Script & Verification Guide
## Hack2Skill | AI-Evaluation-Optimised Airline Disruption Platform

This step-by-step verification script walks an evaluator through the complete operational workflow:
$$\text{MONITOR} \longrightarrow \text{DETECT} \longrightarrow \text{INVESTIGATE} \longrightarrow \text{PREDICT} \longrightarrow \text{RECOVER}$$

All features share **one connected application with one shared operational state**.

---

## Evaluation Workflow

### Step 1: Baseline Schedule Verification
1. Launch the application at `http://127.0.0.1:5173`.
2. In the top header scenario dropdown, verify that **"Normal Scheduled Operations"** is selected.
3. **Verify Operational Metrics:**
   - Total Flights: **70**
   - On-Time Flights: **70 (100% OTP)**
   - Delayed Flights: **0**
   - Pax at Risk: **0**
   - Active Closures: **0**
   - Available Spares: **2**
   - AI Briefing reports: *"Nominal scheduled operations across all 16 Indian airports at 12:00 IST. All 70 flights on time."*

---

### Step 2: Inject Disruption — Mumbai (BOM) Monsoon Storm
1. In the top header scenario dropdown, select **"Mumbai (BOM) Monsoon Storm Closure"** (08:30–10:00 IST).
   *(Alternatively, click BOM on the radar and click "Simulate 90m Runway Closure" [08:30–10:00]).*
2. **Verify on Live Radar:**
   - A pulsing red closure ring appears over Mumbai (**BOM**).
   - Flights scheduled to arrive or depart during the closure are held or enter holding queues.
   - Rotations **VT-DS02**, **VT-DS04**, **VT-DS07**, and **VT-DS15** cascade delays into downline airports (HYD, DEL, BLR, PNQ).
3. **Verify KPI Strip:**
   - Delayed Flights jumps to **9**.
   - Total Delay Minutes increases to **480m**.
   - Broken Connections increases to **1** (connection **CX17** at HYD, with **23 passengers** at risk).

---

### Step 3: Investigate with Flight Delay Detective
1. Click **Delay Detective** in the left sidebar (or click flight **DS0202** / **DS1502** on the radar map).
2. Select flight **DS1502** (DEL &rarr; BOM) in the flight dropdown.
3. **Verify Root Cause Attribution:**
   - Root Cause box reads: *"Origin airport BOM closed [08:30-10:00] (Severe Weather / Runway Closure)"*.
   - Scheduled Arrival: `09:10`, Predicted Arrival: `10:00` (+50m arrival delay + holding).
4. **Inspect Rotation Dependency DAG:**
   - Leg 1 (`DS1501`): On time.
   - Leg 2 (`DS1502`): Delayed arriving at BOM (+50m).
   - Leg 3 (`DS1503`): Departs BOM delayed (+70m).
   - Leg 4 (`DS1504`): Inherits late departure to CCU.
   - Click any node in the DAG to switch inspection immediately.

---

### Step 4: Passenger Connection Intelligence Workspace
1. Click **Passenger Impact** in the left sidebar.
2. Observe all 21 connecting passenger banks ($CX01 - CX21$).
3. **Verify Connection CX17:**
   - Inbound Flight: `DS0704` (arr HYD 15:25, delayed from BOM).
   - Outbound Flight: `DS0803` (dep HYD 16:00).
   - Scheduled Window: 85m. Available Window: 35m. Required MCT: 45m.
   - Transfer Margin: **-10 minutes**.
   - Status: **BROKEN** with **23 passengers at risk**.
4. Test filtering: Click **"BROKEN ONLY"** button to isolate damaged connection banks. Click **"HYD"** to view hub-specific transfers.

---

### Step 5: Network Risk Intelligence Workspace
1. Click **Network Intelligence** in the left sidebar.
2. **Airport Risk Hierarchy:**
   - BOM is ranked #1 with **CRITICAL** risk score (85/100).
   - Inspect factor breakdown: Closure (45 pts) + Delay Volume + Turnaround Pressure + Connection Exposure.
3. **Rotation Exposure:**
   - Tails `VT-DS02`, `VT-DS07`, `VT-DS15` are ranked with severe operational vulnerability.
4. **Tight Turnaround Buffer Matrix:**
   - Identifies high-risk rotations operating with $\le 35$m turnaround slack.

---

### Step 6: Recovery Desk — Spares & Tactical Cancellations
1. Click **Recovery Desk** in the left sidebar.
2. **Inspect Standby Spares:**
   - **VT-DS17** (BLR Base, 05:00 ready, 180 seats).
   - **VT-DS18** (DEL Base, 05:00 ready, 180 seats).
3. **Test Feasibility Rules:**
   - Select flight `DS1503` (departs DEL at 12:20).
   - Choose `VT-DS18`. Notice: Base match at DEL &rarr; **Immediate Zero-Delay Deployment Confirmed**.
   - Now select flight `DS0401` (departs BOM). Notice: Base mismatch &rarr; System flags **Repositioning Flight Assumption Required**.
4. **Test Tactical Flight Cancellation:**
   - In the Recovery Strategy Configurator, switch strategy to **"Tactical Flight Cancellation"**.
   - Select delayed initiating flight **DS1502**.
   - Click **"Cancel Flight & Halt Cascade"**.
   - **Observe Result:**
     - `DS1502` is marked CANCELLED.
     - Downstream domino delay on `DS1503` and `DS1504` is severed.
     - Network delay minutes drop from **480m down to 270m** (a 210-minute saving!).
5. **Inspect 3-Way Scenario Comparison Matrix:**
   - Look at the bottom comparison table showing **Baseline Schedule**, **Disrupted (Mumbai 90m)**, and **Recovered (Active Interventions)** side by side with quantified savings!

---

### Step 7: Interactive AI Operations Copilot
1. Click **AI Operations Copilot** in the left sidebar.
2. Click any of the quick prompt chips:
   - *"Why is DS0202 delayed?"* &rarr; Factual explanation of BOM runway closure and rotation inheritance.
   - *"Can VT-DS18 replace DS1503?"* &rarr; Confirms base match at DEL, 180 seat capacity, and ready time.
   - *"What are the top 3 bottleneck airports right now?"* &rarr; Outputs dynamic ranking of highest-risk hubs.
   - *"What happens if I cancel DS1502?"* &rarr; Shows exact savings and downstream cascade containment.
3. Test direct execution: Click an interactive action button returned by the copilot (e.g. *"Inspect DS0202"* or *"Evaluate Spare VT-DS18"*).

---

### Step 8: AI Operations Briefing & Data Export
1. Click **AI Operations Briefing** in the left sidebar.
2. Verify all 5 structured sections match the live simulation numbers:
   - Network Situation
   - Critical Alerts
   - Root Cause Analysis
   - Recommended Actions
   - Recovery Summary
3. Click **"Export JSON"** or **"Export CSV"** to verify instantaneous generation of compliance and dispatch reports.
