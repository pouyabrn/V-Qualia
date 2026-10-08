# Lap engine review and validation — 2026-10-08

The incoming optimization is useful, but several correctness and reproducibility problems needed repairs. The revised engine passes seven test suites and 110 numerical car/track/resolution combinations. It was compared with 27 official F1/F2 qualifying laps. It is suitable for interactive lap prediction with prepared geometry; hardware-specific timing checks are still necessary for low-power or hard real-time use.

## What was reviewed

Baseline: [d69e258253653bcc39224534282ae0a603326ff7](https://github.com/pouyabrn/LapPredictionEngine/tree/d69e258253653bcc39224534282ae0a603326ff7). A fresh original binary was built from 21 source/header files verified against this commit. The local incoming implementation was built separately before repairs. No original or incoming results in the comparison below were invented or substituted for measured runs.

Kept: the RK2 forward/backward solver, axle load transfer, tire load sensitivity, wheel inertia, DRS/ERS support, minimum-curvature racing line, track sidecars, force lookup tables and the existing F1 parameter fit. Those parts provide useful functionality and speed.

## Repairs

- Corrected the Civic Si preset to front-wheel drive; omitted drive type had selected rear-wheel drive.
- Conserved total axle load during wheel lift. Clamping both axles independently had created extra tire load.
- Fixed force-table gear selection near the limiter; checked 80,000 speeds and the full telemetry matrix.
- Made hybrid convergence truthful when the iteration budget is exhausted; retained an energy-feasible solution.
- Persisted the fitted Zandvoort banking values. The saved fit and shipped sidecar had disagreed; the calibration writer now saves both car parameters and banking.
- Added exact racing-line node export. Re-importing the old sampled CSV lost information in tight corners and changed lap time. Four roundtrip checks now pass without loosening their tolerance.
- Closed exported telemetry at the exact lap distance/time, including the final periodic segment. Replay and CSV-derived duration now agree with the summary.
- Replaced the additive line-cache signature with an ordered bitwise hash of geometry and line options; checked invalidation, corrupt cache recovery and repeatability.
- Reused prepared geometry and corner limits in repeated library solves. GGV grids are generated only when requested.
- Made the solver own a car snapshot, preventing stale cached physics if callers mutate their original car object. Added updateVehicle() to retain geometry while safely rebuilding changed physics and invalidating old telemetry.
- Tabulated nonlinear tire terms, retaining exact math at sensitive boundaries; compared 40,000 acceleration/braking evaluations with exact nonlinear tire calculations.
- Warm-started the hybrid clipping bracket, re-evaluating both endpoints and falling back to the full range when the new car no longer brackets the energy constraint. Every speed profile is still recomputed.
- Removed unused duplicate tire/aero modules, obsolete fix notes and a stale GGV output. Production builds can omit validation targets with BUILD_TESTING=OFF.
- Added GGV feasibility flags and a conditions JSON. The default includes instantaneous peak ERS; --ggv-no-ers gives combustion-only and --ggv-drs opens DRS during acceleration.
- Rejected non-finite, nonnumeric and physically invalid inputs rather than silently defaulting them.
- Restored real calibration/validation group labels; the previous group-selecting tests could select zero cases.
- Renamed the CLI's claimed ‘optimal’ time to ‘predicted’: minimum curvature does not guarantee minimum lap time.
- Added reproducible model, cache, reuse, physics, real-lap and performance checks; split out the lap_core library.

## Accuracy method and boundaries

F1: existing parameters were fitted using Monza, Montreal, Shanghai and Zandvoort, in 2024 and 2025. They were frozen for the seven other circuits. No circuit-specific lap correction factor was added. The presets represent an effective fastest-session car, rather than an identified team's full vehicle model; the reference driver/team changes between events. The fastest valid dry lap may come from Q1 or Q2 rather than the pole lap. Wet Hungary 2024 is excluded from the dry tire model.

F2: the incoming Monza preset was approximately 2.5% too fast and was not a convincing independent car check. A single common grip scale was fitted to Monza 2024 and then frozen for five further laps. Medium/high downforce packages are stated engineering estimates. F1 weather and DRS sidecars are proxies for F2, not simultaneous F2 measurements. This checks a second vehicle class, with limited parameter identification. [F2 publishes engine/car specifications](https://www.fiaformula2.com/en/information/the-car-and-engine-f2.14LCsEEMG9yyx5DkhcN1J8), but full tire and aerodynamic maps are unavailable here.

All simulated values below come from the C++ executable at the default 1 m path resolution. Positive error means the engine predicts a slower lap. Official FIA/F1/F2 references are linked in each row. DRS/elevation sidecars use observed session information: the F1 other-track results are excluded from car fitting, but are not completely blind prospective predictions.

| Group | Laps | Mean absolute error, 1 m | Worst absolute error, 1 m | Mean absolute error, 2 m |
|---|---:|---:|---:|---:|
| F1 calibration | 8 | 0.26% | 0.99% | 0.27% |
| F1 other tracks | 13 | 1.82% | 3.93% | 1.82% |
| F2 calibration | 1 | 0.00% | 0.00% | 0.10% |
| F2 validation | 5 | 1.12% | 2.45% | 1.10% |

### All 27 observed laps

| Car / circuit / year | Reference driver | Real | Predicted | Delta | Error | Role / source |
|---|---|---:|---:|---:|---:|---|
| f1 montreal 2024 | RUS, Mercedes | 1:11.742 | 1:12.280 | +0.538 s | +0.75% | [F1 calibration](https://www.fia.com/events/fia-formula-one-world-championship/season-2024/canadian-grand-prix/qualifying-classification) |
| f1 montreal 2025 | RUS, Mercedes | 1:10.899 | 1:10.854 | -0.045 s | -0.06% | [F1 calibration](https://www.fia.com/events/fia-formula-one-world-championship/season-2025/canadian-grand-prix/qualifying-classification) |
| f1 monza 2024 | NOR, McLaren | 1:19.327 | 1:19.387 | +0.060 s | +0.08% | [F1 calibration](https://www.formula1.com/en/latest/article/norris-seals-pole-position-ahead-of-piastri-at-monza-as-mclaren-secure-front.4ZYpKyV7XxYPQoJ8WzLTtX) |
| f1 monza 2025 | VER, Red Bull Racing | 1:18.792 | 1:18.714 | -0.078 s | -0.10% | [F1 calibration](https://www.fia.com/events/fia-formula-one-world-championship/season-2025/italian-grand-prix/qualifying-classification) |
| f1 shanghai 2024 | VER, Red Bull Racing | 1:33.660 | 1:32.732 | -0.928 s | -0.99% | [F1 calibration](https://www.fia.com/events/fia-formula-one-world-championship/season-2024/chinese-grand-prix/qualifying-classification) |
| f1 shanghai 2025 | PIA, McLaren | 1:30.641 | 1:30.571 | -0.070 s | -0.08% | [F1 calibration](https://www.fia.com/events/fia-formula-one-world-championship/season-2025/chinese-grand-prix/qualifying-classification) |
| f1 zandvoort 2024 | NOR, McLaren | 1:09.673 | 1:09.691 | +0.018 s | +0.03% | [F1 calibration](https://www.fia.com/events/fia-formula-one-world-championship/season-2024/dutch-grand-prix/qualifying-classification) |
| f1 zandvoort 2025 | PIA, McLaren | 1:08.662 | 1:08.667 | +0.005 s | +0.01% | [F1 calibration](https://www.fia.com/events/fia-formula-one-world-championship/season-2025/dutch-grand-prix/qualifying-classification) |
| f1 austin 2024 | NOR, McLaren | 1:32.330 | 1:33.534 | +1.204 s | +1.30% | [F1 other tracks](https://www.formula1.com/en/latest/article/norris-clinches-pole-position-ahead-of-verstappen-in-austin-as-russell.5AgHxJQ1wldaEXPbWppToy) |
| f1 austin 2025 | VER, Red Bull Racing | 1:32.510 | 1:31.697 | -0.813 s | -0.88% | [F1 other tracks](https://www.formula1.com/en/results/2025/races/1271/usa/qualifying) |
| f1 budapest 2025 | NOR, McLaren | 1:14.890 | 1:14.924 | +0.034 s | +0.05% | [F1 other tracks](https://www.fia.com/events/fia-formula-one-world-championship/season-2025/hungarian-grand-prix/qualifying-classification) |
| f1 mexico 2024 | SAI, Ferrari | 1:15.946 | 1:14.357 | -1.589 s | -2.09% | [F1 other tracks](https://www.formula1.com/en/results/2024/races/1248/mexico/qualifying) |
| f1 mexico 2025 | NOR, McLaren | 1:15.586 | 1:13.276 | -2.310 s | -3.06% | [F1 other tracks](https://www.fia.com/events/fia-formula-one-world-championship/season-2025/mexico-city-grand-prix/qualifying) |
| f1 sakhir 2024 | LEC, Ferrari | 1:29.165 | 1:27.991 | -1.174 s | -1.32% | [F1 other tracks](https://www.fia.com/events/fia-formula-one-world-championship/season-2024/bahrain-grand-prix/qualifying-classification) |
| f1 sakhir 2025 | PIA, McLaren | 1:29.841 | 1:26.311 | -3.530 s | -3.93% | [F1 other tracks](https://www.fia.com/system/files/decision-document/2025_bahrain_grand_prix_-_provisional_qualifying_classification.pdf) |
| f1 silverstone 2024 | RUS, Mercedes | 1:25.819 | 1:28.092 | +2.273 s | +2.65% | [F1 other tracks](https://www.fia.com/events/fia-formula-one-world-championship/season-2024/british-grand-prix/qualifying-classification) |
| f1 silverstone 2025 | VER, Red Bull Racing | 1:24.892 | 1:26.330 | +1.438 s | +1.69% | [F1 other tracks](https://www.fia.com/events/fia-formula-one-world-championship/season-2025/british-grand-prix/qualifying-classification) |
| f1 spielberg 2024 | VER, Red Bull Racing | 1:04.314 | 1:06.563 | +2.249 s | +3.50% | [F1 other tracks](https://www.fia.com/events/fia-formula-one-world-championship/season-2024/austrian-grand-prix/qualifying-classification) |
| f1 spielberg 2025 | NOR, McLaren | 1:03.971 | 1:05.261 | +1.290 s | +2.02% | [F1 other tracks](https://www.fia.com/events/fia-formula-one-world-championship/season-2025/austrian-grand-prix/qualifying-classification) |
| f1 suzuka 2024 | VER, Red Bull Racing | 1:28.197 | 1:29.068 | +0.871 s | +0.99% | [F1 other tracks](https://www.fia.com/events/fia-formula-one-world-championship/season-2024/japanese-grand-prix/qualifying-classification) |
| f1 suzuka 2025 | VER, Red Bull Racing | 1:26.983 | 1:27.202 | +0.219 s | +0.25% | [F1 other tracks](https://www.fia.com/events/fia-formula-one-world-championship/season-2025/japanese-grand-prix/qualifying-classification) |
| f2 monza 2024 | Maloney, Rodin | 1:32.160 | 1:32.160 | +0.000 s | +0.00% | [F2 calibration](https://www.fiaformula2.com/Latest/23hfDSdeAUapjehlhLGXKZ/qualifying-maloney-beats-hadjar-to-take-maiden-f2-pole-position-in-monza) |
| f2 monza 2025 | Browning, Hitech | 1:32.390 | 1:32.169 | -0.221 s | -0.24% | [F2 validation](https://www.fia.com/events/formula-2-championship/season-2025/monza/qualifying-classification) |
| f2 spielberg 2024 | Hauger, MP Motorsport | 1:15.487 | 1:15.998 | +0.511 s | +0.68% | [F2 validation](https://www.fia.com/sites/default/files/2024_11_aut_f2_q0_timing_qualifyingsessionprovisionalclassification_v01.pdf) |
| f2 silverstone 2024 | Hadjar, Campos | 1:39.368 | 1:39.689 | +0.321 s | +0.32% | [F2 validation](https://www.fia.com/sites/default/files/decision-document/2024%20Silverstone%20Event%20-%20F2%20Qualifying%20-%20final%20classification.pdf) |
| f2 sakhir 2024 | Bortoleto, Invicta | 1:41.915 | 1:39.976 | -1.939 s | -1.90% | [F2 validation](https://www.fia.com/events/formula-2-championship/season-2024/qualifying-classifications) |
| f2 budapest 2024 | Aron, Hitech | 1:30.028 | 1:27.823 | -2.205 s | -2.45% | [F2 validation](https://www.fia.com/sites/default/files/2024_13_hun_f2_q0_timing_qualifyingsessionprovisionalclassification_v01.pdf) |

### Original versus incoming versus repaired

On the eight shared calibration observations: original mean absolute error **3.21%**, incoming **0.75%**, repaired **0.26%**. This compares the complete usable configurations, including different car parameters, geometry and physics. It is not an isolated algorithm improvement or an independent accuracy score.

| Observation | Real | Original | Incoming | Repaired |
|---|---:|---:|---:|---:|
| f1_montreal_2024 | 1:11.742 | 1:13.437 | 1:12.280 | 1:12.280 |
| f1_montreal_2025 | 1:10.899 | 1:12.802 | 1:10.854 | 1:10.854 |
| f1_monza_2024 | 1:19.327 | 1:22.572 | 1:19.389 | 1:19.387 |
| f1_monza_2025 | 1:18.792 | 1:21.775 | 1:18.717 | 1:18.714 |
| f1_shanghai_2024 | 1:33.660 | 1:31.667 | 1:32.732 | 1:32.732 |
| f1_shanghai_2025 | 1:30.641 | 1:30.734 | 1:30.571 | 1:30.571 |
| f1_zandvoort_2024 | 1:09.673 | 1:13.217 | 1:08.295 | 1:09.691 |
| f1_zandvoort_2025 | 1:08.662 | 1:12.394 | 1:07.295 | 1:08.667 |

### Speed profiles expose remaining physics errors

A matching total lap can hide compensating corner errors. The distance-aligned FastF1 comparison gives approximately **10.0 km/h speed RMS** on the fitted tracks and **13.1 km/h** on other tracks. For example, Bahrain 2025 has slow-corner predictions near 92/104/104 km/h versus observed 67/79/76 km/h; Silverstone 2025 has high-speed apex predictions near 183/202 km/h versus 230/239 km/h. These are substantial local errors despite moderate total-lap error.

The comparison rescales track/telemetry distances and aligns their start using cross-correlation; it is not a survey-grade comparison at identical physical coordinates. See [all speed checks](speed_comparison.txt) and [machine-readable RMS values](speed_results.json). Example overlays: [Shanghai 2025](figures/shanghai_2025.png) and [Bahrain 2025](figures/sakhir_2025.png). The overlays use session air density to four decimals; the portable lap-reference fixture rounds it to three, producing millisecond-level time differences.

## Runtime and real-time use

Measured on Intel Core Ultra 7 255H, GCC 13.3, C++17, CMake Release (-O3 -DNDEBUG), WSL2 Ubuntu x86_64. One cold solve and five reused solves per car/track; the table gives medians across eleven tracks of each track's five-run median. No GGV export, subprocess startup, CSV serialization or parsing is included in reused timings. Road conditions here use the presets' default air density, so these performance-matrix lap times differ from the weather-specific accuracy table.

| Family | Reused median, 1 m | Reused median, 2 m | Track median range, 2 m | Worst observed repeat, 2 m |
|---|---:|---:|---:|---:|
| F1 2024 | 12.03 ms | 6.39 ms | 1.39–8.22 ms | 8.91 ms |
| F1 2025 | 11.81 ms | 6.58 ms | 5.23–7.77 ms | 8.10 ms |
| F2 | 3.63 ms | 1.89 ms | 1.41–2.19 ms | 2.69 ms |
| Civic Si | 6.54 ms | 3.37 ms | 2.67–3.70 ms | 4.82 ms |
| Formula Student | 3.71 ms | 1.98 ms | 1.59–2.27 ms | 2.79 ms |

Cold 2 m solves take **0.87–3.27 seconds**; prepare outside the interactive update loop. Construct a solver, keep its track alive and reuse solve(). Change car parameters explicitly through updateVehicle(), which reuses unchanged geometry and compatible force tables. The table above repeatedly solves the same inputs; changing-setup measurements are separate below.

Across all 55 combinations, 2 m versus 1 m changes lap time by at most **0.097 s**, and at most **0.116%**. The 2 m setting is therefore a reasonable fast setting for this matrix. Prepared-path repeats now have room inside a 16.7 ms update budget on the test CPU, including hybrid cars. This does not establish 60 Hz on low-power hardware or for every setup change. The reported maxima are observations, not scheduling/worst-case execution-time guarantees.

### Changing setup, rather than repeating the same inputs

Each of 55 configurations was updated three times with grip scales 0.995, 1.000 and 1.005. Timings include updateVehicle() and solve(), with prepared geometry. Each result was checked against an independent fresh solver; all 165 updates were converged and energy feasible.

| Family | Setup-update median, 2 m | Largest observed update |
|---|---:|---:|
| F1 2024 | 19.48 ms | 28.60 ms |
| F1 2025 | 20.61 ms | 33.90 ms |
| F2 | 2.56 ms | 3.46 ms |
| Civic Si | 4.96 ms | 6.05 ms |
| Formula Student | 2.19 ms | 2.63 ms |

The largest warm-update versus fresh-solve difference was **0.01938 s**, within the hybrid clipping solve's numerical tolerance. Changing a hybrid setup can exceed a 16.7 ms frame budget even when repeated identical-input solves fit inside it.

This optimization pass reduced the median prepared F1 solve from **53.97 ms to 6.49 ms** at 2 m. The measurements use the same test CPU and configurations; they are not a hardware-independent guarantee.

### Numerical matrix: 55 combinations at 2 m

These are predictions, not measured road-car lap times. Each combination also passed at 1 m: finite telemetry, valid controls and RPM, ERS within budget, convergence and deterministic path reuse.

| Track | F1 2024 | F1 2025 | F2 | Civic Si | Formula Student |
|---|---:|---:|---:|---:|---:|
| Monza | 1:19.485 | 1:18.796 | 1:32.281 | 2:22.129 | 2:13.399 |
| montreal | 1:12.283 | 1:10.879 | 1:22.338 | 2:06.092 | 1:45.351 |
| Zandvoort | 1:09.533 | 1:08.622 | 1:20.781 | 2:06.220 | 1:41.001 |
| Shanghai | 1:32.659 | 1:30.523 | 1:45.445 | 2:40.128 | 2:12.635 |
| Spielberg | 1:06.348 | 1:05.112 | 1:15.825 | 1:57.682 | 1:40.423 |
| Silverstone | 1:28.078 | 1:26.369 | 1:39.696 | 2:36.087 | 2:15.366 |
| Budapest | 1:15.401 | 1:14.425 | 1:27.434 | 2:16.824 | 1:44.039 |
| Suzuka | 1:29.094 | 1:27.242 | 1:40.883 | 2:36.639 | 2:14.010 |
| Austin | 1:33.356 | 1:31.421 | 1:46.215 | 2:43.358 | 2:11.817 |
| Sakhir | 1:28.019 | 1:26.255 | 1:40.124 | 2:33.789 | 2:07.259 |
| MexicoCity | 1:13.538 | 1:12.582 | 1:24.604 | 2:07.889 | 1:45.763 |

## Verification

All **7/7 CTest suites passed**: solver reuse, model invariants, input/cache regression, analytic physics, F1 calibration, F1 other tracks, and F2 validation. Analytic physics checks passed 27/27, including skidpad, drag-limited speed, traction, braking, mass, friction ellipse, DRS/ERS and exact-node roundtrip. Regression checks cover 21 executable invocations. See [test log](tests.txt). Two benchmark runs each covered 55 configurations plus five repeats.

The actual predictive errors above matter more than the test pass label. The F1 other-track test permits 2% mean absolute and 5% maximum error; F2 validation permits 2% mean and 3% maximum. Those are regression guardrails, not a claim of sub-percent accuracy everywhere.

## Remaining limitations and next improvements

- Civic Si and Formula Student have no matched measured laps in this repository. Their runs establish numerical behavior only, not real-world accuracy. Road-car tire compound, driver, weather and setup must match before using a published lap as a calibration target.
- The lateral tire calculation combines available capacity across tires; it is not a full front/rear yaw equilibrium solve with slip angles, camber and transient suspension dynamics. This limits trust in setup and balance changes.
- A minimum-curvature line can be slower than a shorter line, even on a constant-radius skidpad. A vehicle-specific minimum-time line optimizer is still needed for accurate line/setup optimization.
- Coarse centerlines, smoothing, effective banking and estimated aero maps can produce systematic corner errors. The fitted coefficients are effective model parameters, not measured wind-tunnel values.
- Hybrid clipping enforces an approximate net per-lap energy budget, with simplified recovery; it does not optimize sector deployment or simulate a full battery state over multiple laps.
- No temperature, tire wear, wet grip, transient aero, traffic/tow or driver-error model was validated. Unknown physics should not be hidden by track-specific lap multipliers.
- Use more independent telemetry, measured aero/tire maps and actual driven line nodes to reduce the local speed errors before promising accurate predictions for arbitrary cars.

## Reproduce

Commands below run from the repository root using a C++17 compiler and Python 3. The tests, real-lap checks and report text need only Python's standard library. Generating the summary figure requires matplotlib.

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure
python3 validation/validate.py --binary ./build/lap_sim --json-out validation/results.json
python3 validation/validate.py --binary ./build/lap_sim --extra='--ds 2' --json-out validation/results_2m.json
./build/lap_benchmark validation/benchmark_1m.json 1
./build/lap_benchmark validation/benchmark_2m.json 2
./build/lap_update_benchmark validation/update_benchmark_2m.json
python3 validation/report.py --plot
```

For MSVC, add `--config Release`, run CTest with `-C Release`, and use `build/Release/lap_sim.exe` and `build/Release/lap_benchmark.exe`. The builds measured here use WSL2/GCC, not native MSVC. Fetching telemetry and rerunning parameter calibration additionally needs FastF1, NumPy, SciPy and matplotlib; see scripts under `validation/fastf1/`.

### Artifacts

- [Accuracy at 1 m](results.json), [accuracy at 2 m](results_2m.json), [official references](reference_laps.json).
- [Benchmarks at 1 m](benchmark_1m.json), [benchmarks at 2 m](benchmark_2m.json).
- [Changing-setup benchmark](update_benchmark_2m.json), [previous-pass timings](improvement_before/benchmark_2m.json).
- [Original results](original_results.json), [incoming results](before_results.json).
- [Review provenance and frozen fit](review_provenance.json), [F2 grip fit](f2_calibration.json).
- [Summary figure](figures/review_summary.png).
