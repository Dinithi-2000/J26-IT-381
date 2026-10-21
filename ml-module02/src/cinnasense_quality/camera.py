"""Read the configured CameraWebServer /capture endpoint; never accepts client URLs."""
import math
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

class CameraError(RuntimeError):
    def __init__(self, code, message, status=502):
        super().__init__(message); self.code=code; self.status=status

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise CameraError('CAMERA_INVALID_RESPONSE', 'Camera redirects are not allowed. Configure the direct capture URL.')

@dataclass
class Capture:
    data: bytes
    captured_at: str

def capture_image(*, url=None, opener=None):
    url = url or os.getenv('ESP32_CAM_URL','')
    try:
        parsed = urlsplit(url)
        if parsed.scheme not in {'http','https'} or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
            raise ValueError('Invalid camera URL')
        timeout = float(os.getenv('ESP32_CAM_TIMEOUT_SECONDS','8'))
        if not math.isfinite(timeout) or not 1 <= timeout <= 30: raise ValueError('Invalid timeout')
    except (ValueError, TypeError):
        raise CameraError('CAMERA_NOT_CONFIGURED','Set ESP32_CAM_URL to a direct HTTP(S) capture URL and a timeout from 1 to 30 seconds.',503) from None
    opener = opener or build_opener(ProxyHandler({}), NoRedirect())
    try:
        request = Request(url, headers={'Accept':'image/jpeg','Cache-Control':'no-cache'})
        with opener.open(request,timeout=timeout) as response:
            if response.status != 200 or response.headers.get_content_type() != 'image/jpeg':
                raise CameraError('CAMERA_INVALID_RESPONSE','Camera did not return a JPEG image.')
            declared = response.headers.get('Content-Length')
            if declared and (not declared.isdigit() or int(declared)>5*1024*1024):
                raise CameraError('CAMERA_IMAGE_TOO_LARGE','Camera image exceeds the 5 MiB limit.',413)
            data=bytearray(); started=time.monotonic()
            while True:
                chunk=response.read(min(65536,5*1024*1024+1-len(data)))
                if not chunk: break
                data.extend(chunk)
                if len(data)>5*1024*1024: raise CameraError('CAMERA_IMAGE_TOO_LARGE','Camera image exceeds the 5 MiB limit.',413)
                if time.monotonic()-started>timeout: raise CameraError('CAMERA_TIMEOUT','Camera capture timed out.',504)
        if len(data)<4 or not data.startswith(b'\xff\xd8\xff') or not data.endswith(b'\xff\xd9'):
            raise CameraError('CAMERA_INVALID_IMAGE','Camera returned an invalid JPEG.')
        return Capture(bytes(data),datetime.now(timezone.utc).isoformat())
    except CameraError: raise
    except (TimeoutError, OSError, URLError, HTTPError):
        raise CameraError('CAMERA_UNREACHABLE','Cannot capture an image. Check camera power, Wi-Fi, current IP address and /capture endpoint.') from None
