import { useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useStore } from '../../store/store';
import { CELL, MAP_SIZE } from '../../simulation/mapData';
import * as THREE from 'three';

const S = 1;

function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = ((h ^ (h >> 13)) * 1274126177) | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

// ── Preload obstacle models ───────────────────────────
useGLTF.preload('/akadaly_urkapszula.glb');
useGLTF.preload('/szikla_akadaly.glb');
useGLTF.preload('/szikla_akadaly_2.glb');

function getScaleFactor(scene, target = 0.85) {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    return maxDim > 0 ? target / maxDim : 1;
}

// ── Single obstacle ───────────────────────────────────
function ObstacleItem({ p, scene, scaleFactor }) {
    const h1 = hash(p.x, p.y);
    const h2 = hash(p.y, p.x);
    const h3 = hash(p.x + 7, p.y + 13);
    const varScale = scaleFactor * (0.75 + h2 * 0.5);
    const rotY = h3 * Math.PI * 2;
    const cloned = useMemo(() => scene.clone(true), [scene]);
    return (
        <primitive
            object={cloned}
            position={[p.x * S, 0, p.y * S]}
            scale={[varScale, varScale * (0.8 + h1 * 0.4), varScale]}
            rotation={[0, rotY, 0]}
            castShadow receiveShadow
        />
    );
}

function FallbackObstacles({ positions }) {
    const ref = useRef();
    const count = positions.length;
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const lastCount = useRef(-1);
    useFrame(() => {
        if (!ref.current || count === 0) return;
        if (lastCount.current === count) return;
        positions.forEach((p, i) => {
            const h1 = hash(p.x, p.y);
            const h2 = hash(p.y, p.x);
            const scaleY = 0.35 + h1 * 0.55;
            dummy.position.set(p.x * S, (0.5 * scaleY) / 2, p.y * S);
            dummy.scale.set(0.65 + h2 * 0.35, scaleY, 0.65 + h2 * 0.35);
            dummy.rotation.set(0, h2 * Math.PI, 0);
            dummy.updateMatrix();
            ref.current.setMatrixAt(i, dummy.matrix);
        });
        ref.current.instanceMatrix.needsUpdate = true;
        lastCount.current = count;
    });
    if (count === 0) return null;
    return (
        <instancedMesh key={count} ref={ref} args={[null, null, count]} castShadow receiveShadow>
            <boxGeometry args={[S * 0.85, 0.5, S * 0.85]} />
            <meshStandardMaterial color="#7a7a7a" roughness={0.95} />
        </instancedMesh>
    );
}

function Obstacles({ positions }) {
    const { scene: capsuleScene } = useGLTF('/akadaly_urkapszula.glb');
    const { scene: rock1Scene   } = useGLTF('/szikla_akadaly.glb');
    const { scene: rock2Scene   } = useGLTF('/szikla_akadaly_2.glb');

    const capsuleScale = useMemo(() => getScaleFactor(capsuleScene), [capsuleScene]);
    const rock1Scale   = useMemo(() => getScaleFactor(rock1Scene),   [rock1Scene]);
    const rock2Scale   = useMemo(() => getScaleFactor(rock2Scene),   [rock2Scene]);

    // Max 10 capsules — pick them deterministically by hash rank
    const { capsuleSet, assignments } = useMemo(() => {
        // Score each position for capsule candidacy
        const scored = positions.map((p) => ({ p, score: hash(p.x * 3 + 1, p.y * 7 + 2) }));
        scored.sort((a, b) => b.score - a.score);
        const capsuleSet = new Set(scored.slice(0, 10).map(({ p }) => `${p.x},${p.y}`));

        // Assign model to each position
        const assignments = positions.map((p) => {
            const key = `${p.x},${p.y}`;
            if (capsuleSet.has(key)) return 0; // capsule
            return hash(p.x, p.y) < 0.5 ? 1 : 2; // rock1 or rock2
        });
        return { capsuleSet, assignments };
    }, [positions]);

    return (
        <>
            {positions.map((p, i) => {
                const modelIdx = assignments[i];
                const [scene, scale] =
                    modelIdx === 0 ? [capsuleScene, capsuleScale] :
                    modelIdx === 1 ? [rock1Scene,   rock1Scale]   :
                                     [rock2Scene,   rock2Scale];
                return (
                    <ObstacleItem
                        key={`obs-${p.x}-${p.y}`}
                        p={p} scene={scene} scaleFactor={scale}
                    />
                );
            })}
        </>
    );
}

// ── Minerals — classic octahedron geometry (no GLB) ──
function MineralInstances({ minerals }) {
    const blueRef   = useRef();
    const yellowRef = useRef();
    const greenRef  = useRef();
    const dummy     = useMemo(() => new THREE.Object3D(), []);

    const grouped = useMemo(() => {
        const b = [], y = [], g = [];
        for (const m of minerals) {
            if      (m.type === CELL.BLUE)   b.push(m);
            else if (m.type === CELL.YELLOW) y.push(m);
            else                              g.push(m);
        }
        return { b, y, g };
    }, [minerals]);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        [[blueRef, grouped.b], [yellowRef, grouped.y], [greenRef, grouped.g]].forEach(([ref, group]) => {
            if (!ref.current || group.length === 0) return;
            group.forEach((m, i) => {
                dummy.position.set(
                    m.x * S,
                    0.28 + Math.sin(t * 2 + m.x * 0.5 + m.y * 0.3) * 0.06,
                    m.y * S
                );
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
                <instancedMesh key={`b-${grouped.b.length}`} ref={blueRef} args={[null, null, grouped.b.length]}>
                    <octahedronGeometry args={[0.18, 0]} />
                    <meshStandardMaterial color="#00cfff" emissive="#00cfff" emissiveIntensity={0.6}
                        transparent opacity={0.9} roughness={0.15} metalness={0.4} />
                </instancedMesh>
            )}
            {grouped.y.length > 0 && (
                <instancedMesh key={`y-${grouped.y.length}`} ref={yellowRef} args={[null, null, grouped.y.length]}>
                    <octahedronGeometry args={[0.18, 0]} />
                    <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={0.6}
                        transparent opacity={0.9} roughness={0.15} metalness={0.4} />
                </instancedMesh>
            )}
            {grouped.g.length > 0 && (
                <instancedMesh key={`g-${grouped.g.length}`} ref={greenRef} args={[null, null, grouped.g.length]}>
                    <octahedronGeometry args={[0.18, 0]} />
                    <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={0.6}
                        transparent opacity={0.9} roughness={0.15} metalness={0.4} />
                </instancedMesh>
            )}
        </>
    );
}

// ── Start marker ──────────────────────────────────────
function StartMarker({ x, y }) {
    const ref = useRef();
    useFrame((state) => {
        if (ref.current)
            ref.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.08);
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

// ── Terrain root ──────────────────────────────────────
export default function Terrain() {
    const map          = useStore((s) => s.map);
    const startX       = useStore((s) => s.startX);
    const startY       = useStore((s) => s.startY);
    const collectedSet = useStore((s) => s.collectedSet);

    const { obstacles, minerals } = useMemo(() => {
        const obs = [], mins = [];
        for (let y = 0; y < MAP_SIZE; y++) {
            for (let x = 0; x < MAP_SIZE; x++) {
                const c = map[y][x];
                if (c === CELL.OBSTACLE) obs.push({ x, y });
                else if (c === CELL.BLUE || c === CELL.YELLOW || c === CELL.GREEN)
                    mins.push({ x, y, type: c });
            }
        }
        return { obstacles: obs, minerals: mins };
    }, [map]);

    const visibleMinerals = useMemo(
        () => minerals.filter((m) => !collectedSet.has(`${m.x},${m.y}`)),
        [minerals, collectedSet]
    );

    return (
        <group>
            <mesh position={[MAP_SIZE/2-0.5, -0.05, MAP_SIZE/2-0.5]}
                  rotation={[-Math.PI/2, 0, 0]} receiveShadow>
                <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
                <meshStandardMaterial color="#b5451c" emissive="#5a1a08"
                    emissiveIntensity={0.6} roughness={0.92} />
            </mesh>

            <gridHelper args={[MAP_SIZE, MAP_SIZE, '#6b2f12', '#6b2f12']}
                        position={[MAP_SIZE/2-0.5, -0.03, MAP_SIZE/2-0.5]} />

            <Suspense fallback={<FallbackObstacles positions={obstacles} />}>
                <Obstacles positions={obstacles} />
            </Suspense>

            <MineralInstances minerals={visibleMinerals} />

            <StartMarker x={startX} y={startY} />
        </group>
    );
}