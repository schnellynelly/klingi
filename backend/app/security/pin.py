def verify_pin(pin: str, correct_pin: str) -> bool:
    pin = (pin or '').strip()
    return pin == correct_pin
