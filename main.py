from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn
import os
from typing import Optional, List
import logging
import fastf1
import pandas as pd
from datetime import datetime

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


# Simple API key authentication
API_KEY = os.getenv("API_KEY", "api_key")

def verify_api_key(api_key: str = Query(..., description="API Key for authentication")):
    """Verify API key for authentication"""
    if api_key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key. Please provide a valid API key as a query parameter."
        )
    return api_key

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
        "timestamp": "2024-01-01T00:00:00Z",
        "api_key_provided": True
    }

@app.post("/api/v1/analyze")
async def analyze_data(
    data: dict,
    api_key: str = Depends(verify_api_key)
):
    """Endpoint for data analysis (placeholder for future implementation)"""
    logger.info(f"Analysis request received: {len(data)} items")
    
    # analysis logic (future implementation)
    analysis_result = {
        "status": "success",
        "message": "Data analysis completed",
        "data_points": len(data) if isinstance(data, (list, dict)) else 1,
        "timestamp": "2024-01-01T00:00:00Z",
        "authenticated": True
    }
    
    return analysis_result

@app.get("/api/v1/f1/telemetry")
async def get_f1_telemetry(
    year: int = Query(2024, description="F1 season year (2018-2024)"),
    race: str = Query("Monaco", description="Race name (e.g., 'Monaco', 'Silverstone', 'Spa')"),
    session: str = Query("R", description="Session type: FP1, FP2, FP3, Q, R (Race)"),
    driver: Optional[str] = Query(None, description="Driver abbreviation (e.g., 'VER', 'HAM', 'LEC')"),
    api_key: str = Depends(verify_api_key)
):

    try:
        logger.info(f"Fetching F1 telemetry for {year} {race} {session}")
        
        # Cache is disabled for now to prevent system32 access errors
        fastf1.Cache.set_disabled()
        
        # Load the session
        session_obj = fastf1.get_session(year, race, session)
        session_obj.load()
        
        # Get telemetry data
        if driver:
            # Get data for specific driver
            driver_data = session_obj.laps.pick_driver(driver)
            if driver_data.empty:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Driver {driver} not found in {year} {race} {session}"
                )
            
            telemetry = driver_data.get_car_data()
            telemetry_data = {
                "driver": driver,
                "laps": len(driver_data),
                "telemetry_points": len(telemetry),
                "data": {
                    "speed": telemetry['Speed'].tolist()[:100],  # Limit to 100 points
                    "rpm": telemetry['RPM'].tolist()[:100],
                    "gear": telemetry['nGear'].tolist()[:100],
                    "throttle": telemetry['Throttle'].tolist()[:100],
                    "brake": telemetry['Brake'].tolist()[:100],
                    "time": [str(t) for t in telemetry['Time'].tolist()[:100]]
                }
            }
        else:
            # Get data for all drivers
            all_laps = session_obj.laps
            telemetry_data = {
                "session_info": {
                    "year": year,
                    "race": race,
                    "session": session,
                    "total_laps": len(all_laps),
                    "drivers": all_laps['Driver'].unique().tolist()
                },
                "drivers_data": []
            }
            
            # Get data for each driver (limit to first 3 drivers for performance)
            for driver_name in all_laps['Driver'].unique()[:3]:
                driver_laps = all_laps.pick_driver(driver_name)
                if not driver_laps.empty:
                    driver_telemetry = driver_laps.get_car_data()
                    telemetry_data["drivers_data"].append({
                        "driver": driver_name,
                        "laps": len(driver_laps),
                        "telemetry_points": len(driver_telemetry),
                        "data": {
                            "speed": driver_telemetry['Speed'].tolist()[:50],  # limit to 50 points per driver
                            "rpm": driver_telemetry['RPM'].tolist()[:50],
                            "gear": driver_telemetry['nGear'].tolist()[:50],
                            "throttle": driver_telemetry['Throttle'].tolist()[:50],
                            "brake": driver_telemetry['Brake'].tolist()[:50]
                        }
                    })
        
        return {
            "status": "success",
            "message": f"F1 telemetry data retrieved for {year} {race} {session}",
            "timestamp": datetime.now().isoformat(),
            "data": telemetry_data
        }
        
    except Exception as e:
        logger.error(f"Error fetching F1 telemetry: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching F1 telemetry data: {str(e)}"
        )

@app.get("/api/v1/f1/sessions")
async def get_f1_sessions(
    year: int = Query(2024, description="F1 season year"),
    api_key: str = Depends(verify_api_key)
):

    try:
        logger.info(f"Fetching F1 sessions for {year}")
        
        
        # Cache is disabled for now
        fastf1.Cache.set_disabled()
        
        #event
        schedule = fastf1.get_event_schedule(year)
        
        sessions_data = []
        for _, event in schedule.iterrows():
            sessions_data.append({
                "race_name": event['EventName'],
                "location": event['Location'],
                "country": event['Country'],
                "date": str(event['EventDate']),
                "sessions": ["FP1", "FP2", "FP3", "Q", "R"]
            })
        
        return {
            "status": "success",
            "message": f"F1 sessions for {year}",
            "timestamp": datetime.now().isoformat(),
            "year": year,
            "total_races": len(sessions_data),
            "sessions": sessions_data
        }
        
    except Exception as e:
        logger.error(f"Error fetching F1 sessions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching F1 sessions: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
