import { SimulationState, CopilotMessage, CopilotAction } from '../types';

export async function queryCopilot(
  query: string,
  simState: SimulationState,
  selectedFlightId: string | null = null,
  selectedAirportId: string | null = null
): Promise<CopilotMessage> {
  const currentSimMinute = simState.meta.current_sim_minute;

  try {
    const res = await fetch('/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        current_sim_minute: currentSimMinute,
        selected_flight_id: selectedFlightId,
        selected_airport_id: selectedAirportId,
        closures: simState.closures,
        manual_delays: {},
        deployments: simState.deployments,
        cancelled_flights: simState.cancelled_flights || [],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        id: `copilot-${Date.now()}`,
        sender: 'copilot',
        text: data.answer,
        timestamp: simState.meta.current_sim_time,
        suggestedActions: data.suggested_actions,
        dataSummary: data.data_summary,
      };
    }
  } catch (err) {
    // Fall back to client-side deterministic reasoning
  }

  // Client-side rule-based reasoning engine (100% offline, zero-hallucination)
  return generateClientCopilotAnswer(query, simState, selectedFlightId, selectedAirportId);
}

function generateClientCopilotAnswer(
  query: string,
  simState: SimulationState,
  selectedFlightId: string | null,
  selectedAirportId: string | null
): CopilotMessage {
  const q = query.trim().toLowerCase();
  const flights = simState.flights;
  const kpis = simState.kpis;
  const conns = simState.connections;
  const crews = simState.crews;
  const aptRisks = simState.airport_risks;
  const closures = simState.closures;

  const actions: CopilotAction[] = [];

  // Match flight ID
  const fidMatch = query.match(/\b(DS\d{4})\b/i);
  const targetFid = fidMatch ? fidMatch[1].toUpperCase() : selectedFlightId;

  // Match airport
  const aptMatch = query.match(/\b(BOM|DEL|BLR|HYD|CCU|MAA|PNQ|AMD|GOI|COK|JAI|LKO|GAU|IXC|BBI|TRV)\b/i);
  const targetApt = aptMatch ? aptMatch[1].toUpperCase() : selectedAirportId;

  // 1. Spare feasibility inquiry
  if (q.includes('spare') || q.includes('vt-ds17') || q.includes('vt-ds18') || q.includes('replace') || q.includes('feasible')) {
    const evalFid = targetFid || Object.values(flights).find((f) => f.status === 'SEVERELY_DELAYED')?.flight_id || 'DS1502';
    const flight = flights[evalFid];
    const spareTail = q.includes('vt-ds18') ? 'VT-DS18' : q.includes('vt-ds17') ? 'VT-DS17' : (flight?.origin === 'DEL' ? 'VT-DS18' : 'VT-DS17');
    const isSameBase = (spareTail === 'VT-DS18' && flight?.origin === 'DEL') || (spareTail === 'VT-DS17' && flight?.origin === 'BLR');

    let text = `**Spare Aircraft Feasibility Analysis: ${spareTail} on Flight ${evalFid}**\n\n`;
    text += `- **Spare Aircraft:** ${spareTail} (Base: ${spareTail === 'VT-DS18' ? 'DEL' : 'BLR'}, 180 seats, Available 05:00 IST)\n`;
    text += `- **Target Flight:** ${evalFid} (${flight?.origin} -> ${flight?.destination}, Scheduled: ${flight?.dep})\n`;
    text += `- **Base Match:** ${isSameBase ? '✅ Immediate zero-delay deployment at home base' : '⚠️ Requires ferry repositioning (60m assumption)'}\n`;
    text += `- **Predicted Delay Savings:** ~${flight?.delay_minutes || 0} minutes\n`;

    actions.push({ label: `Deploy ${spareTail} on ${evalFid}`, action: 'CONFIRM_DEPLOYMENT', spare: spareTail, flight: evalFid });
    actions.push({ label: 'Open Recovery Desk', action: 'NAVIGATE_RECOVERY', value: evalFid });

    return {
      id: `copilot-${Date.now()}`,
      sender: 'copilot',
      text,
      timestamp: simState.meta.current_sim_time,
      suggestedActions: actions,
    };
  }

  // 2. Flight investigation inquiry
  if (targetFid && flights[targetFid]) {
    const f = flights[targetFid];
    let text = `**Flight ${f.flight_id} (${f.origin} -> ${f.destination}) Operations Report**\n\n`;
    text += `- **Status:** ${f.status} (${f.delay_minutes}m delay)\n`;
    text += `- **Aircraft:** ${f.tail_id} (Leg ${f.leg_order})\n`;
    text += `- **Scheduled:** ${f.dep} - ${f.arr} IST | **Predicted:** ${f.pred_dep} - ${f.pred_arr} IST\n`;
    text += `- **Root Cause:** ${f.root_cause}\n`;
    text += `- **Passenger Load:** ${f.pax} / 180 seats\n`;

    actions.push({ label: `Inspect ${f.flight_id} in Delay Detective`, action: 'SELECT_FLIGHT', value: f.flight_id });
    if (f.delay_minutes > 15) {
      actions.push({ label: `Evaluate Spare for ${f.flight_id}`, action: 'EVALUATE_SPARE', value: f.flight_id });
    }

    return {
      id: `copilot-${Date.now()}`,
      sender: 'copilot',
      text,
      timestamp: simState.meta.current_sim_time,
      suggestedActions: actions,
    };
  }

  // 3. Passenger impact inquiry
  if (q.includes('passenger') || q.includes('pax') || q.includes('connection') || q.includes('transfer') || q.includes('missed')) {
    const broken = conns.filter((c) => c.is_broken);
    let text = `**Passenger Connection Network Assessment**\n\n`;
    text += `- **Total Connection Banks Tracked:** ${conns.length} banks across India\n`;
    text += `- **Broken Connections:** ${broken.length} bank(s)\n`;
    text += `- **Passengers At Risk:** ${kpis.passengers_at_risk} passengers\n\n`;

    if (broken.length > 0) {
      text += `**Broken Itinerary Breakdown:**\n`;
      broken.forEach((b) => {
        text += `- \`${b.connection_id}\` at **${b.airport}**: ${b.passengers} pax from \`${b.from_flight}\` to \`${b.to_flight}\` (${b.pred_window_minutes}m vs ${b.min_connect_minutes}m req, Shortfall: ${b.margin_minutes}m)\n`;
      });
    }

    actions.push({ label: 'Open Passenger Impact Desk', action: 'NAVIGATE_PASSENGER_IMPACT' });
    return {
      id: `copilot-${Date.now()}`,
      sender: 'copilot',
      text,
      timestamp: simState.meta.current_sim_time,
      suggestedActions: actions,
    };
  }

  // 4. Default overview
  let text = `**DOMINO SKY Tactical Operations Status**\n\n`;
  text += `- **Simulated Clock:** ${simState.meta.current_sim_time} IST\n`;
  text += `- **Network Health:** ${kpis.on_time_flights}/${kpis.total_flights} flights on time (${Math.round((kpis.on_time_flights / kpis.total_flights) * 100)}% OTP)\n`;
  text += `- **Disrupted Flights:** ${kpis.delayed_flights} delayed (${kpis.severely_delayed_flights} severe)\n`;
  text += `- **Total Delay Volume:** ${kpis.total_delay_minutes} minutes\n`;
  text += `- **Passengers At Risk:** ${kpis.passengers_at_risk} across ${kpis.broken_connections} broken connection(s)\n`;
  text += `- **Available Spares:** ${kpis.available_spares} / 2 (VT-DS17 @ BLR, VT-DS18 @ DEL)\n`;

  actions.push({ label: 'View Mumbai Disruption', action: 'FILTER_AIRPORT', value: 'BOM' });
  actions.push({ label: 'Open Delay Detective', action: 'NAVIGATE_DETECTIVE', value: 'DS1502' });
  actions.push({ label: 'Open Recovery Desk', action: 'NAVIGATE_RECOVERY' });

  return {
    id: `copilot-${Date.now()}`,
    sender: 'copilot',
    text,
    timestamp: simState.meta.current_sim_time,
    suggestedActions: actions,
  };
}
