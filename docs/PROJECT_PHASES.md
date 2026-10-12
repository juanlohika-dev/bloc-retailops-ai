# Project BLOC: Phased Implementation Plan

## Phase 1: Foundation & Data Backbone (Current Phase)
**Goal**: Establish the repository, database schema, environment configs, and connection tests.
- [x] Initialize Git repository and link to `https://github.com/juanlohika-dev/bloc-retailops-ai`.
- [x] Setup `.gitignore` and `.env.example`.
- [x] Create project directory tree (`docs/`, `src/db/`, `src/agents/`, `src/integrations/`, `src/web/`).
- [x] Author comprehensive Drizzle ORM Schema for Turso (`src/db/schema.ts`).
- [ ] Connect Turso libSQL Database (URL + Auth Token).
- [ ] Run initial schema push / migration (`drizzle-kit push`).
- [ ] Seed database with initial demo data (FairPrice VivoCity, SM Megamall, focus SKUs, test promoters).

## Phase 2: Agent Mesh & Google Cloud Integrations
**Goal**: Build the Tri-Pillar integrations and multi-agent core.
- [ ] Setup Google Service Account credentials for Google Drive & Google Sheets.
- [ ] Build **Pax Core**: Gemini 2.5 Flash conversational handler with Morning Mission Briefing & Fast-Sale intent parser.
- [ ] Build **Vera Core**: Gemini 2.5 Pro multimodal vision analyzer for shelf photos & planogram verification.
- [ ] Build **Nexus Core**: Bidirectional Google Sheets 2-way sync worker & supervisor exception alerts.

## Phase 3: Frontline PWA & Fast-Sale Micro-App
**Goal**: Deliver a responsive, mobile-first web app that wows judges.
- [ ] Build Mobile PWA Interface (Promoter view):
  - Morning Check-in screen with GPS status & daily target briefing.
  - Interactive Pax chat stream with quick action chips.
  - 3-Second Fast-Sale Mini-Sheet (Focus SKU steppers + HTML5 Barcode/QR camera scanner).
  - Vera camera shelf auditor with bounding-box compliance overlay.
- [ ] Build Supervisor Web Console:
  - Live store map, real-time SoS metrics, discrepancy alerts.

## Phase 4: Containerization, Cloud Run Deployment & Pitch Assets
**Goal**: Ship production deployment on Google Cloud and finalize hackathon deliverables.
- [ ] Create multi-stage `Dockerfile` (optimized for Google Cloud Run).
- [ ] Deploy container to Google Cloud Run (asia-southeast1).
- [ ] Connect custom domain / verify public HTTPS endpoint.
- [ ] Record 3-minute video walkthrough pitch.
- [ ] Push code and update README on GitHub repo (`juanlohika-dev/bloc-retailops-ai`).
