from collections.abc import Iterator
from schemas.JSON.rover_move_type import MoveType


def speed_to_steps(speed: MoveType | str) -> int:
    if isinstance(speed, MoveType):
        return speed.value
    return MoveType[speed].value


class BasePathMoveType():
    def __init__(self,path:list[tuple[int, int]]):
        self.type = None
        self.path = path

class MiningMove(BasePathMoveType):
    def __init__(self,path:list[tuple[int, int]]):
        self.type = "Mining"
        self.path = path

class GoMove(BasePathMoveType):
    def __init__(self,path:list[tuple[int, int]],speedPlan:list[MoveType]):
        self.type = "Go"
        self.path = path
        self.speedPlan = speedPlan

    def planned_steps(self) -> int:
        return sum(speed_to_steps(speed) for speed in self.speedPlan)

    def validate_path_speed_plan(self) -> None:
        expected_steps = len(self.path) - 1
        planned_steps = self.planned_steps()
        if planned_steps != expected_steps:
            raise ValueError(
                f"Inconsistent GoMove: planned {planned_steps} steps "
                f"for {expected_steps} path edges."
            )

    def iter_path_edges(self) -> Iterator[tuple[tuple[int, int], tuple[int, int], MoveType | str]]:
        self.validate_path_speed_plan()
        edge_index = 0
        for speed in self.speedPlan:
            step_count = speed_to_steps(speed)
            for _ in range(step_count):
                yield self.path[edge_index], self.path[edge_index + 1], speed
                edge_index += 1

    def expanded_path(self) -> list[tuple[int, int]]:
        if not self.path:
            return []
        expanded = [self.path[0]]
        for _, next_pos, _ in self.iter_path_edges():
            expanded.append(next_pos)
        return expanded

class HomeMove(GoMove):
    def __init__(self,path:list[tuple[int, int]],speedPlan:list[MoveType]):
        self.type = "Home"
        self.path = path
        self.speedPlan = speedPlan
