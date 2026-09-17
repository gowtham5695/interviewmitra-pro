import json
import logging
from typing import Any, Dict, List

from utils import calculate_word_count, count_filler_words, format_response, parse_event_body

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def evaluate_transcript(transcript: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Evaluates transcript answers:
    - Counts filler words per answer and in total
    - Measures answer word count
    - Calculates final_score (0-100)
    - Generates templated content_feedback and fluency_feedback
    """
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
    answer_stats = []

    for i, item in enumerate(transcript, 1):
        answer_text = item.get("answer_text", "")
        q_text = item.get("question", f"Question {i}")

        word_count = calculate_word_count(answer_text)
        fillers = count_filler_words(answer_text)
        answer_filler_total = sum(fillers.values())

        for fw, count in fillers.items():
            filler_totals[fw] = filler_totals.get(fw, 0) + count

        total_words += word_count
        total_filler_count += answer_filler_total

        # Length category: good range is 30 - 120 words
        if 30 <= word_count <= 120:
            answers_in_good_range += 1
            length_status = "optimal"
        elif word_count < 30:
            answers_too_short += 1
            length_status = "too_short"
        else:
            answers_too_long += 1
            length_status = "too_long"

        answer_stats.append({
            "round": i,
            "word_count": word_count,
            "filler_count": answer_filler_total,
            "length_status": length_status
        })

    num_answers = len(transcript)
    avg_words = round(total_words / num_answers) if num_answers > 0 else 0

    # SCORING FORMULA:
    # 1. Start at 70
    # 2. Subtract 2 points per filler word
    # 3. Add 10 points for each answer in good length range (30-120 words)
    score = 70
    score -= (total_filler_count * 2)
    score += (answers_in_good_range * 10)

    # Clamp strictly between 0 and 100
    final_score = max(0, min(100, score))

    # BUILD CONTENT FEEDBACK TEMPLATE
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

    # BUILD FLUENCY FEEDBACK TEMPLATE
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


def handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    Lambda handler for generate_feedback.
    Input: { transcript: [ { question: str, answer_text: str }, ... ] }
    Output: { content_feedback: str, fluency_feedback: str, final_score: int }
    """
    try:
        payload = parse_event_body(event)
        transcript = payload.get("transcript", [])

        # Also support if payload is directly a list of transcript items
        if isinstance(payload, list):
            transcript = payload

        result = evaluate_transcript(transcript)

        # Check if invoked via API Gateway
        is_api_gw = bool(
            isinstance(event, dict)
            and ("httpMethod" in event or "requestContext" in event)
        )

        if is_api_gw:
            return format_response(200, result)

        return result

    except Exception as e:
        logger.error(f"Error in generate_feedback handler: {str(e)}", exc_info=True)
        error_payload = {"error": str(e)}
        if isinstance(event, dict) and ("httpMethod" in event or "requestContext" in event):
            return format_response(500, error_payload)
        return error_payload
