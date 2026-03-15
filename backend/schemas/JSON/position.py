from schemas.JSON.cors import Cors
from schemas.JSON.rover_move_type import MoveType
class Position():
    def __init__(self,*,cors:Cors,move_type:MoveType,current_time:float) -> None:
        self.cors = cors
        self.move_type = move_type
        self.current_time = current_time