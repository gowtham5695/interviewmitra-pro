"""
Local invocation runner simulating `sam local invoke` for test events
without requiring a Docker daemon.
"""

import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(BASE_DIR, "src")
HANDLERS_DIR = os.path.join(SRC_DIR, "handlers")
EVENTS_DIR = os.path.join(BASE_DIR, "events")

if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)
if HANDLERS_DIR not in sys.path:
    sys.path.insert(0, HANDLERS_DIR)

# Enable mock AWS mode for offline/local testing
os.environ.setdefault("MOCK_AWS", "true")
os.environ.setdefault("AUDIO_BUCKET_NAME", "interviewmitra-audio-local")

from handlers.next_round import handler as next_round_handler
from handlers.generate_feedback import handler as feedback_handler
from handlers.speak_question import handler as speak_handler


def run_test(name: str, handler_func, event_file: str):
    print(f"\n=======================================================")
    print(f"Testing {name} with {os.path.basename(event_file)}")
    print(f"=======================================================")
    with open(event_file, "r", encoding="utf-8") as f:
        event = json.load(f)
    print(f"Input Event:\n{json.dumps(event, indent=2)}")
    response = handler_func(event)
    print(f"\nHandler Output:\n{json.dumps(response, indent=2)}")


if __name__ == "__main__":
    run_test("NextRoundFunction (Round 1)", next_round_handler, os.path.join(EVENTS_DIR, "next_round_r1.json"))
    run_test("NextRoundFunction (Round 2)", next_round_handler, os.path.join(EVENTS_DIR, "next_round_r2.json"))
    run_test("NextRoundFunction (Round 3)", next_round_handler, os.path.join(EVENTS_DIR, "next_round_r3.json"))
    run_test("GenerateFeedbackFunction", feedback_handler, os.path.join(EVENTS_DIR, "generate_feedback.json"))
    run_test("SpeakQuestionFunction", speak_handler, os.path.join(EVENTS_DIR, "speak_question.json"))
