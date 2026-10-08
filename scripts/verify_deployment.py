"""Smoke-test the deployed API. Creates five prediction datasets; never deletes data."""
import argparse
import csv
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api', default='https://v-qualia-backend.onrender.com')
    parser.add_argument('--commit', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    engine = json.loads((root / 'backend/engine/UPSTREAM.json').read_text())
    headers = {'Authorization': 'Bearer ididntwriteauthsystemyetLOL', 'Content-Type': 'application/json'}

    def request(path, payload=None):
        body = json.dumps(payload).encode() if payload is not None else None
        with urlopen(Request(args.api.rstrip('/') + path, data=body, headers=headers), timeout=180) as response:
            return response.read().decode()

    health = json.loads(request('/health'))
    assert health['deployment_commit'] == args.commit, health
    assert health['engine']['commit'] == engine['commit'], health
    cases = [('F1_2025_Quali_LowDF', 'Monza'), ('F1_2024_Quali_MediumDF', 'Suzuka'),
             ('F2_2024_Quali_highdf', 'Budapest'), ('Honda_Civic_Si_2025', 'Silverstone'),
             ('FSAE_RoadCourse', 'Shanghai')]
    runs = []
    for index, (car, track) in enumerate(cases):
        result = json.loads(request('/api/predict', {'car_name': car, 'track_name': track, 'export_ggv': index == 0}))
        assert result['success'] and result['summary']['converged'], result
        assert result['engine']['commit'] == engine['commit']
        rows = list(csv.DictReader(io.StringIO(request('/api/predictions/' + result['telemetry_file']))))
        assert abs(float(rows[-1]['timestamp_s']) - result['lap_time']) < 1e-5
        assert abs(float(rows[-1]['arc_length_m']) - result['summary']['line_length_m']) < 1e-5
        if index == 0:
            metadata = json.loads(request('/api/predictions/' + result['ggv_metadata_file']))
            assert metadata['road'] == 'flat', metadata
        runs.append({'car': car, 'track': track, 'lap_time_s': result['lap_time'],
                     'solve_ms': result['summary']['solve_ms'], 'wall_ms': result['wall_ms'],
                     'telemetry_file': result['telemetry_file'], 'samples': len(rows)})
        print(json.dumps(runs[-1]), flush=True)
    report = {'verified_at': datetime.now(timezone.utc).isoformat(), 'api': args.api,
              'deployment_commit': args.commit, 'engine_commit': engine['commit'],
              'note': 'Numerical smoke tests at 2 m, 1.225 kg/m3; not measured-lap accuracy evidence.', 'runs': runs}
    Path(args.output).write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
