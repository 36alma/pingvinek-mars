import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../../store/store';

const S = 1;

export default function Rover() {
    const group = useRef();
    const wheels = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
    const panelRef = useRef();
    const antennaLight = useRef();

    const roverX = useStore((s) => s.roverX);
    const roverY = useStore((s) => s.roverY);
    const isMoving = useStore((s) => s.isMoving);
    const isMining = useStore((s) => s.isMining);

    useFrame((state, delta) => {
        if (!group.current) return;

        // Smooth position lerp
        const tx = roverX * S;
        const tz = roverY * S;
        const curr = group.current.position;
        curr.x += (tx - curr.x) * 0.08;
        curr.z += (tz - curr.z) * 0.08;

        // Face direction of movement
        const dx = tx - curr.x;
        const dz = tz - curr.z;
        if (Math.abs(dx) > 0.02 || Math.abs(dz) > 0.02) {
            const target = Math.atan2(dx, dz);
            let diff = target - group.current.rotation.y;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            group.current.rotation.y += diff * 0.08;
        }

        // Wheel spin
        wheels.forEach((w) => {
            if (w.current) w.current.rotation.x += (isMoving ? delta * 5 : 0);
        });

        // Solar panel tilt
        if (panelRef.current) {
            panelRef.current.rotation.x = -0.15 + Math.sin(state.clock.elapsedTime * 0.4) * 0.03;
        }

        // Antenna blink
        if (antennaLight.current) {
            antennaLight.current.material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 4) * 0.5;
        }

        // Mining bobble
        if (isMining) {
            group.current.position.y = 0.18 + Math.sin(state.clock.elapsedTime * 8) * 0.015;
        } else {
            group.current.position.y += (0.18 - group.current.position.y) * 0.1;
        }
    });

    return (
        <group ref={group} position={[roverX * S, 0.18, roverY * S]}>
            {/* Body chassis */}
            <mesh castShadow>
                <boxGeometry args={[0.55, 0.16, 0.75]} />
                <meshStandardMaterial color="#e0e0e0" metalness={0.5} roughness={0.35} />
            </mesh>
            {/* Body top */}
            <mesh position={[0, 0.1, -0.05]} castShadow>
                <boxGeometry args={[0.42, 0.1, 0.5]} />
                <meshStandardMaterial color="#d0d0d0" metalness={0.4} roughness={0.4} />
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
                    <meshStandardMaterial color="#1a237e" metalness={0.3} roughness={0.3} />
                </mesh>
                {/* Panel detail lines */}
                {[-0.2, 0, 0.2].map((z, i) => (
                    <mesh key={i} position={[0, 0.009, z]}>
                        <boxGeometry args={[0.73, 0.003, 0.01]} />
                        <meshStandardMaterial color="#3949ab" />
                    </mesh>
                ))}
            </group>

            {/* 6 wheels (3 per side) */}
            {[
                [-0.3, -0.1, -0.28],
                [-0.3, -0.1, 0],
                [-0.3, -0.1, 0.28],
                [0.3, -0.1, -0.28],
                [0.3, -0.1, 0],
                [0.3, -0.1, 0.28],
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
                <meshStandardMaterial color="#ff3333" emissive="#ff3333" emissiveIntensity={0.5} />
            </mesh>

            {/* Headlights */}
            {[-0.16, 0.16].map((x, i) => (
                <mesh key={i} position={[x, -0.02, -0.38]}>
                    <sphereGeometry args={[0.025, 6, 6]} />
                    <meshStandardMaterial
                        color="#ffffdd"
                        emissive="#ffffdd"
                        emissiveIntensity={isMoving ? 1 : 0.2}
                    />
                </mesh>
            ))}
            {isMoving && (
                <spotLight
                    position={[0, 0.05, -0.5]}
                    target-position={[0, 0, -3]}
                    angle={0.5}
                    penumbra={0.5}
                    intensity={0.4}
                    color="#ffffcc"
                    distance={4}
                />
            )}
        </group>
    );
}
