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
        <primitive
            object={cloned}
            scale={[scale, scale, scale]}
            position={[-offset.x * scale, -offset.y * scale, -offset.z * scale]}
            castShadow receiveShadow
        />
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
    const group       = useRef();
    const progressRef = useRef(1);
    const tickRef     = useRef(-1);
    // Store the direction we computed at tick start — don't recompute mid-lerp
    const facingRef   = useRef(null);

    const roverX    = useStore((s) => s.roverX);
    const roverY    = useStore((s) => s.roverY);
    const prevX     = useStore((s) => s.prevRoverX);
    const prevY     = useStore((s) => s.prevRoverY);
    const isMoving  = useStore((s) => s.isMoving);
    const isMining  = useStore((s) => s.isMining);
    const isRunning = useStore((s) => s.isRunning);
    const simSpeed  = useStore((s) => s.simSpeed);
    const tick      = useStore((s) => s.tick);

    useFrame((_, delta) => {
        if (!group.current) return;

        // ── New tick detected ─────────────────────────────
        if (tick !== tickRef.current) {
            tickRef.current = tick;
            progressRef.current = 0;

            // Compute direction ONCE at tick start from prev→current
            const dx = roverX - prevX;  // map x diff
            const dz = roverY - prevY;  // map y diff → 3D z diff
            if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
                // In Three.js: map +X → 3D +X, map +Y → 3D +Z
                // atan2(x, z) gives angle around Y axis (0 = forward/+Z)
                facingRef.current = Math.atan2(dx, dz);
            }
            // If no movement (mine/stand tick) keep last facing
        }

        // ── Interpolate position ──────────────────────────
        const tickSec = (400 / Math.max(simSpeed, 1)) / 1000;
        progressRef.current = Math.min(1, progressRef.current + delta / tickSec);
        const t = progressRef.current;

        const ix = (prevX + (roverX - prevX) * t) * S;
        const iz = (prevY + (roverY - prevY) * t) * S;
        group.current.position.x = ix;
        group.current.position.z = iz;

        // ── Y height ──────────────────────────────────────
        const targetY = isMining ? 0.22 : 0.18;
        group.current.position.y += (targetY - group.current.position.y) * Math.min(1, delta * 8);

        // ── Rotation: snap toward stored facing ──────────
        if (facingRef.current !== null) {
            let diff = facingRef.current - group.current.rotation.y;
            while (diff >  Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            // Fast rotation — complete within first 30% of the tick
            group.current.rotation.y += diff * Math.min(1, delta * 15);
        }
    });

    return (
        <group ref={group} position={[roverX * S, 0.18, roverY * S]}>
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