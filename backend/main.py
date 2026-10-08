from fastapi import FastAPI, HTTPException, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import uvicorn
import os
import json
import shutil
import pandas as pd
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
import asyncio
from prediction_engine import (run_prediction, is_engine_built, engine_revision,
                               safe_filename, _find_car_file, find_track_file)
import numpy as np

# yeah we just pretend auth exists for now lol
PLACEHOLDER_AUTH = "ididntwriteauthsystemyetLOL"

# setup data directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
DATA_DIR = os.getenv("VQUALIA_DATA_DIR", os.path.join(BASE_DIR, "data"))
CARS_DIR = os.path.join(DATA_DIR, "cars")
TRACKS_DIR = os.path.join(DATA_DIR, "tracks")
PREDICTIONS_DIR = os.path.join(DATA_DIR, "predictions")
ROOT_CARS_DIR = os.path.join(ROOT_DIR, "cars")
ENGINE_EXAMPLES_DIR = os.path.join(BASE_DIR, "engine", "examples")

# make sure directories exist
for directory in [DATA_DIR, CARS_DIR, TRACKS_DIR, PREDICTIONS_DIR]:
    os.makedirs(directory, exist_ok=True)


def _load_car_name(filepath: str) -> str:
    """Read the car display name from JSON, falling back to filename stem."""
    try:
        with open(filepath, "r") as f:
            data = json.load(f)
        if isinstance(data, dict) and data.get("name"):
            return str(data["name"])
    except Exception:
        pass
    return os.path.splitext(os.path.basename(filepath))[0]


def seed_example_cars() -> None:
    """Seed API car storage from root cars dir and engine examples when files are missing."""

    existing_names = set()
    for filename in sorted(os.listdir(CARS_DIR)):
        if filename.endswith(".json"):
            existing_names.add(_load_car_name(os.path.join(CARS_DIR, filename)).lower())

    source_dirs = [ROOT_CARS_DIR, ENGINE_EXAMPLES_DIR]
    for source_dir in source_dirs:
        if not os.path.isdir(source_dir):
            continue

        for filename in os.listdir(source_dir):
            if not filename.endswith(".json"):
                continue
            source_path = os.path.join(source_dir, filename)
            target_path = os.path.join(CARS_DIR, filename)
            source_name = _load_car_name(source_path).lower()

            # Skip duplicate display names to prevent duplicate entries in the UI.
            if source_name in existing_names and not os.path.exists(target_path):
                continue

            if not os.path.exists(target_path):
                shutil.copy2(source_path, target_path)
                existing_names.add(source_name)


seed_example_cars()

# Repair the old untouched Civic example while respecting customized vehicles.
default_civic_path = os.path.join(ENGINE_EXAMPLES_DIR, 'honda_civic_si_2025.json')
with open(default_civic_path) as civic_source:
    default_civic = json.load(civic_source)
old_civic = json.loads(json.dumps(default_civic))
old_civic['powertrain'].pop('drive', None)
for filename in os.listdir(CARS_DIR):
    if filename.endswith('.json'):
        path = os.path.join(CARS_DIR, filename)
        with open(path) as source:
            stored = json.load(source)
        comparable = {k: v for k, v in stored.items() if k not in ('created_at', 'updated_at', 'id')}
        if comparable == old_civic:
            stored['powertrain']['drive'] = 'FWD'
            with open(path, 'w') as destination:
                json.dump(stored, destination, indent=2)

# Track metadata belongs beside its CSV. Never replace an existing user's track.
for filename in os.listdir(ENGINE_EXAMPLES_DIR):
    parts = filename.split('.')
    geometry_name = parts[0] + '.csv'
    geometry_path = os.path.join(TRACKS_DIR, geometry_name)
    geometry_matches = True
    if len(parts) > 2 and os.path.exists(geometry_path):
        with open(geometry_path) as stored, open(os.path.join(ENGINE_EXAMPLES_DIR, geometry_name)) as bundled:
            geometry_matches = stored.read().strip() == bundled.read().strip()
    if filename.endswith('.csv') and geometry_matches and not os.path.exists(os.path.join(TRACKS_DIR, filename)):
        shutil.copy2(os.path.join(ENGINE_EXAMPLES_DIR, filename), os.path.join(TRACKS_DIR, filename))

def read_track(filepath):
    rows = pd.read_csv(filepath, comment='#', header=None)
    if str(rows.iloc[0, 0]).strip().lower() == 'x_m' and str(rows.iloc[0, 1]).strip().lower() == 'y_m':
        rows = rows.iloc[1:]
    numeric = rows.apply(pd.to_numeric, errors='coerce')
    if numeric.shape[1] != 4 or len(numeric) < 3 or not np.isfinite(numeric.to_numpy()).all():
        raise ValueError('Track needs finite x, y, right-width, left-width columns')
    numeric.columns = ['x_m', 'y_m', 'w_tr_right_m', 'w_tr_left_m']
    xy = numeric[['x_m', 'y_m']].to_numpy()
    length = float(np.linalg.norm(np.diff(xy, axis=0), axis=1).sum() + np.linalg.norm(xy[-1] - xy[0]))
    return numeric, length

app = FastAPI(
    title="V-Qualia API",
    description="Backend for V-Qualia telemetry platform",
    version="2.0.0"
)

# let frontend talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# models for request/response
# nested car config models for prediction engine format
class EngineConfig(BaseModel):
    model_config = ConfigDict(extra='allow')

class MassConfig(EngineConfig):
    mass: float
    cog_height: float
    wheelbase: float
    weight_distribution: float

class AerodynamicsConfig(EngineConfig):
    Cl: Optional[float] = None
    Cd: Optional[float] = None
    frontal_area: float
    air_density: float

class TireConfig(EngineConfig):
    mu_x: float
    mu_y: float
    load_sensitivity: float
    tire_radius: float

class PowertrainConfig(EngineConfig):
    engine_torque_curve: dict
    gear_ratios: List[float]
    final_drive: float
    efficiency: float
    max_rpm: float
    min_rpm: float

class BrakeConfig(EngineConfig):
    max_brake_force: float
    brake_bias: float

class CarConfig(EngineConfig):
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
    return {"status": "healthy", "timestamp": datetime.now().isoformat(), "engine": engine_revision(),
            "deployment_commit": os.getenv('RENDER_GIT_COMMIT')}

# === CAR ENDPOINTS ===

@app.get("/api/cars")
async def get_cars(auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    cars_by_name = {}
    for filename in os.listdir(CARS_DIR):
        if filename.endswith(".json"):
            with open(os.path.join(CARS_DIR, filename), "r") as f:
                car_data = json.load(f)
                car_name = car_data.get("name", filename.replace(".json", ""))
                if car_name not in cars_by_name:
                    cars_by_name[car_name] = car_data

    cars = list(cars_by_name.values())
    return {"success": True, "cars": cars, "count": len(cars)}

@app.get("/api/cars/{car_name}")
async def get_car(car_name: str, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    # replace spaces with underscores for filename
    filepath = _find_car_file(car_name)
    
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"car '{car_name}' not found")
    
    with open(filepath, "r") as f:
        car_data = json.load(f)
    
    return {"success": True, "car": car_data}

@app.post("/api/cars")
async def create_car(car: CarConfig, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    # save as json file (use 'name' field now)
    filename = f"{safe_filename(car.name).replace(' ', '_')}.json"
    filepath = os.path.join(CARS_DIR, filename)
    
    # check if car already exists
    if _find_car_file(car.name):
        raise HTTPException(status_code=400, detail=f"car '{car.name}' already exists")
    
    car_data = car.model_dump(exclude_none=True)
    car_data["created_at"] = datetime.now().isoformat()
    car_data["updated_at"] = datetime.now().isoformat()
    
    with open(filepath, "w") as f:
        json.dump(car_data, f, indent=2)
    
    return {"success": True, "message": f"car '{car.name}' created", "car": car_data}

@app.put("/api/cars/{car_name}")
async def update_car(car_name: str, car: CarConfig, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    filepath = _find_car_file(car_name)
    
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"car '{car_name}' not found")
    
    # load existing data to keep created_at
    with open(filepath, "r") as f:
        existing_data = json.load(f)
    
    car_data = car.model_dump(exclude_none=True)
    car_data["created_at"] = existing_data.get("created_at", datetime.now().isoformat())
    car_data["updated_at"] = datetime.now().isoformat()
    
    with open(filepath, "w") as f:
        json.dump(car_data, f, indent=2)
    
    return {"success": True, "message": f"car '{car_name}' updated", "car": car_data}

@app.delete("/api/cars/{car_name}")
async def delete_car(car_name: str, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    filepath = _find_car_file(car_name)
    
    if not filepath or not os.path.exists(filepath):
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
    for filename in sorted(os.listdir(TRACKS_DIR)):
        if filename.endswith(".csv") and not filename.endswith(('.drs.csv', '.elevation.csv', '.banking.csv')):
            filepath = os.path.join(TRACKS_DIR, filename)
            track_name = filename.replace(".csv", "").replace("_", " ")
            
            # read csv to get some basic info
            try:
                df, length = read_track(filepath)
                track_info = {
                    "name": track_name,  # unified format: use 'name' not 'track_name'
                    "track_name": track_name,
                    "filename": filename,
                    "length": length,
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
    
    filepath = find_track_file(track_name)
    
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"track '{track_name}' not found")
    
    # read and return csv data
    df, length = read_track(filepath)
    
    return {
        "success": True,
        "name": track_name,  # unified format: use 'name' not 'track_name'
        "data": df.to_dict(orient='records'),
        "columns": list(df.columns),
        "length": length,
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
    
    filename = f"{safe_filename(track_name).replace(' ', '_')}.csv"
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
        df, length = read_track(filepath)
        track_info = {
            "track_name": track_name,
            "filename": filename,
            "length": length,
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
    
    filepath = find_track_file(track_name)
    
    if not filepath or not os.path.exists(filepath):
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
        if filename.endswith(".csv") and not filename.endswith(('.GGV.csv', '.line.csv', '-GGV.csv')):
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
    
    filepath = os.path.join(PREDICTIONS_DIR, safe_filename(filename))
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="prediction not found")
    
    return FileResponse(filepath, media_type="application/json" if filename.endswith('.json') else "text/csv", filename=filename)

@app.delete("/api/predictions/{filename}")
async def delete_prediction(filename: str, auth: str = Header(None, alias="Authorization")):
    verify_auth(auth)
    
    filepath = os.path.join(PREDICTIONS_DIR, safe_filename(filename))
    
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
    resolution_m: float = Field(default=2, ge=.5, le=5)
    air_density: float = Field(default=1.225, ge=.5, le=2)
    grip_scale: float = Field(default=1, ge=.3, le=2)
    ers: bool = True
    drs: bool = True
    export_ggv: bool = False
    line_mode: str = Field(default='mincurv', pattern='^(mincurv|center)$')

class PredictionResponse(BaseModel):
    success: bool
    lap_time: float
    telemetry_file: str
    ggv_file: Optional[str] = None
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
                detail="prediction engine not built. run ./build.sh (Linux/macOS) or build.bat (Windows) in backend/engine/ first"
            )
        
        result = await asyncio.to_thread(
            run_prediction, request.car_name, request.track_name,
            request.model_dump(exclude={'car_name', 'track_name'})
        )
        return result
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
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
        "engine": engine_revision(),
        "message": "engine ready" if engine_ready else "engine not built - run ./build.sh or build.bat"
    }


# run the thing
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=10000,
        reload=False
    )
