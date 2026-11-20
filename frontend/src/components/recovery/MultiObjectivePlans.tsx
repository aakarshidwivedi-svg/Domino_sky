import React from 'react';
import { RecoveryPlan, SpareDeployment } from '../../types';
import { Sparkles, Check, Zap } from 'lucide-react';

interface MultiObjectivePlansProps {
  candidatePlans: RecoveryPlan[];
  activeDeployments: SpareDeployment[];
  activeCancelledFlights: string[];
  onApplyPlan: (plan: RecoveryPlan) => void;
}

export const MultiObjectivePlans: React.FC<MultiObjectivePlansProps> = ({
  candidatePlans,
  activeDeployments,
  activeCancelledFlights,
  onApplyPlan,
}) => {
  return (
    <section
      aria-labelledby="multi-objective-plans-title"
      className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            <h2
              id="multi-objective-plans-title"
              className="text-sm font-mono font-bold text-slate-100 uppercase tracking-wider"
            >
              Multi-Objective Recovery Optimizer (Pareto Policy Exploration)
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
              4 Evaluated Plans
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated multi-objective optimization evaluating passenger disruption, total delay, cancellations, crew rest limits, and direct operating cost.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {candidatePlans.map((plan) => {
          const isApplied =
            activeDeployments.length === plan.deployments.length &&
            activeCancelledFlights.length === plan.cancelled_flights.length &&
            plan.deployments.every((d) =>
              activeDeployments.some(
                (x) => x.spare_tail === d.spare_tail && x.target_flight_id === d.target_flight_id
              )
            );

          return (
            <article
              key={plan.plan_id}
              aria-label={`Recovery Plan ${plan.plan_id}: ${plan.name}`}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-4 ${
                plan.plan_id === 'PLAN_C'
                  ? 'bg-slate-950/90 border-cyan-500/70 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-cyan-400">
                        {plan.plan_id}
                      </span>
                      <h3 className="font-mono font-bold text-xs text-slate-100">
                        {plan.name}
                      </h3>
                    </div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 border border-slate-700 text-slate-300">
                      {plan.strategy_tag}
                    </span>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-base font-mono font-black text-cyan-300">
                      {plan.score}
                      <span className="text-slate-500 text-xs font-normal">/100</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      EST. ${plan.estimated_cost.toLocaleString()}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {plan.description}
                </p>

                {/* Impact Matrix Grid */}
                <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Delay Time</span>
                    <span className="text-amber-400 font-bold">{plan.total_delay_minutes}m</span>
                    <span className="text-slate-400 text-[10px] block">({plan.delayed_flights} flts)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Cancellations</span>
                    <span
                      className={
                        plan.cancelled_count > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'
                      }
                    >
                      {plan.cancelled_count} flts
                    </span>
                    <span className="text-slate-400 text-[10px] block">({plan.stranded_passengers} pax)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Connections</span>
                    <span
                      className={
                        plan.broken_connections > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'
                      }
                    >
                      {plan.broken_connections} broken
                    </span>
                    <span className="text-slate-400 text-[10px] block">
                      ({plan.rebooked_passengers} rebooked)
                    </span>
                  </div>
                </div>

                {/* Trade-offs */}
                <div className="text-[11px] space-y-1 pt-1">
                  <div className="text-emerald-400/90 flex items-start gap-1">
                    <span className="font-bold font-mono text-[10px] uppercase text-emerald-500">PRO:</span>
                    <span>{plan.tradeoffs.pros}</span>
                  </div>
                  <div className="text-slate-300 flex items-start gap-1">
                    <span className="font-bold font-mono text-[10px] uppercase text-amber-500">CON:</span>
                    <span>{plan.tradeoffs.cons}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div className="text-[10px] font-mono text-slate-400">
                  {plan.deployments.length} Spares • {plan.cancelled_flights.length} Cancels
                </div>

                <button
                  type="button"
                  onClick={() => onApplyPlan(plan)}
                  disabled={isApplied}
                  aria-label={isApplied ? `${plan.name} is currently applied` : `Apply ${plan.name}`}
                  className={`px-3 py-1.5 rounded-lg font-mono font-bold text-xs transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none ${
                    isApplied
                      ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-default'
                      : plan.plan_id === 'PLAN_C'
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-950/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isApplied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                      <span>Plan Applied</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Apply Plan</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
