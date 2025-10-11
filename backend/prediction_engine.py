"""
prediction engine integration
runs the C++ lap simulator and manages prediction workflow
"""

import subprocess
import os
import json
import time
import shutil
import pandas as pd
from datetime import datetime
from typing import Tuple, Optional

# paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.path.join(BASE_DIR, "engine")
ENGINE_EXE = os.path.join(ENGINE_DIR, "build", "lap_sim.exe")
ENGINE_OUTPUTS = os.path.join(ENGINE_DIR, "outputs")

CARS_DIR = os.path.join(BASE_DIR, "data", "cars")
TRACKS_DIR = os.path.join(BASE_DIR, "data", "tracks")
PREDICTIONS_DIR = os.path.join(BASE_DIR, "data", "predictions")

# make sure output dirs exist
os.makedirs(ENGINE_OUTPUTS, exist_ok=True)
os.makedirs(PREDICTIONS_DIR, exist_ok=True)


def is_engine_built() -> bool:
    """check if the C++ engine is built"""
    return os.path.exists(ENGINE_EXE)


def build_engine() -> bool:
    """try to build the engine (Windows only for now)"""
    try:
        build_script = os.path.join(ENGINE_DIR, "build.bat")
        if not os.path.exists(build_script):
            return False
        
        # run build script
        result = subprocess.run(
            [build_script],
            cwd=ENGINE_DIR,
            capture_output=True,
            encoding='utf-8',
            errors='ignore',
            timeout=180  # 3 minutes max
        )
        
        return result.returncode == 0 and is_engine_built()
    except Exception as e:
        print(f"build failed: {e}")
        return False


def convert_car_to_engine_format(car_data: dict) -> dict:
    """
    convert frontend car format to engine format
    frontend and engine use the same format, just validate it's present
    """
    # engine expects these keys
    required_keys = ["name", "mass", "aerodynamics", "tire", "powertrain", "brake"]
    for key in required_keys:
        if key not in car_data:
            raise ValueError(f"car data missing required key: {key}")
    
    return car_data


def run_prediction(car_name: str, track_name: str, progress_callback=None) -> Tuple[float, str]:
    """
    run the prediction engine
    returns: (lap_time_seconds, output_csv_path)
    """
    
    # check engine is built
    if not is_engine_built():
        # try to build it
        if not build_engine():
            raise Exception("engine not built. please run build.bat in backend/engine/")
    
    # load car and track (case-insensitive)
    car_filename = f"{car_name.replace(' ', '_')}.json"
    track_filename = f"{track_name.replace(' ', '_')}.csv"
    
    # find files case-insensitively
    car_file = None
    for f in os.listdir(CARS_DIR):
        if f.lower() == car_filename.lower():
            car_file = os.path.join(CARS_DIR, f)
            break
    
    track_file = None
    for f in os.listdir(TRACKS_DIR):
        if f.lower() == track_filename.lower():
            track_file = os.path.join(TRACKS_DIR, f)
            break
    
    if car_file is None or not os.path.exists(car_file):
        raise FileNotFoundError(f"car file not found: {car_filename}")
    if track_file is None or not os.path.exists(track_file):
        raise FileNotFoundError(f"track file not found: {track_filename}")
    
    # load car data
    with open(car_file, 'r') as f:
        car_data = json.load(f)
    
    # convert and validate car format
    engine_car_data = convert_car_to_engine_format(car_data)
    
    # create temporary car file in engine directory
    temp_car_file = os.path.join(ENGINE_DIR, "temp_car.json")
    with open(temp_car_file, 'w') as f:
        json.dump(engine_car_data, f, indent=2)
    
    # copy track to engine directory
    temp_track_file = os.path.join(ENGINE_DIR, "temp_track.csv")
    shutil.copy(track_file, temp_track_file)
    
    # simulate progress: minimum 8 seconds
    start_time = time.time()
    min_duration = 8.0
    
    # update progress: 0-20% (preparing)
    if progress_callback:
        progress_callback(0.10, "preparing simulation...")
        time.sleep(0.5)
        progress_callback(0.20, "loading vehicle data...")
        time.sleep(0.5)
    
    # run the engine
    try:
        # the engine expects: lap_sim.exe <track_csv> <vehicle_json>
        cmd = [ENGINE_EXE, temp_track_file, temp_car_file]
        
        if progress_callback:
            progress_callback(0.30, "running physics engine...")
        
        result = subprocess.run(
            cmd,
            cwd=ENGINE_DIR,
            capture_output=True,
            encoding='utf-8',
            errors='ignore',  # ignore unicode errors from box-drawing characters
            timeout=120  # 2 minutes max
        )
        
        if progress_callback:
            progress_callback(0.70, "processing results...")
            time.sleep(0.5)
        
        if result.returncode != 0:
            # show stderr for debugging
            error_msg = result.stderr if result.stderr else "unknown error"
            raise Exception(f"engine failed: {error_msg}")
        
        # debug: print engine output
        print(f"\n=== ENGINE OUTPUT ===")
        print(result.stdout if result.stdout else "(no output)")
        print(f"=== END OUTPUT ===\n")
        
        # parse output for lap time
        # the engine prints "OPTIMAL LAP TIME: XX.XXX seconds" in a box
        lap_time = None
        stdout_text = result.stdout if result.stdout else ""
        for line in stdout_text.split('\n'):
            # look for the line with "OPTIMAL LAP TIME:"
            if "OPTIMAL LAP TIME:" in line or "Optimal Lap Time:" in line:
                try:
                    # extract the number - format is "OPTIMAL LAP TIME: XX.XXX seconds"
                    # split by colon, take the part after, split by "seconds", take first part
                    after_colon = line.split(':')[-1]
                    time_str = after_colon.split('seconds')[0].strip()
                    lap_time = float(time_str)
                    break
                except Exception as e:
                    print(f"failed to parse lap time from line: {line}, error: {e}")
                    pass
        
        if lap_time is None:
            # show stdout for debugging
            print("engine stdout:", result.stdout)
            raise Exception("could not parse lap time from engine output")
        
        if progress_callback:
            progress_callback(0.85, "saving telemetry...")
            time.sleep(0.3)
        
        # find the output CSV (most recent file in outputs/)
        # engine saves to: outputs/CarName-TrackName-MM_SS-VSIM.csv
        if not os.path.exists(ENGINE_OUTPUTS):
            raise Exception(f"outputs directory not found: {ENGINE_OUTPUTS}")
        
        output_files = [f for f in os.listdir(ENGINE_OUTPUTS) if f.endswith('.csv') and 'VSIM' in f]
        if not output_files:
            # list what's in the directory for debugging
            all_files = os.listdir(ENGINE_OUTPUTS) if os.path.exists(ENGINE_OUTPUTS) else []
            raise Exception(f"no output CSV generated. Files in outputs/: {all_files}")
        
        # get most recent file (in case there are multiple)
        output_files.sort(key=lambda x: os.path.getmtime(os.path.join(ENGINE_OUTPUTS, x)), reverse=True)
        latest_output = output_files[0]
        
        # copy to predictions directory (keep original for debugging)
        # use timestamp to make filenames unique
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"{car_name}_{track_name}_{timestamp}.csv"
        final_output_path = os.path.join(PREDICTIONS_DIR, output_filename)
        
        shutil.copy(
            os.path.join(ENGINE_OUTPUTS, latest_output),
            final_output_path
        )
        
        # ensure minimum duration
        elapsed = time.time() - start_time
        if elapsed < min_duration:
            remaining = min_duration - elapsed
            if progress_callback:
                progress_callback(0.95, "finalizing...")
            time.sleep(remaining * 0.5)  # use half the remaining time
        
        if progress_callback:
            progress_callback(1.0, "prediction complete!")
        
        # cleanup temp files
        try:
            os.remove(temp_car_file)
            os.remove(temp_track_file)
        except:
            pass
        
        return lap_time, output_filename
        
    except subprocess.TimeoutExpired:
        raise Exception("prediction timed out (>60s)")
    except Exception as e:
        # cleanup temp files
        try:
            os.remove(temp_car_file)
            os.remove(temp_track_file)
        except:
            pass
        raise e


def get_prediction_csv(filename: str) -> pd.DataFrame:
    """load a prediction CSV as a pandas DataFrame"""
    filepath = os.path.join(PREDICTIONS_DIR, filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"prediction file not found: {filename}")
    return pd.read_csv(filepath)

