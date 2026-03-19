import unittest
from unittest.mock import patch, MagicMock
from services.algorithm.top_layer import TopLayer
from schemas.JSON.rover import Rover
from schemas.JSON.rover_move_type import MoveType
from schemas.JSON.move import GoMove

class MockRover:
    def __init__(self):
        self.x = 0
        self.y = 0
        self.battery = 100
        self.inv = {}
        self.day = 0
        self.time = 0.0
    
    def charge(self): pass
    def add_time(self):
        self.time += 0.5
        if self.time >= 24:
            self.time = 0
            self.day += 1
    def remove_battery(self, amt):
        self.battery -= amt
    def move_energy_calc(self, type):
        return 2 * (type.value ** 2)
    def IsDay(self): return True
    def MinNeedForRemainingPath(self, path, idx): return 0
    def move(self, type):
        self.remove_battery(self.move_energy_calc(type))
        self.charge()
        self.add_time()
    def mining(self, cors, ore_type):
        self.remove_battery(2)
        self.charge()
        self.add_time()

@patch('services.algorithm.top_layer.MapService')
@patch('services.algorithm.top_layer.OreDistanceService')
@patch('services.algorithm.top_layer.Find_Clusters')
class TestTimeBug(unittest.TestCase):
    def test_max_time_exceeded(self, mock_find, mock_dist, mock_map):
        # Setup: rover starts at (0,0)
        rover = Rover()
        rover.x, rover.y = 0, 0
        rover.battery = 100
        rover.day, rover.time = 0, 0.0
        
        # Max mission ticks: 2 (1 hour)
        top_layer = TopLayer(rover=rover, max_mission_ticks=2)
        
        # Mock map and start position
        mock_map_instance = mock_map.return_value
        mock_map_instance.where_is_start.return_value = MagicMock(x=0, y=0)
        
        # Mock one cluster at (1,0)
        mock_cluster = MagicMock()
        mock_cluster.ores = {MagicMock(x=1,y=0): "ORE"}
        mock_cluster.clusters_nears = MagicMock(x=1, y=0)
        mock_find.return_value = [mock_cluster]
        
        # Mock paths: 
        # (0,0) -> (1,0) dist 1
        # (1,0) -> (0,0) dist 1
        mock_dist_instance = mock_dist.return_value
        mock_dist_instance.get_ore_distance.side_effect = lambda ore_one_x, ore_one_y, ore_two_x, ore_two_y: [
            (ore_one_x, ore_one_y), (ore_two_x, ore_two_y)
        ] if ore_one_x != ore_two_x or ore_one_y != ore_two_y else [(ore_one_x, ore_one_y)]
        
        # Mock cluster paths
        mock_cluster.internal_distance_calc.return_value = MagicMock(route=[MagicMock(x=1,y=0), "MINE"])
        
        # Run top_layer.start()
        # Expectation: 
        # Move to cluster: 1 action (0.5h) -> Tick 1
        # Mine cluster: 1 action (0.5h) -> Tick 2
        # Return home: 1 action (0.5h) -> Tick 3
        # Since max_mission_ticks=2, it should NOT return a route that includes everything.
        
        route = top_layer.start()
        
        final_ticks = (rover.day * 48) + int(rover.time * 2)
        print(f"Final ticks: {final_ticks}, Max ticks: 2")
        
        if final_ticks > 2:
            print("!!! BUG REPRODUCED: Route exceeded max_mission_ticks")
        else:
            print("Time limit respected.")

if __name__ == "__main__":
    unittest.main()
