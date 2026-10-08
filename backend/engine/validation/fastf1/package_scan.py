#!/usr/bin/env python3
"""Lap time of every session with every aero package (diagnostic for wing-level choice)."""
import sys
from concurrent.futures import ThreadPoolExecutor

import common as C


def main():
    summary = C.load_summary()
    keys = [k for k, v in sorted(summary.items()) if not v["wet"] and (len(sys.argv) < 2 or sys.argv[1] in k)]

    def job(key):
        info = summary[key]
        laps = {}
        for pkg in C.PACKAGES:
            s, _ = C.run_engine(C.track_file(info["track"]), C.car_file(info["year"], pkg),
                                ["--air-density", f"{info['air_density']:.4f}"])
            laps[pkg] = s["lap_time_s"]
        return key, info, laps

    with ThreadPoolExecutor(max_workers=12) as pool:
        for key, info, laps in pool.map(job, keys):
            best = min(laps, key=laps.get)
            real = info["lap_time_s"]
            assigned = C.TRACKS[info["track"]][2]
            print(f"{key:<17} real {real:7.3f} | " + " ".join(
                f"{p}:{laps[p]:7.3f}({100 * (laps[p] - real) / real:+5.2f}%)" for p in C.PACKAGES) +
                f" | fastest={best:<8} assigned={assigned}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
