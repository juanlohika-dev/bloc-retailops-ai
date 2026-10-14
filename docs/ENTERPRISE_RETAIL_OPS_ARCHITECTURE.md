# Project BLOC: Enterprise Frontline Retail Operations & Agentic Orchestration Platform
## Comprehensive Master Technical Architecture & System Specification (v4.0)

**Project Name**: Project BLOC (Frontline Agentic Orchestration Engine)  
**Target Enterprise**: Distributed Multi-Store Retail Networks across JAPAC (1,000+ Branches, 5,000+ Frontline Personnel)  
**Hackathon Event**: Google Cloud AI Builder Cup 2026  
**Repository**: [github.com/juanlohika-dev/bloc-retailops-ai](https://github.com/juanlohika-dev/bloc-retailops-ai)  
**Companion Spec**: [ENTERPRISE_SYSTEM_ARCHITECTURE_AND_UI_UX_SPECIFICATION.md](file:///c:/Users/Lester%20Alarcon/Documents/Bloc%20Retail%20Ops/docs/ENTERPRISE_SYSTEM_ARCHITECTURE_AND_UI_UX_SPECIFICATION.md)

---

## 1. Executive Vision & Problem Statement

Distributed retail operations suffer from chronic operational disconnects across the enterprise stack:
1. **The Frontline Compliance Abyss**: Field promoters and merchandisers are bombarded with manual tasks (shelf photo audits, POS tallies, competitor monitoring). Over 45% of assigned operational tasks are missed or reported 24–48 hours late because legacy software requires tedious 15-field mobile forms.
2. **The "Shallow" Tooling Dilemma**: Most retail ops systems offer rigid, read-only dashboards that cannot take action. Headquarters sets planograms and daily targets, but has no mechanism to proactively follow up with individual store staff, verify execution via computer vision, or escalate non-compliance before the shift ends.
3. **Multi-Agent Orchestration & Modular Extensibility**: Project BLOC replaces static reporting with an **Autonomous AI Agent Mesh** governed by an **Enterprise Operations Command Portal**:
   - **Modular Dynamic Fields Engine**: Clean segregation between Standard Fields and Custom Fields across modules (`sales`, `stores`, `products`, `users`, `tasks`, `shelf_audits`).
   - **Dedicated Supervisor Operations Horizon**: A dedicated navigation menu and segregated ledgers for **Sales Entries**, **Vera Optical Audits**, **Attendance Logs**, and **Field Exceptions**.
   - **Massive Scalability Architecture**: Multi-level hierarchical Org Chart (HQ &rarr; Regional Hub &rarr; Area &rarr; Territory &rarr; Store &rarr; Staff) engineered to handle 1,000+ stores with lazy loading and server-side cursor pagination.
   - **Autonomous Agents (Pax, Vera, Nexus, Aegis)**: Real-time frontline guidance, optical shelf verification, enterprise routing, and role-guarded administrative copilot actions with immutable audit trail.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PROJECT BLOC ENTERPRISE PLATFORM ARCHITECTURE                   │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                    ENTERPRISE MANAGEMENT PORTAL (WEB CONSOLE)                    │  │
│  │   [Admin Left Navigation Menu]                [Supervisor Left Navigation Menu]  │  │
│  │   ├─ 📊 Executive BI & AI Decision Briefings  ├─ 🛰️ Command Horizon Overview     │  │
│  │   ├─ 🤖 AI Agent Registry & Skill Studio     ├─ 💳 Sales & Fast-Sale Ledger     │  │
│  │   ├─ 🎯 Autonomous Field Tasks Engine         ├─ 📷 Vera Shelf Photo Audits      │  │
│  │   ├─ 🏬 Retail Store Network & 360° Dossier   ├─ ⏰ Attendance & Shift Roster    │  │
│  │   ├─ 📦 Product Catalog & Fast-Sale Stepper   ├─ ⚠️ Field Exceptions & Approvals │  │
│  │   ├─ 👥 Staff, Org Chart & Roster (CRUD)      ├─ 🏬 Territory Store Network      │  │
│  │   ├─ 📑 Executive Reports & Compliance Ledger └─ 👥 Territory Frontline Staff    │  │
│  │   ├─ 📜 Cross-Module Audit Trail & Security                                      │  │
│  │   └─ ⚙️ Module Dynamic Fields & Cloud Settings                                   │  │
│  └───────────────────────────────┬──────────────────────────────────────────────────┘  │
│                                  │                                                     │
│                                  ▼ Autonomous Task Dispatch & Telemetry                │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        AUTONOMOUS AGENT ORCHESTRATION MESH                       │  │
│  │   ┌────────────────────┐   ┌───────────────────────┐   ┌─────────────────────┐   │  │
│  │   │   PAX COPILOT      │   │     VERA AUDITOR      │   │    NEXUS ROUTER     │   │  │
│  │   │ Frontline Coach    │   │ Multimodal Shelf Vision│  │ ERP & BigQuery Sync │   │  │
│  │   │ Attendance & Sales │   │ Planogram Compliance  │   │ Anomaly Escalation  │   │  │
│  │   └────────┬───────────┘   └───────────┬───────────┘   └──────────┬──────────┘   │  │
│  └────────────┼───────────────────────────┼──────────────────────────┼──────────────┘  │
│               │                           │                          │                 │
│               ▼ Low-Latency PWA Transport │ Real-time Telemetry      │ Sync            │
│  ┌───────────────────────────────────────────────────────────────────▼──────────────┐  │
│  │                       FRONTLINE PROMOTER MOBILE PWA                              │  │
│  │   - GPS Geofenced Check-In & Morning Mission Briefing                            │  │
│  │   - 3-Second Fast-Sale Stepper (Empty-Default, 1-Tap Focus Pins, Barcode Cam)    │  │
│  │   - Vera Multimodal Shelf & Planogram Camera Verification                         │  │
│  │   - Proactive Agent Messages, Reminders & Task Prompts                           │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Enterprise Master Domain Model

### 2.1 Multi-Tenant Company & Workspace Structure
Every client organization (e.g. *Samsung Southeast Asia*, *Nike Philippines*, *Unilever JAPAC*) operates in an isolated workspace with:
- **Tenant Profile**: Business registration, primary trade currency (SGD, PHP, USD, MYR, JPY), timezones, operating SLA hours.
- **Google Cloud Media Vault**: Root Google Drive 5TB Folder ID for zero-egress shelf video and photo storage.
- **Executive Sheets Bridge**: Dedicated Google Sheet ID for real-time bidirectional streaming.
- **Brand Standards**: Custom target metrics, commission tiers, and planogram gold standards.

### 2.2 Corporate Organizational Hierarchy (Org Chart) & RBAC
Project BLOC models the true multi-tiered hierarchy of commercial retail:
```text
  [ Regional General Manager / Country Director ]  (Super Admin / Company Admin)
                         │
                         ▼
        [ Area Operations / Retail Brand Manager ]  (Operations Director)
                         │
                         ▼
        [ Field Supervisor / Territory Team Lead ]  (Field Supervisor)
                         │
                         ▼
       [ Store Promoter / Merchandiser / Brand Rep ]  (Frontline Field User)
```
- **Role Permissions Matrix**:
  - `super_admin` / `company_admin`: Full system control, workspace provisioning, AI agent skill authoring, financial commission structures, API keys.
  - `supervisor`: Manages territory store clusters, monitors live promoter attendance, reviews shelf audit anomalies, receives real-time agent escalations.
  - `promoter`: Frontline mobile access, localized conversations with Pax in native dialect (Tagalog, Singlish, Malay), 1-tap sales entry, shelf camera uploads.

### 2.3 Retail Store Network & 360° Store Intelligence
Stores represent physical trade locations within modern retail chains:
- **Store Metadata**: Code (`SM-MEGA-01`), Store Name, Retail Chain (SM Supermalls, FairPrice, Robinsons, Watsons, 7-Eleven), City, Address.
- **Geofence Parameters**: Precise Latitude, Longitude, and Verification Radius (default 150m) for automated GPS arrival validation.
- **Store Tiering**: Flagship (high-volume multi-promoter), Tier 1, Tier 2 (roving promoter visits).
- **Store 360° Deep Drill-Down**:
  - Live promoters clocked in vs absent.
  - Shift sales velocity vs daily target.
  - Historical Vera Planogram compliance ratings.
  - Pending and completed agent tasks.
  - Stock-out / out-of-stock (OOS) indicators.

### 2.4 Product Catalog, Barcode Registry & Stepper Pins
- **SKU Code & Title**: Unambiguous corporate SKU identifier.
- **Barcode / QR String**: EAN-13, UPC, or custom internal barcodes matching shelf labels.
- **Pricing & Incentive Commission**: Base unit price, local currency, and direct promoter commission reward (e.g. +₱250 bonus per unit).
- **1-Tap Focus Promo Pin (`isFocusPromo`)**:
  - Admin toggle that pins high-priority campaign items to the promoter's **1-Tap Fast-Sale Quick Stepper** in the mobile app.
  - Items not pinned remain instantly accessible via the **Browse Full Catalog** drawer or the camera barcode scanner.

---

## 3. The AI Agent Registry, Skill Studio & Autonomous Task Engine

A cornerstone of Project BLOC is transforming AI from passive chatbots into **proactive, skill-driven retail agents**:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     AI AGENT REGISTRY & SKILL ORCHESTRATION PIPELINE                   │
│                                                                                        │
│   1. AGENT REGISTRY                                                                    │
│      ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐       │
│      │     PAX COPILOT     │   │    VERA AUDITOR     │   │    NEXUS ROUTER     │       │
│      │ Frontline Assistant │   │ Computer Vision     │   │ Regional Sync       │       │
│      │ Model: Gemini Flash │   │ Model: Gemini Pro   │   │ Model: Gemini Flash │       │
│      └──────────┬──────────┘   └──────────┬──────────┘   └──────────┬──────────┘       │
│                 │                         │                         │                  │
│   2. SKILL STUDIO (Attach & Configure Capabilities)                                    │
│      ├─ [Skill: Planogram Verification & Shelf Alignment] ──▶ Attached to Vera         │
│      ├─ [Skill: Daily Mission Briefing & Shift Pacing]    ──▶ Attached to Pax          │
│      ├─ [Skill: Out-of-Stock Detection & Stockout Alert]  ──▶ Attached to Vera/Nexus   │
│      ├─ [Skill: Competitor Price & Promo Intelligence]   ──▶ Attached to Pax/Vera     │
│      └─ [Skill: End-of-Day Sell-Through Reconciliation]  ──▶ Attached to Nexus        │
│                                                                                        │
│   3. AUTONOMOUS TASK DISPATCH & FIELD FOLLOW-UP ENGINE                                 │
│      ┌──────────────────────────────────────────────────────────────────────────┐      │
│      │ Task: "11:00 AM Shelf #4 Planogram Verification" (Vera)                 │      │
│      │ Target: All Promoters in SM Supermalls (PH)                              │      │
│      │ Cadence: Daily at 11:00 AM | Follow-up: 30 mins | Escalation: 60 mins   │      │
│      │ Prompt: "Hi {name}! Please upload a photo of Shelf #4 endcap."          │      │
│      └────────────────────────────────────┬─────────────────────────────────────┘      │
│                                           │                                            │
│                                           ▼ Agent Contacts Promoter                    │
│   4. PROMOTER CONTACT & FEEDBACK LOOP                                                  │
│      Pax Chat ──▶ Promoter receives prompt ──▶ Snaps photo ──▶ Vera analyzes score    │
│      If no response in 30m ──▶ Agent sends gentle reminder in chat                     │
│      If no response in 60m ──▶ Agent escalates to Area Supervisor & marks delinquent   │
│                                                                                        │
│   5. EXECUTIVE SYNTHESIS & REPORTING                                                   │
│      Agent synthesizes compliance across stores ──▶ Generates Executive Digest         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Registered Core Agents
1. **Pax (The Frontline Operations Copilot)**:
   - **Engine**: Gemini 2.5 Flash.
   - **Core Purpose**: Daily attendance check-ins, mission briefing, zero-typing sales entry, multilingual translation (conversing in Tagalog/Singlish while writing English records to DB).
2. **Vera (The Multimodal Computer Vision Auditor)**:
   - **Engine**: Gemini 2.5 Pro.
   - **Core Purpose**: Optical shelf analysis, planogram compliance verification, Share of Shelf (SoS) computation, out-of-stock gap detection, missing shelf tag detection.
3. **Nexus (The Enterprise Routing & Anomaly Sentinel)**:
   - **Engine**: Gemini 2.5 Flash.
   - **Core Purpose**: Cross-store revenue normalization (multi-currency to USD/SGD), Google Sheets bidirectional synchronization, supervisor escalation routing, End-of-Day executive digests.

### 3.2 The Skill Catalog & Studio
Authorized management personnel can dynamically configure skills and attach them to agents:
- **Skill 1: Planogram Compliance Verification (`planogram_audit`)**:
  - Evaluates endcap/shelf photos against reference standards stored in Google Drive.
  - Scores compliance from 0 to 100%, generates bounding boxes for misaligned facings.
- **Skill 2: Out-of-Stock (OOS) & Low-Inventory Sentinel (`stockout_alert`)**:
  - Detects empty shelf slots, cross-references recent sell-out velocity, and flags replenishment orders to the store manager.
- **Skill 3: Shift Check-In & Target Pacing Coach (`shift_pacing`)**:
  - Follows up with promoters who haven't clocked in within 15 minutes of store opening.
  - Computes hourly run-rate vs daily target and sends encouraging, actionable sales tips.
- **Skill 4: Competitor Promo & Price Intelligence (`competitor_intel`)**:
  - Prompts promoters to photograph neighboring competitor endcaps or promotional bundles, extracting competitor pricing and discount structures.
- **Skill 5: Mystery Shopper & Frontline SOP Auditor (`sop_verification`)**:
  - Periodic checks on uniform compliance, promotional booth setup, and brand greeting protocols.

### 3.3 Autonomous Task Dispatch, Follow-Up & Escalation
- **Configuration Parameters**:
  - `Target Scope`: All stores, specific chain (e.g. all SM Supermalls), specific territory, or selected promoters.
  - `Trigger Mode`: Scheduled (e.g. 11:00 AM, 4:00 PM), event-driven (e.g. upon promoter check-in, upon target reached), or on-demand manual dispatch.
  - `Reminder Cadence`: Automated follow-up interval if task remains incomplete (e.g. 30 minutes).
  - `Escalation Threshold`: Auto-escalate to Field Supervisor if unanswered after deadline (e.g. 60 minutes).
- **Proactive Contact Loop**:
  - When triggered, the Agent sends a specialized interactive message directly into the promoter's active Pax chat stream.
  - The promoter clicks the action button directly in chat (e.g. `[📷 Run Vera Camera Audit]`), captures the photo, and submits.
  - Gemini evaluates the submission in under 2 seconds, updates the task status to `compliant` or `non_compliant`, and provides feedback.
  - If delinquent, the agent alerts the Area Supervisor's dashboard.

---

## 4. Executive Dashboards & Decision Intelligence

### 4.1 AI-Driven Situational Decision Briefing
Rather than requiring executives to wade through dozens of static tables, the dashboard features an **Autonomous Situational Briefing** powered by Gemini:
- Synthesizes real-time metrics across all active stores, shifts, transactions, and audit tasks.
- Automatically generates bulleted executive insights:
  - **Revenue Pacing**: Actual vs benchmark across regions.
  - **Critical Anomalies**: Stores running behind target or out-of-stock.
  - **Planogram Compliance**: High-performing chains vs non-compliant stores.
  - **Action Items**: Recommended interventions for area supervisors.

### 4.2 Deep Interactive Drill-Down (From Executive KPI to Frontline Evidence)
The system eliminates "blind spots" by allowing executives to click any dashboard item and drill down to the ground level:
- **Click a Store**: Opens the **Store 360° Drawer** &rarr; displays assigned staff, today's live shift timeline, individual transactions, shelf audit photos with visual verdicts, and pending agent tasks.
- **Click an Anomaly / Non-Compliance**: Opens the **Compliance Inspection Modal** &rarr; shows the exact prompt sent by the agent, promoter timestamps, photo evidence, and escalation logs.
- **Click an Agent Task**: Opens the **Task Telemetry Drawer** &rarr; displays response rates across stores, compliance percentage, and delinquent branches.

---

## 5. Enterprise Navigation Structure (Left-Hand Navigation Menu)

The Enterprise Management Portal features a modern, responsive **Left-Hand Navigation Sidebar**:
```text
┌────────────────────────────────────────────────────────┐
│ [🏢 Unilever JAPAC ▼]             [👤 Lester Alarcon]  │
├──────────────────────┬─────────────────────────────────┤
│ 📊 Executive BI      │  EXECUTIVE OVERVIEW & BRIEFING  │
│ 🤖 Agent Registry    │  [Gemini Situational Briefing]  │
│ 🎯 Autonomous Tasks  │  [KPI Metric Cards]             │
│ 🏬 Stores & Branches │  [Interactive Telemetry Table]  │
│ 📦 Product Catalog   │  [Live Store 360° Drawer]       │
│ 👥 Staff & Org Chart │                                 │
│ 📑 Reports & Audits  │                                 │
│ ⚙️ Cloud & Settings  │                                 │
└──────────────────────┴─────────────────────────────────┘
```

---

## 6. Comprehensive Database Schema Extensions

To support the full enterprise capabilities, the database schema in `src/db/schema.ts` is expanded with:
1. `agent_registry`: Registered AI agents (name, role, avatar, Gemini model, prompt rules, status).
2. `agent_skills`: Configurable skills attached to agents (skill code, description, trigger type, default parameters).
3. `agent_tasks`: Active and scheduled field tasks (target stores, cadence, prompt instructions, follow-up SLA).
4. `agent_field_contacts`: Execution logs of agent outreach to frontline staff (prompts, responses, compliance scores, escalations).
5. `executive_reports`: AI-synthesized executive briefings and compliance reports.
6. `org_nodes`: Corporate organizational topology linking headquarters, regional leads, supervisors, and stores.

---

## 7. Implementation & Rollout Roadmap

- **Phase A (Specification & Foundations)**: Document comprehensive enterprise architecture; establish data models for agents, skills, tasks, and org chart.
- **Phase B (Agent & Task Engine Backend)**: Implement REST endpoints for Agent Registry, Skill Configuration, Task Dispatch, and Gemini Executive Summarization.
- **Phase C (Enterprise UI Overhaul)**: Build left-hand navigation sidebar, Executive BI Dashboard with Gemini Briefing, Agent & Skill Studio, Store 360° drill-down drawer, and interactive Org Chart.
- **Phase D (Frontline PWA Synchronization)**: Connect dispatched agent tasks to the promoter Pax chat stream, enabling live interactive audits and real-time dashboard updates.
- **Phase E (Verification & Polish)**: End-to-end testing across demo workspaces (Samsung, Nike, Unilever) and deployment validation.
