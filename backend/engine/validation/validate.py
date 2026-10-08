#!/usr/bin/env python3
"""
Validate simulated lap times against real-world reference laps.

Every number reported here is computed by the C++ engine (build/lap_sim); this
script only launches it, reads the machine-readable summary it writes, and
compares the result with the reference lap time.

Usage:
    python3 validation/validate.py                       # all cases
    python3 validation/validate.py --filter monza        # subset (substring match on id)
    python3 validation/validate.py --binary build/lap_sim --max-mae 1.5
    python3 validation/validate.py --extra "--mu-scale 1.01"
"""
import argparse
import json
import math
import os
import shlex
import statistics
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def fmt_time(seconds):
    minutes = int(seconds // 60)
    return f"{minutes}:{seconds - 60 * minutes:06.3f}"


def run_case(binary, case, extra_args):
    with tempfile.TemporaryDirectory() as tmp:
        summary_path = os.path.join(tmp, "summary.json")
        cmd = [binary, case["track"], case["vehicle"], "--quiet", "--no-output", "--summary-json", summary_path]
        if case.get("drs_zones"):
            cmd += ["--drs-zones", case["drs_zones"]]
        cmd += case.get("args", [])
        cmd += extra_args
        t0 = time.perf_counter()
        proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=120)
        wall = time.perf_counter() - t0
        if proc.returncode != 0:
            raise RuntimeError(f"{case['id']}: lap_sim failed ({proc.returncode}): {proc.stderr.strip()}")
        with open(summary_path) as handle:
            summary = json.load(handle)
        summary["wall_s"] = wall
        summary["stdout_lap"] = float(proc.stdout.strip().splitlines()[-1])
        for field in ("lap_time_s", "top_speed_kmh", "min_speed_kmh", "solve_ms"):
            if not isinstance(summary.get(field), (int, float)) or not math.isfinite(summary[field]) or summary[field] <= 0:
                raise RuntimeError(f"{case['id']}: invalid {field}: {summary.get(field)}")
        if abs(summary["stdout_lap"] - summary["lap_time_s"]) > 0.00051:
            raise RuntimeError(f"{case['id']}: stdout and summary lap times disagree")
        budget = summary.get("ers_budget_mj")
        if budget is not None and summary["ers_energy_mj"] > budget * 1.001 + 1e-6:
            raise RuntimeError(f"{case['id']}: ERS budget exceeded")
        return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--binary", default=os.path.join(ROOT, "build", "lap_sim"))
    parser.add_argument("--reference", default=os.path.join(HERE, "reference_laps.json"))
    parser.add_argument("--filter", default="", help="substring filter on case id")
    parser.add_argument("--set", default="", help="case group: calibration, out-of-sample, f2-calibration, cross-car")
    parser.add_argument("--extra", default="", help="extra lap_sim arguments for every case")
    parser.add_argument("--max-mae", type=float, default=None, help="fail if mean |error| %% exceeds this")
    parser.add_argument("--max-error", type=float, default=None, help="fail if any |error| %% exceeds this")
    parser.add_argument("--json-out", default=None, help="write per-case results to this JSON file")
    args = parser.parse_args()

    with open(args.reference) as handle:
        reference = json.load(handle)
    cases = [c for c in reference["cases"]
             if args.filter in c["id"] and (not args.set or c.get("set", "") == args.set)]
    if not cases:
        print("No cases selected", file=sys.stderr)
        return 2

    extra = shlex.split(args.extra)
    header = (f"{'case':<24} {'set':<13} {'reference lap':<40} {'real':>9} {'sim':>9} {'delta':>8} {'err%':>7} "
              f"{'vmax':>6} {'ms':>5}")
    print(header)
    print("-" * len(header))
    results = []
    for case in cases:
        summary = run_case(args.binary, case, extra)
        sim = summary["lap_time_s"]
        real = case["real_lap_s"]
        err = 100.0 * (sim - real) / real
        results.append({"id": case["id"], "set": case.get("set", ""), "real": real, "sim": sim,
                        "error_pct": err, "summary": summary})
        label = f"{case['event']} ({case['driver']})"
        print(f"{case['id']:<24} {case.get('set', ''):<13} {label[:40]:<40} {fmt_time(real):>9} {fmt_time(sim):>9} "
              f"{sim - real:>+8.3f} {err:>+7.2f} {summary['top_speed_kmh']:>6.1f} {summary['solve_ms']:>5.0f}")

    print("-" * len(header))
    groups = {}
    for r in results:
        groups.setdefault(r["set"], []).append(r["error_pct"])
    for name, errs in groups.items():
        print(f"{name or 'all':<13} cases={len(errs):2d}  mean error={statistics.fmean(errs):+.2f}%  "
              f"mean |error|={statistics.fmean(abs(e) for e in errs):.2f}%  max |error|={max(abs(e) for e in errs):.2f}%")
    errors = [r["error_pct"] for r in results]
    mae = statistics.fmean(abs(e) for e in errors)

    if args.json_out:
        with open(args.json_out, "w") as handle:
            json.dump(results, handle, indent=2)
    if args.max_mae is not None and mae > args.max_mae:
        print(f"FAIL: mean |error| {mae:.2f}% > {args.max_mae:.2f}%")
        return 1
    if args.max_error is not None and max(abs(e) for e in errors) > args.max_error:
        print(f"FAIL: maximum |error| exceeds {args.max_error:.2f}%")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
