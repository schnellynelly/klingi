import base64
import cv2
import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel

from app.ws.hub import hub
from app.services.events import now_iso
from app.database.db import log_event, list_logs
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
    
    # Process frames
    for i, frame_b64 in enumerate(req.frames[:8]):  # max 8 frames
        try:
            image_data = base64.b64decode(frame_b64)
            bgr = bgr_from_bytes(image_data)
            if bgr is None:
                continue
            
            emb, bbox = face_engine.get_embedding(bgr)
            if emb is None or bbox is None:
                continue
            
            frame_list.append((bgr, bbox))
            
            # Track face position for head movement detection
            face_center = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
            face_positions.append(face_center)
        except Exception as e:
            continue
    
    if len(frame_list) < 3:
        return {'ok': False, 'error': 'insufficient valid face detections', 'frames_analyzed': len(frame_list)}
    
    # Detect blinks between consecutive frames
    for i in range(1, len(frame_list)):
        prev_bgr, prev_bbox = frame_list[i-1]
        curr_bgr, curr_bbox = frame_list[i]
        
        # Use current frame bbox for detection
        if face_engine.detect_blink(prev_bgr, curr_bgr, curr_bbox):
            blinks_detected += 1
    
    # Check for head movement (not just position jitter)
    # Real head movement should be significant and sustained
    head_movement_score = 0
    if len(face_positions) >= 3:
        distances = []
        for i in range(1, len(face_positions)):
            dx = face_positions[i][0] - face_positions[i-1][0]
            dy = face_positions[i][1] - face_positions[i-1][1]
            dist = (dx*dx + dy*dy) ** 0.5
            distances.append(dist)
        
        # Movement should be consistent and directional (not random jitter)
        avg_motion = sum(distances) / len(distances) if distances else 0
        # Stricter threshold: need significant movement
        if avg_motion > 20:  # Increased from 5 to 20 pixels
            head_movement_score = 1
    
    # Calculate liveness confidence
    # Require at least one blink OR significant head movement
    is_live = blinks_detected >= 1 or head_movement_score >= 1
    
    return {
        'ok': True,
        'is_live': is_live,
        'blinks_detected': blinks_detected,
        'head_movement': head_movement_score >= 1,
        'frames_analyzed': len(frame_list)
    }
    }

@router.post('/auth/pin')
async def auth_pin(req: PinReq):
    from app.main import mqtt_bus, SETTINGS
    ts = now_iso()
    ok = verify_pin(req.pin, SETTINGS['PIN'])
    if ok:
        log_event(ts, 'unlock', 'PIN accepted')
        mqtt_bus.publish('lock/cmd', {'event': 'unlock', 'detail': 'PIN accepted', 'ts': ts})
        mqtt_bus.publish('buzzer/cmd', {'event': 'buzz', 'detail': 'access granted', 'ts': ts})
        await hub.broadcast({'ts': ts, 'event': 'unlock', 'detail': 'PIN accepted'})
        return {'ok': True, 'result': 'granted'}
    else:
        log_event(ts, 'deny', 'PIN denied')
        mqtt_bus.publish('buzzer/cmd', {'event': 'buzz', 'detail': 'access denied', 'ts': ts})
        await hub.broadcast({'ts': ts, 'event': 'deny', 'detail': 'PIN denied'})
        return {'ok': False, 'result': 'denied'}

@router.post('/door/unlock')
async def door_unlock(req: UnlockReq):
    from app.main import mqtt_bus
    ts = now_iso()
    log_event(ts, 'unlock', f'manual: {req.reason}')
    mqtt_bus.publish('lock/cmd', {'event': 'unlock', 'detail': f'manual: {req.reason}', 'ts': ts})
    mqtt_bus.publish('buzzer/cmd', {'event': 'buzz', 'detail': 'access granted', 'ts': ts})
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
    log_event(ts, 'ring', 'touchscreen pressed')
    await hub.broadcast({'ts': ts, 'event': 'ring', 'detail': 'touchscreen pressed'})

    frame = camera.read_bgr()
    if frame is None:
        await hub.broadcast({'ts': ts, 'event': 'error', 'detail': 'camera read failed'})
        return {'ok': False, 'error': 'camera'}

    emb, bbox = face_engine.get_embedding(frame)
    if emb is None:
        log_event(ts, 'deny', 'no face detected')
        mqtt_bus.publish('buzzer/cmd', {'event': 'buzz', 'detail': 'access denied', 'ts': ts})
        await hub.broadcast({'ts': ts, 'event': 'deny', 'detail': 'no face detected'})
        return {'ok': False, 'result': 'no_face'}

    ok, best = match_face(face_engine, emb, threshold=SETTINGS['FACE_THRESHOLD'])
    if ok:
        name = best['name']
        log_event(ts, 'unlock', f'face recognized: {name} d={best["distance"]:.3f}')
        mqtt_bus.publish('lock/cmd', {'event': 'unlock', 'detail': f'face: {name}', 'ts': ts})
        mqtt_bus.publish('buzzer/cmd', {'event': 'buzz', 'detail': 'access granted', 'ts': ts})
        await hub.broadcast({'ts': ts, 'event': 'recognized', 'detail': name, 'bbox': bbox, 'match': best})
        return {'ok': True, 'result': 'granted', 'name': name, 'match': best}
    else:
        log_event(ts, 'deny', f'unknown face best={best}')
        mqtt_bus.publish('buzzer/cmd', {'event': 'buzz', 'detail': 'access denied', 'ts': ts})
        await hub.broadcast({'ts': ts, 'event': 'deny', 'detail': 'unknown face', 'bbox': bbox, 'match': best})
        return {'ok': False, 'result': 'denied', 'match': best}
