/**
 * A* Pathfinding with 8-directional movement
 * and AI-based multi-target route planner.
 */
import { CELL, MAP_SIZE } from './mapData';

// 8-directional neighbors
const DIRS = [
    { dx: 0, dy: -1, cost: 1 },
    { dx: 1, dy: -1, cost: 1.414 },
    { dx: 1, dy: 0, cost: 1 },
    { dx: 1, dy: 1, cost: 1.414 },
    { dx: 0, dy: 1, cost: 1 },
    { dx: -1, dy: 1, cost: 1.414 },
    { dx: -1, dy: 0, cost: 1 },
    { dx: -1, dy: -1, cost: 1.414 },
];

function heuristic(ax, ay, bx, by) {
    // Chebyshev distance
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function isWalkable(map, x, y) {
    if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return false;
    return map[y][x] !== CELL.OBSTACLE;
}

/**
 * A* search from (sx,sy) to (gx,gy).
 * Returns array of {x,y} positions (including start and goal), or null.
 */
export function astar(map, sx, sy, gx, gy) {
    if (!isWalkable(map, gx, gy)) return null;

    const key = (x, y) => y * MAP_SIZE + x;
    const startK = key(sx, sy);
    const goalK = key(gx, gy);

    const gScore = new Float64Array(MAP_SIZE * MAP_SIZE).fill(Infinity);
    const fScore = new Float64Array(MAP_SIZE * MAP_SIZE).fill(Infinity);
    const cameFrom = new Int32Array(MAP_SIZE * MAP_SIZE).fill(-1);
    const closed = new Uint8Array(MAP_SIZE * MAP_SIZE);

    gScore[startK] = 0;
    fScore[startK] = heuristic(sx, sy, gx, gy);

    // Simple binary heap for the open set
    const open = [startK];
    const inOpen = new Uint8Array(MAP_SIZE * MAP_SIZE);
    inOpen[startK] = 1;

    const popMin = () => {
        let bestIdx = 0;
        let bestF = fScore[open[0]];
        for (let i = 1; i < open.length; i++) {
            if (fScore[open[i]] < bestF) {
                bestF = fScore[open[i]];
                bestIdx = i;
            }
        }
        const val = open[bestIdx];
        open[bestIdx] = open[open.length - 1];
        open.pop();
        return val;
    };

    while (open.length > 0) {
        const currentK = popMin();
        if (currentK === goalK) {
            // Reconstruct
            const path = [];
            let k = goalK;
            while (k !== -1) {
                const y = Math.floor(k / MAP_SIZE);
                const x = k % MAP_SIZE;
                path.unshift({ x, y });
                k = cameFrom[k];
            }
            return path;
        }

        inOpen[currentK] = 0;
        closed[currentK] = 1;

        const cx = currentK % MAP_SIZE;
        const cy = Math.floor(currentK / MAP_SIZE);

        for (const dir of DIRS) {
            const nx = cx + dir.dx;
            const ny = cy + dir.dy;
            if (!isWalkable(map, nx, ny)) continue;

            // Diagonal: check corner-cutting
            if (dir.dx !== 0 && dir.dy !== 0) {
                if (!isWalkable(map, cx + dir.dx, cy) || !isWalkable(map, cx, cy + dir.dy)) continue;
            }

            const nk = key(nx, ny);
            if (closed[nk]) continue;

            const tentG = gScore[currentK] + dir.cost;
            if (tentG < gScore[nk]) {
                cameFrom[nk] = currentK;
                gScore[nk] = tentG;
                fScore[nk] = tentG + heuristic(nx, ny, gx, gy);
                if (!inOpen[nk]) {
                    open.push(nk);
                    inOpen[nk] = 1;
                }
            }
        }
    }

    return null;
}

/**
 * Calculate straight-line step count between two path points
 */
function pathSteps(path) {
    return path ? path.length - 1 : Infinity;
}

/**
 * AI Route Planner:
 * Greedy nearest-neighbor with energy-aware pruning.
 * Plans to collect as many minerals as possible within time/energy constraints,
 * then returns to start.
 */
export function planRoute(map, startX, startY, minerals, totalTimeHours) {
    const totalTicks = totalTimeHours * 2; // 1 tick = 30 min
    const SPEED = 2; // Normal speed
    const K = 2;

    const remaining = minerals.map((m, i) => ({ ...m, idx: i }));
    const collected = [];
    const fullPath = [{ x: startX, y: startY, action: 'start' }];

    let curX = startX;
    let curY = startY;
    let battery = 100;
    let ticksUsed = 0;

    const isDaytime = (tick) => (tick % 48) < 32;

    const simulateEnergy = (ticks, fromTick, moveTicks, mineTicks) => {
        let bat = battery;
        let t = fromTick;
        // Movement ticks
        for (let i = 0; i < moveTicks && bat > 0; i++) {
            bat -= K * SPEED * SPEED;
            if (isDaytime(t)) bat += 10;
            bat = Math.max(0, Math.min(100, bat));
            t++;
        }
        // Mining ticks
        for (let i = 0; i < mineTicks && bat > 0; i++) {
            bat -= 2;
            if (isDaytime(t)) bat += 10;
            bat = Math.max(0, Math.min(100, bat));
            t++;
        }
        return { finalBattery: bat, finalTick: t };
    };

    while (remaining.length > 0) {
        // Score each mineral: distance vs value, considering energy
        let bestScore = -Infinity;
        let bestIdx = -1;
        let bestPath = null;

        for (let i = 0; i < remaining.length; i++) {
            const m = remaining[i];
            const path = astar(map, curX, curY, m.x, m.y);
            if (!path) continue;

            const steps = pathSteps(path);
            const travelTicks = Math.ceil(steps / SPEED);
            const mineTicks = 1;

            // Can we still return to start after?
            const returnPath = astar(map, m.x, m.y, startX, startY);
            if (!returnPath) continue;
            const returnTicks = Math.ceil(pathSteps(returnPath) / SPEED);

            const totalNeeded = travelTicks + mineTicks + returnTicks;
            if (ticksUsed + totalNeeded > totalTicks) continue;

            // Energy simulation
            const sim = simulateEnergy(travelTicks + mineTicks, ticksUsed, travelTicks, mineTicks);
            if (sim.finalBattery <= 5) continue; // safety margin

            // Scoring: prefer closer minerals, penalize energy cost
            // Green > Yellow > Blue value
            const typeValue = m.type === CELL.GREEN ? 3 : m.type === CELL.YELLOW ? 2 : 1;
            const score = typeValue * 10 - steps * 0.5 + sim.finalBattery * 0.1;

            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
                bestPath = path;
            }
        }

        if (bestIdx === -1) break; // No reachable mineral

        const mineral = remaining[bestIdx];
        const steps = pathSteps(bestPath);
        const travelTicks = Math.ceil(steps / SPEED);

        // Add movement waypoints
        for (let i = 1; i < bestPath.length; i++) {
            fullPath.push({ x: bestPath[i].x, y: bestPath[i].y, action: 'move' });
        }
        // Add mining action
        fullPath.push({ x: mineral.x, y: mineral.y, action: 'mine', mineralType: mineral.type });

        // Update battery simulation
        const sim = simulateEnergy(travelTicks + 1, ticksUsed, travelTicks, 1);
        battery = sim.finalBattery;
        ticksUsed = sim.finalTick;
        curX = mineral.x;
        curY = mineral.y;

        collected.push(mineral);
        remaining.splice(bestIdx, 1);
    }

    // Return to start
    const returnPath = astar(map, curX, curY, startX, startY);
    if (returnPath && returnPath.length > 1) {
        for (let i = 1; i < returnPath.length; i++) {
            fullPath.push({ x: returnPath[i].x, y: returnPath[i].y, action: 'move' });
        }
    }
    fullPath.push({ x: startX, y: startY, action: 'return' });

    return { route: fullPath, plannedMinerals: collected };
}
