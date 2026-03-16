import unittest
from unittest.mock import patch

from schemas.JSON import Cors
from schemas.JSON.cluster import Cluster
from schemas.JSON.cluster_mine import ClusterMine
from schemas.JSON.map_block import BlueOreMapBlock
from schemas.JSON.rover import Rover, MIN_BATTERY_RESERVE
from services.algorithm.top_layer import TopLayer
from schemas.JSON.move import GoMove
from schemas.JSON.rover_move_type import MoveType
from api.v1.rover_router import Rover_Router


class BatteryRouteGuardTests(unittest.TestCase):
    @staticmethod
    def _make_rover(battery: int) -> Rover:
        rover = Rover()
        rover.x = 0
        rover.y = 0
        rover.battery = battery
        rover.inv = {}
        rover.day = 0
        rover.time = 0
        return rover

    def test_add_path_rejects_route_that_ends_below_reserve(self) -> None:
        rover = self._make_rover(battery=MIN_BATTERY_RESERVE + 1)
        top_layer = TopLayer(rover=rover)

        with self.assertRaisesRegex(ValueError, "below the safety reserve"):
            top_layer.add_path([(0, 0), (1, 0)])

        self.assertEqual(rover.battery, MIN_BATTERY_RESERVE + 1)
        self.assertEqual((rover.x, rover.y), (0, 0))

    def test_cluster_score_marks_low_end_battery_as_infeasible(self) -> None:
        rover = self._make_rover(battery=MIN_BATTERY_RESERVE + 8)
        rover.time = 20
        ores = {Cors(x=1, y=1): BlueOreMapBlock()}

        with patch.object(
            Cluster,
            "internal_distance_calc",
            return_value=ClusterMine(route=[], collected=[]),
        ), patch.object(
            Cluster,
            "_len_clustertostart",
            return_value=1,
        ), patch.object(
            Cluster,
            "internal_distance",
            return_value=0,
        ), patch.object(
            Cluster,
            "distance_to_home",
            return_value=[],
        ):
            cluster = Cluster(rover=rover, ores=ores)

        self.assertEqual(cluster.cluster_value, float("-inf"))

    def test_cluster_internal_travel_is_executed_as_go_moves(self) -> None:
        rover = self._make_rover(battery=100)
        top_layer = TopLayer(rover=rover)

        with patch.object(
            top_layer.map_service,
            "get_map_block_type",
            return_value=BlueOreMapBlock(),
        ), patch(
            "services.algorithm.top_layer.MapService.get_map_block_type",
            return_value=BlueOreMapBlock(),
        ), patch(
            "services.algorithm.top_layer.MapService.change_air",
            return_value=True,
        ):
            top_layer.full_path = []
            top_layer.add_mine_path(
                [
                    Cors(0, 0),
                    Cors(1, 0),
                    "MINE",
                    Cors(1, 0),
                    Cors(2, 0),
                    "MINE",
                ]
            )

        go_moves = [move for move in top_layer.full_path if isinstance(move, GoMove)]
        mining_moves = [move for move in top_layer.full_path if getattr(move, "type", None) == "Mining"]

        self.assertEqual(len(go_moves), 2)
        self.assertEqual(go_moves[0].path, [(0, 0), (1, 0)])
        self.assertEqual(go_moves[1].path, [(1, 0), (2, 0)])
        self.assertEqual(len(mining_moves), 2)

    def test_add_path_skips_single_point_go_move(self) -> None:
        rover = self._make_rover(battery=100)
        top_layer = TopLayer(rover=rover)
        top_layer.full_path = []

        top_layer.add_path([(5, 5)])

        self.assertEqual(top_layer.full_path, [])
        self.assertEqual((rover.x, rover.y), (5, 5))

    def test_router_keeps_continuous_path_and_adds_timeline_path(self) -> None:
        move = GoMove(
            path=[(0, 0), (0, 1), (0, 2), (0, 3), (1, 3), (2, 3)],
            speedPlan=[MoveType.FAST, MoveType.NORMAL],
        )

        serialized = Rover_Router._serialize_route([move])[0]

        self.assertEqual(
            serialized["path"],
            [(0, 0), (0, 1), (0, 2), (0, 3), (1, 3), (2, 3)],
        )
        self.assertEqual(
            serialized["timelinePath"],
            [(0, 0), (0, 3), (2, 3)],
        )


if __name__ == "__main__":
    unittest.main()
