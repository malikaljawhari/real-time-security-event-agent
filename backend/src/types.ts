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
