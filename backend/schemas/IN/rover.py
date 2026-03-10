from pydantic import BaseModel, Field
from enum import Enum

class DirectionEnum(str, Enum):
    LEFT = "LEFT"
    RIGHT = "RIGHT"

class RoverMoveRequest(BaseModel):
    track: str = Field(..., description="1D track as a comma-separated string, e.g., '.,.,.,.,.,.,.,S,'")
    direction: DirectionEnum
