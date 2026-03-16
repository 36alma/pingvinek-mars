from schemas.JSON.cluster import Cluster
from schemas.JSON.rover_move_type import MoveType
from services.map.map import MapService
from schemas.JSON import Cors
from schemas.JSON.map_block import OreBaseMapBlock
from schemas.JSON.rover import Rover
from services.algorithm.find_clusters import Find_Clusters
from services.algorithm.ore_distance import OreDistanceService
from schemas.JSON.move import BasePathMoveType,GoMove,MiningMove
class TopLayer():
    def __init__(self,*,rover:Rover):
        self.map_service = MapService()
        self.rover = rover

    @staticmethod
    def _manhattan(a: tuple[int, int], b: tuple[int, int]) -> int:
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def _validate_continuous_path(self, *, path: list[tuple[int, int]], move_type: str) -> None:
        if len(path) <= 1:
            return
        for idx in range(len(path) - 1):
            if self._manhattan(path[idx], path[idx + 1]) > 1:
                raise ValueError(
                    f"Teleport detected in {move_type} path at edge {idx}: "
                    f"{path[idx]} -> {path[idx + 1]}"
                )

    def _append_move(self, move: BasePathMoveType) -> None:
        path = move.path
        self._validate_continuous_path(path=path, move_type=getattr(move, "type", "Unknown"))
        if self.full_path and path:
            prev_path = self.full_path[-1].path
            if prev_path:
                if self._manhattan(prev_path[-1], path[0]) > 1:
                    raise ValueError(
                        f"Teleport detected between moves: {prev_path[-1]} -> {path[0]} "
                        f"({self.full_path[-1].type} -> {move.type})"
                    )
        self.full_path.append(move)

    def start(self):
        map = self.map_service.get_full_map_OBJ()
        ores:dict[Cors,OreBaseMapBlock] = {}
        for key, value in map.items():
            if isinstance(value,OreBaseMapBlock):
                x,y = key.split(",")
                ores[Cors(x=int(x),y=int(y))] = value
        self.visited:list[Cluster] = []
        self.full_path:list[BasePathMoveType] = []
        clusters = Find_Clusters(Rover=self.rover,ores=ores)
        while True:
            clusters_nears = self._get_clusters_score(clusters=clusters)
            clusters_nears_scores = sorted(clusters_nears.items(), key=lambda x: x[1],reverse=True)
            if len(clusters_nears_scores) == 0:
                break
            if clusters_nears_scores[0][1] < 0:
                break
            processed_any = False
            for cluster in clusters_nears_scores:
                if cluster[1] > 0:
                    if cluster[0].clusters_nears is None:
                        continue
                    if cluster[0] in self.visited:
                        continue
                    rover_x: int = self.rover.x
                    rover_y: int = self.rover.y
                    path = OreDistanceService().get_ore_distance(
                        ore_one_x=rover_x,
                        ore_one_y=rover_y,
                        ore_two_x=cluster[0].clusters_nears.x,
                        ore_two_y=cluster[0].clusters_nears.y
                    )
                    if path is not None:
                        self.add_path_with_inline_mining(path)
                        self._refresh_cluster_ores(cluster[0])
                        cluster[0].cluster_last_post = None
                        cluster[0].cluster_path = cluster[0].internal_distance_calc(
                            start_post=Cors(x=self.rover.x, y=self.rover.y)
                        )
                        self.add_mine_path(cluster[0].cluster_path.route)
                        last_post = cluster[0].cluster_last_post
                        if last_post is not None and not isinstance(last_post, str):
                            self.rover.x = last_post.x
                            self.rover.y = last_post.y
                        self.visited.append(cluster[0])
                        processed_any = True
                        break
            if not processed_any:
                break
                
        home = self.map_service.where_is_start()
        if home is not None:
            back_path = OreDistanceService().get_ore_distance(
                ore_one_x=self.rover.x,
                ore_one_y=self.rover.y,
                ore_two_x=home.x,
                ore_two_y=home.y
            )
            if back_path is not None:
                self.add_path_with_inline_mining(back_path)
                
        return self.full_path
        
            
    def _get_clusters_score(self,clusters:list[Cluster]):
        clusters_nears:dict[Cluster,float] = {}
        for i in clusters:
            if i in self.visited:
                continue
            self._refresh_cluster_ores(i)
            if len(i.ores) == 0:
                self.visited.append(i)
                continue
            cluster_ores_distance: dict[Cors, int] = {}
            for cors, _ in i.ores.items():
                path = OreDistanceService().get_ore_distance(
                    ore_one_x=self.rover.x,
                    ore_one_y=self.rover.y,
                    ore_two_x=cors.x,
                    ore_two_y=cors.y
                )
                if path is not None:
                    cluster_ores_distance[cors] = len(path)
            i.cluster_ores_distance = cluster_ores_distance
            i.set_clusters_nears()
            clusters_nears[i] = i.get_cluster_value()
        return clusters_nears

    def _refresh_cluster_ores(self, cluster: Cluster) -> None:
        current_ores: dict[Cors, OreBaseMapBlock] = {}
        for cors, _ in cluster.ores.items():
            block = self.map_service.get_map_block_type(cors.x, cors.y)
            if isinstance(block, OreBaseMapBlock):
                current_ores[cors] = block
        cluster.ores = current_ores
        cluster.ore_amount = len(current_ores)
        cluster.cluster_ores_distance = {}
        if len(current_ores) == 0:
            cluster.clusters_nears = None
            cluster.cluster_last_post = None

    def add_path_with_inline_mining(self, path: list[tuple[int, int]]) -> None:
        if not path:
            return

        current_segment: list[tuple[int, int]] = [path[0]]
        for x, y in path[1:]:
            step = (x, y)
            current_segment.append(step)
            block = self.map_service.get_map_block_type(x=x, y=y)
            if not isinstance(block, OreBaseMapBlock):
                continue

            self.add_path(current_segment)
            self.rover.mining(cors=Cors(x=x, y=y), ore_type=block)
            self._append_move(MiningMove(path=[step, step]))
            current_segment = [step]

        if len(current_segment) > 1:
            self.add_path(current_segment)
        elif len(path) == 1:
            self.rover.x, self.rover.y = path[0]

    def add_path(self,path:list[tuple[int, int]]):
        if not path:
            return
        self._validate_continuous_path(path=path, move_type="Go")
        i = 0
        battery = self.rover.battery
        speedPlan:list[MoveType] = []
        while i < (len(path) - 1):
            remainingSteps = (len(path) -1) - i
            chosenSpeed = MoveType.SLOW
            speed_type = [MoveType.FAST,MoveType.NORMAL,MoveType.SLOW]
            for v in speed_type:
                if v.value > remainingSteps:
                    continue

                costNow = self.rover.move_energy_calc(v)
                batteryAfterNow = battery - costNow
                if batteryAfterNow < 0:
                    continue
                nextIndex = i + v.value
                needToFinish = self.rover.MinNeedForRemainingPath(path,nextIndex)
                safetyMargin = 5
                if batteryAfterNow >= needToFinish + safetyMargin:
                    chosenSpeed = v
                    break
            speedPlan.append(chosenSpeed)
            i = i + chosenSpeed.value
            battery = self.rover.move(type=chosenSpeed)
        planned_steps = sum(speed.value for speed in speedPlan)
        if planned_steps != (len(path) - 1):
            raise ValueError(
                f"Inconsistent route plan: planned {planned_steps} steps for "
                f"{len(path) - 1} path edges."
            )
        self._append_move(GoMove(path=path,speedPlan=speedPlan))
        self.rover.x, self.rover.y = path[-1]


    def add_mine_path(self,path:list[Cors|str]):
        tuple_path: list[tuple[int, int]] = [(step.x, step.y) for step in path if isinstance(step, Cors)]
        if tuple_path:
            self._validate_continuous_path(path=tuple_path, move_type="Mining")
        for step in path:
            if isinstance(step,str):
                continue
            x = step.x
            y = step.y
            step_ore_type  = MapService().get_map_block_type(x=x,y=y)
            if isinstance(step_ore_type,OreBaseMapBlock):
                self.rover.mining(cors=Cors(x=x,y=y),ore_type=step_ore_type)
            else:
                continue
        
        if tuple_path:
            self._append_move(MiningMove(path=tuple_path))
            self.rover.x, self.rover.y = tuple_path[-1]
