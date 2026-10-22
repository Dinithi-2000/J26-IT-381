import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.risk_model_loader import _load_artifact
from app.risk_routes import router
from risk_fixtures import VALID,write_fixture

TOKEN='risk-test-secret-012345678901234567890123456789'
class RiskApiTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'risk.joblib';write_fixture(self.path)
        self.env=patch.dict(os.environ,{'RISK_MODEL_PATH':str(self.path),'RISK_MODEL_SHA256':'','RISK_SERVICE_TOKEN':TOKEN});self.env.start();_load_artifact.cache_clear()
        app=FastAPI();app.include_router(router);self.client=TestClient(app);self.headers={'X-Risk-Service-Token':TOKEN}
    def tearDown(self):
        self.client.close();_load_artifact.cache_clear();self.env.stop();self.temp.cleanup()
    def test_prediction_response_and_independent_risk_health(self):
        response=self.client.post('/predict-risk',json=VALID,headers=self.headers)
        self.assertEqual(response.status_code,200);body=response.json()
        self.assertIn(body['predicted_risk'],['Low','Medium','High']);self.assertEqual(body['data_origin'],'SYNTHETIC_DEMO')
        self.assertFalse(body['validated_for_real_world_use']);self.assertIsNone(body['prediction_horizon_days'])
        self.assertEqual(self.client.get('/risk/health',headers=self.headers).json()['status'],'ready')
    def test_missing_unknown_non_numeric_and_out_of_range_inputs(self):
        invalid=[{key:value for key,value in VALID.items() if key!='color_b'},{**VALID,'extra':1}]
        for key,value in [('storage_day',True),('storage_day',-1),('temperature_c','30'),('temperature_c',None),('temperature_c',86),('humidity_percent',101),('weight_g',0),('weight_g',10001),('color_r',256),('color_g',-1)]:invalid.append({**VALID,key:value})
        for body in invalid:
            response=self.client.post('/predict-risk',json=body,headers=self.headers)
            self.assertEqual(response.status_code,422);self.assertEqual(response.json()['error']['code'],'RISK_VALIDATION_ERROR')
    def test_nonfinite_json_and_malformed_json_do_not_crash_error_rendering(self):
        for value in [float('nan'),float('inf'),float('-inf')]:
            response=self.client.post('/predict-risk',content=json.dumps({**VALID,'temperature_c':value}),headers={**self.headers,'Content-Type':'application/json'})
            self.assertEqual(response.status_code,422);self.assertNotIn('input',str(response.json()))
        response=self.client.post('/predict-risk',content='{bad',headers={**self.headers,'Content-Type':'application/json'})
        self.assertEqual(response.status_code,422)
    def test_authentication_is_separate_and_fails_closed(self):
        self.assertEqual(self.client.post('/predict-risk',json=VALID).status_code,401)
        with patch.dict(os.environ,{'RISK_SERVICE_TOKEN':''}):
            self.assertEqual(self.client.post('/predict-risk',json=VALID,headers=self.headers).status_code,503)
    def test_model_unavailable_does_not_return_fake_predictions(self):
        self.path.unlink();response=self.client.post('/predict-risk',json=VALID,headers=self.headers)
        self.assertEqual(response.status_code,503);self.assertEqual(response.json()['detail']['code'],'RISK_MODEL_UNAVAILABLE')
        self.assertNotIn('predicted_risk',response.json())
    def test_router_is_added_without_changing_existing_price_contracts(self):
        from app import main
        with patch.object(main,'load_artifacts',return_value=(object(),[])),patch.object(main,'predict',return_value=4200):
            with TestClient(main.app) as client:
                self.assertEqual(client.get('/health').json(),{'status':'ok','modelVersion':os.getenv('MODEL_VERSION','xgb-v1')})
                price=client.post('/predict',json={'date':'2026-10-21','district':'Galle','grade':'Alba'})
                self.assertEqual(price.status_code,200);self.assertEqual(price.json()['prediction'],4200)
                self.assertEqual(client.post('/predict-risk',json=VALID,headers=self.headers).status_code,200)
        with patch.dict(main.artifacts,{'model':None,'columns':None,'error':None}), patch.object(main,'load_artifacts',side_effect=main.ModelUnavailableError('fixture price artifact missing')):
            with TestClient(main.app) as client:
                self.assertEqual(client.get('/health').status_code,503)
                self.assertEqual(client.post('/predict-risk',json=VALID,headers=self.headers).status_code,200)

if __name__=='__main__':unittest.main()
