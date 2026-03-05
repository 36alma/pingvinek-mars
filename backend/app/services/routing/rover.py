from schemas.JSON.map_block import (
    AirMapBlock,
    WallMapBlock,
    BlueOreMapBlock,
    YellowOreMapBlock,
    GreenOreMapBlock,
)
from services.map.map import MapService
class RoverService():
    def __init__(self):
        pass

    def startpost(self):
        start_pos = MapService().where_is_start()
        return start_pos

    def baseroute(self):
        startpost = self.startpost()
        

