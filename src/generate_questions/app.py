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
    Generate Questions Handler placeholder.
    Generates interview questions tailored to candidate role & resume.
    """
    if event.get('httpMethod') == 'OPTIONS':
        return {"statusCode": 200, "headers": get_cors_headers(), "body": json.dumps({"message": "OK"})}

    return {
        "statusCode": 200,
        "headers": get_cors_headers(),
        "body": json.dumps({
            "message": "Generate questions endpoint ready.",
            "status": "success"
        })
    }
