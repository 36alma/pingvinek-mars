/**
 * Zustand Store — Mars Rover Simulation State
 *
 * Route source priority:
 *   1. Backend GET /rover/route  → Go/Mining blocks with speedPlan
 *   2. Fallback: local A* planner (planRoute)
 *
 * Internal route format (flat waypoint list):
 *   { x, y, action: 'move'|'mine'|'return', mineralType?, speed?: 'SLOW'|'NORMAL'|'FAST' }
 *
 * The backend route is expanded into this flat format so the existing
 * simulationTick logic works with minimal changes.
 * The key change: 'move' waypoints now carry a `speed` field from speedPlan,
 * and energy is calculated from that speed instead of the global `speed` state.
 */
import { create } from 'zustand';
import { generateMap, findMinerals, CELL, MAP_SIZE, parseApiMap } from '../simulation/mapData';
import { planRoute } from '../simulation/pathfinding';

// ── Constants ────────────────────────────────────────
const BACKEND_URL = 'http://localhost:5000';
const CYCLE_TICKS = 48;   // 24 hours in ticks (1 tick = 30 min)
const DAY_TICKS = 32;     // 16 hours
const K = 2;              // energy constant  E = K * v^2
const SOLAR_CHARGE = 10;  // energy gained per tick during day
const STANDBY_DRAIN = 1;  // idle consumption per tick
const MINE_DRAIN = 2;     // mining consumption per tick
const TICK_INTERVAL_BASE = 400; // ms per tick at 1× speed

// Speed name → numeric value (matches backend MoveType enum)
const SPEED_VAL = { SLOW: 1, NORMAL: 2, FAST: 3 };

// ── Helpers ──────────────────────────────────────────
const isDaytime = (tick) => (tick % CYCLE_TICKS) < DAY_TICKS;
const marsHour = (tick) => (tick % CYCLE_TICKS) * 0.5;
const formatTime = (tick) => {
    const h = marsHour(tick);
    const hh = Math.floor(h).toString().padStart(2, '0');
    const mm = ((h % 1) * 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

/**
 * Convert backend /rover/route response into the flat internal waypoint format.
 *
 * Critically: we simulate the backend rover.time state step-by-step so that
 * each waypoint carries the *exact* drain and charge values the backend computed.
 * This prevents the frontend energy model from diverging.
 *
 * Backend energy rules (from rover.py):
 *   - @Time decorator: charge() then add_time() AFTER each action
 *   - charge(): if time in [0,16) → battery += 10
 *   - move drain: 2 * v²  (SLOW=1, NORMAL=2, FAST=3)
 *   - mine drain: 2
 *   - add_time(): time += 0.5, wraps at 24
 *
 * Each waypoint gets: { drain, charge } so simulationTick just applies them.
 */
function expandBackendRoute(blocks, map) {
    const flat = [];

    // Simulate backend rover.time starting at 0 (RoverService init)
    let simTime = 0;

    const stepTime = () => {
        // Mirrors @Time decorator: charge() then add_time()
        const chargeAmt = (simTime >= 0 && simTime < 16) ? 10 : 0;
        simTime += 0.5;
        if (simTime >= 24) simTime = 0;
        return chargeAmt;
    };

    for (const block of blocks) {
        const path = block.path;

        if (block.type === 'Go') {
            // Build per-edge speed array from speedPlan
            const edgeSpeeds = [];
            for (const s of (block.speedPlan || [])) {
                const steps = SPEED_VAL[s] || 1;
                for (let i = 0; i < steps; i++) edgeSpeeds.push(s);
            }

            for (let i = 1; i < path.length; i++) {
                const [x, y] = path[i];
                const speed = edgeSpeeds[i - 1] || 'NORMAL';
                const v = SPEED_VAL[speed] || 2;
                const drain = K * v * v;          // 2*v²
                const charge = stepTime();          // charge AFTER move
                flat.push({ x, y, action: 'move', speed, drain, charge });
            }

        } else if (block.type === 'Mining') {
            const [x, y] = path[0];
            const drain = MINE_DRAIN;              // 2
            const charge = stepTime();              // charge AFTER mine
            let mineralType = null;
            if (map && map[y] && map[y][x]) {
                const cell = map[y][x];
                if (cell === CELL.BLUE)   mineralType = 'B';
                else if (cell === CELL.YELLOW) mineralType = 'Y';
                else if (cell === CELL.GREEN)  mineralType = 'G';
            }
            flat.push({ x, y, action: 'mine', mineralType, drain, charge });
        }
    }

    if (flat.length > 0) flat[flat.length - 1].action = 'return';
    return flat;
}

// ── Initial State Factory ────────────────────────────
function createInitialState() {
    const { map, startX, startY } = generateMap(2026);
    const minerals = findMinerals(map);

    return {
        // Map
        map,
        startX,
        startY,
        minerals,
        collectedSet: new Set(),

        // Rover
        roverX: startX,
        roverY: startY,
        battery: 100,
        speed: 2,           // display speed (1=slow,2=normal,3=fast), overridden per-step by backend speedPlan
        inventory: { B: 0, Y: 0, G: 0 },
        totalDistance: 0,
        isMoving: false,
        isMining: false,

        // Simulation clock
        tick: 0,
        totalTimeHours: 48,
        isRunning: false,
        isFinished: false,
        simSpeed: 1,
        _intervalId: null,

        // Route
        route: [],           // flat waypoint array
        routeIdx: 0,
        plannedMinerals: [],
        routeSource: null,   // 'backend' | 'local' | null

        // Logs
        logs: [],
        logHistory: [],
    };
}

// ── Store ────────────────────────────────────────────
export const useStore = create((set, get) => ({
    ...createInitialState(),

    // ── Data Loading ──
    loadMapFromApi: async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/map/`, { signal: AbortSignal.timeout(2000) });
            if (!res.ok) throw new Error('Network response was not ok');
            const apiData = await res.json();

            if (!apiData.map || !apiData.rows || !apiData.cols) {
                throw new Error('Invalid API map format');
            }

            const { map, startX, startY } = parseApiMap(apiData);
            const minerals = findMinerals(map);
            set({ map, startX, startY, roverX: startX, roverY: startY, minerals });
            console.log('🗺️ Map loaded from API');
            return { source: 'api' };

        } catch (error) {
            console.warn('⚠️ API map fetch failed, using local fallback:', error.message);
            const { map, startX, startY } = generateMap();
            const minerals = findMinerals(map);
            set({ map, startX, startY, roverX: startX, roverY: startY, minerals });
            return { source: 'fallback' };
        }
    },

    // ── Computed-like accessors ──
    isDaytime: () => isDaytime(get().tick),
    getSol: () => Math.floor(get().tick / CYCLE_TICKS) + 1,
    getMarsTime: () => formatTime(get().tick),
    getTimeProgress: () => {
        const t = get();
        return Math.min(1, (t.tick * 0.5) / t.totalTimeHours);
    },
    getDayNightProgress: () => {
        const pos = get().tick % CYCLE_TICKS;
        if (pos < DAY_TICKS) return { phase: 'day', progress: pos / DAY_TICKS };
        return { phase: 'night', progress: (pos - DAY_TICKS) / (CYCLE_TICKS - DAY_TICKS) };
    },

    // ── Settings ──
    setTotalTime: (h) => set({ totalTimeHours: Math.max(24, h) }),

    // ── Route Generation ──

    /**
     * Fetch full mission route from backend GET /rover/route.
     * Returns expanded flat waypoints, or null on failure.
     */
    _fetchBackendRoute: async () => {
        try {
            const res = await fetch(
                `${BACKEND_URL}/rover/route`,
                { signal: AbortSignal.timeout(15000) }  // backend may take time (BFS + clustering)
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn('Backend route error:', err.detail || res.status);
                return null;
            }
            const blocks = await res.json();
            if (!Array.isArray(blocks) || blocks.length === 0) return null;

            // Validate basic structure
            for (const b of blocks) {
                if (!b.type || !Array.isArray(b.path)) return null;
            }

            return blocks;
        } catch (e) {
            console.warn('Backend route fetch failed:', e.message);
            return null;
        }
    },

    generateRoute: async () => {
        const s = get();
        get()._addLog('PLAN', '🔄 Útvonal tervezés folyamatban...');

        // 1. Try backend /rover/route (full mission plan)
        const blocks = await get()._fetchBackendRoute();
        if (blocks) {
            const route = expandBackendRoute(blocks, s.map);
            if (route.length > 0) {
                // Count planned mining steps
                const mineCount = route.filter(w => w.action === 'mine').length;
                set({ route, routeIdx: 0, plannedMinerals: [], routeSource: 'backend' });
                get()._addLog('PLAN', `✅ Backend útvonal: ${route.length} lépés, ${mineCount} bányászat (Go/Mining blokkok)`);
                return;
            }
        }

        // 2. Fallback: local A* planner
        get()._addLog('PLAN', '⚠️ Backend nem elérhető, helyi A* tervező...');
        const { route, plannedMinerals } = planRoute(s.map, s.startX, s.startY, s.minerals, s.totalTimeHours);
        set({ route, routeIdx: 0, plannedMinerals, routeSource: 'local' });
        get()._addLog('PLAN', `🗺️ Helyi A* útvonal: ${route.length} lépés, ${plannedMinerals.length} ásvány célpont`);
    },

    // ── Logging ──
    _addLog: (type, message) => {
        const s = get();
        const entry = {
            id: s.logs.length,
            tick: s.tick,
            time: formatTime(s.tick),
            sol: Math.floor(s.tick / CYCLE_TICKS) + 1,
            day: isDaytime(s.tick),
            x: s.roverX,
            y: s.roverY,
            battery: Math.round(s.battery * 10) / 10,
            speed: s.speed,
            distance: s.totalDistance,
            minerals: s.inventory.B + s.inventory.Y + s.inventory.G,
            inv: { ...s.inventory },
            type,
            message,
        };
        const logs = s.logs.length >= 200
            ? [...s.logs.slice(-199), entry]
            : [...s.logs, entry];
        set({ logs });
    },

    _addChartPoint: () => {
        const s = get();
        const cyclePos = s.tick % 48;
        const isDay = cyclePos < 32;
        const spd = s.speed;
        const consumed = s.isMining ? 2 : s.isMoving ? (2 * spd * spd) : 1;
        const solar = isDay ? 10 : 0;
        const point = {
            tick: s.tick,
            h: +(s.tick * 0.5).toFixed(1),
            battery: Math.round(s.battery),
            distance: s.totalDistance,
            B: s.inventory.B,
            Y: s.inventory.Y,
            G: s.inventory.G,
            total: s.inventory.B + s.inventory.Y + s.inventory.G,
            solar,
            consumed,
            isDay,
        };
        const logHistory = s.logHistory.length >= 300
            ? [...s.logHistory.slice(-299), point]
            : [...s.logHistory, point];
        set({ logHistory });
    },

    // ── Simulation Tick ──
    simulationTick: () => {
        const s = get();

        // Time limit
        if (s.tick >= s.totalTimeHours * 2) {
            get()._addLog('END', 'Időkeret lejárt!');
            get().stopSimulation();
            set({ isFinished: true });
            return;
        }

        const day = isDaytime(s.tick);
        let bat = s.battery;
        let x = s.roverX;
        let y = s.roverY;
        let dist = s.totalDistance;
        let inv = { ...s.inventory };
        let idx = s.routeIdx;
        let collected = new Set(s.collectedSet);
        let moving = false;
        let mining = false;
        let displaySpeed = s.speed;

        if (idx < s.route.length) {
            const wp = s.route[idx];

            if (wp.action === 'mine') {
                // ── Mining tick ──────────────────────────────
                mining = true;

                if (s.routeSource === 'backend') {
                    // Use pre-computed drain/charge from expandBackendRoute
                    bat -= wp.drain ?? MINE_DRAIN;
                    bat += wp.charge ?? 0;
                } else {
                    bat -= MINE_DRAIN;
                    if (day) bat += SOLAR_CHARGE;
                }
                bat = Math.min(100, Math.max(0, bat));

                if (wp.mineralType) {
                    inv[wp.mineralType] = (inv[wp.mineralType] || 0) + 1;
                    collected.add(`${wp.x},${wp.y}`);
                    get()._addLog('MINE', `⛏️ ${wp.mineralType} ásvány kibányászva (${wp.x}, ${wp.y})`);
                }
                idx++;

            } else {
                // ── Movement tick ─────────────────────────────
                moving = true;

                if (s.routeSource === 'backend') {
                    // Use pre-computed drain/charge — exactly mirrors backend rover.py
                    bat -= wp.drain ?? K * 4;
                    bat += wp.charge ?? 0;
                    bat = Math.min(100, Math.max(0, bat));
                    const v = wp.speed ? (SPEED_VAL[wp.speed] || 2) : 2;
                    displaySpeed = v;
                    x = wp.x;
                    y = wp.y;
                    dist++;
                    idx++;
                } else {
                    // Local A* route: advance `speed` waypoints per tick
                    const spd = s.speed;
                    displaySpeed = spd;
                    bat -= K * spd * spd;
                    if (day) bat += SOLAR_CHARGE;
                    bat = Math.min(100, Math.max(0, bat));
                    let steps = spd;
                    while (steps > 0 && idx < s.route.length) {
                        const w = s.route[idx];
                        if (w.action === 'mine') break;
                        x = w.x;
                        y = w.y;
                        dist++;
                        idx++;
                        steps--;
                    }
                }
            }
        } else {
            // Route done — standby
            bat -= STANDBY_DRAIN;
            if (day) bat += SOLAR_CHARGE;
            bat = Math.min(100, Math.max(0, bat));

            if (!s.isFinished) {
                get()._addLog('END', '🏁 Rover visszatért a kiindulópontra! Küldetés befejezve.');
                get().stopSimulation();
                set({ isFinished: true });
                return;
            }
        }

        // Battery death
        if (bat <= 0) {
            bat = 0;
            get()._addLog('DEAD', '🪫 Akkumulátor lemerült!');
            get().stopSimulation();
            set({ isFinished: true, battery: 0 });
            return;
        }

        set({
            tick: s.tick + 1,
            roverX: x,
            roverY: y,
            battery: bat,
            totalDistance: dist,
            inventory: inv,
            routeIdx: idx,
            collectedSet: collected,
            isMoving: moving,
            isMining: mining,
            speed: displaySpeed,
        });

        get()._addChartPoint();
    },

    // ── Simulation Controls ──
    startSimulation: async () => {
        const s = get();
        if (s.isRunning || s.isFinished) return;
        if (s.route.length === 0) await get().generateRoute();

        get()._addLog('START', `▶ Szimuláció indítva (${s.simSpeed}× sebesség)`);
        get()._addChartPoint();

        const ms = TICK_INTERVAL_BASE / s.simSpeed;
        const id = setInterval(() => get().simulationTick(), ms);
        set({ isRunning: true, _intervalId: id });
    },

    stopSimulation: () => {
        const s = get();
        if (s._intervalId) clearInterval(s._intervalId);
        set({ isRunning: false, _intervalId: null });
    },

    pauseSimulation: () => {
        get().stopSimulation();
        get()._addLog('PAUSE', '⏸ Szünetelve');
    },

    resetSimulation: () => {
        const s = get();
        if (s._intervalId) clearInterval(s._intervalId);
        set(createInitialState());
    },

    setSimSpeed: (speed) => {
        const s = get();
        set({ simSpeed: speed });
        if (s.isRunning) {
            if (s._intervalId) clearInterval(s._intervalId);
            const ms = TICK_INTERVAL_BASE / speed;
            const id = setInterval(() => get().simulationTick(), ms);
            set({ _intervalId: id });
        }
    },
}));