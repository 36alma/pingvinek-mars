import MarsScene from './components/three/MarsScene';
import Dashboard from './components/dashboard/Dashboard';
import './App.css';

export default function App() {
    return (
        <div className="app">
            <header className="topbar">
                <div className="topbar-left">
                    <span className="topbar-dot" />
                    <h1 className="topbar-title">MARS ROVER</h1>
                    <span className="topbar-tag">SZIMULÁCIÓ</span>
                </div>
                <div className="topbar-right">
                    <span className="topbar-team">🐧 Pingvinek</span>
                    <span className="topbar-ver">v2.0</span>
                </div>
            </header>

            <main className="layout">
                <aside className="pane-dash pane-dash--left">
                    <Dashboard side="left" />
                </aside>
                <section className="pane-3d">
                    <MarsScene />
                </section>
                <aside className="pane-dash pane-dash--right">
                    <Dashboard side="right" />
                </aside>
            </main>
        </div>
    );
}