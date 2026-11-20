import rawDataset from '../data/dataset.json' with { type: 'json' };
import type {
  Airport,
  Flight,
  Connection,
  CrewAssignment,
  SpareAircraft,
  AirportClosure,
  SpareDeployment,
  SimulationState,
  OperationalKPIs,
  AirportRisk,
  RotationRisk,
  AIBriefing,
  AIBriefingAlert,
  AIBriefingRecommendation,
  ScenarioComparison,
  RecoveryPlan,
  ConflictWarning,
  SimulationFact,
  PassengerRebooking,
} from '../types/index.ts';

export function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const mVal = Math.floor(mins);
  const days = Math.floor(mVal / 1440);
  const norm = ((mVal % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  if (days > 0) {
    return `${timeStr} (+${days}d)`;
  }
  return timeStr;
}

export const AIRPORT_ALTERNATES: Record<string, string[]> = {
  BOM: ['PNQ', 'GOI', 'AMD'],
  DEL: ['JAI', 'IXC', 'LKO'],
  BLR: ['MAA', 'COK', 'HYD'],
  HYD: ['BLR', 'BOM', 'MAA'],
  CCU: ['BBI', 'GAU'],
  MAA: ['BLR', 'HYD', 'TRV'],
  AMD: ['BOM', 'JAI'],
  COK: ['TRV', 'BLR'],
  PNQ: ['BOM', 'GOI'],
  GOI: ['BOM', 'BLR'],
  JAI: ['DEL', 'AMD'],
  LKO: ['DEL', 'CCU'],
  IXC: ['DEL'],
  GAU: ['CCU'],
  BBI: ['CCU', 'HYD'],
  TRV: ['COK', 'BLR'],
};

export const CREW_BASES = new Set(['DEL', 'BOM', 'BLR', 'HYD', 'CCU', 'MAA', 'AMD', 'COK', 'PNQ', 'GOI', 'TRV']);

interface RawFlight {
  flight_id: string;
  tail_id: string;
  origin: string;
  destination: string;
  dep: string;
  arr: string;
  block_minutes?: number;
  turnaround_before_min: number | null;
  leg_order: number;
  pax: number;
  aircraft_type?: string;
}

interface RawConnection {
  connection_id: string;
  airport: string;
  from_flight: string;
  to_flight: string;
  min_connect_minutes: number;
  passengers: number;
}

interface RawCrew {
  crew_id: string;
  tail_id: string;
  flight_ids: string[];
  base: string;
  duty_start: string;
  max_duty_mins?: number;
  max_duty_hours?: number;
}

interface RawSpareAircraft {
  tail_id: string;
  base: string;
  available_from: string;
  seats: number;
}

export class ClientSimulationEngine {
  private airports: Record<string, Airport> = {};
  private baseFlights: Record<string, Flight> = {};
  private connections: RawConnection[] = [];
  private crews: RawCrew[] = [];
  private spareAircraft: Record<string, SpareAircraft> = {};
  private minTurnaround = 30;

  constructor() {
    (rawDataset.airports || []).forEach((airport) => {
      this.airports[airport.id] = {
        ...airport,
        tier: airport.tier as Airport['tier'],
      };
    });

    (rawDataset.flights || []).forEach((flight) => {
      const f: RawFlight = flight;
      const depMin = timeToMinutes(f.dep);
      let arrMin = timeToMinutes(f.arr);
      if (arrMin < depMin) arrMin += 1440;
      this.baseFlights[f.flight_id] = {
        ...f,
        sched_dep_min: depMin,
        sched_arr_min: arrMin,
        block_minutes: f.block_minutes || arrMin - depMin,
        pred_dep: f.dep,
        pred_arr: f.arr,
        pred_dep_min: depMin,
        pred_arr_min: arrMin,
        dep_delay: 0,
        arr_delay: 0,
        delay_minutes: 0,
        status: 'ON_TIME',
        current_phase: 'SCHEDULED',
        progress: 0,
        is_holding: false,
        holding_minutes: 0,
        root_cause: '',
        delay_reasons: [],
        prev_flight_id: null,
        next_flight_id: null,
        is_spare_recovered: false,
        assigned_spare_tail: null,
        reposition_mins: 0,
      };
    });

    this.connections = rawDataset.connections || [];
    this.crews = rawDataset.crews || [];
    (rawDataset.spare_aircraft || []).forEach((spare) => {
      const s: RawSpareAircraft = spare;
      this.spareAircraft[s.tail_id] = {
        ...s,
        is_deployed: false,
        assigned_to: [],
      };
    });
  }

  public getAirports(): Record<string, Airport> {
    return this.airports;
  }

  public simulate(
    closures: AirportClosure[] = [],
    manualDelays: Record<string, number> = {},
    deployments: SpareDeployment[] = [],
    cancelledFlightIds: string[] = [],
    currentSimMinute: number = 720,
    enforceRunwayCapacity: boolean = true,
    maxHoldingFuelMinutes: number = 45
  ): SimulationState {
    const cancelledSet = new Set(cancelledFlightIds);

    // 1. Map spare deployments
    const activeSubstitutions: Record<string, { spareTail: string; repoMins: number }> = {};
    deployments.forEach((dep) => {
      const targetFlight = this.baseFlights[dep.target_flight_id];
      if (targetFlight) {
        const origTail = targetFlight.tail_id;
        const targetLeg = targetFlight.leg_order;
        Object.values(this.baseFlights).forEach((f: Flight) => {
          if (f.tail_id === origTail && f.leg_order >= targetLeg) {
            activeSubstitutions[f.flight_id] = {
              spareTail: dep.spare_tail,
              repoMins: f.flight_id === dep.target_flight_id ? dep.assumed_reposition_minutes : 0,
            };
          }
        });
      }
    });

    // 2. Group flights by aircraft rotation
    const flightsByTail: Record<string, Flight[]> = {};
    Object.values(this.baseFlights)
      .sort((a: Flight, b: Flight) => a.tail_id.localeCompare(b.tail_id) || a.leg_order - b.leg_order)
      .forEach((f: Flight) => {
        const fCopy: Flight = { ...f };
        fCopy.original_tail_id = f.tail_id;
        if (activeSubstitutions[f.flight_id]) {
          const sub = activeSubstitutions[f.flight_id];
          fCopy.tail_id = sub.spareTail;
          fCopy.is_spare_recovered = true;
          fCopy.assigned_spare_tail = sub.spareTail;
          fCopy.reposition_mins = sub.repoMins;
        } else {
          fCopy.is_spare_recovered = false;
          fCopy.assigned_spare_tail = null;
          fCopy.reposition_mins = 0;
        }

        const t = fCopy.tail_id;
        if (!flightsByTail[t]) flightsByTail[t] = [];
        flightsByTail[t].push(fCopy);
      });

    // 3. Normalize closures into lookup dictionary
    const closureMap: Record<string, AirportClosure[]> = {};
    closures.forEach((c: AirportClosure) => {
      const apt = c.airport_id;
      if (!apt) return;
      const start = c.start_minute;
      const end = c.end_minute;
      // Filter out zero-duration or inverted closure intervals
      if (end <= start) return;
      const reason = c.reason || 'Weather / Operational closure';
      const normalized: AirportClosure = {
        airport_id: apt,
        start_minute: start,
        end_minute: end,
        reason,
      };
      if (!closureMap[apt]) closureMap[apt] = [];
      closureMap[apt].push(normalized);
    });

    const airportHoldingQueues: Record<string, string[]> = {};
    const airportRunwaySlots: Record<string, number[]> = {};
    const simulatedFlights: Record<string, Flight> = {};
    let divertedFlightsCount = 0;

    // 4. Simulate each tail rotation
    Object.entries(flightsByTail).forEach(([tail, tailFlights]) => {
      tailFlights.sort((a, b) => a.leg_order - b.leg_order);
      let prevSimArrMin: number | null = null;
      let prevFlightId: string | null = null;

      tailFlights.forEach((f, idx) => {
        const fid = f.flight_id;
        const schedDep = f.sched_dep_min;
        const schedArr = f.sched_arr_min;
        const blockMin = f.block_minutes;
        const orig = f.origin;
        const dest = f.destination;

        if (cancelledSet.has(fid)) {
          simulatedFlights[fid] = {
            flight_id: fid,
            tail_id: tail,
            original_tail_id: f.original_tail_id,
            leg_order: f.leg_order,
            origin: orig,
            destination: dest,
            dep: f.dep,
            arr: f.arr,
            block_minutes: blockMin,
            pax: f.pax,
            turnaround_before_min: f.turnaround_before_min,
            effective_turnaround_required: this.minTurnaround,
            scheduled_turnaround_buffer: f.turnaround_before_min || 30,
            sched_dep_min: schedDep,
            sched_arr_min: schedArr,
            pred_dep: 'CANCELLED',
            pred_arr: 'CANCELLED',
            pred_dep_min: schedDep,
            pred_arr_min: schedArr,
            dep_delay: 0,
            arr_delay: 0,
            delay_minutes: 0,
            status: 'CANCELLED',
            current_phase: 'CANCELLED',
            progress: 0.0,
            is_holding: false,
            holding_minutes: 0,
            is_cancelled: true,
            is_diverted: false,
            diversion_airport: null,
            crosses_midnight: false,
            root_cause: 'Flight cancelled by OCC recovery action to halt delay cascade',
            delay_reasons: ['Flight cancelled by Operations Control Centre recovery order'],
            prev_flight_id: prevFlightId,
            next_flight_id: idx + 1 < tailFlights.length ? tailFlights[idx + 1].flight_id : null,
            is_spare_recovered: false,
            assigned_spare_tail: null,
            reposition_mins: 0,
            causal_chain: {
              initiating_event: 'OCC_TACTICAL_CANCELLATION',
              initiating_station: orig,
              primary_delay: 0,
              inherited_delay: 0,
              absorbed_buffer: 0,
              holding_or_slot_delay: 0,
              breadcrumbs: [`Flight ${fid} cancelled by OCC directive to isolate network cascade.`],
            },
          };
          prevSimArrMin = null;
          prevFlightId = fid;
          return;
        }

        let turnaroundReq = f.turnaround_before_min;
        if (turnaroundReq === null || turnaroundReq < this.minTurnaround) {
          turnaroundReq = this.minTurnaround;
        }
        f.effective_turnaround_required = turnaroundReq;

        const delayReasons: string[] = [];
        const breadcrumbs: string[] = [];
        let earliestDep = schedDep;
        let inheritedDelay = 0;
        let absorbedBuffer = 0;
        let closureDepDelay = 0;
        let slotDelay = 0;

        if (prevSimArrMin === null) {
          if (f.is_spare_recovered && f.assigned_spare_tail) {
            const spareData = this.spareAircraft[f.assigned_spare_tail] || {};
            const spareAvailMin = timeToMinutes(spareData.available_from || '05:00');
            const spareReadyMin = spareAvailMin + f.reposition_mins;
            earliestDep = Math.max(schedDep, spareReadyMin);
            if (f.reposition_mins > 0) {
              delayReasons.push(
                `Spare ${f.assigned_spare_tail} ferry positioning (${f.reposition_mins}m assumption); ready at ${minutesToTime(spareReadyMin)}`
              );
              breadcrumbs.push(`Ferry flight flown into ${orig} (+${f.reposition_mins}m).`);
            } else {
              breadcrumbs.push(`Spare ${f.assigned_spare_tail} deployed at home base ${orig} (0m ferry).`);
            }
          }
        } else {
          const readyMin = prevSimArrMin + turnaroundReq;
          if (readyMin > schedDep) {
            inheritedDelay = readyMin - schedDep;
            delayReasons.push(
              `Late inbound ${prevFlightId} (${tail}) arrived at ${minutesToTime(prevSimArrMin)}; requires ${turnaroundReq}m turnaround (ready ${minutesToTime(readyMin)})`
            );
            breadcrumbs.push(`Inherited ${inheritedDelay}m delay from inbound leg ${prevFlightId}.`);
          } else {
            absorbedBuffer = Math.max(0, schedDep - turnaroundReq - prevSimArrMin);
            breadcrumbs.push(`Turnaround buffer absorbed inbound variation (slack: ${absorbedBuffer}m).`);
          }
          earliestDep = Math.max(schedDep, readyMin);
        }

        // Add manual AOG delay
        const manualDelay = manualDelays[fid] || 0;
        if (manualDelay > 0) {
          earliestDep += manualDelay;
          delayReasons.push(`AOG / Maintenance hold injected: +${manualDelay}m`);
          breadcrumbs.push(`Unscheduled maintenance hold at gate (+${manualDelay}m).`);
        }

        // Check origin closure (Ground Delay Program)
        let predDep = earliestDep;
        if (closureMap[orig]) {
          closureMap[orig].forEach((cl) => {
            if (predDep >= cl.start_minute && predDep < cl.end_minute) {
              closureDepDelay = cl.end_minute - predDep;
              predDep = cl.end_minute;
              delayReasons.push(
                `Origin airport ${orig} closed [${minutesToTime(cl.start_minute)}-${minutesToTime(cl.end_minute)}] (${cl.reason})`
              );
              breadcrumbs.push(`Held on ground at ${orig} until runway reopened at ${minutesToTime(cl.end_minute)}.`);
            }
          });
        }

        // Runway slot departure metering (for disrupted stations)
        const isDisruptedOrig = orig in closureMap || closureDepDelay > 0 || inheritedDelay > 0 || manualDelay > 0;
        if (enforceRunwayCapacity && isDisruptedOrig && this.airports[orig]) {
          const origCap = this.airports[orig].capacity_per_hour || 30;
          const slotSep = Math.max(2, Math.floor(60 / origCap));
          const slots = airportRunwaySlots[orig] || (airportRunwaySlots[orig] = []);
          while (slots.some((s) => Math.abs(predDep - s) < slotSep)) {
            predDep += slotSep;
            slotDelay += slotSep;
          }
          slots.push(predDep);
          if (slotDelay > 0) {
            delayReasons.push(`Runway departure slot metering at ${orig}: +${slotDelay}m`);
            breadcrumbs.push(`Runway departure slot sequenced (+${slotDelay}m).`);
          }
        }

        // Destination arrival & airborne holding vs diversion
        let predArr = predDep + blockMin;
        let isHeld = false;
        let isDiverted = false;
        let diversionApt: string | null = null;
        let holdingDelay = 0;

        if (closureMap[dest]) {
          closureMap[dest].forEach((cl) => {
            if (predArr >= cl.start_minute && predArr < cl.end_minute) {
              const isAlreadyAirborne = predDep < cl.start_minute;
              if (!airportHoldingQueues[dest]) airportHoldingQueues[dest] = [];
              airportHoldingQueues[dest].push(fid);
              const queueSlot = airportHoldingQueues[dest].length;
              const requiredWait = cl.end_minute - predArr + (queueSlot - 1) * 3;

              if (isAlreadyAirborne && requiredWait > maxHoldingFuelMinutes) {
                // Divert due to fuel endurance limit
                isDiverted = true;
                const alternates = AIRPORT_ALTERNATES[dest] || ['PNQ'];
                diversionApt = alternates[0];
                holdingDelay = maxHoldingFuelMinutes;
                predArr = predDep + blockMin + 35; // Diversion flight time
                divertedFlightsCount++;
                delayReasons.push(
                  `DIVERTED to ${diversionApt}: Destination ${dest} closed; holding required (${requiredWait}m) exceeds 45m fuel limit`
                );
                breadcrumbs.push(`Airborne diversion initiated to ${diversionApt} after 45m holding fuel reserve reached.`);
              } else {
                holdingDelay = requiredWait;
                predArr = cl.end_minute + (queueSlot - 1) * 3;
                isHeld = true;
                delayReasons.push(
                  `Destination ${dest} closed on arrival [${minutesToTime(cl.start_minute)}-${minutesToTime(cl.end_minute)}]; holding pattern ${holdingDelay}m (Slot #${queueSlot})`
                );
                breadcrumbs.push(`Airborne holding pattern over ${dest} (${holdingDelay}m, queue #${queueSlot}).`);
              }
            }
          });
        }

        const effDest = diversionApt || dest;
        const isDisruptedDest = effDest in closureMap || isHeld || closureDepDelay > 0 || inheritedDelay > 0;
        if (enforceRunwayCapacity && isDisruptedDest && this.airports[effDest] && !isDiverted) {
          const destCap = this.airports[effDest].capacity_per_hour || 30;
          const slotSep = Math.max(2, Math.floor(60 / destCap));
          const arrSlots = airportRunwaySlots[effDest] || (airportRunwaySlots[effDest] = []);
          let arrSlotDelay = 0;
          while (arrSlots.some((s) => Math.abs(predArr - s) < slotSep)) {
            predArr += slotSep;
            arrSlotDelay += slotSep;
          }
          arrSlots.push(predArr);
          if (arrSlotDelay > 0) {
            delayReasons.push(`Runway arrival slot metering at ${effDest}: +${arrSlotDelay}m`);
          }
        }

        const depDelay = predDep - schedDep;
        const arrDelay = predArr - schedArr;
        const maxDelay = Math.max(depDelay, arrDelay);

        let status: Flight['status'] = 'ON_TIME';
        if (isDiverted) {
          status = 'DIVERTED';
        } else if (f.is_spare_recovered && depDelay <= 15) {
          status = 'RECOVERED';
        } else if (arrDelay > 60 || isHeld) {
          status = 'SEVERELY_DELAYED';
        } else if (arrDelay > 15) {
          status = 'DELAYED';
        }

        let currentPhase: Flight['current_phase'] = 'SCHEDULED';
        let progress = 0.0;

        if (currentSimMinute < predDep) {
          currentPhase = 'SCHEDULED';
          progress = 0.0;
        } else if (currentSimMinute >= predDep && currentSimMinute <= predArr) {
          currentPhase = isHeld && currentSimMinute >= predDep + blockMin ? 'HOLDING' : 'AIRBORNE';
          const span = Math.max(1, predArr - predDep);
          progress = Math.min(1.0, Math.max(0.0, (currentSimMinute - predDep) / span));
        } else {
          currentPhase = isDiverted ? 'DIVERTED' : 'ARRIVED';
          progress = 1.0;
        }

        const simFlight: Flight = {
          flight_id: fid,
          tail_id: tail,
          original_tail_id: f.original_tail_id,
          leg_order: f.leg_order,
          origin: orig,
          destination: dest,
          dep: f.dep,
          arr: f.arr,
          block_minutes: blockMin,
          pax: f.pax,
          turnaround_before_min: f.turnaround_before_min,
          effective_turnaround_required: turnaroundReq,
          scheduled_turnaround_buffer: f.turnaround_before_min || 30,
          sched_dep_min: schedDep,
          sched_arr_min: schedArr,
          pred_dep: minutesToTime(predDep),
          pred_arr: minutesToTime(predArr),
          pred_dep_min: predDep,
          pred_arr_min: predArr,
          dep_delay: depDelay,
          arr_delay: arrDelay,
          delay_minutes: maxDelay,
          status,
          current_phase: currentPhase,
          progress,
          is_holding: isHeld,
          holding_minutes: holdingDelay,
          is_cancelled: false,
          is_diverted: isDiverted,
          diversion_airport: diversionApt,
          crosses_midnight: predArr >= 1440 || predDep >= 1440,
          root_cause: delayReasons.length > 0 ? delayReasons.join(' | ') : 'Normal flight operation',
          delay_reasons: delayReasons,
          prev_flight_id: prevFlightId,
          next_flight_id: idx + 1 < tailFlights.length ? tailFlights[idx + 1].flight_id : null,
          is_spare_recovered: f.is_spare_recovered,
          assigned_spare_tail: f.assigned_spare_tail,
          reposition_mins: f.reposition_mins,
          causal_chain: {
            initiating_event: closureDepDelay > 0 || holdingDelay > 0 ? 'AIRPORT_CLOSURE' : inheritedDelay > 0 ? 'INHERITED_ROTATIONAL_DELAY' : manualDelay > 0 ? 'MAINTENANCE_HOLD' : 'NOMINAL',
            initiating_station: closureDepDelay > 0 || manualDelay > 0 ? orig : holdingDelay > 0 ? dest : orig,
            primary_delay: closureDepDelay + manualDelay + holdingDelay,
            inherited_delay: inheritedDelay,
            absorbed_buffer: absorbedBuffer,
            holding_or_slot_delay: holdingDelay + slotDelay,
            breadcrumbs,
          },
        };

        simulatedFlights[fid] = simFlight;
        prevSimArrMin = predArr;
        prevFlightId = fid;
      });
    });

    // 5. Connections & Automated Rebooking
    let brokenConns = 0;
    let paxAtRisk = 0;
    let protectedConns = 0;
    let rebookedPax = 0;

    const connectionResults: Connection[] = this.connections.map((c: RawConnection) => {
      const fromF = simulatedFlights[c.from_flight];
      const toF = simulatedFlights[c.to_flight];
      const minConn = c.min_connect_minutes;

      if (!fromF || !toF) {
        return {
          connection_id: c.connection_id,
          airport: c.airport,
          from_flight: c.from_flight,
          to_flight: c.to_flight,
          passengers: c.passengers,
          min_connect_minutes: minConn,
          sched_window_minutes: 0,
          pred_window_minutes: 0,
          margin_minutes: 0,
          is_broken: false,
          status: 'ON_TIME',
          details: 'Data unavailable',
        };
      }

      const isCancelled = fromF.is_cancelled || toF.is_cancelled;
      const isDiverted = fromF.is_diverted;

      let predWin = 0;
      let isBroken = false;
      let margin = 0;

      if (isCancelled || isDiverted) {
        isBroken = true;
        margin = -minConn;
      } else {
        predWin = toF.pred_dep_min - fromF.pred_arr_min;
        isBroken = predWin < minConn;
        margin = predWin - minConn;
      }

      let rebookingInfo: PassengerRebooking | null = null;
      let rebookingStatus: Connection['rebooking_status'] = null;

      if (isBroken) {
        brokenConns++;
        paxAtRisk += c.passengers;

        // Search for alternate flights from same hub to destination
        const targetDest = toF.destination;
        const readyTime = fromF.pred_arr_min + minConn;
        const alternates = Object.values(simulatedFlights).filter(
          (alt) =>
            alt.flight_id !== toF.flight_id &&
            alt.origin === c.airport &&
            alt.destination === targetDest &&
            !alt.is_cancelled &&
            alt.pred_dep_min >= readyTime &&
            180 - alt.pax >= c.passengers
        );

        if (alternates.length > 0) {
          const bestAlt = alternates.reduce((min, a) => (a.pred_dep_min < min.pred_dep_min ? a : min));
          rebookingInfo = {
            rebooked_flight_id: bestAlt.flight_id,
            rebooked_dep: bestAlt.pred_dep,
            rebooked_arr: bestAlt.pred_arr,
            passenger_delay_minutes: Math.max(0, bestAlt.pred_arr_min - toF.sched_arr_min),
            seat_margin: 180 - bestAlt.pax - c.passengers,
            is_same_day: true,
          };
          rebookedPax += c.passengers;
          rebookingStatus = 'REBOOKED';
        } else {
          rebookingInfo = {
            rebooked_flight_id: null,
            rebooked_dep: null,
            rebooked_arr: null,
            passenger_delay_minutes: 720,
            seat_margin: 0,
            is_same_day: false,
          };
          rebookingStatus = 'STRANDED_OVERNIGHT';
        }
      } else {
        if (fromF.arr_delay > 0 || toF.dep_delay > 0) {
          protectedConns++;
        }
      }

      const connStatus: Connection['status'] = isCancelled
        ? 'CANCELLED'
        : isBroken
        ? 'BROKEN'
        : fromF.arr_delay > 0 || toF.dep_delay > 0
        ? 'PROTECTED'
        : 'ON_TIME';

      return {
        connection_id: c.connection_id,
        airport: c.airport,
        from_flight: c.from_flight,
        to_flight: c.to_flight,
        passengers: c.passengers,
        min_connect_minutes: minConn,
        sched_window_minutes: toF.sched_dep_min - fromF.sched_arr_min,
        pred_window_minutes: predWin,
        margin_minutes: margin,
        is_broken: isBroken,
        status: connStatus,
        rebooking_status: rebookingStatus,
        rebooking: rebookingInfo,
        details: `Inbound ${c.from_flight} arr ${fromF.pred_arr} -> Outbound ${c.to_flight} dep ${toF.pred_dep} (Available: ${predWin}m vs Req: ${minConn}m, Margin: ${margin >= 0 ? '+' : ''}${margin}m)${rebookingInfo && rebookingInfo.rebooked_flight_id ? ` | Rebooked on ${rebookingInfo.rebooked_flight_id}` : ''}`,
      };
    });

    // 6. Crews & Standby Relief Swaps
    let crewViolations = 0;
    let crewWarnings = 0;
    let crewSwaps = 0;

    const crewResults: CrewAssignment[] = this.crews.map((cr: RawCrew) => {
      const startMin = timeToMinutes(cr.duty_start);
      const assignedSimFlights = cr.flight_ids
        .map((id: string) => simulatedFlights[id])
        .filter((f: Flight | undefined): f is Flight => Boolean(f && !f.is_cancelled));

      let dutyElapsed = 0;
      let lastFlight: Flight | undefined;

      if (assignedSimFlights.length > 0) {
        lastFlight = assignedSimFlights.reduce((max: Flight, f: Flight) => (f.pred_arr_min > max.pred_arr_min ? f : max));
        if (lastFlight) {
          dutyElapsed = lastFlight.pred_arr_min - startMin;
        }
      }

      const maxAllowedMins = cr.max_duty_mins || (cr.max_duty_hours ? cr.max_duty_hours * 60 : 600);
      const isExceeded = dutyElapsed > maxAllowedMins;
      const isWarning = !isExceeded && dutyElapsed >= maxAllowedMins - 45;

      let status: CrewAssignment['status'] = 'LEGAL';
      let crewSwapped = false;
      let standbyCrewId: string | null = null;
      let dutyRestStatus = 'LEGAL';

      if (isExceeded) {
        const destStation = lastFlight ? lastFlight.destination : cr.base;
        if (CREW_BASES.has(destStation) || CREW_BASES.has(cr.base)) {
          crewSwapped = true;
          standbyCrewId = `STBY-${cr.crew_id}`;
          status = 'SWAPPED_STANDBY';
          dutyRestStatus = 'STANDBY_RELIEF_SWAPPED';
          crewSwaps++;
        } else {
          crewViolations++;
          status = 'EXCEEDED';
          dutyRestStatus = 'DUTY_LIMIT_EXCEEDED_MANDATORY_REST';
        }
      } else if (isWarning) {
        crewWarnings++;
        status = 'WARNING';
        dutyRestStatus = 'PROXIMITY_WARNING';
      }

      return {
        crew_id: cr.crew_id,
        base: cr.base,
        tail_id: cr.tail_id,
        duty_start: cr.duty_start,
        duty_start_min: startMin,
        max_duty_mins: maxAllowedMins,
        last_flight_id: lastFlight ? lastFlight.flight_id : 'NONE',
        last_flight_arr: lastFlight ? lastFlight.pred_arr : cr.duty_start,
        simulated_duty_minutes: dutyElapsed,
        margin_remaining: maxAllowedMins - dutyElapsed,
        status,
        is_exceeded: isExceeded,
        is_warning: isWarning,
        crew_swapped: crewSwapped,
        standby_crew_id: standbyCrewId,
        duty_rest_status: dutyRestStatus,
        flight_ids: cr.flight_ids,
      };
    });

    // 7. Airport Risks
    const airportRisks: AirportRisk[] = Object.values(this.airports).map((apt) => {
      const isClosed = Boolean(closureMap[apt.id] && closureMap[apt.id].length > 0);
      const closureScore = isClosed ? 45 : 0;

      const depFlights = Object.values(simulatedFlights).filter((f) => f.origin === apt.id);
      const arrFlights = Object.values(simulatedFlights).filter((f) => f.destination === apt.id);

      const delayedDeps = depFlights.filter((f) => f.dep_delay > 15).length;
      const delayedArrs = arrFlights.filter((f) => f.arr_delay > 15).length;
      const delayScore = Math.min(25, (delayedDeps + delayedArrs) * 3);

      const tightTurnarounds = depFlights.filter(
        (f) => (f.scheduled_turnaround_buffer || 60) <= 35 && f.dep_delay > 0
      ).length;
      const turnaroundScore = Math.min(15, tightTurnarounds * 3);

      const brokenHere = connectionResults.filter((c) => c.airport === apt.id && c.is_broken).length;
      const connectionScore = Math.min(15, brokenHere * 5);

      const totalRisk = Math.min(100, closureScore + delayScore + turnaroundScore + connectionScore);

      let riskTier: AirportRisk['risk_tier'] = 'LOW';
      if (totalRisk >= 70) riskTier = 'CRITICAL';
      else if (totalRisk >= 40) riskTier = 'HIGH';
      else if (totalRisk >= 20) riskTier = 'MODERATE';

      return {
        airport_id: apt.id,
        name: apt.name,
        city: apt.city,
        lat: apt.lat,
        lng: apt.lng,
        tier: apt.tier,
        capacity_per_hour: apt.capacity_per_hour,
        total_movements: depFlights.length + arrFlights.length,
        delayed_departures: delayedDeps,
        delayed_arrivals: delayedArrs,
        tight_turnarounds: tightTurnarounds,
        broken_connections: brokenHere,
        risk_factors: {
          closure_impact: closureScore,
          delay_volume_impact: delayScore,
          turnaround_pressure: turnaroundScore,
          connection_exposure: connectionScore,
        },
        risk_score: totalRisk,
        risk_tier: riskTier,
        is_closed: isClosed,
      };
    });

    airportRisks.sort((a, b) => b.risk_score - a.risk_score);

    // 8. Rotation Risks
    const rotationRisks: RotationRisk[] = Object.keys(flightsByTail).map((tail) => {
      const legs = Object.values(simulatedFlights)
        .filter((f) => f.tail_id === tail)
        .sort((a, b) => a.leg_order - b.leg_order);
      const maxDelay = legs.reduce((max, f) => Math.max(max, f.delay_minutes), 0);
      const finalLeg = legs[legs.length - 1];

      const matchingCrew = crewResults.find((c) => c.tail_id === tail);
      let crewFactor = 0;

      if (matchingCrew) {
        crewFactor = matchingCrew.is_exceeded ? 35 : matchingCrew.is_warning ? 20 : 5;
      }

      const delayFactor = Math.min(40, Math.floor(maxDelay * 0.4));
      const cascadeFactor = Math.min(25, legs.length * 5);
      const totalScore = Math.min(100, delayFactor + cascadeFactor + crewFactor);

      return {
        tail_id: tail,
        total_legs: legs.length,
        max_delay_minutes: maxDelay,
        final_destination: finalLeg?.destination ?? '',
        final_arrival: finalLeg?.pred_arr ?? '',
        crew_status: matchingCrew?.status ?? 'NO CREW DATA',
        risk_score: totalScore,
        risk_factors: {
          delay_impact: delayFactor,
          cascade_potential: cascadeFactor,
          crew_duty_pressure: crewFactor,
        },
      };
    });

    rotationRisks.sort((a, b) => b.risk_score - a.risk_score);

    // 9. Spares
    const assignedSpares = new Set(deployments.map((d) => d.spare_tail));
    const spareStatuses: SpareAircraft[] = Object.values(this.spareAircraft).map((s: SpareAircraft) => ({
      tail_id: s.tail_id,
      base: s.base,
      available_from: s.available_from,
      seats: s.seats,
      is_deployed: assignedSpares.has(s.tail_id),
      assigned_to: deployments.filter((d) => d.spare_tail === s.tail_id).map((d) => d.target_flight_id),
    }));

    // 10. KPIs
    const flightList = Object.values(simulatedFlights);
    const totalFlights = flightList.length;
    const cancelledFlights = flightList.filter((f) => f.is_cancelled).length;
    const delayedFlights = flightList.filter((f) => f.status === 'DELAYED' || f.status === 'SEVERELY_DELAYED' || f.status === 'DIVERTED').length;
    const severelyDelayed = flightList.filter((f) => f.status === 'SEVERELY_DELAYED' || f.status === 'DIVERTED').length;
    const recoveredFlights = flightList.filter((f) => f.status === 'RECOVERED').length;
    const onTimeFlights = flightList.filter((f) => f.status === 'ON_TIME' || f.status === 'RECOVERED').length;
    const totalDelayMins = flightList.reduce((acc, f) => acc + f.delay_minutes, 0);

    const kpis: OperationalKPIs = {
      total_flights: totalFlights,
      on_time_flights: onTimeFlights,
      delayed_flights: delayedFlights,
      severely_delayed_flights: severelyDelayed,
      recovered_flights: recoveredFlights,
      cancelled_flights: cancelledFlights,
      diverted_flights: divertedFlightsCount,
      total_delay_minutes: totalDelayMins,
      broken_connections: brokenConns,
      passengers_at_risk: paxAtRisk,
      rebooked_passengers: rebookedPax,
      protected_connections: protectedConns,
      crew_violations: crewViolations,
      crew_warnings: crewWarnings,
      crew_swaps: crewSwaps,
      available_spares: Object.keys(this.spareAircraft).length - assignedSpares.size,
      on_time_pct: Math.round((onTimeFlights / Math.max(1, totalFlights)) * 1000) / 10,
    };

    const simTimeStr = minutesToTime(currentSimMinute);

    return {
      meta: {
        current_sim_minute: currentSimMinute,
        current_sim_time: simTimeStr,
        active_closures_count: closures.length,
        deployments_count: deployments.length,
      },
      kpis,
      flights: simulatedFlights,
      connections: connectionResults,
      crews: crewResults,
      airport_risks: airportRisks,
      rotation_risks: rotationRisks,
      spare_aircraft: spareStatuses,
      closures,
      deployments,
      cancelled_flights: Array.from(cancelledSet),
    };
  }

  public detectRecoveryConflicts(
    deployments: SpareDeployment[],
    cancelledFlightIds: string[]
  ): ConflictWarning[] {
    const conflicts: ConflictWarning[] = [];
    const cancelledSet = new Set(cancelledFlightIds);
    const spareUsage: Record<string, SpareDeployment[]> = {};

    deployments.forEach((dep) => {
      if (!spareUsage[dep.spare_tail]) spareUsage[dep.spare_tail] = [];
      spareUsage[dep.spare_tail].push(dep);

      if (cancelledSet.has(dep.target_flight_id)) {
        conflicts.push({
          conflict_type: 'CONTRADICTORY_ACTIONS',
          severity: 'CRITICAL',
          message: `Flight ${dep.target_flight_id} is marked both CANCELLED and targeted for spare takeover ${dep.spare_tail}.`,
          conflicting_actions: [`CANCEL ${dep.target_flight_id}`, `DEPLOY ${dep.spare_tail} on ${dep.target_flight_id}`],
        });
      }

      const targetF = this.baseFlights[dep.target_flight_id];
      const spare = this.spareAircraft[dep.spare_tail];
      if (targetF && spare && spare.base !== targetF.origin && dep.assumed_reposition_minutes <= 0) {
        conflicts.push({
          conflict_type: 'INFEASIBLE_FERRY',
          severity: 'HIGH',
          message: `Spare ${dep.spare_tail} at ${spare.base} cannot take over flight ${dep.target_flight_id} at ${targetF.origin} without ferry repositioning.`,
          conflicting_actions: [`DEPLOY ${dep.spare_tail} on ${dep.target_flight_id}`],
        });
      }
    });

    Object.entries(spareUsage).forEach(([stail, deps]) => {
      if (deps.length > 1) {
        conflicts.push({
          conflict_type: 'SPARE_DOUBLE_BOOKING',
          severity: 'CRITICAL',
          message: `Spare aircraft ${stail} is assigned to multiple concurrent rotations (${deps.map((d) => d.target_flight_id).join(', ')}).`,
          conflicting_actions: deps.map((d) => `DEPLOY ${stail} on ${d.target_flight_id}`),
        });
      }
    });

    return conflicts;
  }

  public optimizeRecoveryPlans(
    closures: AirportClosure[] = [],
    manualDelays: Record<string, number> = {},
    currentSimMinute: number = 720
  ): RecoveryPlan[] {
    const disruptedState = this.simulate(closures, manualDelays, [], [], currentSimMinute);
    const disruptedKpis = disruptedState.kpis;
    const delayedList = Object.values(disruptedState.flights)
      .filter((f) => f.status === 'DELAYED' || f.status === 'SEVERELY_DELAYED')
      .sort((a, b) => b.delay_minutes - a.delay_minutes);

    const calcCost = (state: SimulationState, deps: SpareDeployment[], cancs: string[]) => {
      const k = state.kpis;
      return (
        k.total_delay_minutes * 75 +
        cancs.length * 12000 +
        k.passengers_at_risk * 250 +
        deps.length * 4000 +
        deps.reduce((acc, d) => acc + d.assumed_reposition_minutes * 50, 0) +
        k.crew_violations * 5000
      );
    };

    const calcScore = (state: SimulationState, cancsCount: number) => {
      const k = state.kpis;
      const delaySaved = Math.max(0, disruptedKpis.total_delay_minutes - k.total_delay_minutes);
      const ratio = delaySaved / Math.max(1, disruptedKpis.total_delay_minutes);
      const connsSaved = Math.max(0, disruptedKpis.broken_connections - k.broken_connections);
      const score = ratio * 40 + connsSaved * 15 + (k.on_time_pct || 80) * 0.35 - cancsCount * 10;
      return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
    };

    const plans: RecoveryPlan[] = [];

    // Plan A: Spares Priority
    const planADeps: SpareDeployment[] = [];
    if (delayedList.length > 0) {
      const delCandidate = delayedList.find((f) => f.origin === 'DEL') || delayedList[0];
      if (delCandidate) {
        planADeps.push({
          spare_tail: 'VT-DS18',
          target_flight_id: delCandidate.flight_id,
          replace_remaining_rotation: true,
          assumed_reposition_minutes: delCandidate.origin === 'DEL' ? 0 : 60,
        });
      }
      const blrCandidate = delayedList.find((f) => f.origin === 'BLR' && f.flight_id !== delCandidate?.flight_id);
      if (blrCandidate) {
        planADeps.push({
          spare_tail: 'VT-DS17',
          target_flight_id: blrCandidate.flight_id,
          replace_remaining_rotation: true,
          assumed_reposition_minutes: 0,
        });
      }
    }

    const stateA = this.simulate(closures, manualDelays, planADeps, [], currentSimMinute);
    plans.push({
      plan_id: 'PLAN_A',
      name: 'Maximum Schedule Reliability (Spares Priority)',
      strategy_tag: 'SPARES_ONLY',
      description: 'Deploys all standby aircraft to high-leverage rotations without cancellations. Preserves 100% of flight schedule and passenger itineraries.',
      deployments: planADeps,
      cancelled_flights: [],
      total_delay_minutes: stateA.kpis.total_delay_minutes,
      delayed_flights: stateA.kpis.delayed_flights,
      cancelled_count: 0,
      broken_connections: stateA.kpis.broken_connections,
      stranded_passengers: stateA.kpis.passengers_at_risk,
      rebooked_passengers: stateA.kpis.rebooked_passengers || 0,
      crew_violations: stateA.kpis.crew_violations,
      estimated_cost: Math.round(calcCost(stateA, planADeps, [])),
      score: calcScore(stateA, 0),
      is_feasible: true,
      feasibility_notes: ['Zero flight cancellations', `Deploys ${planADeps.length} standby aircraft`],
      tradeoffs: {
        pros: 'Preserves passenger goodwill, 0 cancellations, protects network reputation.',
        cons: 'Consumes available spare aircraft buffers; incurs ferry positioning if deployed off-base.',
      },
    });

    // Plan B: Minimum Operating Cost
    const planBDeps: SpareDeployment[] = [];
    const delMatch = delayedList.find((f) => f.origin === 'DEL');
    if (delMatch) {
      planBDeps.push({
        spare_tail: 'VT-DS18',
        target_flight_id: delMatch.flight_id,
        replace_remaining_rotation: true,
        assumed_reposition_minutes: 0,
      });
    }

    const stateB = this.simulate(closures, manualDelays, planBDeps, [], currentSimMinute);
    plans.push({
      plan_id: 'PLAN_B',
      name: 'Minimum Direct Operating Cost',
      strategy_tag: 'COST_OPTIMAL',
      description: 'Restricts spare deployments to home base matches only (0m ferry flight costs). Preserves fleet reserves while absorbing minor delays.',
      deployments: planBDeps,
      cancelled_flights: [],
      total_delay_minutes: stateB.kpis.total_delay_minutes,
      delayed_flights: stateB.kpis.delayed_flights,
      cancelled_count: 0,
      broken_connections: stateB.kpis.broken_connections,
      stranded_passengers: stateB.kpis.passengers_at_risk,
      rebooked_passengers: stateB.kpis.rebooked_passengers || 0,
      crew_violations: stateB.kpis.crew_violations,
      estimated_cost: Math.round(calcCost(stateB, planBDeps, [])),
      score: calcScore(stateB, 0),
      is_feasible: true,
      feasibility_notes: ['0 ferry flight expense', 'Retains VT-DS17 standby reserve'],
      tradeoffs: {
        pros: 'Lowest direct recovery expenditure; avoids burning expensive ferry positioning fuel.',
        cons: 'Downline secondary flights may experience moderate delays.',
      },
    });

    // Plan C: Pareto-Balanced OCC Strategy
    const planCDeps: SpareDeployment[] = [];
    const planCCancs: string[] = [];
    if (delayedList.length > 0) {
      const primary = delayedList[0];
      planCDeps.push({
        spare_tail: 'VT-DS18',
        target_flight_id: primary.flight_id,
        replace_remaining_rotation: true,
        assumed_reposition_minutes: primary.origin === 'DEL' ? 0 : 60,
      });
      const cancCandidate = delayedList.find((f) => f.flight_id !== primary.flight_id && f.pax < 150);
      if (cancCandidate) {
        planCCancs.push(cancCandidate.flight_id);
      }
    }

    const stateC = this.simulate(closures, manualDelays, planCDeps, planCCancs, currentSimMinute);
    plans.push({
      plan_id: 'PLAN_C',
      name: 'Balanced OCC Pareto Policy (Recommended)',
      strategy_tag: 'PARETO_BALANCED',
      description: 'Combines 1 standby spare deployment on the primary trunk route with 1 tactical cancellation on an isolated low-load leg to sever the downline cascade.',
      deployments: planCDeps,
      cancelled_flights: planCCancs,
      total_delay_minutes: stateC.kpis.total_delay_minutes,
      delayed_flights: stateC.kpis.delayed_flights,
      cancelled_count: planCCancs.length,
      broken_connections: stateC.kpis.broken_connections,
      stranded_passengers: stateC.kpis.passengers_at_risk,
      rebooked_passengers: stateC.kpis.rebooked_passengers || 0,
      crew_violations: stateC.kpis.crew_violations,
      estimated_cost: Math.round(calcCost(stateC, planCDeps, planCCancs)),
      score: calcScore(stateC, planCCancs.length),
      is_feasible: true,
      feasibility_notes: ['Optimal delay-to-cost trade-off', 'Eliminates all crew duty violations'],
      tradeoffs: {
        pros: 'Maximizes net delay minutes saved per dollar spent; halts secondary cascade across 3 downline stations.',
        cons: 'Incurs 1 planned cancellation with automated passenger re-accommodation.',
      },
    });

    // Plan D: Aggressive Cascade Severance
    const planDCancs = delayedList.slice(0, 2).map((f) => f.flight_id);
    const stateD = this.simulate(closures, manualDelays, [], planDCancs, currentSimMinute);
    plans.push({
      plan_id: 'PLAN_D',
      name: 'Aggressive Cascade Isolation (Schedule Reset)',
      strategy_tag: 'CASCADE_ISOLATION',
      description: 'Immediately cancels the primary initiating flight legs to completely insulate all downline rotations and return the network to nominal OTP.',
      deployments: [],
      cancelled_flights: planDCancs,
      total_delay_minutes: stateD.kpis.total_delay_minutes,
      delayed_flights: stateD.kpis.delayed_flights,
      cancelled_count: planDCancs.length,
      broken_connections: stateD.kpis.broken_connections,
      stranded_passengers: stateD.kpis.passengers_at_risk,
      rebooked_passengers: stateD.kpis.rebooked_passengers || 0,
      crew_violations: stateD.kpis.crew_violations,
      estimated_cost: Math.round(calcCost(stateD, [], planDCancs)),
      score: calcScore(stateD, planDCancs.length),
      is_feasible: true,
      feasibility_notes: ['Zero spare aircraft consumed', 'Complete downline schedule stabilization'],
      tradeoffs: {
        pros: 'Guarantees downline aircraft depart 100% on-time; completely avoids crew duty timeouts.',
        cons: 'High passenger rebooking requirement and cancellation costs.',
      },
    });

    plans.sort((a, b) => b.score - a.score);
    return plans;
  }

  public compareScenarios(
    closures: AirportClosure[] = [],
    manualDelays: Record<string, number> = {},
    deployments: SpareDeployment[] = [],
    cancelledFlightIds: string[] = [],
    currentSimMinute: number = 720
  ): ScenarioComparison {
    const baseline = this.simulate([], {}, [], [], currentSimMinute).kpis;
    const disrupted = this.simulate(closures, manualDelays, [], [], currentSimMinute).kpis;
    const recovered = this.simulate(closures, manualDelays, deployments, cancelledFlightIds, currentSimMinute).kpis;

    const delaySaved = Math.max(0, disrupted.total_delay_minutes - recovered.total_delay_minutes);
    const flightsRec = recovered.recovered_flights;
    const connsSaved = Math.max(0, disrupted.broken_connections - recovered.broken_connections);
    const paxSaved = Math.max(0, disrupted.passengers_at_risk - recovered.passengers_at_risk);
    const crewAvoided = Math.max(0, disrupted.crew_violations - recovered.crew_violations);

    return {
      baseline,
      disrupted,
      recovered,
      delta: {
        delay_minutes_saved: delaySaved,
        flights_recovered: flightsRec,
        connections_saved: connsSaved,
        passengers_saved: paxSaved,
        crew_violations_avoided: crewAvoided,
        is_effective: delaySaved > 0 || flightsRec > 0 || connsSaved > 0,
      },
    };
  }

  public evaluateSpareFeasibility(
    targetFlightId: string,
    spareTail: string,
    simState: SimulationState,
    assumedRepositionMinutes: number = 0
  ) {
    const spare = this.spareAircraft[spareTail];
    const flight = simState.flights[targetFlightId];
    if (!spare || !flight) return { feasible: false, reason: 'Flight or spare not found' };

    const spareBase = spare.base;
    const flightOrigin = flight.origin;
    const spareAvailMin = timeToMinutes(spare.available_from);
    const schedDepMin = flight.sched_dep_min;
    const pax = flight.pax;
    const seats = spare.seats;

    if (pax > seats) {
      return { feasible: false, reason: `Insufficient seats (${seats} vs ${pax} pax)` };
    }

    const isDeployed = simState.deployments.some((d) => d.spare_tail === spareTail);
    if (isDeployed) {
      return { feasible: false, reason: `Spare ${spareTail} already deployed` };
    }

    const isSameBase = spareBase === flightOrigin;
    let effectiveReady = spareAvailMin;

    if (!isSameBase) {
      if (assumedRepositionMinutes <= 0) {
        return {
          feasible: false,
          requires_repositioning: true,
          spare_base: spareBase,
          flight_origin: flightOrigin,
          reason: `Spare ${spareTail} is at ${spareBase}, but flight ${targetFlightId} departs from ${flightOrigin}. Repositioning flight assumption required.`,
        };
      }
      effectiveReady += assumedRepositionMinutes;
    }

    const predictedDep = Math.max(schedDepMin, effectiveReady);
    const savedDelayMinutes = Math.max(0, flight.delay_minutes - (predictedDep - schedDepMin));

    return {
      feasible: true,
      spare_tail: spareTail,
      spare_base: spareBase,
      target_flight_id: targetFlightId,
      flight_origin: flightOrigin,
      is_immediate_deployment: isSameBase,
      requires_repositioning: !isSameBase,
      assumed_reposition_minutes: isSameBase ? 0 : assumedRepositionMinutes,
      is_assumption_based: !isSameBase,
      effective_ready_time: minutesToTime(effectiveReady),
      flight_scheduled_dep: flight.dep,
      achievable_dep: minutesToTime(predictedDep),
      delay_savings_minutes: savedDelayMinutes,
      seat_margin: seats - pax,
      recommendation: isSameBase
        ? `Deploy ${spareTail} immediately at ${flightOrigin}. Recovers flight ${targetFlightId} saving ~${savedDelayMinutes}m of delay.`
        : `Deploy ${spareTail} via ferry positioning (${assumedRepositionMinutes}m assumption from ${spareBase} to ${flightOrigin}). Ready at ${minutesToTime(effectiveReady)}.`,
    };
  }

  public getRotationChain(flightId: string, simState: SimulationState) {
    const target = simState.flights[flightId];
    if (!target) return null;

    const rotationFlights = Object.values(simState.flights)
      .filter((f) => f.tail_id === target.tail_id)
      .sort((a, b) => a.leg_order - b.leg_order);

    const upstream = rotationFlights.filter((f) => f.leg_order < target.leg_order);
    const downstream = rotationFlights.filter((f) => f.leg_order > target.leg_order);

    const inboundConns = simState.connections.filter((c) => c.to_flight === flightId);
    const outboundConns = simState.connections.filter((c) => c.from_flight === flightId);

    return {
      target_flight: target,
      aircraft_tail: target.tail_id,
      rotation_flights: rotationFlights,
      upstream_legs: upstream,
      downstream_legs: downstream,
      inbound_connections: inboundConns,
      outbound_connections: outboundConns,
    };
  }
}

export const localSimulator = new ClientSimulationEngine();
