from schemas.JSON.cluster import Cluster
from schemas.JSON.rover_move_type import MoveType
from services.map.map import MapService
from schemas.JSON import Cors
from schemas.JSON.map_block import OreBaseMapBlock
from schemas.JSON.rover import Rover, MIN_BATTERY_RESERVE
from services.algorithm.find_clusters import Find_Clusters
from services.algorithm.ore_distance import OreDistanceService
from schemas.JSON.move import BasePathMoveType,GoMove,MiningMove
class TopLayer():
    def __init__(
        self,
        *,
        rover:Rover,
        excluded_cluster_signatures: set[tuple[tuple[int, int], ...]] | None = None,
        max_mission_ticks: int | None = None,
    ):
        self.map_service = MapService()
        self.rover = rover
        self.initial_rover = self._clone_rover(rover)
        if max_mission_ticks is not None and max_mission_ticks < 0:
            raise ValueError("max_mission_ticks must be >= 0")
        self.max_mission_ticks = max_mission_ticks
        self._mission_start_tick = self._time_to_tick(
            day=self.initial_rover.day,
            time_value=self.initial_rover.time,
        )
        self.excluded_cluster_signatures = excluded_cluster_signatures or set()
        self.selected_cluster_signatures: list[tuple[tuple[int, int], ...]] = []
        self.last_route_valid = True

    @staticmethod
    def _manhattan(a: tuple[int, int], b: tuple[int, int]) -> int:
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    @staticmethod
    def _time_to_tick(*, day: int, time_value: float) -> int:
        return (day * 48) + int(round(time_value * 2))

    def _elapsed_mission_ticks(self, rover: Rover | None = None) -> int:
        rover_state = rover or self.rover
        return self._time_to_tick(
            day=rover_state.day,
            time_value=rover_state.time,
        ) - self._mission_start_tick

    def _remaining_mission_ticks(self, rover: Rover | None = None) -> int | None:
        if self.max_mission_ticks is None:
            return None
        return self.max_mission_ticks - self._elapsed_mission_ticks(rover)

    def _has_time_for_actions(self, *, rover: Rover, actions: int) -> bool:
        remaining = self._remaining_mission_ticks(rover)
        if remaining is None:
            return True
        return remaining >= actions

    @staticmethod
    def _min_actions_for_remaining_steps(remaining_steps: int) -> int:
        if remaining_steps <= 0:
            return 0
        return (remaining_steps + MoveType.FAST.value - 1) // MoveType.FAST.value

    def _validate_continuous_path(self, *, path: list[tuple[int, int]], move_type: str) -> None:
        if len(path) <= 1:
            return
        for idx in range(len(path) - 1):
            if self._manhattan(path[idx], path[idx + 1]) > 1:
                raise ValueError(
                    f"Teleport detected in {move_type} path at edge {idx}: "
                    f"{path[idx]} -> {path[idx + 1]}"
                )

    def _append_move(self, move: BasePathMoveType) -> None:
        path = move.path
        self._validate_continuous_path(path=path, move_type=getattr(move, "type", "Unknown"))
        if self.full_path and path:
            prev_path = self.full_path[-1].path
            if prev_path:
                if self._manhattan(prev_path[-1], path[0]) > 1:
                    raise ValueError(
                        f"Teleport detected between moves: {prev_path[-1]} -> {path[0]} "
                        f"({self.full_path[-1].type} -> {move.type})"
                    )
        self.full_path.append(move)

    def _clone_rover(self, rover: Rover | None = None) -> Rover:
        source = rover or self.rover
        clone = Rover()
        clone.x = source.x
        clone.y = source.y
        clone.battery = source.battery
        clone.inv = dict(source.inv)
        clone.day = source.day
        clone.time = source.time
        return clone

    @staticmethod
    def _copy_rover_state(target: Rover, source: Rover) -> None:
        target.x = source.x
        target.y = source.y
        target.battery = source.battery
        target.inv = dict(source.inv)
        target.day = source.day
        target.time = source.time

    @staticmethod
    def _cluster_signature(cluster: Cluster) -> tuple[tuple[int, int], ...]:
        return tuple(sorted((cors.x, cors.y) for cors in cluster.ores))

    def _is_unmined_ore(
        self,
        step: tuple[int, int],
        mined_positions: set[tuple[int, int]],
    ) -> bool:
        if step in mined_positions:
            return False
        block = self.map_service.get_map_block_type(x=step[0], y=step[1])
        return isinstance(block, OreBaseMapBlock)

    @staticmethod
    def _advance_rover_state(rover: Rover) -> None:
        rover.charge()
        rover.add_time()

    @staticmethod
    def _solar_gain_for_step(rover: Rover) -> int:
        return 10 if rover.IsDay() else 0

    def _score_speed_option(
        self,
        *,
        rover_before_move: Rover,
        rover_after_move: Rover,
        move_type: MoveType,
        need_to_finish: int,
        final_required_reserve: int,
    ) -> float:
        net_cost = max(
            0,
            rover_before_move.move_energy_calc(move_type) - self._solar_gain_for_step(rover_before_move),
        )
        battery_buffer = rover_after_move.battery - (need_to_finish + final_required_reserve)
        if rover_before_move.IsDay():
            score = (
                5.0 * move_type.value
                - 1.0 * net_cost
                + 0.3 * min(battery_buffer, 40)
            )
            if net_cost == 0:
                score += 4.0
            return score

        return (
            2.0 * move_type.value
            - 2.5 * net_cost
            + 0.2 * min(battery_buffer, 40)
        )

    def _simulate_move(self, rover: Rover, move_type: MoveType) -> bool:
        if not self._has_time_for_actions(rover=rover, actions=1):
            return False
        cost = rover.move_energy_calc(move_type)
        if rover.battery - cost < MIN_BATTERY_RESERVE:
            return False
        rover.remove_battery(cost)
        self._advance_rover_state(rover)
        return True

    def _home_path_for_rover(self, rover: Rover) -> list[tuple[int, int]] | None:
        home = self.map_service.where_is_start()
        if home is None:
            return None
        return OreDistanceService().get_ore_distance(
            ore_one_x=rover.x,
            ore_one_y=rover.y,
            ore_two_x=home.x,
            ore_two_y=home.y
        )

    def _can_return_home(self, rover: Rover) -> bool:
        home = self.map_service.where_is_start()
        if home is None:
            return True
        home_path = self._home_path_for_rover(rover)
        if home_path is None:
            return False
        home_rover = self._clone_rover(rover)
        return self._build_speed_plan(
            home_path,
            home_rover,
            require_home_reachability=False,
            final_required_reserve=0,
        ) is not None

    def _simulate_mining(self, rover: Rover, *, require_home_reachability: bool = False) -> bool:
        if not self._has_time_for_actions(rover=rover, actions=1):
            return False
        if rover.battery - 2 < MIN_BATTERY_RESERVE:
            return False
        rover.remove_battery(2)
        self._advance_rover_state(rover)
        if require_home_reachability and not self._can_return_home(rover):
            return False
        return True

    def _build_speed_plan(
        self,
        path: list[tuple[int, int]],
        rover: Rover,
        *,
        require_home_reachability: bool = False,
        final_required_reserve: int = MIN_BATTERY_RESERVE,
    ) -> list[MoveType] | None:
        if not path:
            return []
        self._validate_continuous_path(path=path, move_type="Go")
        if len(path) == 1:
            rover.x, rover.y = path[0]
            return []
        if not self._has_time_for_actions(
            rover=rover,
            actions=self._min_actions_for_remaining_steps(len(path) - 1),
        ):
            return None

        i = 0
        speed_plan: list[MoveType] = []
        speed_type = [MoveType.FAST, MoveType.NORMAL, MoveType.SLOW]

        while i < (len(path) - 1):
            remaining_steps = (len(path) - 1) - i
            chosen_speed: MoveType | None = None
            chosen_rover_state: Rover | None = None
            best_score = float("-inf")

            for move_type in speed_type:
                if move_type.value > remaining_steps:
                    continue

                candidate_rover = self._clone_rover(rover)
                if not self._simulate_move(candidate_rover, move_type):
                    continue

                next_index = i + move_type.value
                remaining_after_move = (len(path) - 1) - next_index
                if not self._has_time_for_actions(
                    rover=candidate_rover,
                    actions=self._min_actions_for_remaining_steps(remaining_after_move),
                ):
                    continue
                if require_home_reachability and not self._can_return_home(candidate_rover):
                    continue

                need_to_finish = candidate_rover.MinNeedForRemainingPath(path, next_index)
                safety_margin = final_required_reserve
                if candidate_rover.battery >= need_to_finish + safety_margin:
                    score = self._score_speed_option(
                        rover_before_move=rover,
                        rover_after_move=candidate_rover,
                        move_type=move_type,
                        need_to_finish=need_to_finish,
                        final_required_reserve=final_required_reserve,
                    )
                    if score > best_score:
                        best_score = score
                        chosen_speed = move_type
                        chosen_rover_state = candidate_rover

            if chosen_speed is None or chosen_rover_state is None:
                return None

            speed_plan.append(chosen_speed)
            i += chosen_speed.value
            self._copy_rover_state(rover, chosen_rover_state)


        return speed_plan

    def _simulate_mine_path(
        self,
        path: list[Cors | str],
        rover: Rover,
        mined_positions: set[tuple[int, int]],
    ) -> int:
        current_segment: list[tuple[int, int]] = []
        mined_count = 0
        for step in path:
            if isinstance(step, str):
                if step != "MINE":
                    continue
                if not current_segment:
                    continue
                if self._build_speed_plan(
                    current_segment,
                    rover,
                    require_home_reachability=False,
                ) is None:
                    break
                mine_step = current_segment[-1]
                rover.x, rover.y = mine_step
                if self._is_unmined_ore(mine_step, mined_positions):
                    if not self._simulate_mining(rover, require_home_reachability=False):
                        break
                    mined_positions.add(mine_step)
                    mined_count += 1
                current_segment = [mine_step]
                continue

            current_step = (step.x, step.y)
            if not current_segment:
                current_segment.append(current_step)
                continue
            if current_segment[-1] != current_step:
                current_segment.append(current_step)

        if len(current_segment) > 1:
            if self._build_speed_plan(
                current_segment,
                rover,
                require_home_reachability=False,
            ) is None:
                return mined_count
        elif len(current_segment) == 1:
            rover.x, rover.y = current_segment[0]
        return mined_count

    def _can_execute_cluster_plan(
        self,
        cluster: Cluster,
        approach_path: list[tuple[int, int]],
    ) -> bool:
        sim_rover = self._clone_rover()
        mined_positions: set[tuple[int, int]] = set()

        if self._build_speed_plan(
            approach_path,
            sim_rover,
            require_home_reachability=False,
        ) is None:
            return False

        remaining_ores = dict(cluster.ores)
        if remaining_ores:
            sim_cluster = Cluster(rover=sim_rover, ores=remaining_ores)
            sim_cluster_path = sim_cluster.internal_distance_calc(
                start_post=Cors(x=sim_rover.x, y=sim_rover.y)
            )
            mined_count = self._simulate_mine_path(
                sim_cluster_path.route,
                sim_rover,
                mined_positions,
            )
            if mined_count == 0:
                return False

        home = self.map_service.where_is_start()
        if home is None:
            return True

        back_path = OreDistanceService().get_ore_distance(
            ore_one_x=sim_rover.x,
            ore_one_y=sim_rover.y,
            ore_two_x=home.x,
            ore_two_y=home.y
        )
        if back_path is None:
            return False

        return self._build_speed_plan(
            back_path,
            sim_rover,
            require_home_reachability=False,
            final_required_reserve=0,
        ) is not None

    def start(self) -> list[BasePathMoveType]:
        map = self.map_service.get_full_map_OBJ()
        ores:dict[Cors,OreBaseMapBlock] = {}
        for key, value in map.items():
            if isinstance(value,OreBaseMapBlock):
                x,y = key.split(",")
                ores[Cors(x=int(x),y=int(y))] = value
        self.visited:list[Cluster] = []
        self.full_path:list[BasePathMoveType] = []
        clusters = Find_Clusters(Rover=self.rover,ores=ores)
        while True:
            if not self._has_time_for_actions(rover=self.rover, actions=1):
                break
            clusters_nears = self._get_clusters_score(clusters=clusters)
            clusters_nears_scores = sorted(clusters_nears.items(), key=lambda x: x[1],reverse=True)
            if len(clusters_nears_scores) == 0:
                break
            processed_any = False
            for cluster in clusters_nears_scores:
                if cluster[0].clusters_nears is None:
                    continue
                if cluster[0] in self.visited:
                    continue
                if self._cluster_signature(cluster[0]) in self.excluded_cluster_signatures:
                    continue
                rover_x: int = self.rover.x
                rover_y: int = self.rover.y
                path = OreDistanceService().get_ore_distance(
                    ore_one_x=rover_x,
                    ore_one_y=rover_y,
                    ore_two_x=cluster[0].clusters_nears.x,
                    ore_two_y=cluster[0].clusters_nears.y
                )
                if path is not None and self._can_execute_cluster_plan(cluster[0], path):
                    self.add_path(path, require_home_reachability=False)
                    self._refresh_cluster_ores(cluster[0])
                    cluster[0].cluster_last_post = None
                    cluster[0].cluster_path = cluster[0].internal_distance_calc(
                        start_post=Cors(x=self.rover.x, y=self.rover.y)
                    )
                    mined_count = self.add_mine_path(cluster[0].cluster_path.route)
                    if mined_count > 0:
                        self.selected_cluster_signatures.append(
                            self._cluster_signature(cluster[0])
                        )
                    self._refresh_cluster_ores(cluster[0])
                    if len(cluster[0].ores) == 0:
                        self.visited.append(cluster[0])
                    processed_any = mined_count > 0 or len(path) > 1
                    break
            if not processed_any:
                break
                
        home = self.map_service.where_is_start()
        if home is not None:
            back_path = OreDistanceService().get_ore_distance(
                ore_one_x=self.rover.x,
                ore_one_y=self.rover.y,
                ore_two_x=home.x,
                ore_two_y=home.y
            )
            if back_path is not None:
                sim_rover = self._clone_rover()
                if self._build_speed_plan(
                    back_path,
                    sim_rover,
                    require_home_reachability=False,
                    final_required_reserve=0,
                ) is not None:
                    self.add_path(back_path, require_home_reachability=False, final_required_reserve=0)
        self.last_route_valid = self._validate_final_route()
        if not self.last_route_valid:
            self.full_path = []
            return self.full_path
        return self.full_path
        
            
    def _get_clusters_score(self,clusters:list[Cluster]):
        clusters_nears:dict[Cluster,float] = {}
        for i in clusters:
            if i in self.visited:
                continue
            if self._cluster_signature(i) in self.excluded_cluster_signatures:
                continue
            self._refresh_cluster_ores(i)
            if len(i.ores) == 0:
                self.visited.append(i)
                continue
            cluster_ores_distance: dict[Cors, int] = {}
            for cors, _ in i.ores.items():
                path = OreDistanceService().get_ore_distance(
                    ore_one_x=self.rover.x,
                    ore_one_y=self.rover.y,
                    ore_two_x=cors.x,
                    ore_two_y=cors.y
                )
                if path is not None:
                    cluster_ores_distance[cors] = len(path)
            i.cluster_ores_distance = cluster_ores_distance
            i.set_clusters_nears()
            if i.clusters_nears is None:
                clusters_nears[i] = float("-inf")
                continue
            clusters_nears[i] = i.get_cluster_value()
        return clusters_nears

    def _refresh_cluster_ores(self, cluster: Cluster) -> None:
        current_ores: dict[Cors, OreBaseMapBlock] = {}
        for cors, _ in cluster.ores.items():
            block = self.map_service.get_map_block_type(cors.x, cors.y)
            if isinstance(block, OreBaseMapBlock):
                current_ores[cors] = block
        cluster.ores = current_ores
        cluster.ore_amount = len(current_ores)
        cluster.cluster_ores_distance = {}
        if len(current_ores) == 0:
            cluster.clusters_nears = None
            cluster.cluster_last_post = None

    def add_path_with_inline_mining(self, path: list[tuple[int, int]]) -> None:
        if not path:
            return

        current_segment: list[tuple[int, int]] = [path[0]]
        for x, y in path[1:]:
            step = (x, y)
            current_segment.append(step)
            block = self.map_service.get_map_block_type(x=x, y=y)
            if not isinstance(block, OreBaseMapBlock):
                continue

            self.add_path(current_segment)
            if self.rover.battery - 2 < MIN_BATTERY_RESERVE:
                raise ValueError(
                    f"Infeasible mining step at {step}: mining would leave the battery below "
                    f"the safety reserve ({MIN_BATTERY_RESERVE})."
                )
            self.rover.mining(cors=Cors(x=x, y=y), ore_type=block)
            self._append_move(MiningMove(path=[step, step]))
            current_segment = [step]

        if len(current_segment) > 1:
            self.add_path(current_segment)
        elif len(path) == 1:
            self.rover.x, self.rover.y = path[0]

    def add_path(
        self,
        path:list[tuple[int, int]],
        *,
        require_home_reachability: bool = False,
        final_required_reserve: int = MIN_BATTERY_RESERVE,
    ):
        if not path:
            return
        if len(path) == 1:
            self.rover.x, self.rover.y = path[0]
            return
        planned_rover = self._clone_rover(self.rover)
        speedPlan = self._build_speed_plan(
            path,
            planned_rover,
            require_home_reachability=require_home_reachability,
            final_required_reserve=final_required_reserve,
        )
        if speedPlan is None:
            raise ValueError(
                f"Infeasible route segment: executing the path would leave the battery below "
                f"the safety reserve ({MIN_BATTERY_RESERVE}). Segment start={path[0]} "
                f"end={path[-1]}"
            )
        planned_steps = sum(speed.value for speed in speedPlan)
        if planned_steps != (len(path) - 1):
            raise ValueError(
                f"Inconsistent route plan: planned {planned_steps} steps for "
                f"{len(path) - 1} path edges."
            )
        for speed in speedPlan:
            self.rover.move(type=speed)
        self._append_move(GoMove(path=path,speedPlan=speedPlan))
        self.rover.x, self.rover.y = path[-1]


    def add_mine_path(self,path:list[Cors|str]) -> int:
        tuple_path: list[tuple[int, int]] = [(step.x, step.y) for step in path if isinstance(step, Cors)]
        if tuple_path:
            self._validate_continuous_path(path=tuple_path, move_type="Mining")
        current_segment: list[tuple[int, int]] = []
        mined_count = 0
        for step in path:
            if isinstance(step, str):
                if step != "MINE":
                    continue
                if not current_segment:
                    continue
                path_preview = self._clone_rover(self.rover)
                path_preview_result = self._build_speed_plan(
                    current_segment,
                    path_preview,
                    require_home_reachability=False,
                )
                if path_preview_result is None:
                    break
                self.add_path(current_segment, require_home_reachability=False)
                mine_x, mine_y = current_segment[-1]
                step_ore_type = MapService().get_map_block_type(x=mine_x, y=mine_y)
                if isinstance(step_ore_type, OreBaseMapBlock):
                    mine_preview = self._clone_rover(self.rover)
                    if not self._simulate_mining(
                        mine_preview,
                        require_home_reachability=False,
                    ):
                        break
                    self.rover.mining(
                        cors=Cors(x=mine_x, y=mine_y),
                        ore_type=step_ore_type,
                    )
                    self._append_move(MiningMove(path=[(mine_x, mine_y), (mine_x, mine_y)]))
                    mined_count += 1
                current_segment = [(mine_x, mine_y)]
                continue

            current_step = (step.x, step.y)
            if not current_segment:
                current_segment.append(current_step)
                continue
            if current_segment[-1] != current_step:
                current_segment.append(current_step)

        if len(current_segment) > 1:
            path_preview = self._clone_rover(self.rover)
            if self._build_speed_plan(
                current_segment,
                path_preview,
                require_home_reachability=False,
            ) is not None:
                self.add_path(current_segment, require_home_reachability=False)
        elif len(current_segment) == 1:
            self.rover.x, self.rover.y = current_segment[0]
        return mined_count

    def _validate_final_route(self) -> bool:
        sim_rover = self._clone_rover(self.initial_rover)
        min_battery = sim_rover.battery

        for move in self.full_path:
            move_type = getattr(move, "type", None)
            if move_type == "Go":
                speed_plan = getattr(move, "speedPlan", [])
                for speed in speed_plan:
                    if not self._simulate_move(sim_rover, speed):
                        return False
                    min_battery = min(min_battery, sim_rover.battery)
                if move.path:
                    sim_rover.x, sim_rover.y = move.path[-1]
            elif move_type == "Mining":
                mine_events = 0
                if len(move.path) >= 2:
                    for idx in range(1, len(move.path)):
                        if move.path[idx] == move.path[idx - 1]:
                            mine_events += 1
                if mine_events == 0 and move.path:
                    mine_events = 1
                for _ in range(mine_events):
                    if not self._simulate_mining(sim_rover, require_home_reachability=False):
                        return False
                    min_battery = min(min_battery, sim_rover.battery)
                if move.path:
                    sim_rover.x, sim_rover.y = move.path[-1]

        home = self.map_service.where_is_start()
        if home is not None and (sim_rover.x != home.x or sim_rover.y != home.y):
            return False
        return min_battery >= MIN_BATTERY_RESERVE


