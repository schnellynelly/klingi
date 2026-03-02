import json
import time
import paho.mqtt.client as mqtt

class MqttBus:
    def __init__(self, host='127.0.0.1', port=1883, base_topic='klingi'):
        self.host = host
        self.port = port
        self.base_topic = base_topic
        # Note: VERSION2 is for the latest paho-mqtt library
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self.client.connect(self.host, self.port, 60)
        self.client.loop_start()

    def publish(self, topic_suffix: str, payload: dict):
        topic = f'{self.base_topic}/{topic_suffix}'
        payload = dict(payload)
        # Adds a timestamp if one isn't provided
        payload['ts'] = payload.get('ts') or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        self.client.publish(topic, json.dumps(payload), qos=0, retain=False)