import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, Briefcase, User, Sparkles, ShieldCheck } from 'lucide-react';
import { uploadResume } from '../services/api';

const ROLES = [
  'Software Engineer',
  'Frontend Developer',
  'Product Manager',
  'Data Scientist',
  'DevOps Engineer'
];

export default function ResumeUpload({ onSessionStart }) {
  const [file, setFile] = useState(null);
  const [role, setRole] = useState('Software Engineer');
  const [candidateName, setCandidateName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsedData, setParsedData] = useState(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setError('');

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const selectedFile = droppedFiles[0];
      if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        setFile(selectedFile);
      } else {
        setError('Please upload a valid PDF document (.pdf).');
      }
    }
  };

  const handleFileSelect = (e) => {
    setError('');
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        setFile(selectedFile);
      } else {
        setError('Please upload a valid PDF document (.pdf).');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!candidateName.trim()) {
      setError('Please enter your candidate name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await uploadResume(file, role, candidateName);
      if (result.success) {
        setParsedData(result);
        setTimeout(() => {
          onSessionStart({
            sessionId: result.sessionId,
            candidateName,
            role,
            fileName: result.fileName,
            extractedKeywords: result.extractedKeywords
          });
        }, 800);
      } else {
        setError('Failed to process resume. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during resume upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5" /> AI Spoken Interview Coach
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
          Configure Your <span className="gradient-text">Mock Interview</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto">
          Upload your resume and choose your target job role. Our AI interviewer will generate 3 rounds of adaptive questions tailored to your experience.
        </p>
      </div>

      {/* Main Upload Card */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle Background Glow Accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          {/* Candidate Name Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <User className="w-4 h-4 text-cyan-400" /> Candidate Name
            </label>
            <input
              type="text"
              required
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="e.g. Alex Morgan"
              className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-sm"
            />
          </div>

          {/* Role Selection Dropdown */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-cyan-400" /> Target Job Role
            </label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-sm cursor-pointer"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} className="bg-slate-900 text-white">
                    {r}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400">
                ▼
              </div>
            </div>
          </div>

          {/* Drag & Drop PDF Resume Zone */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyan-400" /> Upload Resume (PDF)
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : file
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-700/80 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60'
              }`}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                id="resume-file-input"
                className="hidden"
                onChange={handleFileSelect}
              />
              <label htmlFor="resume-file-input" className="cursor-pointer block">
                {file ? (
                  <div className="flex items-center justify-center gap-3 text-emerald-400">
                    <CheckCircle2 className="w-8 h-8 flex-shrink-0 animate-bounce" />
                    <div className="text-left overflow-hidden">
                      <p className="font-semibold text-sm truncate max-w-xs">{file.name}</p>
                      <p className="text-xs text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB • PDF Document Ready
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-800/80 text-cyan-400 flex items-center justify-center mx-auto border border-slate-700">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        <span className="text-cyan-400 font-semibold hover:underline">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        PDF resumes (Max 10MB) • Keyword extraction powered by PyPDF
                      </p>
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Parsed Keywords Preview State */}
          {parsedData && (
            <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold">
                <span>Resume Keywords Extracted:</span>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {parsedData.extractedKeywords.map((kw) => (
                  <span key={kw} className="px-2.5 py-0.5 rounded-md bg-slate-900/90 text-cyan-400 text-xs font-mono border border-cyan-500/30">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Submit / Start Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 p-[1px] font-bold text-white shadow-lg focus:outline-none disabled:opacity-50"
          >
            <div className="w-full bg-[#0d1322] group-hover:bg-opacity-0 transition-all duration-300 rounded-[11px] py-3.5 px-6 flex items-center justify-center gap-2 text-sm sm:text-base">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>Preparing AI Interview Session...</span>
                </>
              ) : (
                <>
                  <span>Start 3-Round Mock Interview</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </div>
          </button>
        </form>

        {/* Feature Pills Footer */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Browser Web Speech API
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Amazon Polly TTS Audio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> 3 Rounds (Warmup/Behavioral/Stress)
          </span>
        </div>
      </div>
    </div>
  );
}
