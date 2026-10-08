# Workspace update — 2026-10-08

Bundled engine: `0d4c161054643f08eac32faed7d0867f675c980c` from LapPredictionEngine.

The prediction wrapper now uses structured JSON, explicit output paths and isolated temporary storage. It preserves DRS, elevation and banking sidecars, removes artificial waits, verifies convergence/energy feasibility, and queues CPU-heavy work in a worker thread. A track cache avoids rebuilding unchanged geometry across executable runs. It does not retain the C++ solver in memory; upstream library timings are distinct from API timings.

The interface uses a left navigation panel and compact setup controls. Physical traces have units, equations and restrained grids. Axle loads, grip use and hybrid deployment replace unsupported driver scores and decorative gear charts. Lap comparison uses common distance coordinates and elapsed-time delta. Replay is embedded with an optional pop-out, follows timestamps and shows the closing lap segment. Circuit filling uses the requested muted blue/cyan colours, during solves and at actual progress during replay. The GGV has a rotatable orthographic 3D acceleration/braking surface with physical axis ticks and feasibility filtering; full-resolution 2D slices remain for precise readings. Its renderer redraws only on data, view or size changes.

Unused marketing pages, duplicate replay code, stale sample output, dead helpers and a duplicate root C++ file were removed. Rewritten pages no longer need Tailwind. Routes load on demand. The backend runtime image excludes compilers and unused FastF1/plotting packages; the engine builds with Release optimization and without validation targets. The original shared development-token access model remains.

Validation:

- Upstream: 7/7 CTest suites after the closing-segment fix; 27 official F1/F2 reference laps and 110 numerical car/track/resolution cases are documented upstream.
- Frontend: six tests for CSV normalization, finite values, time weighting, energy integration, distance alignment and extrema retention; lint and production build pass.
- Backend: five integration suites pass using the actual C++ executable and disposable storage. Includes five families on five circuits, complete-lap CSV/summary consistency, GGV metadata, simultaneous requests, advanced-field preservation and malformed-input rejection.
- npm audit: zero reported vulnerabilities after dependency cleanup and the Vite update.
- [Local API measurements](integration_results.json): cold geometry preparation, default 1.225 kg/m³ density, 2 m resolution, export included. These are numerical predictions, not matched measured-lap validation.

Local C++ builds were tested with GCC/WSL. A native MSVC build was not tested. Docker Desktop was not running locally, so no complete local container build was run. Both GitHub CI jobs passed, and the existing Render backend served the pinned engine and new application revision. The deployed frontend produced telemetry and a GGV map through the public API; the 3D map and inline replay were inspected in the browser. The 3D view also exports its current projection as a PNG with physical axis labels.

Deployed numerical checks are recorded in [deployment_results.json](deployment_results.json). Hosted cold geometry preparation is much slower than a prepared library solve. For example, the first Monza prediction took about 13 s on the shared service; a cached repeat with GGV export took about 0.94 s. These are web service measurements, not real-time library guarantees.
