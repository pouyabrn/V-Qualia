"""
prediction engine integration
runs the C++ lap simulator and manages prediction workflow
"""

import subprocess
import os
import json
import time
import shutil
import re
import pandas as pd
from datetime import datetime
from typing import Tuple, Optional

# paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.getenv("ENGINE_DIR", os.path.join(BASE_DIR, "engine"))
ENGINE_OUTPUTS = os.path.join(ENGINE_DIR, "outputs")

# Determine the correct executable name (lap_sim on Linux, lap_sim.exe on Windows)
def get_engine_exe_path() -> str:
    """Get the correct engine executable path for the current platform"""
    lap_sim_unix = os.path.join(ENGINE_DIR, "build", "lap_sim")
    lap_sim_windows = os.path.join(ENGINE_DIR, "build", "lap_sim.exe")

    # Check for Windows executable first (more specific), then Unix
    if os.path.exists(lap_sim_windows):
        return lap_sim_windows
    elif os.path.exists(lap_sim_unix):
        return lap_sim_unix
    else:
        # Default to platform-appropriate path for clearer error messages
        return lap_sim_windows if os.name == "nt" else lap_sim_unix

CARS_DIR = os.path.join(BASE_DIR, "data", "cars")
TRACKS_DIR = os.path.join(BASE_DIR, "data", "tracks")
PREDICTIONS_DIR = os.path.join(BASE_DIR, "data", "predictions")

# make sure output dirs exist
os.makedirs(ENGINE_OUTPUTS, exist_ok=True)
os.makedirs(PREDICTIONS_DIR, exist_ok=True)


def is_engine_built() -> bool:
    """check if the C++ engine is built"""
    return os.path.exists(get_engine_exe_path())


def _run_command(cmd: list, cwd: str, timeout: int) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        encoding='utf-8',
        errors='ignore',
        timeout=timeout
    )


def build_engine() -> bool:
    """try to build the engine using cmake with platform script fallback"""
    if is_engine_built():
        return True

    try:
        build_dir = os.path.join(ENGINE_DIR, "build")
        os.makedirs(build_dir, exist_ok=True)

        configure = _run_command(["cmake", ".."], cwd=build_dir, timeout=180)
        if configure.returncode == 0:
            build = _run_command(["cmake", "--build", ".", "--config", "Release", "-j"], cwd=build_dir, timeout=300)
            if build.returncode == 0 and is_engine_built():
                return True
            print(f"cmake build failed: {build.stderr or build.stdout}")
        else:
            print(f"cmake configure failed: {configure.stderr or configure.stdout}")
    except Exception as e:
        print(f"cmake build failed: {e}")

    try:
        if os.name == "nt":
            build_script = os.path.join(ENGINE_DIR, "build.bat")
            if os.path.exists(build_script):
                result = _run_command(["cmd", "/c", build_script], cwd=ENGINE_DIR, timeout=300)
                if result.returncode == 0 and is_engine_built():
                    return True
                print(f"build.bat failed: {result.stderr or result.stdout}")
        else:
            build_script = os.path.join(ENGINE_DIR, "build.sh")
            if os.path.exists(build_script):
                result = _run_command(["bash", build_script], cwd=ENGINE_DIR, timeout=300)
                if result.returncode == 0 and is_engine_built():
                    return True
                print(f"build.sh failed: {result.stderr or result.stdout}")
    except Exception as e:
        print(f"script build failed: {e}")

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


def _find_car_file(car_name: str) -> Optional[str]:
    """Find car JSON by filename first, then by internal JSON 'name' field."""
    desired_filename = f"{car_name.replace(' ', '_')}.json".lower()
    for filename in os.listdir(CARS_DIR):
        if filename.lower() == desired_filename:
            return os.path.join(CARS_DIR, filename)

    target_name = car_name.strip().lower()
    for filename in os.listdir(CARS_DIR):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(CARS_DIR, filename)
        try:
            with open(filepath, "r") as f:
                data = json.load(f)
            file_car_name = str(data.get("name", "")).strip().lower()
            if file_car_name == target_name:
                return filepath
        except Exception:
            continue

    return None


def run_prediction(car_name: str, track_name: str, progress_callback=None) -> Tuple[float, str, Optional[str]]:
    """
    run the prediction engine
    returns: (lap_time_seconds, telemetry_filename, ggv_filename)
    """
    
    # check engine is built
    if not is_engine_built():
        # try to build it
        if not build_engine():
            raise Exception("engine not built. run ./build.sh (Linux/macOS) or build.bat (Windows) in backend/engine/")

    engine_exe = get_engine_exe_path()
    
    # load car and track (case-insensitive)
    car_filename = f"{car_name.replace(' ', '_')}.json"
    track_filename = f"{track_name.replace(' ', '_')}.csv"
    
    # find files case-insensitively
    car_file = _find_car_file(car_name)
    
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
    existing_output_files = set(
        f for f in os.listdir(ENGINE_OUTPUTS)
        if f.endswith('.csv') and 'VSIM' in f
    ) if os.path.exists(ENGINE_OUTPUTS) else set()
    
    # update progress: 0-20% (preparing)
    if progress_callback:
        progress_callback(0.10, "preparing simulation...")
        time.sleep(0.5)
        progress_callback(0.20, "loading vehicle data...")
        time.sleep(0.5)
    
    # run the engine
    try:
        # the engine expects: lap_sim.exe <track_csv> <vehicle_json>
        cmd = [engine_exe, temp_track_file, temp_car_file]
        
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
        lap_time_match = re.search(
            r"OPTIMAL\s+LAP\s+TIME:\s*([0-9]+(?:\.[0-9]+)?)\s*seconds",
            stdout_text,
            flags=re.IGNORECASE
        )
        if lap_time_match:
            lap_time = float(lap_time_match.group(1))
        
        if lap_time is None:
            # show stdout for debugging
            print("engine stdout:", result.stdout)
            raise Exception("could not parse lap time from engine output")
        
        if progress_callback:
            progress_callback(0.85, "saving telemetry...")
            time.sleep(0.3)
        
        # find the output CSV files (telemetry and GGV)
        # engine saves to: outputs/CarName-TrackName-MM_SS-VSIM.csv
        # and: outputs/CarName-TrackName-MM_SS-VSIM-GGV.csv
        if not os.path.exists(ENGINE_OUTPUTS):
            raise Exception(f"outputs directory not found: {ENGINE_OUTPUTS}")

        # get all recent VSIM files
        all_files = [f for f in os.listdir(ENGINE_OUTPUTS) if f.endswith('.csv') and 'VSIM' in f]
        if not all_files:
            # list what's in the directory for debugging
            all_files = os.listdir(ENGINE_OUTPUTS) if os.path.exists(ENGINE_OUTPUTS) else []
            raise Exception(f"no output CSV generated. Files in outputs/: {all_files}")

        # Prefer files generated by this run to avoid stale-output mismatches.
        new_files = [f for f in all_files if f not in existing_output_files]
        candidate_files = new_files if new_files else all_files
        candidate_files.sort(key=lambda x: os.path.getmtime(os.path.join(ENGINE_OUTPUTS, x)), reverse=True)

        # find telemetry and GGV files
        telemetry_file = None
        ggv_file = None

        for filename in candidate_files:
            if 'GGV' in filename and ggv_file is None:
                ggv_file = filename
            elif 'GGV' not in filename and telemetry_file is None:
                telemetry_file = filename

        if not telemetry_file:
            raise Exception(f"telemetry CSV not found. Available files: {candidate_files}")

        # copy to predictions directory (keep original for debugging)
        # use timestamp to make filenames unique
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # copy telemetry file
        telemetry_filename = f"{car_name}_{track_name}_{timestamp}.csv"
        telemetry_path = os.path.join(PREDICTIONS_DIR, telemetry_filename)
        shutil.copy(
            os.path.join(ENGINE_OUTPUTS, telemetry_file),
            telemetry_path
        )

        # copy GGV file if it exists
        ggv_filename = None
        if ggv_file:
            ggv_filename = f"{car_name}_{track_name}_{timestamp}_GGV.csv"
            ggv_path = os.path.join(PREDICTIONS_DIR, ggv_filename)
            shutil.copy(
                os.path.join(ENGINE_OUTPUTS, ggv_file),
                ggv_path
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
        
        return lap_time, telemetry_filename, ggv_filename
        
    except subprocess.TimeoutExpired:
        raise Exception("prediction timed out (>120s)")
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
