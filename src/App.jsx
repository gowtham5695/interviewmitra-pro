import React, { useState } from 'react';
import { Mic, Sparkles, Trophy, FileText, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import ResumeUpload from './components/ResumeUpload';
import InterviewSession from './components/InterviewSession';
import FeedbackReport from './components/FeedbackReport';
import Leaderboard from './components/Leaderboard';

export default function App() {
  // Application Stage: 'UPLOAD' | 'INTERVIEW' | 'FEEDBACK' | 'LEADERBOARD'
  const [stage, setStage] = useState('UPLOAD');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);

  // Callback when Resume is uploaded & session starts
  const handleSessionStart = (info) => {
    setSessionInfo(info);
    setStage('INTERVIEW');
  };

  // Callback when 3-round interview completes
  const handleInterviewComplete = (result) => {
    setSessionResult(result);
    setStage('FEEDBACK');
  };

  const handleRestart = () => {
    setSessionInfo(null);
    setSessionResult(null);
    setStage('UPLOAD');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-slate-100 selection:bg-cyan-500 selection:text-black">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={handleRestart}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg glow-cyan group-hover:scale-105 transition-transform">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                InterviewMitra<span className="text-cyan-400">Pro</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold">
                HACKATHON EDITION
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">AI Voice Mock Interview Coach</p>
          </div>
        </div>

        {/* Step Progress Tracker */}
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
          <button
            onClick={() => setStage('UPLOAD')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              stage === 'UPLOAD' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Resume & Role
          </button>
          <span className="text-slate-600">→</span>
          <button
            onClick={() => sessionInfo && setStage('INTERVIEW')}
            disabled={!sessionInfo}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              stage === 'INTERVIEW' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 disabled:opacity-40'
            }`}
          >
            2. Voice Interview
          </button>
          <span className="text-slate-600">→</span>
          <button
            onClick={() => sessionResult && setStage('FEEDBACK')}
            disabled={!sessionResult}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              stage === 'FEEDBACK' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 disabled:opacity-40'
            }`}
          >
            3. Feedback
          </button>
        </div>

        {/* Leaderboard Nav Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStage('LEADERBOARD')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              stage === 'LEADERBOARD'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Leaderboard</span>
          </button>
        </div>
      </header>

      {/* Main Container View */}
      <main className="flex-1 py-4">
        {stage === 'UPLOAD' && (
          <ResumeUpload onSessionStart={handleSessionStart} />
        )}

        {stage === 'INTERVIEW' && sessionInfo && (
          <InterviewSession
            sessionInfo={sessionInfo}
            onInterviewComplete={handleInterviewComplete}
          />
        )}

        {stage === 'FEEDBACK' && sessionResult && (
          <FeedbackReport
            sessionResult={sessionResult}
            onViewLeaderboard={() => setStage('LEADERBOARD')}
            onRestart={handleRestart}
          />
        )}

        {stage === 'LEADERBOARD' && (
          <Leaderboard
            currentUser={sessionInfo}
            onBackToUpload={handleRestart}
          />
        )}
      </main>

      {/* Modern Footer */}
      <footer className="border-t border-slate-900 py-6 px-4 text-center text-xs text-slate-500 space-y-2">
        <p className="flex items-center justify-center gap-3">
          <span>Web Speech API STT (Browser Native)</span>
          <span>•</span>
          <span>Amazon Polly TTS</span>
          <span>•</span>
          <span>AWS Amplify Ready</span>
        </p>
        <p>© 2026 InterviewMitra Pro Team. Built for Hackathon Excellence.</p>
      </footer>
    </div>
  );
}
