from pydantic import BaseModel
from typing import Dict


class MapResponse(BaseModel):
    map: Dict[str, str]  # kulcs: "x,y", érték: csempe karakter
    rows: int
    cols: int
