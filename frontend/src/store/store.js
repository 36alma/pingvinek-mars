/**
 * Zustand Store — Mars Rover Simulation State
 *
 * Route source priority:
 *   1. Backend GET /rover/route  → { route, timeline, battery, time }
 *   2. Fallback: local A* planner (planRoute)
 *
 * Backend timeline: pre-computed step-by-step battery/position/time values.
 * The simulationTick directly replays these — no energy re-calculation needed.
 */
import { create } from 'zustand';
import { generateMap, findMinerals, CELL, MAP_SIZE, parseApiMap } from '../simulation/mapData';
import { planRoute } from '../simulation/pathfinding';

const BACKEND_URL        = 'http://localhost:5000';
const CYCLE_TICKS        = 48;
const DAY_TICKS          = 32;
const K                  = 2;
const SOLAR_CHARGE       = 10;
const STANDBY_DRAIN      = 1;
const MINE_DRAIN         = 2;
const TICK_INTERVAL_BASE = 400;
const SPEED_VAL          = { SLOW: 1, NORMAL: 2, FAST: 3 };

const isDaytime  = (tick) => (tick % CYCLE_TICKS) < DAY_TICKS;
const marsHour   = (tick) => (tick % CYCLE_TICKS) * 0.5;
const formatTime = (tick) => {
    const h  = marsHour(tick);
    const hh = Math.floor(h).toString().padStart(2, '0');
    const mm = ((h % 1) * 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

/**
 * Expand backend route blocks into flat waypoints.
 * NEW API: { route:[...blocks], timeline:[...steps], battery, time }
 *
 * Each waypoint: { x, y, action, speed?, mineralType?, timelineIdx? }
 * timelineIdx points into the backend timeline array for exact battery replay.
 */
function expandBackendRoute(blocks, timeline, map) {
    const waypoints = [];
    let tlIdx = 0;   // index into backend timeline array

    for (const block of blocks) {
        const path = block.path;

        if (block.type === 'Go') {
            const speedPlan = block.speedPlan || [];

            // Build per-edge speed array
            const edgeSpeeds = [];
            for (const s of speedPlan) {
                const steps = SPEED_VAL[s] || 1;
                for (let i = 0; i < steps; i++) edgeSpeeds.push(s);
            }

            // One waypoint per edge (path[i] → path[i+1])
            for (let i = 1; i < path.length; i++) {
                const [x, y] = path[i];
                const speed  = edgeSpeeds[i - 1] || 'NORMAL';
                waypoints.push({ x, y, action: 'move', speed, timelineIdx: null });
            }

            // Tag the last waypoint of each speedPlan segment with its timeline index
            let edgePos = 0;
            const baseWpIdx = waypoints.length - (path.length - 1);
            for (let si = 0; si < speedPlan.length; si++) {
                edgePos += SPEED_VAL[speedPlan[si]] || 1;
                const wpIdx = baseWpIdx + edgePos - 1;
                if (wpIdx >= 0 && wpIdx < waypoints.length) {
                    waypoints[wpIdx].timelineIdx = tlIdx;
                }
                tlIdx++;
            }

        } else if (block.type === 'Mining') {
            const [x, y] = block.path[block.path.length - 1];
            let mineralType = null;
            if (map && map[y] && map[y][x]) {
                const cell = map[y][x];
                if      (cell === CELL.BLUE)   mineralType = 'B';
                else if (cell === CELL.YELLOW) mineralType = 'Y';
                else if (cell === CELL.GREEN)  mineralType = 'G';
            }
            waypoints.push({ x, y, action: 'mine', mineralType, timelineIdx: tlIdx });
            tlIdx++;
        }
    }

    if (waypoints.length > 0) waypoints[waypoints.length - 1].action = 'return';
    return waypoints;
}

function createInitialState() {
    const { map, startX, startY } = generateMap(2026);
    const minerals = findMinerals(map);
    return {
        map, startX, startY, minerals,
        collectedSet:    new Set(),
        roverX:          startX,
        roverY:          startY,
        battery:         100,
        speed:           2,
        inventory:       { B: 0, Y: 0, G: 0 },
        totalDistance:   0,
        isMoving:        false,
        isMining:        false,
        tick:            0,
        totalTimeHours:  48,
        isRunning:       false,
        isFinished:      false,
        simSpeed:        1,
        _intervalId:     null,
        route:           [],
        routeIdx:        0,
        plannedMinerals: [],
        routeSource:     null,
        backendTimeline: [],
        logs:            [],
        logHistory:      [],
    };
}

export const useStore = create((set, get) => ({
    ...createInitialState(),

    // ── Map loading ──────────────────────────────────
    loadMapFromApi: async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/map/`, { signal: AbortSignal.timeout(2000) });
            if (!res.ok) throw new Error('not ok');
            const apiData = await res.json();
            if (!apiData.map || !apiData.rows || !apiData.cols) throw new Error('bad format');
            const { map, startX, startY } = parseApiMap(apiData);
            const minerals = findMinerals(map);
            set({ map, startX, startY, roverX: startX, roverY: startY, minerals });
            return { source: 'api' };
        } catch {
            const { map, startX, startY } = generateMap();
            const minerals = findMinerals(map);
            set({ map, startX, startY, roverX: startX, roverY: startY, minerals });
            return { source: 'fallback' };
        }
    },

    // ── Computed ─────────────────────────────────────
    isDaytime:           () => isDaytime(get().tick),
    getSol:              () => Math.floor(get().tick / CYCLE_TICKS) + 1,
    getMarsTime:         () => formatTime(get().tick),
    getTimeProgress:     () => Math.min(1, (get().tick * 0.5) / get().totalTimeHours),
    getDayNightProgress: () => {
        const pos = get().tick % CYCLE_TICKS;
        if (pos < DAY_TICKS) return { phase: 'day',   progress: pos / DAY_TICKS };
        return                      { phase: 'night', progress: (pos - DAY_TICKS) / (CYCLE_TICKS - DAY_TICKS) };
    },

    setTotalTime: (h) => set({ totalTimeHours: Math.max(24, h) }),

    // ── Route generation ─────────────────────────────
    _fetchBackendRoute: async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/rover/route`,
                { signal: AbortSignal.timeout(30000) });
            if (!res.ok) return null;
            const data = await res.json();
            // New format: { route, timeline, battery, time }
            if (data && Array.isArray(data.route)) return data;
            // Old format fallback: plain array
            if (Array.isArray(data)) return { route: data, timeline: [], battery: null, time: null };
            return null;
        } catch (e) {
            console.warn('Backend route fetch failed:', e.message);
            return null;
        }
    },

    generateRoute: async () => {
        const s = get();
        get()._addLog('PLAN', 'Utvonal tervezes...');

        const data = await get()._fetchBackendRoute();
        if (data && Array.isArray(data.route) && data.route.length > 0) {
            const waypoints = expandBackendRoute(data.route, data.timeline || [], s.map);
            if (waypoints.length > 0) {
                const mineCount = waypoints.filter(w => w.action === 'mine').length;
                // Set time limit to cover the full route + 20% buffer
                // 1 tick = 0.5 mars hour, so ticks * 0.5 = hours
                const neededHours = Math.ceil((waypoints.length * 0.5) * 1.2);
                set({
                    route:           waypoints,
                    routeIdx:        0,
                    plannedMinerals: [],
                    routeSource:     'backend',
                    backendTimeline: data.timeline || [],
                    totalTimeHours:  Math.max(neededHours, 48),
                });
                get()._addLog('PLAN', `[OK] Backend: ${waypoints.length} lepes, ${mineCount} banyaszat (Go/Mining)`);
                return;
            }
        }

        get()._addLog('PLAN', 'Backend nem elerheto — helyi A*...');
        const { route, plannedMinerals } = planRoute(s.map, s.startX, s.startY, s.minerals, s.totalTimeHours);
        set({ route, routeIdx: 0, plannedMinerals, routeSource: 'local', backendTimeline: [] });
        get()._addLog('PLAN', `[OK] Helyi A*: ${route.length} lepes, ${plannedMinerals.length} asvany`);
    },

    // ── Logging ──────────────────────────────────────
    _addLog: (type, message) => {
        const s = get();
        const entry = {
            id: s.logs.length, tick: s.tick,
            time: formatTime(s.tick),
            sol:  Math.floor(s.tick / CYCLE_TICKS) + 1,
            day:  isDaytime(s.tick),
            x: s.roverX, y: s.roverY,
            battery:  Math.round(s.battery * 10) / 10,
            speed:    s.speed,
            distance: s.totalDistance,
            minerals: s.inventory.B + s.inventory.Y + s.inventory.G,
            inv: { ...s.inventory }, type, message,
        };
        const logs = s.logs.length >= 200
            ? [...s.logs.slice(-199), entry] : [...s.logs, entry];
        set({ logs });
    },

    _addChartPoint: () => {
        const s   = get();
        const isDay   = (s.tick % 48) < 32;
        const spd     = s.speed;
        const consumed = s.isMining ? 2 : s.isMoving ? (2 * spd * spd) : 1;
        const point   = {
            tick: s.tick, h: +(s.tick * 0.5).toFixed(1),
            battery: Math.round(s.battery), distance: s.totalDistance,
            B: s.inventory.B, Y: s.inventory.Y, G: s.inventory.G,
            total: s.inventory.B + s.inventory.Y + s.inventory.G,
            solar: isDay ? 10 : 0, consumed, isDay,
        };
        const logHistory = s.logHistory.length >= 300
            ? [...s.logHistory.slice(-299), point] : [...s.logHistory, point];
        set({ logHistory });
    },

    // ── Simulation tick ───────────────────────────────
    simulationTick: () => {
        const s = get();

        // Only enforce time limit for local A* routes
        // Backend routes run until completion (route done or battery dead)
        if (s.routeSource !== 'backend' && s.tick >= s.totalTimeHours * 2) {
            get()._addLog('END', 'Idokeret lejart!');
            get().stopSimulation();
            set({ isFinished: true });
            return;
        }

        const day  = isDaytime(s.tick);
        let bat    = s.battery;
        let x = s.roverX, y = s.roverY;
        let dist   = s.totalDistance;
        let inv    = { ...s.inventory };
        let idx    = s.routeIdx;
        let collected   = new Set(s.collectedSet);
        let moving = false, mining = false;
        let displaySpeed = s.speed;

        if (idx < s.route.length) {
            const wp = s.route[idx];

            // ── Backend: use pre-computed timeline battery if available ──
            const useTimeline = s.routeSource === 'backend'
                && wp.timelineIdx != null
                && s.backendTimeline[wp.timelineIdx] != null;

            if (wp.action === 'mine') {
                mining = true;
                if (useTimeline) {
                    bat = s.backendTimeline[wp.timelineIdx].battery;
                } else {
                    bat -= MINE_DRAIN;
                    if (day) bat += SOLAR_CHARGE;
                    bat = Math.min(100, Math.max(0, bat));
                }
                x = wp.x; y = wp.y;
                if (wp.mineralType) {
                    inv[wp.mineralType] = (inv[wp.mineralType] || 0) + 1;
                    collected.add(`${wp.x},${wp.y}`);
                    get()._addLog('MINE', `Asvany: ${wp.mineralType} (${wp.x},${wp.y})`);
                }
                idx++;

            } else {
                moving = true;
                if (s.routeSource === 'backend') {
                    const v   = wp.speed ? (SPEED_VAL[wp.speed] || 2) : 2;
                    displaySpeed = v;
                    if (useTimeline) {
                        bat = s.backendTimeline[wp.timelineIdx].battery;
                    } else {
                        bat -= K * v * v;
                        if (day) bat += SOLAR_CHARGE;
                        bat = Math.min(100, Math.max(0, bat));
                    }
                    x = wp.x; y = wp.y; dist++; idx++;
                } else {
                    // Local A*: advance `speed` waypoints per tick
                    const spd = s.speed;
                    displaySpeed = spd;
                    bat -= K * spd * spd;
                    if (day) bat += SOLAR_CHARGE;
                    bat = Math.min(100, Math.max(0, bat));
                    let steps = spd;
                    while (steps > 0 && idx < s.route.length) {
                        const w = s.route[idx];
                        if (w.action === 'mine') break;
                        x = w.x; y = w.y; dist++; idx++; steps--;
                    }
                }
            }
        } else {
            bat -= STANDBY_DRAIN;
            if (day) bat += SOLAR_CHARGE;
            bat = Math.min(100, Math.max(0, bat));
            if (!s.isFinished) {
                get()._addLog('END', 'Rover hazaert! Kuldetés befejezve.');
                get().stopSimulation();
                set({ isFinished: true });
                return;
            }
        }

        if (bat <= 0) {
            bat = 0;
            get()._addLog('DEAD', 'Akkumulator lemerult!');
            get().stopSimulation();
            set({ isFinished: true, battery: 0 });
            return;
        }

        set({
            tick: s.tick + 1, roverX: x, roverY: y,
            battery: bat, totalDistance: dist,
            inventory: inv, routeIdx: idx,
            collectedSet: collected,
            isMoving: moving, isMining: mining,
            speed: displaySpeed,
        });
        get()._addChartPoint();
    },

    // ── Simulation controls ───────────────────────────
    startSimulation: async () => {
        const s = get();
        if (s.isRunning || s.isFinished) return;
        if (s.route.length === 0) await get().generateRoute();
        get()._addLog('START', `Szimulaciо inditva (${s.simSpeed}x)`);
        get()._addChartPoint();
        const id = setInterval(() => get().simulationTick(), TICK_INTERVAL_BASE / s.simSpeed);
        set({ isRunning: true, _intervalId: id });
    },

    stopSimulation: () => {
        const s = get();
        if (s._intervalId) clearInterval(s._intervalId);
        set({ isRunning: false, _intervalId: null });
    },

    pauseSimulation: () => { get().stopSimulation(); get()._addLog('PAUSE', 'Szunetelve'); },

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
            const id = setInterval(() => get().simulationTick(), TICK_INTERVAL_BASE / speed);
            set({ _intervalId: id });
        }
    },
}));