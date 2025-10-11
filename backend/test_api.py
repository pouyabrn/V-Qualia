#!/usr/bin/env python3
"""
Test script for V-Qualia FastAPI server
Run this to test the API endpoints locally
"""

import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:8000"
API_KEY = "your-secret-api-key-here"  # Change this to match your .env file

def test_endpoint(endpoint, method="GET", data=None, headers=None):
    """Test a single endpoint"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers)
        
        print(f"\n{method} {endpoint}")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
        
    except requests.exceptions.ConnectionError:
        print(f"\n{method} {endpoint}")
        print("Connection failed - Is the server running?")
        return False
    except Exception as e:
        print(f"\n{method} {endpoint}")
        print(f"Error: {e}")
        return False

def main():
    """Run all API tests"""
    print("Testing V-Qualia FastAPI Server")
    print("=" * 50)
    
    # Test public endpoints
    print("\nTesting Public Endpoints:")
    test_endpoint("/")
    test_endpoint("/health")
    
    # Test protected endpoints
    print("\nTesting Protected Endpoints:")
    headers = {"Authorization": f"Bearer {API_KEY}"}
    
    test_endpoint("/api/v1/status", headers=headers)
    
    # Test analysis endpoint
    test_data = {"data": [1, 2, 3, 4, 5], "type": "numbers"}
    test_endpoint("/api/v1/analyze", method="POST", data=test_data, headers=headers)
    
    print("\n" + "=" * 50)
    print("Testing completed!")
    print("\nTo start the server, run: python main.py")
    print("Then visit: http://localhost:8000/docs for interactive API documentation")

if __name__ == "__main__":
    main()
