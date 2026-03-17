"""
Penguin Expedition -- Launcher
Szuz gepen is mukodik: tartalmazza a beepitett Pythont,
automatikusan telepiti a backend fuggosegeket,
es Python http.server-rel szolgalja ki a frontendet.
"""

import os
import sys
import time
import signal
import socket
import subprocess
import threading
import webbrowser
import zipfile
import urllib.request
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

# Embeddable Python helye (az exe mellé kicsomagolva)
if getattr(sys, 'frozen', False):
    # PyInstaller: az exe mellett keressuk
    EXE_DIR    = Path(sys.executable).parent
else:
    EXE_DIR    = BASE

EMBEDDED_PY_DIR  = EXE_DIR / 'python_embedded'
EMBEDDED_PY_ZIP  = EXE_DIR / 'python_embedded.zip'

# Embeddable Python 3.11 Windows 64-bit
PYTHON_EMBED_URL = (
    'https://www.python.org/ftp/python/3.11.9/'
    'python-3.11.9-embed-amd64.zip'
)
# get-pip.py for installing packages into embedded python
GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py'

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

def download_file(url, dest, label):
    log(f'Letoltes: {label}...')
    def progress(count, block_size, total):
        if total > 0:
            pct = min(100, int(count * block_size * 100 / total))
            print(f'\r  {pct}%', end='', flush=True)
    urllib.request.urlretrieve(url, dest, reporthook=progress)
    print()
    log(f'  Kesz: {dest.name}')

def setup_embedded_python():
    """
    Ha nincs meg az embedded Python, letolti es kicsomagolja.
    Hozzaad egy _pth fajlt hogy a pip mukodjon,
    majd telepiti a pip-et es a backend fuggosegeket.
    """
    py_exe = EMBEDDED_PY_DIR / 'python.exe'

    if py_exe.exists():
        log('Beepitett Python mar megvan.')
        return str(py_exe)

    log('Beepitett Python nem talalhato — letoltes...')
    EMBEDDED_PY_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Letoltes
    download_file(PYTHON_EMBED_URL, EMBEDDED_PY_ZIP, 'Python Embeddable')

    # 2. Kicsomagolas
    log('Kicsomagolas...')
    with zipfile.ZipFile(EMBEDDED_PY_ZIP, 'r') as zf:
        zf.extractall(EMBEDDED_PY_DIR)
    EMBEDDED_PY_ZIP.unlink(missing_ok=True)

    # 3. _pth fajl modositasa hogy import mukodjon (pip szukseglete)
    pth_files = list(EMBEDDED_PY_DIR.glob('*._pth'))
    for pth in pth_files:
        txt = pth.read_text()
        if '#import site' in txt:
            pth.write_text(txt.replace('#import site', 'import site'))
            log(f'  _pth javitva: {pth.name}')

    # 4. get-pip.py letoltes es telepites
    get_pip = EMBEDDED_PY_DIR / 'get-pip.py'
    download_file(GET_PIP_URL, get_pip, 'get-pip.py')
    log('pip telepitese...')
    subprocess.run(
        [str(py_exe), str(get_pip), '--no-warn-script-location'],
        check=True,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
    )
    get_pip.unlink(missing_ok=True)
    log('pip telepitve.')

    return str(py_exe)

def get_python():
    """
    Prioritas:
      1. Beepitett Python (exe melletti python_embedded/)
      2. Rendszer Python (ha van)
    """
    py_exe = EMBEDDED_PY_DIR / 'python.exe'
    if py_exe.exists():
        return str(py_exe)

    # Rendszer Python fallback
    for candidate in ('python', 'python3', 'py'):
        try:
            r = subprocess.run([candidate, '--version'],
                capture_output=True, timeout=3)
            if r.returncode == 0:
                log(f'Rendszer Python: {candidate}')
                return candidate
        except Exception:
            pass

    return None

def install_backend_deps(python):
    reqs = BACKEND_DIR / 'requirements.txt'
    if not reqs.exists():
        return

    # Redis kihagyasa — nincs bekotve a kodban
    reqs_filtered = EXE_DIR / 'requirements_filtered.txt'
    lines = reqs.read_text().splitlines()
    filtered = [l for l in lines if l.strip() and 'redis' not in l.lower()]
    reqs_filtered.write_text('\n'.join(filtered))

    log('Backend fuggosegek ellenorzese/telepitese...')
    try:
        subprocess.run(
            [python, '-m', 'pip', 'install', '-r', str(reqs_filtered),
             '--no-warn-script-location', '-q'],
            timeout=180, check=True,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
        )
        log('[OK] Fuggosegek rendben.')
    except Exception as e:
        log(f'FIGYELMEZETES: pip install hiba: {e}')
    finally:
        reqs_filtered.unlink(missing_ok=True)

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
    log(f'Frontend szerver inditasa (port {FRONTEND_PORT})...')
    server_script = (
        f"import http.server,socketserver,os;"
        f"os.chdir(r'{FRONTEND_DIST}');"
        f"h=type('H',(http.server.SimpleHTTPRequestHandler,),{{'log_message':lambda*a:None}});"
        f"socketserver.TCPServer(('0.0.0.0',{FRONTEND_PORT}),h).serve_forever()"
    )
    proc = subprocess.Popen(
        [python, '-c', server_script],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
    )
    processes.append(proc)
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

    if not BACKEND_DIR.exists():
        log(f'HIBA: backend mappa nem talalhato: {BACKEND_DIR}')
        input('Nyomj Entert...')
        sys.exit(1)
    if not FRONTEND_DIST.exists():
        log(f'HIBA: frontend/dist nem talalhato: {FRONTEND_DIST}')
        input('Nyomj Entert...')
        sys.exit(1)

    # Python berzese / letoltese
    python = get_python()
    if python is None:
        log('Python nem talalhato — letoltes (internet szukseges)...')
        try:
            python = setup_embedded_python()
        except Exception as e:
            log(f'HIBA: Python letoltes sikertelen: {e}')
            log('Telepitsd kezzel: https://python.org')
            input('Nyomj Entert...')
            sys.exit(1)
    elif not (EMBEDDED_PY_DIR / 'python.exe').exists():
        # Van rendszer Python de embedded meg nincs — setup csendben
        try:
            python = setup_embedded_python()
        except Exception:
            pass  # Rendszer Pythonnal probaljuk

    log(f'Python: {python}')
    install_backend_deps(python)

    start_backend(python)
    log('Varakozas a backend indulasara...')
    if not wait_for_port(BACKEND_PORT, timeout=45):
        log('HIBA: Backend nem indult el!')
        cleanup()
    log(f'[OK] Backend: http://localhost:{BACKEND_PORT}')

    start_frontend_server(python)
    log('Varakozas a frontend indulasara...')
    if not wait_for_port(FRONTEND_PORT, timeout=15):
        log('HIBA: Frontend nem indult el!')
        cleanup()

    url = f'http://localhost:{FRONTEND_PORT}'
    log(f'[OK] Frontend: {url}')
    time.sleep(0.5)
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