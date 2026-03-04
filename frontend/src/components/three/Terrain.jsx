import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../../store/store';
import { CELL, MAP_SIZE } from '../../simulation/mapData';
import * as THREE from 'three';

const S = 1; // cell size

// Simple hash for deterministic per-obstacle variation
function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = ((h ^ (h >> 13)) * 1274126177) | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

// Instanced obstacle rendering for performance
function Obstacles({ positions }) {
    const ref = useRef();
    const count = positions.length;
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const initialized = useRef(false);

    useFrame(() => {
        if (!ref.current || count === 0 || initialized.current) return;
        positions.forEach((p, i) => {
            const h1 = hash(p.x, p.y);
            const h2 = hash(p.y, p.x);
            const h3 = hash(p.x + 100, p.y + 100);
            const scaleY = 0.35 + h1 * 0.55;
            const actualHeight = 0.5 * scaleY; // geometry height 0.5 * scaleY
            dummy.position.set(p.x * S, actualHeight / 2, p.y * S);
            dummy.scale.set(0.65 + h2 * 0.35, scaleY, 0.65 + h3 * 0.35);
            dummy.rotation.set(0, h2 * Math.PI, 0);
            dummy.updateMatrix();
            ref.current.setMatrixAt(i, dummy.matrix);
        });
        ref.current.instanceMatrix.needsUpdate = true;
        initialized.current = true;
    });

    if (count === 0) return null;

    return (
        <instancedMesh ref={ref} args={[null, null, count]} castShadow receiveShadow>
            <boxGeometry args={[S * 0.85, 0.5, S * 0.85]} />
            <meshStandardMaterial color="#7a7a7a" emissive="#222222" emissiveIntensity={0.3} roughness={0.95} metalness={0.05} />
        </instancedMesh>
    );
}

// Instanced minerals for performance
function MineralInstances({ minerals }) {
    const blueRef = useRef();
    const yellowRef = useRef();
    const greenRef = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const grouped = useMemo(() => {
        const b = [], y = [], g = [];
        for (const m of minerals) {
            if (m.type === CELL.BLUE) b.push(m);
            else if (m.type === CELL.YELLOW) y.push(m);
            else g.push(m);
        }
        return { b, y, g };
    }, [minerals]);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        [[blueRef, grouped.b], [yellowRef, grouped.y], [greenRef, grouped.g]].forEach(([ref, group]) => {
            if (!ref.current || group.length === 0) return;
            group.forEach((m, i) => {
                dummy.position.set(m.x * S, 0.28 + Math.sin(t * 2 + m.x * 0.5 + m.y * 0.3) * 0.06, m.y * S);
                dummy.rotation.y = t * 1.2;
                dummy.updateMatrix();
                ref.current.setMatrixAt(i, dummy.matrix);
            });
            ref.current.instanceMatrix.needsUpdate = true;
        });
    });

    return (
        <>
            {grouped.b.length > 0 && (
                <instancedMesh ref={blueRef} args={[null, null, grouped.b.length]}>
                    <octahedronGeometry args={[0.18, 0]} />
                    <meshStandardMaterial color="#00cfff" emissive="#00cfff" emissiveIntensity={0.6} transparent opacity={0.9} roughness={0.15} metalness={0.4} />
                </instancedMesh>
            )}
            {grouped.y.length > 0 && (
                <instancedMesh ref={yellowRef} args={[null, null, grouped.y.length]}>
                    <octahedronGeometry args={[0.18, 0]} />
                    <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={0.6} transparent opacity={0.9} roughness={0.15} metalness={0.4} />
                </instancedMesh>
            )}
            {grouped.g.length > 0 && (
                <instancedMesh ref={greenRef} args={[null, null, grouped.g.length]}>
                    <octahedronGeometry args={[0.18, 0]} />
                    <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={0.6} transparent opacity={0.9} roughness={0.15} metalness={0.4} />
                </instancedMesh>
            )}
        </>
    );
}

// Start position marker
function StartMarker({ x, y }) {
    const ref = useRef();

    useFrame((state) => {
        if (ref.current) {
            ref.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.08);
        }
    });

    return (
        <group position={[x * S, 0.01, y * S]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.32, 0.42, 24]} />
                <meshStandardMaterial color="#ff5533" emissive="#ff5533" emissiveIntensity={0.3} side={THREE.DoubleSide} />
            </mesh>
            <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
                <ringGeometry args={[0.15, 0.22, 24]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
}

export default function Terrain() {
    const map = useStore((s) => s.map);
    const startX = useStore((s) => s.startX);
    const startY = useStore((s) => s.startY);
    const collectedSet = useStore((s) => s.collectedSet);

    const { obstacles, minerals } = useMemo(() => {
        const obs = [];
        const mins = [];
        for (let y = 0; y < MAP_SIZE; y++) {
            for (let x = 0; x < MAP_SIZE; x++) {
                const c = map[y][x];
                if (c === CELL.OBSTACLE) obs.push({ x, y });
                else if (c === CELL.BLUE || c === CELL.YELLOW || c === CELL.GREEN) {
                    mins.push({ x, y, type: c });
                }
            }
        }
        return { obstacles: obs, minerals: mins };
    }, [map]);

    const visibleMinerals = useMemo(() => {
        return minerals.filter((m) => !collectedSet.has(`${m.x},${m.y}`));
    }, [minerals, collectedSet]);

    return (
        <group>
            {/* Ground */}
            <mesh position={[MAP_SIZE / 2 - 0.5, -0.05, MAP_SIZE / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
                <meshStandardMaterial color="#b5451c" emissive="#3a1008" emissiveIntensity={0.4} roughness={0.92} />
            </mesh>

            {/* Grid */}
            <gridHelper args={[MAP_SIZE, MAP_SIZE, '#6b2f12', '#6b2f12']} position={[MAP_SIZE / 2 - 0.5, -0.03, MAP_SIZE / 2 - 0.5]} />

            {/* Obstacles (instanced) */}
            <Obstacles positions={obstacles} />

            {/* Minerals (instanced) */}
            <MineralInstances minerals={visibleMinerals} />

            {/* Start marker */}
            <StartMarker x={startX} y={startY} />
        </group>
    );
}