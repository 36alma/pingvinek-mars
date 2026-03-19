import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/store';

// ── Result Modal ──────────────────────────────────────
function ResultModal({ reason, inventory, distance, onClose }) {
    const isSuccess = reason === 'success';
    const isDead    = reason === 'dead';

    const icon  = isSuccess ? '🏆' : isDead ? '🪫' : '⏱️';
    const title = isSuccess ? 'Küldetés teljesítve!'
                : isDead    ? 'Akkumulátor lemerült'
                :             'Időkeret lejárt';
    const color = isSuccess ? '#39ff14' : isDead ? '#ff1744' : '#ffc107';
    const desc  = isSuccess
        ? 'A rover sikeresen begyűjtötte az ásványokat és visszatért a bázisra.'
        : isDead
        ? 'A rover energiája elfogyott mielőtt visszaért volna a bázisra.'
        : 'A küldetés időkerete lejárt.';

    const total = inventory.B + inventory.Y + inventory.G;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box result-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="result-icon">{icon}</div>
                <h2 className="modal-title" style={{ color }}>{title}</h2>
                <p className="modal-desc">{desc}</p>

                <div className="result-stats">
                    <div className="result-stat">
                        <span className="result-stat-val" style={{ color: '#00cfff' }}>{inventory.B}</span>
                        <span className="result-stat-label">💎 Vízjég</span>
                    </div>
                    <div className="result-stat">
                        <span className="result-stat-val" style={{ color: '#ffcc00' }}>{inventory.Y}</span>
                        <span className="result-stat-label">🥇 Arany</span>
                    </div>
                    <div className="result-stat">
                        <span className="result-stat-val" style={{ color: '#00ff66' }}>{inventory.G}</span>
                        <span className="result-stat-label">🪨 Ritka</span>
                    </div>
                    <div className="result-stat">
                        <span className="result-stat-val" style={{ color: '#fff' }}>{total}</span>
                        <span className="result-stat-label">📦 Összes</span>
                    </div>
                </div>

                <div className="result-distance">
                    <span>Megtett út:</span>
                    <b>{distance} blokk</b>
                </div>

                <button className="btn btn-accent modal-btn" onClick={onClose}>
                    Bezárás
                </button>
            </div>
        </div>
    );
}

// ── Planning Modal ────────────────────────────────────
function PlanningModal({ isPlanning, isError, elapsed, onStart, onClose }) {
    return (
        <div className="modal-overlay" onClick={!isPlanning ? onClose : undefined}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-icon">
                    {isPlanning ? (
                        <div className="spinner" />
                    ) : isError ? (
                        <span style={{ fontSize: 40 }}>⚠️</span>
                    ) : (
                        <span className="modal-check">✓</span>
                    )}
                </div>
                <h2 className="modal-title" style={ isError ? { color: '#ff1744' } : {} }>
                    {isPlanning ? 'Útvonal tervezése...'
                     : isError  ? 'Nem sikerült az útvonal'
                     :            'Útvonal kész!'}
                </h2>
                <p className="modal-desc">
                    {isPlanning
                        ? `A backend BFS + clustering algoritmusa számítja az optimális útvonalat. Ez eltarthat 30-60 másodpercig.`
                        : isError
                        ? 'A backend nem adott vissza érvényes útvonalat. Ellenőrizd hogy a szerver fut-e, majd próbáld újra.'
                        : 'Az útvonal sikeresen megtervezve. A rover készen áll az indulásra.'}
                </p>
                {isPlanning && elapsed > 0 && (
                    <p style={{ fontSize: 11, color: '#555', margin: 0 }}>
                        Eltelt idő: {elapsed}s / max 90s
                    </p>
                )}
                {!isPlanning && !isError && (
                    <button className="btn btn-go modal-btn" onClick={onStart}>
                        ▶ Indulás
                    </button>
                )}
                {!isPlanning && isError && (
                    <button className="btn btn-accent modal-btn" onClick={onClose}>
                        Bezárás
                    </button>
                )}
                {isPlanning && (
                    <div className="modal-loading-bar">
                        <div className="modal-loading-fill" />
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────
export default function SimControls() {
    const isRunning      = useStore((s) => s.isRunning);
    const isFinished     = useStore((s) => s.isFinished);
    const finishReason   = useStore((s) => s.finishReason);
    const inventory      = useStore((s) => s.inventory);
    const distance       = useStore((s) => s.totalDistance);
    const simSpeed       = useStore((s) => s.simSpeed);
    const totalTimeHours = useStore((s) => s.totalTimeHours);
    const route          = useStore((s) => s.route);
    const start          = useStore((s) => s.startSimulation);
    const pause          = useStore((s) => s.pauseSimulation);
    const reset          = useStore((s) => s.resetSimulation);
    const setSpeed       = useStore((s) => s.setSimSpeed);
    const setTime        = useStore((s) => s.setTotalTime);
    const genRoute       = useStore((s) => s.generateRoute);

    const [timeVal, setTimeVal] = useState(48);
    const [showModal, setShowModal]     = useState(false);
    const [isPlanning, setIsPlanning]   = useState(false);
    const [routeReady, setRouteReady]   = useState(false);
    const [routeError, setRouteError]   = useState(false);
    const [planElapsed, setPlanElapsed] = useState(0);
    const [showResult, setShowResult]   = useState(false);
    const resetPending = useRef(false);

    // Auto-show result modal when simulation finishes
    useEffect(() => {
        if (isFinished && finishReason && !resetPending.current) {
            setShowResult(true);
        }
    }, [isFinished, finishReason]);

    const handleInditas = async () => {
        if (route.length > 0) {
            // Route already planned — start directly
            start();
            return;
        }
        // Open modal and start planning
        setShowModal(true);
        setIsPlanning(true);
        setRouteReady(false);
        setRouteError(false);
        const planStart = Date.now();
        const elapsedInterval = setInterval(() => {
            setPlanElapsed(Math.floor((Date.now() - planStart) / 1000));
        }, 1000);
        await genRoute();
        clearInterval(elapsedInterval);
        setIsPlanning(false);
        // Check if route was actually loaded
        const currentRoute = useStore.getState().route;
        if (!currentRoute || currentRoute.length === 0) {
            setRouteError(true);
        } else {
            setRouteReady(true);
        }
    };

    const handleModalStart = () => {
        setShowModal(false);
        start();
    };

    const handleModalClose = () => {
        setShowModal(false);
    };

    const handleReset = async () => {
        resetPending.current = true;
        setShowModal(false);
        setShowResult(false);
        setIsPlanning(false);
        setRouteReady(false);
        setRouteError(false);
        await reset();   // async: resets store + reloads backend map
        setTimeout(() => { resetPending.current = false; }, 100);
    };

    return (
        <>
            {/* Result modal */}
            {showResult && finishReason && (
                <ResultModal
                    reason={finishReason}
                    inventory={inventory}
                    distance={distance}
                    onClose={() => setShowResult(false)}
                />
            )}

            {/* Planning modal */}
            {showModal && (
                <PlanningModal
                    isPlanning={isPlanning}
                    isError={routeError}
                    elapsed={planElapsed}
                    onStart={handleModalStart}
                    onClose={handleModalClose}
                />
            )}

            <div className="widget controls-widget">
                <h3><span className="widget-icon">🎮</span> Szimuláció vezérlés</h3>

                <div className="ctrl-group">
                    <label>Időkeret (óra, min. 24)</label>
                    <input
                        type="number"
                        className="ctrl-input"
                        value={timeVal}
                        min={24}
                        max={240}
                        disabled={isRunning}
                        onChange={(e) => {
                            const v = Math.max(24, +e.target.value || 24);
                            setTimeVal(v);
                            setTime(v);
                        }}
                    />
                </div>

                <div className="ctrl-buttons">
                    {!isRunning ? (
                        <button
                            className="btn btn-go"
                            onClick={handleInditas}
                            disabled={isFinished || isPlanning}
                        >
                            {isFinished ? '✔ Kész' : '▶ Indítás'}
                        </button>
                    ) : (
                        <button className="btn btn-warn" onClick={pause}>⏸ Szünet</button>
                    )}
                    <button className="btn btn-danger" onClick={handleReset}>↺ Reset</button>
                </div>

                <div className="ctrl-group">
                    <label>Lejátszási sebesség</label>
                    <div className="speed-bar">
                        {[1, 2, 5, 10, 25].map((v) => (
                            <button
                                key={v}
                                className={`btn-spd ${simSpeed === v ? 'active' : ''}`}
                                onClick={() => setSpeed(v)}
                            >{v}×</button>
                        ))}
                    </div>
                </div>

                <div className="status-row">
                    <span className={`status-dot ${isRunning ? 'live' : isFinished ? 'done' : ''}`} />
                    <span className="status-text">
                        {isRunning ? 'Fut…' : isFinished ? 'Befejezve' : 'Készenáll'}
                    </span>
                </div>
            </div>
        </>
    );
}