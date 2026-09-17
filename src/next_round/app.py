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
    Next Round / Answer Handler placeholder.
    Processes user responses and advances the interview across rounds (warm-up, behavioral, stress).
    """
    if event.get('httpMethod') == 'OPTIONS':
        return {"statusCode": 200, "headers": get_cors_headers(), "body": json.dumps({"message": "OK"})}

    return {
        "statusCode": 200,
        "headers": get_cors_headers(),
        "body": json.dumps({
            "message": "Next round / answer endpoint ready.",
            "status": "success"
        })
    }
