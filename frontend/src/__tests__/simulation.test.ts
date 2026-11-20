import test from 'node:test';
import assert from 'node:assert/strict';
import { localSimulator } from '../services/deterministicSim.ts';

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

  // Disrupted state without cancellation
  const stateDisrupted = localSimulator.simulate(closures, {}, [], []);

  // State with DS1502 cancelled
  const stateCancelled = localSimulator.simulate(closures, {}, [], ['DS1502']);

  assert.equal(stateCancelled.flights['DS1502'].is_cancelled, true);
  assert.equal(stateCancelled.flights['DS1502'].status, 'CANCELLED');
  assert.equal(stateCancelled.kpis.cancelled_flights, 1);
  assert.ok(
    stateCancelled.kpis.total_delay_minutes < stateDisrupted.kpis.total_delay_minutes,
    `Cancelling DS1502 should reduce network delay minutes: ${stateCancelled.kpis.total_delay_minutes} < ${stateDisrupted.kpis.total_delay_minutes}`
  );
  assert.equal(stateCancelled.kpis.total_delay_minutes, 270);
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
