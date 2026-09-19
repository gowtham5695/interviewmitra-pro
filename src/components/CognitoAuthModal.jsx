import React, { useState } from 'react';
import { Lock, Mail, Key, UserCheck, AlertCircle, Sparkles, X, CheckCircle2, LogIn, UserPlus } from 'lucide-react';
import { loginWithCognito, signUpWithCognito, DEMO_USER } from '../services/cognitoAuth';

export default function CognitoAuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        const res = await signUpWithCognito(email, password);
        if (res.success) {
          setSuccessMsg('Account created successfully! Auto-logging in with Cognito...');
          // Attempt auto login after sign up
          const loginRes = await loginWithCognito(email, password);
          if (loginRes.success) {
            onAuthSuccess(loginRes.session);
            onClose();
          }
        }
      } else {
        const loginRes = await loginWithCognito(email, password);
        if (loginRes.success) {
          onAuthSuccess(loginRes.session);
          onClose();
        }
      }
    } catch (err) {
      setError(err.message || 'Cognito authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail(DEMO_USER.email);
    setPassword(DEMO_USER.password);
    setLoading(true);
    setError('');
    setSuccessMsg('Signing in with verified Cognito account...');

    try {
      const loginRes = await loginWithCognito(DEMO_USER.email, DEMO_USER.password);
      if (loginRes.success) {
        onAuthSuccess(loginRes.session);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Demo Cognito login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-700/60 relative overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Lock className="w-3.5 h-3.5" /> AWS Cognito Authentication
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            {isSignUp ? 'Create Candidate Account' : 'Cognito User Login'}
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Authenticate via AWS Cognito User Pool to publish scores & rank on the Leaderboard.
          </p>
        </div>

        {/* Demo 1-Click Login Shortcut */}
        <div className="mb-6 p-3.5 rounded-xl bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Hackathon Evaluator Quick Access
            </p>
            <p className="text-[11px] text-slate-400">Pre-configured test user: testuser@example.com</p>
          </div>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <UserCheck className="w-4 h-4" />
            <span>1-Click Demo Login</span>
          </button>
        </div>

        {/* Auth Mode Selector Tabs */}
        <div className="flex border-b border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
              !isSignUp ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
              isSignUp ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Account</span>
          </button>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-cyan-400" /> Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="candidate@example.com"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" /> Password (Min 8 chars, 1 uppercase, 1 number)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 animate-pulse" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Authenticating with AWS Cognito...</span>
              </>
            ) : (
              <span>{isSignUp ? 'Create Cognito Account' : 'Sign In with Cognito'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
