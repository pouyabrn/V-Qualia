from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import os
from typing import Optional, List
import logging
import fastf1
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from datetime import datetime
import io

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="V-Qualia Analysis API",
    description="A FastAPI server for F1 data analysis and racing telemetry",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted host middleware
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["*"]  # Development phase only
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
        "timestamp": datetime.now().isoformat(),
        "api_key_provided": True
    }


@app.post("/api/v1/analyze")
async def analyze_data(
    data: dict,
    api_key: str = Depends(verify_api_key)
):
    """Endpoint for data analysis"""
    logger.info(f"Analysis request received: {len(data)} items")
    
    analysis_result = {
        "status": "success",
        "message": "Data analysis completed",
        "data_points": len(data) if isinstance(data, (list, dict)) else 1,
        "timestamp": datetime.now().isoformat(),
        "authenticated": True
    }
    
    return analysis_result


@app.get("/api/v1/f1/telemetry")
async def get_f1_telemetry(
    year: int = Query(2024, description="F1 season year (2018-2024)"),
    race: str = Query("Monaco", description="Race name"),
    session: str = Query("R", description="Session type: FP1, FP2, FP3, Q, R (Race)"),
    driver: Optional[str] = Query(None, description="Driver abbreviation"),
    api_key: str = Depends(verify_api_key)
):
    """Get F1 telemetry data"""
    try:
        logger.info(f"Fetching F1 telemetry for {year} {race} {session}")
        
        fastf1.Cache.set_disabled()
        
        session_obj = fastf1.get_session(year, race, session)
        session_obj.load()
        
        if driver:
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
                    "speed": telemetry['Speed'].tolist()[:100],
                    "rpm": telemetry['RPM'].tolist()[:100],
                    "gear": telemetry['nGear'].tolist()[:100],
                    "throttle": telemetry['Throttle'].tolist()[:100],
                    "brake": telemetry['Brake'].tolist()[:100],
                    "time": [str(t) for t in telemetry['Time'].tolist()[:100]]
                }
            }
        else:
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
            
            for driver_name in all_laps['Driver'].unique()[:3]:
                driver_laps = all_laps.pick_driver(driver_name)
                if not driver_laps.empty:
                    driver_telemetry = driver_laps.get_car_data()
                    telemetry_data["drivers_data"].append({
                        "driver": driver_name,
                        "laps": len(driver_laps),
                        "telemetry_points": len(driver_telemetry),
                        "data": {
                            "speed": driver_telemetry['Speed'].tolist()[:50],
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
    """Get F1 sessions for a given year"""
    try:
        logger.info(f"Fetching F1 sessions for {year}")
        
        fastf1.Cache.set_disabled()
        
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


@app.post("/api/v1/f1/telemetry/visualize")
async def visualize_f1_telemetry(data: dict, api_key: str = Depends(verify_api_key)):
    """Generate F1 telemetry visualization from JSON data"""
    try:
        logger.info("Generating F1 telemetry visualization")
        
        telemetry_data = data['data']['data']
        
        brake_data = [100 if brake else 0 for brake in telemetry_data['brake']]
        
        def time_to_seconds(time_str):
            try:
                if 'days' in time_str:
                    dt = pd.to_timedelta(time_str)
                    return dt.total_seconds()
                elif ':' in time_str:
                    parts = time_str.split(':')
                    if len(parts) == 3:
                        hours, minutes, seconds = parts
                        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
                else:
                    return float(time_str)
            except:
                return 0
        
        time_seconds = [time_to_seconds(t) for t in telemetry_data['time']]
        
        fig, axes = plt.subplots(5, 1, figsize=(12, 16), sharex=True)
        fig.suptitle(f'F1 Telemetry - {data["data"]["driver"]}', fontsize=16, fontweight='bold')
        
        axes[0].plot(time_seconds, telemetry_data['speed'], 'b-', linewidth=1.5)
        axes[0].set_ylabel('Speed (km/h)', fontsize=12)
        axes[0].set_title('Speed vs Time', fontsize=14, fontweight='bold')
        axes[0].grid(True, alpha=0.3)
        axes[0].set_ylim(0, None)
        
        axes[1].plot(time_seconds, telemetry_data['rpm'], 'r-', linewidth=1.5)
        axes[1].set_ylabel('RPM', fontsize=12)
        axes[1].set_title('RPM vs Time', fontsize=14, fontweight='bold')
        axes[1].grid(True, alpha=0.3)
        axes[1].set_ylim(0, None)
        
        axes[2].step(time_seconds, telemetry_data['gear'], 'g-', linewidth=2, where='post')
        axes[2].set_ylabel('Gear', fontsize=12)
        axes[2].set_title('Gear vs Time', fontsize=14, fontweight='bold')
        axes[2].grid(True, alpha=0.3)
        axes[2].set_ylim(0.5, max(telemetry_data['gear']) + 0.5)
        axes[2].set_yticks(range(1, max(telemetry_data['gear']) + 1))
        
        axes[3].plot(time_seconds, telemetry_data['throttle'], 'orange', linewidth=1.5)
        axes[3].set_ylabel('Throttle (%)', fontsize=12)
        axes[3].set_title('Throttle vs Time', fontsize=14, fontweight='bold')
        axes[3].grid(True, alpha=0.3)
        axes[3].set_ylim(0, 100)
        
        axes[4].step(time_seconds, brake_data, 'purple', linewidth=2, where='post')
        axes[4].set_ylabel('Brake (%)', fontsize=12)
        axes[4].set_title('Brake vs Time', fontsize=14, fontweight='bold')
        axes[4].set_xlabel('Time (seconds)', fontsize=12)
        axes[4].grid(True, alpha=0.3)
        axes[4].set_ylim(0, 100)
        
        plt.tight_layout()
        
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
        img_buffer.seek(0)
        plt.close()
        
        return StreamingResponse(img_buffer, media_type="image/png")
        
    except Exception as e:
        logger.error(f"Error generating visualization: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating visualization: {str(e)}"
        )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

