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

function getScaleFactor(scene, target = 0.85) {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    return maxDim > 0 ? target / maxDim : 1;
}

// ── Preload ──────────────────────────────────────────
useGLTF.preload('/akadaly_urkapszula.glb');
useGLTF.preload('/szikla_akadaly.glb');
useGLTF.preload('/szikla_akadaly_2.glb');
useGLTF.preload('/jeg_asvany.glb');
useGLTF.preload('/arany_asvany.glb');
useGLTF.preload('/zold_asvany.glb');

// ── Single obstacle item — picks model by hash ────────
function ObstacleItem({ p, scenes, scaleFactors }) {
    const h1 = hash(p.x, p.y);
    const h2 = hash(p.y, p.x);
    const h3 = hash(p.x + 7, p.y + 13);

    // 3 models: 0=urkapszula (~20%), 1=szikla1 (~40%), 2=szikla2 (~40%)
    const modelIdx = h1 < 0.2 ? 0 : h1 < 0.6 ? 1 : 2;
    const scene = scenes[modelIdx];
    const base  = scaleFactors[modelIdx];

    const varScale = base * (0.75 + h2 * 0.5);
    const rotY     = h3 * Math.PI * 2;
    const cloned   = useMemo(() => scene.clone(true), [scene]);

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
            const h3 = hash(p.x + 100, p.y + 100);
            const scaleY = 0.35 + h1 * 0.55;
            dummy.position.set(p.x * S, (0.5 * scaleY) / 2, p.y * S);
            dummy.scale.set(0.65 + h2 * 0.35, scaleY, 0.65 + h3 * 0.35);
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
            <meshStandardMaterial color="#7a7a7a" emissive="#333" emissiveIntensity={0.5} roughness={0.95} />
        </instancedMesh>
    );
}

function Obstacles({ positions }) {
    const { scene: capsuleScene } = useGLTF('/akadaly_urkapszula.glb');
    const { scene: rock1Scene   } = useGLTF('/szikla_akadaly.glb');
    const { scene: rock2Scene   } = useGLTF('/szikla_akadaly_2.glb');

    const scenes = useMemo(
        () => [capsuleScene, rock1Scene, rock2Scene],
        [capsuleScene, rock1Scene, rock2Scene]
    );
    const scaleFactors = useMemo(
        () => scenes.map((s) => getScaleFactor(s)),
        [scenes]
    );

    return (
        <>
            {positions.map((p) => (
                <ObstacleItem
                    key={`obs-${p.x}-${p.y}`}
                    p={p}
                    scenes={scenes}
                    scaleFactors={scaleFactors}
                />
            ))}
        </>
    );
}

// Pre-computed from GLB accessor bounds (maxDim target=0.4 world units)
// jeg:   maxDim=17.46 → scale=0.4/17.46, center=(10.07, 0,   10.27)
// arany: maxDim=17.04 → scale=0.4/17.04, center=(7.92,  3.44, 9.13)
// zold:  maxDim=20.00 → scale=0.4/20.00, center=(-10,   5.5, -9.87)
const MINERAL_CONFIG = {
    jeg:   { scale: 0.4/17.46, ox: -10.07*(0.4/17.46), oy: 0,                    oz: -10.27*(0.4/17.46) },
    arany: { scale: 0.4/17.04, ox:  -7.92*(0.4/17.04), oy: -3.44*(0.4/17.04),    oz:  -9.13*(0.4/17.04) },
    zold:  { scale: 0.4/20.00, ox:  10.00*(0.4/20.00), oy: 0,                    oz:   9.87*(0.4/20.00) },
};

function MineralItem({ m, scene, cfg }) {
    const groupRef = useRef();
    const cloned = useMemo(() => {
        const c = scene.clone(true);
        c.traverse((obj) => {
            if (obj.isMesh && obj.material) {
                obj.material = Array.isArray(obj.material)
                    ? obj.material.map(mat => mat.clone())
                    : obj.material.clone();
            }
        });
        return c;
    }, [scene, m.x, m.y]);

    useFrame((state) => {
        if (!groupRef.current) return;
        groupRef.current.position.y = 0.18 + Math.sin(state.clock.elapsedTime * 2 + m.x * 0.5 + m.y * 0.3) * 0.06;
        groupRef.current.rotation.y = state.clock.elapsedTime * 1.2;
    });

    return (
        <group ref={groupRef} position={[m.x * S, 0.18, m.y * S]}>
            <primitive
                object={cloned}
                scale={[cfg.scale, cfg.scale, cfg.scale]}
                position={[cfg.ox, cfg.oy, cfg.oz]}
            />
        </group>
    );
}

function Minerals({ minerals }) {
    const { scene: iceScene }   = useGLTF('/jeg_asvany.glb');
    const { scene: goldScene }  = useGLTF('/arany_asvany.glb');
    const { scene: greenScene } = useGLTF('/zold_asvany.glb');

    return (
        <>
            {minerals.map((m) => {
                const [scene, cfg] =
                    m.type === CELL.BLUE   ? [iceScene,   MINERAL_CONFIG.jeg]   :
                    m.type === CELL.YELLOW ? [goldScene,  MINERAL_CONFIG.arany] :
                                             [greenScene, MINERAL_CONFIG.zold];
                return (
                    <MineralItem
                        key={`min-${m.x}-${m.y}`}
                        m={m} scene={scene} cfg={cfg}
                    />
                );
            })}
        </>
    );
}

// ── Start marker ─────────────────────────────────────
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

// ── Terrain root ─────────────────────────────────────
export default function Terrain() {
    const map         = useStore((s) => s.map);
    const startX      = useStore((s) => s.startX);
    const startY      = useStore((s) => s.startY);
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
            {/* Ground */}
            <mesh position={[MAP_SIZE/2-0.5, -0.05, MAP_SIZE/2-0.5]}
                  rotation={[-Math.PI/2, 0, 0]} receiveShadow>
                <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
                <meshStandardMaterial color="#b5451c" emissive="#5a1a08" emissiveIntensity={0.6} roughness={0.92} />
            </mesh>

            {/* Grid */}
            <gridHelper args={[MAP_SIZE, MAP_SIZE, '#6b2f12', '#6b2f12']}
                        position={[MAP_SIZE/2-0.5, -0.03, MAP_SIZE/2-0.5]} />

            {/* Obstacles */}
            <Suspense fallback={<FallbackObstacles positions={obstacles} />}>
                <Obstacles positions={obstacles} />
            </Suspense>

            {/* Minerals */}
            <Suspense fallback={null}>
                <Minerals minerals={visibleMinerals} />
            </Suspense>

            {/* Start marker */}
            <StartMarker x={startX} y={startY} />
        </group>
    );
}