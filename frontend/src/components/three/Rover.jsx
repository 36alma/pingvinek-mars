import { useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useStore } from '../../store/store';
import * as THREE from 'three';

const S = 1;

useGLTF.preload('/rover_alaphelyzet.glb');
useGLTF.preload('/rover_mozog.glb');
useGLTF.preload('/rover_allo.glb');
useGLTF.preload('/rover_fur.glb');

const ARM_ROOT_NAME = 'Csontváz';

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
        c.traverse((obj) => { if (obj.name === ARM_ROOT_NAME) obj.visible = false; });
        const { scale, offset } = fitScene(c);
        return { cloned: c, scale, offset };
    }, [scene]);
    return (
        // -90° Y rotation baked into the model wrapper
        // The parent group handles world-space facing
        <group rotation={[0, -Math.PI / 2, 0]}>
            <primitive
                object={cloned}
                scale={[scale, scale, scale]}
                position={[-offset.x * scale, -offset.y * scale, -offset.z * scale]}
                castShadow receiveShadow
            />
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
    const group      = useRef();
    const progressRef = useRef(1);
    const tickRef    = useRef(-1);
    const facingRef  = useRef(0);

    const roverX    = useStore((s) => s.roverX);
    const roverY    = useStore((s) => s.roverY);
    const prevX     = useStore((s) => s.prevRoverX);
    const prevY     = useStore((s) => s.prevRoverY);
    const isMoving  = useStore((s) => s.isMoving);
    const isMining  = useStore((s) => s.isMining);
    const isRunning = useStore((s) => s.isRunning);
    const simSpeed  = useStore((s) => s.simSpeed);
    const tick      = useStore((s) => s.tick);

    // Initialise group position immediately (before first useFrame)
    // so the rover appears exactly on the start tile, no slide-in
    const initPos = useRef(false);

    useFrame((_, delta) => {
        if (!group.current) return;

        // Snap to start position on very first frame
        if (!initPos.current) {
            group.current.position.set(roverX * S, 0.18, roverY * S);
            group.current.rotation.y = facingRef.current;
            initPos.current = true;
        }

        // ── New tick ──────────────────────────────────────
        if (tick !== tickRef.current) {
            tickRef.current = tick;
            progressRef.current = 0;

            const dx = roverX - prevX;
            const dz = roverY - prevY;
            if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
                facingRef.current = Math.atan2(dx, dz);
            }
        }

        // ── Position interpolation ────────────────────────
        // Diagonal steps (dx=±1, dz=±1) cover sqrt(2) ≈ 1.414 world units
        // Cardinal steps cover 1 world unit — same tick duration either way
        // t goes 0→1 in tickSec regardless of step distance, so interpolation
        // automatically moves faster for diagonal steps visually ✓
        const tickSec = (400 / Math.max(simSpeed, 1)) / 1000;
        progressRef.current = Math.min(1, progressRef.current + delta / tickSec);
        const t = progressRef.current;

        group.current.position.x = (prevX + (roverX - prevX) * t) * S;
        group.current.position.z = (prevY + (roverY - prevY) * t) * S;

        // ── Y height ──────────────────────────────────────
        const targetY = isMining ? 0.22 : 0.18;
        group.current.position.y +=
            (targetY - group.current.position.y) * Math.min(1, delta * 8);

        // ── Rotation ──────────────────────────────────────
        let diff = facingRef.current - group.current.rotation.y;
        while (diff >  Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        group.current.rotation.y += diff * Math.min(1, delta * 15);
    });

    return (
        <group ref={group}>
            <Suspense fallback={null}>
                <ActiveRoverModel isMoving={isMoving} isMining={isMining} isRunning={isRunning} />
            </Suspense>
            {isMoving && (
                <spotLight position={[0, 0.15, -0.5]} angle={0.45} penumbra={0.6}
                    intensity={0.6} color="#ffffcc" distance={6} />
            )}
        </group>
    );
}