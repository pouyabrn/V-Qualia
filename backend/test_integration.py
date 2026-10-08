"""API + actual C++ integration tests. All mutations use disposable storage."""
import csv
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor

storage = tempfile.TemporaryDirectory(prefix='vqualia_tests_')
os.environ['VQUALIA_DATA_DIR'] = storage.name
from fastapi.testclient import TestClient
import main
from prediction_engine import engine_revision

AUTH = {'Authorization': 'Bearer ' + main.PLACEHOLDER_AUTH}
client = TestClient(main.app)

class IntegrationTests(unittest.TestCase):
    def test_preserves_advanced_vehicle_fields_and_internal_names(self):
        response = client.get('/api/cars/F1_2025_Quali_LowDF', headers=AUTH)
        self.assertEqual(response.status_code, 200)
        car = response.json()['car']
        car['name'] = 'Integration test vehicle'
        car['tire']['combined_p'] = 1.9
        car['powertrain']['wheel_inertia'] = 1.7
        created = client.post('/api/cars', headers=AUTH, json=car)
        self.assertEqual(created.status_code, 200, created.text)
        saved = created.json()['car']
        self.assertEqual(saved['powertrain']['ers'], car['powertrain']['ers'])
        self.assertEqual(saved['tire']['combined_p'], 1.9)
        fetched = client.get('/api/cars/Integration%20test%20vehicle', headers=AUTH)
        self.assertEqual(fetched.json()['car']['powertrain']['wheel_inertia'], 1.7)
        self.assertEqual(client.get('/api/cars/Honda_Civic_Si_2025', headers=AUTH).json()['car']['powertrain']['drive'], 'FWD')

    def test_track_coordinates_and_sidecar_filtering(self):
        tracks = client.get('/api/tracks', headers=AUTH).json()['tracks']
        self.assertGreaterEqual(len(tracks), 11)
        self.assertFalse(any(t['name'].endswith(('.drs', '.elevation', '.banking')) for t in tracks))
        result = client.get('/api/tracks/monza', headers=AUTH)
        self.assertEqual(result.status_code, 200)
        self.assertAlmostEqual(result.json()['data'][0]['x_m'], -.320123)
        self.assertGreater(result.json()['length'], 5000)

    def test_invalid_input_and_upload(self):
        response = client.post('/api/predict', headers=AUTH, json={'car_name': 'x', 'track_name': 'x', 'resolution_m': .01})
        self.assertEqual(response.status_code, 422)
        response = client.post('/api/tracks/upload?track_name=Invalid', headers=AUTH,
                               files={'file': ('track.csv', b'0,0,4,4\n1,0,4,4\n2,nan,4,4\n0,1,4,4')})
        self.assertEqual(response.status_code, 400)

    def test_actual_predictions_multiple_cars_and_tracks(self):
        cases = [('F1_2025_Quali_LowDF', 'Monza'), ('F1_2024_Quali_MediumDF', 'Suzuka'),
                 ('F2_2024_Quali_highdf', 'Budapest'), ('Honda_Civic_Si_2025', 'Silverstone'),
                 ('FSAE_RoadCourse', 'Shanghai')]
        measurements = []
        for i, (car, track) in enumerate(cases):
            with self.subTest(car=car, track=track):
                response = client.post('/api/predict', headers=AUTH,
                    json={'car_name': car, 'track_name': track, 'resolution_m': 2, 'export_ggv': i == 0})
                self.assertEqual(response.status_code, 200, response.text)
                result = response.json()
                self.assertTrue(result['summary']['converged'])
                self.assertEqual(result['engine'], engine_revision())
                if i == 0:
                    self.assertEqual(result['summary']['drs_zones'], 2)
                    meta = client.get('/api/predictions/' + result['ggv_metadata_file'], headers=AUTH)
                    self.assertIn('application/json', meta.headers['content-type'])
                    self.assertTrue(meta.json()['ers_peak_assistance'])
                    self.assertFalse(meta.json()['lap_energy_budget_applied'])
                output = client.get('/api/predictions/' + result['telemetry_file'], headers=AUTH)
                rows = list(csv.DictReader(io.StringIO(output.text)))
                self.assertAlmostEqual(float(rows[-1]['timestamp_s']), result['lap_time'], places=5)
                self.assertAlmostEqual(float(rows[-1]['arc_length_m']), result['summary']['line_length_m'], places=5)
                self.assertEqual(rows[-1]['pos_x_m'], rows[0]['pos_x_m'])
                measurements.append({'car': car, 'track': track, 'lap_s': result['lap_time'],
                                     'solve_ms': result['summary']['solve_ms'], 'wall_ms': result['wall_ms']})
        artifact = os.getenv('VQUALIA_TEST_REPORT')
        if artifact:
            Path(artifact).parent.mkdir(parents=True, exist_ok=True)
            Path(artifact).write_text(json.dumps(measurements, indent=2) + '\n')

    def test_concurrent_predictions_have_distinct_outputs(self):
        def predict(_):
            response = client.post('/api/predict', headers=AUTH,
                json={'car_name': 'Honda_Civic_Si_2025', 'track_name': 'Monza', 'line_mode': 'center'})
            self.assertEqual(response.status_code, 200, response.text)
            return response.json()
        with ThreadPoolExecutor(max_workers=2) as pool:
            first, second = list(pool.map(predict, range(2)))
        self.assertNotEqual(first['telemetry_file'], second['telemetry_file'])
        self.assertAlmostEqual(first['lap_time'], second['lap_time'], places=8)
        self.assertEqual(client.get('/health').status_code, 200)

if __name__ == '__main__':
    try:
        unittest.main()
    finally:
        storage.cleanup()
