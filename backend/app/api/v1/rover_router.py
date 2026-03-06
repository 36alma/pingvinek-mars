from fastapi import APIRouter
from schemas.IN.rover import RoverMoveRequest
from services.routing.rover import RoverService
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
            pass
Rover_Router()