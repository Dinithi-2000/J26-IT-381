import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from .camera import CameraError, capture_image
from .inference import Classifier, InvalidImage, ModelUnavailable, NotCinnamon, preprocess_image

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / '.env', override=False)

def configured_path(value):
    path=Path(value).expanduser()
    return path if path.is_absolute() else ROOT/path

def configured_classifier():
    if os.getenv('MODULE02_IMAGE_MODEL_DIR') and not os.getenv('MODULE02_IMAGE_MODEL_PATH'):
        return Classifier(configured_path(os.environ['MODULE02_IMAGE_MODEL_DIR']))
    return Classifier(model_path=configured_path(os.getenv('MODULE02_IMAGE_MODEL_PATH','models/cinnamon_quality_mobilenetv2.keras')),
        class_names_path=configured_path(os.getenv('MODULE02_CLASS_NAMES_PATH','models/class_names.json')),
        model_version=os.getenv('MODULE02_IMAGE_MODEL_VERSION') or None,
        reference_path=configured_path(os.getenv('MODULE02_IMAGE_REFERENCE_PATH','models/cinnamon_reference.npz')))

def service_auth(x_quality_service_token:str=Header(default='')):
    token=os.getenv('MODULE02_IMAGE_SERVICE_TOKEN','')
    if len(token)<32: raise HTTPException(503,detail={'code':'AUTH_UNCONFIGURED','message':'Configure an inference service token.'})
    if not secrets.compare_digest(x_quality_service_token.encode(),token.encode()):
        raise HTTPException(401,detail={'code':'UNAUTHORIZED','message':'Invalid service credentials.'})

def create_app(*, runtime=None, capture=None):
    runtime=runtime or configured_classifier()
    capture=capture or capture_image
    @asynccontextmanager
    async def lifespan(_app):
        try: await run_in_threadpool(runtime.load)
        except ModelUnavailable: pass
        yield
    app=FastAPI(title='CinnaSense Module 02 Image Condition Prototype',lifespan=lifespan)
    origin=os.getenv('MODULE02_ALLOWED_ORIGIN','http://localhost:5173')
    if origin and origin != '*':
        app.add_middleware(CORSMiddleware,allow_origins=[origin],allow_methods=['GET','POST'],allow_headers=['Content-Type','X-Quality-Service-Token','X-Image-Source'])
    @app.get('/health')
    def health(response:Response):
        if runtime.model is None:
            response.status_code=503
            return {'status':'unavailable','code':'MODEL_UNAVAILABLE','reason':runtime.failure_code,'message':'Place the trained .keras model and class_names.json at the configured paths. Restart after fixing artifacts or runtime compatibility.'}
        return {'status':'ready','prototype':True,'modelVersion':runtime.metadata['model_version'],'classes':runtime.metadata['classes'],
            'cinnamonCheck':'on' if getattr(runtime,'gate',None) else 'off'}
    async def captured():
        try:
            snapshot=await run_in_threadpool(capture)
            await run_in_threadpool(preprocess_image,snapshot.data)
            return snapshot
        except CameraError as error: raise HTTPException(error.status,detail={'code':error.code,'message':str(error)}) from None
        except InvalidImage: raise HTTPException(502,detail={'code':'CAMERA_INVALID_IMAGE','message':'Camera did not return a decodable JPEG within the pixel limit.'}) from None
    @app.get('/camera/status',dependencies=[Depends(service_auth)])
    async def camera_status():
        snapshot=await captured()
        return {'status':'connected','source':'esp32_cam','checkedAt':snapshot.captured_at,'message':'Capture endpoint responded with a valid JPEG. This is a point-in-time check.'}
    @app.get('/camera/capture',dependencies=[Depends(service_auth)])
    async def camera_capture():
        snapshot=await captured()
        return Response(snapshot.data,media_type='image/jpeg',headers={'Cache-Control':'no-store','X-Captured-At':snapshot.captured_at})
    async def predict(data,source,captured_at=None):
        try: result=await run_in_threadpool(runtime.predict,data)
        except InvalidImage as error: raise HTTPException(400,detail={'code':'INVALID_IMAGE','message':str(error)}) from None
        except NotCinnamon as error:
            raise HTTPException(422,detail={'code':'NOT_CINNAMON','message':str(error),'similarity':round(error.similarity,3),'threshold':error.threshold}) from None
        except ModelUnavailable as error: raise HTTPException(503,detail={'code':'MODEL_UNAVAILABLE','message':str(error)}) from None
        return {**result,'predicted_class':result['predictedCondition'],'score':result['modelScore'],'class_scores':result['scores'],
            'source':source,'analyzedAt':datetime.now(timezone.utc).isoformat(),**({'capturedAt':captured_at} if captured_at else {})}
    @app.post('/classify',dependencies=[Depends(service_auth)])
    async def classify(request:Request,x_image_source:Literal['manual_upload','esp32_cam']=Header(default='manual_upload')):
        if request.headers.get('content-type','').split(';')[0] not in {'image/jpeg','image/png'}:
            raise HTTPException(415,detail={'code':'INVALID_IMAGE','message':'Use a binary JPEG or PNG body.'})
        content=bytearray()
        async for chunk in request.stream():
            content.extend(chunk)
            if len(content)>5*1024*1024: raise HTTPException(413,detail={'code':'UPLOAD_TOO_LARGE','message':'Maximum image size is 5 MiB.'})
        return await predict(bytes(content),x_image_source)
    @app.post('/classify/camera',dependencies=[Depends(service_auth)])
    async def classify_camera():
        if runtime.model is None: raise HTTPException(503,detail={'code':'MODEL_UNAVAILABLE','message':'No trained image-condition model is loaded.'})
        snapshot=await captured()
        return await predict(snapshot.data,'esp32_cam',snapshot.captured_at)
    return app

app=create_app()
