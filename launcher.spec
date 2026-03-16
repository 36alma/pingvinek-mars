# launcher.spec
# Futtatás: pyinstaller launcher.spec
#
# Előfeltételek:
#   pip install pyinstaller
#   cd frontend && npm run build

from PyInstaller.building.build_main import Analysis, PYZ, EXE, COLLECT
from pathlib import Path
import sys

BASE = Path('.')

a = Analysis(
    ['launcher.py'],
    pathex=[str(BASE)],
    binaries=[],
    datas=[
        # Backend Python fájlok
        ('backend', 'backend'),
        # Frontend build output
        ('frontend/dist', 'frontend/dist'),
    ],
    hiddenimports=[
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'anyio',
        'anyio._backends._asyncio',
        'starlette',
        'starlette.routing',
    ],
    hookspath=[],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data)

import os
os.environ['PYTHONUTF8'] = '1'

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name='PenguinExpedition',
    argv_emulation=False,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,        # False = nincs fekete ablak (de akkor nincs hibaüzenet sem)
    icon=None,           # ide: 'assets/icon.ico' ha van
    onefile=True,        # egyetlen .exe fájl
)
