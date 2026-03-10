/**
 * Zustand Store — Mars Rover Simulation State
 *
 * Manages: map, rover, simulation clock, battery, route, event log.
 */
import { create } from 'zustand';
import { generateMap, findMinerals, parseApiMap, CELL, MAP_SIZE } from '../simulation/mapData';
import { planRoute } from '../simulation/pathfinding';

// ── Constants ────────────────────────────────────────
const CYCLE_TICKS = 48;
const DAY_TICKS = 32;
const K = 2;
const SOLAR_CHARGE = 10;
const STANDBY_DRAIN = 1;
const MINE_DRAIN = 2;
const TICK_INTERVAL_BASE = 400;

const BACKEND_URL = 'http://localhost:5000';

// ── Helpers ──────────────────────────────────────────
const isDaytime = (tick) => (tick % CYCLE_TICKS) < DAY_TICKS;
const marsHour = (tick) => {
    const pos = tick % CYCLE_TICKS;
    return pos * 0.5; // 0 – 24
};
const formatTime = (tick) => {
    const h = marsHour(tick);
    const hh = Math.floor(h).toString().padStart(2, '0');
    const mm = ((h % 1) * 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

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
        speed: 2,
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
        route: [],
        routeIdx: 0,
        plannedMinerals: [],

        // Logs (each entry recorded every tick while running)
        logs: [],
        logHistory: [], // condensed for charts: {tick, battery, distance, minerals}

        // API state
        mapLoaded: false,
        mapSource: 'local', // 'api' | 'local'
    };
}

// ── Store ────────────────────────────────────────────
export const useStore = create((set, get) => ({
    ...createInitialState(),

    // ── API map loader ──
    loadMapFromApi: async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/map/`, {
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const { map, startX, startY } = parseApiMap(data);
            const minerals = findMinerals(map);
            set({
                map, startX, startY, minerals,
                roverX: startX, roverY: startY,
                mapLoaded: true, mapSource: 'api',
            });
            return { ok: true, source: 'api' };
        } catch (err) {
            console.warn('[Map] API nem elérhető, helyi térkép használata:', err.message);
            set({ mapLoaded: true, mapSource: 'local' });
            return { ok: false, source: 'local' };
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
    generateRoute: () => {
        const s = get();
        const { route, plannedMinerals } = planRoute(s.map, s.startX, s.startY, s.minerals, s.totalTimeHours);
        set({ route, routeIdx: 0, plannedMinerals });
        get()._addLog('PLAN', `Útvonal megtervezve: ${route.length} lépés, ${plannedMinerals.length} ásvány célpont`);
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
        // Cap logs at 200 to prevent memory growth
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
        // Approximate energy this tick
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
        // Cap chart history at 300 points
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

        if (idx < s.route.length) {
            const wp = s.route[idx];

            if (wp.action === 'mine') {
                // Mining tick
                bat -= MINE_DRAIN;
                if (day) bat += SOLAR_CHARGE;
                bat = Math.min(100, Math.max(0, bat));
                mining = true;

                if (wp.mineralType) {
                    inv[wp.mineralType] = (inv[wp.mineralType] || 0) + 1;
                    collected.add(`${wp.x},${wp.y}`);
                }
                idx++;
                get()._addLog('MINE', `⛏️ ${wp.mineralType} ásvány kibányászva (${wp.x}, ${wp.y})`);

            } else {
                // Movement tick — move up to `speed` waypoints
                const spd = s.speed;
                bat -= K * spd * spd;
                if (day) bat += SOLAR_CHARGE;
                bat = Math.min(100, Math.max(0, bat));
                moving = true;

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
        } else {
            // Route done
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
        });

        // Chart data every tick
        get()._addChartPoint();
    },

    // ── Simulation Controls ──
    startSimulation: () => {
        const s = get();
        if (s.isRunning || s.isFinished) return;
        if (s.route.length === 0) get().generateRoute();

        get()._addLog('START', `▶ Szimuláció indítva (${s.simSpeed}× sebesség)`);
        get()._addChartPoint(); // initial point

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
        // Reload map from API after reset
        get().loadMapFromApi();
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