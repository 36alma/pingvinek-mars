from schemas.JSON.map_block import (
    AirMapBlock,
    WallMapBlock,
    BlueOreMapBlock,
    YellowOreMapBlock,
    GreenOreMapBlock,
    StartMapBlock
)
from services.map.map import MapService

class queue_model():
    def __init__(self,x:int,y:int):
        self.x = x
        self.y = y
    
class OreDistanceService():
    def __init__(self):
        self.map_service = MapService()
        self.full_map = MapService().get_full_map_OBJ()

    def get_ore_distance(self,ore_one_x:int,ore_one_y:int,ore_two_x:int,ore_two_y:int):
        relative_minimum_distance = abs(ore_two_x + ore_two_y - ore_one_x - ore_one_y)
        if relative_minimum_distance != 0:
            ore_one = queue_model(x=ore_one_x,y=ore_one_y)
            ore_two = queue_model(x=ore_two_x,y=ore_two_y)
            queue = [ore_one]
            parent: dict[str, str] = {}
            visited: list[str] = []
            while queue:
                u = queue.pop(0)
                if u.x == ore_two.x and u.y == ore_two.y:
                    break
                for x in range(-1,2):
                    for y in range(-1,2):
                        new_cors = queue_model(x=u.x + x,y=u.y + y)
                        new_cors_block_type = self.map_service.get_map_block_type(new_cors.x,new_cors.y)
                        print(new_cors_block_type)
                        if not isinstance(new_cors_block_type,AirMapBlock): #pyright: ignore
                            continue
                        if f"({new_cors.x},{new_cors.y})" in visited:
                            continue
                        parent[f"({new_cors.x},{new_cors.y})"] = f"({u.x},{u.y})"
                        visited.append(f"({new_cors.x},{new_cors.y})")
                        queue.append(new_cors)
            print(parent)
        elif relative_minimum_distance == 0:
            # Ez majd meg kell oldani, hogy ne legyen 0 a távolság
            if ore_two_x == ore_one_x and ore_two_y == ore_one_y:
                return 0
            else:
                return 1
