import { useMemo } from 'react';
import { useStore } from '../../store/store';

function ScoreBar({ label, value, max, color, unit = '' }) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return (
        <div className="ms-bar-row">
            <div className="ms-bar-head">
                <span className="ms-bar-label">{label}</span>
                <span className="ms-bar-val" style={{ color }}>{value}{unit} <span className="ms-bar-pct">/ {max}{unit}</span></span>
            </div>
            <div className="ms-bar-track">
                <div className="ms-bar-fill" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }} />
            </div>
        </div>
    );
}

function Grade({ score }) {
    if (score >= 90) return { letter: 'S', color: '#ffcc00', label: 'Kiváló' };
    if (score >= 75) return { letter: 'A', color: '#39ff14', label: 'Jó' };
    if (score >= 55) return { letter: 'B', color: '#00cfff', label: 'Átlagos' };
    if (score >= 35) return { letter: 'C', color: '#ffc107', label: 'Gyenge' };
    return { letter: 'D', color: '#ff4444', label: 'Rossz' };
}

export default function MissionScore() {
    const inventory       = useStore((s) => s.inventory);
    const plannedMinerals = useStore((s) => s.plannedMinerals);
    const collectedSet    = useStore((s) => s.collectedSet);
    const totalDistance   = useStore((s) => s.totalDistance);
    const route           = useStore((s) => s.route);
    const battery         = useStore((s) => s.battery);
    const tick            = useStore((s) => s.tick);
    const totalTimeHours  = useStore((s) => s.totalTimeHours);
    const isFinished      = useStore((s) => s.isFinished);
    const logHistory      = useStore((s) => s.logHistory);

    const scores = useMemo(() => {
        const totalMinerals  = inventory.B + inventory.Y + inventory.G;
        const plannedCount   = plannedMinerals.length;
        const collectedCount = collectedSet.size;

        // 1. Bányászati hatékonyság (0–100): begyűjtött / tervezett
        const miningScore = plannedCount > 0
            ? Math.round((collectedCount / plannedCount) * 100)
            : 0;

        // 2. Energiahatékonyság (0–100): minél kevesebb fogyasztás / megtett úthoz
        const totalConsumed = logHistory.reduce((a, p) => a + (p.consumed ?? 0), 0);
        const energyScore = totalDistance > 0 && totalConsumed > 0
            ? Math.min(100, Math.round((totalDistance / totalConsumed) * 100))
            : 0;

        // 3. Akkumulátor kezelés (0–100): mennyire maradt töltve
        const avgBattery = logHistory.length > 0
            ? Math.round(logHistory.reduce((a, p) => a + p.battery, 0) / logHistory.length)
            : 100;
        const batteryScore = avgBattery;

        // 4. Időkihasználás (0–100): minél több ásványt szedett az idő arányában
        const elapsed = tick * 0.5;
        const timeScore = elapsed > 0 && totalTimeHours > 0
            ? Math.min(100, Math.round((totalMinerals / Math.max(1, elapsed / 4)) * 100))
            : 0;

        // Összpontszám: súlyozott átlag
        const total = Math.round(
            miningScore  * 0.35 +
            energyScore  * 0.25 +
            batteryScore * 0.25 +
            timeScore    * 0.15
        );

        return { miningScore, energyScore, batteryScore, timeScore, total, totalMinerals, plannedCount, collectedCount };
    }, [inventory, plannedMinerals, collectedSet, totalDistance, battery, tick, totalTimeHours, logHistory]);

    const grade = Grade({ score: scores.total });
    const hasData = logHistory.length > 0;

    return (
        <div className="widget mission-score-widget">
            <h3><span className="widget-icon">🏆</span> Misszió értékelés</h3>

            {!hasData ? (
                <div className="chart-empty">Indítsd el a szimulációt az értékelés megjelenítéséhez.</div>
            ) : (
                <>
                    {/* Grade display */}
                    <div className="ms-grade-row">
                        <div className="ms-grade-box" style={{ borderColor: grade.color, boxShadow: `0 0 16px ${grade.color}40` }}>
                            <span className="ms-grade-letter" style={{ color: grade.color }}>{grade.letter}</span>
                        </div>
                        <div className="ms-grade-info">
                            <div className="ms-grade-label" style={{ color: grade.color }}>{grade.label}</div>
                            <div className="ms-grade-score">{scores.total} / 100 pont</div>
                            <div className="ms-grade-status">
                                {isFinished ? '✅ Misszió befejezve' : '🔄 Folyamatban...'}
                            </div>
                        </div>
                    </div>

                    {/* Score bars */}
                    <div className="ms-bars">
                        <ScoreBar
                            label="⛏ Bányászati hatékonyság"
                            value={scores.collectedCount}
                            max={Math.max(1, scores.plannedCount)}
                            color="#ffcc00"
                            unit=" db"
                        />
                        <ScoreBar
                            label="⚡ Energia hatékonyság"
                            value={scores.energyScore}
                            max={100}
                            color="#39ff14"
                            unit=" pt"
                        />
                        <ScoreBar
                            label="🔋 Akkumulátor kezelés"
                            value={scores.batteryScore}
                            max={100}
                            color="#00cfff"
                            unit="%"
                        />
                        <ScoreBar
                            label="⏱ Időkihasználás"
                            value={scores.timeScore}
                            max={100}
                            color="#ff9100"
                            unit=" pt"
                        />
                    </div>

                    {/* Mini summary */}
                    <div className="ms-summary">
                        <div className="ms-sum-item">
                            <span>💎 Begyűjtött</span>
                            <b>{scores.totalMinerals} db</b>
                        </div>
                        <div className="ms-sum-item">
                            <span>🎯 Célpont</span>
                            <b>{scores.plannedCount} db</b>
                        </div>
                        <div className="ms-sum-item">
                            <span>📏 Út</span>
                            <b>{totalDistance} blk</b>
                        </div>
                        <div className="ms-sum-item">
                            <span>⏳ Eltelt</span>
                            <b>{(tick * 0.5).toFixed(1)}h</b>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}