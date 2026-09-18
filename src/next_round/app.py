import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ROUND_DIFFICULTY_MAP: Dict[int, str] = {
    1: "warm-up",
    2: "behavioral",
    3: "stress",
}

DIFFICULTY_ROUND_MAP: Dict[str, int] = {
    "warm-up": 1,
    "behavioral": 2,
    "stress": 3,
    "easy": 1,
    "medium": 2,
    "hard": 3,
}

STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
    "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
    "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
    "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
    "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it",
    "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
    "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other",
    "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't",
    "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
    "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what",
    "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
    "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd",
    "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
}

_QUESTION_BANK = None


def get_cors_headers() -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
    }


def _build_response(status_code: int, body_dict: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": get_cors_headers(),
        "body": json.dumps(body_dict),
    }


def extract_keywords(text: str) -> Set[str]:
    if not text:
        return set()
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    words = cleaned.split()
    return {w for w in words if len(w) > 2 and w not in STOP_WORDS}


def load_question_bank(file_path: Optional[str] = None) -> List[Dict[str, Any]]:
    global _QUESTION_BANK
    if _QUESTION_BANK is not None and not file_path:
        return _QUESTION_BANK

    candidate_paths = []
    if file_path:
        candidate_paths.append(Path(file_path))
    env_path = os.environ.get("QUESTION_BANK_PATH")
    if env_path:
        candidate_paths.append(Path(env_path))

    here = Path(__file__).resolve().parent
    candidate_paths.extend([
        here / "question_bank.json",
        here.parent / "data" / "question_bank.json",
        here.parent / "generate_questions" / "question_bank.json",
        here.parent.parent / "question_bank.json",
        Path("/var/task/question_bank.json"),
    ])

    for p in candidate_paths:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                _QUESTION_BANK = json.load(f)
                logger.info(f"Loaded question bank ({len(_QUESTION_BANK)} items) from {p}")
                return _QUESTION_BANK

    logger.warning("question_bank.json not found; using emergency fallback questions.")
    return [
        {"id": "q1_default", "round_number": 1, "difficulty": "warm-up", "question": "Tell me about your background and technical strengths.", "skill_tags": ["background", "strengths"]},
        {"id": "q2_default", "round_number": 2, "difficulty": "behavioral", "question": "Describe a difficult challenge or conflict you resolved in your team.", "skill_tags": ["conflict", "challenge", "team"]},
        {"id": "q3_default", "round_number": 3, "difficulty": "stress", "question": "A production issue has brought down critical user workflows. How do you resolve it?", "skill_tags": ["production", "crisis", "incident"]},
    ]


def select_best_question(candidates: List[Dict[str, Any]], previous_answer_text: Optional[str]) -> Dict[str, Any]:
    if not candidates:
        raise ValueError("No candidate questions available.")

    if not previous_answer_text or not previous_answer_text.strip():
        return candidates[0]

    answer_keywords = extract_keywords(previous_answer_text)
    if not answer_keywords:
        return candidates[0]

    best_question = candidates[0]
    best_score = -1

    for q in candidates:
        tags = q.get("skill_tags") or q.get("keywords") or []
        q_keywords = set(tags) if tags else extract_keywords(q.get("question", ""))
        overlap = len(answer_keywords.intersection(q_keywords))
        if overlap > best_score:
            best_score = overlap
            best_question = q

    return best_question


def call_gemini_next_round(
    round_number: int,
    difficulty: str,
    previous_answer_text: str = "",
    resume_text: str = "",
    role: str = "general",
    api_key: str = None,
    timeout: float = 10.0,
) -> dict:
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not api_key.strip():
        raise ValueError("GEMINI_API_KEY is not set or empty")

    round_descriptions = {
        1: "easy warm-up question to break the ice and assess basic background",
        2: "behavioral question exploring past projects, challenges, teamwork, or technical experience",
        3: "high-stress situational question testing crisis management and composure under pressure",
    }
    desc = round_descriptions.get(round_number, f"{difficulty} interview question")

    context_parts = []
    if role and role != "general":
        context_parts.append(f"Target Role: {role}")
    if resume_text:
        context_parts.append(f"Candidate Resume / Background:\n\"\"\"{resume_text}\"\"\"")
    if previous_answer_text:
        context_parts.append(f"Candidate's Answer to Previous Round:\n\"\"\"{previous_answer_text}\"\"\"")

    context_str = "\n\n".join(context_parts) if context_parts else "No specific candidate background provided."

    prompt = (
        f"You are an expert interviewer conducting an interview.\n\n"
        f"Candidate & Session Context:\n{context_str}\n\n"
        f"Stage: Round {round_number} ({desc}).\n\n"
        f"Generate exactly ONE interview question appropriate for Round {round_number} ({desc}).\n"
        f"If the candidate provided a previous answer, you may optionally follow up or transition naturally.\n"
        f"Output must be a valid JSON object with exactly this schema:\n"
        f"{{\n"
        f'  "question": "Your interview question here",\n'
        f'  "difficulty": {round_number}\n'
        f"}}"
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key.strip()}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.7
        }
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=timeout) as resp:
        resp_data = resp.read().decode("utf-8")
        resp_json = json.loads(resp_data)

    candidates = resp_json.get("candidates", [])
    if not candidates:
        raise ValueError("No candidates returned by Gemini API")

    first_candidate = candidates[0]
    content = first_candidate.get("content", {})
    parts = content.get("parts", [])
    if not parts:
        raise ValueError("No parts returned in Gemini candidate content")

    raw_text = parts[0].get("text", "").strip()
    if not raw_text:
        raise ValueError("Empty text returned in Gemini candidate part")

    cleaned_text = raw_text
    if cleaned_text.startswith("```"):
        cleaned_text = re.sub(r"^```(?:json)?\s*", "", cleaned_text)
        cleaned_text = re.sub(r"\s*```$", "", cleaned_text)

    result = json.loads(cleaned_text)
    if "question" not in result or not result["question"]:
        raise ValueError("Gemini response missing valid 'question' field")

    diff_val = result.get("difficulty", round_number)
    if isinstance(diff_val, int) or (isinstance(diff_val, str) and diff_val.isdigit()):
        diff_str = ROUND_DIFFICULTY_MAP.get(int(diff_val), difficulty)
    elif isinstance(diff_val, str) and diff_val.lower() in DIFFICULTY_ROUND_MAP:
        diff_str = diff_val.lower()
    else:
        diff_str = difficulty

    return {
        "question": str(result["question"]).strip(),
        "difficulty": diff_str
    }


def lambda_handler(event: Any, context: Any = None) -> dict:
    """
    Lambda handler for next_round / answer.
    Takes {round_number, previous_answer_text, [resume_text, role]}.
    Returns {question, difficulty}.
    Tries Google Gemini API first, falling back to keyword matching if Gemini fails.
    """
    logger.info("Received next_round / answer event")

    if isinstance(event, dict) and event.get("httpMethod") == "OPTIONS":
        return _build_response(200, {"message": "OK"})

    try:
        data = {}
        if isinstance(event, dict):
            if "body" in event:
                body = event["body"]
                if isinstance(body, str):
                    try:
                        data = json.loads(body)
                    except json.JSONDecodeError:
                        data = {}
                elif isinstance(body, dict):
                    data = body
            else:
                data = event

        round_raw = data.get("round_number", 1)
        if isinstance(round_raw, str):
            if round_raw.isdigit():
                round_number = int(round_raw)
                difficulty = ROUND_DIFFICULTY_MAP.get(round_number, "warm-up")
            else:
                difficulty = round_raw.lower()
                round_number = DIFFICULTY_ROUND_MAP.get(difficulty, 1)
        else:
            round_number = int(round_raw) if round_raw else 1
            difficulty = ROUND_DIFFICULTY_MAP.get(round_number, "warm-up")

        previous_answer_text = data.get("previous_answer_text", "")
        resume_text = data.get("resume_text", "")
        role = data.get("role", "general")

        # 1. Try Gemini API first if GEMINI_API_KEY is configured
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        if gemini_api_key and gemini_api_key.strip():
            try:
                gemini_res = call_gemini_next_round(
                    round_number=round_number,
                    difficulty=difficulty,
                    previous_answer_text=previous_answer_text,
                    resume_text=resume_text,
                    role=role,
                    api_key=gemini_api_key
                )
                if gemini_res and gemini_res.get("question"):
                    logger.info("Successfully generated next round question via Gemini 2.0 Flash")
                    return _build_response(200, gemini_res)
            except Exception as gemini_err:
                logger.warning(
                    f"Gemini next_round generation failed: {gemini_err}. Falling back to keyword question bank."
                )

        # 2. Fallback: Keyword matching against question_bank.json
        bank = load_question_bank()
        candidates = [
            q for q in bank
            if q.get("round_number") == round_number
            or q.get("difficulty") == round_number
            or str(q.get("difficulty", "")).lower() == difficulty.lower()
        ]
        if not candidates:
            candidates = bank

        selected = select_best_question(candidates, previous_answer_text)
        result = {
            "question": selected["question"],
            "difficulty": selected.get("difficulty", difficulty)
        }
        # Normalize int difficulty in fallback if needed
        if isinstance(result["difficulty"], int):
            result["difficulty"] = ROUND_DIFFICULTY_MAP.get(result["difficulty"], difficulty)

        return _build_response(200, result)

    except Exception as exc:
        logger.exception("Failed in next_round handler")
        return _build_response(500, {"error": f"Failed in next_round: {str(exc)}"})


# Alias for compatibility
handler = lambda_handler
