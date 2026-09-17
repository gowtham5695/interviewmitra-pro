import React from 'react';

/**
 * ScoreBar Component
 * Renders an animated score meter with dynamic gradient colors based on percentage score.
 */
export default function ScoreBar({
  score = 0,
  label = '',
  size = 'md',
  showPercentage = true,
  className = ''
}) {
  // Clamp score between 0 and 100
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  // Dynamic color gradient based on score value
  const getGradient = (val) => {
    if (val >= 88) return 'from-emerald-400 to-cyan-500 text-emerald-400';
    if (val >= 75) return 'from-cyan-400 to-indigo-500 text-cyan-400';
    if (val >= 60) return 'from-amber-400 to-orange-500 text-amber-400';
    return 'from-rose-500 to-red-600 text-rose-400';
  };

  const gradientClass = getGradient(normalizedScore);

  const heights = {
    sm: 'h-2',
    md: 'h-3.5',
    lg: 'h-5'
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1.5 font-medium text-xs sm:text-sm">
          {label && <span className="text-slate-300">{label}</span>}
          {showPercentage && (
            <span className={`font-bold font-mono ${gradientClass.split(' ').pop()}`}>
              {normalizedScore}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/50 ${heights[size] || heights.md}`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradientClass.split(' ').slice(0, 2).join(' ')} transition-all duration-1000 ease-out shadow-sm`}
          style={{ width: `${normalizedScore}%` }}
        />
      </div>
    </div>
  );
}
