import base64
import cv2
import numpy as np
import time
from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from app.ws.hub import hub
from app.services.events import now_iso
from app.database.db import log_event, list_logs, get_conn
from app.security.pin import verify_pin
from app.face.store import add_face, list_faces, delete_face, match_face
from app.audio.tts import speak

router = APIRouter()

class PinReq(BaseModel):
    pin: str

class SpeakReq(BaseModel):
    text: str

class UnlockReq(BaseModel):
    reason: str = 'manual'

class EnrollReq(BaseModel):
    name: str
    image_b64: str

class LivenessReq(BaseModel):
    frames: list  # list of base64 images

class ClearFacesReq(BaseModel):
    pin: str

def bgr_from_bytes(file_bytes: bytes):
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img

@router.get('/health')
def health():
    return {'ok': True, 'service': 'klingi'}

@router.get('/logs')
def logs():
    return {'ok': True, 'logs': list_logs(200)}

@router.get('/faces')
def faces():
    return {'ok': True, 'faces': list_faces()}

@router.delete('/faces/{face_id}')
async def faces_delete(face_id: int):
    delete_face(face_id)
    ts = now_iso()
    log_event(ts, 'face_deleted', f'id={face_id}')
    await hub.broadcast({'ts': ts, 'event': 'face_deleted', 'detail': f'id={face_id}'})
    return {'ok': True}


@router.post('/faces/clear')
async def faces_clear(req: ClearFacesReq):
    """Delete all enrolled faces. Requires admin PIN."""
    from app.main import SETTINGS
    ts = now_iso()
    if not verify_pin(req.pin, SETTINGS['PIN']):
        return {'ok': False, 'error': 'invalid_pin'}
    conn = get_conn()
    conn.execute('DELETE FROM faces')
    conn.commit()
    conn.close()
    log_event(ts, 'faces_cleared', 'all faces removed')
    await hub.broadcast({'ts': ts, 'event': 'faces_cleared', 'detail': 'all faces removed'})
    return {'ok': True}

@router.post('/faces/enroll')
async def faces_enroll(req: EnrollReq):
    from app.main import face_engine  # avoid circular import at import time
    try:
        image_data = base64.b64decode(req.image_b64)
    except Exception:
        return {'ok': False, 'error': 'invalid image data'}
    
    bgr = bgr_from_bytes(image_data)
    if bgr is None:
        return {'ok': False, 'error': 'bad image'}

    emb, bbox = face_engine.get_embedding(bgr)
    if emb is None:
        return {'ok': False, 'error': 'no face detected'}

    ts = add_face(req.name, emb)
    log_event(ts, 'face_enrolled', req.name)
    await hub.broadcast({'ts': ts, 'event': 'face_enrolled', 'detail': req.name, 'bbox': bbox})
    return {'ok': True, 'name': req.name}

@router.post('/liveness/check')
async def liveness_check(req: LivenessReq):
    from app.main import face_engine
    if len(req.frames) < 3:
        return {'ok': False, 'error': 'need at least 3 frames'}
    
    blinks_detected = 0
    frame_list = []
    face_positions = []
    
    for i, frame_b64 in enumerate(req.frames[:8]):
        try:
            image_data = base64.b64decode(frame_b64)
            bgr = bgr_from_bytes(image_data)
            if bgr is None: continue
            emb, bbox = face_engine.get_embedding(bgr)
            if emb is None or bbox is None: continue
            frame_list.append((bgr, bbox))
            face_center = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
            face_positions.append(face_center)
        except Exception: continue
    
    if len(frame_list) < 3:
        return {'ok': False, 'error': 'insufficient valid detections'}
    
    for i in range(1, len(frame_list)):
        prev_bgr, prev_bbox = frame_list[i-1]
        curr_bgr, curr_bbox = frame_list[i]
        if face_engine.detect_blink(prev_bgr, curr_bgr, curr_bbox):
            blinks_detected += 1
    
    head_movement_score = 0
    if len(face_positions) >= 3:
        distances = []
        for i in range(1, len(face_positions)):
            dx = face_positions[i][0] - face_positions[i-1][0]
            dy = face_positions[i][1] - face_positions[i-1][1]
            distances.append((dx*dx + dy*dy) ** 0.5)
        avg_motion = sum(distances) / len(distances) if distances else 0
        if avg_motion > 20: head_movement_score = 1
    
    is_live = blinks_detected >= 1 or head_movement_score >= 1
    # simple confidence heuristic: blinks and head motion increase confidence
    confidence = min(100, int(blinks_detected * 60 + head_movement_score * 40))
    return {'ok': True, 'is_live': is_live, 'blinks_detected': blinks_detected, 'confidence': confidence}

@router.post('/auth/pin')
async def auth_pin(req: PinReq):
    from app.main import mqtt_bus, SETTINGS
    ts = now_iso()
    ok = verify_pin(req.pin, SETTINGS['PIN'])
    if ok:
        log_event(ts, 'unlock', 'PIN accepted')
        mqtt_bus.publish('lock/cmd', {'event': 'unlock', 'detail': 'PIN accepted', 'ts': ts})
        await hub.broadcast({'ts': ts, 'event': 'unlock', 'detail': 'PIN accepted'})
        return {'ok': True, 'result': 'granted'}
    return {'ok': False, 'result': 'denied'}


@router.post('/admin/login')
def admin_login(req: PinReq):
    """Verify admin PIN for frontend login. Returns {ok: True/False}."""
    from app.main import SETTINGS
    ok = verify_pin(req.pin, SETTINGS['PIN'])
    return {'ok': bool(ok)}


@router.get('/cam_status')
def cam_status():
    """Return camera status and a quick frame probe for debugging."""
    try:
        from app.main import camera
    except Exception as e:
        return {'ok': False, 'error': 'no_camera_instance', 'detail': str(e)}
    status = {}
    try:
        cap = getattr(camera, 'cap', None)
        status['opened'] = bool(cap and cap.isOpened())
        frame = camera.read_bgr()
        if frame is None:
            status['frame'] = None
            return {'ok': True, 'status': status}
        # report basic frame info
        h, w = frame.shape[:2]
        status['frame'] = {'width': int(w), 'height': int(h)}
        return {'ok': True, 'status': status}
    except Exception as e:
        return {'ok': False, 'error': 'probe_failed', 'detail': str(e)}

@router.post('/door/unlock')
async def door_unlock(req: UnlockReq):
    from app.main import mqtt_bus
    ts = now_iso()
    log_event(ts, 'unlock', f'manual: {req.reason}')
    mqtt_bus.publish('lock/cmd', {'event': 'unlock', 'detail': f'manual: {req.reason}', 'ts': ts})
    await hub.broadcast({'ts': ts, 'event': 'unlock', 'detail': f'manual: {req.reason}'})
    return {'ok': True}

@router.post('/speak')
async def speak_api(req: SpeakReq):
    ts = now_iso()
    speak(req.text)
    log_event(ts, 'speak', req.text)
    await hub.broadcast({'ts': ts, 'event': 'speak', 'detail': req.text})
    return {'ok': True}

@router.post('/ring')
async def ring():
    from app.main import camera, face_engine, mqtt_bus, SETTINGS
    ts = now_iso()
    log_event(ts, 'ring', 'recognition attempt')
    await hub.broadcast({'ts': ts, 'event': 'ring', 'detail': 'recognition attempt'})
    
    # Quick single-frame detection and recognition (skip liveness for speed)
    frame = camera.read_bgr()
    if frame is None:
        await hub.broadcast({'ts': ts, 'event': 'deny', 'detail': 'camera error'})
        return {'ok': False, 'result': 'no_camera'}
    
    emb, bbox = face_engine.get_embedding(frame)
    if emb is None:
        await hub.broadcast({'ts': ts, 'event': 'deny', 'detail': 'no face detected'})
        return {'ok': False, 'result': 'no_face'}
    
    ok, best = match_face(face_engine, emb, threshold=SETTINGS['FACE_THRESHOLD'])
    if ok:
        name = best['name']
        log_event(ts, 'recognized', name)
        mqtt_bus.publish('lock/cmd', {'event': 'unlock', 'detail': f'face: {name}', 'ts': ts})
        await hub.broadcast({'ts': ts, 'event': 'recognized', 'detail': name, 'bbox': bbox})
        return {'ok': True, 'result': 'granted', 'name': name}
    
    log_event(ts, 'deny', 'unknown face')
    await hub.broadcast({'ts': ts, 'event': 'deny', 'detail': 'unknown face', 'bbox': bbox})
    return {'ok': False, 'result': 'denied'}

@router.get('/detect')
async def detect():
    """Detect face in current frame. Returns bounding box for face tracking in live view."""
    from app.main import camera, face_engine
    frame = camera.read_bgr()
    if frame is None:
        return {'ok': False, 'error': 'no_frame'}
    
    emb, bbox = face_engine.get_embedding(frame)
    if bbox is None:
        return {'ok': False, 'error': 'no_face'}
    
    return {'ok': True, 'bbox': bbox}

@router.post('/audio')
async def audio_upload(audio: UploadFile = File(...)):
    """Receive audio from mobile device and play through speaker."""
    try:
        from app.main import mqtt_bus
        ts = now_iso()
        
        # Read audio file
        contents = await audio.read()
        
        if not contents:
            return {'ok': False, 'error': 'empty audio'}
        
        # Log the audio communication event
        log_event(ts, 'audio_call', f'received {len(contents)} bytes of audio')
        
        # Broadcast to connected clients that audio was received
        await hub.broadcast({'ts': ts, 'event': 'audio_call', 'detail': 'two-way audio from mobile'})
        
        # Optionally: send a signal to the door/speaker hardware
        # mqtt_bus.publish('speaker/cmd', {'event': 'play_audio', 'ts': ts})
        
        return {'ok': True, 'message': 'Audio received and playing on speaker'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}