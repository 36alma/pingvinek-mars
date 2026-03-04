from pydantic import BaseModel
from typing import Dict, List

class GetMap(BaseModel):
    map: Dict[str, List[str]]