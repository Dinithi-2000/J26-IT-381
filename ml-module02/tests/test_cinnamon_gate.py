import io
import os
import unittest
from unittest.mock import patch
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient
from cinnasense_quality.inference import NotCinnamon, reference_similarity
from cinnasense_quality.api import create_app

TOKEN='test-service-secret-012345678901234567890123456789'

def photo():
    stream=io.BytesIO();Image.new('RGB',(80,60),(120,80,40)).save(stream,format='JPEG');return stream.getvalue()

class RejectingRuntime:
    model=object();metadata={'model_version':'test','classes':['Suspected Mold','good_quality']};gate={'threshold':.55}
    def load(self):pass
    def predict(self,data):raise NotCinnamon(.42,.55)

class CinnamonGateTests(unittest.TestCase):
    def test_similarity_is_mean_of_k_nearest_references(self):
        reference=np.asarray([[1,0],[0,1],[.6,.8]],dtype=np.float32)
        self.assertAlmostEqual(reference_similarity(np.asarray([1,0],dtype=np.float32),reference,2),(1+.6)/2,places=5)
        self.assertAlmostEqual(reference_similarity(np.asarray([1,0],dtype=np.float32),reference,10),(1+.6+0)/3,places=5)
    def test_non_cinnamon_photo_returns_422_not_a_classification(self):
        with patch.dict(os.environ,{'MODULE02_IMAGE_SERVICE_TOKEN':TOKEN}):
            with TestClient(create_app(runtime=RejectingRuntime())) as client:
                self.assertEqual(client.get('/health').json()['cinnamonCheck'],'on')
                response=client.post('/classify',content=photo(),headers={'Content-Type':'image/jpeg','X-Quality-Service-Token':TOKEN})
        self.assertEqual(response.status_code,422)
        detail=response.json()['detail']
        self.assertEqual(detail['code'],'NOT_CINNAMON');self.assertEqual(detail['similarity'],.42)
        self.assertNotIn('predictedCondition',response.json())

if __name__=='__main__':unittest.main()
