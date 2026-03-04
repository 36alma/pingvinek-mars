import SimControls from './SimControls';
import BatteryGauge from './BatteryGauge';
import TimeDisplay from './TimeDisplay';
import StatsPanel from './StatsPanel';
import Charts from './Charts';
import EventLog from './EventLog';

export default function Dashboard({ side }) {
    if (side === 'left') {
        return (
            <div className="dashboard">
                <div className="dash-header">
                    <h2>🔴 MISSION CONTROL</h2>
                    <p>Vezérlőpult</p>
                </div>
                <div className="dash-grid">
                    <SimControls />
                    <TimeDisplay />
                    <BatteryGauge />
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dash-header">
                <h2>📡 ROVER ADATOK</h2>
                <p>Telemetria & Napló</p>
            </div>
            <div className="dash-grid">
                <StatsPanel />
                <Charts />
                <EventLog />
            </div>
        </div>
    );
}