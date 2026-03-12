from time import sleep
from schemas.JSON import cluster
from services.map.map import MapService
from schemas.JSON.map_block import MapTypes
from schemas.JSON import Cors
from schemas.JSON.map_block import OreBaseMapBlock
from typing import Dict
from schemas.JSON.rover import Rover, rover
from services.algorithm.find_clusters import Find_Clusters
from services.algorithm.ore_distance import OreDistanceService
class TopLayer():
    def __init__(self,*,rover:Rover):
        self.map_service = MapService()
        self.rover = rover
    def start(self):
        while True:
            map = self.map_service.get_full_map_OBJ()
            ores:dict[Cors,OreBaseMapBlock] = {}
            for key, value in map.items():
                if isinstance(value,OreBaseMapBlock):
                    x,y = key.split(",")
                    ores[Cors(x=int(x),y=int(y))] = value

            clusters = Find_Clusters(Rover=self.rover,ores=ores)
            clusters_nears:dict[cluster,int] = {}
            for e,i in enumerate(clusters):
                print(f"Cluster: {e}")
                cluster_ores_distance:dict[Cors,dict[Cors:int]] = {}
                for cors,ore in i.ores.items():
                    cluster_ores_distance[cors]= len(OreDistanceService().get_ore_distance(
                        ore_one_x=self.rover.x,
                        ore_one_y=self.rover.y,
                        ore_two_x=cors.x,
                        ore_two_y=cors.y
                        ))
                i.cluster_ores_distance = cluster_ores_distance
                self.clusters_nears = i.nearest_ore()
                clusters_nears[i] = self.clusters_nears

            # TODO FIND A BEST NODES
            

