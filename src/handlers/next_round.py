import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

try:
    from utils import extract_keywords, format_response, parse_event_body
except ImportError:
    from src.handlers.utils import extract_keywords, format_response, parse_event_body

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

ROUND_DIFFICULTY_MAP: Dict[int, str] = {
    1: "warm-up",
    2: "behavioral",
    3: "stress"
}

DIFFICULTY_ROUND_MAP: Dict[str, int] = {
    "warm-up": 1,
    "behavioral": 2,
    "stress": 3,
    "easy": 1,
    "medium": 2,
    "hard": 3
}


def load_question_bank(file_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Loads question bank from the shared JSON file.
    """
    if not file_path:
        env_path = os.environ.get("QUESTION_BANK_PATH")
        if env_path and os.path.exists(env_path):
            file_path = env_path
        else:
            base_dir = os.path.dirname(__file__)
            candidate_paths = [
                os.path.join(base_dir, "..", "data", "question_bank.json"),
                os.path.join(base_dir, "data", "question_bank.json"),
                os.path.join(os.getcwd(), "src", "data", "question_bank.json"),
                os.path.join(os.getcwd(), "question_bank.json")
            ]
            for cp in candidate_paths:
                if os.path.exists(cp):
                    file_path = cp
                    break

    if not file_path or not os.path.exists(file_path):
        logger.warning("question_bank.json not found at expected paths. Falling back to built-in questions.")
        return [
            {"id": "q1_default", "round_number": 1, "difficulty": "warm-up", "question": "Tell me about your background and technical strengths.", "keywords": ["background", "strengths"]},
            {"id": "q2_default", "round_number": 2, "difficulty": "behavioral", "question": "Describe a difficult conflict or challenge you resolved within your engineering team.", "keywords": ["conflict", "challenge", "team"]},
            {"id": "q3_default", "round_number": 3, "difficulty": "stress", "question": "Your production system is down and users are affected. What are your immediate actions?", "keywords": ["production", "down", "outage", "crisis"]}
        ]

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def select_best_question(
    candidates: List[Dict[str, Any]],
    previous_answer_text: Optional[str]
) -> Dict[str, Any]:
    """
    Selects the most relevant question from candidates using keyword overlap
    with previous_answer_text. If no previous answer or no overlap, picks first.
    """
    if not candidates:
        raise ValueError("No candidate questions available for the specified round.")

    if not previous_answer_text or not previous_answer_text.strip():
        return candidates[0]

    answer_keywords = extract_keywords(previous_answer_text)
    if not answer_keywords:
        return candidates[0]

    best_question = candidates[0]
    best_score = -1

    for q in candidates:
        q_keywords = set(q.get("keywords", []))
        if not q_keywords:
            q_keywords = extract_keywords(q.get("question", ""))

        overlap_score = len(answer_keywords.intersection(q_keywords))
        if overlap_score > best_score:
            best_score = overlap_score
            best_question = q

    return best_question


def call_gemini_next_round(
    round_number: int,
    difficulty: str,
    previous_answer_text: str = "",
    resume_text: str = "",
    role: str = "general",
    api_key: str = None,
    timeout: float = 10.0
) -> dict:
    """
    Calls Google Gemini 2.0 Flash API to generate ONE interview question for the next round.
    Round 1 = easy warm-up
    Round 2 = behavioral based on resume / past responses
    Round 3 = stress/pressure
    Returns: {"question": "...", "difficulty": difficulty_str}
    """
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not api_key.strip():
        raise ValueError("GEMINI_API_KEY is not set or empty")

    round_descriptions = {
        1: "easy warm-up question to break the ice and assess basic background",
        2: "behavioral question exploring past projects, challenges, teamwork, or technical experience",
        3: "high-stress situational question testing crisis management and composure under pressure"
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


def handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    Lambda handler for next_round.
    Input: { round_number: int, previous_answer_text: str }
    Output: { question: str, difficulty: str }
    Tries Google Gemini API first, falling back to keyword matching if Gemini fails.
    """
    try:
        payload = parse_event_body(event)
        round_raw = payload.get("round_number", 1)

        # Normalize round_number and difficulty
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

        previous_answer_text = payload.get("previous_answer_text", "")
        resume_text = payload.get("resume_text", "")
        role = payload.get("role", "general")

        is_api_gw = bool(
            isinstance(event, dict)
            and ("httpMethod" in event or "requestContext" in event)
        )

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
                    if is_api_gw:
                        return format_response(200, gemini_res)
                    return gemini_res
            except Exception as gemini_err:
                logger.warning(
                    f"Gemini next_round generation failed: {gemini_err}. Falling back to keyword question bank."
                )

        # 2. Fallback: Existing keyword matching against question_bank.json
        question_bank = load_question_bank()

        # Filter by round_number or difficulty
        candidates = [
            q for q in question_bank
            if q.get("round_number") == round_number
            or q.get("difficulty", "").lower() == difficulty.lower()
        ]

        if not candidates:
            # Fallback if specific round not found
            candidates = question_bank

        selected = select_best_question(candidates, previous_answer_text)

        result = {
            "question": selected["question"],
            "difficulty": selected.get("difficulty", difficulty)
        }

        if is_api_gw:
            return format_response(200, result)

        return result

    except Exception as e:
        logger.error(f"Error in next_round handler: {str(e)}", exc_info=True)
        error_payload = {"error": str(e)}
        if isinstance(event, dict) and ("httpMethod" in event or "requestContext" in event):
            return format_response(500, error_payload)
        return error_payload
