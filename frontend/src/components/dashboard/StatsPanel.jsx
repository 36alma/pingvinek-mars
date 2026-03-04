import { useStore } from '../../store/store';

export default function StatsPanel() {
    const x = useStore((s) => s.roverX);
    const y = useStore((s) => s.roverY);
    const speed = useStore((s) => s.speed);
    const dist = useStore((s) => s.totalDistance);
    const inv = useStore((s) => s.inventory);
    const route = useStore((s) => s.route);
    const idx = useStore((s) => s.routeIdx);

    const spdLabel = speed === 1 ? 'Lassú' : speed === 2 ? 'Normál' : 'Gyors';
    const total = inv.B + inv.Y + inv.G;
    const pct = route.length > 0 ? Math.round((idx / route.length) * 100) : 0;

    return (
        <div className="widget stats-widget">
            <h3><span className="widget-icon">📊</span> Rover adatok</h3>

            <div className="stat-grid">
                <div className="stat"><span className="sl">Pozíció</span><span className="sv">({x}, {y})</span></div>
                <div className="stat"><span className="sl">Sebesség</span><span className={`sv spd-${speed}`}>{spdLabel}</span></div>
                <div className="stat"><span className="sl">Megtett út</span><span className="sv">{dist} blk</span></div>
                <div className="stat"><span className="sl">Útvonal</span><span className="sv">{pct}%</span></div>
            </div>

            <h4>💎 Ásványok</h4>
            <div className="mineral-row">
                <div className="mcard blue">
                    <div className="mc-icon">💎</div>
                    <div className="mc-label">Vízjég</div>
                    <div className="mc-val">{inv.B}</div>
                </div>
                <div className="mcard yellow">
                    <div className="mc-icon">🥇</div>
                    <div className="mc-label">Arany</div>
                    <div className="mc-val">{inv.Y}</div>
                </div>
                <div className="mcard green">
                    <div className="mc-icon">🪨</div>
                    <div className="mc-label">Ritka</div>
                    <div className="mc-val">{inv.G}</div>
                </div>
            </div>
            <div className="mineral-total">Összesen: <b>{total}</b></div>
        </div>
    );
}
