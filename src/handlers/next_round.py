import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from utils import extract_keywords, format_response, parse_event_body

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


def handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    Lambda handler for next_round.
    Input: { round_number: int, previous_answer_text: str }
    Output: { question: str, difficulty: str }
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

        # Check if invoked via API Gateway
        is_api_gw = bool(
            isinstance(event, dict)
            and ("httpMethod" in event or "requestContext" in event)
        )

        if is_api_gw:
            return format_response(200, result)

        return result

    except Exception as e:
        logger.error(f"Error in next_round handler: {str(e)}", exc_info=True)
        error_payload = {"error": str(e)}
        if isinstance(event, dict) and ("httpMethod" in event or "requestContext" in event):
            return format_response(500, error_payload)
        return error_payload
