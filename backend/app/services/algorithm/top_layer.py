from services.map.map import MapService
from schemas.JSON.map_block import MapTypes
from schemas.JSON import Cors
from schemas.JSON.map_block import BaseMapBlock
from typing import Dict
from schemas.JSON.rover import Rover
class Cluster():
    def __init__(self,*,rover:Rover,ores:Dict[Cors,BaseMapBlock]) -> None:
        self.rover = rover
        self.ores = ores
        self.ore_amount = len(ores)

    def get_cluster_value(self):
       score: int| None = None
       score = self.ore_amount * 100
   
class TopLayer():
    def __init__(self,*,rover:Rover):
        self.ores_types = [MapTypes.BLUE_ORE,MapTypes.GREEN_ORE,MapTypes.YELLOW_ORE]
        self.map_service = MapService()
    def start(self):
        while True:
            map = self.map_service.get_full_map_OBJ()
            ores = {}
            for key, value in map.items():
                if value.type in self.ores_types:
                    ores[key] = value
            if len(ores) == 0:
                break
