# InterviewMitra Pro - Interview Loop & Feedback (P3)

Python 3.12 AWS Lambda functions powering the interview loop, speech generation (Amazon Polly), and heuristic feedback for InterviewMitra Pro.

> **Service Access Note**: Designed strictly without Amazon Bedrock, Comprehend, Textract, or Transcribe. Speech output utilizes Amazon Polly and S3. Speech input is handled browser-side (Web Speech API), and question/feedback logic is algorithmic and keyword-driven.

---

## Architecture & Lambdas

### 1. `next_round`
- **File**: [`src/handlers/next_round.py`](src/handlers/next_round.py)
- **Input**:
  ```json
  {
    "round_number": 2,
    "previous_answer_text": "In my previous project, we had a major disagreement about database selection..."
  }
  ```
- **Logic**:
  - Maps `round_number` to difficulty (`1` -> `warm-up`, `2` -> `behavioral`, `3` -> `stress`).
  - Matches candidate questions from `src/data/question_bank.json` using keyword overlap against `previous_answer_text`.
- **Output**:
  ```json
  {
    "question": "Describe a situation where you had a technical disagreement with a teammate or lead. How did you resolve it?",
    "difficulty": "behavioral"
  }
  ```

---

### 2. `generate_feedback`
- **File**: [`src/handlers/generate_feedback.py`](src/handlers/generate_feedback.py)
- **Input**:
  ```json
  {
    "transcript": [
      {
        "question": "Could you walk me through your background?",
        "answer_text": "Um, I have been working in software engineering for three years, actually focusing on cloud services..."
      }
    ]
  }
  ```
- **Logic**:
  - Detects filler words (`um`, `like`, `actually`, `basically`, `you know`) via regex word boundaries.
  - Measures word count per response and assesses target range (30-120 words).
  - Calculates score using formula:
    $$\text{final\_score} = \text{clamp}(70 - (\text{fillers} \times 2) + (\text{in\_range\_responses} \times 10), 0, 100)$$
  - Formats coaching template strings for content and fluency.
- **Output**:
  ```json
  {
    "content_feedback": "You completed 3 interview rounds with an average length of 42 words per response. 3 out of 3 responses fell into the target optimal depth (30-120 words). Excellent pacing and depth!",
    "fluency_feedback": "You used 7 filler words throughout the interview. Most frequent fillers: 'um' (1x), 'like' (2x), 'actually' (1x), 'basically' (2x), 'you know' (1x). Coaching tip: When formulating your thoughts, embrace short silent pauses instead of filler words.",
    "final_score": 86
  }
  ```

---

### 3. `speak_question`
- **File**: [`src/handlers/speak_question.py`](src/handlers/speak_question.py)
- **Input**:
  ```json
  {
    "question_text": "Could you walk me through your background?",
    "voice_id": "Joanna"
  }
  ```
- **Logic**:
  - Synthesizes question audio via Amazon Polly (Neural engine with Standard fallback).
  - Uploads MP3 to S3 audio bucket.
  - Generates a 1-hour presigned GET URL for playback in frontend.
- **Output**:
  ```json
  {
    "audio_url": "https://interviewmitra-audio-bucket.s3.amazonaws.com/audio/question_xyz.mp3?AWSAccessKeyId=...",
    "bucket": "interviewmitra-audio-bucket",
    "key": "audio/question_xyz.mp3"
  }
  ```

---

## Local Testing & Verification

### Run Unit Test Suite
```powershell
python -m unittest discover -s tests -v
```

### Run Sample Events Runner (Simulates Lambda execution without Docker)
```powershell
python scripts/test_local.py
```

### Validate AWS SAM Template
```powershell
sam validate --lint
```

### Run via AWS SAM Local (requires Docker daemon)
```powershell
sam local invoke NextRoundFunction -e events/next_round_r1.json
sam local invoke GenerateFeedbackFunction -e events/generate_feedback.json
sam local invoke SpeakQuestionFunction -e events/speak_question.json
```
