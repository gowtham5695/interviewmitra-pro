import json
import logging
import os
from pathlib import Path

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Cached question bank in memory
_QUESTION_BANK = None


def load_question_bank() -> list[dict]:
    """Loads and caches question_bank.json from the package directory or parent directory."""
    global _QUESTION_BANK
    if _QUESTION_BANK is not None:
        return _QUESTION_BANK

    possible_paths = [
        Path(__file__).parent / "question_bank.json",
        Path(__file__).parent.parent / "question_bank.json",
        Path("/var/task/question_bank.json"),
    ]

    for p in possible_paths:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                _QUESTION_BANK = json.load(f)
                logger.info(f"Loaded {len(_QUESTION_BANK)} questions from {p}")
                return _QUESTION_BANK

    raise FileNotFoundError("question_bank.json could not be located in search paths.")


def _build_response(status_code: int, body_dict: dict) -> dict:
    """Helper to return standardized API Gateway responses with CORS headers."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
        },
        "body": json.dumps(body_dict),
    }


def parse_round_number(raw_round) -> int:
    """Normalizes round_number (int, string number, or round name) into difficulty 1, 2, or 3."""
    if isinstance(raw_round, int):
        return max(1, min(3, raw_round))
    if isinstance(raw_round, str):
        cleaned = raw_round.strip().lower()
        if cleaned in ("1", "warm-up", "warmup", "round 1"):
            return 1
        if cleaned in ("2", "behavioral", "round 2"):
            return 2
        if cleaned in ("3", "stress", "round 3"):
            return 3
        try:
            val = int(cleaned)
            return max(1, min(3, val))
        except ValueError:
            pass
    return 1


def normalize_role(raw_role: str) -> str:
    """Normalizes target role to one of the bank categories: software, retail, general."""
    if not raw_role or not isinstance(raw_role, str):
        return "general"
    cleaned = raw_role.strip().lower()
    if "software" in cleaned or "developer" in cleaned or "engineer" in cleaned or "tech" in cleaned or "backend" in cleaned or "frontend" in cleaned:
        return "software"
    if "retail" in cleaned or "store" in cleaned or "cashier" in cleaned or "sales" in cleaned:
        return "retail"
    return "general"


def select_best_question(question_bank: list[dict], resume_text: str, role: str, difficulty: int) -> tuple[dict, list[str]]:
    """
    Selects the best question matching role and round difficulty based on substring matching of skill_tags.
    Falls back to a generic question for that difficulty if no positive match is found.
    """
    resume_lower = resume_text.lower()

    # Step 1: Filter question bank by role and difficulty
    role_candidates = [
        q for q in question_bank
        if q.get("role", "").lower() == role and q.get("difficulty") == difficulty
    ]

    best_candidate = None
    best_matching_tags = []
    max_score = 0

    for candidate in role_candidates:
        tags = candidate.get("skill_tags", [])
        # Check which skill_tags appear as substrings in lowercased resume_text
        matching_tags = [t for t in tags if t.lower() in resume_lower]
        score = len(matching_tags)

        if score > max_score:
            max_score = score
            best_candidate = candidate
            best_matching_tags = matching_tags

    # Step 2: If a good match is found (score > 0), return it
    if best_candidate and max_score > 0:
        return best_candidate, best_matching_tags

    # Step 3: Fallback - pick a generic question for that difficulty
    generic_candidates = [
        q for q in question_bank
        if q.get("role", "").lower() == "general" and q.get("difficulty") == difficulty
    ]

    if generic_candidates:
        # Check if any generic question has matching tags
        generic_best = None
        generic_best_tags = []
        generic_max = 0
        for g in generic_candidates:
            tags = g.get("skill_tags", [])
            m = [t for t in tags if t.lower() in resume_lower]
            if len(m) > generic_max:
                generic_max = len(m)
                generic_best = g
                generic_best_tags = m

        if generic_best and generic_max > 0:
            return generic_best, generic_best_tags
        return generic_candidates[0], []

    # Final fallback if neither role nor generic matched
    any_diff_candidates = [q for q in question_bank if q.get("difficulty") == difficulty]
    if any_diff_candidates:
        return any_diff_candidates[0], []

    # Ultimate fallback
    return question_bank[0], []


def lambda_handler(event, context):
    """
    Lambda handler for question generation.
    Takes {resume_text, role, round_number}.
    Returns JSON: {question, difficulty}.
    """
    logger.info("Received generate_questions event")

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

        resume_text = data.get("resume_text", "")
        raw_role = data.get("role", "general")
        raw_round = data.get("round_number", 1)

        difficulty = parse_round_number(raw_round)
        role = normalize_role(raw_role)

        question_bank = load_question_bank()
        selected_question, matched_tags = select_best_question(
            question_bank=question_bank,
            resume_text=resume_text,
            role=role,
            difficulty=difficulty,
        )

        response_payload = {
            "question": selected_question.get("question"),
            "difficulty": selected_question.get("difficulty"),
        }

        # Also provide matched metadata if helpful for downstream logging/inspection
        if matched_tags:
            response_payload["matched_tags"] = matched_tags
        if "id" in selected_question:
            response_payload["question_id"] = selected_question["id"]

        return _build_response(200, response_payload)

    except Exception as exc:
        logger.exception("Failed to generate question")
        return _build_response(500, {"error": f"Failed to generate question: {str(exc)}"})
