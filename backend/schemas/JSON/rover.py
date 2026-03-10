from typing import Literal
from schemas.JSON import JsonBase
from services.map.map import Cors
from schemas.JSON.rover_move_type import MoveType
from schemas.JSON.map_block import BaseMapBlock
from services.map.map import MapService
from typing import Any, Callable

class Time:
    def __init__(self, func: Callable[..., Any]) -> None:
        self.func = func

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        result = self.func(*args, **kwargs)
        if args and hasattr(args[0], "add_time") and hasattr(args[0], "charge"):
            args[0].charge()            
            args[0].add_time()
        return result
    

        
class Rover(JsonBase):
    def __init__(self):
        self.x: int
        self.y: int
        self.next_cors: Cors
        self.battery: int
        self.inv: dict[Cors,BaseMapBlock]
        self.day:int
        self.time:float
    def add_battery(self,amount:int):
        if self.battery + amount > 100:
            self.battery = 100
        else:
            self.battery += amount
    
    def remove_battery(self,amount:int):
        if self.battery - amount < 0:
            self.battery = 0
        else:
            self.battery -= amount

    def add_inv(self,*,cors:Cors,ore_type:BaseMapBlock) -> Literal[True]:
        self.inv[cors] = ore_type
        return True

    def add_time(self):
        self.time += 0.5
        if self.time == 24:
            self.time = 0
            self.day += 1
        return True

    
    def daylight(self):
        self.add_battery(10)

    def charge(self):
        if self.time >= 0 and self.time < 16:
            self.daylight()
        
    
    def move_energy_calc(self,type:MoveType):
        v = 0
        if type == MoveType.SLOW:
            v = 1
        elif type == MoveType.NORMAL:
            v = 2
        elif type == MoveType.FAST:
            v = 3
        return 2* v**2
    
    @Time
    def stand(self):
        self.remove_battery(1)

    @Time
    def move(self,type:MoveType):
        self.remove_battery(self.move_energy_calc(type))

    @Time
    def mining(self,*,cors:Cors,ore_type:BaseMapBlock):
        MapService().change_air(x=cors.x,y=cors.y)
        self.add_inv(cors=cors,ore_type=ore_type)
        self.remove_battery(2)
        return True

global rover
rover = Rover()