from schemas.JSON.rover import Rover
from schemas.JSON import Cors
from services.map.map import MapService
from services.algorithm.top_layer import TopLayer


class RoverService():
    def __init__(self) -> None:
        self.rover: Rover
        self.start_pos: Cors | None = None
        self._reset_state()

    def _reset_state(self) -> None:
        MapService().reset_map()
        self.rover = Rover()
        self.rover.battery = 100
        self.rover.inv = {}
        self.rover.day = 0
        self.rover.time = 0
        self._startpost()

    def _startpost(self) -> None:
        start_pos = MapService().where_is_start()
        if isinstance(start_pos, Cors):
            self.start_pos = start_pos
            self.rover.x = start_pos.x
            self.rover.y = start_pos.y
        else:
            raise ValueError(start_pos)

    def startpost(self) -> Cors:
        if isinstance(self.start_pos, Cors):
            return self.start_pos
        self._startpost()
        if isinstance(self.start_pos, Cors):
            return self.start_pos
        raise ValueError("No start position found")

    def startrouting(self, max_tick:int|None = None):
        if max_tick is not None and max_tick < 0:
            raise ValueError("max_tick must be >= 0")
        excluded_cluster_signatures: set[tuple[tuple[int, int], ...]] = set()
        last_route = []
        for _ in range(10):
            self._reset_state()
            top_layer = TopLayer(
                rover=self.rover,
                excluded_cluster_signatures=excluded_cluster_signatures,
                max_mission_ticks=max_tick,
            )
            route = top_layer.start()
            last_route = route if route else []
            if top_layer.last_route_valid:
                return last_route
            if not top_layer.selected_cluster_signatures:
                break
            excluded_cluster_signatures.add(top_layer.selected_cluster_signatures[0])
        return last_route

