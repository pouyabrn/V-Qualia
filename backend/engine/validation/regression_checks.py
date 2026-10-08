#!/usr/bin/env python3
"""Input rejection, cache invalidation and lazy-export integration checks."""
import argparse
import csv
import json
import os
import subprocess
import tempfile
from physics_checks import ROOT, POINT_MASS_CAR, circle_points, write_track


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--binary", default=os.path.join(ROOT, "build", "lap_sim"))
    args = p.parse_args()
    count = 0
    with tempfile.TemporaryDirectory() as tmp:
        track = os.path.join(tmp, "circle.csv")
        car = os.path.join(tmp, "car.json")
        write_track(track, circle_points(60), 6)
        with open(car, "w") as f:
            json.dump(POINT_MASS_CAR, f)

        def invoke(*extra, good=True):
            nonlocal count
            proc = subprocess.run([args.binary, track, car, "--quiet", "--no-output", *extra],
                                  cwd=ROOT, capture_output=True, text=True, timeout=30)
            count += 1
            if (proc.returncode == 0) != good:
                raise RuntimeError(f"Unexpected status for {extra}: {proc.stdout} {proc.stderr}")
            return proc

        for extra in (("--ds", "nan"), ("--ds", "0"), ("--line-tol", "-1"),
                      ("--edge-margin", "inf"), ("--air-density", "nan"), ("--mu-scale", "nan"),
                      ("--iterations", "0"), ("--tolerance", "0"), ("--tolerance", "nan"),
                      ("--set", "mass.mass=nan"), ("--set", "mass.mass=oops"),
                      ("--set", "powertrain.gear_ratios=[0]"),
                      ("--set", "powertrain.engine_torque_curve={\"1000\":-10}")):
            invoke(*extra, good=False)

        cache = os.path.join(tmp, "line.cache")
        original = invoke("--line-cache", cache).stdout.strip()
        same = invoke("--line-cache", cache).stdout.strip()
        if original != same:
            raise RuntimeError("Disk-cache reuse changed the lap")
        # A cyclic rotation preserves the old additive checksum. An ordered hash
        # must invalidate it, even though a circle's lap time stays the same.
        with open(cache) as f:
            key_before = f.readline()
        points = circle_points(60)
        write_track(track, points[1:] + points[:1], 6)
        invoke("--line-cache", cache)
        with open(cache) as f:
            if f.readline() == key_before:
                raise RuntimeError("Permuted track reused a stale cache")
        # Corrupt payload with a valid current key must trigger a rebuild.
        with open(cache) as f:
            key = f.readline()
        with open(cache, "w") as f:
            f.write(key + "999999999999 1 1 0 0 0\n")
        invoke("--line-cache", cache)
        ggv = os.path.join(tmp, "ggv.csv")
        invoke("--ggv", ggv)
        with open(ggv) as f:
            if not f.readline().startswith("velocity_ms,") or not f.readline():
                raise RuntimeError("Lazy GGV export is empty")
        with open(ggv + ".meta.json") as f:
            if json.load(f)["ers_peak_assistance"]:
                raise RuntimeError("Non-hybrid car GGV claimed ERS")
        # Hybrid peak, combustion-only, and the lap-wide disable flag must be
        # consistent in both envelope values and the accompanying conditions.
        def envelope(*extra):
            invoke("--ggv", ggv, "--set", "powertrain.ers.max_power_kw=120",
                   "--set", "powertrain.engine_torque_curve={\"1000\":100,\"20000\":100}", *extra)
            with open(ggv + ".meta.json") as f:
                meta = json.load(f)
            with open(ggv) as f:
                rows = list(csv.DictReader(f))
            if not any(r["brake_feasible"] == "0" for r in rows):
                raise RuntimeError("GGV failed to flag infeasible lateral demand")
            return meta, [float(r["max_accel_ms2"]) for r in rows]
        peak_meta, peak = envelope()
        combustion_meta, combustion = envelope("--ggv-no-ers")
        disabled_meta, disabled = envelope("--no-ers")
        if not peak_meta["ers_peak_assistance"] or combustion_meta["ers_peak_assistance"] or disabled_meta["ers_peak_assistance"]:
            raise RuntimeError("GGV ERS conditions disagree with export flags")
        if combustion != disabled or not any(a > b + 0.01 for a, b in zip(peak, combustion)):
            raise RuntimeError("GGV ERS envelope does not reflect deployment selection")
    print(f"PASS: {count} input/cache/export checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
