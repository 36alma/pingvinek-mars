from schemas.JSON.rover_move_type import MoveType


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