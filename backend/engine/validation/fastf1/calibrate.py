#!/usr/bin/env python3
"""
Identify the F1 car parameters from real qualifying telemetry (system identification).

The C++ engine is run with candidate parameters (--set overrides). A bounded
least-squares solver (scipy, trust-region reflective) minimises, over all calibration
cases (track x season), the distance-aligned speed-trace difference plus the lap-time
error. Seasons share the physical constants that did not change between them (power
unit, brakes, DRS, tyre combined-slip shape, track banking); grip and aero are fitted
per season. Aero packages are ordered (low <= medium <= high) by construction.

    python3 validation/fastf1/calibrate.py [--holdout montreal] [--write] [--predict]

Requires fastf1/numpy/scipy only for reading data/summary.json produced by fetch.py.
"""
import argparse
import json
import os
import shutil
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from scipy.optimize import least_squares

import common as C

N = 600
LOAD_SENSITIVITY = 0.85
EDGE_MARGIN = -0.4

# name, target, initial, lower, upper, scope ("shared" or "year")
PARAMS = [
    ("combined_exp", "tire.combined_exponent", 1.6, 1.2, 3.0, "shared"),
    ("torque_scale", "powertrain.torque_scale", 0.90, 0.85, 1.05, "shared"),
    ("recovery_kw", "powertrain.ers.recovery_power_kw", 40.0, 0.0, 120.0, "shared"),
    ("drs_drag", "aerodynamics.drs.drag_reduction", 0.28, 0.08, 0.40, "shared"),
    ("brake_force", "brake.max_brake_force", 35000.0, 22000.0, 70000.0, "shared"),
    ("rear_mu", "tire.rear_mu_scale", 1.02, 0.85, 1.35, "shared"),
    ("bank_t3", "bank:zandvoort:0", 12.0, 0.0, 19.0, "shared"),
    ("bank_t14", "bank:zandvoort:1", 12.0, 0.0, 18.0, "shared"),
    ("mu_y", "tire.mu_y", 1.85, 1.4, 2.6, "year"),
    ("mu_x", "tire.mu_x", 1.80, 1.3, 2.6, "year"),
    ("ClA_lowdf", "aero:ClA:lowdf", 6.0, 3.0, 9.5, "year"),
    ("dClA_mediumdf", "aero:dClA:mediumdf", 0.3, 0.0, 3.0, "year"),
    ("dClA_highdf", "aero:dClA:highdf", 1.0, 0.0, 3.0, "year"),
    ("CdA_lowdf", "aero:CdA:lowdf", 1.35, 0.8, 1.7, "year"),
    ("dCdA_mediumdf", "aero:dCdA:mediumdf", 0.25, 0.0, 0.6, "year"),
    ("dCdA_highdf", "aero:dCdA:highdf", 0.25, 0.0, 0.6, "year"),
]
BANKING_SECTIONS = {"zandvoort": [(800, 990, 40), (3730, 3970, 40)]}


class Space:
    """Maps the flat parameter vector <-> named values per season."""

    def __init__(self, years, fixed, init):
        self.names, self.lo, self.hi, self.x0, self.meta = [], [], [], [], []
        for name, target, x0, lo, hi, scope in PARAMS:
            for year in (years if scope == "year" else [None]):
                full = f"{name}@{year}" if year else name
                value = init.get(full, init.get(name, x0))
                self.meta.append((full, name, target, year))
                self.names.append(full)
                self.lo.append(lo)
                self.hi.append(hi)
                self.x0.append(float(np.clip(fixed.get(full, fixed.get(name, value)), lo, hi)))
        self.lo, self.hi, self.x0 = map(np.array, (self.lo, self.hi, self.x0))
        self.free = np.array([n not in fixed and n.split("@")[0] not in fixed for n in self.names])

    def values(self, theta, year):
        out = {}
        for (full, name, target, y), value in zip(self.meta, theta):
            if y is None or y == year:
                out[name] = (target, value)
        return out

    @staticmethod
    def aero(values):
        cla = {"lowdf": values["ClA_lowdf"][1]}
        cla["mediumdf"] = cla["lowdf"] + values["dClA_mediumdf"][1]
        cla["highdf"] = cla["mediumdf"] + values["dClA_highdf"][1]
        cda = {"lowdf": values["CdA_lowdf"][1]}
        cda["mediumdf"] = cda["lowdf"] + values["dCdA_mediumdf"][1]
        cda["highdf"] = cda["mediumdf"] + values["dCdA_highdf"][1]
        return cla, cda


class Case:
    def __init__(self, track_key, year, info, cars_dir):
        self.track_key, self.year, self.info = track_key, year, info
        self.key = C.session_key(track_key, year)
        stem, _, self.package = C.TRACKS[track_key]
        self.stem = stem
        self.car = C.car_file(year, self.package, cars_dir)
        self.real_lap = info["lap_time_s"]
        lap = np.genfromtxt(os.path.join(C.DATA, f"{self.key}_lap.csv"), delimiter=",", names=True)
        self.real_v = C.resample_speed(lap["Distance"] / lap["Distance"][-1], lap["Speed"], N)

    def run(self, space, theta):
        values = space.values(theta, self.year)
        cla, cda = space.aero(values)
        extra = ["--air-density", f"{self.info['air_density']:.4f}", "--edge-margin", str(EDGE_MARGIN),
                 "--set", f"tire.load_sensitivity={LOAD_SENSITIVITY}",
                 "--set", f"aerodynamics.ClA={cla[self.package]:.6f}",
                 "--set", f"aerodynamics.CdA={cda[self.package]:.6f}"]
        bank = {}
        for name, (target, value) in values.items():
            if target.startswith("bank:"):
                _, track, index = target.split(":")
                if track == self.track_key:
                    bank[int(index)] = value
            elif not target.startswith("aero:"):
                extra += ["--set", f"{target}={value:.6f}"]
        with tempfile.TemporaryDirectory() as tmp:
            track = C.track_file(self.track_key)
            tag = ""
            if bank:  # temporary copy of the track with a candidate banking sidecar
                for suffix in (".csv", ".drs.csv", ".elevation.csv"):
                    src = os.path.join(C.EXAMPLES, self.stem + suffix)
                    if os.path.exists(src):
                        shutil.copy(src, os.path.join(tmp, self.stem + suffix))
                with open(os.path.join(tmp, self.stem + ".banking.csv"), "w") as handle:
                    for idx, (s0, s1, ramp) in enumerate(BANKING_SECTIONS[self.track_key]):
                        handle.write(f"{s0},{s1},{bank.get(idx, 0.0):.3f},{ramp}\n")
                track = os.path.join(tmp, self.stem + ".csv")
                tag = "_" + "_".join(f"{bank[k]:.3f}" for k in sorted(bank))
            extra += ["--line-cache", os.path.join(tempfile.gettempdir(), f"lapsim_line_{self.track_key}{tag}.txt")]
            summary, tel = C.run_engine(track, self.car, extra, telemetry=True)
        sim_v = C.resample_speed(tel["arc_length_m"] / summary["line_length_m"], tel["speed_kmh"], N)
        return C.align_traces(self.real_v, sim_v), summary

    def residual(self, space, theta, lap_weight):
        sim_v, summary = self.run(space, theta)
        err = 100.0 * (summary["lap_time_s"] - self.real_lap) / self.real_lap
        return np.concatenate([(sim_v - self.real_v) / np.sqrt(N), [lap_weight * err]]), err, sim_v, summary


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", default=",".join(map(str, C.YEARS)))
    ap.add_argument("--tracks", default=",".join(C.CALIBRATION_TRACKS))
    ap.add_argument("--holdout", default="", help="comma separated tracks excluded from the fit and predicted")
    ap.add_argument("--predict", action="store_true", help="predict all non-calibration tracks with the fit")
    ap.add_argument("--lap-weight", type=float, default=6.0, help="residual weight per 1 %% lap-time error")
    ap.add_argument("--max-nfev", type=int, default=30)
    ap.add_argument("--fix", action="append", default=[], help="name=value, e.g. --fix bank_t3=12")
    ap.add_argument("--init", default=None, help="previous fit JSON used as starting point")
    ap.add_argument("--tag", default="joint")
    ap.add_argument("--write", action="store_true", help="write the fitted cars to examples/")
    ap.add_argument("--apply", action="store_true", help="skip fitting: evaluate / write the --init parameters")
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 8)
    args = ap.parse_args()

    years = [int(y) for y in args.years.split(",")]
    holdout = [t for t in args.holdout.split(",") if t]
    summary = C.load_summary()
    fixed = {k: float(v) for k, v in (item.split("=") for item in args.fix)}
    init = {}
    if args.init:
        with open(args.init) as handle:
            init = json.load(handle).get("params", {})
    space = Space(years, fixed, init)

    def cases_for(tracks):
        out = []
        for t in tracks:
            for y in years:
                info = summary.get(C.session_key(t, y))
                if info and not info["wet"]:
                    out.append(Case(t, y, info, "examples"))
        return out

    fit_cases = cases_for([t for t in args.tracks.split(",") if t not in holdout])
    pool = ThreadPoolExecutor(max_workers=args.workers)
    free_idx = np.flatnonzero(space.free)
    scale = space.hi[free_idx] - space.lo[free_idx]

    def theta_of(z):
        theta = space.x0.copy()
        theta[free_idx] = space.lo[free_idx] + z * scale
        return theta

    def residual_vectors(zs):
        jobs = [(k, c) for k in range(len(zs)) for c in fit_cases]
        thetas = [theta_of(z) for z in zs]
        results = list(pool.map(lambda job: job[1].residual(space, thetas[job[0]], args.lap_weight), jobs))
        out = []
        for k in range(len(zs)):
            part = results[k * len(fit_cases):(k + 1) * len(fit_cases)]
            out.append((np.concatenate([p[0] for p in part]), [p[1] for p in part]))
        return out

    evals = {"n": 0}
    t_start = time.time()

    def fun(z):
        r, errs = residual_vectors([z])[0]
        evals["n"] += 1
        print(f"  eval {evals['n']:3d} cost={r @ r:9.2f} | " +
              " ".join(f"{c.key}:{e:+.2f}%" for c, e in zip(fit_cases, errs)) + f" | {time.time() - t_start:.0f}s",
              flush=True)
        return r

    def jac(z):
        h = 0.01
        steps = np.where(z + h <= 1.0, h, -h)
        zs = [z] + [z + steps[i] * np.eye(len(z))[i] for i in range(len(z))]
        vecs = [v for v, _ in residual_vectors(zs)]
        return np.column_stack([(vecs[i + 1] - vecs[0]) / steps[i] for i in range(len(z))])

    z0 = (space.x0[free_idx] - space.lo[free_idx]) / scale
    if args.apply:
        theta = space.x0.copy()
        cost = float(np.sum(fun(z0) ** 2))
    else:
        print(f"fitting {len(free_idx)} parameters on {len(fit_cases)} cases: " + ", ".join(c.key for c in fit_cases))
        fit = least_squares(fun, z0, jac=jac, bounds=(np.zeros_like(z0), np.ones_like(z0)),
                            x_scale=np.full_like(z0, 0.05), max_nfev=args.max_nfev, verbose=0)
        theta = theta_of(fit.x)
        cost = float(fit.cost * 2)

    print("\nFitted parameters (* = at a bound):")
    for i, name in enumerate(space.names):
        at_bound = space.free[i] and (abs(theta[i] - space.lo[i]) < 1e-3 * (space.hi[i] - space.lo[i]) or
                                      abs(theta[i] - space.hi[i]) < 1e-3 * (space.hi[i] - space.lo[i]))
        print(f"  {name:<22} {theta[i]:10.4f}{' *' if at_bound else ''}{'  (fixed)' if not space.free[i] else ''}")
    for y in years:
        cla, cda = space.aero(space.values(theta, y))
        print(f"  {y}: " + "  ".join(f"{p} ClA={cla[p]:.2f} CdA={cda[p]:.2f} L/D={cla[p] / cda[p]:.2f}" for p in C.PACKAGES))

    def report(title, cases):
        if not cases:
            return []
        rows = list(pool.map(lambda c: (c, c.residual(space, theta, args.lap_weight)), cases))
        print(f"\n{title}")
        out = []
        for c, (_, err, sim_v, s) in rows:
            rms = float(np.sqrt(np.mean((sim_v - c.real_v) ** 2)))
            print(f"  {c.key:<17} real {c.real_lap:8.3f}  sim {s['lap_time_s']:8.3f}  err {err:+6.2f}%  "
                  f"speed rms {rms:5.1f} km/h  vmax {s['top_speed_kmh']:5.1f}/{c.info['max_speed_kmh']:5.1f}")
            out.append({"case": c.key, "real": c.real_lap, "sim": s["lap_time_s"], "err_pct": err, "rms_kmh": rms})
        errs = np.array([o["err_pct"] for o in out])
        print(f"  -> mean {errs.mean():+.2f}%  mean|err| {np.abs(errs).mean():.2f}%  max|err| {np.abs(errs).max():.2f}%")
        return out

    results = {"fit": report("Calibration cases (in-sample):", fit_cases)}
    results["holdout"] = report("Held-out tracks (not used in the fit):", cases_for(holdout))
    if args.predict:
        others = [t for t in C.TRACKS if t not in C.CALIBRATION_TRACKS]
        results["predict"] = report("Out-of-sample tracks (never used in any fit):", cases_for(others))

    params = {name: float(v) for name, v in zip(space.names, theta)}
    os.makedirs(C.DATA, exist_ok=True)
    with open(os.path.join(C.DATA, f"fit_{args.tag}.json"), "w") as handle:
        json.dump({"params": params, "results": results, "cost": cost, "years": years,
                   "load_sensitivity": LOAD_SENSITIVITY, "edge_margin": EDGE_MARGIN}, handle, indent=1)

    if args.write:
        for y in years:
            values = space.values(theta, y)
            cla, cda = space.aero(values)
            for pkg in C.PACKAGES:
                path = os.path.join(C.EXAMPLES, f"f1_{y}_quali_{pkg}.json")
                with open(path) as handle:
                    car = json.load(handle)
                car["aerodynamics"]["ClA"] = round(cla[pkg], 3)
                car["aerodynamics"]["CdA"] = round(cda[pkg], 3)
                car["tire"]["load_sensitivity"] = LOAD_SENSITIVITY
                for name, (target, value) in values.items():
                    if target.startswith(("aero:", "bank:")):
                        continue
                    node = car
                    keys = target.split(".")
                    for k in keys[:-1]:
                        node = node.setdefault(k, {})
                    node[keys[-1]] = round(float(value), 4 if abs(value) < 100 else 1)
                car.setdefault("racing_line", {})["edge_margin"] = EDGE_MARGIN
                with open(path, "w") as handle:
                    json.dump(car, handle, indent=2)
                    handle.write("\n")
        bank = [params["bank_t3"], params["bank_t14"]]
        # These are effective bank angles fitted to this coarse centreline, not a
        # survey of the track's peak banking. Persist them with the fitted cars.
        with open(os.path.join(C.EXAMPLES, "Zandvoort.banking.csv"), "w") as handle:
            handle.write("# Effective banking fitted jointly with the F1 presets; not surveyed peak angles.\n")
            handle.write("# s_start_m,s_end_m,banking_deg,ramp_m\n")
            for idx, (s0, s1, ramp) in enumerate(BANKING_SECTIONS["zandvoort"]):
                handle.write(f"{s0},{s1},{bank[idx]:.6f},{ramp}\n")
        print(f"car files written; fitted Zandvoort banking T3={bank[0]:.1f} deg, T14={bank[1]:.1f} deg")
    return 0


if __name__ == "__main__":
    sys.exit(main())
