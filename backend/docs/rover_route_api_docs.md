# Rover Route API dokumentacio

## Attekintes

A `GET /rover/route` endpoint a rover teljes, futtathato utvonalat adja vissza JSON tombkent.
A valasz ugyanazt a strukturat koveti, mint az `output.json`:

- `type`: a lepes blokk tipusa (`Go`, `Mining`)
- `path`: koordinata lista `[[x, y], ...]`
- `speedPlan`: csak `Go` blokknal, sebesseg szegmensek

Az endpoint a visszaadas elott continuity ellenorzest futtat.
Ha teleportot talal (Manhattan > 1), hibat ad vissza.

## Endpoint

- HTTP metodus: `GET`
- URL: `http://{backend_ip}:{backend_port}/rover/route`

## Sikeres valasz

- HTTP statusz: `200 OK`
- Tipus: JSON tomb

Pelda:

```json
[
  {
    "type": "Go",
    "path": [[34, 32], [34, 33], [34, 34], [35, 34]],
    "speedPlan": ["FAST", "SLOW"]
  },
  {
    "type": "Mining",
    "path": [[35, 34], [35, 34]]
  }
]
```

## Mezo leiras

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

- Endpoint: `GET /rover/route`
- Kimenet: `Go`/`Mining` blokkok sorozata
- Continuity garantalt: nincs teleport a valid valaszban
