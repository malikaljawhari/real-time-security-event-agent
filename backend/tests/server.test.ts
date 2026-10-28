import request from 'supertest';
import { app } from '../src/server';

describe('Security & Sensor Event Monitoring Agent REST API', () => {
  it('GET /api/health returns 200 OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/events returns seeded security events', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
  });

  it('POST /api/events escalates multi-trigger after-hours motion to Critical severity', async () => {
    const payload = {
      deviceId: 'CAM-VAULT-01',
      deviceType: 'Camera',
      eventType: 'motion_after_hours',
      location: 'Server & Cash Vault Corridor',
      metadata: {
        consecutiveTriggers: 5,
        confidenceScore: 0.95,
      },
    };

    const res = await request(app).post('/api/events').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.severity).toBe('Critical');
    expect(res.body.ruleTriggered).toBe('RULE_AFTER_HOURS_MULTI_MOTION');
    expect(res.body.status).toBe('Open');
  });

  it('POST /api/events returns 400 Bad Request when required telemetry fields are missing', async () => {
    const malformedPayload = {
      deviceType: 'Camera',
      location: 'Loading Dock',
    };

    const res = await request(app).post('/api/events').send(malformedPayload);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required fields');
  });

  it('PATCH /api/events/:id/status updates an incident status to Resolved', async () => {
    const listRes = await request(app).get('/api/events');
    const firstEventId = listRes.body[0].id;

    const patchRes = await request(app)
      .patch(`/api/events/${firstEventId}/status`)
      .send({ status: 'Resolved' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.id).toBe(firstEventId);
    expect(patchRes.body.status).toBe('Resolved');
  });
});
