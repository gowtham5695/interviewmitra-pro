import json

def get_cors_headers():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
    }

def lambda_handler(event, context):
    """
    Resume Parser Handler placeholder.
    Parses resume text uploaded by user and extracts key skills & context.
    Note: Bedrock/Textract blocked - uses standard parser / LLM API integration.
    """
    if event.get('httpMethod') == 'OPTIONS':
        return {"statusCode": 200, "headers": get_cors_headers(), "body": json.dumps({"message": "OK"})}

    return {
        "statusCode": 200,
        "headers": get_cors_headers(),
        "body": json.dumps({
            "message": "Resume parser endpoint ready.",
            "status": "success"
        })
    }
