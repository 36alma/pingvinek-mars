"""
Penguin Expedition -- Launcher
Elindítja a FastAPI backendet es a Vite frontend buildet,
majd megnyitja a bongeszot.

Struktura:
  launcher.exe  (vagy launcher.py)
  backend/
  frontend/dist/
"""

import os
import sys
import time
import signal
import socket
import subprocess
import threading
import webbrowser
from pathlib import Path

# Windows UTF-8 fix
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ── Portok ───────────────────────────────────────────
BACKEND_PORT  = 5000
FRONTEND_PORT = 5173

# ── Utvonalak ────────────────────────────────────────
if getattr(sys, 'frozen', False):
    # PyInstaller bundle: minden fajl _MEIPASS-ban van
    BASE = Path(sys._MEIPASS)
else:
    BASE = Path(__file__).parent

BACKEND_DIR  = BASE / 'backend'
FRONTEND_DIR = BASE / 'frontend' / 'dist'

# ── Segédfuggvenyek ──────────────────────────────────

def find_python():
    """Rendszer Python keresese (NEM az exe maga)."""
    if getattr(sys, 'frozen', False):
        # Exe modban: keressuk a rendszer Pythont
        for candidate in ('python', 'python3', 'py'):
            try:
                result = subprocess.run(
                    [candidate, '--version'],
                    capture_output=True, timeout=3
                )
                if result.returncode == 0:
                    return candidate
            except Exception:
                pass
        raise RuntimeError(
            'Python nem talalhato! Telepitsd: https://python.org\n'
            'Vagy futtasd a launcher.py-t kozvetlenul.'
        )
    else:
        # Script modban: ugyanaz a Python ami fut
        return sys.executable

def wait_for_port(port, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(('localhost', port), timeout=1):
                return True
        except OSError:
            time.sleep(0.3)
    return False

def log(msg):
    print(f'[Launcher] {msg}', flush=True)

# ── Folyamatok ───────────────────────────────────────
processes = []

def start_backend():
    log(f'Backend inditasa (port {BACKEND_PORT})...')

    python = find_python()
    env = os.environ.copy()
    env['PYTHONPATH'] = str(BACKEND_DIR)
    env['PYTHONUTF8'] = '1'

    proc = subprocess.Popen(
        [
            python, '-m', 'uvicorn', 'main:app',
            '--host', '0.0.0.0',
            '--port', str(BACKEND_PORT),
            '--app-dir', str(BACKEND_DIR),
        ],
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
    )
    processes.append(proc)

    def stream():
        for line in proc.stdout:
            print(f'[Backend] {line.decode(errors="replace").rstrip()}', flush=True)
    threading.Thread(target=stream, daemon=True).start()
    return proc

def start_frontend():
    log(f'Frontend inditasa (port {FRONTEND_PORT})...')

    npx = 'npx.cmd' if sys.platform == 'win32' else 'npx'
    try:
        proc = subprocess.Popen(
            [npx, '--yes', 'vite', 'preview', '--port', str(FRONTEND_PORT), '--host'],
            cwd=str(BASE / 'frontend'),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
        )
    except FileNotFoundError:
        raise RuntimeError(
            'npx nem talalhato. Telepitsd a Node.js-t: https://nodejs.org'
        )

    processes.append(proc)

    def stream():
        for line in proc.stdout:
            print(f'[Frontend] {line.decode(errors="replace").rstrip()}', flush=True)
    threading.Thread(target=stream, daemon=True).start()
    return proc

def cleanup(signum=None, frame=None):
    log('Leallitas...')
    for p in processes:
        try:
            p.terminate()
        except Exception:
            pass
    sys.exit(0)

# ── Foprogrm ─────────────────────────────────────────
def main():
    signal.signal(signal.SIGINT,  cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print('=' * 50)
    print('  PENGUIN EXPEDITION -- Launcher')
    print('=' * 50)

    # Ellenorzesek
    if not BACKEND_DIR.exists():
        log(f'HIBA: backend mappa nem talalhato: {BACKEND_DIR}')
        input('Nyomj Entert a kilepeshez...')
        sys.exit(1)
    if not FRONTEND_DIR.exists():
        log(f'HIBA: frontend/dist mappa nem talalhato: {FRONTEND_DIR}')
        log('Futtasd elobb: cd frontend && npm run build')
        input('Nyomj Entert a kilepeshez...')
        sys.exit(1)

    # Backend
    start_backend()
    log('Varakozas a backend indulasara...')
    if not wait_for_port(BACKEND_PORT, timeout=30):
        log('HIBA: A backend nem indult el 30 masodpercen belul!')
        cleanup()
    log(f'[OK] Backend kesz: http://localhost:{BACKEND_PORT}')

    # Frontend
    start_frontend()
    log('Varakozas a frontend indulasara...')
    if not wait_for_port(FRONTEND_PORT, timeout=20):
        log('HIBA: A frontend nem indult el!')
        cleanup()

    url = f'http://localhost:{FRONTEND_PORT}'
    log(f'[OK] Frontend kesz: {url}')

    time.sleep(0.5)
    log(f'[>>] Bongeszo megnyitasa: {url}')
    webbrowser.open(url)

    log('Mindket szolgaltatas fut. Ctrl+C a leallitashoz.')
    print('=' * 50)

    try:
        while all(p.poll() is None for p in processes):
            time.sleep(1)
        log('Egy folyamat lealt, kilepes...')
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()

if __name__ == '__main__':
    main()