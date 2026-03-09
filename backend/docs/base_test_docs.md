# Base Route API dokumentáció

## Áttekintés

A Base Route API egy tesztelésre szánt végpont a backend oldalon, amely két véletlenszerűen kiválasztott, nem fal típusú koordináta között keres útvonalat az útvonalkereső algoritmus (`OreDistanceService`) segítségével. Ez a végpont kiválóan alkalmas a térképen belüli navigáció tesztelésére, mivel minden futtatáskor különböző kezdő- és végpontok között ad vissza egy valid útvonalat.

## Endpoint

**HTTP metódus:** `GET`  
**URL:** `http://{backend_ip}:{backend_port}/rover/base_route`

### Paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---:|---|
| `backend_ip` | string | Igen | A backend szerver IP címe vagy host neve |
| `backend_port` | string / number | Igen | A backend szerver portja |

## Sikeres válasz

**HTTP státusz:** `200 OK`

### Példa válasz

A válasz egy kétdimenziós tömb, ahol minden belső tömb egy lépést reprezentál a két véletlenszerűen kisorsolt pont között az `[x, y]` koordináták formájában.

```json
[
  [12, 5],
  [12, 6],
  [13, 6],
  [13, 7]
]
```

Ha a két pont között valamilyen okból (pl. teljesen körbe vannak véve fallal) nem található útvonal, a válasz értéke `null` lesz:

```json
null
```

## Válasz adatstruktúra részletes leírása

A visszatérési érték egy lista (`Array`), amely koordinátapárokat tartalmaz a kiindulási ponttól a célpontig.

- **Koordinátapár formátum:** `[x, y]` (ahol `x` az oszlopindex, `y` a sorindex).
- **Adattípus:** `number`
- **Sorrend:** Az útvonal lépéseinek sorrendjében tartalmazza a koordinátákat (a 0. indexű elem a kezdőpont, az utolsó elem pedig a célpont).

### Példák koordináták értelmezésére:

- `[0, 0]` - A térkép bal felső sarka
- `[10, 5]` - A 11. oszlop (x=10) és 6. sor (y=5) metszéspontja

## Koordináta alapú tesztelési logika

A `/rover/base_route` endpoint meghívásakor a következő folyamat játszódik le a szerveren:

1. A rendszer sorsol két véletlenszerű pontot (`x`, `y`) 0 és 49 között.
2. Ellenőrzi, hogy a pontok falra (`WallMapBlock`) esnek-e. (A kódban jelenleg egy újrapróbálkozás történik fal esetén).
3. Az `OreDistanceService` kiszámítja a legrövidebb útvonalat a két pont között a BFS (Breadth-First Search) algoritmus alapján, figyelembe véve az akadályokat (pl. falak, érvénytelen blokkok).
4. Az eredményt az [x, y] párok sorozataként JSON listaként küldi vissza.

## API használatának célja és sajátosságai

### Előnyök tesztelésnél

- **Automatikus bemenet generálás:** Nem szükséges paraméterben átadni a koordinátákat, a backend generálja őket, így gyors endpoint tesztelést tesz lehetővé.
- **Navigáció verifikációja:** Közvetlenül megtekinthető, hogy az útkereső algoritmus helyesen kerüli-e meg a falakat.
- **Kliens megjelenítés tesztelése:** A kliens oldalon ezt az útvonalat használva könnyen tesztelhető a vizuális ábrázolás (pl. vonal rajzolása a mapon az útvonal mentén).

## Hibakezelés (javasolt formátum)

Ha a backend valamilyen oknál fogva hibát dob a térkép elérése miatt, egységes hibaválasz visszaadására lehet számítani (pl. FastAPI alapértelmezett hibái).

### Javasolt HTTP státuszkódok

| Státuszkód | Jelentés | Mikor használható |
|---|---|---|
| `200 OK` | Sikeres lekérés | Az útvonalkeresés lefutott, az eredmény visszaadva (lista vagy `null`). |
| `500 Internal Server Error` | Szerver oldali hiba | A térkép nincs inicializálva, vagy egyéb belső hiba történt a generálás során. |

## Gyors összefoglaló

- **Endpoint:** `GET /rover/base_route`
- **Válasz tartalma:** Koordinátapárok (lépések) listája: `[[x1,y1], [x2,y2], ...]` vagy `null`.
- **Cella indexelés:** 0-tól induló `x` (oszlop) és `y` (sor).
- **Megjegyzés:** A kezdő- és végpont mindig véletlenszerűen generalizált, így az eredmény minden hívásnál eltérő lesz.
