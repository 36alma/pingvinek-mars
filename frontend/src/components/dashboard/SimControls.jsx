import { useState } from 'react';
import { useStore } from '../../store/store';

export default function SimControls() {
    const isRunning = useStore((s) => s.isRunning);
    const isFinished = useStore((s) => s.isFinished);
    const simSpeed = useStore((s) => s.simSpeed);
    const totalTimeHours = useStore((s) => s.totalTimeHours);
    const route = useStore((s) => s.route);
    const start = useStore((s) => s.startSimulation);
    const pause = useStore((s) => s.pauseSimulation);
    const reset = useStore((s) => s.resetSimulation);
    const setSpeed = useStore((s) => s.setSimSpeed);
    const setTime = useStore((s) => s.setTotalTime);
    const genRoute = useStore((s) => s.generateRoute);

    const [timeVal, setTimeVal] = useState(totalTimeHours);

    return (
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
                    onChange={(e) => { const v = +e.target.value || 24; setTimeVal(v); setTime(v); }}
                />
            </div>

            {route.length === 0 && (
                <button className="btn btn-accent" onClick={genRoute} disabled={isRunning}>
                    🗺️ Útvonal tervezés (A*)
                </button>
            )}

            <div className="ctrl-buttons">
                {!isRunning ? (
                    <button className="btn btn-go" onClick={start} disabled={isFinished}>
                        {isFinished ? '✔ Kész' : '▶ Indítás'}
                    </button>
                ) : (
                    <button className="btn btn-warn" onClick={pause}>⏸ Szünet</button>
                )}
                <button className="btn btn-danger" onClick={reset}>↺ Reset</button>
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
    );
}
