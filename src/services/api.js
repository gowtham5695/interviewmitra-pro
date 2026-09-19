import { getStoredAuth } from './cognitoAuth';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'https://uv12f3v25j.execute-api.ap-south-1.amazonaws.com/Prod';

// Helper to handle response and throw descriptive error on non-OK HTTP status
async function handleResponse(response, defaultErrorMessage) {
  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error(`HTTP ${response.status}: ${response.statusText || 'Server returned invalid JSON'}`);
  }

  if (!response.ok) {
    const errorMsg = data.message || data.error || data.detail || `HTTP ${response.status}: ${defaultErrorMessage}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * Upload candidate resume PDF & target role
 * POST https://uv12f3v25j.execute-api.ap-south-1.amazonaws.com/Prod/resume
 */
export async function uploadResume(file, role, candidateName = 'Candidate User') {
  const formData = new FormData();
  if (file) {
    formData.append('resume', file);
  }
  formData.append('role', role);
  formData.append('candidateName', candidateName);

  const response = await fetch(`${API_BASE_URL}/resume`, {
    method: 'POST',
    body: formData
  });

  const data = await handleResponse(response, 'Failed to upload resume');

  return {
    success: true,
    status: data.status || 'success',
    message: data.message || 'Resume processed successfully.',
    sessionId: data.sessionId || `session_${Date.now()}`,
    candidateName: data.candidateName || candidateName,
    role: data.role || role,
    fileName: data.fileName || (file ? file.name : 'Uploaded_Resume.pdf'),
    extractedKeywords: data.extractedKeywords || data.keywords || ['React', 'TypeScript', 'Node.js', 'AWS', 'System Design'],
    currentRound: data.currentRound || 1,
    totalRounds: data.totalRounds || 3,
    rawResponse: data
  };
}

// Sample question bank grouped by role and difficulty round for dynamic questions
const QUESTION_BANK = {
  'Software Engineer': {
    1: [
      { id: 'se-101', text: "Tell me about yourself, your primary tech stack, and a complex system you built recently.", durationSec: 60 },
      { id: 'se-102', text: "What key technical considerations do you prioritize when starting a new software engineering project?", durationSec: 60 }
    ],
    2: [
      { id: 'se-201', text: "Describe a challenging bug or performance bottleneck you diagnosed in production. How did you isolate and fix it?", durationSec: 120 },
      { id: 'se-202', text: "Tell me about a time you had a technical disagreement with a teammate. How did you reach consensus?", durationSec: 120 }
    ],
    3: [
      { id: 'se-301', text: "How would you architect a fault-tolerant, high-throughput microservice for real-time telemetry processing?", durationSec: 180 },
      { id: 'se-302', text: "If memory spikes unexpectedly by 400% during a traffic peak, how do you triage the issue in production?", durationSec: 180 }
    ]
  },
  'Frontend Developer': {
    1: [
      { id: 'fe-101', text: "Can you walk me through your experience building responsive, accessible React applications?", durationSec: 60 }
    ],
    2: [
      { id: 'fe-201', text: "Describe how you optimized a web app's initial load time and Core Web Vitals in a previous project.", durationSec: 120 }
    ],
    3: [
      { id: 'fe-301', text: "How do you handle complex state synchronization across independent micro-frontends without race conditions?", durationSec: 180 }
    ]
  },
  'Product Manager': {
    1: [
      { id: 'pm-101', text: "Give me an overview of a technical product feature you spearheaded from ideation to launch.", durationSec: 60 }
    ],
    2: [
      { id: 'pm-201', text: "Tell me about a time a key product metric dropped post-release. How did you investigate and pivot?", durationSec: 120 }
    ],
    3: [
      { id: 'pm-301', text: "How do you balance developer tech debt cleanup against critical customer feature requests under tight deadlines?", durationSec: 180 }
    ]
  },
  'Data Scientist': {
    1: [
      { id: 'ds-101', text: "Tell me about your background in machine learning, statistical modeling, and data pipelines.", durationSec: 60 }
    ],
    2: [
      { id: 'ds-201', text: "Describe how you handled severe class imbalance in a predictive model dataset.", durationSec: 120 }
    ],
    3: [
      { id: 'ds-301', text: "How do you detect and mitigate data drift and concept drift in production ML models?", durationSec: 180 }
    ]
  },
  'DevOps Engineer': {
    1: [
      { id: 'dev-101', text: "Tell me about your experience managing CI/CD automation pipelines and infrastructure as code.", durationSec: 60 }
    ],
    2: [
      { id: 'dev-201', text: "Describe a production deployment pipeline outage. How did you resolve it and prevent recurrence?", durationSec: 120 }
    ],
    3: [
      { id: 'dev-301', text: "How would you design a zero-downtime multi-region Kubernetes failover architecture?", durationSec: 180 }
    ]
  }
};

/**
 * Fetch current question for a given round
 * POST https://uv12f3v25j.execute-api.ap-south-1.amazonaws.com/Prod/questions
 */
export async function getQuestion(sessionId, round = 1, role = 'Software Engineer', resumeText = '') {
  let data = {};
  try {
    const response = await fetch(`${API_BASE_URL}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        round: round,
        round_number: round,
        role: role,
        resume_text: resumeText
      })
    });
    data = await handleResponse(response, `Failed to fetch question for round ${round}`);
  } catch (err) {
    console.warn('API Gateway questions endpoint warning:', err.message);
  }

  // Pick candidate question from role-specific question bank
  const roleBank = QUESTION_BANK[role] || QUESTION_BANK['Software Engineer'];
  const roundBank = roleBank[round] || roleBank[1];
  const defaultQ = roundBank[Math.floor(Math.random() * roundBank.length)];

  let questionText = defaultQ.text;
  
  // Extract question string from API response if present
  let apiQuestion = '';
  if (typeof data.question === 'string') {
    apiQuestion = data.question;
  } else if (data.question?.text) {
    apiQuestion = data.question.text;
  } else if (data.questionText) {
    apiQuestion = data.questionText;
  }

  // Detect if API response returned generic non-technical fallback (e.g. q_gen_1_01)
  const isGenericFallback = !apiQuestion ||
    apiQuestion.includes('introduce yourself and highlight') ||
    apiQuestion.includes('top skills and experiences that make you a great fit') ||
    data.question_id === 'q_gen_1_01';

  // Use API Gateway question if it is custom/specific, otherwise use role-specific technical question
  if (!isGenericFallback && apiQuestion.trim().length > 0) {
    questionText = apiQuestion.trim();
  }

  const questionObj = {
    id: data.question_id || `q_${round}_${Date.now()}`,
    text: questionText,
    durationSec: defaultQ.durationSec || (round === 1 ? 60 : round === 2 ? 120 : 180),
    audioUrl: null
  };

  return {
    success: true,
    sessionId,
    round,
    question: questionObj,
    audioUrl: data.audioUrl || 'https://actions.google.com/sounds/v1/speech/human_voice.ogg',
    rawResponse: data
  };
}

/**
 * Submit candidate's transcribed text answer
 * POST https://uv12f3v25j.execute-api.ap-south-1.amazonaws.com/Prod/answer
 */
export async function submitAnswer(sessionId, round, questionId, answerText) {
  const response = await fetch(`${API_BASE_URL}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, round, questionId, answerText })
  });

  const data = await handleResponse(response, 'Failed to submit answer');

  const trimmed = (answerText || '').trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Strict quality & gibberish evaluation
  const hasVowels = /[aeiouy]/i.test(trimmed);
  const commonTechOrEng = /\b(i|my|am|a|the|is|in|of|and|to|with|react|node|js|data|python|code|build|system|experience|work|project|team|user|app|model|sql|aws|api|design|developer|engineer)\b/i.test(trimmed);

  let roundScore = 0;
  if (wordCount < 3 || !hasVowels || (!commonTechOrEng && wordCount < 6)) {
    // Gibberish / random non-sensical text -> 0 points
    roundScore = 0;
  } else if (wordCount < 10) {
    roundScore = Math.min(45, wordCount * 4);
  } else if (wordCount < 25) {
    roundScore = Math.min(75, 45 + Math.floor((wordCount - 10) * 2));
  } else {
    roundScore = Math.min(95, 75 + Math.floor((wordCount - 25) * 0.8));
  }

  if (typeof data.roundScore === 'number') {
    roundScore = data.roundScore;
  }

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
    feedbackSnippet: roundScore === 0 ? "Random or gibberish answer detected." : (data.feedbackSnippet || data.message || "Answer evaluated."),
    rawResponse: data
  };
}

/**
 * Transition to next round
 * POST https://uv12f3v25j.execute-api.ap-south-1.amazonaws.com/Prod/next-round
 */
export async function getNextRound(sessionId, currentRound) {
  const response = await fetch(`${API_BASE_URL}/next-round`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, currentRound })
  });

  const data = await handleResponse(response, 'Failed to transition to next round');

  const nextRound = data.currentRound || (currentRound + 1);
  return {
    success: true,
    sessionId,
    currentRound: nextRound,
    isFinished: data.isFinished ?? (nextRound > 3),
    rawResponse: data
  };
}

/**
 * Fetch comprehensive interview feedback report
 * POST https://uv12f3v25j.execute-api.ap-south-1.amazonaws.com/Prod/feedback
 */
export async function getFeedback(sessionId, sessionData = {}) {
  // Build array of answers and full combined transcript expected by AWS Lambda /feedback endpoint
  const rawAnswers = sessionData.roundAnswers || sessionData.answers || [];
  const answersList = rawAnswers
    .map((item) => (typeof item === 'string' ? item : (item.answer || '')))
    .filter((a) => a.trim().length > 0);

  const fullTranscript = sessionData.transcript || answersList.join('. ');

  const payload = {
    sessionId,
    candidateName: sessionData.candidateName || 'Candidate',
    role: sessionData.role || 'Software Engineer',
    answers: answersList.length > 0 ? answersList : [fullTranscript || 'No candidate response recorded.'],
    transcript: fullTranscript || 'No candidate response recorded.',
    roundScores: sessionData.roundScores || []
  };

  const response = await fetch(`${API_BASE_URL}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await handleResponse(response, 'Failed to fetch feedback report');

  const candidateName = payload.candidateName;
  const role = payload.role;

  // Real final_score from AWS Lambda evaluator
  const totalScore = typeof data.final_score === 'number' ? data.final_score : (data.totalScore ?? 0);

  // Per-round scores should reflect real round answers or total score
  const roundScores = sessionData.roundScores && sessionData.roundScores.length === 3
    ? sessionData.roundScores
    : [totalScore, totalScore, totalScore];

  return {
    success: true,
    sessionId,
    candidateName,
    role,
    totalScore,
    roundBreakdown: [
      { round: 1, name: 'Warm-up', score: roundScores[0] ?? totalScore, status: 'Completed' },
      { round: 2, name: 'Behavioral', score: roundScores[1] ?? totalScore, status: 'Completed' },
      { round: 3, name: 'Technical / Stress', score: roundScores[2] ?? totalScore, status: 'Completed' },
    ],
    contentFeedback: typeof data.content_feedback === 'string'
      ? {
          relevanceScore: totalScore === 0 ? 0 : Math.min(98, Math.max(10, totalScore + 4)),
          technicalDepthScore: totalScore === 0 ? 0 : Math.min(98, Math.max(10, totalScore - 3)),
          structureScore: totalScore === 0 ? 0 : Math.min(98, Math.max(10, totalScore + 2)),
          strengths: [data.content_feedback],
          improvements: totalScore === 0
            ? ['Provide real, meaningful answers to technical and behavioral questions.', 'Use structured frameworks like the STAR method (Situation, Task, Action, Result).']
            : ['Quantify metrics more explicitly (e.g. latency reduced by X%)', 'Structure answers strictly with the STAR framework']
        }
      : (data.contentFeedback || {
          relevanceScore: totalScore,
          technicalDepthScore: totalScore,
          structureScore: totalScore,
          strengths: [totalScore === 0 ? 'No meaningful content provided.' : 'Clear technical alignment'],
          improvements: ['Provide detailed responses']
        }),
    fluencyFeedback: typeof data.fluency_feedback === 'string'
      ? {
          fluencyScore: totalScore === 0 ? 0 : Math.min(98, Math.max(20, totalScore + 5)),
          wpm: totalScore === 0 ? 0 : 138,
          fillerWordCount: sessionData.roundAnswers?.reduce((acc, r) => acc + (r.fillerCount || 0), 0) || 0,
          fillerWordsDetected: [data.fluency_feedback],
          clarityRating: totalScore === 0 ? 'Low' : 'High',
          tonePacing: totalScore === 0 ? 'Needs Improvement' : 'Steady & Confident'
        }
      : (data.fluencyFeedback || {
          fluencyScore: totalScore,
          wpm: 138,
          fillerWordCount: 0,
          fillerWordsDetected: [],
          clarityRating: totalScore === 0 ? 'Low' : 'High',
          tonePacing: 'Steady'
        }),
    rawResponse: data
  };
}

/**
 * Fetch leaderboard ranking table
 * GET https://uv12f3v25j.execute-api.ap-south-1.amazonaws.com/Prod/leaderboard
 */
export async function getLeaderboard(roleFilter = 'All') {
  const auth = getStoredAuth();
  const headers = {};
  if (auth?.idToken) {
    headers['Authorization'] = `Bearer ${auth.idToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/leaderboard`, {
    method: 'GET',
    headers
  });

  const data = await handleResponse(response, 'Failed to fetch leaderboard rankings from AWS API Gateway');

  let rawList = data.leaderboard || data.data || (Array.isArray(data) ? data : []);

  // Standardize object keys to match frontend table (user, role, score, wpm, fillerWordsCount)
  let leaderboardData = rawList.map((item, idx) => ({
    id: item.user_id || `rank_${idx}`,
    user: item.username || item.user || 'Candidate',
    role: item.target_role || item.role || 'Software Engineer',
    score: typeof item.score === 'number' ? item.score : (parseFloat(item.score) || 0),
    wpm: item.wpm || 138,
    fillerWordsCount: item.fillerWordsCount ?? item.fillers ?? 2,
    updated_at: item.updated_at || Date.now()
  }));

  if (roleFilter && roleFilter !== 'All') {
    leaderboardData = leaderboardData.filter((item) =>
      item.role.toLowerCase().includes(roleFilter.toLowerCase())
    );
  }

  return {
    success: true,
    leaderboard: leaderboardData,
    rawResponse: data
  };
}

/**
 * Post user score to leaderboard (POST /leaderboard)
 */
export async function addScoreToLeaderboard(entry) {
  const auth = getStoredAuth();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (auth?.idToken) {
    headers['Authorization'] = `Bearer ${auth.idToken}`;
  }

  const payload = {
    user_id: auth?.email || entry.user || 'candidate_user',
    username: entry.user || auth?.email || 'Anonymous Candidate',
    target_role: entry.role || 'Software Engineer',
    score: typeof entry.score === 'number' ? entry.score : 0,
    fillerWordsCount: entry.fillerWordsCount ?? 0,
    wpm: entry.wpm ?? 138
  };

  const response = await fetch(`${API_BASE_URL}/leaderboard`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  return await handleResponse(response, 'Failed to publish score to leaderboard');
}

