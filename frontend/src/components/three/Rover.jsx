import { useRef, Suspense } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useStore } from '../../store/store';
import * as THREE from 'three';

const S = 1;

// Fallback rover (while GLB loads)
function FallbackRover() {
    return (
        <group>
            <mesh castShadow>
                <boxGeometry args={[0.55, 0.16, 0.75]} />
                <meshStandardMaterial color="#e0e0e0" metalness={0.5} roughness={0.35} />
            </mesh>
            {[[-0.3,-0.1,-0.28],[-0.3,-0.1,0],[-0.3,-0.1,0.28],[0.3,-0.1,-0.28],[0.3,-0.1,0],[0.3,-0.1,0.28]].map((pos, i) => (
                <mesh key={i} position={pos} rotation={[0,0,Math.PI/2]} castShadow>
                    <cylinderGeometry args={[0.07,0.07,0.05,10]} />
                    <meshStandardMaterial color="#333" roughness={0.8} />
                </mesh>
            ))}
        </group>
    );
}

function GLBRover({ isMoving, isMining }) {
    const { scene } = useGLTF('/rover2.glb');
    const antennaLight = useRef();

    // Clone and scale to fit in ~0.9 unit bounding box
    const cloned = scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 0.9 / maxDim;
    const center = new THREE.Vector3();
    box.getCenter(center);

    useFrame((state) => {
        if (antennaLight.current)
            antennaLight.current.material.emissiveIntensity = 0.4 + Math.sin(state.clock.elapsedTime * 4) * 0.6;
    });

    return (
        <group>
            <primitive
                object={cloned}
                scale={[scale, scale, scale]}
                position={[-center.x * scale, -center.y * scale, -center.z * scale]}
                castShadow
                receiveShadow
            />
            {/* Antenna blink overlay */}
            <mesh ref={antennaLight} position={[0, size.y * scale * 0.6, 0]}>
                <sphereGeometry args={[0.025, 6, 6]} />
                <meshStandardMaterial color="#ff3333" emissive="#ff3333" emissiveIntensity={0.8} />
            </mesh>
            {isMoving && (
                <spotLight position={[0, 0.1, -0.5]} angle={0.5} penumbra={0.5} intensity={0.5} color="#ffffcc" distance={5} />
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
            <Suspense fallback={<FallbackRover />}>
                <GLBRover isMoving={isMoving} isMining={isMining} />
            </Suspense>
        </group>
    );
}