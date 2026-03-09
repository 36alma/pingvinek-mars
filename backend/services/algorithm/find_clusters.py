from schemas.JSON.map_block import OreBaseMapBlock
from schemas.JSON.cluster import Cluster
from schemas.JSON.cors import Cors
from schemas.JSON.rover import Rover
from services.map.map import MapService
class Find_Clusters():
    def __new__(cls,*,Rover:Rover,ores:dict[Cors,OreBaseMapBlock]):
        queue:list[Cors] = []
        visited:set[Cors] = set()
        clusters:list[Cluster] = []
        directions = [(0, 1), (0, -1), (1, 0), (-1, 0)]

        for cors, ore in ores.items():
            if cors in visited:
                continue
            
            queue.append(cors)
            visited.add(cors)
            cluster: dict[Cors, OreBaseMapBlock] = {cors: ore}

            while queue:
                u = queue.pop(0)
                
                for dx, dy in directions:
                    new_cors = Cors(x=(u.x + dx), y=(u.y + dy))
                    
                    if not (0 <= new_cors.x <= 50 and 0 <= new_cors.y <= 50):
                        continue
                    
                    if new_cors in visited:
                        continue
                    
                    new_block_type = MapService().get_map_block_type(x=new_cors.x, y=new_cors.y)
                    
                    if new_block_type is None or not isinstance(new_block_type, OreBaseMapBlock):
                        visited.add(new_cors) 
                        continue
                    
                    queue.append(new_cors)
                    visited.add(new_cors)
                    cluster[new_cors] = new_block_type

            if len(cluster) > 0:
                clusters.append(Cluster(rover=Rover, ores=cluster))

        return clusters
            


