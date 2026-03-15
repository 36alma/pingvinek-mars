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
            if clusters_nears_scores[-1][1] < 0:
                break
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
                        self.add_path(path)
                        self.add_mine_path(cluster[0].cluster_path.route)
                        last_post = cluster[0].cluster_last_post
                        if last_post is not None and not isinstance(last_post, str):
                            self.rover.x = last_post.x
                            self.rover.y = last_post.y
                        self.visited.append(cluster[0])
                else:
                    continue
        print(self.full_path)
        
       
        
            
    def _get_clusters_score(self,clusters:list[Cluster]):
        clusters_nears:dict[Cluster,float] = {}
        for i in clusters:
            if i in self.visited:
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

    def add_path(self,path:list[tuple[int, int]]):
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
        self.full_path.append(GoMove(path=path,speedPlan=speedPlan))  


    def add_mine_path(self,path:list[Cors|str]):
        tuple_path: list[tuple[int, int]] = [(step.x, step.y) for step in path if isinstance(step, Cors)]
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
            self.full_path.append(MiningMove(path=tuple_path))
            

