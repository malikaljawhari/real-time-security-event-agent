import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Camera,
  DoorOpen,
  CreditCard,
  Activity,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  PlusCircle,
  Code2,
  Terminal,
  Server,
  Layers,
  Eye,
  X,
  RefreshCw,
} from 'lucide-react';

export type Severity = 'Critical' | 'Warning' | 'Info';
export type EventStatus = 'Open' | 'Acknowledged' | 'Resolved';
export type DeviceType = 'Camera' | 'DoorSensor' | 'POSTerminal' | 'MotionSensor';
export type EventType =
  | 'motion_after_hours'
  | 'door_forced'
  | 'pos_high_void'
  | 'camera_offline'
  | 'routine_patrol_check';

export interface SensorMetadata {
  consecutiveTriggers?: number;
  confidenceScore?: number;
  transactionAmountCad?: number;
  doorOpenDurationSec?: number;
  lastHeartbeatSecAgo?: number;
}

export interface SensorPayload {
  deviceId: string;
  deviceType: DeviceType;
  eventType: EventType;
  location: string;
  timestamp?: string;
  metadata?: SensorMetadata;
}

export interface SecurityEvent {
  id: string;
  deviceId: string;
  deviceType: DeviceType;
  eventType: EventType;
  location: string;
  timestamp: string;
  severity: Severity;
  status: EventStatus;
  agentSummary: string;
  ruleTriggered: string;
  metadata: SensorMetadata;
}

let eventCounter = 1040;

function evaluateTelemetryPayload(payload: SensorPayload): SecurityEvent {
  eventCounter += 1;
  const timestamp = payload.timestamp || new Date().toISOString();
  const metadata = payload.metadata || {};

  let severity: Severity = 'Info';
  let ruleTriggered = 'RULE_STANDARD_TELEMETRY_LOG';
  let agentSummary = `Routine event (${payload.eventType}) logged at ${payload.location} by ${payload.deviceId}.`;

  switch (payload.eventType) {
    case 'motion_after_hours': {
      const triggers = metadata.consecutiveTriggers ?? 1;
      const confidence = Math.round((metadata.confidenceScore ?? 0.88) * 100);
      if (triggers >= 3) {
        severity = 'Critical';
        ruleTriggered = 'RULE_AFTER_HOURS_MULTI_MOTION';
        agentSummary = `Critical Alert: ${triggers} consecutive after-hours motion triggers detected at ${payload.location} (${payload.deviceId}) with ${confidence}% optical confidence. Immediate camera clip review recommended.`;
      } else {
        severity = 'Warning';
        ruleTriggered = 'RULE_AFTER_HOURS_SINGLE_MOTION';
        agentSummary = `Warning: Isolated after-hours motion detected at ${payload.location} (${payload.deviceId}, ${confidence}% confidence). Monitoring for repeat triggers.`;
      }
      break;
    }
    case 'door_forced': {
      const duration = metadata.doorOpenDurationSec ?? 45;
      severity = 'Critical';
      ruleTriggered = 'RULE_FORCED_ENTRY_CONTACT';
      agentSummary = `Critical Alert: Forced door contact without valid badge scan at ${payload.location} (${payload.deviceId}). Door held open for ${duration}s—cross-reference adjacent camera feed immediately.`;
      break;
    }
    case 'pos_high_void': {
      const amount = metadata.transactionAmountCad ?? 215.5;
      if (amount >= 150) {
        severity = 'Critical';
        ruleTriggered = 'RULE_POS_HIGH_VALUE_VOID';
        agentSummary = `Critical Shrink Risk: High-value POS void ($${amount.toFixed(2)} CAD) recorded at ${payload.location} (${payload.deviceId}) without supervisor override token. Flagged for register video audit.`;
      } else {
        severity = 'Warning';
        ruleTriggered = 'RULE_POS_STANDARD_VOID';
        agentSummary = `Warning: POS refund/void of $${amount.toFixed(2)} CAD logged at ${payload.location} (${payload.deviceId}).`;
      }
      break;
    }
    case 'camera_offline': {
      const offlineSec = metadata.lastHeartbeatSecAgo ?? 120;
      severity = 'Warning';
      ruleTriggered = 'RULE_DEVICE_HEARTBEAT_LOSS';
      agentSummary = `Device Health Warning: Stream heartbeat lost for ${payload.deviceId} at ${payload.location} (${offlineSec}s elapsed). Verify PoE switch port and local network link.`;
      break;
    }
    case 'routine_patrol_check':
    default: {
      severity = 'Info';
      ruleTriggered = 'RULE_ROUTINE_PATROL_VERIFIED';
      agentSummary = `Info: Scheduled guard checkpoint verified at ${payload.location} (${payload.deviceId}). All sensor parameters nominal.`;
      break;
    }
  }

  return {
    id: `EVT-${eventCounter}`,
    deviceId: payload.deviceId,
    deviceType: payload.deviceType,
    eventType: payload.eventType,
    location: payload.location,
    timestamp,
    severity,
    status: 'Open',
    agentSummary,
    ruleTriggered,
    metadata,
  };
}

const INITIAL_EVENTS: SecurityEvent[] = [
  evaluateTelemetryPayload({
    deviceId: 'SENS-LOBBY-01',
    deviceType: 'MotionSensor',
    eventType: 'routine_patrol_check',
    location: 'Main Entrance Lobby',
    timestamp: '2026-10-28T13:00:00Z',
    metadata: { confidenceScore: 0.99 },
  }),
  evaluateTelemetryPayload({
    deviceId: 'CAM-LOT-07',
    deviceType: 'Camera',
    eventType: 'camera_offline',
    location: 'East Parking Lot Perimeter',
    timestamp: '2026-10-28T12:30:00Z',
    metadata: { lastHeartbeatSecAgo: 185 },
  }),
  evaluateTelemetryPayload({
    deviceId: 'DOOR-REAR-01',
    deviceType: 'DoorSensor',
    eventType: 'door_forced',
    location: 'Rear Stockroom Exit',
    timestamp: '2026-10-28T12:05:49Z',
    metadata: { doorOpenDurationSec: 62 },
  }),
  evaluateTelemetryPayload({
    deviceId: 'POS-REG-02',
    deviceType: 'POSTerminal',
    eventType: 'pos_high_void',
    location: 'Main Checkout Lane 2',
    timestamp: '2026-10-28T11:42:10Z',
    metadata: { transactionAmountCad: 284.0 },
  }),
  evaluateTelemetryPayload({
    deviceId: 'CAM-DOCK-04',
    deviceType: 'Camera',
    eventType: 'motion_after_hours',
    location: 'North Loading Dock',
    timestamp: '2026-10-28T02:14:22Z',
    metadata: { consecutiveTriggers: 4, confidenceScore: 0.96 },
  }),
].reverse();

const PRESET_SIMULATIONS: { label: string; badge: string; payload: SensorPayload }[] = [
  {
    label: 'Simulate After-Hours Dock Motion (3x)',
    badge: 'Camera • Critical',
    payload: {
      deviceId: 'CAM-DOCK-02',
      deviceType: 'Camera',
      eventType: 'motion_after_hours',
      location: 'South Receiving Bay',
      metadata: { consecutiveTriggers: 3, confidenceScore: 0.94 },
    },
  },
  {
    label: 'Simulate Forced Stockroom Door',
    badge: 'Door Sensor • Critical',
    payload: {
      deviceId: 'DOOR-VAULT-03',
      deviceType: 'DoorSensor',
      eventType: 'door_forced',
      location: 'Inventory Cage B',
      metadata: { doorOpenDurationSec: 48 },
    },
  },
  {
    label: 'Simulate High-Value POS Void ($310)',
    badge: 'POS • Critical',
    payload: {
      deviceId: 'POS-REG-05',
      deviceType: 'POSTerminal',
      eventType: 'pos_high_void',
      location: 'Front Register #5',
      metadata: { transactionAmountCad: 310.75 },
    },
  },
  {
    label: 'Simulate Camera Heartbeat Drop',
    badge: 'Camera • Warning',
    payload: {
      deviceId: 'CAM-CORR-09',
      deviceType: 'Camera',
      eventType: 'camera_offline',
      location: 'West Hallway Exit',
      metadata: { lastHeartbeatSecAgo: 140 },
    },
  },
];

export default function App() {
  const [events, setEvents] = useState<SecurityEvent[]>(INITIAL_EVENTS);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'architecture'>('dashboard');
  const [inspectedEvent, setInspectedEvent] = useState<SecurityEvent | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form state for custom POST /api/events simulation
  const [customDevice, setCustomDevice] = useState('CAM-AISLE-08');
  const [customType, setCustomType] = useState<EventType>('motion_after_hours');
  const [customLocation, setCustomLocation] = useState('Electronics Aisle 4');

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      if (selectedSeverity !== 'All' && evt.severity !== selectedSeverity) return false;
      if (selectedStatus !== 'All' && evt.status !== selectedStatus) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matches =
          evt.deviceId.toLowerCase().includes(q) ||
          evt.location.toLowerCase().includes(q) ||
          evt.agentSummary.toLowerCase().includes(q) ||
          evt.id.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [events, selectedSeverity, selectedStatus, searchQuery]);

  const metrics = useMemo(() => {
    const total = events.length;
    const openCritical = events.filter((e) => e.severity === 'Critical' && e.status !== 'Resolved').length;
    const openWarnings = events.filter((e) => e.severity === 'Warning' && e.status !== 'Resolved').length;
    const resolved = events.filter((e) => e.status === 'Resolved').length;
    return { total, openCritical, openWarnings, resolved };
  }, [events]);

  const handleIngestPayload = (payload: SensorPayload) => {
    const enriched = evaluateTelemetryPayload({
      ...payload,
      timestamp: new Date().toISOString(),
    });
    setEvents((prev) => [enriched, ...prev]);
    setToastMessage(`POST /api/events → 201 Created (${enriched.id}: ${enriched.severity})`);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDevice.trim() || !customLocation.trim()) return;
    const deviceTypeMap: Record<EventType, DeviceType> = {
      motion_after_hours: 'Camera',
      door_forced: 'DoorSensor',
      pos_high_void: 'POSTerminal',
      camera_offline: 'Camera',
      routine_patrol_check: 'MotionSensor',
    };
    handleIngestPayload({
      deviceId: customDevice.trim().toUpperCase(),
      deviceType: deviceTypeMap[customType],
      eventType: customType,
      location: customLocation.trim(),
      metadata: {
        consecutiveTriggers: customType === 'motion_after_hours' ? 3 : 1,
        confidenceScore: 0.93,
        transactionAmountCad: 245.0,
        doorOpenDurationSec: 55,
      },
    });
  };

  const handleStatusUpdate = (id: string, nextStatus: EventStatus) => {
    setEvents((prev) =>
      prev.map((evt) => (evt.id === id ? { ...evt, status: nextStatus } : evt))
    );
    if (inspectedEvent && inspectedEvent.id === id) {
      setInspectedEvent({ ...inspectedEvent, status: nextStatus });
    }
    setToastMessage(`PATCH /api/events/${id}/status → 200 OK (${nextStatus})`);
  };

  const handleResetDemo = () => {
    setEvents(INITIAL_EVENTS);
    setSelectedSeverity('All');
    setSelectedStatus('All');
    setSearchQuery('');
    setToastMessage('Reset demo state to initial 5 sensor telemetry events.');
  };

  const renderDeviceIcon = (deviceType: DeviceType) => {
    switch (deviceType) {
      case 'Camera':
        return <Camera className="w-4 h-4 text-sky-400" />;
      case 'DoorSensor':
        return <DoorOpen className="w-4 h-4 text-amber-400" />;
      case 'POSTerminal':
        return <CreditCard className="w-4 h-4 text-rose-400" />;
      default:
        return <Activity className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Security &amp; Sensor Event Monitoring Agent
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ● Agent Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Full-Stack TypeScript • React • Node.js REST API • Automated Anomaly Triage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Activity className="w-4 h-4" />
              Live Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('architecture')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 ${
                activeTab === 'architecture'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Code2 className="w-4 h-4" />
              Interview &amp; Code Guide
            </button>
            <button
              type="button"
              onClick={handleResetDemo}
              title="Reset demo events"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* API Status Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 border border-sky-500/40 text-sky-200 px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 text-xs sm:text-sm">
          <Terminal className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeTab === 'dashboard' ? (
          <>
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs font-medium text-slate-400">Total Telemetry Events</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-white">{metrics.total}</span>
                  <span className="text-xs text-sky-400">GET /api/events</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-4">
                <div className="text-xs font-medium text-rose-300">Active Critical Alerts</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-rose-400">{metrics.openCritical}</span>
                  <span className="text-xs text-rose-300/80">Immediate Action</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4">
                <div className="text-xs font-medium text-amber-300">Open Warnings</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-amber-400">{metrics.openWarnings}</span>
                  <span className="text-xs text-amber-300/80">Device / POS Watch</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4">
                <div className="text-xs font-medium text-emerald-300">Resolved Incidents</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-emerald-400">{metrics.resolved}</span>
                  <span className="text-xs text-emerald-300/80">Verified &amp; Closed</span>
                </div>
              </div>
            </div>

            {/* Simulator Panel: Trigger Sensor & Camera Events */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-sky-400" />
                    Simulate Incoming Camera / Sensor Stream (POST /api/events)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Click a preset sensor trigger or send a custom payload to test the Node.js Anomaly-Triage Agent in real time.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {PRESET_SIMULATIONS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleIngestPayload(preset.payload)}
                    className="text-left p-3 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 hover:border-sky-500/50 transition group"
                  >
                    <div className="text-xs font-semibold text-white group-hover:text-sky-300 transition">
                      {preset.label}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">{preset.badge}</div>
                  </button>
                ))}
              </div>

              {/* Custom Payload Form */}
              <form
                onSubmit={handleCustomSubmit}
                className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end"
              >
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Device ID
                  </label>
                  <input
                    type="text"
                    value={customDevice}
                    onChange={(e) => setCustomDevice(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
                    placeholder="e.g. CAM-DOCK-09"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Event Type
                  </label>
                  <select
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value as EventType)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="motion_after_hours">motion_after_hours (Critical)</option>
                    <option value="door_forced">door_forced (Critical)</option>
                    <option value="pos_high_void">pos_high_void (Critical)</option>
                    <option value="camera_offline">camera_offline (Warning)</option>
                    <option value="routine_patrol_check">routine_patrol_check (Info)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Location / Zone
                  </label>
                  <input
                    type="text"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
                    placeholder="e.g. Warehouse Bay 3"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition h-[32px]"
                >
                  Send JSON Payload
                </button>
              </form>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Severity:</span>
                </div>
                {['All', 'Critical', 'Warning', 'Info'].map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSelectedSeverity(sev)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                      selectedSeverity === sev
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {sev}
                  </button>
                ))}

                <span className="text-slate-700 mx-1">|</span>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-1">
                  <span>Status:</span>
                </div>
                {['All', 'Open', 'Acknowledged', 'Resolved'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStatus(st)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                      selectedStatus === st
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by device, location, summary..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Live Events Feed Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">Event / Device</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Agent Triage Summary</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs sm:text-sm">
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                          No telemetry events match the current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((evt) => (
                        <tr
                          key={evt.id}
                          className="hover:bg-slate-800/40 transition align-top"
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {renderDeviceIcon(evt.deviceType)}
                              <span className="font-semibold text-white">{evt.deviceId}</span>
                              <span className="text-[11px] font-mono text-slate-400">
                                ({evt.id})
                              </span>
                            </div>
                            <div className="text-xs text-slate-300 mt-0.5">{evt.location}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(evt.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                evt.severity === 'Critical'
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                  : evt.severity === 'Warning'
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                              }`}
                            >
                              {evt.severity}
                            </span>
                            <div className="text-[10px] font-mono text-slate-500 mt-1">
                              {evt.ruleTriggered}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 max-w-md">
                            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                              {evt.agentSummary}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium ${
                                evt.status === 'Resolved'
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : evt.status === 'Acknowledged'
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {evt.status === 'Resolved' && <CheckCircle2 className="w-3 h-3" />}
                              {evt.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {evt.status === 'Open' && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusUpdate(evt.id, 'Acknowledged')}
                                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition"
                                >
                                  Acknowledge
                                </button>
                              )}
                              {evt.status !== 'Resolved' && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusUpdate(evt.id, 'Resolved')}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                                >
                                  Resolve
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setInspectedEvent(evt)}
                                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                title="Inspect JSON Payload"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* Interview & Code Architecture Walkthrough Tab */
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-400" />
                How This Project Works (Your Interview Cheat Sheet)
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                This repository is structured into two clean folders (<code className="text-sky-300">backend/</code> and{' '}
                <code className="text-sky-300">frontend/</code>) sharing strict TypeScript interfaces. Below are the exact files included in your downloadable zip archive and how to explain them in your interview with Solink.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
                    <Server className="w-4 h-4" />
                    1. Node.js + Express REST API
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong>File:</strong> <code>backend/src/server.ts</code>
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Exposes <code>GET /api/events</code> (with query filtering), <code>POST /api/events</code> (validates incoming sensor JSON and returns <code>400 Bad Request</code> on missing fields), and <code>PATCH /api/events/:id/status</code>.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                    <ShieldAlert className="w-4 h-4" />
                    2. Anomaly-Triage Agent
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong>File:</strong> <code>backend/src/triageAgent.ts</code>
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Evaluates raw camera, door contact, and POS telemetry against correlation rules (e.g., 3+ after-hours motion triggers or high-value POS voids) to assign severity and synthesize an actionable incident summary.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                    <Code2 className="w-4 h-4" />
                    3. React + TypeScript UI &amp; Jest Tests
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong>Files:</strong> <code>frontend/src/App.tsx</code> &amp; <code>server.test.ts</code>
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Uses React <code>useState</code> and <code>useEffect</code> hooks for live filtering and status updates, backed by 5 automated Jest + Supertest unit tests verifying every REST route.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* JSON Payload Inspector Modal */}
      {inspectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">
                  REST API JSON Payload ({inspectedEvent.id})
                </h3>
                <p className="text-xs text-slate-400">
                  Enriched SecurityEvent object returned by Node.js Triage Agent
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedEvent(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs font-mono text-sky-300 overflow-x-auto">
              {JSON.stringify(inspectedEvent, null, 2)}
            </pre>
            <div className="flex justify-end gap-2">
              {inspectedEvent.status !== 'Resolved' && (
                <button
                  type="button"
                  onClick={() => handleStatusUpdate(inspectedEvent.id, 'Resolved')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                >
                  Mark Resolved
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectedEvent(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
