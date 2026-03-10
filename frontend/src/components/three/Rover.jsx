import { useRef, Suspense } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useStore } from '../../store/store';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

const S = 1;

function FallbackRover({ isMoving, isMining }) {
    const wheels = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
    const panelRef = useRef();
    const antennaLight = useRef();

    useFrame((state, delta) => {
        wheels.forEach((w) => {
            if (w.current) w.current.rotation.x += (isMoving ? delta * 5 : 0);
        });
        if (panelRef.current)
            panelRef.current.rotation.x = -0.15 + Math.sin(state.clock.elapsedTime * 0.4) * 0.03;
        if (antennaLight.current)
            antennaLight.current.material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 4) * 0.5;
    });

    return (
        <group>
            <mesh castShadow>
                <boxGeometry args={[0.55, 0.16, 0.75]} />
                <meshStandardMaterial color="#e0e0e0" emissive="#666666" emissiveIntensity={0.3} metalness={0.5} roughness={0.35} />
            </mesh>
            <group ref={panelRef} position={[0, 0.22, 0.1]}>
                <mesh castShadow>
                    <boxGeometry args={[0.75, 0.015, 0.5]} />
                    <meshStandardMaterial color="#1a237e" emissive="#1a237e" emissiveIntensity={0.4} />
                </mesh>
            </group>
            {[[-0.3,-0.1,-0.28],[-0.3,-0.1,0],[-0.3,-0.1,0.28],[0.3,-0.1,-0.28],[0.3,-0.1,0],[0.3,-0.1,0.28]].map((pos, i) => (
                <mesh key={i} ref={wheels[i]} position={pos} rotation={[0,0,Math.PI/2]} castShadow>
                    <cylinderGeometry args={[0.07,0.07,0.05,10]} />
                    <meshStandardMaterial color="#333" roughness={0.8} />
                </mesh>
            ))}
            <mesh ref={antennaLight} position={[0.18,0.37,0.25]}>
                <sphereGeometry args={[0.022,6,6]} />
                <meshStandardMaterial color="#ff3333" emissive="#ff3333" emissiveIntensity={0.5} />
            </mesh>
        </group>
    );
}

function STLRover({ isMoving, isMining }) {
    const geometry = useLoader(STLLoader, '/rover2.stl');
    const antennaLight = useRef();

    const { scale, offset } = (() => {
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const s = 0.9 / maxDim;
        const c = new THREE.Vector3();
        box.getCenter(c);
        return { scale: s, offset: c };
    })();

    useFrame((state) => {
        if (antennaLight.current)
            antennaLight.current.material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 4) * 0.5;
    });

    return (
        <group>
            <mesh
                geometry={geometry}
                castShadow
                receiveShadow
                scale={[scale, scale, scale]}
                position={[-offset.x * scale, -offset.y * scale, -offset.z * scale]}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <meshStandardMaterial color="#c8c8c8" emissive="#444" emissiveIntensity={0.2} metalness={0.45} roughness={0.5} />
            </mesh>
            <mesh ref={antennaLight} position={[0, 0.5, 0]}>
                <sphereGeometry args={[0.025, 6, 6]} />
                <meshStandardMaterial color="#ff3333" emissive="#ff3333" emissiveIntensity={0.8} />
            </mesh>
            {isMoving && (
                <spotLight position={[0, 0.1, -0.5]} angle={0.5} penumbra={0.5} intensity={0.4} color="#ffffcc" distance={4} />
            )}
        </group>
    );
}

export default function Rover() {
    const group = useRef();
    const roverX = useStore((s) => s.roverX);
    const roverY = useStore((s) => s.roverY);
    const isMoving = useStore((s) => s.isMoving);
    const isMining = useStore((s) => s.isMining);

    useFrame((state) => {
        if (!group.current) return;
        const tx = roverX * S;
        const tz = roverY * S;
        const curr = group.current.position;
        curr.x += (tx - curr.x) * 0.08;
        curr.z += (tz - curr.z) * 0.08;

        const dx = tx - curr.x;
        const dz = tz - curr.z;
        if (Math.abs(dx) > 0.02 || Math.abs(dz) > 0.02) {
            const target = Math.atan2(dx, dz);
            let diff = target - group.current.rotation.y;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            group.current.rotation.y += diff * 0.08;
        }

        if (isMining) {
            group.current.position.y = 0.18 + Math.sin(state.clock.elapsedTime * 8) * 0.015;
        } else {
            group.current.position.y += (0.18 - group.current.position.y) * 0.1;
        }
    });

    return (
        <group ref={group} position={[roverX * S, 0.18, roverY * S]}>
            <Suspense fallback={<FallbackRover isMoving={isMoving} isMining={isMining} />}>
                <STLRover isMoving={isMoving} isMining={isMining} />
            </Suspense>
        </group>
    );
}