import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI, Header, HTTPException, Request, Response
from starlette.concurrency import run_in_threadpool
from .inference import Classifier, InvalidImage, ModelUnavailable

classifier=Classifier(os.getenv("MODULE02_IMAGE_MODEL_DIR",str(Path(__file__).resolve().parents[2]/"artifacts"/"condition-v1")))
@asynccontextmanager
async def lifespan(_app):
    try: await run_in_threadpool(classifier.load)
    except ModelUnavailable: pass
    yield
app=FastAPI(title="CinnaSense Module 02 Image Condition Prototype",lifespan=lifespan)
@app.get("/health")
def health(response:Response):
    if classifier.model is None:
        response.status_code=503
        return {"status":"unavailable","code":"MODEL_UNAVAILABLE","message":"No compatible trained image-condition artifact is loaded."}
    return {"status":"ready","prototype":True,"modelVersion":classifier.metadata["model_version"],"classes":classifier.metadata["classes"]}
@app.post("/classify")
async def classify(request:Request,x_quality_service_token:str=Header(default="")):
    token=os.getenv("MODULE02_IMAGE_SERVICE_TOKEN","")
    if len(token)<32: raise HTTPException(503,detail={"code":"AUTH_UNCONFIGURED","message":"Configure an inference service token."})
    if not secrets.compare_digest(x_quality_service_token.encode(),token.encode()): raise HTTPException(401,detail={"code":"UNAUTHORIZED","message":"Invalid service credentials."})
    if request.headers.get("content-type","").split(";")[0] not in {"image/jpeg","image/png"}: raise HTTPException(415,detail={"code":"INVALID_IMAGE","message":"Use a binary JPEG or PNG body."})
    content=bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content)>5*1024*1024: raise HTTPException(413,detail={"code":"UPLOAD_TOO_LARGE","message":"Maximum image size is 5 MiB."})
    try: result=await run_in_threadpool(classifier.predict,bytes(content))
    except InvalidImage as error: raise HTTPException(400,detail={"code":"INVALID_IMAGE","message":str(error)}) from error
    except ModelUnavailable as error: raise HTTPException(503,detail={"code":"MODEL_UNAVAILABLE","message":str(error)}) from error
    return {**result,"analyzedAt":datetime.now(timezone.utc).isoformat()}
