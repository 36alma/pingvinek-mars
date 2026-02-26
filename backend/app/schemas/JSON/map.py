from pydantic import BaseModel
from typing import Dict, List


class MapResponse(BaseModel):
    map: Dict[str, List[str]]
    rows: int
    cols: int
