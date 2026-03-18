from fastapi import APIRouter
from services.map.map import MapService
from schemas.JSON.map import MapResponse

app = APIRouter(prefix="/map", tags=["map"])
map_service = MapService()


@app.get("/", response_model=MapResponse)
def get_map():
    """Térkép adatok lekérése JSON-ban."""
    return map_service.get_map()

@app.get("/reset", response_model=MapResponse)
def reset_map():
    """Térkép visszaállítása az eredeti CSV állapotba (ásványok visszatöltése)."""
    map_service.reset_map()
    return map_service.get_map()