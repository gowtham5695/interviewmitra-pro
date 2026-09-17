import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, AlertTriangle, MessageSquare, Mic, Zap, RefreshCw, Trophy, ArrowRight, Share2, Sparkles, TrendingUp } from 'lucide-react';
import ScoreBar from './ScoreBar';
import { getFeedback, addScoreToLeaderboard } from '../services/api';

export default function FeedbackReport({ sessionResult, onViewLeaderboard, onRestart }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [postedToLeaderboard, setPostedToLeaderboard] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      try {
        const res = await getFeedback(sessionResult.sessionId, sessionResult);
        if (res.success) {
          setReport(res);
        }
      } catch (err) {
        console.error('Error fetching feedback report:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [sessionResult]);

  const handlePostToLeaderboard = () => {
    if (!report) return;
    addScoreToLeaderboard({
      user: report.candidateName,
      score: report.totalScore,
      role: report.role,
      roundScores: report.roundBreakdown.map((r) => r.score),
      fillerWordsCount: report.fluencyFeedback.fillerWordCount,
      wpm: report.fluencyFeedback.wpm
    });
    setPostedToLeaderboard(true);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-xl font-bold text-white">Analyzing Speech Transcript & Feedback...</h2>
        <p className="text-slate-400 text-sm">Synthesizing Content Depth, Keyword Relevance, and Voice Fluency metrics...</p>
      </div>
    );
  }

  const { totalScore, contentFeedback, fluencyFeedback, roundBreakdown, candidateName, role } = report;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <Award className="w-4 h-4" /> Interview Analysis Complete
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          Performance Feedback for <span className="gradient-text">{candidateName}</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Target Role: <strong className="text-cyan-400">{role}</strong> • Evaluated across 3 rounds
        </p>
      </div>

      {/* Main Overall Score Card */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Circular / Large Score Badge */}
          <div className="text-center md:border-r border-slate-800 md:pr-6 space-y-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Overall Assessment</span>
            <div className="text-6xl font-black gradient-text my-2">{totalScore}</div>
            <p className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full inline-block">
              {totalScore >= 90 ? 'Outstanding Candidate' : totalScore >= 75 ? 'Strong Interviewer' : 'Developing Skills'}
            </p>
          </div>

          {/* Overall Progress Meter */}
          <div className="md:col-span-2 space-y-4">
            <ScoreBar score={totalScore} label="Overall Mock Interview Score" size="lg" />
            <div className="grid grid-cols-3 gap-3 text-center pt-2">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <p className="text-xs text-slate-400">Content</p>
                <p className="text-lg font-bold text-cyan-400">{contentFeedback.relevanceScore}%</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <p className="text-xs text-slate-400">Fluency</p>
                <p className="text-lg font-bold text-indigo-400">{fluencyFeedback.fluencyScore}%</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <p className="text-xs text-slate-400">Filler Words</p>
                <p className="text-lg font-bold text-emerald-400">{fluencyFeedback.fillerWordCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Feedback Section */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">1. Content & Technical Feedback</h3>
            <p className="text-xs text-slate-400">Keyword relevance, response structure, and STAR method compliance</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ScoreBar score={contentFeedback.relevanceScore} label="Role Relevance" size="sm" />
            <ScoreBar score={contentFeedback.technicalDepthScore} label="Technical Depth" size="sm" />
            <ScoreBar score={contentFeedback.structureScore} label="Response Structure" size="sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Key Strengths */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Key Strengths
              </h4>
              <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300">
                {contentFeedback.strengths.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Areas for Improvement */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Recommended Improvements
              </h4>
              <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300">
                {contentFeedback.improvements.map((imp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Fluency Feedback Section */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">2. Speech Fluency & Delivery</h3>
            <p className="text-xs text-slate-400">Pacing (WPM), filler word frequency, and vocal tone confidence</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
            <span className="text-xs text-slate-400">Speaking Speed</span>
            <p className="text-2xl font-black text-white">{fluencyFeedback.wpm} <span className="text-xs font-normal text-slate-400">WPM</span></p>
            <p className="text-[11px] text-emerald-400">Optimal Pace (130-150 WPM)</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
            <span className="text-xs text-slate-400">Filler Words</span>
            <p className="text-2xl font-black text-indigo-400">{fluencyFeedback.fillerWordCount}</p>
            <p className="text-[11px] text-slate-400">Total detected fillers</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
            <span className="text-xs text-slate-400">Delivery Tone</span>
            <p className="text-xl font-bold text-cyan-400">{fluencyFeedback.tonePacing}</p>
            <p className="text-[11px] text-slate-400">Clear & Articulate</p>
          </div>
        </div>

        {/* Filler Words List */}
        {fluencyFeedback.fillerWordsDetected.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Detected Fillers Breakdown:</span>
            <div className="flex flex-wrap gap-2">
              {fluencyFeedback.fillerWordsDetected.map((f, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Round Breakdown Table */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" /> Round-by-Round Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="pb-3 font-semibold">Round</th>
                <th className="pb-3 font-semibold">Focus</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Round Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {roundBreakdown.map((r) => (
                <tr key={r.round} className="hover:bg-slate-900/40">
                  <td className="py-3 font-bold text-cyan-400">Round {r.round}</td>
                  <td className="py-3 text-slate-300">{r.name}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px]">
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 font-bold font-mono text-right text-white">{r.score}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action CTA Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
        <button
          type="button"
          onClick={onRestart}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors border border-slate-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retake Mock Interview</span>
        </button>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePostToLeaderboard}
            disabled={postedToLeaderboard}
            className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              postedToLeaderboard
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg glow-cyan'
            }`}
          >
            {postedToLeaderboard ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Posted to Leaderboard!</span>
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4" />
                <span>Publish Score to Leaderboard</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onViewLeaderboard}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all"
          >
            <span>View Leaderboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
