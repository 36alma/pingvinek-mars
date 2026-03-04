import SimControls from './SimControls';
import BatteryGauge from './BatteryGauge';
import TimeDisplay from './TimeDisplay';
import StatsPanel from './StatsPanel';
import Charts from './Charts';
import EventLog from './EventLog';

export default function Dashboard() {
    return (
        <div className="dashboard">
            <div className="dash-header">
                <h2>🔴 MARS ROVER MISSION CONTROL</h2>
                <p>Pingvinek csapat — Földi megfigyelő állomás</p>
            </div>
            <div className="dash-grid">
                <SimControls />
                <TimeDisplay />
                <BatteryGauge />
                <StatsPanel />
                <Charts />
                <EventLog />
            </div>
        </div>
    );
}
