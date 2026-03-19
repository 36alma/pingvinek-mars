# Map API dokumentáció

## Áttekintés

A Map API a backend oldalon tárolt teljes térképet (CSV alapú struktúra) JSON formátumban adja vissza. A válasz tartalmazza a teljes map tartalmát, valamint a térkép méretét (sorok és oszlopok száma).

A map adatok koordináta alapú kulcsokkal érhetők el, ahol a kulcs formátuma `"x,y"`, az érték pedig minden esetben string.

## Endpoint

**HTTP metódus:** `GET`  
**URL:** `http://{backend_ip}:{backend_port}/map/`

### Paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---:|---|
| `backend_ip` | string | Igen | A backend szerver IP címe vagy host neve |
| `backend_port` | string / number | Igen | A backend szerver portja |

## Sikeres válasz

**HTTP státusz:** `200 OK`

### Példa válasz

```json
{
  "map": {
    "0,0": ".",
    "1,0": ".",
    "2,0": ".",
    ...
  },
  "rows": 50,
  "cols": 50
}
```

## Válasz mezők részletes leírása

### `map` (object)

A teljes térképet tartalmazó objektum.

- **Kulcs:** koordináta string `"x,y"` formátumban
- **Érték:** az adott cella tartalma stringként

#### Koordináta formátum

- `x` = oszlop index (0-tól indul)
- `y` = sor index (0-tól indul)

Példák:

- `"0,0"` - bal felső cella
- `"1,0"` - első sor, második oszlop
- `"0,1"` - második sor, első oszlop

> Fontos: a koordináták JSON objektumkulcsként szerepelnek, ezért stringként kezelendők.

### `rows` (number)

A térkép sorainak száma.

- Példa: `50`

### `cols` (number)

A térkép oszlopainak száma.

- Példa: `50`

## Adattípusok összefoglalása

| Mező | Típus | Leírás | Példa |
|---|---|---|---|
| `map` | object | Koordináta alapú cellaadatok | `{ "0,0": "." }` |
| `map["x,y"]` | string | Egy cella értéke | `"."`, `"#"`, `"P"` |
| `rows` | number | Sorok száma | `50` |
| `cols` | number | Oszlopok száma | `50` |

## Koordináta alapú lekérdezési logika

A kliens oldalon egy cella értéke a koordinátából képzett kulccsal kérhető le.

- Kulcsképzés: `x,y`
- Példa kulcsok: `"3,7"`, `"12,0"`, `"49,49"`

A `rows` és `cols` mezők alapján meghatározható az érvényes koordináta tartomány.

### Érvényes index tartomány

- `x`: `0 .. cols-1`
- `y`: `0 .. rows-1`

## Map reprezentáció sajátosságai

A teljes térkép egyszerre kerül visszaadásra egy lapos (flat) JSON objektumban, nem kétdimenziós tömbként.

### Előnyök

- Gyors közvetlen elérés koordináta alapján
- Egyszerű kulcs-alapú keresés
- Egységes string típusú cellaérték-kezelés

### Megjegyzés

Nagy méretű térkép esetén a válasz mérete (payload) jelentős lehet, mivel a teljes map egyetlen válaszban érkezik vissza.

## Lehetséges cellaértékek (példák)

A cellaértékek jelentése backend implementációtól függ. Az API csak stringként adja vissza őket.

Példák lehetséges jelölésekre:

- `"."` - üres mező
- `"#"` - fal
- `"P"` - játékos
- `"E"` - ellenfél
- `"T"` - célpont

## Hibakezelés (javasolt formátum)

Ha a backend hibát ad vissza, érdemes egységes hibaválasz-struktúrát használni.

### Példa hibaválasz

```json
{
  "error": "Map not available"
}
```

### Javasolt HTTP státuszkódok

| Státuszkód | Jelentés | Mikor használható |
|---|---|---|
| `200 OK` | Sikeres lekérés | A map sikeresen visszaadva |
| `500 Internal Server Error` | Szerver oldali hiba | Feldolgozási vagy backend hiba |
| `503 Service Unavailable` | Szolgáltatás nem elérhető | A map ideiglenesen nem érhető el |

## Gyors összefoglaló

- **Indexelés:** 0-tól induló `x` (oszlop) és `y` (sor)

## GET /map/reset

### Cél

Visszaállítja a térképet az eredeti CSV állapotba. Ez hasznos lehet, ha a rover bányászott, és szeretnénk újrakezdeni a szimulációt tiszta térképpel.

### Endpoint

**HTTP metódus:** `GET`  
**URL:** `http://{backend_ip}:{backend_port}/map/reset`

### Válasz

Megegyezik a `GET /map/` válaszával: a teljes, frissített (vörösre állított) térképet adja vissza JSON formátumban.

## Verziózás / bővítés (ajánlás)

Ha a jövőben bővül az API, javasolt:

- verziózott endpoint használata (pl. `/api/v1/map/`),
- metaadatok külön `meta` objektumba szervezése,
- opcionális részleges lekérdezések támogatása (pl. viewport / régió alapú map lekérés).
