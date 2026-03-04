import { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useStore } from '../../store/store';

function RoverModel({ isMoving, isMining, battery }) {
    const group = useRef();
    const wheels = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
    const panelRef = useRef();
    const antennaLight = useRef();

    useFrame((state) => {
        if (!group.current) return;
        // Slow idle rotation when not manually dragging
        // Wheel spin
        wheels.forEach((w) => {
            if (w.current) w.current.rotation.x += isMoving ? 0.06 : 0.008;
        });
        // Solar panel gentle tilt
        if (panelRef.current) {
            panelRef.current.rotation.x = -0.15 + Math.sin(state.clock.elapsedTime * 0.4) * 0.03;
        }
        // Antenna blink
        if (antennaLight.current) {
            antennaLight.current.material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 4) * 0.5;
        }
        // Mining bobble
        if (isMining && group.current) {
            group.current.position.y = Math.sin(state.clock.elapsedTime * 8) * 0.015;
        }
    });

    const battColor = battery > 60 ? '#39ff14' : battery > 30 ? '#ffc107' : '#ff1744';

    return (
        <group ref={group}>
            {/* Body chassis */}
            <mesh castShadow>
                <boxGeometry args={[0.55, 0.16, 0.75]} />
                <meshStandardMaterial color="#e0e0e0" emissive="#444444" emissiveIntensity={0.2} metalness={0.5} roughness={0.35} />
            </mesh>
            {/* Body top */}
            <mesh position={[0, 0.1, -0.05]} castShadow>
                <boxGeometry args={[0.42, 0.1, 0.5]} />
                <meshStandardMaterial color="#d0d0d0" emissive="#333333" emissiveIntensity={0.2} metalness={0.4} roughness={0.4} />
            </mesh>

            {/* Camera mast */}
            <mesh position={[0, 0.28, -0.2]}>
                <cylinderGeometry args={[0.018, 0.022, 0.3, 8]} />
                <meshStandardMaterial color="#aaa" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.45, -0.2]}>
                <boxGeometry args={[0.14, 0.07, 0.1]} />
                <meshStandardMaterial color="#444" metalness={0.5} roughness={0.3} />
            </mesh>
            {/* Lens */}
            <mesh position={[0, 0.45, -0.26]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 0.02, 10]} />
                <meshStandardMaterial color="#111133" metalness={0.9} roughness={0.05} />
            </mesh>

            {/* Solar panel */}
            <group ref={panelRef} position={[0, 0.22, 0.1]}>
                <mesh castShadow>
                    <boxGeometry args={[0.75, 0.015, 0.5]} />
                    <meshStandardMaterial color="#1a237e" emissive="#1a237e" emissiveIntensity={0.4} metalness={0.3} roughness={0.3} />
                </mesh>
                {[-0.2, 0, 0.2].map((z, i) => (
                    <mesh key={i} position={[0, 0.009, z]}>
                        <boxGeometry args={[0.73, 0.003, 0.01]} />
                        <meshStandardMaterial color="#3949ab" />
                    </mesh>
                ))}
            </group>

            {/* 6 wheels */}
            {[
                [-0.3, -0.1, -0.28], [-0.3, -0.1, 0], [-0.3, -0.1, 0.28],
                [0.3, -0.1, -0.28],  [0.3, -0.1, 0],  [0.3, -0.1, 0.28],
            ].map((pos, i) => (
                <mesh key={i} ref={wheels[i]} position={pos} rotation={[0, 0, Math.PI / 2]} castShadow>
                    <cylinderGeometry args={[0.07, 0.07, 0.05, 10]} />
                    <meshStandardMaterial color="#333" roughness={0.8} />
                </mesh>
            ))}

            {/* Antenna */}
            <mesh position={[0.18, 0.25, 0.25]}>
                <cylinderGeometry args={[0.006, 0.006, 0.22, 5]} />
                <meshStandardMaterial color="#ccc" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh ref={antennaLight} position={[0.18, 0.37, 0.25]}>
                <sphereGeometry args={[0.022, 6, 6]} />
                <meshStandardMaterial color="#ff3333" emissive="#ff3333" emissiveIntensity={0.8} />
            </mesh>

            {/* Headlights */}
            {[-0.16, 0.16].map((x, i) => (
                <mesh key={i} position={[x, -0.02, -0.38]}>
                    <sphereGeometry args={[0.025, 6, 6]} />
                    <meshStandardMaterial color="#ffffdd" emissive="#ffffdd" emissiveIntensity={isMoving ? 1.2 : 0.3} />
                </mesh>
            ))}

            {/* Battery indicator strip on chassis */}
            <mesh position={[0, 0.09, 0.38]}>
                <boxGeometry args={[0.3, 0.04, 0.01]} />
                <meshStandardMaterial color={battColor} emissive={battColor} emissiveIntensity={0.9} />
            </mesh>
        </group>
    );
}

export default function RoverPreview() {
    const battery  = useStore((s) => s.battery);
    const speed    = useStore((s) => s.speed);
    const isMoving = useStore((s) => s.isMoving);
    const isMining = useStore((s) => s.isMining);
    const isRunning = useStore((s) => s.isRunning);
    const x        = useStore((s) => s.roverX);
    const y        = useStore((s) => s.roverY);
    const dist     = useStore((s) => s.totalDistance);
    const inv      = useStore((s) => s.inventory);
    const route    = useStore((s) => s.route);
    const idx      = useStore((s) => s.routeIdx);

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

            {/* 3D Canvas */}
            <div className="rover-canvas-wrap">
                <Canvas
                    camera={{ position: [1.8, 1.2, 2.2], fov: 40 }}
                    gl={{ antialias: true, alpha: true }}
                    style={{ background: 'transparent' }}
                >
                    <ambientLight intensity={1.2} color="#ccccff" />
                    <directionalLight position={[3, 5, 3]} intensity={1.5} color="#ffffff" />
                    <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#ff9944" />
                    <pointLight position={[0, 2, 0]} intensity={0.8} color="#8899cc" />
                    <Suspense fallback={null}>
                        <RoverModel isMoving={isMoving} isMining={isMining} battery={battery} />
                    </Suspense>
                    <OrbitControls
                        enablePan={false}
                        enableZoom={true}
                        minDistance={1.2}
                        maxDistance={4}
                        autoRotate={!isMoving && !isMining}
                        autoRotateSpeed={1.2}
                    />
                </Canvas>
                <div className="rover-state-badge" style={{ color: stateColor }}>
                    {stateLabel}
                </div>
            </div>

            {/* Stats grid */}
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
                    <div className="rp-mini">
                        <span className="rp-ml">Pozíció</span>
                        <span className="rp-mv">({x}, {y})</span>
                    </div>
                    <div className="rp-mini">
                        <span className="rp-ml">Sebesség</span>
                        <span className="rp-mv" style={{ color: spdColor }}>{spdLabel}</span>
                    </div>
                    <div className="rp-mini">
                        <span className="rp-ml">Megtett út</span>
                        <span className="rp-mv">{dist} blk</span>
                    </div>
                    <div className="rp-mini">
                        <span className="rp-ml">Útvonal</span>
                        <span className="rp-mv">{pct}%</span>
                    </div>
                </div>

                <div className="rp-minerals">
                    <div className="rp-min-item blue">
                        <span>💎</span><span className="rp-min-label">Vízjég</span><b>{inv.B}</b>
                    </div>
                    <div className="rp-min-item yellow">
                        <span>🥇</span><span className="rp-min-label">Arany</span><b>{inv.Y}</b>
                    </div>
                    <div className="rp-min-item green">
                        <span>🪨</span><span className="rp-min-label">Ritka</span><b>{inv.G}</b>
                    </div>
                    <div className="rp-min-item total">
                        <span>📦</span><span className="rp-min-label">Össz.</span><b>{total}</b>
                    </div>
                </div>
            </div>
        </div>
    );
}