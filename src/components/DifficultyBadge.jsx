import React from 'react';
import { Flame, Sparkles, ShieldAlert, CheckCircle2 } from 'lucide-react';

/**
 * DifficultyBadge Component
 * Displays visual round indicator (Round 1/2/3) with distinct difficulty styling.
 */
export default function DifficultyBadge({ round = 1, className = '' }) {
  const roundConfigs = {
    1: {
      label: 'Round 1 • Warm-up',
      subtitle: 'Fundamentals & Soft Intro',
      bgClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      icon: Sparkles,
      dotColor: 'bg-emerald-400',
    },
    2: {
      label: 'Round 2 • Behavioral',
      subtitle: 'STAR Scenarios & Leadership',
      bgClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      icon: Flame,
      dotColor: 'bg-amber-400',
    },
    3: {
      label: 'Round 3 • Stress & Technical',
      subtitle: 'System Design & Pressure',
      bgClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      icon: ShieldAlert,
      dotColor: 'bg-rose-400',
    }
  };

  const config = roundConfigs[round] || roundConfigs[1];
  const IconComponent = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold tracking-wide backdrop-blur-md shadow-sm transition-all duration-300 ${config.bgClass} ${className}`}>
      <span className={`w-2 h-2 rounded-full animate-ping opacity-75 ${config.dotColor}`} />
      <IconComponent className="w-3.5 h-3.5" />
      <span>{config.label}</span>
    </div>
  );
}
