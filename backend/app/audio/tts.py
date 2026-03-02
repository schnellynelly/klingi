import threading
import pyttsx3

_engine = None
_lock = threading.Lock()

def _get_engine():
    global _engine
    with _lock:
        if _engine is None:
            _engine = pyttsx3.init()
            _engine.setProperty('rate', 175)
        return _engine

def speak(text: str):
    text = (text or '').strip()
    if not text:
        return
    def run():
        eng = _get_engine()
        eng.say(text)
        eng.runAndWait()
    threading.Thread(target=run, daemon=True).start()
