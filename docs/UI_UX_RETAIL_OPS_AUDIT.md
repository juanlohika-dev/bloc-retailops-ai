# Project BLOC · UI/UX & Retail Operations Architectural Audit & Enhancement Blueprint

**Auditor Persona:** Principal UI/UX Architect & VP of Retail Operations  
**Evaluation Target:** Project BLOC Desktop Workspaces (`Supervisor Command Horizon` & `Enterprise Admin Ops`)  
**Context Reference:** [TECH_SPEC_V2.md](./TECH_SPEC_V2.md) · Google Cloud AI Builder Cup 2026 (JAPAC)  
**Status:** Design QA Critique & Actionable Refactor Plan  

---

## 1. Executive Verdict: The UI/UX & Operational Reality Check

As a retail operations executive managing distributed branch networks across Singapore, the Philippines, and Malaysia, **the current desktop interface fails both the UI/UX test and the frontline operational test**. 

Your critique is **100% accurate**:
1. **The "Cropped Box" Aesthetic (Wasted Space)**: The desktop views are currently wrapped in a centered container with rigid max-widths (`1120px` for Supervisor, `1400px` for Admin) and large rounded borders floating on a light-grey canvas. On modern enterprise displays (1080p, 1440p, 4K), this wastes 30% to 45% of available horizontal screen estate as empty grey gutters. It looks like a phone simulator or a tablet preview rather than a full-bleed, professional enterprise mission control center.
2. **Missing Left Navigation in Supervisor View**: While Admin Ops has a 10-tab vertical sidebar, the Supervisor console currently has **zero left navigation**. A regional supervisor monitoring dozens of promoters, 8 scheduled roving stops, and thousands of SKU transactions cannot navigate an entire shift through a single static vertical scroll.
3. **Misplaced Org Chart in Prime Real Estate**: Placing a static corporate hierarchy tree (*"JAPAC HQ -> SM Megamall -> VivoCity"*) right in the middle of the daily supervisor view is a severe retail operations anti-pattern. An org chart is administrative HR metadata that changes once a quarter; it belongs in Admin Settings. A field supervisor checking their console at 11:30 AM needs to see **which stores are lagging behind quota**, **who failed to check in**, and **which shelves have missing price tags or out-of-stock items**.
4. **Data Fragmentation Between Views**: In Admin Ops, Regional Revenue displayed `$0` with `0/0` attendance, while the Supervisor view displayed hardcoded `$18,450`. Both views must draw from the single source of truth in the database.

---

## 2. Retail Operations Context: What Does a Regional Supervisor Actually Do?

To design the right interface, we must ground the UX in the hourly cadence of a retail field supervisor:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                DAILY SUPERVISOR OPERATIONAL CADENCE                          │
│                                                                                              │
│   08:30 - 09:15 AM    │  11:30 AM - 01:30 PM    │  03:00 - 05:00 PM    │  07:00 - 09:00 PM   │
│   Shift Kickoff       │  Midday Rush Pacing     │  Roving Fleet Audit  │  EOD Settlement     │
│   • GPS Attendance    │  • Live Sell-Through    │  • Vera CV Compliance│  • Quota vs Actual  │
│   • Geofence Delinquency • Promo Velocity Stepper• Out-of-Stock Gaps   │  • Cash vs Financing│
│   • Route Dispatch    │  • Branch Pacing Heatmap│  • Competitor Audits │  • Exceptions Signed│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

A supervisor is **exception-driven**. They do not browse for fun; they scan for **anomalies**, **delinquencies**, and **revenue gaps**.

---

## 3. Detailed UI/UX Breakdown of Flaws & Actionable Remedies

### Flaw 1: The Floating "Cropped Box" vs. Full-Bleed Edge-to-Edge Layout

| Dimension | Current Implementation (Flawed) | Proposed Enterprise Blueprint (Optimal) |
| :--- | :--- | :--- |
| **Canvas Width** | `max-width: 1120px` (Supervisor) / `1400px` (Admin) centered in `.workspace-canvas` with large empty margins on left and right. | **Full-Bleed Fullscreen (`width: 100vw; height: calc(100vh - 56px);`)**. Edge-to-edge layout with zero wasted lateral gutters. |
| **Container Style** | `border-radius: 24px; box-shadow: 0 8px 32px ...;` floating on grey background like a modal or tablet mockup. | Flat, borderless, crisp enterprise SaaS frame (aligned with Google Cloud Console / Vertex AI Studio standards). |
| **Data Density** | Constrained card widths force tables to wrap or scroll horizontally; dense operational metrics are squeezed. | High-density grid with collapsible sidebar and responsive data tables capable of displaying 8+ columns without horizontal scrolling. |

---

### Flaw 2: Supervisor Console Missing Left Navigation Menu

The supervisor console must be structured with dedicated, purpose-built operational domains:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               PROJECT BLOC · SUPERVISOR COMMAND HORIZON                          │
├───────────────┬──────────────────────────────────────────────────────────────────────────────────┤
│ SIDEBAR MENU  │ MAIN OPERATIONAL CANVAS (FULL BLEED)                                             │
│               │                                                                                  │
│ 📊 Shift Command│ [KPI Banner: $18,450 Revenue · 94% Pacing · 8/8 Attendance · 3 Open Exceptions] │
│   & Live Pacing│                                                                                  │
│               │ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ 📍 Fleet & GPS│ │ 🚨 LIVE OPERATIONAL ANOMALY & EXCEPTION RADAR                                 │ │
│   Attendance  │ │ • SM Megamall: Missing Promo Shelf Tag on Focus SKU #BND-01 (Vera Detected) │ │
│               │ │ • Trinoma: Promoter Marco Diaz checked in 12m early at Stop 4/8              │ │
│ 📸 Vera Shelf │ │ • VivoCity: Pacing at 32% of 2:00 PM expected run rate (Immediate Follow-Up)│ │
│   & Compliance│ └──────────────────────────────────────────────────────────────────────────────┘ │
│               │                                                                                  │
│ ⚡ Fast-Sale  │ ┌───────────────────────────────────────┐ ┌────────────────────────────────────┐ │
│   Live Stream │ │ REAL-TIME STORE PACING MATRIX         │ │ 8-STOP ROVING MERCHANDISER ROUTE   │ │
│               │ │ Branch | Target | Sold | Pace | Status│ │ Stop | Store | ETA | Status | Proof│ │
│ 📋 Surveys &  │ │ SM Meg | $8.0k  | $7.2k| 90%  | 🟢 OK │ │ 1    | SM North| 09:00| Checked-In   │ │
│   Audit Queue │ │ Vivo   | $6.0k  | $2.1k| 35%  | 🔴 LAG│ │ 2    | Trinoma | 10:15| Completed    │ │
│               │ └───────────────────────────────────────┘ └────────────────────────────────────┘ │
│ 🤖 Aegis /    │                                                                                  │
│   Nexus AI    │ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│   Copilot     │ │ LIVE FAST-SALE TRANSACTION LEDGER (Google Sheets Bidirectional Bridge)       │ │
│               │ └──────────────────────────────────────────────────────────────────────────────┘ │
└───────────────┴──────────────────────────────────────────────────────────────────────────────────┘
```

#### Proposed Supervisor Menu Domains:
1. **Shift Command & Pacing** (Default): High-level KPI pulse, live anomaly banner, branch pacing heatmap, and live sales stream.
2. **Frontline Roster & Fleet Tracking**: Live GPS attendance status, roving merchandiser 8-stop progress bar (Stop 1 to 8), arrival timestamps, and stay durations.
3. **Vera Shelf & Planogram CV Audits**: Real-time camera audit submissions, Share of Shelf (SoS %) meter, out-of-stock SKU alerts, and before/after corrective photos.
4. **Fast-Sale & Payment Mix**: Breakdown of payment settlement methods (Cash, Credit Card, Home Credit 0% APR, GCash/Maya) and financing tenors.
5. **Field Surveys & Compliance Queue**: Dynamic audit forms submitted from the frontline requiring supervisor sign-off.
6. **Aegis Operational Copilot**: Natural language conversational assistant for ad-hoc operational queries (*"Show me branches with declining shelf compliance this week"*).

---

### Flaw 3: The Org Chart Must Be Removed from the Supervisor View

> **Retail UX Rule:** If an element does not change state or provide actionable insight during a 9-hour retail shift, **it does not belong on the frontline supervisor dashboard**.

#### Why the Org Chart Must Be Evicted:
- **Static vs. Dynamic**: The corporate org chart changes when employees are hired, promoted, or transferred. It provides zero signal on sales velocity, out-of-stock items, or shift delays.
- **Wasted Screen Real Estate**: It currently consumes ~300 vertical pixels right in the center of the viewport, pushing the vital Store Sell-Through Telemetry table below the fold.
- **Proper Destination**: The Org Chart belongs exclusively in **Admin Ops &rarr; Staff & Org Chart (`#panelOrg`)**, where administrators configure reporting hierarchies, department channels, and user permissions.

#### What Replaces It in the Center:
1. **Live Operational Exception & Alert Tray**: Sourced directly from `audit_logs` and Vera AI verdicts (e.g. Planogram deviations, low pacing warnings, missed geofence check-ins).
2. **Interactive Roving Fleet Route Tracker**: Live timeline showing roving promoters (e.g., Marco Diaz / Liza Santos) moving between scheduled retail branches with GPS arrival stamps.
3. **Branch Performance Pacing Gauges**: Visual progress bars comparing expected run-rate against actual sales at the current time of day.

---

### Flaw 4: Unified Database Telemetry Pipeline (Eliminating `$0` Placeholders)

In Admin Ops Overview, metrics showed `$0` and empty store rows because the dashboard was querying a different or unseeded state. 

#### Architectural Solution:
- Both the Supervisor Command Horizon and Admin Ops must consume the unified backend endpoints:
  - `GET /api/admin/:ws/metrics`: Computes aggregate regional revenue, target, attendance ratio, and compliance directly from Turso SQLite (`sales_transactions`, `shifts`, `shelf_audits`).
  - `GET /api/admin/:ws/stores`: Returns all registered retail branches with their real-time sell-through, target quotas, and pacing percentages.
  - `GET /api/admin/:ws/users/:userId/itinerary`: Returns the live 8-store roving route data for fleet tracking.
- Eliminating static mock data ensures that when a promoter logs a Fast-Sale or completes a Vera audit on mobile, **both the Supervisor and Admin screens update synchronously via WSS / SSE**.

---

## 4. Implementation Specification & Design Blueprint

### Phase 1: Full-Bleed Desktop Layout
- In `src/web/index.html`:
  - Update `.workspace-canvas`: Remove `align-items: center; justify-content: center;` when in desktop mode (`supervisor` or `admin`). Let it occupy `width: 100%; height: calc(100vh - 56px);`.
  - Update `.m3-supervisor-horizon` and `.m3-admin-console`:
    - `max-width: none; width: 100%; height: 100%; border-radius: 0; border: none; box-shadow: none;`
    - Transition to clean edge-to-edge dual-pane layouts with persistent left sidebars.

### Phase 2: Dedicated Supervisor Navigation Sidebar
- Add `.supervisor-sidebar` with active state indicators, icon badges, and category labels:
  - `Overview & Shift Pulse`
  - `Roving Fleet & GPS Routes`
  - `Vera Shelf & Planograms`
  - `Fast-Sale & Payment Mix`
  - `Surveys & Audits Queue`
  - `Aegis Copilot Assistant`

### Phase 3: Replacement of Center Org Chart
- Remove `.m3-lineage-card` from the Supervisor workspace.
- Replace with:
  - **Live Exception Radar**: Cards for urgent items requiring supervisor action.
  - **Interactive Store Pacing Grid**: Color-coded badges (🟢 Pacing &ge; 80%, 🟡 50–79%, 🔴 < 50%).
  - **Roving Fleet Stepper Bar**: Visual progression of current stops across the 8-store corridor.

### Phase 4: Shared Real-Time Telemetry Store
- Bind both consoles to live database endpoints with auto-refresh every 30 seconds and Google Sheets WSS bidirectional sync updates.

---

## 5. Summary Recommendation Table

| Component | Current State | Recommendation | Priority |
| :--- | :--- | :--- | :---: |
| **Canvas Viewport** | 1120px / 1400px centered box with grey gutters | Edge-to-edge 100% full-bleed enterprise desktop layout | **P0 (Immediate)** |
| **Supervisor Navigation** | None (single static scroll) | Add dedicated 6-domain left sidebar menu | **P0 (Immediate)** |
| **Center Real Estate** | Static HR Org Chart | Live Operational Anomaly Tray & Store Pacing Matrix | **P0 (Immediate)** |
| **Admin Overview Data** | Shows $0 / empty table rows | Connect to live `/api/admin/:ws/metrics` & store tables | **P1 (High)** |
| **Org Chart Relocation** | Centered in Supervisor view | Relocate exclusively to Admin Ops &rarr; Staff & Org Chart | **P1 (High)** |
