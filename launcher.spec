# launcher.spec — PyInstaller build konfig
# Futtatas: pyinstaller launcher.spec
#
# Elofeltetelek:
#   pip install pyinstaller
#   cd frontend && npm run build   (frontend/dist/ letrehozasa)

import os
from PyInstaller.building.build_main import Analysis, PYZ, EXE

a = Analysis(
    ['launcher.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('backend',        'backend'),       # Python backend fajlok
        ('frontend/dist',  'frontend/dist'), # Vite build output (statikus)
    ],
    hiddenimports=[
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'fastapi.middleware.cors',
        'anyio',
        'anyio._backends._asyncio',
        'starlette',
        'starlette.routing',
        'starlette.middleware',
        'starlette.middleware.cors',
        'pydantic',
        'pydantic.v1',
        'http.server',
        'socketserver',
    ],
    hookspath=[],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name='PenguinExpedition',
    debug=False,
    strip=False,
    upx=True,
    console=True,    # True = latszik a log ablak (hibakereshez hasznos)
    onefile=True,
    argv_emulation=False,
)
