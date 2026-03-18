# V-Qualia

Professional telemetry analysis and lap-time prediction platform for racing data.

V-Qualia combines a React frontend, a FastAPI backend, and a bundled C++ lap simulation engine. You can upload telemetry CSVs, compare laps, inspect visualizations, manage car and track libraries, and generate predicted laps with exported telemetry and GGV outputs.

## What Is In This Repo

- `frontend/`: React + Vite application for analysis, comparison, prediction, live telemetry, and lap replay views.
- `backend/`: FastAPI API, local data storage, and Python wrapper around the engine.
- `backend/engine/`: bundled C++ lap simulation engine.
- `cars/`: root example car definitions that get seeded into backend storage.
- `backend/data/`: runtime car, track, and prediction files used by the API.

## Current Architecture

1. The frontend calls the FastAPI backend with a development auth token.
2. The backend stores cars, tracks, and generated prediction CSVs on disk.
3. When a prediction is requested, the backend prepares temporary engine inputs and runs the C++ executable.
4. The engine writes telemetry CSVs and, when available, a matching GGV CSV into `backend/engine/outputs/`.
5. The backend copies those outputs into `backend/data/predictions/` and returns the lap time plus downloadable filenames.

## Main Features

- Telemetry analysis from uploaded CSV files
- Multi-lap comparison
- Car library CRUD
- Track library upload/delete
- Physics-based lap prediction
- Downloadable predicted telemetry CSV
- Downloadable GGV CSV
- Live telemetry view
- Lap replay viewer

## Prediction Engine Notes

The current engine integration reflects the latest engine swap in the repo:

- The backend now resolves the engine path dynamically with `ENGINE_DIR` support.
- Unix builds use `backend/engine/build.sh`; Windows uses `build.bat`.
- `build.sh` prefers CMake and falls back to a direct `g++` build if CMake is unavailable.
- The Python wrapper now looks for both telemetry and GGV outputs and copies both into `backend/data/predictions/`.
- Example seeded cars now include newer variants such as:
  - `F1_2024_Normal`
  - `F1_2024_Monaco`
  - `F1_2024_Monza`
  - `F1_2025_Normal`
  - `F1_2025_Monaco`
  - `F1_2025_Monza`
  - `FSAE_RoadCourse`
  - `Honda_Civic_Si_2025`

## API Surface

Current backend routes in [`backend/main.py`](/home/pouee/V-Qualia/backend/main.py):

- `GET /`
- `GET /health`
- `GET /api/cars`
- `GET /api/cars/{car_name}`
- `POST /api/cars`
- `PUT /api/cars/{car_name}`
- `DELETE /api/cars/{car_name}`
- `GET /api/tracks`
- `GET /api/tracks/{track_name}`
- `POST /api/tracks/upload`
- `DELETE /api/tracks/{track_name}`
- `GET /api/predictions`
- `GET /api/predictions/{filename}`
- `DELETE /api/predictions/{filename}`
- `POST /api/cleanup`
- `POST /api/predict`
- `GET /api/predict/status`

Interactive docs are available at `http://localhost:10000/docs` when the backend is running.

## Local Development

### 1. Clone

```bash
git clone https://github.com/pouyabrn/V-Qualia.git
cd V-Qualia
```

### 2. Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Build the engine before using prediction:

```bash
cd engine
./build.sh
```

On Windows:

```bat
cd backend\engine
build.bat
```

Start the API:

```bash
cd /path/to/V-Qualia/backend
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 10000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` by default.

## Required Tooling

### Backend

- Python 3.10+
- `pip`

### Frontend

- Node.js 18+
- npm

### Engine

- C++17 compiler
- CMake 3.15+ for the standard build path
- On Linux/macOS, `build.sh` can also compile directly with `g++` if CMake is missing

## Environment

### Frontend

The frontend reads one Vite variable:

```env
VITE_API_URL=http://localhost:10000
```

If unset, it defaults to `http://localhost:10000`.

### Backend

No required backend env var is needed for normal local development.

Optional:

```env
ENGINE_DIR=/absolute/path/to/custom/engine
```

`ENGINE_DIR` is used in Docker and lets the Python wrapper locate the engine outside the default `backend/engine` path.

## Auth

Authentication is currently a development placeholder, not a production auth system.

- Backend expects the bearer token `ididntwriteauthsystemyetLOL`
- Frontend hardcodes the same token in [`frontend/src/utils/api.js`](/home/pouee/V-Qualia/frontend/src/utils/api.js)

If you are running the shipped frontend against the shipped backend locally, no extra setup is required.

## Data Layout

- [`backend/data/cars`](/home/pouee/V-Qualia/backend/data/cars): car JSON files served by the API
- [`backend/data/tracks`](/home/pouee/V-Qualia/backend/data/tracks): uploaded track CSV files
- [`backend/data/predictions`](/home/pouee/V-Qualia/backend/data/predictions): copied prediction outputs returned to the UI
- [`backend/engine/outputs`](/home/pouee/V-Qualia/backend/engine/outputs): raw engine outputs

At startup, the backend seeds missing car files from:

- [`cars`](/home/pouee/V-Qualia/cars)
- [`backend/engine/examples`](/home/pouee/V-Qualia/backend/engine/examples)

## Track Format

The prediction engine expects the TUMFTM racetrack CSV layout:

```text
# x_m,y_m,w_tr_right_m,w_tr_left_m
```

Track data used in this project is sourced from the TUMFTM racetrack database:

- https://github.com/TUMFTM/racetrack-database

## Docker

The repository includes a multi-service Docker setup in [`docker-compose.yml`](/home/pouee/V-Qualia/docker-compose.yml).

Start everything with:

```bash
docker compose up --build
```

Services:

- Frontend on `http://localhost:3000`
- Backend on `http://localhost:10000`
- Optional standalone engine service via the `engine-only` profile

The backend container sets:

```env
PYTHONPATH=/app
ENGINE_DIR=/app/engine
```

and mounts persistent volumes for:

- `backend/data/cars`
- `backend/data/tracks`
- `backend/data/predictions`
- `f1_cache`

## Prediction Workflow Summary

1. Build the engine once.
2. Start the backend and frontend.
3. Add or select a car.
4. Upload or select a track.
5. Run prediction from the Predict page.
6. Download the generated telemetry CSV and optional GGV CSV.
7. Open the predicted telemetry in the lap replay viewer if desired.

## Known Gaps

- Auth is placeholder-only.
- `backend/test_api.py` is still a legacy script and does not reflect the current `/api/*` routes.
- This repo is strongest as a development/workbench environment; it still needs cleanup before claiming production readiness.

## Acknowledgments

Prediction engine inspiration and track format references:

- TUMFTM Global Race Trajectory Optimization:
  https://github.com/TUMFTM/global_racetrajectory_optimization
- TUMFTM Lap Time Simulation:
  https://github.com/TUMFTM/laptime-simulation
- TUMFTM Racetrack Database:
  https://github.com/TUMFTM/racetrack-database

Related engine repo:

- V-Qualia Lap Prediction Engine:
  https://github.com/pouyabrn/LapPredictionEngine

## Screenshots

<img width="1864" height="939" alt="screencapture-v-qualia-frontend-onrender-2025-10-20-16_40_89" src="https://github.com/user-attachments/assets/bd5994ed-106a-4386-bf8d-b7fa0b03e456" />
<img width="1920" height="2805" alt="screencapture-v-qualia-frontend-onrender-2025-10-20-16_40_59" src="https://github.com/user-attachments/assets/d362077a-2b30-4ba3-bbdb-11a6531cd907" />
<img width="1920" height="6730" alt="screencapture-v-qualia-frontend-onrender-2025-10-20-16_37_36" src="https://github.com/user-attachments/assets/85542967-3ef9-4eb3-abdd-705c3c7451c9" />
<img width="1920" height="6468" alt="screencapture-v-qualia-frontend-onrender-2025-10-20-16_38_15" src="https://github.com/user-attachments/assets/91b400af-5e41-48cf-82bc-e0ced7fd1a42" />
<img width="1920" height="1456" alt="screencapture-v-qualia-frontend-onrender-2025-10-20-16_39_44" src="https://github.com/user-attachments/assets/eb0bc840-3532-4f24-ba63-95eb50929a97" />
<img width="1920" height="1536" alt="screencapture-v-qualia-frontend-onrender-2025-10-20-16_40_02" src="https://github.com/user-attachments/assets/7e9eee1c-709b-47f8-877a-e53dcef5fcb1" />
