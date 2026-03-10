import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import './LandingPage.css';

export default function LandingPage({ onEnter }) {
    const [phase, setPhase]       = useState('idle');    // idle → counting → exiting
    const [apiStatus, setApiStatus] = useState('loading'); // loading | ok | fallback
    const loadMapFromApi = useStore((s) => s.loadMapFromApi);

    useEffect(() => {
        // Kick off reveal animation
        const t1 = setTimeout(() => setPhase('counting'), 100);

        // Fetch map from API
        loadMapFromApi().then(({ source }) => {
            setApiStatus(source === 'api' ? 'ok' : 'fallback');
        });

        // Auto-dismiss after 3s regardless of API result
        const t2 = setTimeout(() => setPhase('exiting'), 3100);
        const t3 = setTimeout(() => onEnter(), 3900);

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, []);

    const apiLabel = {
        loading:  '⏳ Térkép betöltése...',
        ok:       '✅ Térkép betöltve a szerverről',
        fallback: '⚠ Szerver nem elérhető — helyi térkép',
    }[apiStatus];

    const apiColor = { loading: '#e05a2088', ok: '#39ff14', fallback: '#ffc107' }[apiStatus];

    return (
        <div className={`lp-root ${phase === 'exiting' ? 'lp-exit' : ''}`}>

            {/* Mars surface terrain — pure CSS layers */}
            <div className="lp-bg">
                <div className="lp-bg-sky" />
                <div className="lp-bg-dust" />
                <div className="lp-bg-horizon" />
                <div className="lp-bg-ground" />
                <div className="lp-bg-rocks">
                    {[...Array(14)].map((_, i) => (
                        <div key={i} className={`lp-rock lp-rock--${i % 5}`} style={{
                            left: `${6 + i * 6.8 + (i % 3) * 2.1}%`,
                            bottom: `${14 + (i % 4) * 3}%`,
                            '--s': `${0.5 + (i % 5) * 0.35}`,
                        }} />
                    ))}
                </div>
                {/* Dust particles */}
                {[...Array(28)].map((_, i) => (
                    <div key={i} className="lp-particle" style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${(i * 0.37) % 4}s`,
                        animationDuration: `${5 + (i % 5)}s`,
                        '--x': `${(i % 2 === 0 ? 1 : -1) * (20 + i % 30)}px`,
                    }} />
                ))}
                {/* Stars */}
                {[...Array(60)].map((_, i) => (
                    <div key={i} className="lp-star" style={{
                        left: `${(i * 17.3) % 100}%`,
                        top: `${(i * 11.7) % 45}%`,
                        animationDelay: `${(i * 0.2) % 3}s`,
                    }} />
                ))}
            </div>

            {/* Scan lines overlay */}
            <div className="lp-scanlines" />
            {/* Vignette */}
            <div className="lp-vignette" />

            {/* HUD corner decorations */}
            <div className="lp-hud lp-hud--tl">
                <span className="lp-hud-line lp-hud-line--h" />
                <span className="lp-hud-line lp-hud-line--v" />
            </div>
            <div className="lp-hud lp-hud--tr">
                <span className="lp-hud-line lp-hud-line--h" />
                <span className="lp-hud-line lp-hud-line--v" />
            </div>
            <div className="lp-hud lp-hud--bl">
                <span className="lp-hud-line lp-hud-line--h" />
                <span className="lp-hud-line lp-hud-line--v" />
            </div>
            <div className="lp-hud lp-hud--br">
                <span className="lp-hud-line lp-hud-line--h" />
                <span className="lp-hud-line lp-hud-line--v" />
            </div>

            {/* Top telemetry bar */}
            <div className="lp-telemetry">
                <span className="lp-tel-item">SOL 001</span>
                <span className="lp-tel-sep">·</span>
                <span className="lp-tel-item">KOORDINÁTA 25.0°N 184.7°E</span>
                <span className="lp-tel-sep">·</span>
                <span className="lp-tel-item lp-tel-live">● ÉLŐ</span>
            </div>

            {/* Main content */}
            <div className={`lp-content ${phase !== 'idle' ? 'lp-content--visible' : ''}`}>

                <div className="lp-eyebrow">
                    <span className="lp-eyebrow-line" />
                    <span className="lp-eyebrow-text">PINGVINEK CSAPAT — MARS MISSZIÓ</span>
                    <span className="lp-eyebrow-line" />
                </div>

                <h1 className="lp-title">
                    <span className="lp-title-word lp-title-word--1">Penguin</span>
                    <span className="lp-title-word lp-title-word--2">Expedition</span>
                </h1>

                <p className="lp-subtitle">
                    Fedezd fel a marsi ásványok gyűjtésének kihívásait<br />
                    valós idejű szimulációban
                </p>

                <button className="lp-btn" onClick={() => { setPhase('exiting'); setTimeout(onEnter, 800); }}>
                    <span className="lp-btn-text">Fedezd fel a szimulációt</span>
                    <span className="lp-btn-arrow">→</span>
                </button>

                <div className="lp-countdown">
                    <span className="lp-countdown-text">Automatikus betöltés</span>
                    <div className="lp-countdown-bar">
                        <div className={`lp-countdown-fill ${phase === 'counting' ? 'lp-countdown-fill--run' : ''}`} />
                    </div>
                    <span className="lp-api-status" style={{ color: apiColor }}>{apiLabel}</span>
                </div>
            </div>

            {/* Bottom status */}
            <div className="lp-status-bar">
                <span>AKKUMULÁTOR: 100%</span>
                <span>SEBESSÉG: KÉSZENÁLL</span>
                <span>NAVIGÁCIÓ: A* AKTÍV</span>
                <span>KAPCSOLAT: OK</span>
            </div>
        </div>
    );
}