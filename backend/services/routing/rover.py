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
        return TopLayer(rover=self.rover).start()

