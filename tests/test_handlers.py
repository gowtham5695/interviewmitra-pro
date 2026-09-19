import io
import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Ensure src and src/handlers are on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(BASE_DIR, "src")
HANDLERS_DIR = os.path.join(SRC_DIR, "handlers")

if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)
if HANDLERS_DIR not in sys.path:
    sys.path.insert(0, HANDLERS_DIR)

import utils
from handlers.next_round import handler as next_round_handler
from handlers.generate_feedback import handler as feedback_handler, evaluate_transcript
from handlers.speak_question import handler as speak_handler, synthesize_and_upload


class TestUtils(unittest.TestCase):
    def test_filler_word_counts(self):
        text = "Um, I like working with AWS, and basically you know it is actually great. No umbrella or likely matches."
        counts = utils.count_filler_words(text)
        self.assertEqual(counts["um"], 1)
        self.assertEqual(counts["like"], 1)
        self.assertEqual(counts["basically"], 1)
        self.assertEqual(counts["you know"], 1)
        self.assertEqual(counts["actually"], 1)

    def test_word_count(self):
        text = "This is a quick test sentence with exactly nine words."
        self.assertEqual(utils.calculate_word_count(text), 10)
        self.assertEqual(utils.calculate_word_count(""), 0)

    def test_keyword_extraction(self):
        text = "We experienced a major outage in production with docker and postgresql."
        keywords = utils.extract_keywords(text)
        self.assertIn("outage", keywords)
        self.assertIn("production", keywords)
        self.assertIn("docker", keywords)
        self.assertNotIn("we", keywords)
        self.assertNotIn("in", keywords)


class TestNextRoundHandler(unittest.TestCase):
    def test_round_1_selection(self):
        event = {"round_number": 1, "previous_answer_text": ""}
        response = next_round_handler(event)
        self.assertIn("question", response)
        self.assertEqual(response["difficulty"], "warm-up")

    def test_round_2_keyword_overlap_disagreement(self):
        event = {
            "round_number": 2,
            "previous_answer_text": "We had a serious disagreement with a teammate regarding technical consensus."
        }
        response = next_round_handler(event)
        self.assertEqual(response["difficulty"], "behavioral")
        self.assertIn("disagreement", response["question"].lower())

    def test_round_3_keyword_overlap_incident(self):
        event = {
            "round_number": 3,
            "previous_answer_text": "Our production system crashed due to traffic spikes and we had to triage the incident."
        }
        response = next_round_handler(event)
        self.assertEqual(response["difficulty"], "stress")
        self.assertIn("crash", response["question"].lower())

    def test_api_gateway_proxy_invocation(self):
        body = json.dumps({"round_number": 1, "previous_answer_text": ""})
        event = {
            "httpMethod": "POST",
            "body": body
        }
        response = next_round_handler(event)
        self.assertEqual(response["statusCode"], 200)
        body_data = json.loads(response["body"])
        self.assertIn("question", body_data)
        self.assertEqual(body_data["difficulty"], "warm-up")

    @patch("urllib.request.urlopen")
    def test_next_round_gemini_success(self, mock_urlopen):
        mock_gemini_response = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "question": "Gemini: How do you handle production incidents under tight SLA constraints?",
                                    "difficulty": 3
                                })
                            }
                        ]
                    }
                }
            ]
        }
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(mock_gemini_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_gemini_key"}):
            event = {"round_number": 3, "previous_answer_text": "we resolved it"}
            response = next_round_handler(event)
            self.assertEqual(response["question"], "Gemini: How do you handle production incidents under tight SLA constraints?")
            self.assertEqual(response["difficulty"], "stress")

    @patch("urllib.request.urlopen")
    def test_next_round_gemini_failure_fallback(self, mock_urlopen):
        import urllib.error
        mock_urlopen.side_effect = urllib.error.URLError("Connection refused")

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_gemini_key"}):
            event = {
                "round_number": 2,
                "previous_answer_text": "We had a serious disagreement with a teammate regarding technical consensus."
            }
            response = next_round_handler(event)
            self.assertEqual(response["difficulty"], "behavioral")
            self.assertIn("disagreement", response["question"].lower())



class TestGenerateFeedbackHandler(unittest.TestCase):
    def test_empty_transcript(self):
        event = {"transcript": []}
        response = feedback_handler(event)
        self.assertEqual(response["final_score"], 0)
        self.assertIn("content_feedback", response)
        self.assertIn("fluency_feedback", response)

    def test_feedback_scoring_formula(self):
        # 1 answer: 33 words (in 30-120 range -> +10 pts), 2 filler words (-4 pts)
        # Starting score: 70 - 4 + 10 = 76
        words_sample = "I worked on cloud architecture for three years where I led multiple backend integrations. " \
                       "Um, actually we used Lambda and DynamoDB for high throughput event processing and reliable messaging across production systems."
        transcript = [
            {
                "question": "Tell me about your background.",
                "answer_text": words_sample
            }
        ]
        result = evaluate_transcript(transcript)
        self.assertEqual(result["final_score"], 76)
        self.assertIn("content_feedback", result)
        self.assertIn("fluency_feedback", result)
        self.assertIn("um", result["fluency_feedback"])

    def test_score_clamping(self):
        # Heavy filler words should not drop score below 0
        heavy_fillers = "Um like actually basically you know " * 30
        transcript = [{"question": "Q", "answer_text": heavy_fillers}]
        result = evaluate_transcript(transcript)
        self.assertGreaterEqual(result["final_score"], 0)

        # Perfect answers should not exceed 100
        perfect_answers = [
            {"question": f"Q{i}", "answer_text": "This is a well structured technical response explaining architectural design and trade-offs clearly without any verbal hesitation or filler words. " * 3}
            for i in range(5)
        ]
        result_perfect = evaluate_transcript(perfect_answers)
        self.assertLessEqual(result_perfect["final_score"], 100)

    @patch("urllib.request.urlopen")
    def test_feedback_gemini_success_strong(self, mock_urlopen):
        mock_gemini_response = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "final_score": 94,
                                    "content_feedback": "Excellent technical depth using STAR methodology. Demonstrated sub-millisecond database optimizations and high-concurrency event streaming architecture.",
                                    "fluency_feedback": "Exceptional verbal delivery with steady pacing, confident tone, and zero detectable filler words throughout all 3 rounds."
                                })
                            }
                        ]
                    }
                }
            ]
        }
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(mock_gemini_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_gemini_key"}):
            event = {
                "transcript": [
                    {
                        "question": "Walk me through your background.",
                        "answer_text": "Over the past four years as a Senior Backend Engineer, I specialized in architecting event-driven microservices using Python and AWS DynamoDB. At my previous company, I led the redesign of our real-time payment ingestion pipeline, reducing p99 latency from 450ms to 45ms while supporting over 50,000 requests per second with 99.99% availability."
                    }
                ]
            }
            response = feedback_handler(event)
            self.assertEqual(response["final_score"], 94)
            self.assertIn("STAR methodology", response["content_feedback"])
            self.assertNotIn("good job", response["content_feedback"].lower())
            self.assertIn("Exceptional verbal delivery", response["fluency_feedback"])

    @patch("urllib.request.urlopen")
    def test_feedback_gemini_success_weak(self, mock_urlopen):
        mock_gemini_response = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "final_score": 38,
                                    "content_feedback": "Responses lacked technical depth and concrete metrics. The answer to the production outage question was evasive and failed to articulate root cause analysis procedures or systematic triage steps.",
                                    "fluency_feedback": "Heavy reliance on filler words ('um', 'like', 'you know') disrupted clarity. Practice deliberate pausing and structuring answers before speaking."
                                })
                            }
                        ]
                    }
                }
            ]
        }
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(mock_gemini_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_gemini_key"}):
            event = {
                "transcript": [
                    {
                        "question": "Walk me through your background.",
                        "answer_text": "Um, I do some coding and like stuff with servers."
                    }
                ]
            }
            response = feedback_handler(event)
            self.assertEqual(response["final_score"], 38)
            self.assertIn("lacked technical depth", response["content_feedback"])
            self.assertIn("filler words", response["fluency_feedback"])

    @patch("urllib.request.urlopen")
    def test_feedback_gemini_failure_fallback(self, mock_urlopen):
        import urllib.error
        mock_urlopen.side_effect = urllib.error.URLError("Gemini Service Unavailable")

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_gemini_key"}):
            event = {
                "transcript": [
                    {
                        "question": "Tell me about your background.",
                        "answer_text": "I worked on cloud architecture for three years where I led multiple backend integrations across production systems with AWS."
                    }
                ]
            }
            response = feedback_handler(event)
            # Falls back to formula score
            self.assertIsInstance(response["final_score"], int)
            self.assertIn("optimal depth", response["content_feedback"])
            self.assertIn("fluency", response["fluency_feedback"].lower())



class TestSpeakQuestionHandler(unittest.TestCase):
    def test_mock_mode(self):
        with patch.dict(os.environ, {"MOCK_AWS": "true", "AUDIO_BUCKET_NAME": "test-audio-bucket"}):
            event = {"question_text": "What are your core strengths?"}
            response = speak_handler(event)
            self.assertIn("audio_url", response)
            self.assertIn("test-audio-bucket", response["audio_url"])
            self.assertEqual(response["bucket"], "test-audio-bucket")

    @patch("handlers.speak_question.get_polly_client")
    @patch("handlers.speak_question.get_s3_client")
    def test_synthesize_and_upload_flow(self, mock_get_s3, mock_get_polly):
        mock_polly = MagicMock()
        mock_s3 = MagicMock()
        mock_get_polly.return_value = mock_polly
        mock_get_s3.return_value = mock_s3

        fake_stream = io.BytesIO(b"fake-mp3-audio-bytes")
        mock_polly.synthesize_speech.return_value = {"AudioStream": fake_stream}
        mock_s3.generate_presigned_url.return_value = "https://test-bucket.s3.amazonaws.com/audio/test.mp3?signature=xyz"

        result = synthesize_and_upload(
            question_text="How do you handle production outages?",
            voice_id="Joanna",
            bucket_name="test-bucket"
        )

        mock_polly.synthesize_speech.assert_called_once()
        mock_s3.put_object.assert_called_once()
        mock_s3.generate_presigned_url.assert_called_once()

        self.assertEqual(result["audio_url"], "https://test-bucket.s3.amazonaws.com/audio/test.mp3?signature=xyz")
        self.assertEqual(result["bucket"], "test-bucket")


if __name__ == "__main__":
    unittest.main()
