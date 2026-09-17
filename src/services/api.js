/**
 * InterviewMitra Pro API Service Layer
 * Supports placeholder AWS API Gateway endpoints with seamless offline mock fallback.
 */

// Toggle for offline hackathon testing vs AWS API Gateway
const USE_MOCK_API = true;
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'https://api.interviewmitra-pro.aws.com/v1';

// Sample mock question bank grouped by role and difficulty round
const QUESTION_BANK = {
  'Software Engineer': {
    1: [
      { id: 'se-101', text: "Welcome! Tell me about yourself and your primary technical stack.", durationSec: 60, audioUrl: null },
      { id: 'se-102', text: "What inspired you to apply for a Software Engineering position today?", durationSec: 60, audioUrl: null }
    ],
    2: [
      { id: 'se-201', text: "Describe a challenging bug you diagnosed in production. How did you resolve it under time pressure?", durationSec: 120, audioUrl: null },
      { id: 'se-202', text: "Tell me about a time you had a technical disagreement with a teammate. How did you reach consensus?", durationSec: 120, audioUrl: null }
    ],
    3: [
      { id: 'se-301', text: "How would you architect a fault-tolerant, high-throughput microservice for processing real-time telemetry events?", durationSec: 180, audioUrl: null },
      { id: 'se-302', text: "If system memory spikes unexpectedly by 400% during a traffic peak, how would you triage the issue in production?", durationSec: 180, audioUrl: null }
    ]
  },
  'Frontend Developer': {
    1: [
      { id: 'fe-101', text: "Hi! Can you walk me through your experience building responsive React web applications?", durationSec: 60, audioUrl: null }
    ],
    2: [
      { id: 'fe-201', text: "Describe how you optimized a web app's initial render time and Core Web Vitals.", durationSec: 120, audioUrl: null }
    ],
    3: [
      { id: 'fe-301', text: "How do you handle complex state synchronization across independent micro-frontends or tabs without race conditions?", durationSec: 180, audioUrl: null }
    ]
  },
  'Product Manager': {
    1: [
      { id: 'pm-101', text: "Welcome! Give me a quick overview of a product feature you spearheaded from ideation to launch.", durationSec: 60, audioUrl: null }
    ],
    2: [
      { id: 'pm-201', text: "Tell me about a time a key product metric dropped drastically post-release. How did you react?", durationSec: 120, audioUrl: null }
    ],
    3: [
      { id: 'pm-301', text: "How do you balance aggressive developer tech debt cleanup against critical customer feature requests under tight deadlines?", durationSec: 180, audioUrl: null }
    ]
  },
  'Data Scientist': {
    1: [
      { id: 'ds-101', text: "Welcome! Tell me about your background in machine learning and statistical modeling.", durationSec: 60, audioUrl: null }
    ],
    2: [
      { id: 'ds-201', text: "Describe how you handled severe class imbalance in a predictive model dataset.", durationSec: 120, audioUrl: null }
    ],
    3: [
      { id: 'ds-301', text: "How do you detect and mitigate data drift and concept drift in production ML pipelines?", durationSec: 180, audioUrl: null }
    ]
  },
  'DevOps Engineer': {
    1: [
      { id: 'dev-101', text: "Hello! Tell me about your experience managing CI/CD pipelines and infrastructure as code.", durationSec: 60, audioUrl: null }
    ],
    2: [
      { id: 'dev-201', text: "Describe an incident where a deployment pipeline broke. How did you fix it and prevent recurrence?", durationSec: 120, audioUrl: null }
    ],
    3: [
      { id: 'dev-301', text: "How would you design a zero-downtime multi-region Kubernetes failover architecture?", durationSec: 180, audioUrl: null }
    ]
  }
};

// Initial Mock Leaderboard Data
let MOCK_LEADERBOARD = [
  { id: 'lb-1', user: 'Priya Sharma', score: 96, role: 'Software Engineer', date: '2026-09-17', roundScores: [98, 95, 95], fillerWordsCount: 2, wpm: 142 },
  { id: 'lb-2', user: 'Alex Chen', score: 94, role: 'Frontend Developer', date: '2026-09-16', roundScores: [95, 92, 95], fillerWordsCount: 3, wpm: 138 },
  { id: 'lb-3', user: 'Rohan Verma', score: 91, role: 'Software Engineer', date: '2026-09-17', roundScores: [90, 92, 91], fillerWordsCount: 4, wpm: 148 },
  { id: 'lb-4', user: 'Sarah Jenkins', score: 89, role: 'Product Manager', date: '2026-09-15', roundScores: [92, 88, 87], fillerWordsCount: 5, wpm: 130 },
  { id: 'lb-5', user: 'Vikram Patel', score: 87, role: 'DevOps Engineer', date: '2026-09-16', roundScores: [88, 86, 87], fillerWordsCount: 4, wpm: 135 },
  { id: 'lb-6', user: 'Elena Rostova', score: 85, role: 'Data Scientist', date: '2026-09-14', roundScores: [86, 84, 85], fillerWordsCount: 6, wpm: 128 },
  { id: 'lb-7', user: 'Karthik Raja', score: 84, role: 'Frontend Developer', date: '2026-09-17', roundScores: [85, 83, 84], fillerWordsCount: 7, wpm: 152 },
  { id: 'lb-8', user: 'Emily Watson', score: 82, role: 'Product Manager', date: '2026-09-13', roundScores: [84, 80, 82], fillerWordsCount: 5, wpm: 122 },
  { id: 'lb-9', user: 'David Kim', score: 80, role: 'Software Engineer', date: '2026-09-12', roundScores: [82, 79, 79], fillerWordsCount: 8, wpm: 160 },
  { id: 'lb-10', user: 'Ananya Roy', score: 78, role: 'Data Scientist', date: '2026-09-11', roundScores: [80, 77, 77], fillerWordsCount: 9, wpm: 118 }
];

// Helper delay simulator
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Upload candidate resume PDF & target role
 */
export async function uploadResume(file, role, candidateName = 'Candidate User') {
  if (USE_MOCK_API) {
    await delay(1000);
    const sessionId = `session_${Date.now()}`;
    // Simulating PyPDF extraction result handled by backend teammate
    const mockExtractedKeywords = ['React', 'TypeScript', 'Node.js', 'AWS', 'System Design', 'CI/CD', 'REST APIs'];
    
    return {
      success: true,
      sessionId,
      candidateName,
      role,
      fileName: file ? file.name : 'Uploaded_Resume.pdf',
      extractedKeywords: mockExtractedKeywords,
      currentRound: 1,
      totalRounds: 3
    };
  }

  // AWS API Gateway integration
  const formData = new FormData();
  if (file) formData.append('resume', file);
  formData.append('role', role);
  formData.append('candidateName', candidateName);

  const response = await fetch(`${API_BASE_URL}/upload-resume`, {
    method: 'POST',
    body: formData
  });
  return await response.json();
}

/**
 * Fetch current question for a given round
 */
export async function getQuestion(sessionId, round = 1, role = 'Software Engineer') {
  if (USE_MOCK_API) {
    await delay(600);
    const roleQuestions = QUESTION_BANK[role] || QUESTION_BANK['Software Engineer'];
    const roundQuestions = roleQuestions[round] || roleQuestions[1];
    const questionObj = roundQuestions[Math.floor(Math.random() * roundQuestions.length)];

    return {
      success: true,
      sessionId,
      round,
      question: questionObj,
      // Polly TTS audio link placeholder or simulated audio URL
      audioUrl: questionObj.audioUrl || `https://actions.google.com/sounds/v1/speech/human_voice.ogg`
    };
  }

  const response = await fetch(`${API_BASE_URL}/question?sessionId=${sessionId}&round=${round}&role=${encodeURIComponent(role)}`);
  return await response.json();
}

/**
 * Submit candidate's transcribed text answer (NO RAW AUDIO)
 */
export async function submitAnswer(sessionId, round, questionId, answerText) {
  if (USE_MOCK_API) {
    await delay(800);
    // Simple mock score calculation based on answer word count & key metrics
    const wordCount = answerText.trim().split(/\s+/).filter(Boolean).length;
    let roundScore = Math.min(98, Math.max(65, Math.floor(70 + (wordCount / 2))));
    
    // Calculate filler words in answer
    const fillers = (answerText.match(/\b(um|uh|like|you know|so|basically|actually)\b/gi) || []).length;

    return {
      success: true,
      sessionId,
      round,
      questionId,
      answerText,
      roundScore,
      wordCount,
      fillerCount: fillers,
      feedbackSnippet: wordCount > 25 
        ? "Strong articulate answer with good technical depth!" 
        : "Good starting points, but try to elaborate with concrete examples."
    };
  }

  const response = await fetch(`${API_BASE_URL}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, round, questionId, answerText })
  });
  return await response.json();
}

/**
 * Transition to next round
 */
export async function getNextRound(sessionId, currentRound) {
  if (USE_MOCK_API) {
    await delay(500);
    const nextRound = currentRound + 1;
    return {
      success: true,
      sessionId,
      currentRound: nextRound,
      isFinished: nextRound > 3
    };
  }

  const response = await fetch(`${API_BASE_URL}/next-round`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, currentRound })
  });
  return await response.json();
}

/**
 * Fetch comprehensive interview feedback report
 */
export async function getFeedback(sessionId, sessionData = {}) {
  if (USE_MOCK_API) {
    await delay(1200);
    
    const candidateName = sessionData.candidateName || 'Candidate';
    const role = sessionData.role || 'Software Engineer';
    const roundScores = sessionData.roundScores || [92, 88, 90];
    const totalScore = Math.round(roundScores.reduce((a, b) => a + b, 0) / roundScores.length);
    
    return {
      success: true,
      sessionId,
      candidateName,
      role,
      totalScore,
      roundBreakdown: [
        { round: 1, name: 'Warm-up', score: roundScores[0] || 90, status: 'Completed' },
        { round: 2, name: 'Behavioral', score: roundScores[1] || 88, status: 'Completed' },
        { round: 3, name: 'Technical / Stress', score: roundScores[2] || 92, status: 'Completed' },
      ],
      contentFeedback: {
        relevanceScore: 92,
        technicalDepthScore: 89,
        structureScore: 94,
        strengths: [
          'Excellent structural frameworks used (STAR method)',
          'Clear technical alignment with target role keywords',
          'Concisely articulated problem-solving logic under pressure'
        ],
        improvements: [
          'Quantify metrics more explicitly (e.g. latency reduced by X%)',
          'Provide deeper architectural trade-offs during Round 3'
        ]
      },
      fluencyFeedback: {
        fluencyScore: 88,
        wpm: 138, // words per minute
        fillerWordCount: 4,
        fillerWordsDetected: ['um (2x)', 'basically (1x)', 'you know (1x)'],
        clarityRating: 'High',
        tonePacing: 'Steady & Confident'
      }
    };
  }

  const response = await fetch(`${API_BASE_URL}/feedback?sessionId=${sessionId}`);
  return await response.json();
}

/**
 * Fetch leaderboard ranking table
 */
export async function getLeaderboard(roleFilter = 'All') {
  if (USE_MOCK_API) {
    await delay(400);
    let filtered = [...MOCK_LEADERBOARD];
    if (roleFilter && roleFilter !== 'All') {
      filtered = filtered.filter(item => item.role === roleFilter);
    }
    // Sort descending by score
    filtered.sort((a, b) => b.score - a.score);
    return {
      success: true,
      leaderboard: filtered.slice(0, 10)
    };
  }

  const response = await fetch(`${API_BASE_URL}/leaderboard?role=${encodeURIComponent(roleFilter)}`);
  return await response.json();
}

/**
 * Post user score to mock leaderboard
 */
export function addScoreToLeaderboard(entry) {
  const newEntry = {
    id: `lb_${Date.now()}`,
    user: entry.user || 'Candidate',
    score: entry.score || 85,
    role: entry.role || 'Software Engineer',
    date: new Date().toISOString().split('T')[0],
    roundScores: entry.roundScores || [85, 85, 85],
    fillerWordsCount: entry.fillerWordsCount || 3,
    wpm: entry.wpm || 135
  };
  MOCK_LEADERBOARD.unshift(newEntry);
  return newEntry;
}
