# Project BLOC: Frontline Agentic Orchestration Engine
> **Enterprise Retail Operations Command Portal & Proactive Multi-Agent Mesh**  
> *Developed for the Google Cloud AI Builder Cup 2026 by Team RetailOps AI*  
> **Repository**: [github.com/juanlohika-dev/bloc-retailops-ai](https://github.com/juanlohika-dev/bloc-retailops-ai)

---

## 🌟 Executive Vision & Problem Statement

Distributed frontline retail operations across JAPAC (Singapore, Philippines, Malaysia, Thailand, Vietnam, Japan) suffer from severe operational friction:

1. **The Frontline Compliance Abyss**: Promoters, field merchandisers, and brand reps are inundated with tedious, 15-field mobile forms. Over 45% of store compliance tasks (shelf photos, POS tallies, competitor monitoring) are either skipped or submitted 24–48 hours late.
2. **The "Shallow" Tooling Dilemma**: Legacy enterprise retail portals are passive, read-only dashboards. Head office defines planograms and daily quotas, but has no mechanism to proactively follow up with individual store staff, evaluate execution via computer vision, or escalate non-compliance before the shift ends.
3. **The Multi-Agent Solution**: **Project BLOC** replaces static reporting with an **Autonomous AI Agent Mesh** governed by an **Enterprise Operations Command Portal**:
   - Operations managers configure specialized AI agents (**Pax, Vera, Nexus**), attach skills, and schedule autonomous field routines.
   - Agents proactively contact store reps via low-bandwidth conversational channels in their local dialect (Tagalog, Singlish, Malay), guide them through 3-second sales logging and camera audits, follow up on delinquent submissions, and escalate issues to Area Supervisors.

---

## 🏛️ Enterprise System Architecture

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PROJECT BLOC ENTERPRISE PLATFORM ARCHITECTURE                   │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                    ENTERPRISE MANAGEMENT PORTAL (WEB CONSOLE)                    │  │
│  │   [Left Navigation Menu]                                                         │  │
│  │   ├─ 📊 Executive BI & AI Decision Briefings (Real-time Pacing, Outliers, SoS)  │  │
│  │   ├─ 🤖 AI Agent Registry & Skill Studio (Pax, Vera, Nexus + Custom Skills)     │  │
│  │   ├─ 🎯 Autonomous Field Tasks & Compliance Engine (Reminders & Escalations)     │  │
│  │   ├─ 🏬 Retail Store Network & Geofences (SM, FairPrice, Robinsons 360° Drill)   │  │
│  │   ├─ 📦 Product Catalog & 1-Tap Fast-Sale Pins (SKUs, Barcodes, Commissions)    │  │
│  │   ├─ 👥 Staff, Org Chart & Roster (Multi-Tier Hierarchy, Shift Assignments)      │  │
│  │   ├─ 📑 Executive Reports & Non-Compliance Audits (Gemini Automated Synthesis)   │  │
│  │   └─ ⚙️ Company & Cloud Settings (Google Drive 5TB Vault, Google Sheets 2-Way)   │  │
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

## 🤖 The Tri-Pillar AI Agent Mesh

| Agent | Engine | Core Role & Enterprise Capabilities |
| :--- | :--- | :--- |
| **Pax Copilot** | **Gemini 2.5 Flash** | **Frontline Operations Copilot**: Daily attendance check-ins, morning mission briefings, 3-second Fast-Sale stepper, multilingual conversational parsing (Tagalog, Singlish, Malay) translated into English records. |
| **Vera Auditor** | **Gemini 2.5 Pro** | **Multimodal Computer Vision Auditor**: Analyzes endcap and gondola shelf photos, computes Share of Shelf (SoS %), verifies planogram alignment against gold standards, and flags missing price tags or out-of-stock (OOS) gaps. |
| **Nexus Sentinel** | **Gemini 2.5 Flash** | **Enterprise Routing & Anomaly Sentinel**: Cross-store revenue normalization (multi-currency to USD/SGD), Google Sheets bidirectional sync, supervisor escalation routing, and End-of-Day executive digests. |

---

## 🖥️ Enterprise Operations Command Portal (8 Modular Panels)

The portal provides an Apple / Material 3 minimalist command center with a persistent left-hand navigation sidebar:

1. **📊 Executive BI & AI Decision Briefings**:
   - Synthesizes cross-chain telemetry with Gemini into 2-sentence situational briefings and 3 strategic interventions for Area Directors.
   - Live KPI cards: Total Revenue, Average Planogram Compliance, Active Monitored Branches, and Escalated Non-Compliance Incidents.
2. **🤖 AI Agent Registry & Dynamic Skill Studio**:
   - Configure registered agents, model assignments (`gemini-2.5-flash`, `gemini-2.5-pro`), and system instructions.
   - Skill Studio allows attaching specialized skills: *Planogram Verification*, *Shift Pacing Coach*, *Stockout Alert*, *Competitor Intel*, and *Sheets Sync*.
3. **🎯 Autonomous Tasks & Compliance Engine**:
   - Scheduled, event-driven, or on-demand field routines with automated reminder intervals and supervisor escalation thresholds.
   - 1-Tap `[⚡ Run / Dispatch Task]` reaches out to frontline staff in stores in real time.
4. **🏬 Store Network & 360° Inspection Drawer**:
   - Branch network directory with GPS geofencing radius (150m) and daily sales targets.
   - Clicking **`[🔍 360° Inspection]`** opens a slide-out drawer revealing active staff on duty, quota pacing gauge, recent receipts, and shelf audit photos with Gemini verdicts.
5. **📦 Product Catalog & 1-Tap Fast-Sale Pins**:
   - SKU codes, EAN/UPC barcodes, base prices, and commission bonuses.
   - `isFocusPromo` toggle pins high-priority promotional items directly to the promoter's mobile Fast-Sale Stepper.
6. **👥 Staff, Org Chart & Roster**:
   - Multi-tier corporate hierarchy visualization linking Regional HQ &rarr; Territory Supervisors &rarr; Frontline Promoters.
7. **📑 Executive Reports & Audits**:
   - Historical compliance audits and Gemini-synthesized management digests.
8. **⚙️ Cloud Vault & Settings**:
   - Real-time connection status for Google Drive 5TB Zero-Egress Media Vault and Google Sheets 2-Way Bridge.

---

## 📱 Frontline Mobile PWA (Zero-Typing Experience)

- **GPS Geofenced Arrival**: Confirms check-in within 150m radius of the assigned mall or branch.
- **Morning Mission Briefing**: Pax delivers a personalized 2-sentence briefing with daily quota and focus push SKUs in the promoter's preferred dialect.
- **3-Second Fast-Sale Stepper**:
  - Clean empty default state with 1-tap focus promo chips.
  - Steppers (+/-) and SKU search sheet enable logging sales in under 3 seconds without typing numbers.
- **Vera Multimodal Camera Audit**:
  - Promoters capture shelf photos directly in chat.
  - Gemini 2.5 evaluates compliance score, issues, and recommendations within 2 seconds.

---

## ☁️ Google Cloud Integrations

- **Google Gemini 2.5 Flash / Pro** (`@google/genai`): Core conversational copilot, situational briefings, and multimodal computer vision.
- **Google Drive 5TB Media Vault** (`src/integrations/google/drive.ts`): Secure, structured folder hierarchy for high-resolution shelf photo and video evidence.
- **Google Sheets 2-Way Enterprise Bridge** (`src/integrations/google/sheets.ts`): Zero-friction streaming between Project BLOC and corporate Google Spreadsheets.
- **Google Cloud Run**: Multi-stage, containerized deployment running in `asia-southeast1`.

---

## 🛠️ Project Structure

```text
bloc-retailops-ai/
├── Dockerfile                             # Multi-stage production container for Cloud Run
├── .dockerignore                          # Build ignore rules
├── package.json                           # Scripts and dependencies
├── tsconfig.json                          # TypeScript configuration
├── docs/
│   ├── ENTERPRISE_RETAIL_OPS_ARCHITECTURE.md # Master Architecture Specification v3.0
│   ├── ADMIN_MANAGEMENT_SPEC.md              # Management Console Specification
│   └── PROJECT_PHASES.md                     # Roadmap and delivery status
├── src/
│   ├── agents/
│   │   ├── pax/                           # Frontline Conversational Copilot
│   │   ├── vera/                          # Multimodal Shelf Vision Auditor
│   │   ├── nexus/                         # Regional Operations Router
│   │   └── demo/                          # AI Demo Workspace Generator
│   ├── api/
│   │   ├── server.ts                      # Express API Gateway & WebSocket endpoints
│   │   └── admin.ts                       # Enterprise Admin CRUD & Dispatch Engine
│   ├── db/
│   │   ├── client.ts                      # libSQL / Turso connection client
│   │   ├── schema.ts                      # Drizzle ORM Schema (19 enterprise tables)
│   │   └── seed.ts                        # Seed script for initial stores, SKUs, and staff
│   ├── integrations/
│   │   └── google/
│   │       ├── gemini.ts                  # Gemini 2.5 SDK integration
│   │       ├── drive.ts                   # Google Drive 5TB Media Vault
│   │       └── sheets.ts                  # Google Sheets 2-Way Enterprise Bridge
│   ├── lib/
│   │   └── currency.ts                    # JAPAC multi-currency USD/SGD normalizer
│   └── web/
│       └── index.html                     # Responsive Frontend (PWA + Admin Portal)
```

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- Node.js 20+ or 22+
- npm or pnpm
- Google Gemini API Key

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/juanlohika-dev/bloc-retailops-ai.git
cd bloc-retailops-ai

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY
```

### 3. Database Migration & Seeding
```bash
# Push schema to local libSQL database
npm run db:push

# Seed demo stores, focus SKUs, and promoters
npm run db:seed
```

### 4. Running the Development Server
```bash
npm run dev
# Server will start on http://localhost:5000
```

Open `http://localhost:5000` in your browser. You can seamlessly toggle between:
- **Promoter PWA Mode**: Frontline mobile phone simulator.
- **Supervisor Mode**: Territorial telemetry console.
- **Admin Ops Mode**: Full enterprise 8-panel management portal with left navigation menu.

### 5. Production Containerization (Docker / Google Cloud Run)
```bash
# Build the production Docker image
docker build -t bloc-retailops-ai:latest .

# Run container locally
docker run -p 8080:8080 -e GEMINI_API_KEY="your-api-key" bloc-retailops-ai:latest
```

---

## 🏆 Hackathon Submission Details

- **Event**: Google Cloud AI Builder Cup 2026
- **Team**: RetailOps AI
- **Lead Developer**: Lester Alarcon
- **License**: MIT
