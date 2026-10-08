"""Shared configuration and helpers for the FastF1-based validation tools.

All lap times reported by these tools are computed by the C++ engine (build/lap_sim).
Python is only used to fetch reference data, launch the engine and compare results.
"""
import json
import os
import subprocess
import tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(os.path.dirname(HERE))  # repository root
EXAMPLES = os.path.join(ENGINE, "examples")
BINARY = os.environ.get("LAP_SIM", os.path.join(ENGINE, "build", "lap_sim"))
DATA = os.environ.get("LAPSIM_F1_DATA", os.path.join(HERE, "data"))
CACHE = os.environ.get("FASTF1_CACHE", os.path.join(HERE, "cache"))
PLOTS = os.path.join(HERE, "plots")
SUMMARY = os.path.join(DATA, "summary.json")
TUMFTM_URL = "https://raw.githubusercontent.com/TUMFTM/racetrack-database/master/tracks/{}.csv"

# track key -> (track file stem in examples/, FastF1 event name, aero package)
# Aero packages are assigned a priori from the wing levels teams typically run there.
TRACKS = {
    "monza": ("Monza", "Italian Grand Prix", "lowdf"),
    "montreal": ("montreal", "Canadian Grand Prix", "mediumdf"),
    "zandvoort": ("Zandvoort", "Dutch Grand Prix", "highdf"),
    "shanghai": ("Shanghai", "Chinese Grand Prix", "mediumdf"),
    # out-of-sample tracks: never used for calibration
    "spielberg": ("Spielberg", "Austrian Grand Prix", "mediumdf"),
    "silverstone": ("Silverstone", "British Grand Prix", "mediumdf"),
    "budapest": ("Budapest", "Hungarian Grand Prix", "highdf"),
    "suzuka": ("Suzuka", "Japanese Grand Prix", "mediumdf"),
    "austin": ("Austin", "United States Grand Prix", "mediumdf"),
    "sakhir": ("Sakhir", "Bahrain Grand Prix", "mediumdf"),
    "mexico": ("MexicoCity", "Mexico City Grand Prix", "highdf"),
}
TUMFTM_NAMES = {"montreal": "Montreal"}  # remote file names that differ from the local stem
CALIBRATION_TRACKS = ["monza", "montreal", "zandvoort", "shanghai"]
YEARS = [2024, 2025]
PACKAGES = ["lowdf", "mediumdf", "highdf"]


def track_file(track_key):
    return os.path.join("examples", TRACKS[track_key][0] + ".csv")


def car_file(year, package, cars_dir="examples"):
    return os.path.join(cars_dir, f"f1_{year}_quali_{package}.json")


def load_summary():
    with open(SUMMARY) as handle:
        return json.load(handle)


def session_key(track_key, year):
    return f"{track_key}_{year}"


def periodic_gaussian(values, sigma):
    """Circular Gaussian smoothing, sigma in samples."""
    values = np.asarray(values, dtype=float)
    if sigma <= 1e-6:
        return values
    radius = int(min(np.ceil(3.0 * sigma), len(values) // 2 - 1))
    kernel = np.exp(-0.5 * (np.arange(-radius, radius + 1) / sigma) ** 2)
    kernel /= kernel.sum()
    padded = np.concatenate([values[-radius:], values, values[:radius]])
    return np.convolve(padded, kernel, mode="valid")


def resample_closed(x, y, n):
    """Uniform arc-length resampling of a closed polyline. Returns x, y, length."""
    xc = np.append(x, x[0])
    yc = np.append(y, y[0])
    s = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(xc), np.diff(yc)))])
    grid = np.linspace(0.0, s[-1], n, endpoint=False)
    return np.interp(grid, s, xc), np.interp(grid, s, yc), float(s[-1])


def curvature_closed(x, y, length, sigma_m=8.0):
    """Signed curvature of a uniformly sampled closed curve (periodic finite differences)."""
    n = len(x)
    h = length / n
    xs = periodic_gaussian(x, sigma_m / h)
    ys = periodic_gaussian(y, sigma_m / h)
    dx = (np.roll(xs, -1) - np.roll(xs, 1)) / (2 * h)
    dy = (np.roll(ys, -1) - np.roll(ys, 1)) / (2 * h)
    ddx = (np.roll(xs, -1) - 2 * xs + np.roll(xs, 1)) / h ** 2
    ddy = (np.roll(ys, -1) - 2 * ys + np.roll(ys, 1)) / h ** 2
    return (dx * ddy - dy * ddx) / np.power(np.maximum(dx * dx + dy * dy, 1e-12), 1.5)


def circular_shift(reference, signal):
    """Shift k (samples) maximising sum(reference[i + k] * signal[i]) and the normalised correlation."""
    corr = np.real(np.fft.ifft(np.fft.fft(reference) * np.conj(np.fft.fft(signal))))
    k = int(np.argmax(corr))
    norm = np.linalg.norm(reference) * np.linalg.norm(signal)
    return k, float(corr[k] / norm) if norm > 0 else 0.0


def run_engine(track, vehicle, extra=(), telemetry=False, cwd=ENGINE):
    """Run the C++ engine; returns (summary dict, telemetry array or None)."""
    with tempfile.TemporaryDirectory() as tmp:
        summary_path = os.path.join(tmp, "summary.json")
        cmd = [BINARY, track, vehicle, "--quiet", "--no-output", "--summary-json", summary_path]
        tel_path = os.path.join(tmp, "telemetry.csv")
        if telemetry:
            cmd += ["--csv", tel_path]
        cmd += list(extra)
        proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"lap_sim failed ({' '.join(cmd)}):\n{proc.stderr.strip()}")
        with open(summary_path) as handle:
            summary = json.load(handle)
        tel = None
        if telemetry:
            tel = np.genfromtxt(tel_path, delimiter=",", names=True, usecols=(1, 7))
        return summary, tel


def resample_speed(fraction, speed, n):
    grid = np.linspace(0.0, 1.0, n, endpoint=False)
    return np.interp(grid, fraction, speed, period=1.0)


def align_traces(real_v, sim_v):
    """Circularly shift sim_v onto real_v (speed-trace cross-correlation)."""
    k, _ = circular_shift(real_v - real_v.mean(), sim_v - sim_v.mean())
    return np.roll(sim_v, k)
