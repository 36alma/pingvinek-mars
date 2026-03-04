/**
 * Mars Map Data Generator
 * Generates a 50×50 grid with obstacles, minerals, and start position.
 */

export const CELL = {
    EMPTY: '.',
    OBSTACLE: '#',
    BLUE: 'B',
    YELLOW: 'Y',
    GREEN: 'G',
    START: 'S',
};

export const MINERAL_NAMES = {
    B: 'Vízjég',
    Y: 'Arany',
    G: 'Ritka ásvány',
};

export const MAP_SIZE = 50;

/**
 * Seeded pseudo-random number generator (mulberry32)
 */
function createRNG(seed) {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Generate a 50×50 Mars map
 */
export function generateMap(seed = 2026) {
    const rand = createRNG(seed);
    const map = [];

    for (let y = 0; y < MAP_SIZE; y++) {
        const row = [];
        for (let x = 0; x < MAP_SIZE; x++) {
            row.push(CELL.EMPTY);
        }
        map.push(row);
    }

    // Start position near center
    const startX = 25;
    const startY = 25;
    map[startY][startX] = CELL.START;

    // Clear area around start (radius 3)
    const clearRadius = 3;

    // Generate obstacle clusters for realistic Mars terrain
    // Large rock formations
    for (let c = 0; c < 20; c++) {
        const cx = Math.floor(rand() * (MAP_SIZE - 8)) + 4;
        const cy = Math.floor(rand() * (MAP_SIZE - 8)) + 4;
        const clusterSize = Math.floor(rand() * 4) + 2;

        for (let i = 0; i < clusterSize * 3; i++) {
            const ox = cx + Math.floor(rand() * clusterSize * 2) - clusterSize;
            const oy = cy + Math.floor(rand() * clusterSize * 2) - clusterSize;
            if (ox >= 0 && ox < MAP_SIZE && oy >= 0 && oy < MAP_SIZE) {
                if (Math.abs(ox - startX) > clearRadius || Math.abs(oy - startY) > clearRadius) {
                    if (map[oy][ox] === CELL.EMPTY) {
                        map[oy][ox] = CELL.OBSTACLE;
                    }
                }
            }
        }
    }

    // Scattered individual rocks
    for (let i = 0; i < 180; i++) {
        const x = Math.floor(rand() * MAP_SIZE);
        const y = Math.floor(rand() * MAP_SIZE);
        if (map[y][x] === CELL.EMPTY) {
            if (Math.abs(x - startX) > clearRadius || Math.abs(y - startY) > clearRadius) {
                map[y][x] = CELL.OBSTACLE;
            }
        }
    }

    // Place minerals with some clustering tendency
    const placeMineralGroup = (type, count) => {
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < 2000) {
            const x = Math.floor(rand() * MAP_SIZE);
            const y = Math.floor(rand() * MAP_SIZE);
            if (map[y][x] === CELL.EMPTY) {
                map[y][x] = type;
                placed++;
                // Sometimes place a neighbor too
                if (rand() < 0.3 && placed < count) {
                    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                    const d = dirs[Math.floor(rand() * 4)];
                    const nx = x + d[0], ny = y + d[1];
                    if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE && map[ny][nx] === CELL.EMPTY) {
                        map[ny][nx] = type;
                        placed++;
                    }
                }
            }
            attempts++;
        }
    };

    placeMineralGroup(CELL.BLUE, 22);
    placeMineralGroup(CELL.YELLOW, 14);
    placeMineralGroup(CELL.GREEN, 8);

    return { map, startX, startY };
}

/**
 * Extract mineral positions from map
 */
export function findMinerals(map) {
    const minerals = [];
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < map[y].length; x++) {
            const c = map[y][x];
            if (c === CELL.BLUE || c === CELL.YELLOW || c === CELL.GREEN) {
                minerals.push({ x, y, type: c });
            }
        }
    }
    return minerals;
}
