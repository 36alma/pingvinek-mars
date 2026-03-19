from fastapi import APIRouter
from fastapi import HTTPException
from schemas.JSON.rover import Rover
from schemas.JSON.rover_move_type import MoveType
from schemas.JSON.move import speed_to_steps
from services.routing.rover import RoverService
from services.map.map import MapService
app = APIRouter(prefix="/rover", tags=["Rover"])


class Rover_Router():
    def __init__(self):
        self._register_api_endpoint()
        self.used:bool = False

    @staticmethod
    def _manhattan(a: tuple[int, int], b: tuple[int, int]) -> int:
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def _validate_route_json(self, moves: list[dict]) -> None:
        for move_idx, move in enumerate(moves):
            path = move.get("path", [])
            for edge_idx in range(len(path) - 1):
                if self._manhattan(tuple(path[edge_idx]), tuple(path[edge_idx + 1])) > 2:
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
    def _format_time(day: int, time_value: float) -> dict:
        hour = int(time_value)
        minute = int(round((time_value - hour) * 60))
        return {
            "sol": day,
            "hour": hour,
            "minute": minute,
            "totalHours": day * 24 + time_value,
            "label": f"Sol {day} - {hour:02d}:{minute:02d}",
        }

    @staticmethod
    def _build_execution_timeline(moves: list[dict], start_position: tuple[int, int]) -> list[dict]:
        sim = Rover()
        sim.x = start_position[0]
        sim.y = start_position[1]
        sim.battery = 100
        sim.inv = {}
        sim.day = 0
        sim.time = 0

        timeline: list[dict] = []
        step_index = 0

        for move in moves:
            move_type = move.get("type")
            if move_type == "Go":
                timeline_path = move.get("timelinePath", move.get("path", []))
                for speed_name, next_pos in zip(move.get("speedPlan", []), timeline_path[1:]):
                    move_type_enum = MoveType[speed_name]
                    sim.remove_battery(sim.move_energy_calc(move_type_enum))
                    sim.charge()
                    sim.add_time()
                    sim.x, sim.y = next_pos
                    step_index += 1
                    timeline.append(
                        {
                            "step": step_index,
                            "type": "Go",
                            "speed": speed_name,
                            "position": list(next_pos),
                            "battery": sim.battery,
                            "time": Rover_Router._format_time(sim.day, sim.time),
                        }
                    )
            elif move_type == "Mining":
                path = move.get("path", [])
                if not path:
                    continue
                pos = path[-1]
                sim.remove_battery(2)
                sim.charge()
                sim.add_time()
                sim.x, sim.y = pos
                step_index += 1
                timeline.append(
                    {
                        "step": step_index,
                        "type": "Mining",
                        "position": list(pos),
                        "battery": sim.battery,
                        "time": Rover_Router._format_time(sim.day, sim.time),
                    }
                )

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

        @app.get("/start_position")
        def start_position():
            return RoverService().startpost()

        @app.get("/route")
        def rover_route():
            if self.used == True:
                raise HTTPException(status_code=400, detail="Route already used")
            self.used = True
            rover_service = RoverService()
            route = rover_service.startrouting()
            route_json = self._serialize_route(route if route else [])
            self._validate_route_json(route_json)
            start_pos = MapService().where_is_start()
            execution_timeline = []
            if start_pos is not None:
                execution_timeline = self._build_execution_timeline(
                    route_json,
                    (start_pos.x, start_pos.y),
                )
            self.used = False
            return {
                "route": route_json,
                "timeline": execution_timeline,
                "battery": rover_service.rover.battery,
                "time": rover_service.rover.time,
            }
Rover_Router()
