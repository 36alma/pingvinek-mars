import { useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { useStore } from '../../store/store';
import * as THREE from 'three';

useGLTF.preload('/rover2.glb');

function GLBModel({ battery }) {
    const { scene } = useGLTF('/rover2.glb');
    const antennaLight = useRef();

    const { scale, offset } = useMemo(() => {
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const s = 1.6 / maxDim;
        const c = new THREE.Vector3();
        box.getCenter(c);
        return { scale: s, offset: c };
    }, [scene]);

    const cloned = useMemo(() => scene.clone(true), [scene]);
    const batColor = battery > 60 ? '#39ff14' : battery > 30 ? '#ffc107' : '#ff1744';

    useFrame((state) => {
        if (antennaLight.current)
            antennaLight.current.material.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 4) * 0.6;
    });

    return (
        <group>
            <primitive
                object={cloned}
                scale={[scale, scale, scale]}
                position={[-offset.x * scale, -offset.y * scale, -offset.z * scale]}
                castShadow
            />
            <mesh ref={antennaLight} position={[0, 1.0, 0]}>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshStandardMaterial color="#ff3333" emissive="#ff3333" emissiveIntensity={0.8} />
            </mesh>
            {/* Battery strip */}
            <mesh position={[0, -1.0, 0.6]}>
                <boxGeometry args={[0.8 * (battery / 100), 0.07, 0.02]} />
                <meshStandardMaterial color={batColor} emissive={batColor} emissiveIntensity={0.9} />
            </mesh>
        </group>
    );
}

function FallbackModel({ battery }) {
    const antennaLight = useRef();
    useFrame((state) => {
        if (antennaLight.current)
            antennaLight.current.material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 4) * 0.5;
    });
    const batColor = battery > 60 ? '#39ff14' : battery > 30 ? '#ffc107' : '#ff1744';
    return (
        <group>
            <mesh castShadow><boxGeometry args={[0.55, 0.16, 0.75]} /><meshStandardMaterial color="#e0e0e0" metalness={0.5} roughness={0.35} /></mesh>
            {[[-0.3,-0.1,-0.28],[-0.3,-0.1,0],[-0.3,-0.1,0.28],[0.3,-0.1,-0.28],[0.3,-0.1,0],[0.3,-0.1,0.28]].map((pos, i) => (
                <mesh key={i} position={pos} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.07,0.07,0.05,10]} /><meshStandardMaterial color="#333" /></mesh>
            ))}
            <mesh ref={antennaLight} position={[0.18,0.37,0.25]}><sphereGeometry args={[0.022,6,6]} /><meshStandardMaterial color="#ff3333" emissive="#ff3333" emissiveIntensity={0.8} /></mesh>
            <mesh position={[0, 0.09, 0.38]}><boxGeometry args={[0.3 * (battery/100), 0.04, 0.01]} /><meshStandardMaterial color={batColor} emissive={batColor} emissiveIntensity={0.9} /></mesh>
        </group>
    );
}

export default function RoverPreview() {
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

    const spdLabel = speed === 1 ? 'Lassú' : speed === 2 ? 'Normál' : 'Gyors';
    const spdColor = speed === 1 ? '#00cfff' : speed === 2 ? '#39ff14' : '#ff6f00';
    const pct      = route.length > 0 ? Math.round((idx / route.length) * 100) : 0;
    const batColor = battery > 60 ? '#39ff14' : battery > 30 ? '#ffc107' : '#ff1744';
    const total    = inv.B + inv.Y + inv.G;
    const stateLabel = isMining ? '⛏ Bányász' : isMoving ? '🚗 Mozog' : isRunning ? '⏸ Vár' : '🔴 Áll';
    const stateColor = isMining ? '#ffcc00' : isMoving ? '#39ff14' : '#888';

    return (
        <div className="widget rover-preview-widget">
            <h3><span className="widget-icon">🤖</span> Rover 3D nézet</h3>

            <div className="rover-canvas-wrap">
                <Canvas camera={{ position: [2.2, 1.4, 2.5], fov: 40 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
                    <ambientLight intensity={1.2} color="#ccccff" />
                    <directionalLight position={[3, 5, 3]} intensity={1.5} />
                    <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#ff9944" />
                    <Suspense fallback={<FallbackModel battery={battery} />}>
                        <GLBModel battery={battery} />
                    </Suspense>
                    <OrbitControls enablePan={false} minDistance={1.5} maxDistance={6} autoRotate={!isMoving && !isMining} autoRotateSpeed={1.2} />
                </Canvas>
                <div className="rover-state-badge" style={{ color: stateColor }}>{stateLabel}</div>
            </div>

            <div className="rp-stats">
                <div className="rp-row">
                    <div className="rp-stat">
                        <div className="rp-stat-top">
                            <span className="rp-label">Akkumulátor</span>
                            <span className="rp-val" style={{ color: batColor }}>{Math.round(battery)}%</span>
                        </div>
                        <div className="rp-bat-bar">
                            <div className="rp-bat-fill" style={{ width: `${battery}%`, background: batColor, boxShadow: `0 0 6px ${batColor}80` }} />
                        </div>
                    </div>
                </div>
                <div className="rp-row rp-row--4">
                    <div className="rp-mini"><span className="rp-ml">Pozíció</span><span className="rp-mv">({x}, {y})</span></div>
                    <div className="rp-mini"><span className="rp-ml">Sebesség</span><span className="rp-mv" style={{ color: spdColor }}>{spdLabel}</span></div>
                    <div className="rp-mini"><span className="rp-ml">Megtett út</span><span className="rp-mv">{dist} blk</span></div>
                    <div className="rp-mini"><span className="rp-ml">Útvonal</span><span className="rp-mv">{pct}%</span></div>
                </div>
                <div className="rp-minerals">
                    <div className="rp-min-item blue"><span>💎</span><span className="rp-min-label">Vízjég</span><b>{inv.B}</b></div>
                    <div className="rp-min-item yellow"><span>🥇</span><span className="rp-min-label">Arany</span><b>{inv.Y}</b></div>
                    <div className="rp-min-item green"><span>🪨</span><span className="rp-min-label">Ritka</span><b>{inv.G}</b></div>
                    <div className="rp-min-item total"><span>📦</span><span className="rp-min-label">Össz.</span><b>{total}</b></div>
                </div>
            </div>
        </div>
    );
}