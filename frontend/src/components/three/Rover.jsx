import { useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useStore } from '../../store/store';
import * as THREE from 'three';

const S = 1;

// Preload all rover models
useGLTF.preload('/rover_alaphelyzet.glb');
useGLTF.preload('/rover_mozog.glb');
useGLTF.preload('/rover_allo.glb');
useGLTF.preload('/rover_fur.glb');

function fitScene(scene, targetSize = 0.9) {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? targetSize / maxDim : 1;
    const center = new THREE.Vector3();
    box.getCenter(center);
    return { scale, offset: center };
}

function RoverModel({ path }) {
    const { scene } = useGLTF(path);
    const { cloned, scale, offset } = useMemo(() => {
        const c = scene.clone(true);
        const { scale, offset } = fitScene(c);
        return { cloned: c, scale, offset };
    }, [scene]);

    return (
        <primitive
            object={cloned}
            scale={[scale, scale, scale]}
            position={[-offset.x * scale, -offset.y * scale, -offset.z * scale]}
            castShadow receiveShadow
        />
    );
}

function FallbackRover() {
    return (
        <group>
            <mesh castShadow>
                <boxGeometry args={[0.55, 0.16, 0.75]} />
                <meshStandardMaterial color="#e0e0e0" metalness={0.5} roughness={0.35} />
            </mesh>
            {[[-0.3,-0.1,-0.28],[-0.3,-0.1,0],[-0.3,-0.1,0.28],
              [0.3,-0.1,-0.28],[0.3,-0.1,0],[0.3,-0.1,0.28]].map((pos, i) => (
                <mesh key={i} position={pos} rotation={[0,0,Math.PI/2]} castShadow>
                    <cylinderGeometry args={[0.07,0.07,0.05,10]} />
                    <meshStandardMaterial color="#333" roughness={0.8} />
                </mesh>
            ))}
        </group>
    );
}

function ActiveRoverModel({ isMoving, isMining, isRunning }) {
    let path = '/rover_alaphelyzet.glb';
    if (isMining)       path = '/rover_fur.glb';
    else if (isMoving)  path = '/rover_mozog.glb';
    else if (isRunning) path = '/rover_allo.glb';
    return <RoverModel key={path} path={path} />;
}

export default function Rover() {
    const group     = useRef();
    const roverX    = useStore((s) => s.roverX);
    const roverY    = useStore((s) => s.roverY);
    const isMoving  = useStore((s) => s.isMoving);
    const isMining  = useStore((s) => s.isMining);
    const isRunning = useStore((s) => s.isRunning);
    const simSpeed  = useStore((s) => s.simSpeed);

    useFrame((_, delta) => {
        if (!group.current) return;
        const tx = roverX * S;
        const tz = roverY * S;

        // Delta-based lerp: framerate independent, scales with simSpeed
        const lerpT = 1 - Math.pow(0.001, delta * Math.min(simSpeed, 10) * 2);

        const curr = group.current.position;
        curr.x += (tx - curr.x) * lerpT;
        curr.z += (tz - curr.z) * lerpT;

        const dx = tx - curr.x;
        const dz = tz - curr.z;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
            const target = Math.atan2(dx, dz);
            let diff = target - group.current.rotation.y;
            while (diff >  Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            group.current.rotation.y += diff * lerpT;
        }

        const targetY = isMining ? 0.22 : 0.18;
        curr.y += (targetY - curr.y) * lerpT;
    });

    return (
        <group ref={group} position={[roverX * S, 0.18, roverY * S]}>
            <Suspense fallback={<FallbackRover />}>
                <ActiveRoverModel isMoving={isMoving} isMining={isMining} isRunning={isRunning} />
            </Suspense>
            {isMoving && (
                <spotLight position={[0, 0.15, -0.5]} angle={0.45} penumbra={0.6}
                    intensity={0.6} color="#ffffcc" distance={6} />
            )}
        </group>
    );
}