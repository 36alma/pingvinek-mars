import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { useStore } from '../../store/store';
import * as THREE from 'three';

// Preload outside component is fine — not a hook call
useGLTF.preload('/rover_alaphelyzet.glb');
useGLTF.preload('/rover_mozog.glb');
useGLTF.preload('/rover_allo.glb');
useGLTF.preload('/rover_fur.glb');

// The arm assembly is parented to 'Csontváz' — hiding that node
// removes the arm meshes AND stops the bone animation entirely
const ARM_ROOT_NAME = 'Csontváz';

function fitScene(scene, target = 1.6) {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = maxDim > 0 ? target / maxDim : 1;
    const center = new THREE.Vector3();
    box.getCenter(center);
    return { scale: s, offset: center };
}

// Static model — no hooks except useMemo
function PreviewModel({ path }) {
    const { scene } = useGLTF(path);

    const { cloned, scale, offset } = useMemo(() => {
        const c = scene.clone(true);
        c.traverse((obj) => {
            if (obj.name === ARM_ROOT_NAME) obj.visible = false;
        });
        const { scale, offset } = fitScene(c);
        return { cloned: c, scale, offset };
    }, [scene]);

    return (
        <primitive
            object={cloned}
            scale={[scale, scale, scale]}
            position={[-offset.x * scale, -offset.y * scale, -offset.z * scale]}
            castShadow
        />
    );
}

// Antenna blink — useFrame here is inside Canvas, fine
function AntennaLight() {
    const ref = useRef();
    useFrame((state) => {
        if (ref.current)
            ref.current.material.emissiveIntensity =
                0.4 + Math.sin(state.clock.elapsedTime * 4) * 0.6;
    });
    return (
        <mesh ref={ref} position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color="#ff3333" emissive="#ff3333" emissiveIntensity={0.8} />
        </mesh>
    );
}

// Battery strip — pure geometry, no hooks
function BatteryStrip({ battery }) {
    const batColor = battery > 60 ? '#39ff14' : battery > 30 ? '#ffc107' : '#ff1744';
    return (
        <mesh position={[0, -1.05, 0.55]}>
            <boxGeometry args={[0.7 * (battery / 100), 0.06, 0.02]} />
            <meshStandardMaterial color={batColor} emissive={batColor} emissiveIntensity={0.9} />
        </mesh>
    );
}

function FallbackModel() {
    return (
        <mesh>
            <boxGeometry args={[0.55, 0.16, 0.75]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.5} roughness={0.35} />
        </mesh>
    );
}

// ── Main export ───────────────────────────────────────
export default function RoverPreview() {
    // All useStore calls here — outside Canvas, correct
    const battery   = useStore((s) => s.battery);
    const speed     = useStore((s) => s.speed);
    const isMoving  = useStore((s) => s.isMoving);
    const isMining  = useStore((s) => s.isMining);
    const isRunning = useStore((s) => s.isRunning);
    const x         = useStore((s) => s.roverX);
    const y         = useStore((s) => s.roverY);
    const dist      = useStore((s) => s.totalDistance);
    const inv       = useStore((s) => s.inventory);
    const route     = useStore((s) => s.route);
    const idx       = useStore((s) => s.routeIdx);

    let modelPath = '/rover_alaphelyzet.glb';
    if (isMining)       modelPath = '/rover_fur.glb';
    else if (isMoving)  modelPath = '/rover_mozog.glb';
    else if (isRunning) modelPath = '/rover_allo.glb';

    const spdVal   = typeof speed === 'number' ? speed : 2;
    const spdLabel = spdVal === 1 ? 'Lassu' : spdVal === 2 ? 'Normal' : 'Gyors';
    const spdColor = spdVal === 1 ? '#00cfff' : spdVal === 2 ? '#39ff14' : '#ff6f00';
    const pct      = route.length > 0 ? Math.round((idx / route.length) * 100) : 0;
    const batColor = battery > 60 ? '#39ff14' : battery > 30 ? '#ffc107' : '#ff1744';
    const total    = inv.B + inv.Y + inv.G;
    const stateLabel = isMining ? 'Banyasz' : isMoving ? 'Mozog' : isRunning ? 'Var' : 'All';
    const stateColor = isMining ? '#ffcc00' : isMoving ? '#39ff14' : '#888';

    return (
        <div className="widget rover-preview-widget">
            <h3><span className="widget-icon">🤖</span> Rover 3D nezet</h3>

            <div className="rover-canvas-wrap">
                <Canvas
                    camera={{ position: [2.2, 1.4, 2.5], fov: 40 }}
                    gl={{ antialias: true, alpha: true }}
                    style={{ background: 'transparent' }}
                >
                    <ambientLight intensity={1.2} color="#ccccff" />
                    <directionalLight position={[3, 5, 3]} intensity={1.5} />
                    <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#ff9944" />
                    <Suspense fallback={<FallbackModel />}>
                        {/* key forces remount when model changes state */}
                        <PreviewModel key={modelPath} path={modelPath} />
                        <AntennaLight />
                        <BatteryStrip battery={battery} />
                    </Suspense>
                    <OrbitControls
                        enablePan={false}
                        minDistance={1.5}
                        maxDistance={6}
                        autoRotate={!isMoving && !isMining}
                        autoRotateSpeed={1.2}
                    />
                </Canvas>
                <div className="rover-state-badge" style={{ color: stateColor }}>
                    {stateLabel}
                </div>
            </div>

            <div className="rp-stats">
                <div className="rp-row">
                    <div className="rp-stat">
                        <div className="rp-stat-top">
                            <span className="rp-label">Akkumulator</span>
                            <span className="rp-val" style={{ color: batColor }}>{Math.round(battery)}%</span>
                        </div>
                        <div className="rp-bat-bar">
                            <div className="rp-bat-fill" style={{
                                width: `${battery}%`,
                                background: batColor,
                                boxShadow: `0 0 6px ${batColor}80`
                            }} />
                        </div>
                    </div>
                </div>
                <div className="rp-row rp-row--4">
                    <div className="rp-mini"><span className="rp-ml">Pozicio</span><span className="rp-mv">({x},{y})</span></div>
                    <div className="rp-mini"><span className="rp-ml">Sebesseg</span><span className="rp-mv" style={{ color: spdColor }}>{spdLabel}</span></div>
                    <div className="rp-mini"><span className="rp-ml">Megtett</span><span className="rp-mv">{dist} blk</span></div>
                    <div className="rp-mini"><span className="rp-ml">Utvonal</span><span className="rp-mv">{pct}%</span></div>
                </div>
                <div className="rp-minerals">
                    <div className="rp-min-item blue"><span>💎</span><span className="rp-min-label">Vizjeg</span><b>{inv.B}</b></div>
                    <div className="rp-min-item yellow"><span>🥇</span><span className="rp-min-label">Arany</span><b>{inv.Y}</b></div>
                    <div className="rp-min-item green"><span>🪨</span><span className="rp-min-label">Ritka</span><b>{inv.G}</b></div>
                    <div className="rp-min-item total"><span>📦</span><span className="rp-min-label">Ossz.</span><b>{total}</b></div>
                </div>
            </div>
        </div>
    );
}