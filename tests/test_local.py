import io
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add project directories to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

import resume_parser.app as resume_app
import generate_questions.app as questions_app


class TestInterviewMitraProP2(unittest.TestCase):

    def setUp(self):
        # Load sample events
        with open(root_dir / "events" / "resume_parser_event.json", "r", encoding="utf-8") as f:
            self.resume_event = json.load(f)

        with open(root_dir / "events" / "generate_questions_event.json", "r", encoding="utf-8") as f:
            self.questions_event = json.load(f)

        with open(root_dir / "events" / "generate_questions_fallback.json", "r", encoding="utf-8") as f:
            self.fallback_event = json.load(f)

    def test_question_bank_structure(self):
        bank = questions_app.load_question_bank()
        self.assertEqual(len(bank), 20, "Question bank must have exactly 20 questions")

        required_skills = {
            "python", "java", "teamwork", "leadership",
            "customer service", "problem-solving", "communication", "deadlines"
        }
        all_tags = set()

        for q in bank:
            self.assertIn("id", q)
            self.assertIn("question", q)
            self.assertIn("role", q)
            self.assertIn("difficulty", q)
            self.assertIn("skill_tags", q)

            self.assertIn(q["role"], ["software", "retail", "general"])
            self.assertIn(q["difficulty"], [1, 2, 3])
            self.assertIsInstance(q["skill_tags"], list)
            for tag in q["skill_tags"]:
                self.assertEqual(tag, tag.lower(), f"Tag '{tag}' should be lowercase")
                all_tags.add(tag)

        for skill in required_skills:
            self.assertIn(skill, all_tags, f"Skill '{skill}' should be covered in the question bank")

    def test_resume_parser_success(self):
        resp = resume_app.lambda_handler(self.resume_event, None)
        self.assertEqual(resp["statusCode"], 200)

        body = json.loads(resp["body"])
        self.assertIn("extracted_text", body)
        self.assertIn("Alex Mercer", body["extracted_text"])
        self.assertIn("Python and Java", body["extracted_text"])
        self.assertEqual(body["page_count"], 1)
        self.assertGreater(body["character_count"], 50)

    def test_resume_parser_missing_body(self):
        resp = resume_app.lambda_handler({}, None)
        self.assertEqual(resp["statusCode"], 400)
        body = json.loads(resp["body"])
        self.assertIn("error", body)

    def test_resume_parser_invalid_base64(self):
        resp = resume_app.lambda_handler({"body": json.dumps({"pdf_base64": "not_a_valid_pdf"})}, None)
        self.assertEqual(resp["statusCode"], 400)

    def test_generate_questions_software_round1(self):
        resp = questions_app.lambda_handler(self.questions_event, None)
        self.assertEqual(resp["statusCode"], 200)

        body = json.loads(resp["body"])
        self.assertIn("question", body)
        self.assertEqual(body["difficulty"], 1)
        # Should pick the software round 1 question with most matches (e.g., Python + problem-solving)
        self.assertIn("python", body["question"].lower())

    def test_generate_questions_software_round2(self):
        event = {
            "body": json.dumps({
                "resume_text": "Experienced Python engineer with solid teamwork skills and a track record of meeting deadlines.",
                "role": "software",
                "round_number": 2
            })
        }
        resp = questions_app.lambda_handler(event, None)
        self.assertEqual(resp["statusCode"], 200)

        body = json.loads(resp["body"])
        self.assertIn("question", body)
        self.assertEqual(body["difficulty"], 2)
        self.assertIn("deadlines", body.get("matched_tags", []))

    def test_generate_questions_retail_round2(self):
        event = {
            "body": json.dumps({
                "resume_text": "Proven track record in customer service, active communication, and problem-solving at busy storefronts.",
                "role": "retail",
                "round_number": 2
            })
        }
        resp = questions_app.lambda_handler(event, None)
        self.assertEqual(resp["statusCode"], 200)

        body = json.loads(resp["body"])
        self.assertIn("question", body)
        self.assertEqual(body["difficulty"], 2)
        self.assertIn("customer service", body.get("matched_tags", []))

    def test_generate_questions_fallback(self):
        resp = questions_app.lambda_handler(self.fallback_event, None)
        self.assertEqual(resp["statusCode"], 200)

        body = json.loads(resp["body"])
        self.assertIn("question", body)
        self.assertEqual(body["difficulty"], 1)
        # Fallback question should be from general role at difficulty 1
        bank = questions_app.load_question_bank()
        gen_diff1_questions = [q["question"] for q in bank if q["role"] == "general" and q["difficulty"] == 1]
        self.assertIn(body["question"], gen_diff1_questions)

    @patch("urllib.request.urlopen")
    def test_generate_questions_gemini_success(self, mock_urlopen):
        mock_gemini_response = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "question": "Gemini Question: Explain how you optimized your Python services in production.",
                                    "difficulty": 1
                                })
                            }
                        ]
                    }
                }
            ]
        }
        mock_resp_cm = MagicMock()
        mock_resp_cm.read.return_value = json.dumps(mock_gemini_response).encode("utf-8")
        mock_resp_cm.__enter__.return_value = mock_resp_cm
        mock_urlopen.return_value = mock_resp_cm

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_gemini_key"}):
            resp = questions_app.lambda_handler(self.questions_event, None)
            self.assertEqual(resp["statusCode"], 200)
            body = json.loads(resp["body"])
            self.assertEqual(body["question"], "Gemini Question: Explain how you optimized your Python services in production.")
            self.assertEqual(body["difficulty"], 1)

    @patch("urllib.request.urlopen")
    def test_generate_questions_gemini_network_failure_fallback(self, mock_urlopen):
        import urllib.error
        mock_urlopen.side_effect = urllib.error.URLError("Network unreachable")

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_gemini_key"}):
            resp = questions_app.lambda_handler(self.questions_event, None)
            self.assertEqual(resp["statusCode"], 200)
            body = json.loads(resp["body"])
            # Fallback should kick in and return a question from question_bank
            self.assertIn("question", body)
            self.assertEqual(body["difficulty"], 1)
            self.assertIn("python", body["question"].lower())

    @patch("urllib.request.urlopen")
    def test_generate_questions_gemini_malformed_json_fallback(self, mock_urlopen):
        mock_resp_cm = MagicMock()
        mock_resp_cm.read.return_value = b'{"candidates": [{"content": {"parts": [{"text": "Not valid JSON output"}]}}]}'
        mock_resp_cm.__enter__.return_value = mock_resp_cm
        mock_urlopen.return_value = mock_resp_cm

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_gemini_key"}):
            resp = questions_app.lambda_handler(self.questions_event, None)
            self.assertEqual(resp["statusCode"], 200)
            body = json.loads(resp["body"])
            # Gracefully falls back
            self.assertIn("question", body)
            self.assertEqual(body["difficulty"], 1)


if __name__ == "__main__":
    unittest.main()
