# LapPredictionEngine

C++ lap prediction for real-time agents and engineering tools working with a small CPU budget.

Give it a track and a car. It predicts a lap, produces simulated telemetry, and exports a GGV envelope. The goal is useful physics that can run repeatedly on modest hardware. No GPU and no heavy runtime dependencies.

This is a quasi-steady-state engine. It is not a full suspension simulator, and a close total lap time does not prove every corner is correct. The [validation report](validation/REVIEW_REPORT.md) shows the errors as well as the good results.

## Build

Needs a C++17 compiler and CMake. Python 3 is only needed for validation.

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
./build/lap_sim examples/Monza.csv examples/f1_2025_quali_lowdf.json
```

For a small production build, configure with `-DBUILD_TESTING=OFF`. This builds the engine and library without the test and benchmark executables. `build.sh` also supports a direct GCC build if CMake is unavailable.

On Windows with MSVC:

```powershell
cmake -S . -B build
cmake --build build --config Release
./build/Release/lap_sim.exe examples/Monza.csv examples/f1_2025_quali_lowdf.json
```

## Real-time use

Prepare the track outside the update loop. Link the `lap_core` CMake target, keep the track alive, and reuse the solver. Changing a setup through `updateVehicle()` retains geometry when the track and line settings still match, while invalidating the old speed profile and telemetry.

```cpp
SolverOptions options;
options.verbose = false;
options.line.output_step = 2.0;
QuasiSteadyStateSolver solver(track, car, options);
solver.solve();                 // prepare geometry and predict the first lap
solver.solve();                 // reuse geometry, corner limits and ERS bracket
car.tire.mu_y *= 0.99;
solver.updateVehicle(car);      // owns a copy; does not keep a reference to car
solver.solve();                 // recompute with the changed setup
auto telemetry = solver.getDetailedResult();
```

The engine uses tire lookup tables, a best-gear force map, cached geometry, and a checked warm start for the hybrid energy solve. It still recalculates the speed profile; the warm path does not simply return a cached lap time. Lookup accuracy is checked against the exact nonlinear model.

For CLI use, `--ds 2` is the tested fast resolution and `--line-cache file` avoids rebuilding an unchanged line between processes. `--quiet --no-output --summary-json result.json` skips default file exports. GGV calculation happens only when requested.

Measured runtimes, cold preparation, setup-update costs and the test CPU are in the report. Low-power hardware needs its own benchmark: this project targets real-time use, but does not promise a hard real-time deadline on every CPU. Process startup and file export also cost time.

## Outputs

| Output | What it contains | Option |
|---|---|---|
| Telemetry CSV | Time, distance, position, speed, acceleration/G, throttle/brake, steering, gear/RPM, forces, axle loads, ERS and DRS | Default; `--csv file` overrides the path |
| GGV CSV | Acceleration/braking limits versus speed and lateral demand, plus feasibility flags | Default; `--ggv file` overrides the path |
| GGV conditions JSON | Units, ERS/DRS state, braking sign and envelope assumptions | Written beside GGV as `.csv.meta.json` |
| Telemetry JSON | Structured simulated lap telemetry | `--json file` |
| Summary JSON | Lap time, speeds, energy, convergence and solve timing | `--summary-json file` |
| Racing-line CSV | Sampled geometry, curvature, road profile and speeds | `--line-csv file` |
| Exact line nodes | Editable lateral offsets for lossless reuse | `--line-nodes file` |

Default files go into `outputs/` and are ignored by Git. `--no-output` disables the default telemetry/GGV exports; explicitly named exports still work.

The GGV is a flat-road instantaneous envelope. By default it uses peak ERS where the car has it and keeps DRS closed. It does not apply the per-lap energy budget. Use `--ggv-no-ers` for combustion-only, or `--ggv-drs` to open DRS for acceleration; braking always uses closed DRS. `--no-ers` and `--no-drs` also constrain the map. Ignore points whose relevant feasibility flag is false.

For exact line reuse, export `--line-nodes nodes.csv`, then use `--line given --line-file nodes.csv` with the same track and line options. A sampled `--line-csv` is for inspection; importing it can lose detail in tight corners.

## Physics and inputs

- Load-sensitive tires, combined longitudinal/lateral grip, axle load transfer, FWD/RWD/AWD and brake bias.
- Drag/downforce, aero balance, rolling resistance, wheel/engine inertia and gear-shift interruption.
- Banking, elevation, DRS zones and an approximate ERS energy budget.
- A bounded minimum-curvature racing line, the centreline, or a supplied line.
- Forward acceleration and backward braking with RK2 integration.

Car files are JSON; tracks use the TUMFTM CSV layout `x_m,y_m,w_tr_right_m,w_tr_left_m`. Optional track sidecars are `<track>.drs.csv`, `<track>.banking.csv`, and `<track>.elevation.csv`.

Examples include F1 2024/2025 qualifying packages, F2, Civic Si and Formula Student, across eleven circuits. The qualifying presets are calibrated effective models. F2 aero is estimated, and Zandvoort banking uses fitted effective averages. These are not manufacturer tire/aero maps. Earlier vehicle examples remain for compatibility.

Useful controls:

```bash
./build/lap_sim examples/Monza.csv examples/f1_2025_quali_lowdf.json \
  --ds 2 --quiet --no-output --summary-json outputs/result.json
```

`--air-density`, `--mu-scale`, and repeatable `--set section.field=value` change conditions or car parameters. `--no-drs`, `--no-ers`, `--no-banking`, and `--no-elevation` disable individual features. `--line mincurv|center|given` selects the line. Run `--help` for all options.

## Validation

```bash
ctest --test-dir build --output-on-failure
python3 validation/validate.py --binary ./build/lap_sim --json-out validation/results.json
./build/lap_benchmark validation/benchmark_2m.json 2
```

For MSVC, use `ctest --test-dir build -C Release` and the executables under `build/Release/`.

The review compares 27 official F1/F2 qualifying laps, keeps fitting and validation cases separate, and checks five car families on eleven tracks at 1 m and 2 m. Civic Si and Formula Student are numerical checks only; matched measured laps are still needed. The report includes references, speed-profile errors, benchmarks, and the original/incoming/revised comparison.

Important remaining work: front/rear lateral equilibrium and tire slip angles, a vehicle-specific minimum-time racing line, better measured tire/aero data, and optimized hybrid deployment. Tire temperature, wear, wet grip, traffic and driver error are outside the validated model.

## References

Independent C++ implementation, informed by [TUMFTM laptime simulation](https://github.com/TUMFTM/laptime-simulation) and the [TUMFTM racetrack database](https://github.com/TUMFTM/racetrack-database). Related work: [Christ et al.](https://doi.org/10.1080/00423114.2019.1704804) and [Heilmeier et al.](https://doi.org/10.1109/ITSC.2018.8570012). See [the gear-ratio guide](docs/GEAR_RATIO_GUIDE.md) for configuration help.
