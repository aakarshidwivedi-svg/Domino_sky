import React, { useState, useRef, useEffect } from 'react';
import { useOperational } from '../context/OperationalContext';
import {
  Bot,
  Send,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  Plane,
  Clock,
  Compass,
} from 'lucide-react';

const SUGGESTED_QUERIES = [
  'Why is flight DS1502 delayed?',
  'Can VT-DS18 replace DS1502?',
  'Which airport is the worst bottleneck?',
  'How many passenger connections are broken?',
  'Which aircraft has the biggest delay chain?',
  'Which crew assignments are approaching the 600m limit?',
  'What happens if we cancel flight DS1502?',
  'Did our recovery actions actually improve the network?',
];

export const AICopilot: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded = false }) => {
  const {
    copilotMessages,
    isCopilotLoading,
    sendCopilotMessage,
    handleCopilotAction,
    simState,
    simTimeStr,
  } = useOperational();

  const [inputQuery, setInputQuery] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages, isCopilotLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isCopilotLoading) return;
    const q = inputQuery;
    setInputQuery('');
    sendCopilotMessage(q);
  };

  const handleChipClick = (queryText: string) => {
    if (isCopilotLoading) return;
    sendCopilotMessage(queryText);
  };

  return (
    <div className={`flex flex-col h-full bg-slate-950/80 rounded-xl border border-cyan-900/40 backdrop-blur-md overflow-hidden ${isEmbedded ? 'p-3' : 'p-6'}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
            <Bot className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100 tracking-wide">
                AI OPERATIONS COPILOT
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Ground-Truth Deterministic
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live context: {simState.kpis.delayed_flights} delayed flights • {simState.kpis.passengers_at_risk} pax at risk • {simTimeStr} IST
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Zero Hallucination Guarantee</span>
        </div>
      </div>

      {/* Quick query chips */}
      <div className="py-3 border-b border-slate-800/60 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 whitespace-nowrap text-xs">
          <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Tactical Prompts:
          </span>
          {SUGGESTED_QUERIES.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(sq)}
              disabled={isCopilotLoading}
              className="px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-cyan-950/70 border border-slate-700/60 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-200 transition-all text-xs focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {copilotMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-1 text-[11px] font-mono text-slate-400">
              {msg.sender === 'copilot' ? (
                <>
                  <Bot className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-cyan-400 font-semibold">TACTICAL ANALYST</span>
                </>
              ) : (
                <>
                  <span className="text-slate-300 font-semibold">OCC CONTROLLER</span>
                  <Compass className="w-3.5 h-3.5 text-slate-400" />
                </>
              )}
              <span>• {msg.timestamp} IST</span>
            </div>

            <div
              className={`max-w-[85%] rounded-xl p-4 text-sm leading-relaxed shadow-lg whitespace-pre-line ${
                msg.sender === 'user'
                  ? 'bg-cyan-950/60 text-cyan-100 border border-cyan-800/60 rounded-br-none'
                  : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-bl-none font-sans'
              }`}
            >
              {msg.text}

              {/* Action Recommendation Buttons */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2">
                  {msg.suggestedActions.map((act, aIdx) => (
                    <button
                      key={aIdx}
                      onClick={() => handleCopilotAction(act)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 text-xs font-medium transition-all shadow-md focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      {act.label}
                      <ArrowRight className="w-3 h-3 text-cyan-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isCopilotLoading && (
          <div className="flex items-center gap-3 text-xs font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-900/40 rounded-lg p-3 w-fit">
            <Bot className="w-4 h-4 animate-spin" />
            <span>Evaluating rotation trees and constraint graphs...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input query form */}
      <form onSubmit={handleSubmit} className="mt-2 pt-3 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask tactical operations questions (e.g. 'Why is DS1502 delayed?', 'Can VT-DS18 replace DS1502?')..."
          disabled={isCopilotLoading}
          aria-label="Ask Tactical AI Copilot"
          className="flex-1 bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-cyan-500 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all font-sans"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isCopilotLoading}
          aria-label="Send query"
          className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-semibold flex items-center gap-1.5 transition-all text-sm focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <span>Send</span>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
