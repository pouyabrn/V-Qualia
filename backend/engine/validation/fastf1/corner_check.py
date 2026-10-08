#!/usr/bin/env python3
"""
Corner-by-corner diagnostic: real driven radius (FastF1 positions) vs the engine's racing line
and the raw centreline, with apex speeds and local track width.

    python3 validation/fastf1/corner_check.py silverstone 2025 [extra lap_sim args]
"""
import csv
import os
import subprocess
import sys
import tempfile

import fastf1
import numpy as np
from scipy.interpolate import make_smoothing_spline

import common as C

N = 6000


def real_trace(track_key, year):
    fastf1.Cache.enable_cache(C.CACHE)
    fastf1.set_log_level("ERROR")
    session = fastf1.get_session(year, C.TRACKS[track_key][1], "Q")
    session.load(laps=True, telemetry=True, weather=False, messages=False)
    lap = session.laps.pick_fastest()
    pos = lap.get_pos_data()
    t = pos["SessionTime"].dt.total_seconds().to_numpy()
    keep = np.concatenate([[True], np.diff(t) > 1e-3])
    t = t[keep]
    x = pos["X"].to_numpy(dtype=float)[keep] / 10.0
    y = pos["Y"].to_numpy(dtype=float)[keep] / 10.0
    sx, sy = make_smoothing_spline(t, x), make_smoothing_spline(t, y)
    tt = np.linspace(t[0], t[-1], 4 * N)
    dx, dy = sx.derivative(1)(tt), sy.derivative(1)(tt)
    ddx, ddy = sx.derivative(2)(tt), sy.derivative(2)(tt)
    sp = np.hypot(dx, dy)
    kappa = (dx * ddy - dy * ddx) / sp ** 3
    dist = np.concatenate([[0.0], np.cumsum(0.5 * (sp[1:] + sp[:-1]) * np.diff(tt))])
    grid = np.linspace(0, 1, N, endpoint=False)
    car = lap.get_car_data().add_distance()
    v = np.interp(grid, car["Distance"].to_numpy() / car["Distance"].to_numpy()[-1], car["Speed"].to_numpy())
    return np.interp(grid, dist / dist[-1], kappa), v, dist[-1]


def main():
    track_key, year = sys.argv[1], int(sys.argv[2])
    extra = sys.argv[3:]
    info = C.load_summary()[C.session_key(track_key, year)]
    kr, vr, real_len = real_trace(track_key, year)
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "line.csv")
        cmd = [C.BINARY, C.track_file(track_key), C.car_file(year, C.TRACKS[track_key][2]), "--quiet", "--no-output",
               "--air-density", f"{info['air_density']:.4f}", "--line-csv", out, *extra]
        subprocess.run(cmd, cwd=C.ENGINE, check=True, capture_output=True)
        rows = list(csv.DictReader(open(out)))
        center = os.path.join(tmp, "center.csv")
        subprocess.run(cmd[:-len(extra) - 2 if extra else -2] + ["--line-csv", center, "--line", "center"],
                       cwd=C.ENGINE, check=True, capture_output=True)
        crow = list(csv.DictReader(open(center)))
    s = np.array([float(r["s_m"]) for r in rows])
    ks = np.array([float(r["kappa_inv_m"]) for r in rows])
    vs = np.array([float(r["v_kmh"]) for r in rows])
    width = np.array([float(r["w_left_m"]) + float(r["w_right_m"]) for r in rows])
    sim_len = s[-1] + (s[1] - s[0])
    g = np.linspace(0, 1, N, endpoint=False)
    ks_g = np.interp(g, s / sim_len, ks, period=1.0)
    vs_g = np.interp(g, s / sim_len, vs, period=1.0)
    w_g = np.interp(g, s / sim_len, width, period=1.0)
    cs = np.array([float(r["s_m"]) for r in crow])
    kc = np.array([float(r["kappa_inv_m"]) for r in crow])
    kc_g = np.interp(g, cs / (cs[-1] + cs[1] - cs[0]), kc, period=1.0)
    # align sim and centreline onto the real lap by curvature (sign handled by the best correlation)
    sign = 1.0
    k1, c1 = C.circular_shift(kr, ks_g)
    k2, c2 = C.circular_shift(kr, -ks_g)
    if c2 > c1:
        sign, k1 = -1.0, k2
    ks_g, vs_g, w_g = np.roll(sign * ks_g, k1), np.roll(vs_g, k1), np.roll(w_g, k1)
    kc_g = np.roll(sign * kc_g, C.circular_shift(kr, sign * kc_g)[0])
    print(f"{track_key} {year}: real lap {info['lap_time_s']:.3f}s path {real_len:.0f} m | sim line {sim_len:.0f} m")
    print("   s_real  v_real  v_sim |  R_real  R_sim  R_centre | width | turn_real turn_sim [deg]")
    absr = np.abs(kr)
    inside = absr > 1 / 400
    i = 0
    h = real_len / N
    while i < N:
        if not inside[i]:
            i += 1
            continue
        j = i
        while j < N and inside[j]:
            j += 1
        seg = np.arange(i, j)
        if (j - i) * h > 25:
            a = seg[np.argmax(absr[seg])]
            print(f"   {g[a] * real_len:6.0f}  {vr[seg].min():6.0f} {vs_g[seg].min():6.0f} | {1 / absr[seg].max():7.1f} "
                  f"{1 / np.abs(ks_g[seg]).max():6.1f} {1 / np.abs(kc_g[seg]).max():8.1f} | {w_g[a]:5.1f} | "
                  f"{np.degrees(np.sum(kr[seg]) * h):9.1f} {np.degrees(np.sum(ks_g[seg]) * h):8.1f}")
        i = j


if __name__ == "__main__":
    main()
