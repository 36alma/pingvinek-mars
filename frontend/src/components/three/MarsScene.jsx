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
                ambRef.current.intensity = 1.4;
                ambRef.current.color.setHex(0x8899cc);
            }
            if (sunRef.current) {
                sunRef.current.intensity = 0.8;
                sunRef.current.color.setHex(0xaabbee);
                const angle = nightPos * Math.PI;
                sunRef.current.position.set(
                    Math.cos(angle + Math.PI) * 40,
                    Math.sin(angle) * 30 + 8,
                    15,
                );
            }
            if (hemiRef.current) {
                hemiRef.current.intensity = 0.5;
                hemiRef.current.color.setHex(0x5566aa);
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
 * Visible Sun sphere that orbits the map in sync with the day/night tick
 */
function Sun() {
    const groupRef = useRef();
    const glowRef = useRef();
    const tickRef = useRef(0);
    const center = MAP_SIZE / 2 - 0.5;

    useEffect(() => {
        return useStore.subscribe((s) => { tickRef.current = s.tick; });
    }, []);

    useFrame((state) => {
        if (!groupRef.current) return;
        const tick = tickRef.current;
        const cyclePos = tick % 48;
        const t = state.clock.elapsedTime;

        // Full orbit: day arc (0→PI) then dip below horizon at night
        const dayFrac = cyclePos / 48;
        const angle = dayFrac * Math.PI * 2 - Math.PI / 2;
        const orbitR = 95;
        const orbitH = 60;

        groupRef.current.position.set(
            center + Math.cos(angle) * orbitR,
            Math.sin(angle) * orbitH,
            center - 15,
        );

        // Pulse glow
        if (glowRef.current) {
            const pulse = 1 + Math.sin(t * 1.5) * 0.08;
            glowRef.current.scale.setScalar(pulse);
        }

        // Color: orange at horizon, bright white-yellow at zenith
        const elevation = Math.sin(angle); // -1..1
        const col = new THREE.Color();
        if (elevation > 0) {
            col.lerpColors(new THREE.Color(0xff6622), new THREE.Color(0xffffc0), elevation);
        } else {
            col.set(0x221100); // below horizon: dark
        }
        if (groupRef.current.children[0]?.material) {
            groupRef.current.children[0].material.emissive.copy(col);
            groupRef.current.children[0].material.color.copy(col);
        }
        if (glowRef.current?.material) {
            glowRef.current.material.color.copy(col);
            glowRef.current.material.opacity = Math.max(0, elevation) * 0.25;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Core sun sphere */}
            <mesh>
                <sphereGeometry args={[3.5, 24, 24]} />
                <meshStandardMaterial
                    color="#ffffa0"
                    emissive="#ffcc00"
                    emissiveIntensity={2.5}
                    roughness={0}
                    metalness={0}
                />
            </mesh>
            {/* Glow halo */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[6.5, 16, 16]} />
                <meshBasicMaterial
                    color="#ffaa00"
                    transparent
                    opacity={0.18}
                    side={THREE.BackSide}
                    depthWrite={false}
                />
            </mesh>
            {/* Outer corona */}
            <mesh>
                <sphereGeometry args={[9, 12, 12]} />
                <meshBasicMaterial
                    color="#ff8800"
                    transparent
                    opacity={0.07}
                    side={THREE.BackSide}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}

/**
 * Space skybox: nebula-like colored dust clouds around the scene
 */
function SpaceSkybox() {
    const center = MAP_SIZE / 2 - 0.5;

    // Generate nebula cloud positions deterministically
    const clouds = useRef(() => {
        const arr = [];
        const rng = (s) => { let x = Math.sin(s) * 43758.5453; return x - Math.floor(x); };
        const colors = [0x1a0a2e, 0x0a1a2e, 0x2e0a0a, 0x0a2e1a, 0x1a1a3e];
        for (let i = 0; i < 18; i++) {
            arr.push({
                x: center + (rng(i * 3.1) - 0.5) * 380,
                y: 20 + rng(i * 7.3) * 120,
                z: center + (rng(i * 5.7) - 0.5) * 380,
                scale: 25 + rng(i * 2.9) * 60,
                color: colors[i % colors.length],
                opacity: 0.04 + rng(i * 4.1) * 0.08,
            });
        }
        return arr;
    }).current();

    return (
        <group>
            {/* Nebula dust clouds */}
            {clouds.map((c, i) => (
                <mesh key={i} position={[c.x, c.y, c.z]}>
                    <sphereGeometry args={[c.scale, 7, 7]} />
                    <meshBasicMaterial
                        color={c.color}
                        transparent
                        opacity={c.opacity}
                        side={THREE.BackSide}
                        depthWrite={false}
                    />
                </mesh>
            ))}
        </group>
    );
}

/**
 * Mars atmosphere: stars + fog
 */
function Atmosphere() {
    const isDay = useStore((s) => (s.tick % 48) < 32);

    return (
        <>
            <Stars radius={160} depth={80} count={3500} factor={6} saturation={0.3} fade speed={0.2} />
            <fog attach="fog" args={[isDay ? '#c47040' : '#1a1a3a', 35, 90]} />
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
        orbitRef.current.target.lerp(targetVec.current, 0.08);
        orbitRef.current.update();
    });

    return null;
}

export default function MarsScene() {
    const center = MAP_SIZE / 2 - 0.5;
    const orbitRef = useRef();
    const { startX, startY } = useStore.getState();

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Canvas
                camera={{ position: [startX, 40, startY + 35], fov: 45, near: 0.1, far: 500 }}
                shadows={{ type: 'PCFSoftShadowMap' }}
                gl={{ antialias: false, toneMapping: 1, toneMappingExposure: 1.2, powerPreference: 'high-performance' }}
                style={{ background: '#020408' }}
                frameloop="always"
                performance={{ min: 0.5 }}
            >
                <Lighting />
                <Atmosphere />
                <SpaceSkybox />
                <Sun />
                <Terrain />
                <Rover />
                <PathLine />
                <CameraFollow orbitRef={orbitRef} />
                <OrbitControls
                    ref={orbitRef}
                    target={[startX, 0, startY]}
                    maxDistance={120}
                    minDistance={4}
                    maxPolarAngle={Math.PI / 2.05}
                    enableDamping
                    dampingFactor={0.06}
                />
            </Canvas>
        </div>
    );
}