from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn
import os
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="V-Qualia Analysis API",
    description="A FastAPI server for data analysis",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)


# Security
security = HTTPBearer()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # development phase onlyyy
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Trusted host middleware
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["*"]  # development phase onlyyy
)


# Simple API key validation (replace with proper authentication)
API_KEY = os.getenv("API_KEY", "your-secret-api-key-here")

def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify API key for authentication"""
    if credentials.credentials != API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key"
        )
    return credentials.credentials

@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "message": "V-Qualia Analysis API is running",
        "status": "healthy",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "V-Qualia Analysis API"
    }

@app.get("/api/v1/status")
async def api_status(api_key: str = Depends(verify_api_key)):
    """Protected endpoint that requires API key"""
    return {
        "message": "API is working correctly",
        "authenticated": True,
        "timestamp": "2024-01-01T00:00:00Z"
    }

@app.post("/api/v1/analyze")
async def analyze_data(
    data: dict,
    api_key: str = Depends(verify_api_key)
):
    """Endpoint for data analysis (placeholder for future implementation)"""
    logger.info(f"Analysis request received: {len(data)} items")
    
    # Placeholder analysis logic
    analysis_result = {
        "status": "success",
        "message": "Data analysis completed",
        "data_points": len(data) if isinstance(data, (list, dict)) else 1,
        "timestamp": "2024-01-01T00:00:00Z"
    }
    
    return analysis_result

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
