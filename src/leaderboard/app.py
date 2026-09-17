import json
import os
import time
from decimal import Decimal
import boto3

dynamodb = boto3.resource('dynamodb')
LEADERBOARD_TABLE_NAME = os.environ.get('LEADERBOARD_TABLE', 'interviewmitra-pro-leaderboard')

def decimal_to_native(obj):
    """Recursively convert DynamoDB Decimal types to float or int for JSON serialization."""
    if isinstance(obj, list):
        return [decimal_to_native(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_native(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    return obj

def get_cors_headers():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    }

def lambda_handler(event, context):
    """
    Leaderboard handler for InterviewMitra Pro.
    - POST /leaderboard: Write/update a score entry in DynamoDB.
    - GET /leaderboard: Fetch and return top 10 scores sorted descending.
    """
    http_method = event.get('httpMethod', '')
    
    # Handle CORS preflight
    if http_method == 'OPTIONS':
        return {
            "statusCode": 200,
            "headers": get_cors_headers(),
            "body": json.dumps({"message": "OK"})
        }

    table = dynamodb.Table(LEADERBOARD_TABLE_NAME)

    try:
        if http_method == 'POST':
            body = {}
            if event.get('body'):
                try:
                    body = json.loads(event['body'])
                except Exception:
                    body = {}

            # Retrieve user_id from Cognito claims if authenticated, fallback to payload
            authorizer_claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
            user_id = authorizer_claims.get('sub') or body.get('user_id') or body.get('username')

            if not user_id:
                return {
                    "statusCode": 400,
                    "headers": get_cors_headers(),
                    "body": json.dumps({"error": "user_id or authenticated user context is required."})
                }

            score = body.get('score', 0)
            username = body.get('username', authorizer_claims.get('email', 'Anonymous'))
            target_role = body.get('target_role', 'General Software Engineer')

            # Prepare DynamoDB item (convert float score to Decimal)
            item = {
                'user_id': str(user_id),
                'username': str(username),
                'target_role': str(target_role),
                'score': Decimal(str(score)),
                'updated_at': int(time.time())
            }

            table.put_item(Item=item)

            return {
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json.dumps({
                    "message": "Score successfully recorded.",
                    "data": decimal_to_native(item)
                })
            }

        elif http_method == 'GET':
            # Scan table to retrieve scores
            response = table.scan()
            items = response.get('Items', [])

            # Convert Decimals to native Python numbers
            native_items = decimal_to_native(items)

            # Sort items by score descending
            sorted_items = sorted(native_items, key=lambda x: x.get('score', 0), reverse=True)

            # Return top 10
            top_10 = sorted_items[:10]

            return {
                "statusCode": 200,
                "headers": get_cors_headers(),
                "body": json.dumps({
                    "leaderboard": top_10,
                    "count": len(top_10)
                })
            }

        else:
            return {
                "statusCode": 405,
                "headers": get_cors_headers(),
                "body": json.dumps({"error": f"Method {http_method} not allowed."})
            }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": get_cors_headers(),
            "body": json.dumps({"error": f"Internal server error: {str(e)}"})
        }
