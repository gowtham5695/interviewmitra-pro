import base64
import json
import logging
import io
from pypdf import PdfReader

logger = logging.getLogger()
logger.setLevel(logging.INFO)


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


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> tuple[str, int]:
    """
    Extracts text from PDF raw bytes in-memory using pypdf.
    No external AWS AI services (Textract/Comprehend/Bedrock) are used.
    """
    stream = io.BytesIO(pdf_bytes)
    reader = PdfReader(stream)
    page_texts = []
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            page_texts.append(extracted.strip())
    full_text = "\n\n".join(page_texts).strip()
    return full_text, len(reader.pages)


def lambda_handler(event, context):
    """
    Lambda handler for extracting plain text from an uploaded PDF.
    
    Accepts:
      - API Gateway event with base64 encoded binary payload (`isBase64Encoded: true`).
      - JSON body string with `{"pdf_base64": "..."}`.
      - Direct invoke dictionary with `{"pdf_base64": "..."}` or `{"body": "..."}`.
    
    Returns:
      - JSON with extracted_text, page_count, and character_count.
    """
    logger.info("Received resume_parser event")

    try:
        raw_base64 = None

        # Case 1: Direct JSON payload in event
        if isinstance(event, dict):
            if "pdf_base64" in event:
                raw_base64 = event["pdf_base64"]
            elif "body" in event:
                body = event["body"]
                # If API Gateway flagged the body itself as raw base64 binary
                if event.get("isBase64Encoded", False):
                    raw_base64 = body
                elif isinstance(body, str):
                    try:
                        parsed_body = json.loads(body)
                        if isinstance(parsed_body, dict):
                            raw_base64 = parsed_body.get("pdf_base64", body)
                        else:
                            raw_base64 = body
                    except json.JSONDecodeError:
                        # Raw base64 string directly passed as body
                        raw_base64 = body
                elif isinstance(body, dict):
                    raw_base64 = body.get("pdf_base64")

        if not raw_base64 or not isinstance(raw_base64, str):
            return _build_response(
                400,
                {
                    "error": "Missing or invalid PDF base64 data. Provide base64 encoded PDF in 'pdf_base64' or 'body'."
                },
            )

        # Handle data URI prefix if present (e.g., 'data:application/pdf;base64,...')
        if "," in raw_base64 and raw_base64.startswith("data:"):
            raw_base64 = raw_base64.split(",", 1)[1]

        # Base64 decode
        try:
            pdf_bytes = base64.b64decode(raw_base64, validate=True)
        except Exception:
            # Fallback to standard decode if strict validation fails due to whitespace/newlines
            pdf_bytes = base64.b64decode(raw_base64.strip())

        if not pdf_bytes:
            return _build_response(400, {"error": "Decoded PDF byte buffer is empty."})

        # Extract text via pypdf
        try:
            extracted_text, page_count = extract_text_from_pdf_bytes(pdf_bytes)
        except Exception as pdf_err:
            logger.warning(f"Failed to extract text from PDF: {pdf_err}")
            return _build_response(400, {"error": f"Invalid or corrupted PDF document: {str(pdf_err)}"})

        return _build_response(
            200,
            {
                "extracted_text": extracted_text,
                "page_count": page_count,
                "character_count": len(extracted_text),
            },
        )

    except Exception as exc:
        logger.exception("Internal error while processing resume")
        return _build_response(500, {"error": f"Internal server error: {str(exc)}"})
