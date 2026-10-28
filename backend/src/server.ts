import express, { Request, Response } from 'express';
import cors from 'cors';
import { EventStatus, SecurityEvent, SensorPayload } from './types';
import { evaluateTelemetryPayload } from './triageAgent';

export const app = express();
app.use(cors());
app.use(express.json());

// Seed initial realistic camera, door, and POS telemetry events
const INITIAL_PAYLOADS: SensorPayload[] = [
  {
    deviceId: 'CAM-DOCK-04',
    deviceType: 'Camera',
    eventType: 'motion_after_hours',
    location: 'North Loading Dock',
    timestamp: '2026-10-28T02:14:22Z',
    metadata: { consecutiveTriggers: 4, confidenceScore: 0.96 },
  },
  {
    deviceId: 'POS-REG-02',
    deviceType: 'POSTerminal',
    eventType: 'pos_high_void',
    location: 'Main Checkout Lane 2',
    timestamp: '2026-10-28T11:42:10Z',
    metadata: { transactionAmountCad: 284.0 },
  },
  {
    deviceId: 'DOOR-REAR-01',
    deviceType: 'DoorSensor',
    eventType: 'door_forced',
    location: 'Rear Stockroom Exit',
    timestamp: '2026-10-28T12:05:49Z',
    metadata: { doorOpenDurationSec: 62 },
  },
  {
    deviceId: 'CAM-LOT-07',
    deviceType: 'Camera',
    eventType: 'camera_offline',
    location: 'East Parking Lot Perimeter',
    timestamp: '2026-10-28T12:30:00Z',
    metadata: { lastHeartbeatSecAgo: 185 },
  },
  {
    deviceId: 'SENS-LOBBY-01',
    deviceType: 'MotionSensor',
    eventType: 'routine_patrol_check',
    location: 'Main Entrance Lobby',
    timestamp: '2026-10-28T13:00:00Z',
    metadata: { confidenceScore: 0.99 },
  },
];

let eventsStore: SecurityEvent[] = INITIAL_PAYLOADS.map(evaluateTelemetryPayload).reverse();

/**
 * GET /api/health
 * Simple health-check endpoint for cloud monitoring.
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', totalEvents: eventsStore.length });
});

/**
 * GET /api/events
 * Retrieves security events with optional filtering by severity, status, and search query.
 */
app.get('/api/events', (req: Request, res: Response) => {
  const { severity, status, search } = req.query;

  let filtered = [...eventsStore];

  if (typeof severity === 'string' && severity !== 'All') {
    filtered = filtered.filter((evt) => evt.severity === severity);
  }

  if (typeof status === 'string' && status !== 'All') {
    filtered = filtered.filter((evt) => evt.status === status);
  }

  if (typeof search === 'string' && search.trim() !== '') {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (evt) =>
        evt.deviceId.toLowerCase().includes(q) ||
        evt.location.toLowerCase().includes(q) ||
        evt.agentSummary.toLowerCase().includes(q) ||
        evt.id.toLowerCase().includes(q)
    );
  }

  res.status(200).json(filtered);
});

/**
 * POST /api/events
 * Ingests a new camera/sensor telemetry payload, runs anomaly triage rules, and stores the incident.
 */
app.post('/api/events', (req: Request, res: Response) => {
  const payload = req.body as Partial<SensorPayload>;

  if (!payload || !payload.deviceId || !payload.deviceType || !payload.eventType || !payload.location) {
    return res.status(400).json({
      error: 'Bad Request: Missing required fields (deviceId, deviceType, eventType, location).',
    });
  }

  const enrichedEvent = evaluateTelemetryPayload(payload as SensorPayload);
  eventsStore = [enrichedEvent, ...eventsStore];

  return res.status(201).json(enrichedEvent);
});

/**
 * PATCH /api/events/:id/status
 * Updates the operational triage status of an existing security event.
 */
app.patch('/api/events/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status?: EventStatus };

  const validStatuses: EventStatus[] = ['Open', 'Acknowledged', 'Resolved'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Bad Request: status must be one of Open, Acknowledged, or Resolved.',
    });
  }

  const targetIndex = eventsStore.findIndex((evt) => evt.id === id);
  if (targetIndex === -1) {
    return res.status(404).json({ error: `Event with id ${id} not found.` });
  }

  eventsStore[targetIndex] = {
    ...eventsStore[targetIndex],
    status,
  };

  return res.status(200).json(eventsStore[targetIndex]);
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Security & Sensor Event Monitoring Agent API running on http://localhost:${PORT}`);
  });
}
