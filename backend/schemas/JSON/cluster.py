from tkinter import Y
from schemas.JSON.rover import Rover
from schemas.JSON import Cors
from schemas.JSON.map_block import OreBaseMapBlock
from typing import Dict
from services.algorithm.ore_distance import OreDistanceService
from services.map.map import MapService

class Cluster():
    def __init__(self,*,rover:Rover,ores:Dict[Cors,OreBaseMapBlock]) -> None:
        self.rover = rover
        self.ores = ores
        self.ore_amount = len(ores)
        self.cluster_ores_distance: dict[Cors,int] = []
        self.clusters_nears: Cors
        self.start_post= MapService().where_is_start()
        self.cluster_battery = self._minening_energy()

    def get_cluster_value(self):
        oreCount = len(self.ores)
        density = oreCount / (1+sum(self.cluster_ores_distance.values()))
        int_dist = self.internal_distance()
        score = 100 * density + 25 * (1 / int_dist) - 10 * self._len_clustertostart() - 5 * self._minening_energy()
        return score

    def internal_distance(self):
        if len(self.ores) <= 1:
            return 1
        xs = [cors.x for cors in self.ores.keys()]
        ys = [cors.y for cors in self.ores.keys()]
        return max(1, (max(xs) - min(xs)) + (max(ys) - min(ys)))

    def _len_clustertostart(self):
        if self.start_post is None:
            return 0
        path = OreDistanceService().get_ore_distance(
            ore_one_x=self.start_post.x,
            ore_one_y=self.start_post.y,
            ore_two_x=self.clusters_nears.x,
            ore_two_y=self.clusters_nears.y
        )
        if path is None:
            return 0
        return len(path)
        
    def _minening_energy(self):
        return self.rover.battery - self.ore_amount

    def _internal_distance_calc(self):
        """
        
        """
        start_ore = self.clusters_nears
        route = []
        collected = []
        clusterOres = self.ores
        while clusterOres:
            bestOre = None
            BesPath = None
            BestCost = None

            for ore in clusterOres:
                path = OreDistanceService().get_ore_distance(
                    ore_one_x=start_ore.x,
                    ore_one_y=start_ore.y,
                    ore_two_x=ore.x,
                    ore_two_y=ore.y
                )
                cost = len(path)

                if cost < BestCost:
                    BestCost = cost
                    bestOre = ore
                    BesPath = path

            route.append(BesPath)
            route.append("MINE")
            current = bestOre
            collected.append(bestOre)
            self.ores.pop(bestOre)

        backPath = OreDistanceService().get_ore_distance(ore_one_x=start_ore.x,ore_one_y=start_ore.y,ore_two_x=current.x,ore_two_y=current.y)
        route.append(backPath)

        return route, collected


    def nearest_ore(self) -> dict[Cors:int]:
        near_cluster_ore_cors = min(self.cluster_ores_distance,key=self.cluster_ores_distance.get)
        return {near_cluster_ore_cors: self.cluster_ores_distance[near_cluster_ore_cors]}


    def go_through(self):
        pass