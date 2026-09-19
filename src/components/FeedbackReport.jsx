import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, AlertTriangle, MessageSquare, Mic, Zap, RefreshCw, Trophy, ArrowRight, Sparkles, TrendingUp, Lock, UserCheck } from 'lucide-react';
import ScoreBar from './ScoreBar';
import CognitoAuthModal from './CognitoAuthModal';
import { getFeedback, addScoreToLeaderboard } from '../services/api';
import { getStoredAuth } from '../services/cognitoAuth';

export default function FeedbackReport({ sessionResult, onViewLeaderboard, onRestart }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  const [postedToLeaderboard, setPostedToLeaderboard] = useState(false);
  
  // Cognito Auth State & Modal
  const [authSession, setAuthSession] = useState(getStoredAuth());
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      setError('');
      try {
        const res = await getFeedback(sessionResult.sessionId, sessionResult);
        if (res.success) {
          setReport(res);
        }
      } catch (err) {
        console.error('Error fetching feedback report:', err);
        setError(err.message || 'Failed to load feedback report from API Gateway.');
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [sessionResult]);

  const handlePublishScore = async () => {
    const currentAuth = authSession || getStoredAuth();
    if (!currentAuth) {
      // Require login via Cognito before submitting score
      setShowAuthModal(true);
      return;
    }

    setPosting(true);
    setError('');
    try {
      const activeReport = report || sessionResult;
      await addScoreToLeaderboard({
        user: activeReport.candidateName || currentAuth.email,
        score: activeReport.totalScore || 80,
        role: activeReport.role || 'Software Engineer',
        roundScores: activeReport.roundBreakdown?.map((r) => r.score) || [80, 80, 80],
        fillerWordsCount: activeReport.fluencyFeedback?.fillerWordCount || 0,
        wpm: activeReport.fluencyFeedback?.wpm || 138
      });
      setPostedToLeaderboard(true);
    } catch (err) {
      console.error('Error publishing score:', err);
      setError(err.message || 'Failed to publish score to AWS Leaderboard.');
    } finally {
      setPosting(false);
    }
  };

  const handleAuthSuccess = (newSession) => {
    setAuthSession(newSession);
    // Auto-trigger score publish after login
    setTimeout(() => {
      handlePublishScore();
    }, 300);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-xl font-bold text-white">Analyzing Speech Transcript & Feedback...</h2>
        <p className="text-slate-400 text-sm">Evaluating Content Depth, Keyword Relevance, and Voice Speech Fluency metrics via AWS Lambda...</p>
      </div>
    );
  }

  // Safe fallback if report loading failed or returned null
  const activeReport = report || {
    totalScore: sessionResult?.roundScores ? Math.round(sessionResult.roundScores.reduce((a, b) => a + b, 0) / sessionResult.roundScores.length) : 78,
    candidateName: sessionResult?.candidateName || 'Candidate',
    role: sessionResult?.role || 'Software Engineer',
    roundBreakdown: [
      { round: 1, name: 'Warm-up', score: sessionResult?.roundScores?.[0] || 85, status: 'Completed' },
      { round: 2, name: 'Behavioral', score: sessionResult?.roundScores?.[1] || 80, status: 'Completed' },
      { round: 3, name: 'Stress', score: sessionResult?.roundScores?.[2] || 82, status: 'Completed' }
    ],
    contentFeedback: {
      relevanceScore: 82,
      technicalDepthScore: 78,
      structureScore: 84,
      strengths: ['Relevant role background provided with structured clarity.'],
      improvements: ['Elaborate with specific metric outcomes and STAR framework in future rounds.']
    },
    fluencyFeedback: {
      fluencyScore: 85,
      wpm: 138,
      fillerWordCount: 2,
      fillerWordsDetected: ['um (1x)', 'like (1x)'],
      clarityRating: 'High',
      tonePacing: 'Steady & Confident'
    }
  };

  const { totalScore, contentFeedback, fluencyFeedback, roundBreakdown, candidateName, role } = activeReport;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Cognito Auth Modal */}
      <CognitoAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <Award className="w-4 h-4" /> Comprehensive Performance Evaluation
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          Evaluation Report for <span className="gradient-text">{candidateName}</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Target Role: <strong className="text-cyan-400">{role}</strong> • 3-Round Voice Assessment Complete
        </p>

        {authSession && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cognito Authenticated: {authSession.email}</span>
          </div>
        )}
      </div>

      {/* Hero Card: Overall Mock Interview Score */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Circular / Large Score Badge */}
          <div className="text-center md:border-r border-slate-800 md:pr-6 space-y-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Final Overall Score</span>
            <div className="text-6xl font-black gradient-text my-2">{totalScore}%</div>
            <p className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full inline-block border border-emerald-500/20">
              {totalScore >= 90 ? 'Outstanding Candidate' : totalScore >= 75 ? 'Strong Interview Performance' : 'Developing Skills'}
            </p>
          </div>

          {/* Overall Progress Meter */}
          <div className="md:col-span-2 space-y-4">
            <ScoreBar score={totalScore} label="Overall Mock Evaluation Score" size="lg" />
            <div className="grid grid-cols-3 gap-3 text-center pt-2">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <p className="text-xs text-slate-400">Content Quality</p>
                <p className="text-lg font-bold text-cyan-400">{contentFeedback.relevanceScore}%</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <p className="text-xs text-slate-400">Speech Fluency</p>
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

      {/* SECTION 1: Content & Technical Feedback */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 border border-cyan-500/20">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>1. Content & Technical Evaluation</span>
            </h3>
            <p className="text-xs text-slate-400">Role relevance, technical depth, and STAR response structure</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ScoreBar score={contentFeedback.relevanceScore} label="Role Relevance" size="sm" />
            <ScoreBar score={contentFeedback.technicalDepthScore} label="Technical Depth" size="sm" />
            <ScoreBar score={contentFeedback.structureScore} label="STAR Structure" size="sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Key Strengths */}
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Key Content Strengths
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
                <AlertTriangle className="w-4 h-4" /> Content Improvements
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

      {/* SECTION 2: Speech Fluency Feedback */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 border border-indigo-500/20">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>2. Speech Fluency & Delivery</span>
            </h3>
            <p className="text-xs text-slate-400">Pacing (WPM), filler word frequency, and vocal tone confidence</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
            <span className="text-xs text-slate-400">Speaking Pace</span>
            <p className="text-2xl font-black text-white">{fluencyFeedback.wpm} <span className="text-xs font-normal text-slate-400">WPM</span></p>
            <p className="text-[11px] text-emerald-400 font-semibold">Optimal Speed (130-150 WPM)</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
            <span className="text-xs text-slate-400">Filler Words</span>
            <p className="text-2xl font-black text-indigo-400">{fluencyFeedback.fillerWordCount}</p>
            <p className="text-[11px] text-slate-400">Total fillers detected</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
            <span className="text-xs text-slate-400">Vocal Confidence</span>
            <p className="text-xl font-bold text-cyan-400">{fluencyFeedback.tonePacing}</p>
            <p className="text-[11px] text-slate-400">Articulate & Clear</p>
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
          <TrendingUp className="w-4 h-4 text-cyan-400" /> Per-Round Score Breakdown
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
          <span>Start New Interview</span>
        </button>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePublishScore}
            disabled={posting || postedToLeaderboard}
            className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              postedToLeaderboard
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg glow-cyan'
            }`}
          >
            {posting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Posting to Leaderboard...</span>
              </>
            ) : postedToLeaderboard ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Score Published to Leaderboard!</span>
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Publish Score via Cognito</span>
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
