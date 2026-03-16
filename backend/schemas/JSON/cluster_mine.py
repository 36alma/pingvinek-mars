from schemas.JSON import Cors
from services.map.map import MapService
class ClusterMine():
    def __init__(self,route:list[Cors|str],collected:list[Cors]) -> None:
        self.route = route
        self.collected = collected

    def remove_ore_from_map(self,cors:Cors):
        if cors in self.collected:
            self.collected.remove(cors)
            MapService().change_air(x=cors.x,y=cors.y)
            return True
        else:
            print("Nem lett össze gyűjtve")
            return False