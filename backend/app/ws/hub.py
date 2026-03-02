import asyncio
from typing import Set
from fastapi import WebSocket

class Hub:
    def __init__(self):
        self.clients: Set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self.lock:
            self.clients.add(ws)

    async def disconnect(self, ws: WebSocket):
        async with self.lock:
            if ws in self.clients:
                self.clients.remove(ws)

    async def broadcast(self, payload: dict):
        dead = []
        async with self.lock:
            for ws in self.clients:
                try:
                    await ws.send_json(payload)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.clients.discard(ws)

hub = Hub()