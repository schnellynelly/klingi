import numpy as np
from datetime import datetime, timezone
from .engine import FaceEngine
from app.database.db import get_conn

def _to_blob(vec: np.ndarray) -> bytes:
    return vec.astype(np.float32).tobytes()

def _from_blob(blob: bytes) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.float32)

def add_face(name: str, embedding: np.ndarray):
    ts = datetime.now(timezone.utc).isoformat()
    conn = get_conn()
    conn.execute('INSERT INTO faces(name, embedding, created_at) VALUES(?,?,?)', (name, _to_blob(embedding), ts))
    conn.commit()
    conn.close()
    return ts

def list_faces():
    conn = get_conn()
    cur = conn.execute('SELECT id, name, created_at FROM faces ORDER BY id DESC')
    rows = [{'id': r[0], 'name': r[1], 'created_at': r[2]} for r in cur.fetchall()]
    conn.close()
    return rows

def delete_face(face_id: int):
    conn = get_conn()
    conn.execute('DELETE FROM faces WHERE id=?', (face_id,))
    conn.commit()
    conn.close()

def match_face(engine: FaceEngine, embedding: np.ndarray, threshold: float = 0.35):
    # threshold: lower = stricter. 0.30–0.40 typical for normalized embeddings.
    conn = get_conn()
    cur = conn.execute('SELECT id, name, embedding FROM faces')
    best = None
    best_d = 999.0
    for fid, name, blob in cur.fetchall():
        db_emb = _from_blob(blob)
        d = engine.cosine_distance(embedding, db_emb)
        if d < best_d:
            best_d = d
            best = {'id': fid, 'name': name, 'distance': float(d)}
    conn.close()
    if best and best_d <= threshold:
        return True, best
    return False, best
