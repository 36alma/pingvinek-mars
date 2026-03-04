import { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useStore } from '../../store/store';
import Terrain from './Terrain';
import Rover from './Rover';
import PathLine from './PathLine';
import { MAP_SIZE } from '../../simulation/mapData';
import * as THREE from 'three';

/**
 * Dynamic lighting: day → warm orange, night → dark blue
 */
function Lighting() {
    const ambRef = useRef();
    const sunRef = useRef();
    const hemiRef = useRef();
    const tickRef = useRef(0);

    useEffect(() => {
        return useStore.subscribe((s) => { tickRef.current = s.tick; });
    }, []);

    useFrame(() => {
        const tick = tickRef.current;
        const cyclePos = tick % 48;
        const isDay = cyclePos < 32;

        if (isDay) {
            const p = cyclePos / 32;
            let sunIntensity;
            if (p < 0.08) sunIntensity = p / 0.08;
            else if (p > 0.92) sunIntensity = (1 - p) / 0.08;
            else sunIntensity = 1;

            if (ambRef.current) {
                ambRef.current.intensity = 0.35 + sunIntensity * 0.2;
                ambRef.current.color.setHex(0xffd4a0);
            }
            if (sunRef.current) {
                sunRef.current.intensity = sunIntensity * 1.2;
                sunRef.current.color.setHex(p < 0.1 || p > 0.9 ? 0xff8844 : 0xffeedd);
                const angle = p * Math.PI;
                sunRef.current.position.set(
                    Math.cos(angle) * 40,
                    Math.sin(angle) * 50 + 5,
                    -15,
                );
            }
            if (hemiRef.current) {
                hemiRef.current.intensity = 0.15;
                hemiRef.current.color.setHex(0xffd4a0);
            }
        } else {
            const nightPos = (cyclePos - 32) / 16;
            if (ambRef.current) {
                ambRef.current.intensity = 0.7;
                ambRef.current.color.setHex(0x6677bb);
            }
            if (sunRef.current) {
                sunRef.current.intensity = 0.4;
                sunRef.current.color.setHex(0x99aadd);
                const angle = nightPos * Math.PI;
                sunRef.current.position.set(
                    Math.cos(angle + Math.PI) * 40,
                    Math.sin(angle) * 30 + 8,
                    15,
                );
            }
            if (hemiRef.current) {
                hemiRef.current.intensity = 0.3;
                hemiRef.current.color.setHex(0x334477);
            }
        }
    });

    return (
        <>
            <ambientLight ref={ambRef} intensity={0.45} color="#ffd4a0" />
            <directionalLight ref={sunRef} intensity={1} position={[20, 40, -15]} castShadow />
            <hemisphereLight ref={hemiRef} groundColor="#3a1505" intensity={0.15} />
        </>
    );
}

/**
 * Mars atmosphere: stars + fog
 * Only re-renders when day/night phase changes (every 32 ticks)
 */
function Atmosphere() {
    const isDay = useStore((s) => (s.tick % 48) < 32);

    return (
        <>
            <Stars radius={120} depth={60} count={2000} factor={5} saturation={0} fade speed={0.3} />
            <fog attach="fog" args={[isDay ? '#c47040' : '#0a0512', 35, 90]} />
        </>
    );
}

/**
 * Follows the rover by moving only the OrbitControls target.
 * The camera maintains its own spherical offset (zoom/angle) via OrbitControls.
 */
function CameraFollow({ orbitRef }) {
    const roverXRef = useRef(0);
    const roverYRef = useRef(0);
    const targetVec = useRef(new THREE.Vector3());

    useEffect(() => {
        // Initialize from store immediately (not just on change)
        const s = useStore.getState();
        roverXRef.current = s.roverX;
        roverYRef.current = s.roverY;

        return useStore.subscribe((s) => {
            roverXRef.current = s.roverX;
            roverYRef.current = s.roverY;
        });
    }, []);

    useFrame(() => {
        if (!orbitRef.current) return;

        targetVec.current.set(roverXRef.current, 0, roverYRef.current);

        // Lerp the target toward the rover; camera follows automatically via OrbitControls
        orbitRef.current.target.lerp(targetVec.current, 0.08);
        orbitRef.current.update();
    });

    return null;
}

export default function MarsScene() {
    const center = MAP_SIZE / 2 - 0.5;
    const orbitRef = useRef();

    // Start camera above the rover's initial position (= startX, startY from store)
    const { startX, startY } = useStore.getState();

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Canvas
                camera={{ position: [startX, 40, startY + 35], fov: 45, near: 0.1, far: 250 }}
                shadows={{ type: 'PCFSoftShadowMap' }}
                gl={{ antialias: false, toneMapping: 3, powerPreference: 'high-performance' }}
                style={{ background: '#120808' }}
                frameloop="always"
                performance={{ min: 0.5 }}
            >
                <Lighting />
                <Atmosphere />
                <Terrain />
                <Rover />
                <PathLine />
                <CameraFollow orbitRef={orbitRef} />
                <OrbitControls
                    ref={orbitRef}
                    target={[startX, 0, startY]}
                    maxDistance={90}
                    minDistance={4}
                    maxPolarAngle={Math.PI / 2.05}
                    enableDamping
                    dampingFactor={0.06}
                />
            </Canvas>
        </div>
    );
}