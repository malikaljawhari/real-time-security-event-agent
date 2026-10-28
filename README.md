# Real-Time Security & Sensor Event Monitoring Agent

**Author:** Malik Al-Jawhari  
**Tech Stack:** TypeScript, React, Node.js, Express, REST APIs, Jest, AWS, Git

A full-stack security and IoT sensor telemetry monitoring application built with **TypeScript**, **React**, and **Node.js**. The system ingests real-time JSON events from simulated cameras, door access controllers, and POS terminals over a **REST API**, runs an automated **Anomaly-Triage Agent** to classify event severity and generate human-readable incident summaries, and surfaces live operational insights on an interactive **React** dashboard.

---

## Architecture Overview

1. **Back-End REST API (`backend/src/server.ts`)**
   - Built with **Node.js**, **Express**, and **TypeScript**.
   - Exposes RESTful endpoints (`GET /api/events`, `POST /api/events`, `PATCH /api/events/:id/status`) with strict payload validation.
2. **Automated Anomaly-Triage Agent (`backend/src/triageAgent.ts`)**
   - Evaluates incoming sensor and camera payloads against temporal and multi-sensor correlation rules:
     - **After-Hours Motion Correlation:** Escalates motion events occurring between 23:00 and 05:00 or repeated triggers within 60 seconds at the same zone to `Critical`.
     - **Forced Access / Hardware Offline Detection:** Flags forced door contacts and camera heartbeat losses with immediate actionable triage steps.
     - **POS Exception Correlation:** Flags high-value point-of-sale voids/refunds when paired with unexpected physical zone activity.
   - Generates structured natural-language incident summaries so operators can identify critical moments sooner and act faster.
3. **Interactive Front-End Dashboard (`frontend/src/App.tsx`)**
   - Built with **React** and **TypeScript** (`useState`, `useEffect`).
   - Features live severity/location/status filtering, real-time telemetry simulation triggers, JSON payload inspection, and one-click incident acknowledgment/resolution.

---

## REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/events` | Returns all security events (supports `?severity=Critical&status=Open` query filters). |
| `POST` | `/api/events` | Ingests a raw sensor/camera telemetry JSON payload, runs the triage agent, and stores the enriched incident. |
| `PATCH` | `/api/events/:id/status` | Updates an incident's status (`Open` $ightarrow$ `Acknowledged` $ightarrow$ `Resolved`). |
| `GET` | `/api/health` | Health-check endpoint for cloud load balancers / AWS EC2 monitoring. |

### Example `POST /api/events` Request Payload
```json
{
  "deviceId": "CAM-DOCK-04",
  "deviceType": "Camera",
  "eventType": "motion_after_hours",
  "location": "North Loading Dock",
  "timestamp": "2026-10-14T02:18:40Z",
  "metadata": {
    "consecutiveTriggers": 3,
    "confidenceScore": 0.94
  }
}
```

### Example Enriched Response (`201 Created`)
```json
{
  "id": "EVT-1042",
  "deviceId": "CAM-DOCK-04",
  "deviceType": "Camera",
  "eventType": "motion_after_hours",
  "location": "North Loading Dock",
  "timestamp": "2026-10-14T02:18:40Z",
  "severity": "Critical",
  "status": "Open",
  "agentSummary": "Critical Alert: 3 consecutive motion triggers detected at North Loading Dock (CAM-DOCK-04) during restricted hours (02:18 UTC) with 94% confidence. Verify camera feed and dispatch dock check.",
  "ruleTriggered": "RULE_AFTER_HOURS_MULTI_MOTION"
}
```

---

## Running Locally

### 1. Start the Node.js + TypeScript Back-End API
```bash
cd backend
npm install
npm run dev
# Server runs at http://localhost:4000
```

### 2. Run the Jest Unit Test Suite
```bash
cd backend
npm test
```

### 3. Start the React + TypeScript Front-End Dashboard
```bash
cd frontend
npm install
npm run dev
# Dashboard runs at http://localhost:5173
```

---

## Cloud Deployment (AWS)
- **Back End:** Deployed as a Node.js service on **AWS EC2** (Ubuntu 22.04 LTS) behind Nginx reverse proxy, with `/api/health` monitored for uptime.
- **Front End:** Production bundle (`npm run build`) hosted on **AWS S3** with static web hosting enabled.
