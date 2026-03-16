from schemas.JSON.map_block import (
    AirMapBlock,
    WallMapBlock,
    BlueOreMapBlock,
    YellowOreMapBlock,
    GreenOreMapBlock,
)
from schemas.JSON.rover import Rover 
from schemas.JSON import Cors
from services.map.map import MapService
from services.algorithm.top_layer import TopLayer
class RoverService():
    def __init__(self):
        self._reset_state()

    def _reset_state(self):
        MapService().reset_map()
        self.rover = Rover()
        self.rover.battery = 100
        self.rover.inv = {}
        self.rover.day = 0
        self.rover.time = 0
        self._startpost()

    def _startpost(self):
        self.start_pos = MapService().where_is_start()
        if isinstance(self.start_pos, Cors):
            self.rover.x = self.start_pos.x
            self.rover.y = self.start_pos.y
        else:
            raise ValueError(self.start_pos)

    def startrouting(self):
        excluded_cluster_signatures: set[tuple[tuple[int, int], ...]] = set()
        last_route = []
        for _ in range(10):
            self._reset_state()
            top_layer = TopLayer(
                rover=self.rover,
                excluded_cluster_signatures=excluded_cluster_signatures,
            )
            route = top_layer.start()
            last_route = route if route else []
            if top_layer.last_route_valid:
                return last_route
            if not top_layer.selected_cluster_signatures:
                break
            excluded_cluster_signatures.add(top_layer.selected_cluster_signatures[0])
        return last_route

