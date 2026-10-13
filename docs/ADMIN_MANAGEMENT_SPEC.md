# Enterprise Admin & Operations Console Specification (v3.0)

**System**: Project BLOC Management Portal & Operations Command Center  
**Target Roles**: Company Admin, Operations Director, Area Supervisors, Field Leads  
**Access URL**: `/admin` (or `/console/[tenant_slug]`)  

---

## 1. Overview & Left-Hand Navigation Architecture

Project BLOC provides an enterprise operations console equipped with a persistent **Left-Hand Navigation Menu** and a **Dual-Horizon Architecture**:
1. **Frontline Mobile PWA**: Low-bandwidth conversational micro-app for field promoters (Pax Copilot, 3-Second Fast-Sale Stepper, Vera Camera Shelf Audit).
2. **Enterprise Operations Command Portal**: Desktop/tablet control center for operations directors and field supervisors with deep drill-down analytics and agent orchestration.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PROJECT BLOC · OPERATIONS COMMAND CENTER                        │
│                                                                                        │
│  [🏢 Unilever JAPAC ▼]                     [Search stores, SKUs...]  [👤 Lester Alarcon]│
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│  LEFT NAVIGATION     │  MAIN WORKSPACE VIEW AREA                                       │
│                      │                                                                 │
│  📊 Executive BI     │  1. Executive Overview & Gemini AI Situational Briefing        │
│  🤖 Agent Registry   │  2. AI Agent Registry & Skill Configuration Studio              │
│  🎯 Autonomous Tasks │  3. Autonomous Field Tasks & Compliance Engine (Reminders/Esc)  │
│  🏬 Stores (360°)    │  4. Retail Branch Network & 360° Store Inspection Drawer        │
│  📦 Product Catalog  │  5. Product Catalog & 1-Tap Fast-Sale Stepper Pins              │
│  👥 Staff & Org Chart│  6. Corporate Organizational Chart & Staff Scheduling           │
│  📑 Executive Reports│  7. AI-Generated Compliance & Sell-Through Reports              │
│  ⚙️ Cloud Settings   │  8. Google Cloud Vault (5TB Drive) & Sheets Bidirectional Sync  │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘
```

---

## 2. The 8 Core Management Modules

### Module 1: Executive Overview & AI Decision Briefing (`/admin/overview`)
- **Top-Level KPI Cards**: Regional Sell-Through (normalized to USD/SGD), Planogram Compliance %, Geofenced Attendance Ratio, Open Operational Exceptions.
- **Gemini Autonomous Situational Briefing**: AI analyzes active shifts, stores, and audits to synthesize actionable highlights:
  - *Identifies top and bottom performing branches*.
  - *Flags overdue audits and non-compliant planograms*.
  - *Suggests immediate inventory replenishment interventions*.
- **Interactive Drill-Down**: Clicking any KPI card filters and displays the exact stores, promoters, and transactions contributing to that metric.

---

### Module 2: AI Agent Registry & Skill Configuration Studio (`/admin/agents`)
Empowers operations teams to view, configure, and register autonomous agents:
- **Registered Agents**:
  - **Pax**: Frontline Conversational Copilot (Gemini 2.5 Flash) — handles attendance check-ins, sales logging, and multilingual translation.
  - **Vera**: Computer Vision Shelf Auditor (Gemini 2.5 Pro) — verifies planograms, computes Share of Shelf (SoS), and flags missing tags.
  - **Nexus**: Regional Orchestrator (Gemini 2.5 Flash) — synchronizes with Google Sheets and routes supervisor alerts.
- **Skill Authoring & Attachment**:
  - Add or toggle skills per agent: `Planogram Compliance`, `Out-of-Stock Sentinel`, `Shift Check-in Follow-up`, `Competitor Intelligence`, `End-of-Day Reconciliation`.
  - Configure skill parameters: reference planogram image folder, compliance tolerance threshold (e.g. 85%), target response window.

---

### Module 3: Autonomous Task Dispatch & Compliance Engine (`/admin/tasks`)
Allows management to assign active tasks to agents that proactively contact the field force:
- **Task Builder**:
  - **Task Title**: e.g. *"11:00 AM Shelf #4 Endcap Audit"*, *"Post-Lunch Target Pacing Check"*.
  - **Assigned Agent**: Vera, Pax, or Nexus.
  - **Target Scope**: All Stores, Specific Chain (e.g. SM Supermalls), or Selected Promoters.
  - **Cadence / Schedule**: Immediate (1-tap dispatch) or Scheduled Cron.
  - **Follow-up SLA**: Time before agent sends gentle reminder in chat (e.g. 30 minutes).
  - **Escalation Threshold**: Time before agent escalates to Area Supervisor (e.g. 60 minutes).
- **Live Compliance Tracker**:
  - Visual status of every contacted promoter: `Dispatched` ➔ `Prompt Sent` ➔ `Photo Received` ➔ `Compliant` / `Non-Compliant` / `Escalated`.
  - Direct drill-down to review the exact photo submitted and Gemini's optical audit feedback.

---

### Module 4: Retail Store Network & 360° Store Drawer (`/admin/stores`)
Manages retail branches across chains with deep inspection:
- **Store Code & Chain**: `SM-MEGA-01` (SM Megamall), `FP-VIVO-01` (FairPrice VivoCity), `ROB-GAL-01` (Robinsons Galleria).
- **Geofence Parameters**: Latitude, Longitude, and 150m radius for automated GPS clock-in verification.
- **Store 360° Inspection Drawer**: Clicking any store opens a dedicated slide-out panel with:
  - Today's live promoters on duty with clock-in timestamps.
  - Actual sell-through vs daily quota with pacing thermometer.
  - Live shelf audit gallery with bounding box overlays.
  - Pending and completed agent tasks for this store.

---

### Module 5: Product Catalog & Fast-Sale Stepper Pins (`/admin/products`)
Maintains SKUs and frontline sales capture speed:
- **SKU Code, Barcode & Category**: EAN-13 barcodes mapped to consumer SKUs.
- **Unit Pricing & Commissions**: Base price + promoter incentive (+₱250/unit) to motivate zero-latency reporting.
- **1-Tap Focus Promo Pin (`isFocusPromo`)**:
  - Toggling ON pins the product directly to the promoter's **1-Tap Fast-Sale Quick Stepper** in the mobile app.
  - Unpinned items remain searchable via camera barcode scan or catalog drawer.

---

### Module 6: Corporate Org Chart, Staff & Roster (`/admin/org-chart`)
Visualizes and enforces the corporate command lineage:
- **Visual Org Chart**: Tree view illustrating Country GM ➔ Area Operations ➔ Store Supervisors ➔ Field Promoters.
- **Staff Roster**: Member profile, role (`company_admin`, `supervisor`, `promoter`), assigned branch, and preferred conversation language (Tagalog, Singlish, Malay, Japanese).
- **Shift Scheduling**: Weekly branch assignments and customized daily targets.

---

### Module 7: Executive Reports & Audit Governance (`/admin/reports`)
- **AI-Generated Executive Reports**: One-click synthesis of weekly and daily operations:
  - *Planogram & Merchandising Compliance Report*.
  - *On-Shelf Availability (OSA) & Stock-Out Report*.
  - *Regional Sell-Through & Commission Payout Summary*.
- **Audit Trails**: Immutable log recording all configuration updates, role modifications, and task dispatches.

---

### Module 8: Company & Cloud Settings (`/admin/settings`)
Configures enterprise-wide cloud connections:
- **Base Reporting Currency**: SGD, PHP, USD, MYR, JPY.
- **Google Drive 5TB Media Vault**: Service account credentials and root folder ID for shelf media ingestion.
- **Google Sheets Bidirectional Link**: Live spreadsheet ID for WSS two-way data sync.
- **Operating Hours & SLA**: Shift cutoff times and automated End-of-Day Nexus digest dispatch times.
