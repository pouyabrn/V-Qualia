#!/usr/bin/env python3
"""
Compare C++ engine laps with real qualifying laps (speed traces, lap time, corner minima).

    python3 validation/fastf1/compare.py [--filter spielberg] [--plot] [--cars-dir examples]

Uses data/summary.json and data/<track>_<year>_lap.csv written by fetch.py and the
car files f1_<year>_quali_<package>.json (package per track from common.TRACKS).
"""
import argparse
import os
import sys

import numpy as np

import common as C

N = 4000


def corner_minima(v, window):
    """Indices of local speed minima that are the lowest value within +-window samples."""
    out = []
    n = len(v)
    for i in range(n):
        seg = [v[(i + k) % n] for k in range(-window, window + 1)]
        if v[i] == min(seg) and max(seg) - v[i] > 15 and (not out or i - out[-1] > window):
            out.append(i)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--filter", default="")
    ap.add_argument("--plot", action="store_true")
    ap.add_argument("--cars-dir", default="examples")
    ap.add_argument("--extra", default="", help="extra lap_sim arguments")
    args = ap.parse_args()
    summary = C.load_summary()

    rows = []
    for key, info in sorted(summary.items(), key=lambda kv: (kv[1]["track"] not in C.CALIBRATION_TRACKS, kv[0])):
        if args.filter not in key or info["wet"]:
            continue
        track_key, year = info["track"], info["year"]
        package = C.TRACKS[track_key][2]
        extra = ["--air-density", f"{info['air_density']:.4f}"] + args.extra.split()
        s, tel = C.run_engine(C.track_file(track_key), C.car_file(year, package, args.cars_dir), extra, telemetry=True)
        lap = np.genfromtxt(os.path.join(C.DATA, f"{key}_lap.csv"), delimiter=",", names=True)
        real_v = C.resample_speed(lap["Distance"] / lap["Distance"][-1], lap["Speed"], N)
        sim_v = C.align_traces(real_v, C.resample_speed(tel["arc_length_m"] / s["line_length_m"], tel["speed_kmh"], N))
        rms = float(np.sqrt(np.mean((sim_v - real_v) ** 2)))
        err = 100.0 * (s["lap_time_s"] - info["lap_time_s"]) / info["lap_time_s"]
        win = int(N * 100.0 / info["lap_distance_m"])
        minima = [(real_v[i], float(np.min([sim_v[(i + k) % N] for k in range(-win, win + 1)])))
                  for i in corner_minima(real_v, win)]
        role = "calibration" if track_key in C.CALIBRATION_TRACKS else "OUT-OF-SAMPLE"
        rows.append((key, role, info, s, err, rms, minima))
        print(f"{key:<17} {role:<13} real {info['lap_time_s']:8.3f}  sim {s['lap_time_s']:8.3f}  err {err:+6.2f}%  "
              f"rms {rms:5.1f} km/h  vmax {info['max_speed_kmh']:5.1f}/{s['top_speed_kmh']:5.1f}  "
              f"apex real/sim: " + " ".join(f"{a:.0f}/{b:.0f}" for a, b in minima), flush=True)

        if args.plot:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            x = np.linspace(0.0, info["lap_distance_m"], N, endpoint=False)
            fig, ax = plt.subplots(figsize=(13, 4.0))
            ax.plot(x, real_v, lw=1.4, label=f"real: {info['driver']} {info['lap_time_s']:.3f} s")
            ax.plot(x, sim_v, lw=1.2, label=f"C++ engine: {s['lap_time_s']:.3f} s ({err:+.2f} %)")
            ax.set_title(f"{info['year']} {info['event']} qualifying - {role.lower()} - speed RMS {rms:.1f} km/h")
            ax.set_xlabel("distance [m]")
            ax.set_ylabel("speed [km/h]")
            ax.grid(alpha=0.3)
            ax.legend(loc="lower right")
            fig.tight_layout()
            os.makedirs(C.PLOTS, exist_ok=True)
            fig.savefig(os.path.join(C.PLOTS, f"{key}.png"), dpi=100)
            plt.close(fig)

    for role in ("calibration", "OUT-OF-SAMPLE"):
        errs = np.array([r[4] for r in rows if r[1] == role])
        rmss = np.array([r[5] for r in rows if r[1] == role])
        if len(errs):
            print(f"{role:<13} n={len(errs):2d}  mean {errs.mean():+.2f}%  mean|err| {np.abs(errs).mean():.2f}%  "
                  f"max|err| {np.abs(errs).max():.2f}%  mean speed rms {rmss.mean():.1f} km/h")
    return 0


if __name__ == "__main__":
    sys.exit(main())
