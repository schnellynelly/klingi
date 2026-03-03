import json
import paho.mqtt.client as mqtt

MQTT_HOST = "127.0.0.1"
MQTT_PORT = 1883

TOPIC_UNLOCK = "klingi/cmd/unlock"
TOPIC_BUZZ = "klingi/cmd/buzz"

def on_message(client, userdata, msg):
    payload = msg.payload.decode("utf-8", errors="ignore")
    try:
        data = json.loads(payload)
    except Exception:
        data = {"raw": payload}

    if msg.topic == TOPIC_UNLOCK:
        print("UNLOCK -> (simulate servo open)", data)
    elif msg.topic == TOPIC_BUZZ:
        print("BUZZ -> (simulate buzzer)", data)

c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
c.on_message = on_message
c.connect(MQTT_HOST, MQTT_PORT, 60)
c.subscribe(TOPIC_UNLOCK)
c.subscribe(TOPIC_BUZZ)
print("Klingi lock simulator listening on MQTT...")
c.loop_forever()
