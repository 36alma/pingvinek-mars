from schemas.JSON.map_block import (
    AirMapBlock,
    WallMapBlock
)
from services.map.map import MapService
 
class OreDistanceService():
    def __init__(self):
        pass

    def get_ore_distance(self,ore_one_x:int,ore_one_y:int,ore_two_x:int,ore_two_y:int) -> int:
        relative_minimum_distance = abs(ore_two_x + ore_two_y - ore_one_x - ore_one_y)
        if relative_minimum_distance != 0:
            
        elif relative_minimum_distance == 0:
            # Ez majd meg kell oldani, hogy ne legyen 0 a távolság
            if ore_two_x == ore_one_x and ore_two_y == ore_one_y:
                return 0
            else:
                return 1