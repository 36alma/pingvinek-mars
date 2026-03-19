# Rover Route API dokumentacio

## Attekintes

A `GET /rover/route` endpoint a rover teljes, futtathato utvonalat es a szimulalt idovonalat (timeline) adja vissza egy JSON objektumban.
Opcionalisan megadhato `max_time` parameter a kuldetes hossza korlatozasahoz.

A valasz tartalma:
- `route`: a lepes blokkok listaja (mozgas es banyaszat)
- `timeline`: lepesszintu szimulalt adatok (battery, ido, pozicio)
- `battery`, `day`, `time`, `totalHours`: a rover allapota a kuldetes vegen

Az endpoint a visszaadas elott continuity ellenorzest futtat.
Ha teleportot talal (Manhattan > 1), hibat ad vissza.

## Endpoint

- HTTP metodus: `GET`
- URL: `http://{backend_ip}:{backend_port}/rover/route`
- Query param: `max_time` (float, opcionalis) - Maximalis ido oraban (pl. `12.5`). Csak 0.5-os lepeskozok megengedettek.

## Sikeres valasz

- HTTP statusz: `200 OK`
- Tipus: JSON objektum

Pelda:

```json
{
  "route": [
    {
      "type": "Go",
      "path": [[34, 32], [34, 33], [34, 34], [35, 34]],
      "speedPlan": ["FAST", "SLOW"]
    },
    {
      "type": "Mining",
      "path": [[35, 34], [35, 34]]
    }
  ],
  "timeline": [
    {
      "step": 1,
      "type": "Go",
      "speed": "FAST",
      "position": [34, 34],
      "battery": 82.0,
      "time": {
        "sol": 0,
        "hour": 0,
        "minute": 30,
        "totalHours": 0.5,
        "label": "Sol 0 - 00:30"
      }
    }
  ],
  "battery": 100.0,
  "day": 0,
  "time": 0.5,
  "totalHours": 0.5
}
```

## Mezo leiras

### Top-level mezok

- `route` (array): a blokkok listaja
- `timeline` (array): lepesszintu szimulacio
- `battery` (number): battery a vegere
- `day` (int): nap a vegere
- `time` (number): ora a vegere
- `totalHours` (number): osszes ora a vegere

### `route` elem leirasa (Blokkok)

### `type` (string)

Lepes blokk tipusa.

- `Go`: mozgas blokk
- `Mining`: banyaszas blokk (tipikusan helyben maradas: `[[x,y],[x,y]]`)

### `path` (array)

Koordinata lista a blokk idorendi pontjaival.

- minden elem: `[x, y]`
- `x`, `y`: integer
- szabaly: ket egymast koveto pont Manhattan tavolsaga legfeljebb `1`

### `speedPlan` (array, opcionlis)

Csak `Go` blokknal szerepel.

- ertekek: `SLOW`, `NORMAL`, `FAST`
- a terv osszesitett lepesszama illeszkedik a `path` elek szamahoz

### `timeline` elem leirasa (Lepesek)

- `step` (int): sorszam 1-tol
- `type` (string): `Go` vagy `Mining`
- `speed` (string, opcionlis): sebesseg (`SLOW|NORMAL|FAST`)
- `position` (array): `[x, y]`
- `battery` (number): battery a lepes utan
- `time` (object): idoobjektum (`sol`, `hour`, `minute`, `totalHours`, `label`)

## Validacios szabalyok

Az endpoint visszaadas elott ezeket ellenorzi:

1. Blokkon beluli folytonossag: minden szomszedos pontparra `Manhattan <= 1`
2. Blokkok kozti folytonossag: elozo blokk utolso pontja es kovetkezo blokk elso pontja kozott `Manhattan <= 1`

Ha barmelyik serul, a valasz hiba.

## Hibavalasz (teleport)

- HTTP statusz: `500 Internal Server Error`

Pelda:

```json
{
  "detail": "Teleport detected in move 7 (Mining) at edge 3: [26, 39] -> [20, 37]"
}
```

## Gyors osszefoglalo

- Endpoint: `GET /rover/route?max_time=X`
- Kimenet: `{ route, timeline, battery, ... }` objektum
- Continuity garantalt: nincs teleport a valid valaszban
