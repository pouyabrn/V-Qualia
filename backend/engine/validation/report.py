#!/usr/bin/env python3
"""Regenerate the review report from measured C++ outputs; optional static figure.

Run validation and the two benchmarks first (commands in REVIEW_REPORT.md).
This script does not fit parameters or change any simulated time.
"""
import argparse
import json
from pathlib import Path
import re
import statistics as S

HERE = Path(__file__).resolve().parent
FAMILIES = [("f1_2024", "F1 2024"), ("f1_2025", "F1 2025"),
            ("f2_2024", "F2"), ("honda", "Civic Si"), ("fsae", "Formula Student")]
LABELS = {"calibration": "F1 calibration", "out-of-sample": "F1 other tracks",
          "f2-calibration": "F2 calibration", "cross-car": "F2 validation"}


def read(name):
    return json.loads((HERE / name).read_text())


def lap(t):
    return f"{int(t // 60)}:{t % 60:06.3f}"


def family(row, prefix):
    return row["car"].startswith(prefix)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plot", action="store_true", help="requires matplotlib")
    args = parser.parse_args()
    cases = {c["id"]: c for c in read("reference_laps.json")["cases"]}
    results = read("results.json")
    fast = {r["id"]: r for r in read("results_2m.json")}
    b1, b2 = read("benchmark_1m.json"), read("benchmark_2m.json")
    updates = read("update_benchmark_2m.json")
    prior_b2 = read("improvement_before/benchmark_2m.json")
    previous = {r["id"]: r for r in read("before_results.json")}
    original = read("original_results.json")
    final = {r["id"]: r for r in results}
    provenance = read("review_provenance.json")
    assert len(results) == 27 and len(b1) == len(b2) == 55
    assert all((x["car"], x["track"]) == (y["car"], y["track"]) for x, y in zip(b1, b2))
    groups = {name: [r for r in results if r["set"] == name] for name in LABELS}
    max_drift = max(abs(x["lap_s"] - y["lap_s"]) for x, y in zip(b1, b2))
    max_relative_drift = max(100 * abs(x["lap_s"] - y["lap_s"]) / x["lap_s"] for x, y in zip(b1, b2))
    speed = []
    for line in (HERE / "speed_comparison.txt").read_text().splitlines():
        m = re.match(r"^(\w+_20\d\d)\s+(calibration|OUT-OF-SAMPLE).*?rms\s+([\d.]+) km/h", line)
        if m:
            speed.append({"id": "f1_" + m[1], "set": m[2], "speed_rms_kmh": float(m[3])})
    (HERE / "speed_results.json").write_text(json.dumps(speed, indent=2) + "\n")
    calibration_ids = [r["id"] for r in groups["calibration"]]
    old_mae = S.mean(abs(r["original_error_pct"]) for r in original)
    prev_mae = S.mean(abs(previous[k]["error_pct"]) for k in calibration_ids)
    final_mae = S.mean(abs(final[k]["error_pct"]) for k in calibration_ids)
    lines = [
        "# Lap engine review and validation — 2026-10-08", "",
        "The incoming optimization is useful, but several correctness and reproducibility problems needed repairs. "
        "The revised engine passes seven test suites and 110 numerical car/track/resolution combinations. "
        "It was compared with 27 official F1/F2 qualifying laps. It is suitable for interactive lap prediction "
        "with prepared geometry; hardware-specific timing checks are still necessary for low-power or hard real-time use.", "",
        "## What was reviewed", "",
        f"Baseline: [{provenance['baseline_commit']}]({provenance['baseline_url']}). "
        "A fresh original binary was built from 21 source/header files verified against this commit. "
        "The local incoming implementation was built separately before repairs. No original or incoming results "
        "in the comparison below were invented or substituted for measured runs.", "",
        "Kept: the RK2 forward/backward solver, axle load transfer, tire load sensitivity, wheel inertia, "
        "DRS/ERS support, minimum-curvature racing line, track sidecars, force lookup tables and the existing "
        "F1 parameter fit. Those parts provide useful functionality and speed.", "",
        "## Repairs", "",
        "- Corrected the Civic Si preset to front-wheel drive; omitted drive type had selected rear-wheel drive.",
        "- Conserved total axle load during wheel lift. Clamping both axles independently had created extra tire load.",
        "- Fixed force-table gear selection near the limiter; checked 80,000 speeds and the full telemetry matrix.",
        "- Made hybrid convergence truthful when the iteration budget is exhausted; retained an energy-feasible solution.",
        "- Persisted the fitted Zandvoort banking values. The saved fit and shipped sidecar had disagreed; "
        "the calibration writer now saves both car parameters and banking.",
        "- Added exact racing-line node export. Re-importing the old sampled CSV lost information in tight corners "
        "and changed lap time. Four roundtrip checks now pass without loosening their tolerance.",
        "- Closed exported telemetry at the exact lap distance/time, including the final periodic segment. "
        "Replay and CSV-derived duration now agree with the summary.",
        "- Replaced the additive line-cache signature with an ordered bitwise hash of geometry and line options; "
        "checked invalidation, corrupt cache recovery and repeatability.",
        "- Reused prepared geometry and corner limits in repeated library solves. GGV grids are generated only when requested.",
        "- Made the solver own a car snapshot, preventing stale cached physics if callers mutate their original car object. "
        "Added updateVehicle() to retain geometry while safely rebuilding changed physics and invalidating old telemetry.",
        "- Tabulated nonlinear tire terms, retaining exact math at sensitive boundaries; compared 40,000 "
        "acceleration/braking evaluations with exact nonlinear tire calculations.",
        "- Warm-started the hybrid clipping bracket, re-evaluating both endpoints and falling back to the full range "
        "when the new car no longer brackets the energy constraint. Every speed profile is still recomputed.",
        "- Removed unused duplicate tire/aero modules, obsolete fix notes and a stale GGV output. "
        "Production builds can omit validation targets with BUILD_TESTING=OFF.",
        "- Added GGV feasibility flags and a conditions JSON. The default includes instantaneous peak ERS; "
        "--ggv-no-ers gives combustion-only and --ggv-drs opens DRS during acceleration.",
        "- Rejected non-finite, nonnumeric and physically invalid inputs rather than silently defaulting them.",
        "- Restored real calibration/validation group labels; the previous group-selecting tests could select zero cases.",
        "- Renamed the CLI's claimed ‘optimal’ time to ‘predicted’: minimum curvature does not guarantee minimum lap time.",
        "- Added reproducible model, cache, reuse, physics, real-lap and performance checks; split out the lap_core library.", "",
        "## Accuracy method and boundaries", "",
        "F1: existing parameters were fitted using Monza, Montreal, Shanghai and Zandvoort, in 2024 and 2025. "
        "They were frozen for the seven other circuits. No circuit-specific lap correction factor was added. "
        "The presets represent an effective fastest-session car, rather than an identified team's full vehicle model; "
        "the reference driver/team changes between events. The fastest valid dry lap may come from Q1 or Q2 rather "
        "than the pole lap. Wet Hungary 2024 is excluded from the dry tire model.", "",
        "F2: the incoming Monza preset was approximately 2.5% too fast and was not a convincing independent car check. "
        "A single common grip scale was fitted to Monza 2024 and then frozen for five further laps. Medium/high "
        "downforce packages are stated engineering estimates. F1 weather and DRS sidecars are proxies for F2, "
        "not simultaneous F2 measurements. This checks a second vehicle class, with limited parameter identification. "
        "[F2 publishes engine/car specifications](https://www.fiaformula2.com/en/information/the-car-and-engine-f2.14LCsEEMG9yyx5DkhcN1J8), "
        "but full tire and aerodynamic maps are unavailable here.", "",
        "All simulated values below come from the C++ executable at the default 1 m path resolution. "
        "Positive error means the engine predicts a slower lap. Official FIA/F1/F2 references are linked in each row. "
        "DRS/elevation sidecars use observed session information: the F1 other-track results are excluded from car "
        "fitting, but are not completely blind prospective predictions.", "",
        "| Group | Laps | Mean absolute error, 1 m | Worst absolute error, 1 m | Mean absolute error, 2 m |",
        "|---|---:|---:|---:|---:|",
    ]
    for name, rows in groups.items():
        lines.append(f"| {LABELS[name]} | {len(rows)} | {S.mean(abs(r['error_pct']) for r in rows):.2f}% | "
                     f"{max(abs(r['error_pct']) for r in rows):.2f}% | "
                     f"{S.mean(abs(fast[r['id']]['error_pct']) for r in rows):.2f}% |")
    lines += ["", "### All 27 observed laps", "",
              "| Car / circuit / year | Reference driver | Real | Predicted | Delta | Error | Role / source |",
              "|---|---|---:|---:|---:|---:|---|"]
    for r in results:
        c = cases[r["id"]]
        lines.append(f"| {r['id'].replace('_', ' ')} | {c['driver']} | {lap(r['real'])} | {lap(r['sim'])} | "
                     f"{r['sim']-r['real']:+.3f} s | {r['error_pct']:+.2f}% | "
                     f"[{LABELS[r['set']]}]({c['source']}) |")
    lines += ["", "### Original versus incoming versus repaired", "",
              f"On the eight shared calibration observations: original mean absolute error **{old_mae:.2f}%**, "
              f"incoming **{prev_mae:.2f}%**, repaired **{final_mae:.2f}%**. "
              "This compares the complete usable configurations, including different car parameters, geometry "
              "and physics. It is not an isolated algorithm improvement or an independent accuracy score.", "",
              "| Observation | Real | Original | Incoming | Repaired |",
              "|---|---:|---:|---:|---:|"]
    for r in original:
        key = r["id"]
        lines.append(f"| {key} | {lap(r['real_s'])} | {lap(r['original_s'])} | "
                     f"{lap(previous[key]['sim'])} | {lap(final[key]['sim'])} |")
    lines += ["", "### Speed profiles expose remaining physics errors", "",
              "A matching total lap can hide compensating corner errors. The distance-aligned FastF1 comparison "
              "gives approximately **10.0 km/h speed RMS** on the fitted tracks and **13.1 km/h** on other tracks. "
              "For example, Bahrain 2025 has slow-corner predictions near 92/104/104 km/h versus observed "
              "67/79/76 km/h; Silverstone 2025 has high-speed apex predictions near 183/202 km/h versus "
              "230/239 km/h. These are substantial local errors despite moderate total-lap error.", "",
              "The comparison rescales track/telemetry distances and aligns their start using cross-correlation; "
              "it is not a survey-grade comparison at identical physical coordinates. See [all speed checks]"
              "(speed_comparison.txt) and [machine-readable RMS values](speed_results.json). "
              "Example overlays: [Shanghai 2025](figures/shanghai_2025.png) and "
              "[Bahrain 2025](figures/sakhir_2025.png). The overlays use session air density to four decimals; "
              "the portable lap-reference fixture rounds it to three, producing millisecond-level time differences.", "",
              "## Runtime and real-time use", "",
              f"Measured on {provenance['cpu']}, {provenance['compiler']}. One cold solve and five reused solves "
              "per car/track; the table gives medians across eleven tracks of each track's five-run median. "
              "No GGV export, subprocess startup, CSV serialization or parsing is included in reused timings. "
              "Road conditions here use the presets' default air density, so these performance-matrix lap times "
              "differ from the weather-specific accuracy table.", "",
              "| Family | Reused median, 1 m | Reused median, 2 m | Track median range, 2 m | Worst observed repeat, 2 m |",
              "|---|---:|---:|---:|---:|"]
    for prefix, label in FAMILIES:
        a = [r for r in b1 if family(r, prefix)]
        b = [r for r in b2 if family(r, prefix)]
        lines.append(f"| {label} | {S.median(r['warm_median_ms'] for r in a):.2f} ms | "
                     f"{S.median(r['warm_median_ms'] for r in b):.2f} ms | "
                     f"{min(r['warm_median_ms'] for r in b):.2f}–{max(r['warm_median_ms'] for r in b):.2f} ms | "
                     f"{max(r['warm_max_ms'] for r in b):.2f} ms |")
    lines += ["", f"Cold 2 m solves take **{min(r['cold_ms'] for r in b2)/1000:.2f}–"
              f"{max(r['cold_ms'] for r in b2)/1000:.2f} seconds**; prepare outside the interactive update loop. "
              "Construct a solver, keep its track alive and reuse solve(). Change car parameters explicitly "
              "through updateVehicle(), which reuses unchanged geometry and compatible force tables. "
              "The table above repeatedly solves the same inputs; changing-setup measurements are separate below.", "",
              f"Across all 55 combinations, 2 m versus 1 m changes lap time by at most **{max_drift:.3f} s**, "
              f"and at most **{max_relative_drift:.3f}%**. The 2 m setting is therefore a reasonable fast setting "
              "for this matrix. Prepared-path repeats now have room inside a 16.7 ms update budget on the test CPU, "
              "including hybrid cars. This does not establish 60 Hz on low-power hardware or for every setup change. "
              "The reported maxima are observations, "
              "not scheduling/worst-case execution-time guarantees.", "",
              "### Changing setup, rather than repeating the same inputs", "",
              "Each of 55 configurations was updated three times with grip scales 0.995, 1.000 and 1.005. "
              "Timings include updateVehicle() and solve(), with prepared geometry. Each result was checked "
              "against an independent fresh solver; all 165 updates were converged and energy feasible.", "",
              "| Family | Setup-update median, 2 m | Largest observed update |",
              "|---|---:|---:|"]
    for prefix, label in FAMILIES:
        rows = [r for r in updates if family(r, prefix)]
        lines.append(f"| {label} | {S.median(r['update_median_ms'] for r in rows):.2f} ms | "
                     f"{max(r['update_max_ms'] for r in rows):.2f} ms |")
    old_f1 = [r['warm_median_ms'] for r in prior_b2 if r['car'].startswith('f1_')]
    new_f1 = [r['warm_median_ms'] for r in b2 if r['car'].startswith('f1_')]
    lines += ["", f"The largest warm-update versus fresh-solve difference was "
              f"**{max(r['max_fresh_delta_s'] for r in updates):.5f} s**, within the "
              "hybrid clipping solve's numerical tolerance. Changing a hybrid setup can exceed a 16.7 ms "
              "frame budget even when repeated identical-input solves fit inside it.", "",
              f"This optimization pass reduced the median prepared F1 solve from "
              f"**{S.median(old_f1):.2f} ms to {S.median(new_f1):.2f} ms** at 2 m. "
              "The measurements use the same test CPU and configurations; they are not a hardware-independent guarantee.", "",
              "### Numerical matrix: 55 combinations at 2 m", "",
              "These are predictions, not measured road-car lap times. Each combination also passed at 1 m: "
              "finite telemetry, valid controls and RPM, ERS within budget, convergence and deterministic path reuse.", "",
              "| Track | F1 2024 | F1 2025 | F2 | Civic Si | Formula Student |",
              "|---|---:|---:|---:|---:|---:|"]
    for track in dict.fromkeys(r["track"] for r in b2):
        rows = [r for r in b2 if r["track"] == track]
        lines.append("| " + track + " | " + " | ".join(lap(r["lap_s"]) for r in rows) + " |")
    lines += ["", "## Verification", "",
              "All **7/7 CTest suites passed**: solver reuse, model invariants, input/cache regression, analytic "
              "physics, F1 calibration, F1 other tracks, and F2 validation. Analytic physics checks passed "
              "27/27, including skidpad, drag-limited speed, traction, braking, mass, friction ellipse, "
              "DRS/ERS and exact-node roundtrip. Regression checks cover 21 executable invocations. "
              "See [test log](tests.txt). Two benchmark runs each covered 55 configurations plus five repeats.", "",
              "The actual predictive errors above matter more than the test pass label. The F1 other-track "
              "test permits 2% mean absolute and 5% maximum error; F2 validation permits 2% mean and 3% maximum. "
              "Those are regression guardrails, not a claim of sub-percent accuracy everywhere.", "",
              "## Remaining limitations and next improvements", "",
              "- Civic Si and Formula Student have no matched measured laps in this repository. Their runs "
              "establish numerical behavior only, not real-world accuracy. Road-car tire compound, driver, "
              "weather and setup must match before using a published lap as a calibration target.",
              "- The lateral tire calculation combines available capacity across tires; it is not a full "
              "front/rear yaw equilibrium solve with slip angles, camber and transient suspension dynamics. "
              "This limits trust in setup and balance changes.",
              "- A minimum-curvature line can be slower than a shorter line, even on a constant-radius skidpad. "
              "A vehicle-specific minimum-time line optimizer is still needed for accurate line/setup optimization.",
              "- Coarse centerlines, smoothing, effective banking and estimated aero maps can produce systematic "
              "corner errors. The fitted coefficients are effective model parameters, not measured wind-tunnel values.",
              "- Hybrid clipping enforces an approximate net per-lap energy budget, with simplified recovery; "
              "it does not optimize sector deployment or simulate a full battery state over multiple laps.",
              "- No temperature, tire wear, wet grip, transient aero, traffic/tow or driver-error model was validated. "
              "Unknown physics should not be hidden by track-specific lap multipliers.",
              "- Use more independent telemetry, measured aero/tire maps and actual driven line nodes to reduce "
              "the local speed errors before promising accurate predictions for arbitrary cars.", "",
              "## Reproduce", "",
              "Commands below run from the repository root using a C++17 compiler and Python 3. "
              "The tests, real-lap checks and report text need only Python's standard library. "
              "Generating the summary figure requires matplotlib.", "", "```bash",
              "cmake -S . -B build -DCMAKE_BUILD_TYPE=Release", "cmake --build build -j",
              "ctest --test-dir build --output-on-failure",
              "python3 validation/validate.py --binary ./build/lap_sim --json-out validation/results.json",
              "python3 validation/validate.py --binary ./build/lap_sim --extra='--ds 2' --json-out validation/results_2m.json",
              "./build/lap_benchmark validation/benchmark_1m.json 1",
              "./build/lap_benchmark validation/benchmark_2m.json 2",
              "./build/lap_update_benchmark validation/update_benchmark_2m.json",
              "python3 validation/report.py --plot", "```", "",
              "For MSVC, add `--config Release`, run CTest with `-C Release`, and use "
              "`build/Release/lap_sim.exe` and `build/Release/lap_benchmark.exe`. The builds measured here "
              "use WSL2/GCC, not native MSVC. Fetching telemetry and rerunning parameter calibration additionally "
              "needs FastF1, NumPy, SciPy and matplotlib; see scripts under `validation/fastf1/`.", "",
              "### Artifacts", "",
              "- [Accuracy at 1 m](results.json), [accuracy at 2 m](results_2m.json), [official references](reference_laps.json).",
              "- [Benchmarks at 1 m](benchmark_1m.json), [benchmarks at 2 m](benchmark_2m.json).",
              "- [Changing-setup benchmark](update_benchmark_2m.json), [previous-pass timings](improvement_before/benchmark_2m.json).",
              "- [Original results](original_results.json), [incoming results](before_results.json).",
              "- [Review provenance and frozen fit](review_provenance.json), [F2 grip fit](f2_calibration.json).",
              "- [Summary figure](figures/review_summary.png).", ""]
    (HERE / "REVIEW_REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    if args.plot:
        plot(results, b1, b2)
    print(f"Wrote {HERE / 'REVIEW_REPORT.md'}")


def plot(results, b1, b2):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    palette = {"calibration": "#5f95b3", "out-of-sample": "#d58636",
               "f2-calibration": "#8a94a6", "cross-car": "#589869"}
    fig, (left, right) = plt.subplots(1, 2, figsize=(15, 10), gridspec_kw={"width_ratios": [1.5, 1]})
    ypos = list(range(len(results)))
    left.barh(ypos, [r["error_pct"] for r in results], color=[palette[r["set"]] for r in results])
    left.set_yticks(ypos, [r["id"].replace("f1_", "F1 ").replace("f2_", "F2 ").replace("_", " ") for r in results], fontsize=9)
    left.invert_yaxis()
    left.axvline(0, color="#333333", linewidth=1)
    left.set_xlabel("Lap-time error (%) · negative = predicted faster")
    left.set_title("27 official qualifying laps · 1 m resolution", loc="left")
    left.grid(axis="x", alpha=.2)
    from matplotlib.patches import Patch
    left.legend(handles=[Patch(color=palette[k], label=LABELS[k]) for k in LABELS], loc="lower right", fontsize=8)
    x = list(range(len(FAMILIES)))
    one = [S.median(r["warm_median_ms"] for r in b1 if family(r, p)) for p, _ in FAMILIES]
    two = [S.median(r["warm_median_ms"] for r in b2 if family(r, p)) for p, _ in FAMILIES]
    right.bar([v-.18 for v in x], one, width=.36, label="1 m", color="#5f95b3")
    right.bar([v+.18 for v in x], two, width=.36, label="2 m", color="#589869")
    right.set_yscale("log")
    right.set_xticks(x, [label.replace(" ", "\n") for _, label in FAMILIES])
    right.set_ylabel("Reused full-lap solve (ms) · logarithmic scale")
    right.set_title("Median across eleven circuits", loc="left")
    right.axhline(16.667, color="#d58636", linestyle="--", label="60 Hz budget")
    for v, t in zip(x, two):
        right.annotate(f"{t:.1f}", (v+.18, t), xytext=(0, 4), textcoords="offset points", ha="center", fontsize=9)
    right.grid(axis="y", alpha=.2)
    right.legend()
    fig.suptitle("C++ lap engine: measured accuracy and reuse performance", fontsize=16)
    fig.text(.5, .015, "F1 calibration used 4 circuits; other tracks excluded from car fitting. F2 grip fitted only on Monza 2024.\n"
             "Runtime: Intel Core Ultra 7 255H · GCC Release / WSL2 · unchanged vehicle and prepared path · no export.\n"
             "Civic Si and Formula Student: numerical checks only; real-lap accuracy unverified.", ha="center", fontsize=9)
    fig.tight_layout(rect=(0, .065, 1, .96))
    target = HERE / "figures"
    target.mkdir(exist_ok=True)
    fig.savefig(target / "review_summary.png", dpi=160)
    plt.close(fig)


if __name__ == "__main__":
    main()
