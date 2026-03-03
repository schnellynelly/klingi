import sqlite3
from pathlib import Path

# Path to the database file (goes up 2 levels from this file)
DB_PATH = Path(__file__).resolve().parents[2] / 'klingi.db'

def get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL;')
    return conn

def init_db():
    conn = get_conn()
    conn.execute('''
    CREATE TABLE IF NOT EXISTS faces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        embedding BLOB NOT NULL,
        created_at TEXT NOT NULL
    )
    ''')
    conn.execute('''
    CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        event TEXT NOT NULL,
        detail TEXT NOT NULL
    )
    ''')
    conn.commit()
    conn.close()

def log_event(ts: str, event: str, detail: str):
    conn = get_conn()
    conn.execute('INSERT INTO logs(ts,event,detail) VALUES(?,?,?)', (ts, event, detail))
    conn.commit()
    conn.close()

def list_logs(limit: int = 200):
    conn = get_conn()
    cur = conn.execute('SELECT ts,event,detail FROM logs ORDER BY id DESC LIMIT ?', (limit,))
    rows = [{'ts': r[0], 'event': r[1], 'detail': r[2]} for r in cur.fetchall()]
    conn.close()
    return rows