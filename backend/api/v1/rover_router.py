from fastapi import APIRouter
from schemas.IN.rover import RoverMoveRequest
from services.routing.rover import RoverService
from services.algorithm.ore_distance import OreDistanceService
from schemas.JSON.map_block import WallMapBlock
from services.map.map import MapService
import random
app = APIRouter(prefix="/rover", tags=["Rover"])


class Rover_Router():
    def __init__(self):
        self._register_api_endpoint()

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
Rover_Router()