import cv2
import time
from fastapi.responses import StreamingResponse

class Camera:
    def __init__(self, index: int = 0, width=1280, height=720):
        self.cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

    def read_bgr(self):
        ok, frame = self.cap.read()
        if not ok:
            return None
        return frame

    def mjpeg_generator(self, fps=12):
        delay = 1.0 / fps
        while True:
            frame = self.read_bgr()
            if frame is None:
                time.sleep(0.2)
                continue
            ok, jpg = cv2.imencode('.jpg', frame)
            if not ok:
                continue
            yield (b'--frame\\r\\n'
                   b'Content-Type: image/jpeg\\r\\n\\r\\n' + jpg.tobytes() + b'\\r\\n')
            time.sleep(delay)

def mjpeg_response(camera: Camera):
    return StreamingResponse(camera.mjpeg_generator(), media_type='multipart/x-mixed-replace; boundary=frame')
