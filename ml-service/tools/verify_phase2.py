"""Read-only ML HTTP verification. No Node, MongoDB or hardware writes.

Run with ml-service/.venv/Scripts/python.exe from the repository root.
Secrets are read locally and never included in the verification report.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]


def call(port, path, *, token=None, payload=None, raw=None, content_type=None):
    headers = {}
    if token:
        headers['X-Quality-Service-Token' if port == 8002 else 'X-Risk-Service-Token'] = token
    data = raw if raw is not None else json.dumps(payload).encode() if payload is not None else None
    if data is not None:
        headers['Content-Type'] = content_type or 'application/json'
    request = Request(f'http://127.0.0.1:{port}{path}', data=data, headers=headers)
    opener = build_opener(ProxyHandler({}))
    try:
        response = opener.open(request, timeout=45)
    except HTTPError as error:
        response = error
    with response:
        return {'status': response.status, 'body': json.load(response)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', type=Path, required=True)
    parser.add_argument('--check-camera', action='store_true', help='Read-only camera status probe; needs powered camera.')
    args = parser.parse_args()
    output = ROOT / 'state/local-runtime/phase2-verification'
    output.mkdir(parents=True, exist_ok=True)
    baseline = json.loads((ROOT / 'state/local-runtime/phase1-resume-backup-20261021-071425/model01-baseline.json').read_text())
    image_token = dotenv_values(ROOT / 'ml-module02/.env')['MODULE02_IMAGE_SERVICE_TOKEN']
    risk_token = dotenv_values(ROOT / 'ml-service/.env')['RISK_SERVICE_TOKEN']
    report = {'verified_at': datetime.now(timezone.utc).isoformat(), 'simultaneous_health': []}
    with ThreadPoolExecutor(max_workers=2) as pool:
        for _ in range(3):
            first = pool.submit(call, 8002, '/health')
            second = pool.submit(call, 8000, '/risk/health', token=risk_token)
            pair = {'model01': first.result(), 'model02': second.result()}
            assert pair['model01']['status'] == pair['model02']['status'] == 200
            assert pair['model02']['body']['data_origin'] == 'SYNTHETIC_DEMO'
            report['simultaneous_health'].append(pair)
        first = pool.submit(call, 8002, '/classify', token=image_token,
                            raw=args.image.read_bytes(), content_type='image/jpeg')
        valid = dict(storage_day=5, temperature_c=30.5, humidity_percent=76.0,
                     weight_g=98.2, color_r=145, color_g=90, color_b=50)
        second = pool.submit(call, 8000, '/predict-risk', token=risk_token, payload=valid)
        report['model01_prediction'] = first.result()
        report['model02_prediction'] = second.result()
    result = report['model01_prediction']
    assert result['status'] == 200
    assert result['body']['predicted_class'] == baseline['predicted_class']
    assert abs(result['body']['score'] - baseline['score']) < 1e-7
    assert result['body']['modelVersion'] == baseline['model_version']
    report['model01_matches_phase1_baseline'] = True
    assert report['model02_prediction']['status'] == 200
    inputs = [valid,
              {**valid, 'storage_day': 0, 'temperature_c': 22, 'humidity_percent': 40, 'weight_g': 100, 'color_r': 180, 'color_g': 120, 'color_b': 70},
              {**valid, 'storage_day': 60, 'temperature_c': 38, 'humidity_percent': 95, 'weight_g': 80, 'color_r': 90, 'color_g': 50, 'color_b': 25}]
    report['valid_risk_cases'] = []
    for payload in inputs:
        response = call(8000, '/predict-risk', token=risk_token, payload=payload)
        assert response['status'] == 200
        body = response['body']
        assert body['predicted_risk'] in {'Low', 'Medium', 'High'}
        assert body['data_origin'] == 'SYNTHETIC_DEMO' and body['validated_for_real_world_use'] is False
        assert body['title'] == 'Storage Deterioration Risk (Synthetic Demo)'
        assert body['prediction_horizon_days'] is None and body['prediction_horizon_verified'] is False
        assert 'Not validated' in body['warning']
        report['valid_risk_cases'].append({'request': payload, **response})
    invalid = [
        ('missing feature', {k: v for k, v in valid.items() if k != 'color_b'}),
        ('extra field', {**valid, 'horizonDays': 7}),
        ('numeric string', {**valid, 'temperature_c': '30'}),
        ('boolean', {**valid, 'storage_day': True}),
        ('fractional day', {**valid, 'storage_day': 1.5}),
        ('negative day', {**valid, 'storage_day': -1}),
        ('humidity above range', {**valid, 'humidity_percent': 101}),
        ('zero weight', {**valid, 'weight_g': 0}),
        ('RGB above range', {**valid, 'color_r': 256}),
        ('nonfinite number', {**valid, 'temperature_c': float('nan')}),
    ]
    report['invalid_risk_cases'] = []
    for name, payload in invalid:
        response = call(8000, '/predict-risk', token=risk_token, payload=payload)
        assert response['status'] == 422, name
        assert response['body']['error']['code'] == 'RISK_VALIDATION_ERROR'
        assert 'predicted_risk' not in response['body']
        report['invalid_risk_cases'].append({'case': name, **response})
    report['authentication_checks'] = {}
    for name, port, path, payload in [('model01', 8002, '/classify', None), ('model02', 8000, '/predict-risk', valid)]:
        response = call(port, path, raw=b'not-an-image', content_type='image/jpeg') if port == 8002 else call(port, path, payload=payload)
        assert response['status'] == 401
        report['authentication_checks'][name] = response
    report['price_health'] = call(8000, '/health')
    if args.check_camera:
        report['camera_status_probe'] = call(8002, '/camera/status', token=image_token)
    checksums = json.loads((ROOT / 'state/local-runtime/model02-phase1-backup-20261021-004539/checksums.json').read_text(encoding='utf-8-sig'))
    report['artifact_checksums'] = {}
    for filename, expected in checksums['artifacts'].items():
        path = Path(filename)
        if path.suffix == '.joblib':
            path = ROOT / 'ml-service/models/cinnasense_model02_demo.joblib'
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        assert digest == expected['sha256']
        report['artifact_checksums'][path.name] = digest
    (output / 'results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'model01_matches_baseline': True,
                      'simultaneous_health_rounds': 3,
                      'valid_risk_categories': [case['body']['predicted_risk'] for case in report['valid_risk_cases']],
                      'invalid_risk_cases_rejected': len(invalid),
                      'camera_status': report.get('camera_status_probe'),
                      'report': str(output / 'results.json')}, indent=2))


if __name__ == '__main__':
    main()
