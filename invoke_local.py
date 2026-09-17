import json
import sys
from pathlib import Path

# Add root directory to sys.path
root_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(root_dir))

import resume_parser.app as resume_app
import generate_questions.app as questions_app


def main():
    if len(sys.argv) < 3:
        print("Usage: python invoke_local.py <FunctionName> <path_to_event.json>")
        print("Functions:")
        print("  - ResumeParserFunction")
        print("  - GenerateQuestionsFunction")
        print("\nExamples:")
        print("  python invoke_local.py ResumeParserFunction events/resume_parser_event.json")
        print("  python invoke_local.py GenerateQuestionsFunction events/generate_questions_event.json")
        print("  python invoke_local.py GenerateQuestionsFunction events/generate_questions_fallback.json")
        sys.exit(1)

    func_name = sys.argv[1]
    event_path = Path(sys.argv[2])

    if not event_path.exists():
        print(f"Error: Event file not found: {event_path}")
        sys.exit(1)

    with open(event_path, "r", encoding="utf-8") as f:
        event = json.load(f)

    print(f"\n--- Invoking {func_name} with {event_path.name} ---")

    if func_name == "ResumeParserFunction":
        response = resume_app.lambda_handler(event, None)
    elif func_name == "GenerateQuestionsFunction":
        response = questions_app.lambda_handler(event, None)
    else:
        print(f"Unknown function name: {func_name}")
        sys.exit(1)

    print(f"\nStatus Code: {response.get('statusCode')}")
    print("Response Body:")
    try:
        body = json.loads(response.get("body", "{}"))
        print(json.dumps(body, indent=2))
    except Exception:
        print(response.get("body"))


if __name__ == "__main__":
    main()
