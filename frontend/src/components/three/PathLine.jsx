import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { useStore } from '../../store/store';

const S = 1;
const Y = 0.04;

export default function PathLine() {
    const route = useStore((s) => s.route);
    const routeIdx = useStore((s) => s.routeIdx);

    const { travelled, planned } = useMemo(() => {
        if (route.length < 2) return { travelled: [], planned: [] };

        const t = [];
        for (let i = 0; i < Math.min(routeIdx + 1, route.length); i++) {
            t.push([route[i].x * S, Y, route[i].y * S]);
        }

        const p = [];
        for (let i = Math.max(routeIdx, 0); i < route.length; i++) {
            p.push([route[i].x * S, Y, route[i].y * S]);
        }

        return { travelled: t, planned: p };
    }, [route, routeIdx]);

    return (
        <group>
            {planned.length >= 2 && (
                <Line
                    points={planned}
                    color="#00e5ff"
                    lineWidth={1.5}
                    dashed
                    dashSize={0.25}
                    gapSize={0.12}
                    transparent
                    opacity={0.35}
                />
            )}
            {travelled.length >= 2 && (
                <Line
                    points={travelled}
                    color="#ff9100"
                    lineWidth={2.5}
                    transparent
                    opacity={0.75}
                />
            )}
        </group>
    );
}
