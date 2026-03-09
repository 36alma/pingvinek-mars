import csv
import os
from typing import Dict, Tuple
from schemas.JSON.map import MapResponse
from schemas.JSON.map_block import (
    BaseMapBlock,
    AirMapBlock,
    WallMapBlock,
    BlueOreMapBlock,
    YellowOreMapBlock,
    GreenOreMapBlock,
    StartMapBlock
    )
from schemas.JSON.cors import Cors 
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
CSV_PATH = os.path.join(DATA_DIR, "map.csv")


class MapService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        self._csv_path = CSV_PATH
        self._coord_map, self._rows, self._cols = self._load_csv()
        self.cors_map = self.get_full_map_OBJ()
    def _load_csv(self) -> Tuple[Dict[str, str], int, int]:
        """CSV fájl egyszeri beolvasása koordináta-alapon.

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

    def set_tile(self, x: int, y: int, tile: str) -> bool:
        """Egy mező értékének módosítása az in-memory térképen.

        Args:
            x: X koordináta (0-tól indexelve).
            y: Y koordináta (0-tól indexelve).
            tile: Az új csempe karakter (pl. '.', '#', 'B', 'Y', 'G', 'S').

        Returns:
            True ha sikeres, False ha a koordináta érvénytelen.
        """
        if 0 <= x < self._cols and 0 <= y < self._rows:
            self._coord_map[f"{x},{y}"] = tile
            tile_obj = self.get_tile_obj_type(tile=tile)
            if isinstance(tile_obj, BaseMapBlock):
                self.cors_map[f"{x},{y}"] = tile_obj
                return True
        print(f"Coordinates out of bounds: {x},{y}")
        return False

    def get_map(self) -> MapResponse:
        """Térkép adatok lekérése JSON formátumban koordináta-kulcsokkal."""
        return MapResponse(map=self._coord_map, rows=self._rows, cols=self._cols)

    def get_map_block_type(self, x: int, y: int) -> BaseMapBlock|None:
        if x >= 0 and y >= 0 and x <= 49 and y <= 49:
            map_type = self._coord_map.get(f"{x},{y}")
            if map_type is None:
                print(f"Tile not found at: {x},{y}")
                return None
        else:
            # print(f"Coordinates out of bounds: {x},{y}")
            return None
        if map_type == ".":
            return AirMapBlock()
        elif map_type == "#":
            return WallMapBlock()
        elif map_type == "B":
            return BlueOreMapBlock()
        elif map_type == "Y":
            return YellowOreMapBlock()
        elif map_type == "G":
            return GreenOreMapBlock()
        elif map_type == "S":
            return StartMapBlock()
        else:
            print(f"Unknown map type: {map_type}")
            return None

    def get_full_map_OBJ(self) -> Dict[str, BaseMapBlock]:
        obj_map: Dict[str, BaseMapBlock] = {}
        for key, value in self._coord_map.items():
            if value == ".":
                obj_map[key] = AirMapBlock()
            elif value == "#":
                obj_map[key] = WallMapBlock()
            elif value == "B":
                obj_map[key] = BlueOreMapBlock()
            elif value == "Y":
                obj_map[key] = YellowOreMapBlock()
            elif value == "G":
                obj_map[key] = GreenOreMapBlock()
            elif value == "S":
                obj_map[key] = StartMapBlock()
            else:
                print(f"Unknown map type: {value}")
                obj_map[key] = AirMapBlock()
        return obj_map

    def where_is_start(self) -> Cors | None:
        for key, value in self._coord_map.items():
            if value == "S":
                return Cors(int(key.split(",")[0]), int(key.split(",")[1]))
        print("No start found")
        return None


    def change_air(self, x: int, y: int) -> bool:
        """Adott mező levegővé ('.') alakítása."""
        return self.set_tile(x, y, ".")


    def get_tile_obj_type(self,*,tile:str) -> BaseMapBlock|None:
        if tile == ".":
            return AirMapBlock()
        elif tile == "#":
            return WallMapBlock()
        elif tile == "B":
            return BlueOreMapBlock()
        elif tile == "Y":
            return YellowOreMapBlock()
        elif tile == "G":
            return GreenOreMapBlock()
        elif tile == "S":
            return StartMapBlock()
        else:
            print(f"Unknown map type: {tile}")
            return None