import json
import logging
import os
import random
import re
import urllib.error
import urllib.parse
import urllib.request
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
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
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
    Randomly selects among candidates matching role & difficulty so every candidate gets dynamic questions.
    """
    resume_lower = (resume_text or "").lower()

    # Step 1: Filter question bank by role and difficulty
    role_candidates = [
        q for q in question_bank
        if q.get("role", "").lower() == role and q.get("difficulty") == difficulty
    ]

    if role_candidates:
        scored = []
        for candidate in role_candidates:
            tags = candidate.get("skill_tags", [])
            matching_tags = [t for t in tags if t.lower() in resume_lower]
            score = len(matching_tags)
            scored.append((score, candidate, matching_tags))

        scored.sort(key=lambda x: x[0], reverse=True)
        max_score = scored[0][0]

        if max_score > 0:
            top_candidates = [item for item in scored if item[0] == max_score]
            chosen = random.choice(top_candidates)
            return chosen[1], chosen[2]
        else:
            chosen = random.choice(role_candidates)
            return chosen, []

    # Step 2: Fallback - pick a generic question for that difficulty
    generic_candidates = [
        q for q in question_bank
        if q.get("role", "").lower() == "general" and q.get("difficulty") == difficulty
    ]

    if generic_candidates:
        scored = []
        for g in generic_candidates:
            tags = g.get("skill_tags", [])
            m = [t for t in tags if t.lower() in resume_lower]
            scored.append((len(m), g, m))

        scored.sort(key=lambda x: x[0], reverse=True)
        max_score = scored[0][0]

        if max_score > 0:
            top_generic = [item for item in scored if item[0] == max_score]
            chosen = random.choice(top_generic)
            return chosen[1], chosen[2]

        return random.choice(generic_candidates), []

    # Final fallback if neither role nor generic matched
    any_diff_candidates = [q for q in question_bank if q.get("difficulty") == difficulty]
    if any_diff_candidates:
        return random.choice(any_diff_candidates), []

    # Ultimate fallback
    return random.choice(question_bank), []


def call_gemini_question(
    resume_text: str,
    role: str,
    round_number: int,
    api_key: str = None,
    timeout: float = 10.0
) -> dict:
    """
    Calls Google Gemini 2.0 Flash API to generate ONE interview question.
    Round 1 = easy warm-up
    Round 2 = behavioral based on resume
    Round 3 = stress/pressure
    Returns: {"question": "...", "difficulty": round_number}
    """
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not api_key.strip():
        raise ValueError("GEMINI_API_KEY is not set or empty")

    round_descriptions = {
        1: "easy warm-up question to break the ice and assess basic background",
        2: "behavioral question directly exploring projects, skills, and past challenges from the candidate resume",
        3: "stress and high-pressure situational question testing rapid crisis decision-making and composure"
    }
    desc = round_descriptions.get(round_number, "interview question tailored to role and experience")

    prompt = (
        f"You are an expert interviewer conducting an interview for the role of '{role}'.\n"
        f"Candidate Resume / Background Details:\n\"\"\"{resume_text or 'No resume provided'}\"\"\"\n\n"
        f"Stage: Round {round_number} ({desc}).\n\n"
        f"Generate exactly ONE interview question appropriate for Round {round_number}.\n"
        f"Difficulty mapping: round 1 = easy warm-up, round 2 = behavioral based on resume, round 3 = stress/pressure.\n"
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

    # Clean markdown fences if model wrapped response
    cleaned_text = raw_text
    if cleaned_text.startswith("```"):
        cleaned_text = re.sub(r"^```(?:json)?\s*", "", cleaned_text)
        cleaned_text = re.sub(r"\s*```$", "", cleaned_text)

    result = json.loads(cleaned_text)
    if "question" not in result or not result["question"]:
        raise ValueError("Gemini response missing valid 'question' field")

    diff_val = result.get("difficulty", round_number)
    try:
        diff_int = int(diff_val)
    except (ValueError, TypeError):
        diff_int = round_number

    return {
        "question": str(result["question"]).strip(),
        "difficulty": diff_int
    }


def lambda_handler(event, context):
    """
    Lambda handler for question generation.
    Takes {resume_text, role, round_number}.
    Returns JSON: {question, difficulty}.
    Tries Google Gemini API first, falling back to keyword matching if Gemini fails.
    """
    logger.info("Received generate_questions event")

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

        resume_text = data.get("resume_text", "")
        raw_role = data.get("role", "general")
        raw_round = data.get("round_number") if data.get("round_number") is not None else data.get("round", 1)

        difficulty = parse_round_number(raw_round)
        role = normalize_role(raw_role)

        # 1. Try Gemini API first if GEMINI_API_KEY is configured
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        if gemini_api_key and gemini_api_key.strip():
            try:
                gemini_res = call_gemini_question(
                    resume_text=resume_text,
                    role=role,
                    round_number=difficulty,
                    api_key=gemini_api_key
                )
                if gemini_res and gemini_res.get("question"):
                    logger.info("Successfully generated question via Gemini 2.0 Flash")
                    return _build_response(200, {
                        "question": gemini_res["question"],
                        "difficulty": gemini_res["difficulty"]
                    })
            except Exception as gemini_err:
                logger.warning(
                    f"Gemini generation failed: {gemini_err}. Falling back to keyword question bank."
                )

        # 2. Fallback: Existing keyword-matching against question_bank.json
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
