import json
import re
from typing import Any, Dict, List, Set

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


def parse_event_body(event: Any) -> Dict[str, Any]:
    """
    Extracts and normalizes the payload whether invoked directly
    or through API Gateway (event['body']).
    """
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


def format_response(status_code: int, body_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Formats the response with CORS headers for API Gateway / SAM.
    """
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
        },
        "body": json.dumps(body_data)
    }


def count_filler_words(text: str) -> Dict[str, int]:
    """
    Counts occurrences of specified filler words using regex word boundaries.
    """
    if not text:
        return {fw: 0 for fw in FILLER_WORDS}

    counts = {}
    lower_text = text.lower()
    for filler in FILLER_WORDS:
        # Match with word boundaries
        pattern = r"\b" + re.escape(filler) + r"\b"
        matches = re.findall(pattern, lower_text)
        counts[filler] = len(matches)

    return counts


def calculate_word_count(text: str) -> int:
    """
    Counts words in a text string.
    """
    if not text or not text.strip():
        return 0
    return len(re.findall(r"\b\w+\b", text))


def extract_keywords(text: str) -> Set[str]:
    """
    Extracts meaningful words excluding common stop words.
    """
    if not text:
        return set()
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    return {w for w in words if w not in STOP_WORDS}
