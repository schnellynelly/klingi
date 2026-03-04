from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, Response, FileResponse
import cv2
import numpy as np
import os

from app.database.db import init_db
from app.ws.hub import hub
from app.camera.stream import Camera, mjpeg_response
from app.mqtt.client import MqttBus
from app.face.engine import FaceEngine
from app.api.routes import router as api_router

SETTINGS = {
    'MQTT_HOST': '127.0.0.1',
    'MQTT_PORT': 1883,
    'MQTT_BASE': 'klingi',
    'PIN': '1234',
    'FACE_THRESHOLD': 0.28,
    # tightened default threshold to reduce false positives
    # lower values are stricter (e.g. 0.28 means similarity >= 0.72 required)
    'CAM_INDEX': 0
}

app = FastAPI(title='Klingi')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Global singletons (PC-first)
camera = Camera(index=SETTINGS['CAM_INDEX'])
mqtt_bus = MqttBus(host=SETTINGS['MQTT_HOST'], port=SETTINGS['MQTT_PORT'], base_topic=SETTINGS['MQTT_BASE'])
face_engine = FaceEngine()

@app.on_event('startup')
def _startup():
    init_db()

@app.get('/stream.mjpg')
def stream():
    return mjpeg_response(camera)

@app.get('/frame.jpg')
def frame_jpg():
    # return a single JPEG frame for browsers that don't support MJPEG
    frame = camera.read_bgr()
    if frame is None:
        # log for debugging
        print('frame.jpg: no frame available from camera')
        # return a small black JPEG so browsers don't show broken image
        placeholder = np.zeros((16,16,3), dtype=np.uint8)
        ok, jpg = cv2.imencode('.jpg', placeholder)
        if ok:
            return Response(jpg.tobytes(), media_type='image/jpeg')
        return Response(b'', media_type='image/jpeg')
    ok, jpg = cv2.imencode('.jpg', frame)
    if not ok:
        print('frame.jpg: cv2.imencode failed')
        placeholder = np.zeros((16,16,3), dtype=np.uint8)
        ok2, jpg2 = cv2.imencode('.jpg', placeholder)
        if ok2:
            return Response(jpg2.tobytes(), media_type='image/jpeg')
        return Response(b'', media_type='image/jpeg')
    return Response(jpg.tobytes(), media_type='image/jpeg')

@app.websocket('/ws')
async def ws(ws: WebSocket):
    await hub.connect(ws)
    try:
        while True:
            # keepalive / ignore inbound for now
            await ws.receive_text()
    except Exception:
        pass
    finally:
        await hub.disconnect(ws)

app.include_router(api_router, prefix='/api')

# Serve React build when available (production)
BASE_DIR = os.path.dirname(__file__)
REACT_DIST = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'frontend-react', 'dist'))
if os.path.isdir(REACT_DIST):
    # mount static assets from the React build
    app.mount('/static', StaticFiles(directory=REACT_DIST), name='static')
    INDEX_HTML = os.path.join(REACT_DIST, 'index.html')

    @app.get('/')
    def root():
        return FileResponse(INDEX_HTML)
else:
    # Fallback to legacy frontend for development or before build
    STATIC_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'frontend', 'static'))
    app.mount('/static', StaticFiles(directory=STATIC_DIR), name='static')
    INDEX_HTML = os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'frontend', 'templates', 'index.html'))

    @app.get('/')
    def root():
        return FileResponse(INDEX_HTML)

