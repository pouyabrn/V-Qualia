#!/usr/bin/env python3
"""Regenerate validation/reference_laps.json (used by the stdlib-only validate.py) from data/summary.json."""
import json
import os
import sys

import common as C

def main():
    summary = C.load_summary()
    with open(os.path.join(C.ENGINE, "validation", "f2_reference_laps.json")) as handle:
        f2_cases = json.load(handle)["cases"]
    with open(os.path.join(C.ENGINE, "validation", "official_sources.json")) as handle:
        official_sources = json.load(handle)
    cases = []
    for key, info in sorted(summary.items(), key=lambda kv: (kv[1]["track"] not in C.CALIBRATION_TRACKS, kv[0])):
        if info["wet"]:
            continue
        track_key, year = info["track"], info["year"]
        cases.append({
            "id": f"f1_{key}",
            "set": "calibration" if track_key in C.CALIBRATION_TRACKS else "out-of-sample",
            "event": f"{year} {info['event']} Q",
            "driver": f"{info['driver']}, {info['team']}",
            "track": C.track_file(track_key).replace(os.sep, "/"),
            "vehicle": C.car_file(year, C.TRACKS[track_key][2]).replace(os.sep, "/"),
            "real_lap_s": round(info["lap_time_s"], 3),
            "args": ["--air-density", f"{info['air_density']:.3f}"],
            "source": official_sources[f"f1_{key}"],
            "timing_note": "Fastest valid dry lap across Q1/Q2/Q3, not necessarily the pole lap; telemetry via FastF1.",
        })
    for case in f2_cases:
        case = dict(case)
        rho = summary[case.pop("air_from")]["air_density"]
        case["args"] = ["--air-density", f"{rho:.3f}"]
        cases.append(case)
    out = {
        "description": "Real qualifying laps used to validate the C++ engine. 'calibration' cases were used to identify "
                       "the F1 car parameters, 'out-of-sample' tracks were not used in the F1 fit. F2 grip is "
                       "calibrated on Monza 2024 only; 'cross-car' cases use the frozen F2 grip with estimated "
                       "aero packages. Air density from F1 session weather (a proxy for F2).",
        "cases": cases,
    }
    path = os.path.join(C.ENGINE, "validation", "reference_laps.json")
    with open(path, "w") as handle:
        json.dump(out, handle, indent=2)
        handle.write("\n")
    print(f"wrote {len(cases)} cases to {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
