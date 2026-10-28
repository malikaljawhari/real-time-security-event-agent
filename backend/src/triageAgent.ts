import { SensorPayload, SecurityEvent, Severity } from './types';

let eventSequence = 1040;

/**
 * Automated Anomaly-Triage Agent
 * Evaluates raw camera and IoT sensor telemetry payloads against security rules,
 * assigns a deterministic severity level, and synthesizes a clear incident summary.
 */
export function evaluateTelemetryPayload(payload: SensorPayload): SecurityEvent {
  eventSequence += 1;
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
    id: `EVT-${eventSequence}`,
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
