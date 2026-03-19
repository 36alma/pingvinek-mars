from services.map.map import MapService
from schemas.JSON.rover import Rover, MIN_BATTERY_RESERVE
from schemas.JSON import Cors
from schemas.JSON.map_block import OreBaseMapBlock
from typing import Any, Dict, Optional
from services.algorithm.ore_distance import OreDistanceService
from schemas.JSON.cluster_mine import ClusterMine


class Cluster():
    def __init__(self, *, rover: Rover, ores: Dict[Cors, OreBaseMapBlock]) -> None:
        self.rover = rover
        self.ores = ores
        self.ore_amount = len(ores)
        self.cluster_ores_distance: dict[Cors, int] = {}
        self.cluster_battery: int = self._minening_energy()
        self.clusters_nears: Optional[Cors] = None
        self.cluster_path: ClusterMine = self.internal_distance_calc()
        self.cluster_path_len: int = self._len_clustertostart()
        self.cluster_value: float = self.get_cluster_value()
        self.cluster_last_post = None

    def set_clusters_nears(self) -> None:
        if self.cluster_ores_distance:
            self.clusters_nears = min(
                self.cluster_ores_distance,
                key=lambda k: self.cluster_ores_distance[k]
            )
            return

        rover_and_cluster_ore_distances: dict[Cors, int] = {}
        for i in self.ores:
            path = OreDistanceService().get_ore_distance(
                ore_one_x=self.rover.x,
                ore_one_y=self.rover.y,
                ore_two_x=i.x,
                ore_two_y=i.y
            )
            if path is not None:
                rover_and_cluster_ore_distances[i] = len(path)
        if not rover_and_cluster_ore_distances:
            return
        self.clusters_nears = min(
            rover_and_cluster_ore_distances,
            key=lambda k: rover_and_cluster_ore_distances[k]
        )

    def get_cluster_value(self) -> float:
        ore_count = len(self.ores)

        # --- Távolságok ---
        dist_go = self._len_clustertostart()
        dist_inside = self.internal_distance()
        gobackhome_path = self.distance_to_home()
        dist_return = len(gobackhome_path) if gobackhome_path is not None else 0
        total_dist = dist_go + dist_inside + dist_return

        # --- Idő (félórákban, 1 lépés = 0.5 óra) ---
        time_go = dist_go          # 1 lépés = 1 félóra
        time_inside = dist_inside
        mine_time = ore_count      # 1 érc = 1 félóra bányászás
        time_return = dist_return
        total_time = time_go + time_inside + mine_time + time_return

        # --- Mozgási energia (E = 2 * v^2, NORMAL sebesség v=2) ---
        move_energy_per_step = 2 * (2 ** 2)  # = 8
        move_energy = move_energy_per_step * total_dist

        # --- Bányászási energia (2 / érc) ---
        mine_energy = 2 * ore_count

        # --- Bruttó energia ---
        gross_energy = move_energy + mine_energy

        # --- Naptöltés becslése ---
        # Nappal (0:00 - 16:00 = 32 félóra): +10 / félóra
        # Éjjel (16:00 - 24:00 = 16 félóra): 0
        current_time = self.rover.time
        charged_energy = 0
        for step in range(total_time):
            sim_time = (current_time + step * 0.5) % 24
            if 0 <= sim_time < 16:
                charged_energy += 10

        # --- Nettó energia ---
        total_net_energy = gross_energy - charged_energy
        if total_net_energy < 0:
            total_net_energy = 0

        # --- Battery feasibility ---
        battery_end = self.rover.battery - total_net_energy

        # --- Risk penalty ---
        safety_margin = max(15, MIN_BATTERY_RESERVE)
        risk_penalty = 0

        if battery_end < MIN_BATTERY_RESERVE:
            return float("-inf")
        elif battery_end < safety_margin:
            risk_penalty += 5000

        # --- Végső score ---
        # Time-efficiency driven ore value:
        # - close clusters get a higher proximity factor
        # - long total_time reduces ore value directly
        proximity_scale = 12.0
        proximity_factor = proximity_scale / (proximity_scale + max(0, dist_go))
        ore_reward = (
            180.0
            * ore_count
            * proximity_factor
            / (1.0 + 0.20 * total_time)
        )

        # Nonlinear approach penalty to discourage very distant clusters.
        approach_distance_penalty = 0.65 * (dist_go ** 2)

        # Strong elapsed-time pressure: keep routes short in total execution time.
        time_penalty = (11.0 * total_time) + (0.35 * (total_time ** 2))
        score = (
            ore_reward
            - 2.5 * total_net_energy
            - time_penalty
            - 2.5 * total_dist
            - 3.5 * dist_inside
            - approach_distance_penalty
            - risk_penalty
        )
        return score

    def internal_distance(self) -> int:
        if len(self.ores) <= 1:
            return 1
        xs = [cors.x for cors in self.ores.keys()]
        ys = [cors.y for cors in self.ores.keys()]
        return max(1, (max(xs) - min(xs)) + (max(ys) - min(ys)))

    def _len_clustertostart(self) -> int:
        if self.clusters_nears is None:
            return 0
        path = OreDistanceService().get_ore_distance(
            ore_one_x=self.rover.x,
            ore_one_y=self.rover.y,
            ore_two_x=self.clusters_nears.x,
            ore_two_y=self.clusters_nears.y
        )
        if path is None:
            return 0
        return len(path)

    def _minening_energy(self) -> int:
        return self.rover.battery - self.ore_amount

    def internal_distance_calc(self, start_post: Optional[Cors] = None) -> ClusterMine:
        start_ore = self.clusters_nears
        route: list[Any] = []
        collected: list[Cors] = []
        clusterOres = dict(self.ores)

        if start_post is not None:
            current: Cors = start_post
            loop_target: Cors = start_post
        else:
            if start_ore is None:
                self.set_clusters_nears()
                start_ore = self.clusters_nears

            if start_ore is None:
                return ClusterMine(route=route,collected=collected)
            current = start_ore
            loop_target = start_ore

        while clusterOres:
            bestOre: Optional[Cors] = None
            bestPath: Optional[list[tuple[int, int]]] = None
            bestCost: float = float('inf')

            for ore in clusterOres:
                path = OreDistanceService().get_ore_distance(
                    ore_one_x=current.x,
                    ore_one_y=current.y,
                    ore_two_x=ore.x,
                    ore_two_y=ore.y
                )
                if path is None:
                    continue
                cost = len(path)

                if cost < bestCost:
                    bestCost = cost
                    bestOre = ore
                    bestPath = path

            if bestOre is None:
                break

            route.append(bestPath)
            route.append("MINE")
            current = bestOre
            collected.append(bestOre)
            clusterOres.pop(bestOre)

        backPath = OreDistanceService().get_ore_distance(
            ore_one_x=current.x,
            ore_one_y=current.y,
            ore_two_x=loop_target.x,
            ore_two_y=loop_target.y
        )
        if backPath is not None:
            route.append(backPath)
            
        new_route: list[Cors|str] = []
        for item in route:
            if item == "MINE":
                new_route.append("MINE")
                continue
            for step in item:
                new_route.append(Cors(step[0], step[1]))
                
        last_cors = None
        for item in reversed(new_route):
            if isinstance(item, Cors):
                last_cors = item
                break
        self.cluster_last_post = last_cors
        
        return ClusterMine(route=new_route,collected=collected)

    def nearest_ore(self) -> dict[Cors, int]:
        if not self.cluster_ores_distance:
            return {}
        near_cluster_ore_cors: Cors = min(
            self.cluster_ores_distance,
            key=lambda k: self.cluster_ores_distance[k]
        )
        return {near_cluster_ore_cors: self.cluster_ores_distance[near_cluster_ore_cors]}

    def go_through(self) -> None:
        pass

    def distance_to_home(self) -> Optional[list[tuple[int, int]]]: 
        home = MapService().where_is_start()
        if home is None:
            print("No home")
            return None
            
        start_x = self.rover.x
        start_y = self.rover.y
        
        if hasattr(self, 'cluster_path') and self.cluster_path.collected:
            last_ore = self.cluster_path.collected[-1]
            start_x = last_ore.x
            start_y = last_ore.y

        path = OreDistanceService().get_ore_distance(
            ore_one_x=start_x,
            ore_one_y=start_y,
            ore_two_x=home.x,
            ore_two_y=home.y
        )
        if path is None:
            print("No path to home")
            return None
        return path
        
