#!/usr/bin/env python3
"""
Fetch real F1 qualifying reference data with FastF1 and derive track sidecars.

For every track in common.TRACKS and every season in common.YEARS this script
  * loads the fastest qualifying lap (car data: speed, throttle, brake, gear, rpm, DRS)
    and writes it to data/<track>_<year>_lap.csv
  * computes air density from the session weather around that lap and flags wet laps
  * aligns the lap's position trace (X/Y) with the TUMFTM centreline by curvature
    cross-correlation, then maps the measured DRS-open intervals and the elevation (Z)
    onto the centreline distance
  * downloads missing TUMFTM centrelines (racetrack-database, LGPL-3.0)

Outputs data/summary.json and (unless --no-sidecars) examples/<Track>.drs.csv and
examples/<Track>.elevation.csv. Requires: fastf1, numpy (pip install fastf1).

    python3 validation/fastf1/fetch.py [track ...]
"""
import argparse
import json
import os
import sys
import urllib.request

import numpy as np

import common as C

N = 4000          # samples per lap used for alignment
SIGMA_Z = 20.0    # elevation smoothing (m)


def ensure_track(track_key):
    stem = C.TRACKS[track_key][0]
    path = os.path.join(C.EXAMPLES, stem + ".csv")
    if not os.path.exists(path):
        url = C.TUMFTM_URL.format(C.TUMFTM_NAMES.get(track_key, stem))
        print(f"  downloading {url}")
        with urllib.request.urlopen(url, timeout=60) as response, open(path, "wb") as handle:
            handle.write(response.read())
    data = np.genfromtxt(path, delimiter=",", comments="#")
    return path, data


def centreline_curvature(data):
    xs, ys, length = C.resample_closed(data[:, 0], data[:, 1], N)
    return C.curvature_closed(xs, ys, length), length


def air_density(temp_c, pressure_mbar, humidity_pct):
    """Moist-air density (Tetens saturation pressure)."""
    t_k = temp_c + 273.15
    p_sat = 6.1078 * 10 ** (7.5 * temp_c / (temp_c + 237.3)) * 100.0
    p_v = humidity_pct / 100.0 * p_sat
    p_d = pressure_mbar * 100.0 - p_v
    return p_d / (287.058 * t_k) + p_v / (461.495 * t_k)


def open_intervals(mask, min_len, merge_gap):
    """Circular runs of True in a boolean array -> list of (start, end) sample indices (end exclusive)."""
    n = len(mask)
    if mask.all():
        return [(0, n)]
    if not mask.any():
        return []
    start = int(np.argmin(mask))  # begin scanning at a closed sample
    runs, i = [], 0
    while i < n:
        j = (start + i) % n
        if mask[j]:
            k = i
            while k < n and mask[(start + k) % n]:
                k += 1
            runs.append([j, j + (k - i)])
            i = k
        else:
            i += 1
    merged = []
    for run in runs:
        if merged and run[0] - merged[-1][1] <= merge_gap:
            merged[-1][1] = run[1]
        else:
            merged.append(run)
    return [(a % n, b % n) for a, b in merged if b - a >= min_len]


def process_session(track_key, year, centre_k, centre_len):
    import fastf1

    stem, event, _ = C.TRACKS[track_key]
    session = fastf1.get_session(year, event, "Q")
    session.load(laps=True, telemetry=True, weather=True, messages=False)
    lap = session.laps.pick_fastest()
    lap_time = lap["LapTime"].total_seconds()

    car = lap.get_car_data().add_distance()
    dist = car["Distance"].to_numpy(dtype=float)
    speed = car["Speed"].to_numpy(dtype=float)
    t_lap = car["Time"].dt.total_seconds().to_numpy()

    weather = session.weather_data
    window = weather[(weather["Time"] >= lap["LapStartTime"] - np.timedelta64(300, "s")) &
                     (weather["Time"] <= lap["Time"] + np.timedelta64(60, "s"))]
    if window.empty:
        window = weather
    wet = bool(window["Rainfall"].any()) or str(lap["Compound"]).upper() in ("INTERMEDIATE", "WET")
    t_air = float(window["AirTemp"].median())
    pressure = float(window["Pressure"].median())
    humidity = float(window["Humidity"].median())
    rho = air_density(t_air, pressure, humidity)

    # --- position trace: curvature for alignment, Z for elevation --------------------------
    pos = lap.get_pos_data()
    keep = np.concatenate([[True], np.diff(pos["SessionTime"].dt.total_seconds().to_numpy()) > 1e-3])
    px = pos["X"].to_numpy(dtype=float)[keep] / 10.0
    py = pos["Y"].to_numpy(dtype=float)[keep] / 10.0
    pz = pos["Z"].to_numpy(dtype=float)[keep] / 10.0
    finite = np.isfinite(px) & np.isfinite(py) & np.isfinite(pz)
    px, py, pz = px[finite], py[finite], pz[finite]
    step = np.hypot(np.diff(px), np.diff(py))
    moving = np.concatenate([[True], step > 0.05])
    px, py, pz = px[moving], py[moving], pz[moving]
    xs, ys, path_len = C.resample_closed(px, py, N)
    kf = C.curvature_closed(xs, ys, path_len)

    variants = {"same": kf, "mirrored": -kf, "reversed": -kf[::-1], "reversed_mirrored": kf[::-1]}
    best = max(((name,) + C.circular_shift(centre_k, sig) for name, sig in variants.items()), key=lambda r: r[2])
    variant, shift, corr = best
    if variant.startswith("reversed"):
        raise RuntimeError(f"{track_key}: centreline runs against the race direction (corr {corr:.2f})")
    u_offset = shift / N  # centreline fraction = lap fraction + offset

    # elevation on the lap fraction grid, closed (drift removed), relative to the mean
    s_pos = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(px), np.diff(py)))])
    grid_f = np.linspace(0.0, 1.0, N, endpoint=False)
    zf = np.interp(grid_f, s_pos / s_pos[-1], pz)
    zf = zf - (zf[-1] - zf[0]) * grid_f
    zf = C.periodic_gaussian(zf, SIGMA_Z / (path_len / N))
    zf -= zf.mean()

    # DRS open intervals (car data), circular, mapped onto the centreline
    drs_open = car["DRS"].to_numpy(dtype=float) >= 10
    u_car = dist / dist[-1]
    idx = np.clip(np.searchsorted(u_car, grid_f), 0, len(u_car) - 1)
    mask = drs_open[idx]
    m_per_sample = centre_len / N
    zones = []
    for a, b in open_intervals(mask, min_len=int(60 / m_per_sample), merge_gap=int(30 / m_per_sample)):
        s0 = ((a / N + u_offset) % 1.0) * centre_len
        s1 = ((b / N + u_offset) % 1.0) * centre_len
        zones.append((round(s0), round(s1)))

    os.makedirs(C.DATA, exist_ok=True)
    out = car[["Distance", "Speed", "Throttle", "Brake", "nGear", "RPM", "DRS"]].copy()
    out.insert(0, "Time", t_lap)
    out.to_csv(os.path.join(C.DATA, f"{track_key}_{year}_lap.csv"), index=False)

    info = {
        "track": track_key, "year": year, "event": event,
        "driver": str(lap["Driver"]), "team": str(lap["Team"]), "compound": str(lap["Compound"]),
        "lap_time_s": lap_time, "wet": wet,
        "lap_distance_m": float(dist[-1]), "path_length_m": float(path_len), "centreline_m": float(centre_len),
        "max_speed_kmh": float(speed.max()),
        "mean_speed_kmh": float(np.trapezoid(speed, t_lap) / (t_lap[-1] - t_lap[0])),
        "full_throttle_pct": float(100 * np.mean(car["Throttle"].to_numpy() >= 98)),
        "air_temp_c": t_air, "pressure_mbar": pressure, "humidity_pct": humidity, "air_density": rho,
        "track_temp_c": float(window["TrackTemp"].median()),
        "alignment": {"variant": variant, "offset_m": float(((u_offset + 0.5) % 1.0 - 0.5) * centre_len),
                      "correlation": corr},
        "drs_zones": zones,
        "elevation_range_m": float(zf.max() - zf.min()),
    }
    # elevation in centreline coordinates on a 10 m grid
    s_grid = np.arange(0.0, centre_len, 10.0)
    u_lap = (s_grid / centre_len - u_offset) % 1.0
    info["_elevation"] = np.interp(u_lap, grid_f, zf, period=1.0).tolist()
    return info


def write_sidecars(track_key, infos, centre_len):
    stem = C.TRACKS[track_key][0]
    dry = [i for i in infos if not i["wet"] and i["alignment"]["correlation"] > 0.6]
    if not dry:
        print(f"  {track_key}: no dry, well-aligned session -> sidecars not written")
        return
    latest = max(dry, key=lambda i: i["year"])
    with open(os.path.join(C.EXAMPLES, stem + ".drs.csv"), "w") as handle:
        handle.write(f"# DRS zones of {stem}.csv (centreline distance, m), measured from the DRS-open intervals of the\n"
                     f"# {latest['year']} {latest['event']} qualifying pole lap ({latest['driver']}) via FastF1.\n")
        handle.write("# s_start_m,s_end_m\n")
        for s0, s1 in latest["drs_zones"]:
            handle.write(f"{s0},{s1}\n")
    z = np.mean([np.array(i["_elevation"]) for i in dry], axis=0)
    with open(os.path.join(C.EXAMPLES, stem + ".elevation.csv"), "w") as handle:
        years = ", ".join(str(i["year"]) for i in dry)
        handle.write(f"# Elevation profile of {stem}.csv (centreline distance), from FastF1 position Z of the {years}\n"
                     f"# qualifying pole laps, smoothed (sigma {SIGMA_Z:.0f} m), closed and relative to the mean.\n")
        handle.write("s_m,z_m\n")
        for s, zv in zip(np.arange(0.0, centre_len, 10.0), z):
            handle.write(f"{s:.1f},{zv:.3f}\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tracks", nargs="*", help="track keys (default: all)")
    ap.add_argument("--no-sidecars", action="store_true")
    args = ap.parse_args()

    import fastf1
    os.makedirs(C.CACHE, exist_ok=True)
    fastf1.Cache.enable_cache(C.CACHE)
    fastf1.set_log_level("ERROR")

    summary = C.load_summary() if os.path.exists(C.SUMMARY) else {}
    for track_key in args.tracks or list(C.TRACKS):
        _, data = ensure_track(track_key)
        centre_k, centre_len = centreline_curvature(data)
        infos = []
        for year in C.YEARS:
            try:
                info = process_session(track_key, year, centre_k, centre_len)
            except Exception as exc:  # noqa: BLE001 - report and continue with the other sessions
                print(f"  {track_key} {year}: FAILED ({exc})", flush=True)
                continue
            infos.append(info)
            a = info["alignment"]
            print(f"{track_key:<12} {year} {info['driver']} {info['lap_time_s']:.3f}s {'WET ' if info['wet'] else ''}"
                  f"rho={info['air_density']:.3f} align={a['variant']}/{a['offset_m']:+.0f}m corr={a['correlation']:.2f} "
                  f"dz={info['elevation_range_m']:.1f}m drs={info['drs_zones']}", flush=True)
        if not args.no_sidecars:
            write_sidecars(track_key, infos, centre_len)
        for info in infos:
            summary[C.session_key(track_key, info["year"])] = {k: v for k, v in info.items() if not k.startswith("_")}
        os.makedirs(C.DATA, exist_ok=True)
        with open(C.SUMMARY, "w") as handle:
            json.dump(summary, handle, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
