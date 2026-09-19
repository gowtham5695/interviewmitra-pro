import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Search, Filter, RefreshCw, ArrowLeft, Award, Sparkles, UserCheck, Lock, LogIn, PlusCircle } from 'lucide-react';
import CognitoAuthModal from './CognitoAuthModal';
import { getLeaderboard, addScoreToLeaderboard } from '../services/api';
import { getStoredAuth, clearStoredAuth } from '../services/cognitoAuth';

const ROLES = [
  'All',
  'Software Engineer',
  'Frontend Developer',
  'Product Manager',
  'Data Scientist',
  'DevOps Engineer'
];

export default function Leaderboard({ currentUser, onBackToUpload }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedRole, setSelectedRole] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Cognito auth state & modal
  const [authSession, setAuthSession] = useState(getStoredAuth());
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Quick score submit form state inside Leaderboard
  const [submitScoreInput, setSubmitScoreInput] = useState('');
  const [submittingScore, setSubmittingScore] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');

  const fetchLeaderboardData = async (role) => {
    setLoading(true);
    setError('');
    try {
      const res = await getLeaderboard(role);
      if (res.success) {
        setLeaderboard(res.leaderboard);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard rankings:', err);
      if (err.status === 401) {
        setError('AWS API Gateway Authorization required. Please click "Login via Cognito" to authenticate.');
      } else {
        setError(err.message || 'Failed to fetch leaderboard rankings from AWS API Gateway.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData(selectedRole);
  }, [selectedRole, authSession]);

  const handleAuthSuccess = (session) => {
    setAuthSession(session);
    fetchLeaderboardData(selectedRole);
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuthSession(null);
  };

  const handleManualScoreSubmit = async (e) => {
    e.preventDefault();
    if (!authSession) {
      setShowAuthModal(true);
      return;
    }

    const val = parseFloat(submitScoreInput);
    if (isNaN(val) || val < 0 || val > 100) {
      setError('Please enter a valid score percentage between 0 and 100.');
      return;
    }

    setSubmittingScore(true);
    setError('');
    setSubmitSuccess('');

    try {
      await addScoreToLeaderboard({
        user: currentUser?.candidateName || authSession.email.split('@')[0],
        score: val,
        role: currentUser?.role || (selectedRole !== 'All' ? selectedRole : 'Software Engineer'),
        fillerWordsCount: 2,
        wpm: 140
      });
      setSubmitSuccess(`Score ${val}% successfully submitted to AWS Leaderboard!`);
      setSubmitScoreInput('');
      fetchLeaderboardData(selectedRole);
    } catch (err) {
      setError(err.message || 'Failed to post score to leaderboard.');
    } finally {
      setSubmittingScore(false);
    }
  };

  // Filter leaderboard based on search query
  const filteredData = leaderboard.filter((item) =>
    item.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-400/20 text-amber-300 font-extrabold text-sm border border-amber-400/40 shadow-sm">
          🥇
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-400/20 text-slate-200 font-extrabold text-sm border border-slate-400/40 shadow-sm">
          🥈
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/20 text-amber-500 font-extrabold text-sm border border-amber-700/40 shadow-sm">
          🥉
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-slate-400 font-bold text-xs border border-slate-800">
        #{rank}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Cognito Auth Modal */}
      <CognitoAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Header Banner & Cognito Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Trophy className="w-3.5 h-3.5" /> AWS DynamoDB Rankings
          </div>
          <h1 className="text-3xl font-extrabold text-white">
            Candidate <span className="gradient-text">Leaderboard</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Top 10 candidates evaluated live via AWS API Gateway REST API
          </p>
        </div>

        {/* Auth Action Controls */}
        <div className="flex items-center gap-3 self-start sm:self-center">
          {authSession ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <p className="font-bold text-white truncate max-w-[140px]">{authSession.email}</p>
                <p className="text-[10px] text-emerald-400">Cognito Authenticated</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 text-slate-400 hover:text-rose-400 text-[11px] font-semibold underline"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg glow-cyan"
            >
              <Lock className="w-4 h-4" />
              <span>Login via Cognito</span>
            </button>
          )}

          {onBackToUpload && (
            <button
              type="button"
              onClick={onBackToUpload}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>New Practice</span>
            </button>
          )}
        </div>
      </div>

      {/* Manual Score Submission Banner for Authenticated Users */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-800">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Submit Candidate Score</h3>
              <p className="text-xs text-slate-400">Requires Cognito authentication prior to DynamoDB submission.</p>
            </div>
          </div>

          <form onSubmit={handleManualScoreSubmit} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="number"
              min="0"
              max="100"
              value={submitScoreInput}
              onChange={(e) => setSubmitScoreInput(e.target.value)}
              placeholder="Score (e.g. 88)"
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white w-28 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <button
              type="submit"
              disabled={submittingScore}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {submittingScore ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Submit Score</span>
                </>
              )}
            </button>
          </form>
        </div>

        {submitSuccess && (
          <p className="mt-3 text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
            <span>✓ {submitSuccess}</span>
          </p>
        )}
      </div>

      {/* Filter Controls Bar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Role Filter Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer w-full sm:w-48"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r === 'All' ? 'All Target Roles' : r}
              </option>
            ))}
          </select>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate or role..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
      </div>

      {/* Leaderboard Table Card */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
        {error && (
          <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs sm:text-sm flex items-center justify-between gap-2">
            <span>⚠️ <strong>AWS API Gateway Note:</strong> {error}</span>
            {!authSession && (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="px-3 py-1 rounded-lg bg-rose-500 text-white font-bold text-xs"
              >
                Sign In Now
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold">Loading Leaderboard Rankings from AWS API Gateway...</p>
            <p className="text-[11px] text-slate-500">GET https://uv12f3v25j.execute-api.ap-south-1.amazonaws.com/Prod/leaderboard</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Award className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-semibold">No candidate scores recorded yet for this filter.</p>
            <p className="text-xs text-slate-500">Complete an interview session or submit a score above to see rankings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold text-center w-16">Rank</th>
                  <th className="py-3.5 px-4 font-semibold">Candidate Name</th>
                  <th className="py-3.5 px-4 font-semibold">Target Role</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Fluency WPM</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Fillers</th>
                  <th className="py-3.5 px-4 font-semibold text-right pr-6">Overall Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredData.map((item, index) => {
                  const rank = index + 1;
                  const isCurrentCandidate = (currentUser && currentUser.candidateName === item.user) || (authSession && authSession.email === item.user);

                  return (
                    <tr
                      key={item.id || index}
                      className={`transition-colors ${
                        isCurrentCandidate
                          ? 'bg-cyan-500/10 border-l-4 border-l-cyan-400 hover:bg-cyan-500/15'
                          : 'hover:bg-slate-900/40'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        {getRankBadge(rank)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{item.user}</span>
                          {isCurrentCandidate && (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
                          {item.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-300 font-mono">
                        {item.wpm || 138}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                          (item.fillerWordsCount || 0) <= 3 
                            ? 'bg-emerald-500/10 text-emerald-400' 
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {item.fillerWordsCount ?? 2}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right pr-6 font-mono font-extrabold text-base">
                        <span className={item.score >= 90 ? 'text-emerald-400' : item.score >= 80 ? 'text-cyan-400' : 'text-slate-200'}>
                          {item.score}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Banner */}
      <div className="text-center text-xs text-slate-500 pt-2">
        <span>Leaderboard syncs dynamically with AWS DynamoDB via Cognito Auth • InterviewMitra Pro v1.0</span>
      </div>
    </div>
  );
}
