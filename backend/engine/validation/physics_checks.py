#!/usr/bin/env python3
"""
Analytic verification of the C++ lap time engine (build/lap_sim).

Synthetic tracks with closed-form minimum lap times are generated, the C++
engine is run on them, and its lap times are compared with the analytic answers.
Additional checks cover numerical convergence, racing-line improvements and the
ERS energy constraint on the bundled tracks.

Usage:
    python3 validation/physics_checks.py [--binary build/lap_sim]
"""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
G = 9.81

POINT_MASS_CAR = {
    "name": "PointMass_Check",
    "mass": {"mass": 1000.0, "cog_height": 0.3, "wheelbase": 2.5, "weight_distribution": 0.5},
    "aerodynamics": {"Cl": 0.0, "Cd": 0.0, "frontal_area": 1.0, "air_density": 1.225},
    "tire": {"mu_x": 1.2, "mu_y": 1.2, "load_sensitivity": 1.0, "tire_radius": 0.3, "rolling_resistance": 0.0},
    "powertrain": {
        "engine_torque_curve": {"1000": 2000, "20000": 2000},
        "gear_ratios": [3.0], "final_drive": 1.0, "efficiency": 1.0,
        "max_rpm": 20000, "min_rpm": 1000, "shift_time": 0.0, "drive": "AWD",
    },
    "brake": {"max_brake_force": 1.0e6, "brake_bias": 0.5, "ideal_bias": True},
}


def write_track(path, points, half_width):
    with open(path, "w") as handle:
        handle.write("# x_m,y_m,w_tr_right_m,w_tr_left_m\n")
        for x, y in points:
            handle.write(f"{x:.6f},{y:.6f},{half_width:.3f},{half_width:.3f}\n")


def circle_points(radius, step=2.0):
    n = int(round(2 * math.pi * radius / step))
    return [(radius * math.cos(2 * math.pi * i / n), radius * math.sin(2 * math.pi * i / n)) for i in range(n)]


def oval_points(radius, straight, step=2.0):
    pts = []
    n_s = int(round(straight / step))
    n_c = int(round(math.pi * radius / step))
    for i in range(n_s):  # bottom straight, heading +x
        pts.append((straight * i / n_s, -radius))
    for i in range(n_c):  # right semicircle, CCW
        a = -math.pi / 2 + math.pi * i / n_c
        pts.append((straight + radius * math.cos(a), radius * math.sin(a)))
    for i in range(n_s):  # top straight, heading -x
        pts.append((straight - straight * i / n_s, radius))
    for i in range(n_c):  # left semicircle, CCW
        a = math.pi / 2 + math.pi * i / n_c
        pts.append((radius * math.cos(a), radius * math.sin(a)))
    return pts


def run(binary, track, vehicle, *extra):
    with tempfile.TemporaryDirectory() as tmp:
        summary = os.path.join(tmp, "s.json")
        cmd = [binary, track, vehicle, "--quiet", "--no-output", "--summary-json", summary, *extra]
        proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"lap_sim failed: {' '.join(cmd)}\n{proc.stderr}")
        with open(summary) as handle:
            return json.load(handle)


class Checker:
    def __init__(self):
        self.failures = 0
        self.count = 0

    def check(self, name, value, expected, rel_tol):
        self.count += 1
        err = (value - expected) / expected
        ok = abs(err) <= rel_tol
        self.failures += 0 if ok else 1
        print(f"[{'PASS' if ok else 'FAIL'}] {name:<58} sim={value:10.4f} expected={expected:10.4f} "
              f"err={100 * err:+.3f}% (tol {100 * rel_tol:.2f}%)")

    def require(self, name, condition, detail):
        self.count += 1
        self.failures += 0 if condition else 1
        print(f"[{'PASS' if condition else 'FAIL'}] {name:<58} {detail}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", default=os.path.join(ROOT, "build", "lap_sim"))
    parser.add_argument("--f1-car", default=os.path.join("examples", "f1_2025_quali_lowdf.json"))
    args = parser.parse_args()
    c = Checker()
    mu = POINT_MASS_CAR["tire"]["mu_y"]

    with tempfile.TemporaryDirectory() as tmp:
        car = os.path.join(tmp, "point_mass.json")
        with open(car, "w") as handle:
            json.dump(POINT_MASS_CAR, handle)

        # 1) Skidpad on the centreline: t = 2 pi sqrt(R / (mu g))
        radius, half_width = 60.0, 6.0
        circle = os.path.join(tmp, "circle.csv")
        write_track(circle, circle_points(radius), half_width)
        s = run(args.binary, circle, car, "--line", "center")
        c.check("skidpad, centreline R=60 m", s["lap_time_s"], 2 * math.pi * math.sqrt(radius / (mu * G)), 0.002)

        # 2) The minimum-curvature objective chooses the outermost circle. This is
        # NOT the fastest lap on a skidpad: t is proportional to sqrt(R). Verify
        # the actual geometric objective without claiming lap-time optimality.
        r_line = radius + half_width
        s = run(args.binary, circle, car, "--edge-margin", "0")
        c.check("skidpad, optimised line uses outer edge (R=66 m)", s["lap_time_s"],
                2 * math.pi * math.sqrt(r_line / (mu * G)), 0.003)
        s = run(args.binary, circle, car, "--edge-margin", "1.5")
        c.check("skidpad, optimised line with 1.5 m edge margin", s["lap_time_s"],
                2 * math.pi * math.sqrt((r_line - 1.5) / (mu * G)), 0.003)

        # 3) Oval: grip-limited corners + traction/brake limited straights (a = mu g both ways)
        radius, straight = 50.0, 400.0
        oval = os.path.join(tmp, "oval.csv")
        write_track(oval, oval_points(radius, straight), 6.0)
        v_c = math.sqrt(mu * G * radius)
        a = POINT_MASS_CAR["tire"]["mu_x"] * G
        v_peak = math.sqrt(v_c ** 2 + a * straight)
        expected = 2 * math.pi * radius / v_c + 4 * (v_peak - v_c) / a
        s = run(args.binary, oval, car, "--line", "center")
        c.check("oval, centreline (corner + accel + brake phases)", s["lap_time_s"], expected, 0.005)
        c.check("oval, peak speed on the straights (km/h)", s["top_speed_kmh"], v_peak * 3.6, 0.005)

        # 4) Banked skidpad: v^2 = g R (sin b + mu cos b) / (cos b - mu sin b)
        bank = math.radians(15.0)
        radius = 60.0
        banked = os.path.join(tmp, "banked.csv")
        write_track(banked, circle_points(radius), 6.0)
        with open(os.path.join(tmp, "banked.banking.csv"), "w") as handle:
            handle.write(f"0,{2 * math.pi * radius + 10:.1f},15,0\n")
        v_b = math.sqrt(G * radius * (math.sin(bank) + mu * math.cos(bank)) / (math.cos(bank) - mu * math.sin(bank)))
        s = run(args.binary, banked, car, "--line", "center")
        c.check("banked skidpad 15 deg, centreline R=60 m", s["lap_time_s"], 2 * math.pi * radius / v_b, 0.003)

        # 5) Shift interruption costs time: 4 gears, the car has to shift on every straight
        car_shift = dict(POINT_MASS_CAR)
        car_shift["powertrain"] = dict(POINT_MASS_CAR["powertrain"], gear_ratios=[12.0, 8.0, 5.5, 4.0],
                                       shift_time=0.2, max_rpm=12000,
                                       engine_torque_curve={"1000": 600, "12000": 600})
        shift_path = os.path.join(tmp, "shift.json")
        with open(shift_path, "w") as handle:
            json.dump(car_shift, handle)
        no_shift = dict(car_shift)
        no_shift["powertrain"] = dict(car_shift["powertrain"], shift_time=0.0)
        no_shift_path = os.path.join(tmp, "noshift.json")
        with open(no_shift_path, "w") as handle:
            json.dump(no_shift, handle)
        t_shift = run(args.binary, oval, shift_path, "--line", "center")
        t_seamless = run(args.binary, oval, no_shift_path, "--line", "center")
        # each upshift loses at most shift_time (no drive force) - bounded below by a fraction of it
        lost = t_shift["lap_time_s"] - t_seamless["lap_time_s"]
        c.require("oval, 0.2 s shift interruption is slower than seamless",
                  t_shift["upshifts"] >= 4 and 0.0 < lost < 0.2 * t_shift["upshifts"],
                  f"{t_shift['lap_time_s']:.3f} s vs {t_seamless['lap_time_s']:.3f} s, "
                  f"{t_shift['upshifts']} upshifts, {lost:.3f} s lost")

    # 5) Real tracks: resolution convergence, line optimality, energy constraint
    f1 = args.f1_car
    for track in ("examples/Monza.csv", "examples/montreal.csv", "examples/Zandvoort.csv", "examples/Shanghai.csv"):
        name = os.path.basename(track)
        fine = run(args.binary, track, f1, "--ds", "0.5")
        base = run(args.binary, track, f1, "--ds", "1.0")
        coarse = run(args.binary, track, f1, "--ds", "2.0")
        c.check(f"{name}: ds=1.0 m vs ds=0.5 m lap time", base["lap_time_s"], fine["lap_time_s"], 0.0015)
        c.require(f"{name}: ds=2.0 m within 0.5 % of ds=0.5 m",
                  abs(coarse["lap_time_s"] - fine["lap_time_s"]) / fine["lap_time_s"] < 0.005,
                  f"{coarse['lap_time_s']:.3f} vs {fine['lap_time_s']:.3f} s")
        center = run(args.binary, track, f1, "--line", "center")
        c.require(f"{name}: optimised line faster than centreline",
                  base["lap_time_s"] < center["lap_time_s"],
                  f"{base['lap_time_s']:.3f} s vs {center['lap_time_s']:.3f} s")
        with tempfile.TemporaryDirectory() as tmp:
            line_csv = os.path.join(tmp, "line.csv")
            run(args.binary, track, f1, "--line-nodes", line_csv)
            again = run(args.binary, track, f1, "--line", "given", "--line-file", line_csv)
        c.check(f"{name}: exact nodes re-imported (--line given)", again["lap_time_s"], base["lap_time_s"], 0.00005)
        budget = base.get("ers_budget_mj")
        if budget is not None:
            c.require(f"{name}: ERS energy within budget",
                      base["ers_energy_mj"] <= budget * 1.001 + 1e-6,
                      f"{base['ers_energy_mj']:.3f} MJ <= {budget:.3f} MJ")

    print(f"\n{c.count - c.failures}/{c.count} checks passed")
    return 1 if c.failures else 0


if __name__ == "__main__":
    sys.exit(main())
