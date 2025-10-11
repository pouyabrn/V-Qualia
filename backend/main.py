from fastapi import FastAPI, HTTPException, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import uvicorn
import os
import json
import pandas as pd
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import asyncio
from prediction_engine import run_prediction, is_engine_built

# yeah we just pretend auth exists for now lol
PLACEHOLDER_AUTH = "ididntwriteauthsystemyetLOL"

# setup data directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
CARS_DIR = os.path.join(DATA_DIR, "cars")
TRACKS_DIR = os.path.join(DATA_DIR, "tracks")
PREDICTIONS_DIR = os.path.join(DATA_DIR, "predictions")

# make sure directories exist
for directory in [DATA_DIR, CARS_DIR, TRACKS_DIR, PREDICTIONS_DIR]:
    os.makedirs(directory, exist_ok=True)

app = FastAPI(
    title="V-Qualia API",
    description="Backend for V-Qualia telemetry platform",
    version="2.0.0"
)

# let frontend talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# models for request/response
# nested car config models for prediction engine format
class MassConfig(BaseModel):
    mass: float
    cog_height: float
    wheelbase: float
    weight_distribution: float

class AerodynamicsConfig(BaseModel):
    Cl: float
    Cd: float
    frontal_area: float
    air_density: float

class TireConfig(BaseModel):
    mu_x: float
    mu_y: float
    load_sensitivity: float
    tire_radius: float

class PowertrainConfig(BaseModel):
    engine_torque_curve: dict
    gear_ratios: List[float]
    final_drive: float
    efficiency: float
    max_rpm: float
    min_rpm: float

class BrakeConfig(BaseModel):
    max_brake_force: float
    brake_bias: float

class CarConfig(BaseModel):
    name: str
    mass: MassConfig
    aerodynamics: AerodynamicsConfig
    tire: TireConfig
    powertrain: PowertrainConfig
    brake: BrakeConfig

class TrackInfo(BaseModel):
    name: str  # unified format
    length: Optional[float] = None
    data_points: Optional[int] = None

# check if auth token is legit (spoiler: we just check if it matches our placeholder)
def verify_auth(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="no auth token bro")
    
    token = authorization.replace("Bearer ", "").strip()
    if token != PLACEHOLDER_AUTH:
        raise HTTPException(status_code=401, detail="wrong token buddy")
    
    return token

# basic health check
@app.get("/")
async def root():
    return {
        "message": "V-Qualia API is alive",
        "version": "2.0.0",
        "status": "running"
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# === CAR ENDPOINTS ===

@app.get("/api/cars")
async def get_cars(auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    cars = []
    for filename in os.listdir(CARS_DIR):
        if filename.endswith(".json"):
            with open(os.path.join(CARS_DIR, filename), "r") as f:
                car_data = json.load(f)
                cars.append(car_data)
    
    return {"success": True, "cars": cars, "count": len(cars)}

@app.get("/api/cars/{car_name}")
async def get_car(car_name: str, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    # replace spaces with underscores for filename
    filename = f"{car_name.replace(' ', '_')}.json"
    filepath = os.path.join(CARS_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"car '{car_name}' not found")
    
    with open(filepath, "r") as f:
        car_data = json.load(f)
    
    return {"success": True, "car": car_data}

@app.post("/api/cars")
async def create_car(car: CarConfig, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    # save as json file (use 'name' field now)
    filename = f"{car.name.replace(' ', '_')}.json"
    filepath = os.path.join(CARS_DIR, filename)
    
    # check if car already exists
    if os.path.exists(filepath):
        raise HTTPException(status_code=400, detail=f"car '{car.name}' already exists")
    
    car_data = car.dict()
    car_data["created_at"] = datetime.now().isoformat()
    car_data["updated_at"] = datetime.now().isoformat()
    
    with open(filepath, "w") as f:
        json.dump(car_data, f, indent=2)
    
    return {"success": True, "message": f"car '{car.name}' created", "car": car_data}

@app.put("/api/cars/{car_name}")
async def update_car(car_name: str, car: CarConfig, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    filename = f"{car_name.replace(' ', '_')}.json"
    filepath = os.path.join(CARS_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"car '{car_name}' not found")
    
    # load existing data to keep created_at
    with open(filepath, "r") as f:
        existing_data = json.load(f)
    
    car_data = car.dict()
    car_data["created_at"] = existing_data.get("created_at", datetime.now().isoformat())
    car_data["updated_at"] = datetime.now().isoformat()
    
    with open(filepath, "w") as f:
        json.dump(car_data, f, indent=2)
    
    return {"success": True, "message": f"car '{car_name}' updated", "car": car_data}

@app.delete("/api/cars/{car_name}")
async def delete_car(car_name: str, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    filename = f"{car_name.replace(' ', '_')}.json"
    filepath = os.path.join(CARS_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"car '{car_name}' not found")
    
    # actually delete the file, no mercy
    try:
        os.remove(filepath)
        # double check it's really gone
        if os.path.exists(filepath):
            raise Exception("file still exists after delete attempt")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to delete file: {str(e)}")
    
    return {"success": True, "message": f"car '{car_name}' permanently deleted", "deleted": True}

# === TRACK ENDPOINTS ===

@app.get("/api/tracks")
async def get_tracks(auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    tracks = []
    for filename in os.listdir(TRACKS_DIR):
        if filename.endswith(".csv"):
            filepath = os.path.join(TRACKS_DIR, filename)
            track_name = filename.replace(".csv", "").replace("_", " ")
            
            # read csv to get some basic info
            try:
                df = pd.read_csv(filepath)
                track_info = {
                    "name": track_name,  # unified format: use 'name' not 'track_name'
                    "filename": filename,
                    "length": float(df['s_m'].max()) if 's_m' in df.columns else None,
                    "data_points": len(df),
                    "created_at": datetime.fromtimestamp(os.path.getctime(filepath)).isoformat()
                }
                tracks.append(track_info)
            except Exception as e:
                # if csv is messed up just skip it
                continue
    
    return {"success": True, "tracks": tracks, "count": len(tracks)}

@app.get("/api/tracks/{track_name}")
async def get_track(track_name: str, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    filename = f"{track_name.replace(' ', '_')}.csv"
    filepath = os.path.join(TRACKS_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"track '{track_name}' not found")
    
    # read and return csv data
    df = pd.read_csv(filepath)
    
    return {
        "success": True,
        "name": track_name,  # unified format: use 'name' not 'track_name'
        "data": df.to_dict(orient='records'),
        "columns": list(df.columns),
        "length": float(df['s_m'].max()) if 's_m' in df.columns else None,
        "data_points": len(df)
    }

@app.post("/api/tracks/upload")
async def upload_track(
    track_name: str,
    file: UploadFile = File(...),
    auth: str = Header(None, alias="Authorization")
):
    verify_auth(auth)
    
    # make sure it's a csv
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="only csv files allowed")
    
    filename = f"{track_name.replace(' ', '_')}.csv"
    filepath = os.path.join(TRACKS_DIR, filename)
    
    # check if track already exists
    if os.path.exists(filepath):
        raise HTTPException(status_code=400, detail=f"track '{track_name}' already exists")
    
    # save the file
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # validate it's actually a proper csv
    try:
        df = pd.read_csv(filepath)
        track_info = {
            "track_name": track_name,
            "filename": filename,
            "length": float(df['s_m'].max()) if 's_m' in df.columns else None,
            "data_points": len(df),
            "columns": list(df.columns)
        }
    except Exception as e:
        # if csv is broken delete it
        os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"invalid csv file: {str(e)}")
    
    return {"success": True, "message": f"track '{track_name}' uploaded", "track": track_info}

@app.delete("/api/tracks/{track_name}")
async def delete_track(track_name: str, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    filename = f"{track_name.replace(' ', '_')}.csv"
    filepath = os.path.join(TRACKS_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"track '{track_name}' not found")
    
    # nuke it from existence
    try:
        os.remove(filepath)
        # make sure it's actually gone
        if os.path.exists(filepath):
            raise Exception("track file still exists somehow")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to delete track: {str(e)}")
    
    return {"success": True, "message": f"track '{track_name}' obliterated", "deleted": True}

# === PREDICTION ENDPOINTS (for later when we connect the engine) ===

@app.get("/api/predictions")
async def get_predictions(auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    predictions = []
    for filename in os.listdir(PREDICTIONS_DIR):
        if filename.endswith(".csv"):
            filepath = os.path.join(PREDICTIONS_DIR, filename)
            predictions.append({
                "filename": filename,
                "created_at": datetime.fromtimestamp(os.path.getctime(filepath)).isoformat(),
                "size": os.path.getsize(filepath)
            })
    
    return {"success": True, "predictions": predictions, "count": len(predictions)}

@app.get("/api/predictions/{filename}")
async def get_prediction(filename: str, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    filepath = os.path.join(PREDICTIONS_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="prediction not found")
    
    return FileResponse(filepath, media_type="text/csv", filename=filename)

@app.delete("/api/predictions/{filename}")
async def delete_prediction(filename: str, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    filepath = os.path.join(PREDICTIONS_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="prediction not found")
    
    # yeet it into the void
    try:
        os.remove(filepath)
        if os.path.exists(filepath):
            raise Exception("prediction file refuses to die")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"couldnt delete prediction: {str(e)}")
    
    return {"success": True, "message": f"prediction '{filename}' deleted permanently", "deleted": True}

# === ADMIN / CLEANUP ENDPOINTS ===

@app.post("/api/cleanup")
async def cleanup_all_data(auth: str = Header(None, alias="Authorization")):
    """nuclear option - delete EVERYTHING (use with caution)"""
    verify_auth(auth)
    
    deleted = {"cars": 0, "tracks": 0, "predictions": 0}
    errors = []
    
    # clean cars
    try:
        for filename in os.listdir(CARS_DIR):
            if filename.endswith(".json"):
                filepath = os.path.join(CARS_DIR, filename)
                os.remove(filepath)
                deleted["cars"] += 1
    except Exception as e:
        errors.append(f"cars cleanup error: {str(e)}")
    
    # clean tracks
    try:
        for filename in os.listdir(TRACKS_DIR):
            if filename.endswith(".csv"):
                filepath = os.path.join(TRACKS_DIR, filename)
                os.remove(filepath)
                deleted["tracks"] += 1
    except Exception as e:
        errors.append(f"tracks cleanup error: {str(e)}")
    
    # clean predictions
    try:
        for filename in os.listdir(PREDICTIONS_DIR):
            if filename.endswith(".csv"):
                filepath = os.path.join(PREDICTIONS_DIR, filename)
                os.remove(filepath)
                deleted["predictions"] += 1
    except Exception as e:
        errors.append(f"predictions cleanup error: {str(e)}")
    
    return {
        "success": len(errors) == 0,
        "message": "cleanup complete" if len(errors) == 0 else "cleanup had some issues",
        "deleted": deleted,
        "total_deleted": sum(deleted.values()),
        "errors": errors if errors else None
    }


# ==========================================
# PREDICTION ENDPOINTS
# ==========================================

class PredictionRequest(BaseModel):
    car_name: str
    track_name: str

class PredictionResponse(BaseModel):
    success: bool
    lap_time: float
    output_file: str
    message: str

@app.post("/api/predict")
async def predict_lap(request: PredictionRequest, auth: str = Header(None, alias="Authorization")):
    """
    run the lap prediction engine
    takes car and track names, runs simulation, returns lap time and telemetry file
    """
    verify_auth(auth)
    
    try:
        # check if engine is built
        if not is_engine_built():
            raise HTTPException(
                status_code=503,
                detail="prediction engine not built. run build.bat in backend/engine/ first"
            )
        
        # run prediction (this takes ~8+ seconds minimum)
        lap_time, output_file = run_prediction(
            car_name=request.car_name,
            track_name=request.track_name
        )
        
        return {
            "success": True,
            "lap_time": lap_time,
            "output_file": output_file,
            "message": f"prediction complete! lap time: {lap_time:.3f}s"
        }
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"prediction failed: {str(e)}")


@app.get("/api/predict/status")
async def prediction_status(auth: str = Header(None, alias="Authorization")):
    """check if the prediction engine is ready"""
    verify_auth(auth)
    
    engine_ready = is_engine_built()
    
    return {
        "engine_built": engine_ready,
        "ready": engine_ready,
        "message": "engine ready" if engine_ready else "engine not built - run build.bat"
    }


# run the thing
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
