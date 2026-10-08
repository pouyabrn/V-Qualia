#!/usr/bin/env python3
"""Compare the original repository presets with current calibrated configurations.

This compares whole configurations, not an isolated algorithm change: the old
engine cannot read the newer axle/ERS/DRS parameters or weather options.
"""
import argparse
import json
import os
import re
import subprocess
import tempfile
from validate import ROOT


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--original", required=True)
    p.add_argument("--json-out", required=True)
    args = p.parse_args()
    with open(os.path.join(ROOT, "validation", "reference_laps.json")) as f:
        cases = [c for c in json.load(f)["cases"] if c["set"] == "calibration"]
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for c in cases:
            year = c["id"][-4:]
            package = "_monza" if "monza" in c["id"] else ("_monaco" if "zandvoort" in c["id"] else "")
            car = f"examples/f1_{year}{package}.json"
            proc = subprocess.run([args.original, c["track"], car, "--csv", os.path.join(tmp, "tel.csv"),
                                   "--ggv", os.path.join(tmp, "ggv.csv")], cwd=ROOT, text=True,
                                  capture_output=True, timeout=120)
            if proc.returncode:
                raise RuntimeError(proc.stderr)
            match = re.search(r"OPTIMAL LAP TIME:\s+([0-9.]+)", proc.stdout)
            if not match:
                raise RuntimeError("Could not parse original engine output")
            sim = float(match[1])
            rows.append({"id": c["id"], "original_vehicle": car, "real_s": c["real_lap_s"],
                         "original_s": sim, "original_error_pct": 100 * (sim - c["real_lap_s"]) / c["real_lap_s"]})
    with open(args.json_out, "w") as f:
        json.dump(rows, f, indent=2)
    print(f"Fresh original-engine comparison: {len(rows)} cases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
