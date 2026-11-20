# DOMINO SKY — Simulation Logic, Mathematical Formulas & Operational Rules
## Hack2Skill | AI-Evaluation-Optimised Airline Disruption Platform

## 1. Time Representation & Normalization
All times are represented internally as **minutes from midnight IST** ($t \in [0, 1440)$):
$$t_{\text{mins}} = \text{hour} \times 60 + \text{minute}$$

Conversion back to 24-hour aviation display format:
$$\text{HH} = \lfloor ((t \bmod 1440) + 1440) \bmod 1440 / 60 \rfloor$$
$$\text{MM} = ((t \bmod 1440) + 1440) \bmod 1440 \pmod{60}$$

Flights departing before midnight and landing after midnight are evaluated monotonically to ensure correct turnaround calculations.

---

## 2. Aircraft Rotation & Turnaround Constraints

Each aircraft operates sequential legs ordered by `leg_order` ($1, 2, 3, 4, 5$).

For leg $k > 1$ assigned to aircraft tail $T$:
1. **Inbound Arrival Time:** Let simulated arrival of preceding leg $k-1$ be $t_{\text{arr}, k-1}$.
2. **Turnaround Buffer Requirement:**
   In `dataset.json`, every flight specifies its required turnaround gap in `turnaround_before_min` (typically 30–80m, with 30m as the statutory minimum):
   $$t_{\text{turn\_req}} = \max(30, \text{turnaround\_before\_min}_k)$$
3. **Aircraft Earliest Ready Time:**
   $$t_{\text{ready}, k} = t_{\text{arr}, k-1} + t_{\text{turn\_req}}$$
4. **Earliest Achievable Departure:**
   $$t_{\text{earliest\_dep}, k} = \max(t_{\text{sched\_dep}, k}, t_{\text{ready}, k})$$
5. **Turnaround Buffer Absorption vs Delay Inheritance:**
   - If $t_{\text{ready}, k} \le t_{\text{sched\_dep}, k}$: The turnaround buffer fully absorbs the inbound delay. $\text{Delay}_{\text{inherited}} = 0$.
   - If $t_{\text{ready}, k} > t_{\text{sched\_dep}, k}$: The inbound delay exceeds the turnaround buffer slack and spills into leg $k$:
     $$\text{Delay}_{\text{inherited}} = t_{\text{ready}, k} - t_{\text{sched\_dep}, k}$$
     $$\text{Buffer}_{\text{absorbed}} = \max(0, \text{Delay}_{\text{arr}, k-1} - \text{Delay}_{\text{inherited}})$$

---

## 3. Airport Disruption & Airborne Holding Policy

When an airport $A$ experiences an active closure interval $[t_{\text{start}}, t_{\text{end}})$:

### A. Departure Gate Hold
Any flight scheduled or predicted to depart from $A$ during $[t_{\text{start}}, t_{\text{end}})$ cannot take off:
$$t_{\text{pred\_dep}} = \max(t_{\text{earliest\_dep}}, t_{\text{end}})$$
$$\text{DepDelay} = t_{\text{pred\_dep}} - t_{\text{sched\_dep}}$$

### B. Arrival Airborne Holding Queue
Any flight inbound to $A$ scheduled or predicted to land during $[t_{\text{start}}, t_{\text{end}})$ enters an airborne holding pattern:
1. Arriving flights enter a First-Come, First-Served holding queue over airport $A$.
2. Upon airport reopening at $t_{\text{end}}$, arriving aircraft are cleared for landing separated by a 3-minute runway spacing buffer:
   $$t_{\text{pred\_arr}} = t_{\text{end}} + (\text{QueueSlot} - 1) \times 3$$
3. Airborne holding minutes accumulated:
   $$t_{\text{holding}} = \max(0, t_{\text{pred\_arr}} - (t_{\text{pred\_dep}} + \text{block\_minutes}))$$

---

## 4. Passenger Connection Invariant & Margin Evaluation

The airline network includes 21 monitored passenger connection banks ($CX01 - CX21$).
For each connection bank $C$ from inbound flight $F_{\text{in}}$ to outbound flight $F_{\text{out}}$ at hub $A$:

1. **Available Connection Window:**
   $$\Delta_{\text{connect}} = t_{\text{pred\_dep}}(F_{\text{out}}) - t_{\text{pred\_arr}}(F_{\text{in}})$$
2. **Transfer Slack / Margin:**
   $$\text{Margin} = \Delta_{\text{connect}} - \text{min\_connect\_minutes}_C$$
3. **Connection Status Classification:**
   $$\text{Status} = \begin{cases}
   \textbf{BROKEN}, & \text{if } \text{Margin} < 0 \lor F_{\text{in}}.\text{is\_cancelled} \lor F_{\text{out}}.\text{is\_cancelled} \\
   \textbf{PROTECTED}, & \text{if } \text{Margin} \ge 0 \text{ and } (\text{Delay}(F_{\text{in}}) > 0 \lor \text{Delay}(F_{\text{out}}) > 0) \\
   \textbf{ON\_TIME}, & \text{otherwise}
   \end{cases}$$
4. **Stranded Passengers:**
   When a connection is broken, $C.\text{passengers}$ are marked as stranded/at-risk. Connections are strictly partitioned by ID to prevent double-counting.

---

## 5. Crew Duty Limit Exposure

The network features 16 crew rosters assigned to specific flight sequences:
- Duty starts at `duty_start` (typically 45–60 minutes prior to first flight departure).
- Maximum statutory duty limit:
  $$\text{Duty}_{\max} = 600\text{ minutes (10 hours)}$$
- Let $F_{\text{final}}$ be the last uncancelled flight operated by the crew in the schedule.
  $$\text{Duty}_{\text{elapsed}} = t_{\text{pred\_arr}}(F_{\text{final}}) - t_{\text{duty\_start}}$$
- **Crew Duty Classification:**
  $$\text{Status} = \begin{cases}
  \textbf{EXCEEDED}, & \text{if } \text{Duty}_{\text{elapsed}} > 600 \\
  \textbf{WARNING}, & \text{if } 555 \le \text{Duty}_{\text{elapsed}} \le 600 \\
  \textbf{LEGAL}, & \text{if } \text{Duty}_{\text{elapsed}} < 555
  \end{cases}$$

---

## 6. Deterministic Operational Risk Scoring

### Airport Operational Risk Index ($0 - 100$)
$$\text{Risk}_{\text{airport}} = \min(100, S_{\text{closure}} + S_{\text{delay}} + S_{\text{turnaround}} + S_{\text{connection}})$$
- $S_{\text{closure}} = 45$ if airport is actively closed during simulation time, else $0$.
- $S_{\text{delay}} = \min(25, (\text{delayed\_deps} + \text{delayed\_arrs}) \times 3)$
- $S_{\text{turnaround}} = \min(15, \text{tight\_turnarounds} \times 3)$ where tight turnaround is $\le 35$m.
- $S_{\text{connection}} = \min(15, \text{broken\_connections} \times 5)$

### Aircraft Rotation Risk Index ($0 - 100$)
$$\text{Risk}_{\text{rotation}} = \min(100, \text{DelayScore} + \text{CascadeScore} + \text{CrewScore})$$
- $\text{DelayScore} = \min(40, \lfloor \text{MaxDelay} \times 0.4 \rfloor)$
- $\text{CascadeScore} = \min(25, \text{TotalLegs} \times 5)$
- $\text{CrewScore} = 35$ (Exceeded), $20$ (Warning), or $5$ (Legal).

---

## 7. Recovery Interventions: Spares & Tactical Cancellations

### A. Standby Spare Aircraft Deployment
DOMINO SKY controls 2 standby aircraft:
- **VT-DS17:** Based at Bengaluru (**BLR**), available from 05:00 IST, 180 seats.
- **VT-DS18:** Based at Delhi (**DEL**), available from 05:00 IST, 180 seats.

**Feasibility Validation Rules:**
1. **Seat Capacity:** $\text{Seats}_S (180) \ge F.\text{pax}$. Verified for all flights in dataset ($\max \text{pax} = 173$).
2. **Availability:** Spare must not already be deployed to another active rotation.
3. **Positioning Policy:**
   - **Base Match ($0$m Ferry):** If $S.\text{base} = F.\text{origin}$, immediate deployment is validated with 0m ferry.
   - **Location Mismatch (Ferry Assumption Required):** If $S.\text{base} \ne F.\text{origin}$, system requires an explicit ferry repositioning time assumption $t_{\text{ferry}}$ (e.g. 60–90m).
4. **Achievable Departure & Delay Savings:**
   $$t_{\text{spare\_ready}} = t_{\text{avail}}(S) + t_{\text{ferry}}$$
   $$t_{\text{achievable\_dep}} = \max(t_{\text{sched\_dep}}(F), t_{\text{spare\_ready}})$$
   $$\text{Delay}_{\text{saved}} = \max(0, \text{Delay}_{\text{disrupted}}(F) - (t_{\text{achievable\_dep}} - t_{\text{sched\_dep}}(F)))$$

### B. Tactical Flight Cancellation
When a primary flight is delayed beyond an acceptable threshold (e.g., $DS1502$ held during BOM storm):
1. Marking $F$ as cancelled immediately halts its operation ($F.\text{status} = \text{CANCELLED}, F.\text{delay} = 0$).
2. Subsequent legs on the same rotation start with $\text{prevSimArrMin} = \text{null}$, decoupling them from inherited delays and allowing downstream flights ($DS1503, DS1504$) to depart on time.
3. Any passenger connections feeding or departing from $F$ are explicitly marked as CANCELLED to prevent false protection metrics.

### C. 3-Way Comparative Scenario Delta
The engine calculates exact deltas across three parallel states:
$$\Delta_{\text{delay\_saved}} = \max(0, \text{TotalDelay}_{\text{disrupted}} - \text{TotalDelay}_{\text{recovered}})$$
$$\Delta_{\text{conns\_saved}} = \max(0, \text{BrokenConns}_{\text{disrupted}} - \text{BrokenConns}_{\text{recovered}})$$
$$\Delta_{\text{pax\_saved}} = \max(0, \text{PaxRisk}_{\text{disrupted}} - \text{PaxRisk}_{\text{recovered}})$$
$$\Delta_{\text{crew\_avoided}} = \max(0, \text{CrewViolations}_{\text{disrupted}} - \text{CrewViolations}_{\text{recovered}})$$
