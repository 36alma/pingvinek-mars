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
    const simSpeed   = useStore((s) => s.simSpeed);

    // At high speeds recharts animation causes infinite update loops.
    // Disable animation above 2× and throttle data points aggressively.
    const isAnimated = simSpeed <= 2;

    // Throttle: show fewer points at higher speeds to reduce render load
    const stride = simSpeed >= 10 ? 8 : simSpeed >= 5 ? 4 : 2;

    const distData = useMemo(() => {
        return logHistory.filter((_, i) => i % stride === 0).slice(-60);
    }, [logHistory, stride]);

    const mineralData = useMemo(() => {
        const pts = [];
        let lastTotal = 0;
        for (const p of logHistory) {
            if (p.total !== lastTotal) {
                pts.push(p);
                lastTotal = p.total;
            }
        }
        // Throttle at high speeds
        return pts.filter((_, i) => i % Math.max(1, Math.floor(stride / 2)) === 0);
    }, [logHistory, stride]);

    return (
        <div className="widget charts-widget">
            <h3><span className="widget-icon">📈</span> Grafikonok</h3>

            {mineralData.length > 0 && (
                <div className="chart-box">
                    <h4>Gyűjtött ásványok</h4>
                    <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={mineralData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e32" />
                            <XAxis dataKey="h" stroke="#555" fontSize={9} tickLine={false} />
                            <YAxis stroke="#555" fontSize={9} tickLine={false} width={28} />
                            <Tooltip {...TT} />
                            <Bar dataKey="B" stackId="m" fill="#00cfff" name="Vízjég"
                                isAnimationActive={isAnimated} />
                            <Bar dataKey="Y" stackId="m" fill="#ffcc00" name="Arany"
                                isAnimationActive={isAnimated} />
                            <Bar dataKey="G" stackId="m" fill="#00ff66" name="Ritka"
                                radius={[3,3,0,0]} isAnimationActive={isAnimated} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div className="chart-box">
                <h4>Megtett távolság (blokk)</h4>
                <ResponsiveContainer width="100%" height={110}>
                    <AreaChart data={distData}>
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
                        <Area type="monotone" dataKey="distance" stroke="#ff9100"
                            strokeWidth={2} fill="url(#gDist)" name="Távolság"
                            isAnimationActive={isAnimated} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}