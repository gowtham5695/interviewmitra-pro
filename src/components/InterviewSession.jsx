import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Send, ArrowRight, RefreshCw, AlertCircle, Sparkles, CheckCircle2, Clock, HelpCircle, Activity } from 'lucide-react';
import DifficultyBadge from './DifficultyBadge';
import ScoreBar from './ScoreBar';
import { getQuestion, submitAnswer, getNextRound } from '../services/api';

export default function InterviewSession({ sessionInfo, onInterviewComplete }) {
  const [round, setRound] = useState(1);
  const [question, setQuestion] = useState(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [recognitionError, setRecognitionError] = useState('');

  // Audio Playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  
  // Per-round tracking
  const [roundScores, setRoundScores] = useState([]);
  const [roundAnswers, setRoundAnswers] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(60);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setRecognitionError('Web Speech API is not supported in this browser. You can type your response manually below.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript + ' ';
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setRecognitionError('Microphone permission denied. Please allow mic access or type your response below.');
        setIsListening(false);
      } else if (event.error !== 'no-speech') {
        setRecognitionError(`Mic error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // If user intended to keep listening, restart recognition
      if (recognitionRef.current?.shouldBeListening) {
        try {
          recognition.start();
        } catch (e) {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.shouldBeListening = false;
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Fetch question whenever round changes
  useEffect(() => {
    loadQuestionForRound(round);
  }, [round]);

  // Question countdown timer
  useEffect(() => {
    if (!loadingQuestion && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [loadingQuestion, timerSeconds]);

  const loadQuestionForRound = async (targetRound) => {
    setLoadingQuestion(true);
    setTranscript('');
    setRecognitionError('');
    setIsListening(false);

    try {
      const res = await getQuestion(sessionInfo.sessionId, targetRound, sessionInfo.role);
      if (res.success) {
        setQuestion(res.question);
        setTimerSeconds(res.question.durationSec || (targetRound === 1 ? 60 : targetRound === 2 ? 120 : 180));
        // Auto play question speech via Web Speech Synthesis or simulated Polly audio
        speakQuestionText(res.question.text);
      }
    } catch (err) {
      console.error('Error fetching question:', err);
      setRecognitionError(err.message || 'Error fetching question from API Gateway.');
    } finally {
      setLoadingQuestion(false);
    }
  };

  // Text-to-Speech question playback (Amazon Polly simulation / Web Speech Synthesis fallback)
  const speakQuestionText = (text) => {
    if (audioMuted) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // stop previous
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlayingAudio(true);
      setTimeout(() => setIsPlayingAudio(false), 3000);
    }
  };

  // Toggle Microphone Listening (Web Speech API)
  const toggleListening = () => {
    if (!speechSupported) return;
    setRecognitionError('');

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.shouldBeListening = false;
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
    } else {
      // Stop TTS playback if currently reading question
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsPlayingAudio(false);

      if (recognitionRef.current) {
        recognitionRef.current.shouldBeListening = true;
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.warn('Could not start recognition:', e);
          setIsListening(false);
        }
      }
    }
  };

  // Submit Answer Text to Backend
  const handleSubmitAnswer = async () => {
    if (!transcript.trim()) {
      setRecognitionError('Answer text is empty. Please speak or type your answer before submitting.');
      return;
    }

    // Stop recording
    if (isListening) {
      toggleListening();
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    setSubmitting(true);
    try {
      const res = await submitAnswer(
        sessionInfo.sessionId,
        round,
        question?.id || 'q_1',
        transcript.trim()
      );

      if (res.success) {
        const newScores = [...roundScores, res.roundScore];
        const newAnswers = [...roundAnswers, { round, question: question?.text, answer: transcript, score: res.roundScore }];
        setRoundScores(newScores);
        setRoundAnswers(newAnswers);

        // Transition to next round or complete interview
        if (round >= 3) {
          try {
            await getNextRound(sessionInfo.sessionId, round);
          } catch (e) {
            console.warn('getNextRound call note:', e.message);
          }
          onInterviewComplete({
            sessionId: sessionInfo.sessionId,
            candidateName: sessionInfo.candidateName,
            role: sessionInfo.role,
            roundScores: newScores,
            roundAnswers: newAnswers
          });
        } else {
          try {
            const nextRes = await getNextRound(sessionInfo.sessionId, round);
            setRound(nextRes.currentRound || (round + 1));
          } catch (e) {
            setRound(round + 1);
          }
        }
      }
    } catch (err) {
      setRecognitionError(err.message || 'Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Top Session Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 p-4 rounded-2xl glass-card border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-lg border border-cyan-500/20">
            {sessionInfo.candidateName ? sessionInfo.candidateName.charAt(0).toUpperCase() : 'C'}
          </div>
          <div>
            <h2 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              {sessionInfo.candidateName}
              <span className="text-xs text-slate-400 font-normal">({sessionInfo.role})</span>
            </h2>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>File: {sessionInfo.fileName || 'Resume.pdf'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <DifficultyBadge round={round} />
          
          {/* Round Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      {/* Main Question & Speech Interface */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Question Header & TTS Audio Player */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> AI Interviewer Question
            </span>

            {/* TTS Sound Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => speakQuestionText(question?.text || '')}
                title="Replay Question Audio (Amazon Polly TTS)"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1.5"
              >
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Listen Again</span>
              </button>

              <button
                type="button"
                onClick={() => setAudioMuted(!audioMuted)}
                className={`p-2 rounded-lg transition-colors text-xs ${
                  audioMuted ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title={audioMuted ? 'Unmute TTS' : 'Mute TTS'}
              >
                {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Question Text Box */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-lg sm:text-xl font-semibold text-white leading-relaxed relative">
            {loadingQuestion ? (
              <div className="flex items-center gap-3 py-4 text-slate-400 text-base">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span>Generating Round {round} question tailored to your resume...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p>{question?.text}</p>
                
                {/* Audio Waveform Animation when Polly/TTS is speaking */}
                {isPlayingAudio && (
                  <div className="flex items-center gap-1 pt-2">
                    <span className="text-xs text-cyan-400 font-mono mr-2">Polly Speaking:</span>
                    <span className="w-1 h-4 bg-cyan-400 rounded-full animate-pulse" />
                    <span className="w-1 h-6 bg-indigo-400 rounded-full animate-pulse delay-75" />
                    <span className="w-1 h-3 bg-purple-400 rounded-full animate-pulse delay-150" />
                    <span className="w-1 h-5 bg-cyan-400 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Voice Input Controls & Visualizer */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> Your Spoken Answer (Web Speech STT)
            </span>
            {isListening && (
              <span className="flex items-center gap-2 text-xs text-rose-400 font-semibold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Recording Speech Live...
              </span>
            )}
          </div>

          {/* Mic Button & Wave Visualizer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <button
              type="button"
              onClick={toggleListening}
              className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-300 ${
                isListening
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg glow-rose animate-pulse'
                  : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg glow-cyan'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-5 h-5 animate-bounce" />
                  <span>Stop Recording</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  <span>Start Speaking</span>
                </>
              )}
            </button>

            {/* Audio Wave Visualizer Bars */}
            <div className="flex items-center gap-1.5 h-8 px-4 py-1 rounded-xl bg-slate-950 border border-slate-800">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
                <div
                  key={bar}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isListening
                      ? 'bg-cyan-400 animate-wave-bar'
                      : 'bg-slate-700 h-2'
                  }`}
                  style={{ animationDelay: `${bar * 120}ms` }}
                />
              ))}
              <span className="text-[11px] font-mono text-slate-400 ml-2">
                {isListening ? 'Mic Active' : 'Mic Idle'}
              </span>
            </div>
          </div>

          {/* Live Transcribed Text Box */}
          <div className="relative">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={
                isListening
                  ? "Listening to your microphone in real-time... Speak clearly."
                  : "Click 'Start Speaking' to speak your answer, or type directly here..."
              }
              rows={5}
              className="w-full bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-sans leading-relaxed"
            />
            {transcript && (
              <button
                type="button"
                onClick={() => setTranscript('')}
                className="absolute top-3 right-3 text-xs text-slate-500 hover:text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800"
              >
                Clear Text
              </button>
            )}
          </div>

          {/* Recognition Error Banner */}
          {recognitionError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{recognitionError}</span>
            </div>
          )}
        </div>

        {/* Submit & Progression CTA */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            <span>Round {round} of 3 • </span>
            <span className="text-slate-300 font-semibold">Answer text sent to backend for scoring</span>
          </div>

          <button
            type="button"
            onClick={handleSubmitAnswer}
            disabled={submitting || !transcript.trim()}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Evaluating Response...</span>
              </>
            ) : (
              <>
                <span>Submit & {round === 3 ? 'View Final Report' : 'Next Round'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
