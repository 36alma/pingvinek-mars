"""
Penguin Expedition -- Launcher
Elindítja a FastAPI backendet és a Vite frontend buildet,
majd megnyitja a böngészőt.

Szuz gepen is mukodik:
  - Python: rendszer Python vagy bundled (ha van)
  - Node.js: automatikusan letolti ha nincs (portable)
  - Backend: uvicorn a rendszer Pythonnal
  - Frontend: a frontend/dist/ statikus fajlokat Python http.server szolgalja ki
             (nem kell Node.js a futashoz, csak a buildhez!)
"""

import os
import sys
import time
import signal
import socket
import subprocess
import threading
import webbrowser
import urllib.request
import zipfile
import shutil
from pathlib import Path

# Windows UTF-8 fix
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ── Portok ───────────────────────────────────────────
BACKEND_PORT  = 5000
FRONTEND_PORT = 4173

# ── Utvonalak ────────────────────────────────────────
if getattr(sys, 'frozen', False):
    BASE = Path(sys._MEIPASS)
else:
    BASE = Path(__file__).parent

BACKEND_DIR   = BASE / 'backend'
FRONTEND_DIST = BASE / 'frontend' / 'dist'

# ── Segédfüggvények ──────────────────────────────────
def log(msg):
    print(f'[Launcher] {msg}', flush=True)

def wait_for_port(port, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(('localhost', port), timeout=1):
                return True
        except OSError:
            time.sleep(0.3)
    return False

def find_python():
    """Rendszer Python keresese."""
    if getattr(sys, 'frozen', False):
        # Exe modban: keressuk a rendszer Pythont
        for candidate in ('python', 'python3', 'py'):
            try:
                r = subprocess.run([candidate, '--version'],
                    capture_output=True, timeout=3)
                if r.returncode == 0:
                    return candidate
            except Exception:
                pass
        raise RuntimeError(
            'Python nem talalhato!\n'
            'Telepitsd: https://python.org (Add to PATH bejelolve!)'
        )
    return sys.executable

def install_backend_deps(python):
    """Telepiti a backend Python fuggosegeket ha hianyoznak."""
    reqs = BACKEND_DIR / 'requirements.txt'
    if not reqs.exists():
        return
    log('Backend fuggosegek ellenorzese...')
    try:
        subprocess.run(
            [python, '-m', 'pip', 'install', '-r', str(reqs), '--quiet'],
            timeout=120, check=True,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
        )
        log('[OK] Fuggosegek rendben.')
    except Exception as e:
        log(f'FIGYELMEZETES: pip install sikertelen: {e}')

processes = []

def start_backend(python):
    log(f'Backend inditasa (port {BACKEND_PORT})...')
    env = os.environ.copy()
    env['PYTHONPATH'] = str(BACKEND_DIR)
    env['PYTHONUTF8'] = '1'
    proc = subprocess.Popen(
        [python, '-m', 'uvicorn', 'main:app',
         '--host', '0.0.0.0',
         '--port', str(BACKEND_PORT),
         '--app-dir', str(BACKEND_DIR)],
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

def start_frontend_server(python):
    """
    Sztatikus fajlokat szolgal ki Python http.server-rel.
    Nem kell Node.js a futashoz!
    """
    log(f'Frontend szerver inditasa (port {FRONTEND_PORT})...')

    server_script = f"""
import http.server, socketserver, os, sys
os.chdir(r'{FRONTEND_DIST}')
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin','*')
        super().end_headers()
with socketserver.TCPServer(('0.0.0.0', {FRONTEND_PORT}), Handler) as httpd:
    httpd.serve_forever()
"""
    proc = subprocess.Popen(
        [python, '-c', server_script],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
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
        try: p.terminate()
        except Exception: pass
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
        input('Nyomj Entert...')
        sys.exit(1)
    if not FRONTEND_DIST.exists():
        log(f'HIBA: frontend/dist nem talalhato: {FRONTEND_DIST}')
        log('Futtasd elobb: cd frontend && npm run build')
        input('Nyomj Entert...')
        sys.exit(1)

    # Python keresese
    try:
        python = find_python()
        log(f'Python: {python}')
    except RuntimeError as e:
        log(f'HIBA: {e}')
        input('Nyomj Entert...')
        sys.exit(1)

    # Backend fuggosegek
    install_backend_deps(python)

    # Backend inditasa
    start_backend(python)
    log('Varakozas a backend indulasara...')
    if not wait_for_port(BACKEND_PORT, timeout=30):
        log('HIBA: A backend nem indult el!')
        cleanup()
    log(f'[OK] Backend: http://localhost:{BACKEND_PORT}')

    # Frontend szerver inditasa (Python http.server)
    start_frontend_server(python)
    log('Varakozas a frontend indulasara...')
    if not wait_for_port(FRONTEND_PORT, timeout=15):
        log('HIBA: A frontend szerver nem indult el!')
        cleanup()

    url = f'http://localhost:{FRONTEND_PORT}'
    log(f'[OK] Frontend: {url}')

    time.sleep(0.5)
    log(f'Bongeszo megnyitasa: {url}')
    webbrowser.open(url)

    log('Fut. Ctrl+C a leallitashoz.')
    print('=' * 50)

    try:
        while all(p.poll() is None for p in processes):
            time.sleep(1)
        log('Egy folyamat lealt.')
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()

if __name__ == '__main__':
    main()