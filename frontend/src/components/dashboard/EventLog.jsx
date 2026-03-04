import { useRef, useEffect } from 'react';
import { useStore } from '../../store/store';

const TYPE_STYLE = {
    START: { color: '#39ff14', icon: '🚀' },
    END: { color: '#00cfff', icon: '🏁' },
    PAUSE: { color: '#ffc107', icon: '⏸' },
    PLAN: { color: '#aa88ff', icon: '🗺' },
    MOVE: { color: '#6688aa', icon: '→' },
    MINE: { color: '#ffcc00', icon: '⛏' },
    DEAD: { color: '#ff1744', icon: '🪫' },
};

export default function EventLog() {
    const logs = useStore((s) => s.logs);
    const ref = useRef();

    useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [logs.length]);

    // Show all non-MOVE logs, plus every 6th MOVE
    const visible = logs.filter((l, i) => l.type !== 'MOVE' || i % 6 === 0).slice(-60);

    return (
        <div className="widget log-widget">
            <h3><span className="widget-icon">📝</span> Eseménynapló</h3>
            <div className="log-scroll" ref={ref}>
                {visible.length === 0 && (
                    <div className="log-empty">Indítsd el a szimulációt az események megjelenítéséhez.</div>
                )}
                {visible.map((l) => {
                    const s = TYPE_STYLE[l.type] || { color: '#666', icon: '•' };
                    return (
                        <div key={l.id} className="log-row" style={{ borderLeftColor: s.color }}>
                            <div className="log-head">
                                <span className="log-ico">{s.icon}</span>
                                <span className="log-ts">{l.time} Sol {l.sol}</span>
                                <span className="log-dn">{l.day ? '☀' : '🌙'}</span>
                            </div>
                            <div className="log-msg">{l.message}</div>
                            <div className="log-meta">📍({l.x},{l.y})  🔋{l.battery}%  📏{l.distance}blk</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
