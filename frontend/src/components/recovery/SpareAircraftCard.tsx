import React from 'react';
import { SpareAircraft } from '../../types';
import { Plane, Wrench, CheckCircle2, AlertCircle, MapPin, Users, Clock } from 'lucide-react';

interface SpareAircraftCardProps {
  spare: SpareAircraft;
  onDeployClick?: (spareTail: string) => void;
  onUndoClick?: (spareTail: string) => void;
  isSelected?: boolean;
  onSelect?: () => void;
}

export const SpareAircraftCard: React.FC<SpareAircraftCardProps> = ({
  spare,
  onDeployClick,
  onUndoClick,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
        isSelected
          ? 'ring-2 ring-cyan-400 bg-cyan-950/30 border-cyan-400/80 shadow-lg'
          : spare.is_deployed
          ? 'bg-emerald-950/20 border-occ-green/40 shadow-occ-card'
          : 'bg-navy-900 border-occ-border hover:border-slate-600'
      }`}
    >
      <div>
        {/* Header & Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy-800 border border-occ-border flex items-center justify-center">
              <Plane className="w-4 h-4 text-occ-cyan" />
            </div>
            <div>
              <div className="text-sm font-bold font-mono text-white">
                {spare.tail_id}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Airbus A320neo &bull; 180 Seats
              </div>
            </div>
          </div>

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              spare.is_deployed
                ? 'bg-emerald-950 text-occ-green border-occ-green/40'
                : 'bg-cyan-950 text-occ-cyan border-occ-cyan/30'
            }`}
          >
            {spare.is_deployed ? 'ACTIVE ON ROTATION' : 'STANDBY READY'}
          </span>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-3 gap-2 font-mono text-[11px] bg-navy-950 p-2.5 rounded-lg border border-occ-border mb-3">
          <div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-occ-cyan" /> BASE
            </div>
            <div className="text-white font-bold mt-0.5">{spare.base}</div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-occ-cyan" /> READY
            </div>
            <div className="text-white font-bold mt-0.5">{spare.available_from} IST</div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <Users className="w-3 h-3 text-occ-cyan" /> SEATS
            </div>
            <div className="text-white font-bold mt-0.5">{spare.seats} PAX</div>
          </div>
        </div>

        {/* Current Deployment Details */}
        {spare.is_deployed && (
          <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/30 text-[11px] font-mono text-emerald-300 mb-3 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Assigned Target:</span>
            </div>
            <div className="text-[10px] text-slate-300">
              Recovering flight rotation starting at {spare.assigned_to.join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-occ-border flex items-center justify-between">
        {spare.is_deployed ? (
          <button
            onClick={() => onUndoClick && onUndoClick(spare.tail_id)}
            className="w-full py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-occ-red font-mono text-xs font-bold border border-occ-red/30 transition-colors"
          >
            Undo Deployment
          </button>
        ) : (
          <button
            onClick={() => onDeployClick && onDeployClick(spare.tail_id)}
            className="w-full py-1.5 rounded-lg bg-occ-cyan hover:bg-cyan-400 text-navy-950 font-mono text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Deploy on Rotation</span>
          </button>
        )}
      </div>
    </div>
  );
};
