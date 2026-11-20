import test from 'node:test';
import assert from 'node:assert/strict';
import { localSimulator, minutesToTime } from '../services/deterministicSim.ts';

test('Frontend Simulation Engine - Baseline Schedule Integrity', () => {
  const state = localSimulator.simulate([], {}, [], []);
  assert.equal(state.kpis.total_flights, 70);
  assert.equal(state.kpis.delayed_flights, 0);
  assert.equal(state.kpis.total_delay_minutes, 0);
  assert.equal(state.kpis.broken_connections, 0);
  assert.equal(state.kpis.passengers_at_risk, 0);
  assert.equal(state.kpis.crew_violations, 0);
  assert.equal(state.kpis.available_spares, 2);
});

test('Frontend Simulation Engine - Mumbai 90-Minute Closure Disruption', () => {
  const closures = [{
    airport_id: 'BOM',
    start_minute: 510, // 08:30
    end_minute: 600,   // 10:00
    reason: 'Severe Monsoonal Thunderstorm',
  }];

  const state = localSimulator.simulate(closures, {}, [], []);

  // Assert expected cascaded impacts
  assert.ok(state.kpis.delayed_flights >= 9, `Delayed flights should be >= 9, got ${state.kpis.delayed_flights}`);
  assert.ok(state.kpis.total_delay_minutes >= 480, `Total delay should be >= 480 min, got ${state.kpis.total_delay_minutes}`);
  assert.ok(state.kpis.broken_connections >= 1, `Broken connections should be >= 1, got ${state.kpis.broken_connections}`);
  assert.ok(state.kpis.passengers_at_risk >= 20, `Passengers at risk should be >= 20, got ${state.kpis.passengers_at_risk}`);

  // Verify connection CX17 is broken
  const cx17 = state.connections.find((c) => c.connection_id === 'CX17');
  assert.ok(cx17, 'CX17 must exist');
  assert.equal(cx17.status, 'BROKEN');
  assert.equal(cx17.passengers, 23);
  assert.equal(cx17.airport, 'HYD');

  // Verify severely delayed flight on VT-DS15
  const f_ds1502 = state.flights['DS1502'];
  assert.ok(f_ds1502, 'DS1502 must exist');
  assert.ok(f_ds1502.delay_minutes >= 60, 'DS1502 should have severe delay');
});

test('Frontend Simulation Engine - Spare Aircraft Deployment Feasibility', () => {
  const baselineState = localSimulator.simulate([], {}, [], []);

  // Test 1: DS1503 departs DEL at 12:20. VT-DS18 is at DEL from 05:00 -> FEASIBLE & BASE MATCH
  const checkFeasible = localSimulator.evaluateSpareFeasibility('DS1503', 'VT-DS18', baselineState);
  assert.equal(checkFeasible.feasible, true);
  assert.equal(checkFeasible.spare_base, 'DEL');
  assert.equal(checkFeasible.flight_origin, 'DEL');
  assert.equal(checkFeasible.requires_repositioning, false);

  // Test 2: DS0401 departs BOM at 07:45. VT-DS17 is at BLR -> NOT base match without repo
  const checkInfeasible = localSimulator.evaluateSpareFeasibility('DS0401', 'VT-DS17', baselineState, 0);
  assert.equal(checkInfeasible.feasible, false);
  assert.equal(checkInfeasible.requires_repositioning, true);
});

test('Frontend Simulation Engine - Tactical Flight Cancellation Recovery', () => {
  const closures = [{
    airport_id: 'BOM',
    start_minute: 510,
    end_minute: 600,
    reason: 'Severe Monsoonal Thunderstorm',
  }];

  const stateDisrupted = localSimulator.simulate(closures, {}, [], []);
  const stateCancelled = localSimulator.simulate(closures, {}, [], ['DS1502']);

  assert.equal(stateCancelled.flights['DS1502'].is_cancelled, true);
  assert.equal(stateCancelled.flights['DS1502'].status, 'CANCELLED');
  assert.equal(stateCancelled.kpis.cancelled_flights, 1);
  assert.ok(
    stateCancelled.kpis.total_delay_minutes < stateDisrupted.kpis.total_delay_minutes,
    `Cancelling DS1502 should reduce network delay minutes: ${stateCancelled.kpis.total_delay_minutes} < ${stateDisrupted.kpis.total_delay_minutes}`
  );
  assert.ok(stateCancelled.kpis.total_delay_minutes <= 300);
});

test('Frontend Simulation Engine - 3-Way Scenario Comparison', () => {
  const closures = [{
    airport_id: 'BOM',
    start_minute: 510,
    end_minute: 600,
    reason: 'Severe Monsoonal Thunderstorm',
  }];

  const deployments = [
    {
      spare_tail: 'VT-DS18',
      target_flight_id: 'DS1503',
      replace_remaining_rotation: true,
      assumed_reposition_minutes: 0,
    },
  ];

  const comparison = localSimulator.compareScenarios(closures, {}, deployments, []);

  assert.equal(comparison.baseline.delayed_flights, 0);
  assert.ok(comparison.disrupted.delayed_flights >= 9);
  assert.ok(comparison.recovered.delayed_flights <= comparison.disrupted.delayed_flights);
  assert.ok(comparison.delta.delay_minutes_saved >= 0);
});

test('Frontend Simulation Engine - Airborne Holding Fuel Exhaustion & Diversion', () => {
  // 120-minute BOM closure from 07:30 to 09:30 (minute 450 to 570)
  const closures = [{
    airport_id: 'BOM',
    start_minute: 450,
    end_minute: 570,
    reason: 'Runway Flooding',
  }];

  const state = localSimulator.simulate(closures, {}, [], [], 720, true, 45);
  const f_ds0201 = state.flights['DS0201'];
  assert.equal(f_ds0201.is_diverted, true);
  assert.equal(f_ds0201.status, 'DIVERTED');
  assert.equal(f_ds0201.diversion_airport, 'PNQ');
  assert.ok(f_ds0201.root_cause.includes('DIVERTED'));
});

test('Frontend Simulation Engine - Simultaneous Multi-Airport Closures', () => {
  const closures = [
    { airport_id: 'BOM', start_minute: 510, end_minute: 600, reason: 'Storm' },
    { airport_id: 'DEL', start_minute: 540, end_minute: 630, reason: 'Hail' },
  ];

  const state = localSimulator.simulate(closures, {}, [], []);
  assert.ok(state.kpis.delayed_flights >= 12, 'Simultaneous closures must compound delayed flights count');
  assert.ok(state.kpis.total_delay_minutes >= 600);
});

test('Frontend Simulation Engine - Operational Recovery Conflict Detection', () => {
  const deployments = [
    { spare_tail: 'VT-DS18', target_flight_id: 'DS1502', replace_remaining_rotation: true, assumed_reposition_minutes: 0 },
    { spare_tail: 'VT-DS18', target_flight_id: 'DS0202', replace_remaining_rotation: true, assumed_reposition_minutes: 0 },
  ];

  const conflicts = localSimulator.detectRecoveryConflicts(deployments, ['DS1502']);
  const conflictTypes = conflicts.map((c) => c.conflict_type);
  assert.ok(conflictTypes.includes('SPARE_DOUBLE_BOOKING'));
  assert.ok(conflictTypes.includes('CONTRADICTORY_ACTIONS'));
});

test('Frontend Simulation Engine - Multi-Objective Recovery Optimizer', () => {
  const closures = [{
    airport_id: 'BOM',
    start_minute: 510,
    end_minute: 600,
    reason: 'Severe Monsoonal Thunderstorm',
  }];

  const plans = localSimulator.optimizeRecoveryPlans(closures);
  assert.equal(plans.length, 4);
  const planIds = plans.map((p) => p.plan_id);
  assert.ok(planIds.includes('PLAN_A'));
  assert.ok(planIds.includes('PLAN_B'));
  assert.ok(planIds.includes('PLAN_C'));
  assert.ok(planIds.includes('PLAN_D'));

  plans.forEach((p) => {
    assert.ok(p.score >= 0);
    assert.ok(p.estimated_cost >= 0);
    assert.ok(p.tradeoffs.pros.length > 0);
  });
});
