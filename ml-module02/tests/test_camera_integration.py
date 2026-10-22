import io
import json
import os
import tempfile
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient
from cinnasense_quality.inference import Classifier, InvalidImage, ModelUnavailable, preprocess_image
from cinnasense_quality.camera import CameraError, Capture, NoRedirect, capture_image
from cinnasense_quality.api import create_app

TOKEN='test-service-secret-012345678901234567890123456789'
def image_bytes(fmt='PNG',mode='RGB',color=(255,127,0)):
    stream=io.BytesIO();Image.new(mode,(80,60),color).save(stream,format=fmt);return stream.getvalue()

class FakeModel:
    input_shape=(None,224,224,3)
    output_shape=(None,2)
    def __init__(self):self.inputs=[]
    def __call__(self,pixels,training=False):
        self.inputs.append(pixels.copy());return np.asarray([[.09,.91]],dtype=np.float32)

class RuntimeTests(unittest.TestCase):
    def test_preprocessing_preserves_raw_float_pixels_and_rgb_shape(self):
        pixels=preprocess_image(image_bytes('PNG','RGBA',(255,127,0,255)))
        self.assertEqual(pixels.shape,(1,224,224,3));self.assertEqual(pixels.dtype,np.float32)
        np.testing.assert_array_equal(pixels[0,0,0],[255,127,0])
        gray=preprocess_image(image_bytes('PNG','L',200));np.testing.assert_array_equal(gray[0,0,0],[200,200,200])
    def test_invalid_image_rejected(self):
        for data in [b'',b'not a photograph',b'\xff\xd8\xffbroken\xff\xd9',b'x'*(5*1024*1024+1)]:
            with self.assertRaises(InvalidImage):preprocess_image(data)
    def test_corrupt_png_checksum_is_an_invalid_image(self):
        photo=bytearray(image_bytes());photo[29] ^= 1
        with self.assertRaises(InvalidImage):preprocess_image(bytes(photo))
    def test_colab_label_order_loader_contract_and_prediction(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'model.keras').write_bytes(b'TEST ARTIFACT NOT REAL WEIGHTS');(root/'class_names.json').write_text('["Suspected Mold","good_quality"]')
            calls=[];model=FakeModel()
            def loader(path,**kwargs):calls.append((path,kwargs));return model
            runtime=Classifier(model_path=root/'model.keras',class_names_path=root/'class_names.json',loader=loader)
            runtime.load();first=runtime.predict(image_bytes());runtime.predict(image_bytes())
            self.assertEqual(len(calls),1);self.assertEqual(calls[0][1],{'compile':False,'safe_mode':True})
            self.assertEqual(first['predictedCondition'],'good_quality');self.assertAlmostEqual(first['modelScore'],.91,places=6)
            self.assertEqual(list(first['scores']),['Suspected Mold','good_quality']);self.assertEqual(model.inputs[0].max(),255)
    def test_missing_model_and_wrong_label_order_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);labels=root/'class_names.json';labels.write_text('["Suspected Mold","good_quality"]')
            runtime=Classifier(model_path=root/'missing.keras',class_names_path=labels,loader=lambda *_args,**_kwargs:FakeModel())
            with self.assertRaises(ModelUnavailable):runtime.load()
            (root/'model.keras').write_bytes(b'fixture');labels.write_text('["good_quality","Suspected Mold"]')
            runtime=Classifier(model_path=root/'model.keras',class_names_path=labels)
            with self.assertRaises(ModelUnavailable):runtime.load()
            self.assertEqual(runtime.failure_code,'MODEL_LABELS_INVALID');self.assertIsNone(runtime.model)

class CameraTests(unittest.TestCase):
    def test_unreachable_camera_does_not_expose_url_in_error(self):
        class Offline:
            def open(self,*_args,**_kwargs):raise URLError('private network details')
        with self.assertRaises(CameraError) as caught:capture_image(url='http://127.0.0.1/capture',opener=Offline())
        self.assertEqual(caught.exception.code,'CAMERA_UNREACHABLE');self.assertNotIn('127.0.0.1',str(caught.exception))
    def test_successful_capture_limits_and_redirects(self):
        data=image_bytes('JPEG')
        class Reply(io.BytesIO):
            status=200
            headers=Message()
        Reply.headers['Content-Type']='image/jpeg'
        class Online:
            def open(self,request,timeout):
                self.url=request.full_url;self.timeout=timeout;return Reply(data)
        opener=Online();result=capture_image(url='http://127.0.0.1/capture',opener=opener)
        self.assertEqual(result.data,data);self.assertEqual(opener.url,'http://127.0.0.1/capture');self.assertTrue(result.captured_at)
        with self.assertRaises(CameraError):capture_image(url='file:///etc/passwd',opener=opener)
        with self.assertRaises(CameraError):NoRedirect().redirect_request(None,None,None,None,None,None)
        Reply.headers.replace_header('Content-Type','text/html')
        with self.assertRaises(CameraError) as caught:capture_image(url='http://127.0.0.1/capture',opener=opener)
        self.assertEqual(caught.exception.code,'CAMERA_INVALID_RESPONSE')

class ApiTests(unittest.TestCase):
    def setUp(self):
        self.environment=patch.dict(os.environ,{'MODULE02_IMAGE_SERVICE_TOKEN':TOKEN,'MODULE02_ALLOWED_ORIGIN':'http://localhost:5173'});self.environment.start()
        self.temp=tempfile.TemporaryDirectory();root=Path(self.temp.name);(root/'model.keras').write_bytes(b'TEST');(root/'class_names.json').write_text('["Suspected Mold","good_quality"]')
        self.model=FakeModel();self.loads=0
        def loader(*_args,**_kwargs):self.loads+=1;return self.model
        self.runtime=Classifier(model_path=root/'model.keras',class_names_path=root/'class_names.json',loader=loader)
        self.headers={'X-Quality-Service-Token':TOKEN}
    def tearDown(self):self.temp.cleanup();self.environment.stop()
    def test_health_manual_upload_camera_prediction_and_same_image_bytes(self):
        photo=image_bytes('JPEG');snapshot=Capture(photo,'2026-10-20T09:00:00+00:00')
        with TestClient(create_app(runtime=self.runtime,capture=lambda:snapshot)) as client:
            self.assertEqual(client.get('/health').json()['classes'],['Suspected Mold','good_quality'])
            self.assertEqual(client.get('/camera/status',headers=self.headers).json()['status'],'connected')
            self.assertEqual(client.get('/camera/capture',headers=self.headers).content,photo)
            result=client.post('/classify',headers={**self.headers,'Content-Type':'image/png'},content=image_bytes())
            self.assertEqual(result.status_code,200);self.assertEqual(result.json()['predicted_class'],'good_quality');self.assertEqual(result.json()['source'],'manual_upload')
            result=client.post('/classify/camera',headers=self.headers)
            self.assertEqual(result.status_code,200);body=result.json();self.assertEqual(body['source'],'esp32_cam');self.assertEqual(body['predicted_class'],'good_quality');self.assertEqual(body['class_scores'],body['scores']);self.assertEqual(body['score'],body['modelScore']);self.assertEqual(body['capturedAt'],snapshot.captured_at)
            self.assertEqual(self.loads,1)
    def test_auth_upload_validation_camera_failure_and_cors(self):
        def offline():raise CameraError('CAMERA_UNREACHABLE','Camera unavailable.')
        with TestClient(create_app(runtime=self.runtime,capture=offline)) as client:
            self.assertEqual(client.get('/camera/status').status_code,401)
            self.assertEqual(client.get('/camera/status',headers=self.headers).json()['detail']['code'],'CAMERA_UNREACHABLE')
            self.assertEqual(client.post('/classify',headers={**self.headers,'Content-Type':'image/png'},content=b'invalid').status_code,400)
            self.assertEqual(client.post('/classify',headers={**self.headers,'Content-Type':'text/plain'},content=b'invalid').status_code,415)
            self.assertEqual(client.post('/classify',headers={**self.headers,'Content-Type':'image/png'},content=b'x'*(5*1024*1024+1)).status_code,413)
            response=client.options('/classify',headers={'Origin':'http://untrusted.invalid','Access-Control-Request-Method':'POST'})
            self.assertNotIn('access-control-allow-origin',response.headers)
    def test_missing_artifact_returns_503_without_fake_scores(self):
        runtime=Classifier(model_path=Path(self.temp.name)/'missing.keras',class_names_path=Path(self.temp.name)/'class_names.json')
        with TestClient(create_app(runtime=runtime)) as client:
            response=client.get('/health');self.assertEqual(response.status_code,503);self.assertNotIn('modelScore',response.json())
            response=client.post('/classify/camera',headers=self.headers);self.assertEqual(response.json()['detail']['code'],'MODEL_UNAVAILABLE')

if __name__=='__main__':unittest.main()
