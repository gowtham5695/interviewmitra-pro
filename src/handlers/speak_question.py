import json
import logging
import os
import uuid
from typing import Any, Dict

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
except ImportError:
    boto3 = None
    BotoCoreError = Exception
    ClientError = Exception

from utils import format_response, parse_event_body

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

DEFAULT_BUCKET_NAME = os.environ.get("AUDIO_BUCKET_NAME", "interviewmitra-audio-placeholder")
DEFAULT_VOICE_ID = os.environ.get("DEFAULT_VOICE_ID", "Joanna")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")


def get_polly_client():
    return boto3.client("polly", region_name=AWS_REGION)


def get_s3_client():
    return boto3.client("s3", region_name=AWS_REGION)


def synthesize_and_upload(
    question_text: str,
    voice_id: str = DEFAULT_VOICE_ID,
    bucket_name: str = DEFAULT_BUCKET_NAME,
    expires_in: int = 3600
) -> Dict[str, str]:
    """
    Synthesizes speech using Amazon Polly, uploads the resulting MP3 to S3,
    and generates a presigned URL.
    """
    if not question_text or not question_text.strip():
        raise ValueError("Question text is required for speech synthesis.")

    # Check for mock / local testing mode
    if os.environ.get("MOCK_AWS", "").lower() in ("true", "1", "yes"):
        logger.info("MOCK_AWS mode enabled: Generating mock audio URL for local testing.")
        mock_key = f"audio/mock_{uuid.uuid4().hex[:10]}.mp3"
        return {
            "audio_url": f"https://{bucket_name}.s3.amazonaws.com/{mock_key}?presigned=true&mock=true",
            "bucket": bucket_name,
            "key": mock_key
        }

    polly = get_polly_client()
    s3 = get_s3_client()

    # Try neural engine first, fall back to standard if not supported
    try:
        polly_response = polly.synthesize_speech(
            Text=question_text,
            OutputFormat="mp3",
            VoiceId=voice_id,
            Engine="neural"
        )
    except (ClientError, BotoCoreError) as pe:
        logger.warning(f"Neural engine synthesis failed ({str(pe)}). Retrying with standard engine.")
        polly_response = polly.synthesize_speech(
            Text=question_text,
            OutputFormat="mp3",
            VoiceId=voice_id,
            Engine="standard"
        )

    audio_stream = polly_response.get("AudioStream")
    if not audio_stream:
        raise RuntimeError("Polly did not return an AudioStream.")

    audio_bytes = audio_stream.read()
    s3_key = f"audio/question_{uuid.uuid4().hex[:12]}.mp3"

    logger.info(f"Uploading {len(audio_bytes)} bytes of audio to s3://{bucket_name}/{s3_key}")
    s3.put_object(
        Bucket=bucket_name,
        Key=s3_key,
        Body=audio_bytes,
        ContentType="audio/mpeg"
    )

    presigned_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket_name, "Key": s3_key},
        ExpiresIn=expires_in
    )

    return {
        "audio_url": presigned_url,
        "bucket": bucket_name,
        "key": s3_key
    }


def handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    Lambda handler for speak_question.
    Input: { question_text: str, voice_id: Optional[str] }
    Output: { audio_url: str, bucket: str, key: str }
    """
    try:
        payload = parse_event_body(event)
        question_text = payload.get("question_text") or payload.get("question") or payload.get("text", "")
        voice_id = payload.get("voice_id", DEFAULT_VOICE_ID)
        bucket_name = os.environ.get("AUDIO_BUCKET_NAME", DEFAULT_BUCKET_NAME)

        if not question_text:
            raise ValueError("Missing 'question_text' in request payload.")

        result = synthesize_and_upload(
            question_text=question_text,
            voice_id=voice_id,
            bucket_name=bucket_name
        )

        is_api_gw = bool(
            isinstance(event, dict)
            and ("httpMethod" in event or "requestContext" in event)
        )

        if is_api_gw:
            return format_response(200, result)

        return result

    except Exception as e:
        logger.error(f"Error in speak_question handler: {str(e)}", exc_info=True)
        error_payload = {"error": str(e)}
        if isinstance(event, dict) and ("httpMethod" in event or "requestContext" in event):
            return format_response(500, error_payload)
        return error_payload
