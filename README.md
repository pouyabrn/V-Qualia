# V-Qualia

A vehicle dynamics workspace. Give it a car and a circuit, predict a lap, then inspect the result against measured telemetry.

This is an instrument console: setup on the left, physical channels in the workspace, units on plots, and equations where they help. The interface uses an alien-tech direction with ice-silver traces and restrained signal-red accents. No marketing homepage, fake prediction progress, or invented driver scores.

## What it does

- C++ lap prediction with selectable resolution, grip, air density, racing line, DRS and ERS.
- Simulated telemetry: speed, controls, acceleration, axle loads, tire usage, geometry and hybrid deployment.
- Lap replay inside the workspace, with an optional separate window. Playback follows timestamps.
- Circuit-filling animation during a solve, using soft blue/cyan tones. Replay fills the circuit with actual lap progress.
- Rotatable 3D GGV acceleration/braking surfaces with PNG export, alongside velocity slices and straight-line envelopes, with feasibility flags and ERS/DRS conditions.
- Measured or simulated CSV inspection and distance-aligned lap comparison, including elapsed-time delta.
- Comparison exposes every available numeric telemetry channel, including custom columns, with overlays and differences against the reference lap.
- A place-by-place comparison map overlays the racing lines. Select a physical station, zoom into local lines, and inspect channel values, differences, elapsed-time delta and lateral offsets. Matching uses a transverse gate through the reference heading; distant/opposite-direction crossings remain unavailable.
- Chart laboratory: import arbitrary numeric CSV without requiring speed, create line/step/XY-scatter charts, choose up to eight channels and two Y axes, set labels/units/ranges, and save/load layouts. Imported files stay in the browser. Derived signals support gain/offset, arithmetic, derivatives and trapezoidal integrals; exported CSV includes the derived signals.
- Replay shows instantaneous throttle and brake demand bars at the playback cursor. Missing control channels are labelled unavailable.
- Vehicle and circuit libraries. Vehicle editing preserves advanced engine parameters.

Plots use thin traces, restrained grids and explicit units. Missing channels are omitted. Time-weighted statistics use the complete dataset; plot reduction retains local extrema. Comparison interpolates at shared arc distance, which can still differ from identical physical position when driven lines differ. Use the spatial map when positions share an origin and metre scale. It does not register unrelated coordinate frames or guarantee matching through complex crossings. Saved chart layouts contain settings; the source CSV remains local and must be loaded again after refreshing.

The live page is explicitly a **synthetic 10 Hz demonstration**. It has no connected vehicle feed.

## Engine and real-time direction

The bundled [LapPredictionEngine](https://github.com/pouyabrn/LapPredictionEngine) is pinned in `backend/engine/UPSTREAM.json`. It targets real-time agents and repeated engineering calculations on a small CPU budget. It has no GPU dependency.

The C++ library reuses prepared geometry, tire/force tables and a checked hybrid warm start. On the validation CPU, prepared F1 solves at 2 m take about 6.5 ms, while changing a hybrid setup takes about 20 ms. These are library measurements, not web request times or a guarantee for low-power hardware. The web API launches the executable and exports files; it caches racing lines between requests, but does not keep the C++ solver alive.

See the upstream [accuracy and runtime report](https://github.com/pouyabrn/LapPredictionEngine/blob/main/validation/REVIEW_REPORT.md): five car families, eleven circuits, two resolutions, and 27 official F1/F2 qualifying laps. A close lap time can conceal significant corner-speed errors. Civic Si and Formula Student still need matched measured laps. The minimum-curvature line is not guaranteed to be the fastest line.

## Run locally

Requires Node 22+, Python 3.11+ and a C++17 compiler with CMake.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cmake -S engine -B engine/build -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF
cmake --build engine/build -j2
uvicorn main:app --host 127.0.0.1 --port 10000
```

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api` to port 10000. On Windows, activate `.venv\Scripts\Activate.ps1`, build with `--config Release`, and use the executable under `engine/build/Release/`.

For Docker:

```bash
docker compose up --build -d
```

The backend image builds the engine in Release mode and carries only the executable and example inputs into its runtime stage. It omits compilers, validation executables and unused FastF1/plotting dependencies. Production Uvicorn runs without reload. The nginx proxy retains the `/api` prefix.

## Deployment

Existing services: [workspace](https://v-qualia-frontend.onrender.com/) and [API health](https://v-qualia-backend.onrender.com/health).

For the existing Render frontend, build from `frontend` with `npm ci && npm run build`, publish `dist`, and set `VITE_API_URL=https://v-qualia-backend.onrender.com`. The backend builds `backend/Dockerfile` with `backend` as its context, listens on port 10000 and exposes `/health`. A same-origin nginx deployment can leave `VITE_API_URL` unset. Static hosting must return `index.html` for application routes; the workspace uses hash routes.

`VQUALIA_DATA_DIR` selects persistent backend storage. `ENGINE_DIR` overrides the engine location. Existing custom cars/tracks are preserved; missing examples are seeded. Sidecars are seeded for matching bundled geometry. An untouched old Civic preset is migrated to FWD.

The existing development token remains a shared placeholder, not account authentication. Keep deployment access and stored telemetry appropriate to that existing access model.

## API outputs

`POST /api/predict` accepts `car_name`, `track_name` and optional `resolution_m`, `air_density`, `grip_scale`, `line_mode` (`mincurv` or `center`), `ers`, `drs`, and `export_ggv`.

It returns lap time, the full structured summary, engine revision, wall time and filenames for telemetry, racing line and summary. GGV and its conditions JSON are optional. Downloads use `GET /api/predictions/{filename}`. The request preserves track sidecars and uses unique outputs; CPU-heavy predictions are serialized in a worker thread so health and library reads remain responsive.

GGV is instantaneous flat-road capability. It can include peak ERS but does not apply the lap energy budget. Net ERS in the summary and gross deployed energy integrated from telemetry are different quantities. CSV/JSON exports include the closing lap segment, so their duration agrees with the summary.

API documentation: `http://localhost:10000/docs`.

## Verify or update the engine

```bash
cd frontend
npm test
npm run lint
npm run build
cd ../backend
pip install -r requirements-dev.txt
python test_integration.py -v
```

The integration tests use disposable storage and the actual C++ executable. They cover five car families across five circuits, complete-lap exports, GGV metadata, concurrent output isolation, track parsing, invalid input and advanced vehicle editing. [Recorded local runs](docs/integration_results.json) are predictions with default air density, not additional real-world accuracy evidence. GitHub Actions runs the frontend and integration checks.

To vendor a reviewed upstream revision:

```bash
python scripts/sync_engine.py ../LapPredictionEngine
```

Rebuild the executable and rerun the tests. The sync records the source commit and prunes obsolete tracked engine files; it leaves builds and runtime data alone.
