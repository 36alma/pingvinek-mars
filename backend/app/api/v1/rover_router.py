from fastapi import APIRouter
from schemas.IN.rover import RoverMoveRequest
from schemas.OUT.rover import RoverMoveResponse
from services.rover import calculate_straight_line_movement

app = APIRouter(prefix="/rover", tags=["Rover"])

@app.post("/move", response_model=RoverMoveResponse)
def move_rover(request: RoverMoveRequest):
    return calculate_straight_line_movement(request)
