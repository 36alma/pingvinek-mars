import csv
import os
from typing import Dict, Tuple
from schemas.JSON.map import MapResponse


DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
CSV_PATH = os.path.join(DATA_DIR, "map.csv")


class MapService:
    def __init__(self) -> None:
        self._csv_path = CSV_PATH

    def _read_csv(self) -> Tuple[Dict[str, str], int, int]:
        """CSV fájl beolvasása koordináta-alapon.

        Visszaad egy tuple-t: (coord_map, rows, cols)
        coord_map kulcsa: "x,y" formátumú string,
        értéke: az adott cellában lévő csempe karakter.
        (0,0) = bal felső sarok, (50,50) = jobb alsó sarok.
        """
        coord_map: Dict[str, str] = {}
        rows = 0
        cols = 0
        with open(self._csv_path, mode="r", encoding="utf-8") as file:
            reader = csv.reader(file)
            for y, row in enumerate(reader):
                tiles = [cell.strip() for cell in row]
                if not any(tiles):
                    continue
                rows = y + 1
                for x, tile in enumerate(tiles):
                    coord_map[f"{x},{y}"] = tile if tile else "."
                    if x + 1 > cols:
                        cols = x + 1
        return coord_map, rows, cols

    def get_map(self) -> MapResponse:
        """Térkép adatok lekérése JSON formátumban koordináta-kulcsokkal."""
        coord_map, rows, cols = self._read_csv()
        return MapResponse(map=coord_map, rows=rows, cols=cols)
