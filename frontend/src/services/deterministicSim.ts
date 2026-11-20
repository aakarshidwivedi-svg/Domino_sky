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
} from '../types/index.ts';

export function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const norm = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export class ClientSimulationEngine {
  private airports: Record<string, Airport> = {};
  private baseFlights: Record<string, any> = {};
  private connections: any[] = [];
  private crews: any[] = [];
  private spareAircraft: Record<string, any> = {};
  private minTurnaround = 30;

  constructor() {
    (rawDataset.airports as Airport[]).forEach((a) => {
      this.airports[a.id] = a;
    });
    rawDataset.flights.forEach((f: any) => {
      const schedDep = timeToMinutes(f.dep);
      let schedArr = timeToMinutes(f.arr);
      if (schedArr < schedDep) schedArr += 1440;
      this.baseFlights[f.flight_id] = {
        ...f,
        sched_dep_min: schedDep,
        sched_arr_min: schedArr,
        block_minutes: f.block_minutes || schedArr - schedDep,
      };
    });
    this.connections = rawDataset.connections || [];
    this.crews = rawDataset.crews || [];
    (rawDataset.spare_aircraft || []).forEach((s: any) => {
      this.spareAircraft[s.tail_id] = s;
    });
    this.minTurnaround = rawDataset.meta?.min_turnaround_minutes || 30;
  }

  public getAirports(): Record<string, Airport> {
    return this.airports;
  }

  public simulate(
    closures: AirportClosure[] = [],
    manualDelays: Record<string, number> = {},
    deployments: SpareDeployment[] = [],
    cancelledFlightIds: string[] = [],
    currentSimMinute: number = 720
  ): SimulationState {
    const cancelledSet = new Set(cancelledFlightIds);

    // 1. Map spare deployments
    const activeSubstitutions: Record<string, { spareTail: string; repoMins: number }> = {};
    deployments.forEach((dep) => {
      const targetFlight = this.baseFlights[dep.target_flight_id];
      if (targetFlight) {
        const origTail = targetFlight.tail_id;
        const targetLeg = targetFlight.leg_order;
        Object.values(this.baseFlights).forEach((f: any) => {
          if (f.tail_id === origTail && f.leg_order >= targetLeg) {
            activeSubstitutions[f.flight_id] = {
              spareTail: dep.spare_tail,
              repoMins: f.flight_id === dep.target_flight_id ? dep.assumed_reposition_minutes : 0,
            };
          }
        });
      }
    });

    // 2. Group flights by effective tail
    const flightsByTail: Record<string, any[]> = {};
    Object.values(this.baseFlights)
      .sort((a: any, b: any) => a.leg_order - b.leg_order)
      .forEach((f: any) => {
        const fCopy = { ...f, original_tail_id: f.tail_id };
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

    // 3. Closure map & holding queues
    const closureMap: Record<string, AirportClosure[]> = {};
    closures.forEach((c: any) => {
      const apt = c.airport_id || c.airport;
      if (!apt) return;
      const start = c.start_minute !== undefined ? c.start_minute : (c.closed_from ? timeToMinutes(c.closed_from) : 0);
      const end = c.end_minute !== undefined ? c.end_minute : (c.closed_to ? timeToMinutes(c.closed_to) : start + (c.duration_min || 0));
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
    const simulatedFlights: Record<string, Flight> = {};

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
            root_cause: 'Flight cancelled by OCC recovery action to halt delay cascade',
            delay_reasons: ['Flight cancelled by Operations Control Centre recovery order'],
            prev_flight_id: prevFlightId,
            next_flight_id: idx + 1 < tailFlights.length ? tailFlights[idx + 1].flight_id : null,
            is_spare_recovered: false,
            assigned_spare_tail: null,
            reposition_mins: 0,
          };
          return;
        }

        let turnaroundReq = f.turnaround_before_min;
        if (turnaroundReq === null || turnaroundReq < this.minTurnaround) {
          turnaroundReq = this.minTurnaround;
        }
        f.effective_turnaround_required = turnaroundReq;

        const delayReasons: string[] = [];
        let earliestDep = schedDep;

        if (prevSimArrMin === null) {
          if (f.is_spare_recovered) {
            const spareData = this.spareAircraft[f.assigned_spare_tail] || {};
            const spareAvailMin = timeToMinutes(spareData.available_from || '05:00');
            const spareReadyMin = spareAvailMin + f.reposition_mins;
            earliestDep = Math.max(schedDep, spareReadyMin);
            if (f.reposition_mins > 0) {
              delayReasons.push(
                `Spare ${f.assigned_spare_tail} ferry positioning (${f.reposition_mins}m assumption); ready at ${minutesToTime(spareReadyMin)}`
              );
            } else {
              delayReasons.push(
                `Spare ${f.assigned_spare_tail} deployed at ${orig} (Base match: 0m ferry); ready at ${minutesToTime(spareReadyMin)}`
              );
            }
          } else {
            earliestDep = schedDep;
          }
        } else {
          const readyMin = prevSimArrMin + turnaroundReq;
          if (readyMin > schedDep) {
            delayReasons.push(
              `Late inbound ${prevFlightId} (${tail}) arrived at ${minutesToTime(prevSimArrMin)}; requires ${turnaroundReq}m turnaround (ready ${minutesToTime(readyMin)})`
            );
          }
          earliestDep = Math.max(schedDep, readyMin);
        }

        // Add manual AOG delay
        const manualDelay = manualDelays[fid] || 0;
        if (manualDelay > 0) {
          earliestDep += manualDelay;
          delayReasons.push(`AOG / Maintenance hold injected: +${manualDelay}m`);
        }

        // Check origin closure
        let predDep = earliestDep;
        if (closureMap[orig]) {
          closureMap[orig].forEach((cl) => {
            if (predDep >= cl.start_minute && predDep < cl.end_minute) {
              predDep = cl.end_minute;
              delayReasons.push(
                `Origin airport ${orig} closed [${minutesToTime(cl.start_minute)}-${minutesToTime(cl.end_minute)}] (${cl.reason})`
              );
            }
          });
        }

        // Arrival & destination closure holding
        let predArr = predDep + blockMin;
        let isHeld = false;
        let holdingDelay = 0;

        if (closureMap[dest]) {
          closureMap[dest].forEach((cl) => {
            if (predArr >= cl.start_minute && predArr < cl.end_minute) {
              if (!airportHoldingQueues[dest]) airportHoldingQueues[dest] = [];
              airportHoldingQueues[dest].push(fid);
              const queueSlot = airportHoldingQueues[dest].length;
              holdingDelay = cl.end_minute - predArr + (queueSlot - 1) * 3;
              predArr = cl.end_minute + (queueSlot - 1) * 3;
              isHeld = true;
              delayReasons.push(
                `Destination ${dest} closed on arrival [${minutesToTime(cl.start_minute)}-${minutesToTime(cl.end_minute)}]; holding pattern ${holdingDelay}m (Slot #${queueSlot})`
              );
            }
          });
        }

        const depDelay = predDep - schedDep;
        const arrDelay = predArr - schedArr;
        const maxDelay = Math.max(depDelay, arrDelay);

        let status: Flight['status'] = 'ON_TIME';
        if (f.is_spare_recovered && depDelay <= 15) {
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
          currentPhase = 'ARRIVED';
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
          root_cause: delayReasons.length > 0 ? delayReasons.join(' | ') : 'Normal flight operation',
          delay_reasons: delayReasons,
          prev_flight_id: prevFlightId,
          next_flight_id: idx + 1 < tailFlights.length ? tailFlights[idx + 1].flight_id : null,
          is_spare_recovered: f.is_spare_recovered,
          assigned_spare_tail: f.assigned_spare_tail,
          reposition_mins: f.reposition_mins,
        };

        simulatedFlights[fid] = simFlight;
        prevSimArrMin = predArr;
        prevFlightId = fid;
      });
    });

    // 5. Connections
    let brokenConns = 0;
    let paxAtRisk = 0;
    let protectedConns = 0;

    const connectionResults: Connection[] = this.connections.map((c: any) => {
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

      if (fromF.is_cancelled || toF.is_cancelled) {
        brokenConns++;
        paxAtRisk += c.passengers;
        return {
          connection_id: c.connection_id,
          airport: c.airport,
          from_flight: c.from_flight,
          to_flight: c.to_flight,
          passengers: c.passengers,
          min_connect_minutes: minConn,
          sched_window_minutes: toF.sched_dep_min - fromF.sched_arr_min,
          pred_window_minutes: 0,
          margin_minutes: -minConn,
          is_broken: true,
          status: 'CANCELLED',
          details: `Connection cancelled: flight ${fromF.is_cancelled ? c.from_flight : c.to_flight} was cancelled by OCC recovery action.`,
        };
      }

      const schedWin = toF.sched_dep_min - fromF.sched_arr_min;
      const predWin = toF.pred_dep_min - fromF.pred_arr_min;
      const isBroken = predWin < minConn;
      const margin = predWin - minConn;

      let connStatus: Connection['status'] = 'ON_TIME';
      if (isBroken) {
        brokenConns++;
        paxAtRisk += c.passengers;
        connStatus = 'BROKEN';
      } else {
        if (fromF.arr_delay > 0 || toF.dep_delay > 0) {
          connStatus = 'PROTECTED';
          protectedConns++;
        }
      }

      return {
        connection_id: c.connection_id,
        airport: c.airport,
        from_flight: c.from_flight,
        to_flight: c.to_flight,
        passengers: c.passengers,
        min_connect_minutes: minConn,
        sched_window_minutes: schedWin,
        pred_window_minutes: predWin,
        margin_minutes: margin,
        is_broken: isBroken,
        status: connStatus,
        details: `Inbound ${c.from_flight} arr ${fromF.pred_arr} -> Outbound ${c.to_flight} dep ${toF.pred_dep} (Available: ${predWin}m vs Req: ${minConn}m, Margin: ${margin >= 0 ? '+' : ''}${margin}m)`,
      };
    });

    // 6. Crews
    let crewViolations = 0;
    let crewWarnings = 0;

    const crewResults: CrewAssignment[] = this.crews.map((cr: any) => {
      const startMin = timeToMinutes(cr.duty_start);
      const assignedSimFlights = cr.flight_ids
        .map((id: string) => simulatedFlights[id])
        .filter((f: Flight | undefined) => f && !f.is_cancelled);

      let dutyElapsed = 0;
      let lastFlight: Flight | undefined;

      if (assignedSimFlights.length > 0) {
        lastFlight = assignedSimFlights.reduce((max: Flight, f: Flight) => (f.pred_arr_min > max.pred_arr_min ? f : max));
        if (lastFlight) {
          dutyElapsed = lastFlight.pred_arr_min - startMin;
        }
      }

      const isExceeded = dutyElapsed > cr.max_duty_mins;
      const isWarning = !isExceeded && dutyElapsed >= cr.max_duty_mins - 45;

      let status: CrewAssignment['status'] = 'LEGAL';
      if (isExceeded) {
        crewViolations++;
        status = 'EXCEEDED';
      } else if (isWarning) {
        crewWarnings++;
        status = 'WARNING';
      }

      return {
        crew_id: cr.crew_id,
        base: cr.base,
        tail_id: cr.tail_id,
        duty_start: cr.duty_start,
        duty_start_min: startMin,
        max_duty_mins: cr.max_duty_mins,
        last_flight_id: lastFlight ? lastFlight.flight_id : 'NONE',
        last_flight_arr: lastFlight ? lastFlight.pred_arr : cr.duty_start,
        simulated_duty_minutes: dutyElapsed,
        margin_remaining: cr.max_duty_mins - dutyElapsed,
        status,
        is_exceeded: isExceeded,
        is_warning: isWarning,
        flight_ids: cr.flight_ids,
      };
    });

    // 7. Airport Risk Scores
    const airportRisks: AirportRisk[] = Object.values(this.airports).map((apt) => {
      const depFlights = Object.values(simulatedFlights).filter((f) => f.origin === apt.id);
      const arrFlights = Object.values(simulatedFlights).filter((f) => f.destination === apt.id);

      const isClosed = Boolean(closureMap[apt.id] && closureMap[apt.id].length > 0);
      const closureScore = isClosed ? 45 : 0;

      const delayedDep = depFlights.filter((f) => f.dep_delay > 15).length;
      const delayedArr = arrFlights.filter((f) => f.arr_delay > 15).length;
      const delayVolScore = Math.min(25, (delayedDep + delayedArr) * 3);

      const tightTurns = depFlights.filter((f) => (f.turnaround_before_min || 30) <= 35).length;
      const turnaroundScore = Math.min(15, tightTurns * 3);

      const aptConns = connectionResults.filter((c) => c.airport === apt.id);
      const brokenInApt = aptConns.filter((c) => c.is_broken).length;
      const connScore = Math.min(15, brokenInApt * 5);

      const totalRisk = Math.min(100, closureScore + delayVolScore + turnaroundScore + connScore);

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
        tier: apt.tier || 'spoke',
        capacity_per_hour: apt.capacity_per_hour,
        total_movements: depFlights.length + arrFlights.length,
        delayed_departures: delayedDep,
        delayed_arrivals: delayedArr,
        broken_connections: brokenInApt,
        tight_turnarounds: tightTurns,
        is_closed: isClosed,
        risk_score: totalRisk,
        risk_tier: riskTier,
        risk_factors: {
          closure_impact: closureScore,
          delay_volume_impact: delayVolScore,
          turnaround_pressure: turnaroundScore,
          connection_exposure: connScore,
        },
      };
    });
    airportRisks.sort((a, b) => b.risk_score - a.risk_score);

    // 8. Rotation Risks
    const crewByTail = Object.fromEntries(crewResults.map((c) => [c.tail_id, c]));
    const rotationRisks: RotationRisk[] = Object.entries(flightsByTail).map(([tail, flights]) => {
      flights.sort((a, b) => a.leg_order - b.leg_order);
      const maxDelay = Math.max(...flights.map((f) => simulatedFlights[f.flight_id]?.delay_minutes || 0));
      const lastFlight = flights[flights.length - 1];
      const lastSimFlight = simulatedFlights[lastFlight.flight_id];

      const delayFactor = Math.min(40, Math.floor(maxDelay * 0.4));
      const cascadeFactor = Math.min(25, flights.length * 5);

      const crewInfo = crewByTail[tail];
      let dutyFactor = 5;
      if (crewInfo?.is_exceeded) dutyFactor = 35;
      else if (crewInfo?.is_warning) dutyFactor = 20;

      const score = Math.min(100, delayFactor + cascadeFactor + dutyFactor);

      return {
        tail_id: tail,
        total_legs: flights.length,
        max_delay_minutes: maxDelay,
        final_destination: lastFlight.destination,
        final_arrival: lastSimFlight ? lastSimFlight.pred_arr : '',
        crew_status: crewInfo ? crewInfo.status : 'NO_ASSIGNMENT',
        risk_score: score,
        risk_factors: {
          delay_impact: delayFactor,
          cascade_potential: cascadeFactor,
          crew_duty_pressure: dutyFactor,
        },
      };
    });
    rotationRisks.sort((a, b) => b.risk_score - a.risk_score);

    // 9. Spares
    const assignedSpares = new Set(deployments.map((d) => d.spare_tail));
    const spareStatuses: SpareAircraft[] = Object.values(this.spareAircraft).map((s: any) => ({
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
    const delayedFlights = flightList.filter((f) => f.status === 'DELAYED' || f.status === 'SEVERELY_DELAYED').length;
    const severelyDelayed = flightList.filter((f) => f.status === 'SEVERELY_DELAYED').length;
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
      total_delay_minutes: totalDelayMins,
      broken_connections: brokenConns,
      passengers_at_risk: paxAtRisk,
      protected_connections: protectedConns,
      crew_violations: crewViolations,
      crew_warnings: crewWarnings,
      available_spares: Object.keys(this.spareAircraft).length - assignedSpares.size,
    };

    // 11. AI Operations Briefing
    const simTimeStr = minutesToTime(currentSimMinute);
    const closedAirports = closures.map((c) => c.airport_id);
    const severeFlights = flightList.filter((f) => f.status === 'SEVERELY_DELAYED');

    let situationText = '';
    if (closedAirports.length > 0) {
      situationText = `Active disruption: ${closedAirports.join(', ')} runway closure at ${simTimeStr} IST. ${delayedFlights} flights delayed (${severelyDelayed} severe), threatening ${paxAtRisk} connecting passengers. Total network delay accumulated: ${totalDelayMins} minutes.`;
    } else if (delayedFlights > 0) {
      situationText = `Network experiencing secondary propagation at ${simTimeStr} IST. ${delayedFlights} flights delayed (${totalDelayMins}m total delay). ${onTimeFlights} flights operating on schedule.`;
    } else {
      situationText = `Nominal scheduled operations across all 16 Indian airports at ${simTimeStr} IST. All 70 flights on time. Full schedule integrity maintained.`;
    }

    const alerts: AIBriefingAlert[] = [];
    severeFlights.slice(0, 4).forEach((sf) => {
      alerts.push({
        type: 'FLIGHT_DELAY',
        severity: 'CRITICAL',
        flight_id: sf.flight_id,
        airport: sf.origin,
        tail_id: sf.tail_id,
        text: `Flight ${sf.flight_id} (${sf.origin}->${sf.destination}) delayed +${sf.delay_minutes}m. Tail ${sf.tail_id}. ${sf.root_cause}`,
      });
    });

    connectionResults
      .filter((c) => c.is_broken)
      .slice(0, 3)
      .forEach((bc) => {
        alerts.push({
          type: 'MISSED_CONNECTION',
          severity: 'CRITICAL',
          connection_id: bc.connection_id,
          airport: bc.airport,
          text: `Connection ${bc.connection_id} broken at ${bc.airport}: ${bc.passengers} pax missing onward ${bc.to_flight} (Margin: ${bc.margin_minutes}m)`,
        });
      });

    crewResults
      .filter((cr) => cr.is_exceeded || cr.is_warning)
      .slice(0, 3)
      .forEach((cr) => {
        alerts.push({
          type: 'CREW_DUTY',
          severity: cr.is_exceeded ? 'CRITICAL' : 'WARNING',
          crew_id: cr.crew_id,
          tail_id: cr.tail_id,
          text: `Crew ${cr.crew_id} (${cr.tail_id}) duty exposure: ${cr.simulated_duty_minutes}m / ${cr.max_duty_mins}m limit on final leg ${cr.last_flight_id}`,
        });
      });

    let rootCauseText = '';
    if (closedAirports.length > 0) {
      rootCauseText = `Disruption initiated by runway closure at ${closedAirports[0]}. Aircraft rotations through ${closedAirports[0]} arrived late at downline stations, absorbing turnaround buffers and transferring domino delays across connected flights.`;
    } else if (totalDelayMins > 0) {
      rootCauseText = `Delays propagated through tight aircraft turnaround buffers (<35m) across high-utilization rotations.`;
    } else {
      rootCauseText = `No delay propagation triggers detected. All turnaround buffers absorbing gate variance.`;
    }

    const recommendations: AIBriefingRecommendation[] = [];
    if (severeFlights.length > 0 && kpis.available_spares > 0) {
      const delFlight = severeFlights.find((f) => f.origin === 'DEL');
      const blrFlight = severeFlights.find((f) => f.origin === 'BLR');

      if (delFlight && !assignedSpares.has('VT-DS18')) {
        recommendations.push({
          priority: 'HIGH',
          action_type: 'DEPLOY_SPARE',
          title: `Deploy Spare VT-DS18 at DEL on Flight ${delFlight.flight_id}`,
          description: `VT-DS18 is stationed at DEL base. Immediate deployment feasible with 0m ferry positioning.`,
          target_flight_id: delFlight.flight_id,
          spare_tail: 'VT-DS18',
          button_label: `Deploy VT-DS18 on ${delFlight.flight_id}`,
        });
      } else if (blrFlight && !assignedSpares.has('VT-DS17')) {
        recommendations.push({
          priority: 'HIGH',
          action_type: 'DEPLOY_SPARE',
          title: `Deploy Spare VT-DS17 at BLR on Flight ${blrFlight.flight_id}`,
          description: `VT-DS17 is stationed at BLR base. Immediate deployment feasible with 0m ferry positioning.`,
          target_flight_id: blrFlight.flight_id,
          spare_tail: 'VT-DS17',
          button_label: `Deploy VT-DS17 on ${blrFlight.flight_id}`,
        });
      }
    }

    if (airportRisks.length > 0 && airportRisks[0].risk_tier !== 'LOW') {
      recommendations.push({
        priority: 'MEDIUM',
        action_type: 'INSPECT_AIRPORT',
        title: `Inspect ${airportRisks[0].city} (${airportRisks[0].airport_id}) Operations`,
        description: `Risk index ${airportRisks[0].risk_score}/100 with ${airportRisks[0].delayed_departures} delayed departures.`,
        airport_id: airportRisks[0].airport_id,
        button_label: `Inspect ${airportRisks[0].airport_id}`,
      });
    }

    if (severeFlights.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action_type: 'INVESTIGATE_FLIGHT',
        title: `Investigate Flight ${severeFlights[0].flight_id} Delay Chain`,
        description: `Delayed +${severeFlights[0].delay_minutes}m. Trace root cause and downstream cascade.`,
        target_flight_id: severeFlights[0].flight_id,
        button_label: `Investigate ${severeFlights[0].flight_id}`,
      });
    }

    const aiBriefing: AIBriefing = {
      timestamp: simTimeStr,
      network_situation: situationText,
      critical_alerts: alerts,
      root_cause_analysis: rootCauseText,
      recommended_actions: recommendations,
      recovery_summary: {
        recovered_flights_count: recoveredFlights,
        deployments_active: deployments.length,
        protected_connections: protectedConns,
        summary_text:
          recoveredFlights > 0
            ? `${recoveredFlights} flight(s) recovered via spare aircraft intervention. ${protectedConns} passenger connection(s) protected.`
            : `No spare aircraft deployed yet. Review candidate rotations on the Recovery Desk.`,
      },
    };

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
      ai_briefing: aiBriefing,
    };
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
      rotation_length: rotationFlights.length,
      current_leg: target.leg_order,
      upstream_flights: upstream,
      downstream_flights: downstream,
      inbound_connections: inboundConns,
      outbound_connections: outboundConns,
      root_cause_explanation: target.root_cause,
      rotation_flights: rotationFlights,
    };
  }
}

export const localSimulator = new ClientSimulationEngine();
