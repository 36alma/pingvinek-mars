from schemas.JSON.map_block import AirMapBlock, WallMapBlock
from services.map.map import MapService
from schemas.JSON.cors import Cors
class OreDistanceService():
    def __init__(self):
        self.map_service = MapService()

    def get_ore_distance(self, ore_one_x: int, ore_one_y: int, ore_two_x: int, ore_two_y: int) -> list[tuple[int, int]] | None:
        # Ha a két pont ugyanaz, az útvonal csak maga a pont
        if ore_one_x == ore_two_x and ore_one_y == ore_two_y:
            return [(ore_one_x, ore_one_y)]

        ore_one = Cors(x=ore_one_x, y=ore_one_y)
        ore_two = Cors(x=ore_two_x, y=ore_two_y)

        start_key = f"({ore_one.x},{ore_one.y})"
        queue = [ore_one]
        parent: dict[str, str] = {start_key: ""}
        visited: set[str] = {start_key}

        # 4 irányú mozgás (fel, le, balra, jobbra)
        directions = [(0, 1), (0, -1), (1, 0), (-1, 0)]

        found = False
        while queue:
            u = queue.pop(0)
            if u.x == ore_two.x and u.y == ore_two.y:
                found = True
                break

            for dx, dy in directions:
                new_x = u.x + dx
                new_y = u.y + dy
                new_key = f"({new_x},{new_y})"

                if new_key in visited:
                    continue
                if not (0 <= new_x <= 50 and 0 <= new_y <= 50):
                        continue

                block_type = self.map_service.get_map_block_type(new_x, new_y)

                # Fal és ismeretlen blokkok nem járhatók
                if block_type is None or isinstance(block_type, WallMapBlock):
                    visited.add(new_key)
                    continue

                visited.add(new_key)
                parent[new_key] = f"({u.x},{u.y})"
                queue.append(Cors(x=new_x, y=new_y))

        if not found:
            return None

        # Útvonal visszafejtése a parent lánc alapján
        path: list[tuple[int, int]] = []
        current_key = f"({ore_two.x},{ore_two.y})"
        while current_key != "":
            # "(x,y)" formátumból kinyerjük x-et és y-t
            inner = current_key[1:-1]  # zárójelek levágása
            x_str, y_str = inner.split(",")
            path.append((int(x_str), int(y_str)))
            current_key = parent[current_key]

        path.reverse()
        return path

