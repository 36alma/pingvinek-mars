from fastapi import APIRouter
from fastapi import HTTPException
from schemas.IN.rover import RoverMoveRequest
from schemas.JSON.move import speed_to_steps
from services.routing.rover import RoverService
from services.algorithm.ore_distance import OreDistanceService
from schemas.JSON.map_block import WallMapBlock
from services.map.map import MapService
import random
app = APIRouter(prefix="/rover", tags=["Rover"])


class Rover_Router():
    def __init__(self):
        self._register_api_endpoint()

    @staticmethod
    def _manhattan(a: tuple[int, int], b: tuple[int, int]) -> int:
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def _validate_route_json(self, moves: list[dict]) -> None:
        for move_idx, move in enumerate(moves):
            path = move.get("path", [])
            for edge_idx in range(len(path) - 1):
                if self._manhattan(tuple(path[edge_idx]), tuple(path[edge_idx + 1])) > 1:
                    raise HTTPException(
                        status_code=500,
                        detail=(
                            f"Teleport detected in move {move_idx} ({move.get('type')}) "
                            f"at edge {edge_idx}: {path[edge_idx]} -> {path[edge_idx + 1]}"
                        ),
                    )
        for move_idx in range(len(moves) - 1):
            current_path = moves[move_idx].get("path", [])
            next_path = moves[move_idx + 1].get("path", [])
            if not current_path or not next_path:
                continue
            if self._manhattan(tuple(current_path[-1]), tuple(next_path[0])) > 1:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Teleport detected between moves "
                        f"{move_idx} ({moves[move_idx].get('type')}) and "
                        f"{move_idx + 1} ({moves[move_idx + 1].get('type')}): "
                        f"{current_path[-1]} -> {next_path[0]}"
                    ),
                )

    @staticmethod
    def _timeline_path(path: list[tuple[int, int]], speed_plan: list) -> list[tuple[int, int]]:
        if not path:
            return []
        timeline = [path[0]]
        edge_index = 0
        for speed in speed_plan:
            edge_index += speed_to_steps(speed)
            timeline.append(path[edge_index])
        return timeline

    @staticmethod
    def _serialize_route(path: list) -> list[dict]:
        output: list[dict] = []
        for move in path:
            speed_plan = getattr(move, "speedPlan", None)
            raw_path = move.path
            move_dict = {
                "type": getattr(move, "type", type(move).__name__),
                "path": raw_path,
            }
            if speed_plan is not None:
                move_dict["timelinePath"] = Rover_Router._timeline_path(raw_path, speed_plan)
                move_dict["speedPlan"] = [
                    getattr(speed, "name", str(speed)) for speed in speed_plan
                ]
            output.append(move_dict)
        return output

    def _register_api_endpoint(self):
        @app.post("/move")
        def move_rover(request: RoverMoveRequest):
            return request

        @app.get("/start_position")
        def start_position():
            return RoverService().startpost()

        @app.get("/base_route")
        def base_route():
            while True:
                one_x =random.randint(0,49)
                one_y =random.randint(0,49)
                two_x =random.randint(0,49)
                two_y =random.randint(0,49)
                if isinstance(MapService().get_map_block_type(one_x,one_y),WallMapBlock):
                    one_x =random.randint(0,49)
                    one_y =random.randint(0,49)
                if isinstance(MapService().get_map_block_type(two_x,two_y),WallMapBlock):
                    two_x =random.randint(0,49)
                    two_y =random.randint(0,49)
                    print(two_x)
                break
            return OreDistanceService().get_ore_distance(ore_one_x=one_x,ore_one_y=one_y,ore_two_x=two_x,ore_two_y=two_y)

        @app.get("/route")
        def rover_route():
            rover_service = RoverService()
            route = rover_service.startrouting()
            route_json = self._serialize_route(route if route else [])
            self._validate_route_json(route_json)
            return {
                "route": route_json,
                "battery": rover_service.rover.battery,
                "time": rover_service.rover.time,
            }
Rover_Router()
