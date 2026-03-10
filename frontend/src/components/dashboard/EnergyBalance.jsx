import { useMemo } from 'react';
import { useStore } from '../../store/store';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const TT = {
    contentStyle: {
        background: '#16162a',
        border: '1px solid #2a2a50',
        borderRadius: 8,
        fontSize: 11,
        color: '#ccc',
    },
};

// Aggregate energy per Sol (48 ticks = 1 sol)
function aggregateBySol(logHistory) {
    const sols = {};
    for (const p of logHistory) {
        const sol = Math.floor(p.tick / 48) + 1;
        if (!sols[sol]) sols[sol] = { sol, solar: 0, consumed: 0 };
        sols[sol].solar    += p.solar    ?? 0;
        sols[sol].consumed += p.consumed ?? 0;
    }
    return Object.values(sols).map(s => ({
        ...s,
        balance: s.solar - s.consumed,
    }));
}

export default function EnergyBalance() {
    const logHistory   = useStore((s) => s.logHistory);
    const tick         = useStore((s) => s.tick);
    const battery      = useStore((s) => s.battery);
    const isRunning    = useStore((s) => s.isRunning);

    const solData = useMemo(() => aggregateBySol(logHistory), [logHistory]);

    // Running totals
    const totalSolar    = useMemo(() => logHistory.reduce((a, p) => a + (p.solar    ?? 0), 0), [logHistory]);
    const totalConsumed = useMemo(() => logHistory.reduce((a, p) => a + (p.consumed ?? 0), 0), [logHistory]);
    const efficiency    = totalConsumed > 0 ? Math.round((totalSolar / totalConsumed) * 100) : 0;

    const effColor = efficiency >= 80 ? '#39ff14' : efficiency >= 50 ? '#ffc107' : '#ff1744';

    const empty = logHistory.length === 0;

    return (
        <div className="widget energy-widget">
            <h3><span className="widget-icon">⚡</span> Energia egyenleg</h3>

            {/* Summary cards */}
            <div className="en-cards">
                <div className="en-card solar">
                    <span className="en-icon">☀️</span>
                    <span className="en-val">{totalSolar}</span>
                    <span className="en-label">Termelt</span>
                </div>
                <div className="en-card consumed">
                    <span className="en-icon">🔋</span>
                    <span className="en-val">{totalConsumed}</span>
                    <span className="en-label">Fogyasztott</span>
                </div>
                <div className="en-card efficiency">
                    <span className="en-icon">📊</span>
                    <span className="en-val" style={{ color: effColor }}>{efficiency}%</span>
                    <span className="en-label">Hatékonys.</span>
                </div>
                <div className="en-card battery">
                    <span className="en-icon">⚡</span>
                    <span className="en-val" style={{ color: battery > 60 ? '#39ff14' : battery > 30 ? '#ffc107' : '#ff1744' }}>
                        {Math.round(battery)}%
                    </span>
                    <span className="en-label">Akku</span>
                </div>
            </div>

            {/* Chart */}
            <div className="chart-box">
                <h4>Termelt vs. fogyasztott (Sol)</h4>
                {empty ? (
                    <div className="chart-empty">Indítsd el a szimulációt az adatok megjelenítéséhez.</div>
                ) : (
                    <ResponsiveContainer width="100%" height={140}>
                        <ComposedChart data={solData} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e32" />
                            <XAxis dataKey="sol" stroke="#555" fontSize={9} tickLine={false} label={{ value: 'Sol', position: 'insideRight', offset: 10, fill: '#555', fontSize: 9 }} />
                            <YAxis stroke="#555" fontSize={9} tickLine={false} width={28} />
                            <Tooltip {...TT} formatter={(v, n) => [v, n === 'solar' ? '☀ Termelt' : n === 'consumed' ? '🔋 Fogyasztott' : '⚖ Egyenleg']} />
                            <Bar dataKey="solar"    fill="#ffcc00" opacity={0.85} radius={[3,3,0,0]} name="solar" />
                            <Bar dataKey="consumed" fill="#ff4444" opacity={0.75} radius={[3,3,0,0]} name="consumed" />
                            <Line type="monotone" dataKey="balance" stroke="#00cfff" strokeWidth={2} dot={false} name="balance" />
                            <ReferenceLine y={0} stroke="#444" strokeDasharray="4 2" />
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}