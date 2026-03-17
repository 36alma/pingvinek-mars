# Pingvinek Mars - Teljes API Dokumentacio

Frissitve: `2026-03-17`
Backend verzio: `1.0.0`
Backend alap URL (lokalis default): `http://localhost:5000`

Ez a dokumentum az aktualisan elerheto, kodban regisztralt API endpointokat irja le teljesen, beleertve az auto-generalt FastAPI endpointokat, a valaszstrukturat, a valos (futtatassal ellenorzott) viselkedest, es a jelenlegi ismert hibakat is.

## 1. Scope es forras

Ez a dokumentum ezekbol keszult:

- Backend route definiciok: `backend/main.py`, `backend/api/v1/*.py`
- Schema es service logika: `backend/schemas/**`, `backend/services/**`
- FastAPI route introspection futtatas
- Endpoint probe futtatas `TestClient`-tel

Megjegyzes:

- A korabbi `backend/docs/base_test_docs.md` egy mar nem letezo endpointot (`/rover/base_route`) dokumental. Ez az endpoint **jelenleg nincs beregisztralva**.

## 2. Global API profil

- Protokoll: `HTTP`
- Auth: nincs
- API verziozas URL-ben: nincs (nincs `/api/v1` prefix az URL-ben)
- Content-Type valaszoknal: `application/json` (JSON endpointoknal)
- CORS policy:
- `allow_origins = ["*"]`
- `allow_methods = ["*"]`
- `allow_headers = ["*"]`
- `allow_credentials = true`

## 3. Endpoint lista (aktualis allapot)

| Metodus | Path | Allapot | Megjegyzes |
|---|---|---|---|
| GET | `/map/` | mukodik | terkeppontok + meret |
| GET | `/rover/start_position` | hibas | jelenleg 500-as hibara fut |
| GET | `/rover/route` | mukodik | teljes rover kuldetesi terv + timeline |
| GET | `/openapi.json` | mukodik | OpenAPI schema JSON |
| GET | `/docs` | mukodik | Swagger UI |
redirect |

## 4. GET /map/

### 4.1 Cel

Visszaadja a teljes, in-memory map allapotot koordinata-kulcsos JSON objektumban.

### 4.2 Request

- Method: `GET`
- URL: `/map/`
- Query param: nincs
- Body: nincs

### 4.3 Response schema

```json
{
  "map": {
    "0,0": ".",
    "1,0": ".",
    "2,0": "#"
  },
  "rows": 50,
  "cols": 50
}
```

### 4.4 Field leiras

| Field | Tipus | Jelentes |
|---|---|---|
| `map` | `object<string,string>` | Koordinata -> csempe karakter |
| `rows` | `int` | Sorok szama |
| `cols` | `int` | Oszlopok szama |

Koordinata key formatum:

- `"x,y"` string
- `x` 0-indexelt oszlop
- `y` 0-indexelt sor

### 4.5 Csempe kodok

| Kod | Jelentes |
|---|---|
| `.` | ures/air |
| `#` | fal |
| `B` | blue ore |
| `Y` | yellow ore |
| `G` | green ore |
| `S` | start pozicio |

### 4.6 Valos, ellenorzott viselkedes

`2026-03-17` ellenorzes szerint:

- `rows = 50`
- `cols = 50`
- osszes cella = `2500`
- start cella darab = `1`

Minta statisztika a jelenlegi map.csv alapjan:

```json
{
  ".": 1882,
  "Y": 98,
  "B": 179,
  "#": 227,
  "G": 113,
  "S": 1
}
```

### 4.7 Tipikus hiba esetek

- `500 Internal Server Error`: map betoltesi vagy belso feldolgozasi hiba eseten.

## 5. GET /rover/start_position

### 5.1 Cel

Elmeletileg a start poziciot adna vissza.

### 5.2 Aktualis allapot (fontos)

Ez az endpoint jelenleg kodhiba miatt nem mukodik.

Ok:

- A route `RoverService().startpost()` metodust hiv.
- A `RoverService` osztalyban ilyen publikus metodus nincs.
- Levo metodus: `_startpost()`.

Varhato aktualis eredmeny:

- `500 Internal Server Error`
- Python `AttributeError`

### 5.3 Javasolt javitas (backend)

- Vagy route oldalon `startpost()` helyett megfelelo publikus metodus meghivasa.
- Vagy a service-ben publikus `startpost()` metodus bevezetese.

### 5.4 Megjegyzes

Mivel az endpoint hibas, a valos, stabil response schema jelenleg nem tekintheto fixnek.

## 6. GET /rover/route

### 6.1 Cel

Teljes kuldetesi utvonalat general a rovernek:

- mozgas blokkok (`Go`)
- banyaszat blokkok (`Mining`)
- idovonal (`timeline`) lepesszintu energia/idoadatokkal
- vegallapot (`battery`, `time`)

### 6.2 Request

- Method: `GET`
- URL: `/rover/route`
- Query param: nincs
- Body: nincs

### 6.3 Response (aktualis schema)

```json
{
  "route": [
    {
      "type": "Go",
      "path": [[34, 32], [34, 33], [34, 34]],
      "timelinePath": [[34, 32], [34, 34]],
      "speedPlan": ["NORMAL"]
    },
    {
      "type": "Mining",
      "path": [[34, 34], [34, 34]]
    }
  ],
  "timeline": [
    {
      "step": 1,
      "type": "Go",
      "speed": "NORMAL",
      "position": [34, 34],
      "battery": 100,
      "time": {
        "sol": 0,
        "hour": 0,
        "minute": 30,
        "totalHours": 0.5,
        "label": "Sol 0 - 00:30"
      }
    }
  ],
  "battery": 100,
  "time": 0
}
```

### 6.4 Top-level field leiras

| Field | Tipus | Jelentes |
|---|---|---|
| `route` | `array` | Szekvencialis mozgas + banyaszat blokkok |
| `timeline` | `array` | Lepesszintu szimulacios allapotlista |
| `battery` | `number` | Rover battery ertek a route generalo objektumban |
| `time` | `number` | Rover ido (ora, 0.5 oras lepesekben) a route generalo objektumban |

### 6.5 `route` elem tipusok

`Go` blokk:

- `type = "Go"`
- `path`: teljes pontsor (minden egyes map lepes)
- `speedPlan`: sebesseg-dontesek sorozata (`SLOW|NORMAL|FAST`)
- `timelinePath`: a sebesseg-plan szerint osszevont pontok

`Mining` blokk:

- `type = "Mining"`
- `path`: tipikusan `[[x,y],[x,y]]` (helyben banyaszat event)

### 6.6 `timeline` elem fieldjei

| Field | Tipus | Jelentes |
|---|---|---|
| `step` | `int` | Lepes sorszam 1-tol |
| `type` | `string` | `Go` vagy `Mining` |
| `speed` | `string` | csak `Go` eseten (`SLOW/NORMAL/FAST`) |
| `position` | `[int,int]` | aktualis rover koordinata |
| `battery` | `number` | lepes utani battery |
| `time` | `object` | ido bontva (`sol`, `hour`, `minute`, `totalHours`, `label`) |

### 6.7 Mozgas, energia, ido szabalyok

Mozgasi energia:

- Formula: `E = 2 * v^2`
- `SLOW = 1`, `NORMAL = 2`, `FAST = 3`
- Tehat drain: `2`, `8`, `18`

Banyaszat:

- fix drain: `2`

Toltes:

- Nappal (`0:00 - 16:00`) +10 battery / tick
- Ejszaka nincs toltes

Ido:

- 1 tick = `0.5` ora
- minden move/mining lepes utan novekszik

Biztonsagi tartalek:

- `MIN_BATTERY_RESERVE = 10`
- route generalas ezt vegig figyeli

### 6.8 Continuity validacio

Valasz visszaadas elott ellenorzes fut:

- Blokkon belul: ket pont Manhattan tavolsaga nem lehet `> 1`
- Blokkok kozott: elozo blokk vege es kovetkezo blokk eleje nem lehet `> 1`

Ha ez sertul:

- `500 Internal Server Error`
- `detail` mezoben teleport-hiba uzenet

### 6.9 Valos, ellenorzott viselkedes

`2026-03-17` ellenorzes szerint egy futas eredmenye:

- HTTP: `200`
- top-level key-ek: `route`, `timeline`, `battery`, `time`
- `route` hossza: `816`
- `timeline` hossza: `1340`

Elso route elem minta:

```json
{
  "type": "Go",
  "path": [[34, 32], [34, 33], [34, 34], [35, 34], [36, 34], [37, 34], [38, 34], [39, 34]],
  "timelinePath": [[34, 32], [34, 34], [36, 34], [38, 34], [39, 34]],
  "speedPlan": ["NORMAL", "NORMAL", "NORMAL", "SLOW"]
}
```

Elso timeline elem minta:

```json
{
  "step": 1,
  "type": "Go",
  "speed": "NORMAL",
  "position": [34, 34],
  "battery": 100,
  "time": {
    "sol": 0,
    "hour": 0,
    "minute": 30,
    "totalHours": 0.5,
    "label": "Sol 0 - 00:30"
  }
}
```

### 6.10 Teljesitmeny megjegyzes

- A route generalas komplex (cluster + BFS + sebesseg terv + visszateresi validacio).
- Egy valos tesztfutasban ~35 masodperc koruli valaszido is elofordult.

## 7. FastAPI auto endpointok

### 7.1 GET /openapi.json

- OpenAPI schema JSON
- tartalmazza a deklaralt app endpointokat
- jelenlegi schema path-ok:
- `/map/`
- `/rover/start_position`
- `/rover/route`

### 7.2 GET /docs

- Swagger UI
- interaktiv tesztfelulet


## 8. Frontend kompatibilitasi allapot

Frontend kod (`frontend/src/store/store.js`) jelenleg ezt varja a `/rover/route`-tol:

- kozvetlen tomb valasz (`Array`)

Backend aktualisan ezt adja:

- objektum valasz (`{ route, timeline, battery, time }`)

Kovetkezmeny:

- frontend `Array.isArray(blocks)` check miatt backend route valaszt fallback-nek tekinti
- emiatt helyi A* plannerre all at

Ez nem API endpoint hiba, hanem jelenlegi frontend-backend szerzodes eltures.

## 9. Legacy es elavult dokumentumok

Elavult endpoint dokumentacio:

- `backend/docs/base_test_docs.md` -> `/rover/base_route` endpointet irja le
- ez az endpoint nincs route-kent regisztralva a jelenlegi kodban

Reszben elavult route forma:

- `backend/docs/rover_route_api_docs.md` tomb valaszt sugall
- valos endpoint jelenleg objektumot ad vissza (`route`, `timeline`, `battery`, `time`)

## 10. Gyors teszt parancsok

```bash
# map
curl http://localhost:5000/map/

# start position (jelenleg varhatoan 500)
curl http://localhost:5000/rover/start_position

# full route
curl http://localhost:5000/rover/route

# swagger
curl http://localhost:5000/openapi.json
```

## 11. Osszefoglalo

Jelenleg 3 sajat business endpoint van bekotve:

- `GET /map/` - stabilan mukodik
- `GET /rover/start_position` - jelenleg hibas (500)
- `GET /rover/route` - mukodik, reszletes objektum valasszal

Emellett 2 FastAPI auto endpoint aktiv:

- `/openapi.json`
- `/docs`

Ez a fajl az aktualis kodallapotot dokumentalja, nem a regi API tervek alapjan irt formai specifikaciokat.
