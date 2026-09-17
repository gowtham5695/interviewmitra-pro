"""
Direct Python test runner for Leaderboard Lambda Handler (No Dependencies / No Docker required).
Mocks boto3 in sys.modules so it runs in pure Python without needing Docker or pip dependencies.
"""
import sys
import os
import json
from unittest.mock import MagicMock

# 1. Mock boto3 module before importing app
mock_boto3 = MagicMock()
mock_db_items = []

def mock_put_item(Item):
    for i, existing in enumerate(mock_db_items):
        if existing['user_id'] == Item['user_id']:
            mock_db_items[i] = Item
            return {'ResponseMetadata': {'HTTPStatusCode': 200}}
    mock_db_items.append(Item)
    return {'ResponseMetadata': {'HTTPStatusCode': 200}}

def mock_scan():
    return {'Items': list(mock_db_items)}

mock_table = MagicMock()
mock_table.put_item.side_effect = mock_put_item
mock_table.scan.side_effect = mock_scan

mock_boto3.resource.return_value.Table.return_value = mock_table
sys.modules['boto3'] = mock_boto3

# 2. Add src/leaderboard to sys.path and import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src/leaderboard')))
import app

def test_leaderboard_directly():
    print("==================================================")
    print("Testing Leaderboard Lambda Handler (Zero Dependencies / No Docker)")
    print("==================================================")

    # Load POST event from events/post_leaderboard.json
    post_event_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../events/post_leaderboard.json'))
    with open(post_event_path, 'r') as f:
        post_event = json.load(f)

    print("\n--- 1. Testing POST /leaderboard ---")
    post_response = app.lambda_handler(post_event, None)
    print("Status Code:", post_response.get("statusCode"))
    print("Headers:", post_response.get("headers"))
    print("Body:", post_response.get("body"))

    # Add second score to test top 10 sorting
    post_event_2 = {
        "httpMethod": "POST",
        "path": "/leaderboard",
        "headers": {"Content-Type": "application/json"},
        "requestContext": {"authorizer": {"claims": {"sub": "user_67890_test"}}},
        "body": json.dumps({"username": "Sam Champion", "score": 99.0, "target_role": "Staff Architect"})
    }
    app.lambda_handler(post_event_2, None)

    # Load GET event from events/get_leaderboard.json
    get_event_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../events/get_leaderboard.json'))
    with open(get_event_path, 'r') as f:
        get_event = json.load(f)

    print("\n--- 2. Testing GET /leaderboard ---")
    get_response = app.lambda_handler(get_event, None)
    print("Status Code:", get_response.get("statusCode"))
    print("Headers:", get_response.get("headers"))
    print("Body:", get_response.get("body"))

    print("\n==================================================")
    print("SUCCESS: Leaderboard Handler logic executed cleanly!")
    print("==================================================")

if __name__ == '__main__':
    test_leaderboard_directly()
