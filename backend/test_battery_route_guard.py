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

    @staticmethod
    def _make_ores(count: int, x_offset: int = 1) -> dict[Cors, BlueOreMapBlock]:
        return {
            Cors(x=x_offset + i, y=1): BlueOreMapBlock()
            for i in range(count)
        }

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

    def test_cluster_score_prefers_near_cluster_even_if_far_has_more_ore(self) -> None:
        rover = self._make_rover(battery=250)
        rover.time = 0

        near_ores = self._make_ores(count=3, x_offset=1)
        far_ores = self._make_ores(count=12, x_offset=20)

        with patch.object(
            Cluster,
            "internal_distance_calc",
            return_value=ClusterMine(route=[], collected=[]),
        ), patch.object(
            Cluster,
            "internal_distance",
            return_value=1,
        ), patch.object(
            Cluster,
            "distance_to_home",
            return_value=[],
        ):
            with patch.object(Cluster, "_len_clustertostart", return_value=3):
                near_cluster = Cluster(rover=rover, ores=near_ores)
            with patch.object(Cluster, "_len_clustertostart", return_value=20):
                far_cluster = Cluster(rover=rover, ores=far_ores)

        self.assertGreater(near_cluster.cluster_value, far_cluster.cluster_value)

    def test_cluster_score_penalizes_long_elapsed_time(self) -> None:
        rover = self._make_rover(battery=350)
        rover.time = 0

        short_time_ores = self._make_ores(count=5, x_offset=1)
        long_time_ores = self._make_ores(count=6, x_offset=1)

        with patch.object(
            Cluster,
            "internal_distance_calc",
            return_value=ClusterMine(route=[], collected=[]),
        ), patch.object(
            Cluster,
            "distance_to_home",
            return_value=[],
        ):
            with patch.object(Cluster, "_len_clustertostart", return_value=3), patch.object(
                Cluster,
                "internal_distance",
                return_value=1,
            ):
                short_time_cluster = Cluster(rover=rover, ores=short_time_ores)
            with patch.object(Cluster, "_len_clustertostart", return_value=3), patch.object(
                Cluster,
                "internal_distance",
                return_value=15,
            ):
                long_time_cluster = Cluster(rover=rover, ores=long_time_ores)

        self.assertGreater(short_time_cluster.cluster_value, long_time_cluster.cluster_value)

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

    def test_speed_plan_prefers_normal_in_daylight_for_short_safe_segment(self) -> None:
        rover = self._make_rover(battery=20)
        rover.time = 10
        top_layer = TopLayer(rover=rover)

        speed_plan = top_layer._build_speed_plan(
            [(0, 0), (1, 0), (2, 0)],
            top_layer._clone_rover(rover),
            require_home_reachability=False,
            final_required_reserve=10,
        )

        self.assertEqual(speed_plan, [MoveType.NORMAL])

    def test_speed_plan_prefers_slow_at_night_for_short_segment(self) -> None:
        rover = self._make_rover(battery=20)
        rover.time = 20
        top_layer = TopLayer(rover=rover)

        speed_plan = top_layer._build_speed_plan(
            [(0, 0), (1, 0), (2, 0)],
            top_layer._clone_rover(rover),
            require_home_reachability=False,
            final_required_reserve=10,
        )

        self.assertEqual(speed_plan, [MoveType.SLOW, MoveType.SLOW])

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

    def test_router_builds_execution_timeline_without_zero_battery(self) -> None:
        moves = [
            {
                "type": "Go",
                "path": [(0, 0), (0, 1), (0, 2)],
                "timelinePath": [(0, 0), (0, 2)],
                "speedPlan": ["NORMAL"],
            },
            {
                "type": "Mining",
                "path": [(0, 2), (0, 2)],
            },
        ]

        timeline = Rover_Router._build_execution_timeline(moves, (0, 0))

        self.assertEqual(len(timeline), 2)
        self.assertTrue(all(step["battery"] > 0 for step in timeline))
        self.assertEqual(timeline[0]["position"], [0, 2])
        self.assertEqual(timeline[1]["type"], "Mining")


if __name__ == "__main__":
    unittest.main()
