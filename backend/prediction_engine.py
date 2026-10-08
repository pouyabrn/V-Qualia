"""Structured, isolated integration with the pinned C++ lap engine."""
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
import time
from uuid import uuid4

BASE_DIR = Path(__file__).resolve().parent
ENGINE_DIR = Path(os.getenv('ENGINE_DIR', BASE_DIR / 'engine')).resolve()
DATA_DIR = Path(os.getenv('VQUALIA_DATA_DIR', BASE_DIR / 'data')).resolve()
CARS_DIR = DATA_DIR / 'cars'
TRACKS_DIR = DATA_DIR / 'tracks'
PREDICTIONS_DIR = DATA_DIR / 'predictions'
CACHE_DIR = DATA_DIR / 'line_cache'
_prediction_lock = threading.Lock()  # bound CPU/memory use; health checks remain responsive
for directory in (CARS_DIR, TRACKS_DIR, PREDICTIONS_DIR, CACHE_DIR):
    directory.mkdir(parents=True, exist_ok=True)

def get_engine_exe_path():
    candidates = [ENGINE_DIR / 'build' / 'Release' / 'lap_sim.exe',
                  ENGINE_DIR / 'build' / 'lap_sim.exe', ENGINE_DIR / 'build' / 'lap_sim']
    return str(next((p for p in candidates if p.is_file()), candidates[1 if os.name == 'nt' else 2]))

def is_engine_built():
    return Path(get_engine_exe_path()).is_file()

def engine_revision():
    manifest = ENGINE_DIR / 'UPSTREAM.json'
    return json.loads(manifest.read_text()) if manifest.exists() else {}

def build_engine():
    if is_engine_built():
        return True
    subprocess.run(['cmake', '-S', str(ENGINE_DIR), '-B', str(ENGINE_DIR / 'build'),
                    '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_TESTING=OFF'], check=True, timeout=180)
    subprocess.run(['cmake', '--build', str(ENGINE_DIR / 'build'), '--config', 'Release', '-j2'],
                   check=True, timeout=300)
    return is_engine_built()

def safe_filename(name):
    if not name or name in ('.', '..') or any(c in name for c in '/\\\x00'):
        raise ValueError('Invalid file name')
    return name

def _find_car_file(car_name):
    desired = safe_filename(car_name).replace(' ', '_').lower() + '.json'
    for path in sorted(CARS_DIR.glob('*.json')):
        if path.name.lower() == desired:
            return str(path)
    for path in sorted(CARS_DIR.glob('*.json')):
        try:
            if str(json.loads(path.read_text()).get('name', '')).casefold() == car_name.casefold():
                return str(path)
        except (ValueError, OSError):
            continue
    return None

def find_track_file(track_name):
    desired = safe_filename(track_name).replace(' ', '_').casefold() + '.csv'
    return next((p for p in sorted(TRACKS_DIR.glob('*.csv')) if p.name.casefold() == desired), None)

def run_prediction(car_name, track_name, options=None, progress_callback=None):
    options = options or {}
    if not is_engine_built():
        raise RuntimeError('Prediction engine has not been built')
    car_file, track_file = _find_car_file(car_name), find_track_file(track_name)
    if not car_file or not track_file:
        raise FileNotFoundError('Selected car or track was not found')
    # Validation is also enforced by C++ for callers outside the HTTP API.
    ds = float(options.get('resolution_m', 2))
    density = float(options.get('air_density', 1.225))
    grip = float(options.get('grip_scale', 1))
    if not (math.isfinite(ds) and .5 <= ds <= 5 and math.isfinite(density) and .5 <= density <= 2
            and math.isfinite(grip) and .3 <= grip <= 2):
        raise ValueError('Invalid resolution, air density or grip scale')
    prefix = re.sub(r'[^a-zA-Z0-9_-]', '_', f'{car_name}_{track_name}')[:90] + '_' + uuid4().hex[:12]
    files = {'telemetry_file': prefix + '.csv', 'summary_file': prefix + '.summary.json',
             'line_file': prefix + '.line.csv', 'ggv_file': None, 'ggv_metadata_file': None}
    if options.get('export_ggv', False):
        files['ggv_file'] = prefix + '.GGV.csv'
        files['ggv_metadata_file'] = files['ggv_file'] + '.meta.json'
    with _prediction_lock, tempfile.TemporaryDirectory(prefix='vqualia_') as temporary:
        work = Path(temporary)
        # Use the actual track path so DRS/elevation/banking sidecars are retained.
        cmd = [get_engine_exe_path(), str(track_file), car_file, '--quiet', '--no-output',
               '--ds', str(ds), '--air-density', str(density), '--mu-scale', str(grip),
               '--line', options.get('line_mode', 'mincurv'), '--line-cache',
               str(CACHE_DIR / (track_file.stem + '.cache')), '--csv', str(work / files['telemetry_file']),
               '--summary-json', str(work / files['summary_file']), '--line-csv', str(work / files['line_file'])]
        if not options.get('ers', True):
            cmd.append('--no-ers')
        if not options.get('drs', True):
            cmd.append('--no-drs')
        if files['ggv_file']:
            cmd.extend(['--ggv', str(work / files['ggv_file'])])
        started = time.perf_counter()
        result = subprocess.run(cmd, cwd=ENGINE_DIR, capture_output=True, text=True, errors='replace', timeout=120)
        if result.returncode:
            raise RuntimeError((result.stderr or result.stdout)[-2000:])
        summary = json.loads((work / files['summary_file']).read_text())
        if not summary.get('converged') or not math.isfinite(summary['lap_time_s']) or summary['lap_time_s'] <= 0:
            raise RuntimeError('Engine did not produce a converged, finite lap')
        budget = summary.get('ers_budget_mj')
        if budget is not None and summary.get('ers_energy_mj', 0) > budget + 1e-6:
            raise RuntimeError('Hybrid energy budget was exceeded')
        for filename in files.values():
            if filename:
                shutil.move(str(work / filename), PREDICTIONS_DIR / filename)
        return {'success': True, 'lap_time': summary['lap_time_s'], **files, 'summary': summary,
                'wall_ms': (time.perf_counter() - started) * 1000,
                'engine': engine_revision(), 'options': options, 'message': 'Prediction complete'}

def get_prediction_csv(filename):
    import pandas as pd
    return pd.read_csv(PREDICTIONS_DIR / safe_filename(filename))
