import json
import os
import boto3

polly = boto3.client('polly')
s3 = boto3.client('s3')

MEDIA_BUCKET = os.environ.get('MEDIA_BUCKET', '')

def get_cors_headers():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
    }

def lambda_handler(event, context):
    """
    Speak Question Handler using Amazon Polly.
    Converts question text into speech audio MP3.
    """
    if event.get('httpMethod') == 'OPTIONS':
        return {"statusCode": 200, "headers": get_cors_headers(), "body": json.dumps({"message": "OK"})}

    try:
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        text = body.get('text', 'Hello, welcome to InterviewMitra Pro.')
        voice_id = body.get('voice_id', 'Joanna')

        response = polly.synthesize_speech(
            Text=text,
            OutputFormat='mp3',
            VoiceId=voice_id,
            Engine='neural'
        )

        return {
            "statusCode": 200,
            "headers": get_cors_headers(),
            "body": json.dumps({
                "message": "Audio synthesized successfully.",
                "voice_id": voice_id,
                "text": text
            })
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": get_cors_headers(),
            "body": json.dumps({"error": str(e)})
        }
