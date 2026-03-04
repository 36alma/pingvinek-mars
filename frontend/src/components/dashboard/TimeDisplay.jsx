import { useStore } from '../../store/store';

export default function TimeDisplay() {
    const tick = useStore((s) => s.tick);
    const totalTimeHours = useStore((s) => s.totalTimeHours);

    const cyclePos = tick % 48;
    const isDay = cyclePos < 32;
    const sol = Math.floor(tick / 48) + 1;
    const elapsed = tick * 0.5;
    const progress = Math.min(100, Math.round((elapsed / totalTimeHours) * 100));

    const h = Math.floor((cyclePos * 0.5));
    const m = ((cyclePos * 0.5) % 1) * 60;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    const dayPct = isDay ? (cyclePos / 32) * 100 : 100;
    const nightPct = !isDay ? ((cyclePos - 32) / 16) * 100 : 0;

    return (
        <div className="widget time-widget">
            <h3><span className="widget-icon">{isDay ? '☀️' : '🌙'}</span> Mars idő</h3>

            <div className="time-top">
                <div className={`phase-badge ${isDay ? 'day' : 'night'}`}>
                    {isDay ? '☀ NAPPAL' : '🌙 ÉJSZAKA'}
                </div>
                <div className="clock">{timeStr}</div>
            </div>

            <div className="time-stats">
                <div className="ts"><span>Sol</span><b>{sol}</b></div>
                <div className="ts"><span>Eltelt</span><b>{elapsed.toFixed(1)}h</b></div>
                <div className="ts"><span>Összesen</span><b>{totalTimeHours}h</b></div>
            </div>

            {/* Day/night cycle bar */}
            <div className="cycle-strip">
                <div className="cycle-day" style={{ width: '66.7%' }}>
                    {isDay && <div className="cycle-dot" style={{ left: `${dayPct}%` }} />}
                </div>
                <div className="cycle-night" style={{ width: '33.3%' }}>
                    {!isDay && <div className="cycle-dot" style={{ left: `${nightPct}%` }} />}
                </div>
            </div>
            <div className="cycle-captions">
                <span>☀ 16 óra</span><span>🌙 8 óra</span>
            </div>

            {/* Global progress */}
            <div className="prog-bar"><div className="prog-fill" style={{ width: `${progress}%` }} /></div>
            <div className="prog-label">{progress}% befejezve</div>
        </div>
    );
}
