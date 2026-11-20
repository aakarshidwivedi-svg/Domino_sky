# DOMINO SKY — Simulation Logic, Mathematical Formulas & Operational Rules
## Hack2Skill | AI-Evaluation-Optimised Airline Disruption Platform

## 1. Time Representation & Normalization
All times are represented internally as **minutes from midnight IST** ($t \in [0, 1440)$):
$$t_{\text{mins}} = \text{hour} \times 60 + \text{minute}$$

Conversion back to 24-hour aviation display format:
$$\text{HH} = \lfloor ((t \bmod 1440) + 1440) \bmod 1440 / 60 \rfloor$$
$$\text{MM} = ((t \bmod 1440) + 1440) \bmod 1440 \pmod{60}$$

Flights departing before midnight and landing after midnight are evaluated monotonically to ensure correct turnaround calculations, appending `(+1d)` when displaying next-day operations.

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

## 3. Airport Disruption, Gate Holds & Post-Closure Separation

When an airport $A$ experiences an active closure interval $[t_{\text{start}}, t_{\text{end}})$:

### A. Departure Gate Hold
Any flight scheduled or predicted to depart from $A$ during $[t_{\text{start}}, t_{\text{end}})$ cannot take off:
$$t_{\text{pred\_dep}} = \max(t_{\text{earliest\_dep}}, t_{\text{end}})$$
$$\text{DepDelay} = t_{\text{pred\_dep}} - t_{\text{sched\_dep}}$$

### B. Runway Movement Capacity & Queue Slot Separation
Upon airport reopening at $t_{\text{end}}$, departures and arrivals are sequenced with slot separation (minimum 2–3 minutes between consecutive movements) to prevent runway congestion overflows exceeding nominal airport movement capacity:
$$t_{\text{dep\_slot}} \ge t_{\text{last\_dep}} + 2\text{ mins}$$
$$t_{\text{arr\_slot}} \ge t_{\text{last\_arr}} + 2\text{ mins}$$

---

## 4. Airborne Holding & Designated Alternate Diversions

Domestic A320 commercial aircraft adhere to a maximum domestic holding fuel reserve buffer of **45 minutes**:
$$\text{FuelReserve}_{\max} = 45\text{ minutes}$$

When an airport $A$ closes while an inbound flight $F$ is already airborne:
1. If the required holding time until reopening is within fuel reserve ($t_{\text{hold}} \le 45\text{m}$):
   - The aircraft enters an airborne holding pattern above airport $A$.
   - Lands after reopening sequenced into the arrival queue.
2. If required holding time exceeds fuel reserve ($t_{\text{hold}} > 45\text{m}$):
   - Flight triggers an **AIRBORNE DIVERSION** to its designated regional alternate airport:
     - `BOM` &rarr; Alternate: `PNQ` (Pune), `GOI` (Goa), or `AMD` (Ahmedabad)
     - `DEL` &rarr; Alternate: `JAI` (Jaipur), `IXC` (Chandigarh), or `LKO` (Lucknow)
     - `BLR` &rarr; Alternate: `MAA` (Chennai), `COK` (Kochi), or `HYD` (Hyderabad)
   - Status updates to `DIVERTED`, destination is re-routed to the alternate airport, and downstream rotations are flagged for OCC re-assignment.

---

## 5. Passenger Connection Invariant & Automated Rebooking

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
4. **Automated Rebooking Search:**
   When a connection breaks, the engine scans the same-day network for onward flights departing after $t_{\text{pred\_arr}}(F_{\text{in}}) + \text{MCT}$ to the final destination with available seat margin ($\text{pax} + C.\text{passengers} \le 180$).
   - If found: Marked `REBOOKED` onto alternate flight.
   - If none available: Marked `STRANDED_OVERNIGHT` requiring hotel accommodation.

---

## 6. Crew Duty Limits & Standby Relief Swaps

The network features 16 crew rosters assigned to specific flight sequences:
- Duty starts at `duty_start` (typically 45–60 minutes prior to first flight departure).
- Maximum statutory duty limit:
  $$\text{Duty}_{\max} = 600\text{ minutes (10 hours)}$$
- Let $F_{\text{final}}$ be the last uncancelled flight operated by the crew in the schedule:
  $$\text{Duty}_{\text{elapsed}} = t_{\text{pred\_arr}}(F_{\text{final}}) - t_{\text{duty\_start}}$$
- **Standby Crew Replacement Policy:**
  When $\text{Duty}_{\text{elapsed}} > 600$ minutes, a standby crew relief swap (`STBY-CRxx`) is automatically assigned at the designated crew base hub (`DEL`, `BOM`, `BLR`, `HYD`, `CCU`, `MAA`, etc.), resetting the duty accumulation for remaining downline legs.

---

## 7. Deterministic Operational Risk Scoring

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

## 8. Multi-Objective Recovery Optimizer

The optimizer generates and compares **4 Pareto-distinct candidate recovery plans**:

### Recovery Cost Objective Function
$$\text{Cost} = (\text{TotalDelayMins} \times \$75) + (\text{Cancellations} \times \$12,000) + (\text{PaxAtRisk} \times \$250) + (\text{SparesDeployed} \times \$4,000) + (\text{FerryMins} \times \$50) + (\text{CrewViolations} \times \$5,000)$$

### Composite Plan Score ($0 - 100$)
$$\text{Score} = \left(\frac{\Delta_{\text{delay}}}{\max(1, \text{TotalDisruptedDelay})} \times 40\right) + (\Delta_{\text{conns}} \times 15) + (\text{OTP}_{\%} \times 0.35) - (\text{Cancels} \times 10)$$

### 4 Candidate Strategies
1. **Plan A — Maximum Schedule Reliability (Spares Priority):**
   Deploys both standby spares (`VT-DS17`, `VT-DS18`) to high-leverage delayed rotations. 0 cancellations.
2. **Plan B — Minimum Direct Operating Cost:**
   Restricts spare deployments to home-base matches only (0m ferry repositioning). Retains spare reserves.
3. **Plan C — Balanced OCC Pareto Policy (Recommended):**
   Combines 1 standby spare deployment on the primary trunk route with 1 tactical cancellation on an isolated low-load leg to sever the downline cascade.
4. **Plan D — Aggressive Cascade Severance (Schedule Reset):**
   Immediately cancels the initiating delayed flights, resetting the network to nominal OTP.

---

## 9. Real-Time Recovery Conflict Detector

The recovery engine detects operational conflicts before interventions are executed:
1. **Double Booking (`SPARE_DOUBLE_BOOKING`):** Same spare assigned to multiple concurrent flight rotations.
2. **Contradictory Actions (`CONTRADICTORY_ACTIONS`):** Flight marked both CANCELLED and targeted for spare replacement.
3. **Infeasible Ferry Repositioning (`INFEASIBLE_FERRY`):** Spare deployed at a foreign origin without explicit repositioning flight buffer.

---

## 10. Structured Simulation Facts & AI Provenance

To guarantee zero hallucination in AI Copilot responses, the engine emits 17 typed `SimulationFact` records:
- Each fact contains `metric`, `field_name`, `value`, `unit`, and `provenance` (e.g. `sim_engine.py:kpis.total_delay_minutes`).
- Every claim made in natural-language responses is cross-validated against its corresponding simulation fact.
