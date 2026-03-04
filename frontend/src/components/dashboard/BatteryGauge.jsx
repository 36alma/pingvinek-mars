import { useStore } from '../../store/store';

export default function BatteryGauge() {
    const battery = useStore((s) => s.battery);

    const color =
        battery > 60 ? '#39ff14' :
            battery > 30 ? '#ffc107' :
                battery > 10 ? '#ff6f00' : '#ff1744';

    const r = 48;
    const circ = 2 * Math.PI * r;
    const offset = circ - (battery / 100) * circ;

    return (
        <div className="widget battery-widget">
            <h3><span className="widget-icon">⚡</span> Akkumulátor</h3>
            <div className="battery-body">
                <svg viewBox="0 0 110 110" className="battery-svg">
                    <circle cx="55" cy="55" r={r} fill="none" stroke="#1e1e32" strokeWidth="7" />
                    <circle
                        cx="55" cy="55" r={r}
                        fill="none"
                        stroke={color}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        transform="rotate(-90 55 55)"
                        style={{ transition: 'stroke-dashoffset .35s ease, stroke .35s', filter: `drop-shadow(0 0 5px ${color})` }}
                    />
                    <text x="55" y="50" textAnchor="middle" fill={color} fontSize="22" fontWeight="700" fontFamily="'Orbitron',monospace">{Math.round(battery)}</text>
                    <text x="55" y="68" textAnchor="middle" fill="#666" fontSize="11" fontFamily="'Orbitron',monospace">%</text>
                </svg>

                <div className="battery-bar-wrap">
                    <div className="battery-bar" style={{ width: `${battery}%`, background: color, boxShadow: `0 0 8px ${color}40` }} />
                </div>

                <div className="battery-legend">
                    <span>0</span><span>50</span><span>100</span>
                </div>
            </div>
        </div>
    );
}
