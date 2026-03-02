from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Klingi"
    MQTT_HOST: str = "127.0.0.1"
    MQTT_PORT: int = 1883

    TOPIC_CMD_UNLOCK: str = "klingi/cmd/unlock"
    TOPIC_CMD_BUZZ: str = "klingi/cmd/buzz"
    TOPIC_EVT: str = "klingi/evt"

settings = Settings()
