from fastapi import APIRouter
from schemas.IN.rover import RoverMoveRequest

app = APIRouter(prefix="/rover", tags=["Rover"])


class Rover_Router():
    def __init__(self):
        self._register_api_endpoint()

    def _register_api_endpoint(self):
        @app.post("/move")
        def move_rover(self, request: RoverMoveRequest):
            return request
