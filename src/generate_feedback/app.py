import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Set

logger = logging.getLogger()
logger.setLevel(logging.INFO)

STOP_WORDS: Set[str] = {
    "a", "an", "the", "and", "or", "but", "if", "because", "as", "what",
    "which", "this", "that", "these", "those", "then", "just", "so", "than",
    "such", "both", "through", "about", "for", "is", "of", "while", "during",
    "to", "from", "in", "out", "on", "off", "again", "further", "then", "once",
    "here", "there", "when", "where", "why", "how", "all", "any", "both", "each",
    "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
    "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "don",
    "should", "now", "i", "my", "me", "we", "our", "you", "your", "he", "she",
    "it", "they", "them", "was", "were", "be", "been", "being", "have", "has",
    "had", "do", "does", "did"
}

FILLER_WORDS: List[str] = [
    "um",
    "like",
    "actually",
    "basically",
    "you know"
]


def get_cors_headers() -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
    }


def parse_event_body(event: Any) -> Dict[str, Any]:
    if not event:
        return {}
    if isinstance(event, dict):
        if "body" in event:
            body = event["body"]
            if isinstance(body, str):
                try:
                    return json.loads(body)
                except json.JSONDecodeError:
                    return {}
            elif isinstance(body, dict):
                return body
        return event
    return {}


def count_filler_words(text: str) -> Dict[str, int]:
    if not text:
        return {fw: 0 for fw in FILLER_WORDS}
    counts = {}
    lower_text = text.lower()
    for filler in FILLER_WORDS:
        pattern = r"\b" + re.escape(filler) + r"\b"
        matches = re.findall(pattern, lower_text)
        counts[filler] = len(matches)
    return counts


def calculate_word_count(text: str) -> int:
    if not text or not text.strip():
        return 0
    return len(re.findall(r"\b\w+\b", text))


def evaluate_transcript(transcript: List[Dict[str, str]]) -> Dict[str, Any]:
    if not transcript:
        return {
            "content_feedback": "No answers were provided for evaluation. Complete interview rounds to receive feedback.",
            "fluency_feedback": "No speech transcript available to evaluate fluency.",
            "final_score": 0
        }

    total_words = 0
    total_filler_count = 0
    filler_totals: Dict[str, int] = {}
    answers_in_good_range = 0
    answers_too_short = 0
    answers_too_long = 0

    for i, item in enumerate(transcript, 1):
        answer_text = item.get("answer_text", "")
        word_count = calculate_word_count(answer_text)
        fillers = count_filler_words(answer_text)
        answer_filler_total = sum(fillers.values())

        for fw, count in fillers.items():
            filler_totals[fw] = filler_totals.get(fw, 0) + count

        total_words += word_count
        total_filler_count += answer_filler_total

        if 30 <= word_count <= 120:
            answers_in_good_range += 1
        elif word_count < 30:
            answers_too_short += 1
        else:
            answers_too_long += 1

    num_answers = len(transcript)
    avg_words = round(total_words / num_answers) if num_answers > 0 else 0

    # SCORING FORMULA:
    score = 70
    score -= (total_filler_count * 2)
    score += (answers_in_good_range * 10)
    score -= (answers_too_short * 5)
    score -= (answers_too_long * 5)
    final_score = max(0, min(100, score))

    content_lines = [
        f"You completed {num_answers} interview round{'s' if num_answers != 1 else ''} with an average length of {avg_words} words per response.",
        f"{answers_in_good_range} out of {num_answers} responses fell into the target optimal depth (30-120 words)."
    ]

    if answers_too_short > 0:
        content_lines.append(
            f"{answers_too_short} response{'s were' if answers_too_short > 1 else ' was'} under 30 words. Aim to elaborate on your reasoning using the STAR method (Situation, Task, Action, Result) to provide concrete evidence of your skills."
        )

    if answers_too_long > 0:
        content_lines.append(
            f"{answers_too_long} response{'s exceeded' if answers_too_long > 1 else ' exceeded'} 120 words. Practice keeping your answers concise and focused directly on the core impact to avoid losing the interviewer's attention."
        )

    if answers_in_good_range == num_answers:
        content_lines.append(
            "Excellent pacing and depth! All your responses demonstrated strong technical precision without unnecessary rambling."
        )

    content_feedback = " ".join(content_lines)

    fluency_lines = []
    if total_filler_count == 0:
        fluency_lines.append(
            "Outstanding verbal fluency! You used zero filler words across all responses, projecting clarity and confidence."
        )
    else:
        fluency_lines.append(
            f"You used {total_filler_count} filler word{'s' if total_filler_count != 1 else ''} throughout the interview."
        )
        detected_fillers = [f"'{fw}' ({count}x)" for fw, count in filler_totals.items() if count > 0]
        if detected_fillers:
            fluency_lines.append(f"Most frequent fillers: {', '.join(detected_fillers)}.")
        fluency_lines.append(
            "Coaching tip: When formulating your thoughts, embrace short silent pauses instead of filler words. Pauses project composure and give you time to structure your response."
        )

    fluency_feedback = " ".join(fluency_lines)

    return {
        "content_feedback": content_feedback,
        "fluency_feedback": fluency_feedback,
        "final_score": final_score
    }


def call_gemini_feedback(
    transcript: List[Dict[str, str]],
    role: str = "general",
    resume_text: str = "",
    api_key: str = None,
    timeout: float = 12.0
) -> Dict[str, Any]:
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not api_key.strip():
        raise ValueError("GEMINI_API_KEY is not set or empty")

    transcript_items = []
    for i, item in enumerate(transcript, 1):
        q = item.get("question", f"Question {i}")
        a = item.get("answer_text", "").strip()
        transcript_items.append(f"Round {i} Question: {q}\nCandidate Answer: {a}")

    transcript_formatted = "\n\n".join(transcript_items)

    context_lines = []
    if role and role != "general":
        context_lines.append(f"Target Role: {role}")
    if resume_text:
        context_lines.append(f"Candidate Resume / Background:\n\"\"\"{resume_text}\"\"\"")

    context_str = "\n".join(context_lines) if context_lines else "Role: General Professional"

    prompt = (
        f"You are an expert interview coach and technical evaluator conducting a performance review of an interview.\n\n"
        f"{context_str}\n\n"
        f"Interview Transcript:\n{transcript_formatted}\n\n"
        f"Evaluation Instructions:\n"
        f"1. Score (final_score): Provide an overall numerical score strictly between 0 and 100.\n"
        f"   - Strong answers (clear structure/STAR method, concrete technical details, high relevance, strong impact) must receive high scores (80-98).\n"
        f"   - Weak answers (too brief, vague, lacking substance, rambling, or heavy filler words) must receive low scores (20-55).\n"
        f"2. content_feedback: Provide detailed, highly specific analysis of the candidate's answers. "
        f"Highlight exact technical strengths, note specific missed opportunities, evaluate structural clarity (STAR approach), "
        f"and provide concrete improvements. Do NOT use generic filler words like 'good job' or 'nice try'.\n"
        f"3. fluency_feedback: Provide detailed analysis of communication delivery, answer conciseness, pacing, and filler word usage. "
        f"Include specific coaching tips on verbal clarity and composure.\n\n"
        f"Output must be a valid JSON object matching this schema exactly:\n"
        f"{{\n"
        f'  "final_score": <int 0-100>,\n'
        f'  "content_feedback": "<specific technical & content evaluation>",\n'
        f'  "fluency_feedback": "<specific verbal & fluency coaching>"\n'
        f"}}"
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key.strip()}"
    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.3
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

    if "final_score" not in result or "content_feedback" not in result or "fluency_feedback" not in result:
        raise ValueError("Gemini response missing required feedback fields (final_score, content_feedback, fluency_feedback)")

    try:
        score_val = int(round(float(result["final_score"])))
        score_val = max(0, min(100, score_val))
    except (ValueError, TypeError):
        score_val = 70

    return {
        "final_score": score_val,
        "content_feedback": str(result["content_feedback"]).strip(),
        "fluency_feedback": str(result["fluency_feedback"]).strip()
    }


def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": get_cors_headers(),
            "body": json.dumps({"message": "OK"})
        }

    try:
        payload = parse_event_body(event)
        transcript = payload.get("transcript", [])
        if isinstance(payload, list):
            transcript = payload

        role = payload.get("role", "general") if isinstance(payload, dict) else "general"
        resume_text = payload.get("resume_text", "") if isinstance(payload, dict) else ""

        if not transcript:
            empty_res = evaluate_transcript([])
            return {
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json.dumps(empty_res)
            }

        # 1. Try Gemini API first
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        if gemini_api_key and gemini_api_key.strip():
            try:
                gemini_res = call_gemini_feedback(
                    transcript=transcript,
                    role=role,
                    resume_text=resume_text,
                    api_key=gemini_api_key
                )
                if gemini_res and "final_score" in gemini_res:
                    logger.info("Successfully generated feedback via Gemini 2.0 Flash")
                    return {
                        "statusCode": 200,
                        "headers": get_cors_headers(),
                        "body": json.dumps(gemini_res)
                    }
            except Exception as gemini_err:
                logger.warning(
                    f"Gemini feedback generation failed: {gemini_err}. Falling back to formula evaluation."
                )

        # 2. Fallback: Formula-based transcript evaluation
        result = evaluate_transcript(transcript)
        return {
            "statusCode": 200,
            "headers": get_cors_headers(),
            "body": json.dumps(result)
        }

    except Exception as e:
        logger.error(f"Error in generate_feedback lambda_handler: {str(e)}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": get_cors_headers(),
            "body": json.dumps({"error": str(e)})
        }
