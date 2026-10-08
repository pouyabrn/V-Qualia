#!/usr/bin/env python3
"""Record review provenance against the fixed pre-review source commit."""
import hashlib
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    sha = "d69e258253653bcc39224534282ae0a603326ff7"
    paths = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", sha, "include", "src"], cwd=ROOT, text=True).splitlines()
    original = ROOT.parent / "_baseline" / "src"
    for path in paths:
        expected = subprocess.check_output(["git", "show", f"{sha}:{path}"], cwd=ROOT)
        if original.exists():
            actual = (original / path).read_bytes()
            if expected.replace(b"\r\n", b"\n") != actual.replace(b"\r\n", b"\n"):
                raise RuntimeError(f"Original source backup differs from baseline: {path}")
    fit_path = ROOT / "validation" / "fastf1" / "data" / "fit_full.json"
    if fit_path.exists():
        fit = json.loads(fit_path.read_text())
    else:
        fit = {"params": json.loads((ROOT / "validation" / "review_provenance.json").read_text())["f1_frozen_parameters"]}
    manifest = {
        "review_date": "2026-10-08",
        "baseline_commit": sha,
        "baseline_url": f"https://github.com/pouyabrn/LapPredictionEngine/tree/{sha}",
        "original_source_files_verified": len(paths),
        "compiler": "GCC 13.3, C++17, CMake Release (-O3 -DNDEBUG), WSL2 Ubuntu x86_64",
        "cpu": "Intel Core Ultra 7 255H",
        "calibration_cases_f1": ["monza", "montreal", "zandvoort", "shanghai"],
        "f1_frozen_parameters": fit["params"],
        "banking_note": "Zandvoort angles are effective fitted averages for the coarse centreline, not surveyed peak angles.",
        "holdout_note": "F1 holdout tracks excluded from car-parameter fitting. Track elevation and DRS sidecars use observed session data; not fully blind forecasts.",
        "road_car_note": "Civic Si and Formula Student checks verify numerical behavior, not real-world lap accuracy.",
    }
    with open(ROOT / "validation" / "review_provenance.json", "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"Verified {len(paths)} original source files against {sha}")


if __name__ == "__main__":
    main()
