import React from 'react';
import { ScenarioComparison } from '../../types';
import { BarChart3 } from 'lucide-react';

interface ScenarioComparisonTableProps {
  scenarioComparison: ScenarioComparison | null;
}

export const ScenarioComparisonTable: React.FC<ScenarioComparisonTableProps> = ({
  scenarioComparison,
}) => {
  if (!scenarioComparison) return null;

  const { baseline, disrupted, recovered, delta } = scenarioComparison;
  const disruptedOtp = Math.round((disrupted.on_time_flights / 70) * 100);
  const recoveredOtp = Math.round((recovered.on_time_flights / 70) * 100);
  const deltaOtp = recoveredOtp - disruptedOtp;

  return (
    <section
      aria-labelledby="scenario-comparison-title"
      className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl"
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="text-sm font-mono font-bold text-slate-100 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          <h2 id="scenario-comparison-title">3-WAY SCENARIO COMPARISON (MEASURABLE IMPACT)</h2>
        </div>
        <span className="text-xs font-mono text-cyan-400 font-semibold" aria-live="polite">
          Delta: {delta.delay_minutes_saved}m delay saved
        </span>
      </div>

      <div className="overflow-x-auto">
        <table
          className="w-full text-xs font-mono text-left"
          aria-label="3-Way Scenario Operational Metrics Comparison"
        >
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
              <th scope="col" className="py-2.5 px-3">Metric</th>
              <th scope="col" className="py-2.5 px-3 text-slate-300">1. Baseline Nominal</th>
              <th scope="col" className="py-2.5 px-3 text-red-400">2. Disrupted (Pre-Recovery)</th>
              <th scope="col" className="py-2.5 px-3 text-emerald-400">3. Recovered (Current)</th>
              <th scope="col" className="py-2.5 px-3 text-cyan-400 font-bold">Net Operational Delta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            <tr>
              <th scope="row" className="py-2.5 px-3 font-semibold text-slate-200">On-Time Performance Rate</th>
              <td className="py-2.5 px-3">100% (70/70)</td>
              <td className="py-2.5 px-3 text-red-400">
                {disruptedOtp}% ({disrupted.on_time_flights}/70)
              </td>
              <td className="py-2.5 px-3 text-emerald-400">
                {recoveredOtp}% ({recovered.on_time_flights}/70)
              </td>
              <td className="py-2.5 px-3 text-cyan-400 font-bold">
                +{deltaOtp}% OTP
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-2.5 px-3 font-semibold text-slate-200">Delayed Flights</th>
              <td className="py-2.5 px-3">0</td>
              <td className="py-2.5 px-3 text-red-400">{disrupted.delayed_flights}</td>
              <td className="py-2.5 px-3 text-emerald-400">{recovered.delayed_flights}</td>
              <td className="py-2.5 px-3 text-cyan-400 font-bold">
                -{disrupted.delayed_flights - recovered.delayed_flights} flights
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-2.5 px-3 font-semibold text-slate-200">Total Propagated Delay</th>
              <td className="py-2.5 px-3">0 mins</td>
              <td className="py-2.5 px-3 text-red-400">{disrupted.total_delay_minutes} mins</td>
              <td className="py-2.5 px-3 text-emerald-400">{recovered.total_delay_minutes} mins</td>
              <td className="py-2.5 px-3 text-cyan-400 font-bold">
                -{delta.delay_minutes_saved} mins saved
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-2.5 px-3 font-semibold text-slate-200">Broken Passenger Connections</th>
              <td className="py-2.5 px-3">0</td>
              <td className="py-2.5 px-3 text-red-400">{disrupted.broken_connections}</td>
              <td className="py-2.5 px-3 text-emerald-400">{recovered.broken_connections}</td>
              <td className="py-2.5 px-3 text-cyan-400 font-bold">
                -{delta.connections_saved} broken banks
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-2.5 px-3 font-semibold text-slate-200">Connecting Pax at Risk</th>
              <td className="py-2.5 px-3">0 pax</td>
              <td className="py-2.5 px-3 text-red-400">{disrupted.passengers_at_risk} pax</td>
              <td className="py-2.5 px-3 text-emerald-400">{recovered.passengers_at_risk} pax</td>
              <td className="py-2.5 px-3 text-cyan-400 font-bold">
                -{delta.passengers_saved} pax protected
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-2.5 px-3 font-semibold text-slate-200">Crew Duty Violations</th>
              <td className="py-2.5 px-3">0</td>
              <td className="py-2.5 px-3 text-red-400">{disrupted.crew_violations}</td>
              <td className="py-2.5 px-3 text-emerald-400">{recovered.crew_violations}</td>
              <td className="py-2.5 px-3 text-cyan-400 font-bold">
                {delta.crew_violations_avoided > 0
                  ? `-${delta.crew_violations_avoided} avoided`
                  : '0 violations'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};
