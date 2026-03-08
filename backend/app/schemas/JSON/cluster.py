from schemas.JSON.rover import Rover
from schemas.JSON import Cors
from schemas.JSON.map_block import OreBaseMapBlock
from typing import Dict

class Cluster():
    def __init__(self,*,rover:Rover,ores:Dict[Cors,OreBaseMapBlock]) -> None:
        self.rover = rover
        self.ores = ores
        self.ore_amount = len(ores)
        self.cluster_ores_distance: dict[Cors,int] = []

    def get_cluster_value(self):
        # score = 100 * ércdarab - időbüntetés - energiabüntetés - hazajutási_büntetés
       score: int| None = None
       score = self.ore_amount * 100 - time - energy - home_long

    def nearest_ore(self) -> dict[Cors:int]:
        near_cluster_ore_cors = min(self.cluster_ores_distance,key=self.cluster_ores_distance.get)
        return {near_cluster_ore_cors: self.cluster_ores_distance[near_cluster_ore_cors]}


    def go_through(self):
        pass