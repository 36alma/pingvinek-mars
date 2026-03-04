import { useMemo } from 'react';
import { useStore } from '../../store/store';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    BarChart, Bar,
    ResponsiveContainer,
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

export default function Charts() {
    const logHistory = useStore((s) => s.logHistory);

    // Thin data for chart perf (every 2nd point)
    const batteryData = useMemo(() => {
        return logHistory.filter((_, i) => i % 2 === 0).slice(-80);
    }, [logHistory]);

    const mineralData = useMemo(() => {
        // Show cumulative mineral counts over time
        const pts = [];
        let lastTotal = 0;
        for (const p of logHistory) {
            if (p.total !== lastTotal) {
                pts.push(p);
                lastTotal = p.total;
            }
        }
        return pts;
    }, [logHistory]);

    return (
        <div className="widget charts-widget">
            <h3><span className="widget-icon">📈</span> Grafikonok</h3>

            <div className="chart-box">
                <h4>Akkumulátor szint (%)</h4>
                <ResponsiveContainer width="100%" height={130}>
                    <AreaChart data={batteryData}>
                        <defs>
                            <linearGradient id="gBat" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#39ff14" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="#39ff14" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e32" />
                        <XAxis dataKey="h" stroke="#555" fontSize={9} tickLine={false} />
                        <YAxis domain={[0, 100]} stroke="#555" fontSize={9} tickLine={false} width={28} />
                        <Tooltip {...TT} />
                        <Area type="monotone" dataKey="battery" stroke="#39ff14" strokeWidth={2} fill="url(#gBat)" name="Akku %" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {mineralData.length > 0 && (
                <div className="chart-box">
                    <h4>Gyűjtött ásványok</h4>
                    <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={mineralData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e32" />
                            <XAxis dataKey="h" stroke="#555" fontSize={9} tickLine={false} />
                            <YAxis stroke="#555" fontSize={9} tickLine={false} width={28} />
                            <Tooltip {...TT} />
                            <Bar dataKey="B" stackId="m" fill="#00cfff" name="Vízjég" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="Y" stackId="m" fill="#ffcc00" name="Arany" />
                            <Bar dataKey="G" stackId="m" fill="#00ff66" name="Ritka" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div className="chart-box">
                <h4>Megtett távolság (blokk)</h4>
                <ResponsiveContainer width="100%" height={110}>
                    <AreaChart data={batteryData}>
                        <defs>
                            <linearGradient id="gDist" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ff9100" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#ff9100" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e32" />
                        <XAxis dataKey="h" stroke="#555" fontSize={9} tickLine={false} />
                        <YAxis stroke="#555" fontSize={9} tickLine={false} width={28} />
                        <Tooltip {...TT} />
                        <Area type="monotone" dataKey="distance" stroke="#ff9100" strokeWidth={2} fill="url(#gDist)" name="Távolság" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
