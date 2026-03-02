from datetime import datetime

# PC-first demo PIN. Later we store hashed PINs in DB.
DEMO_PIN = "1234"

def verify_pin(pin: str) -> bool:
    return pin == DEMO_PIN

def event_payload(event: str, detail: str):
    return {"ts": datetime.utcnow().isoformat() + "Z", "event": event, "detail": detail}
