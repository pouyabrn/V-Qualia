#!/usr/bin/env python3
"""Fit one F2 grip multiplier on Monza 2024, freeze it for all other tracks.

Aero package values are declared estimates and are never fitted to the holdouts.
Only uses the Python standard library. Writes car presets only with --write.
"""
import argparse
import copy
import json
import os
import tempfile
from validate import ROOT, run_case


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--binary", default=os.path.join(ROOT, "build", "lap_sim"))
    p.add_argument("--write", action="store_true")
    args = p.parse_args()
    with open(os.path.join(ROOT, "examples", "f2_2024_quali_monza.json")) as f:
        base = json.load(f)
    with open(os.path.join(ROOT, "validation", "reference_laps.json")) as f:
        case = next(c for c in json.load(f)["cases"] if c["id"] == "f2_monza_2024")
    with tempfile.TemporaryDirectory() as tmp:
        cache = os.path.join(tmp, "line.txt")
        lo, hi = 0.8, 1.1
        for _ in range(16):
            scale = (lo + hi) / 2
            summary = run_case(args.binary, case, ["--line-cache", cache,
                               "--set", f"tire.mu_x={1.7 * scale:.10f}",
                               "--set", f"tire.mu_y={1.8 * scale:.10f}"])
            if summary["lap_time_s"] > case["real_lap_s"]:
                lo = scale
            else:
                hi = scale
        scale = (lo + hi) / 2
    print(f"Monza 2024 only: F2 grip multiplier {scale:.7f}")
    if args.write:
        for package, cla, cda in (("monza", 3.4, 0.98), ("mediumdf", 5.0, 1.35), ("highdf", 6.0, 1.60)):
            car = copy.deepcopy(base)
            car["name"] = "F2_2024_Quali_" + package
            car["notes"] = ("2024-generation Dallara F2 car, published 795 kg with driver + 5 kg fuel, "
                            "620 hp at 8750 rpm, 570 Nm at 6000 rpm. One common tyre grip multiplier "
                            "fitted only to Monza 2024 qualifying (92.160 s). No other F2 lap used to "
                            "fit any parameter. Aero ClA/CdA are engineering estimates: Monza 3.4/0.98, "
                            "medium 5.0/1.35, high 6.0/1.60; no manufacturer aero map is available. "
                            "F1 session weather and DRS-zone sidecars are proxies for F2. "
                            "Source: https://www.fiaformula2.com/en/information/the-car-and-engine-f2.14LCsEEMG9yyx5DkhcN1J8")
            car["tire"]["mu_x"] = round(1.7 * scale, 7)
            car["tire"]["mu_y"] = round(1.8 * scale, 7)
            car["aerodynamics"]["ClA"] = cla
            car["aerodynamics"]["CdA"] = cda
            with open(os.path.join(ROOT, "examples", f"f2_2024_quali_{package}.json"), "w") as f:
                json.dump(car, f, indent=2)
                f.write("\n")
        with open(os.path.join(ROOT, "validation", "f2_calibration.json"), "w") as f:
            json.dump({"calibration_case": case["id"], "reference_lap_s": case["real_lap_s"],
                       "grip_scale": scale, "mu_x": 1.7 * scale, "mu_y": 1.8 * scale,
                       "holdout_cases_used_for_fit": [],
                       "aero_packages": {"monza": [3.4, 0.98], "mediumdf": [5.0, 1.35], "highdf": [6.0, 1.60]}},
                      f, indent=2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
