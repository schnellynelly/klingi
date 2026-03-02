import numpy as np
import cv2
from insightface.app import FaceAnalysis

class FaceEngine:
    def __init__(self):
        # CPU first (good for Windows dev). Later on Pi you can tune.
        self.app = FaceAnalysis(name='buffalo_l')
        self.app.prepare(ctx_id=-1, det_size=(640, 640))
        # Load face landmarks for liveness detection
        self.detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.eye_detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

    def get_embedding(self, bgr: np.ndarray):
        faces = self.app.get(bgr)
        if not faces:
            return None, None
        # take biggest face
        faces = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
        f = faces[0]
        emb = f.normed_embedding.astype(np.float32)  # already normalized
        bbox = [float(x) for x in f.bbox]
        return emb, bbox

    def detect_eyes_open(self, bgr: np.ndarray, face_bbox) -> bool:
        """Check if eyes are detected (simple heuristic for eye opening)."""
        try:
            x, y, w, h = int(face_bbox[0]), int(face_bbox[1]), int(face_bbox[2]-face_bbox[0]), int(face_bbox[3]-face_bbox[1])
            x, y = max(0, x), max(0, y)
            face_roi = bgr[y:y+h, x:x+w]
            eyes = self.eye_detector.detectMultiScale(face_roi, 1.1, 4)
            return len(eyes) >= 2  # Need both eyes detected
        except:
            return False

    def detect_blink(self, prev_bgr: np.ndarray, curr_bgr: np.ndarray, face_bbox) -> bool:
        """Detect eye blink by comparing eye detection across frames."""
        try:
            x, y, w, h = int(face_bbox[0]), int(face_bbox[1]), int(face_bbox[2]-face_bbox[0]), int(face_bbox[3]-face_bbox[1])
            x, y = max(0, x), max(0, y)
            
            # Check previous frame
            prev_roi = prev_bgr[y:y+h, x:x+w] if prev_bgr is not None else None
            curr_roi = curr_bgr[y:y+h, x:x+w]
            
            if prev_roi is None:
                return False
                
            prev_eyes = self.eye_detector.detectMultiScale(prev_roi, 1.1, 4)
            curr_eyes = self.eye_detector.detectMultiScale(curr_roi, 1.1, 4)
            
            # Blink detected: previous frame had eyes, current frame doesn't (or vice versa)
            prev_eyes_open = len(prev_eyes) >= 2
            curr_eyes_open = len(curr_eyes) >= 2
            
            # More robust: detect significant drop in eye count (indicates closing)
            return (prev_eyes_open and not curr_eyes_open) or (len(prev_eyes) > len(curr_eyes) + 1)
        except:
            return False

    @staticmethod
    def cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
        # embeddings are normalized, so cosine similarity = dot
        sim = float(np.dot(a, b))
        return 1.0 - sim
