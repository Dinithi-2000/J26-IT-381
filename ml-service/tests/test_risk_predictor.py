import hashlib
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
import joblib
from app.risk_model_loader import FEATURES,RiskModelError,get_risk_artifact,_load_artifact
from app.risk_predictor import predict_risk
from app.risk_schemas import RiskRequest
from risk_fixtures import VALID,write_fixture

class RiskPredictorTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/"fixture.joblib"
        write_fixture(self.path)
        self.env=patch.dict(os.environ,{"RISK_MODEL_PATH":str(self.path),"RISK_MODEL_SHA256":""});self.env.start();_load_artifact.cache_clear()
    def tearDown(self):
        _load_artifact.cache_clear();self.env.stop();self.temp.cleanup()
    def test_loads_once_even_on_concurrent_first_calls(self):
        original=joblib.load
        with patch('joblib.load',wraps=original) as loader:
            with ThreadPoolExecutor(max_workers=6) as pool:artifacts=list(pool.map(lambda _:get_risk_artifact(),range(6)))
            self.assertEqual(loader.call_count,1);self.assertTrue(all(item is artifacts[0] for item in artifacts))
    def test_feature_order_comes_from_artifact_not_request_key_order(self):
        artifact=get_risk_artifact();captured=[]
        def predict(frame):captured.append(frame);return ['High']
        with patch.object(artifact.model,'predict',side_effect=predict):result=predict_risk(RiskRequest(**dict(reversed(list(VALID.items())))))
        self.assertEqual(tuple(captured[0].columns),FEATURES)
        self.assertEqual(captured[0].iloc[0].tolist(),[VALID[key] for key in FEATURES])
        self.assertEqual(result.predicted_risk,'High')
    def test_outputs_are_synthetic_and_no_horizon_is_invented(self):
        result=predict_risk(RiskRequest(**VALID))
        self.assertEqual(result.title,'Storage Deterioration Risk (Synthetic Demo)')
        self.assertEqual(result.data_origin,'SYNTHETIC_DEMO');self.assertFalse(result.validated_for_real_world_use)
        self.assertIsNone(result.prediction_horizon_days);self.assertFalse(result.prediction_horizon_verified)
        self.assertNotIn('probabilities',result.model_dump());self.assertNotIn('confidence',result.model_dump())
    def test_all_three_risk_labels_are_preserved(self):
        for day,expected in [(0,'Low'),(5,'Medium'),(10,'High')]:
            self.assertEqual(predict_risk(RiskRequest(**{**VALID,'storage_day':day})).predicted_risk,expected)
    def test_missing_corrupt_checksum_and_incompatible_runtime_fail_closed(self):
        self.path.unlink()
        with self.assertRaises(RiskModelError):get_risk_artifact()
        self.path.write_bytes(b'not a joblib model')
        with self.assertRaises(RiskModelError):get_risk_artifact()
        write_fixture(self.path)
        with patch.dict(os.environ,{'RISK_MODEL_SHA256':'0'*64}):
            with self.assertRaises(RiskModelError) as caught:get_risk_artifact()
            self.assertEqual(caught.exception.code,'RISK_MODEL_CHECKSUM_MISMATCH')
        with patch('sklearn.__version__','1.9.1'):
            with self.assertRaises(RiskModelError) as caught:get_risk_artifact()
            self.assertEqual(caught.exception.code,'RISK_RUNTIME_INCOMPATIBLE')
    def test_invalid_metadata_is_rejected(self):
        for changes in [{'features':list(reversed(FEATURES))},{'classes':['Low','Medium','High']},{'data_origin':'REAL'},{'horizon_days':0},{'horizon_days':7,'prediction_horizon_days':14}]:
            write_fixture(self.path,**changes)
            with self.assertRaises(RiskModelError):get_risk_artifact()
    def test_verified_metadata_horizon_is_not_a_real_world_validation_claim(self):
        write_fixture(self.path,prediction_horizon_days=7)
        result=predict_risk(RiskRequest(**VALID))
        self.assertEqual(result.prediction_horizon_days,7);self.assertTrue(result.prediction_horizon_verified)
        self.assertFalse(result.validated_for_real_world_use)
    def test_invalid_estimator_output_is_never_returned(self):
        artifact=get_risk_artifact()
        with patch.object(artifact.model,'predict',return_value=['safe to eat']):
            with self.assertRaises(RiskModelError):predict_risk(RiskRequest(**VALID))

if __name__=='__main__':unittest.main()
