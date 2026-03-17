import { useState } from 'react';
import { useStore } from '../../store/store';

// ── Planning Modal ────────────────────────────────────
function PlanningModal({ isPlanning, isReady, onStart, onClose }) {
    return (
        <div className="modal-overlay" onClick={!isPlanning ? onClose : undefined}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-icon">
                    {isPlanning ? (
                        <div className="spinner" />
                    ) : (
                        <span className="modal-check">✓</span>
                    )}
                </div>
                <h2 className="modal-title">
                    {isPlanning ? 'Útvonal tervezése...' : 'Útvonal kész!'}
                </h2>
                <p className="modal-desc">
                    {isPlanning
                        ? 'Az algoritmus kiszámolja az optimális útvonalat. Ez eltarthat néhány másodpercig.'
                        : 'Az útvonal sikeresen megtervezve. A rover készen áll az indulásra.'}
                </p>
                {!isPlanning && (
                    <button className="btn btn-go modal-btn" onClick={onStart}>
                        ▶ Indulás
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
    const isRunning  = useStore((s) => s.isRunning);
    const isFinished = useStore((s) => s.isFinished);
    const simSpeed   = useStore((s) => s.simSpeed);
    const route      = useStore((s) => s.route);
    const start      = useStore((s) => s.startSimulation);
    const pause      = useStore((s) => s.pauseSimulation);
    const reset      = useStore((s) => s.resetSimulation);
    const setSpeed   = useStore((s) => s.setSimSpeed);
    const genRoute   = useStore((s) => s.generateRoute);

    const [showModal, setShowModal]   = useState(false);
    const [isPlanning, setIsPlanning] = useState(false);
    const [routeReady, setRouteReady] = useState(false);

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
        await genRoute();
        setIsPlanning(false);
        setRouteReady(true);
    };

    const handleModalStart = () => {
        setShowModal(false);
        start();
    };

    const handleModalClose = () => {
        setShowModal(false);
    };

    const handleReset = () => {
        setShowModal(false);
        setIsPlanning(false);
        setRouteReady(false);
        reset();
    };

    return (
        <>
            {/* Modal */}
            {showModal && (
                <PlanningModal
                    isPlanning={isPlanning}
                    isReady={routeReady}
                    onStart={handleModalStart}
                    onClose={handleModalClose}
                />
            )}

            <div className="widget controls-widget">
                <h3><span className="widget-icon">🎮</span> Szimuláció vezérlés</h3>

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