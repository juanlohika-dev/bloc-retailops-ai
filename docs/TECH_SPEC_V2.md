# Technical Specification Document v2: Project BLOC

**System Designation**: BLOC (Frontline Agentic Orchestration Engine)  
**Team Name**: RetailOps AI  
**Team Leader**: Lester Alarcon  
**Repository**: [github.com/juanlohika-dev/bloc-retailops-ai](https://github.com/juanlohika-dev/bloc-retailops-ai)  
**Target Event**: Hack2Skill Google Cloud AI Builder Cup 2026 (JAPAC)  
**Target Track**: Retail & Commerce / Future of Work  

---

## 1. Executive Summary & Vision

**Project BLOC** is an enterprise frontline operations and agentic orchestration platform engineered to solve the persistent operational breakdown in distributed retail:
1. **High Promoter Turnover (40–60%)**: Complex enterprise software requires weeks of onboarding that field promoters abandon.
2. **24–48 Hour Reporting Latency**: Sales and shelf health data is trapped in manual spreadsheets or end-of-week tally sheets.
3. **Legacy Mobile ERP Friction**: Clunky 15-field mobile forms that promoters resist filling out during busy retail shifts.

BLOC replaces static form entry with a **Multi-Agent Conversational & Micro-App Mesh** coupled with a **3-Second Fast-Sale Capture Protocol** (1-tap focus SKU quantity steppers and in-chat camera barcode scanner). Operating across Singapore, the Philippines, and JAPAC retail corridors, BLOC bridges low-bandwidth frontline devices with corporate SAP/ERP systems and Google Workspace.

---

## 2. Tri-Pillar Google Ecosystem Integration

BLOC leverages Google Cloud native infrastructure to maximize enterprise performance and cost efficiency:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE CLOUD PLATFORM                           │
│                                                                        │
│   ┌─────────────────────┐   ┌───────────────────┐   ┌──────────────┐   │
│   │   GOOGLE DRIVE      │   │     VERTEX AI     │   │ GOOGLE SHEETS│   │
│   │   5TB Media Vault   │   │  Gemini 2.5 Pro   │   │ Bidirectional│   │
│   │  Shelf photos & SOP │   │  Gemini 2.5 Flash │   │ Sync Bridge  │   │
│   └──────────┬──────────┘   └─────────▲─────────┘   └──────▲───────┘   │
│              │                        │ Byte stream        │           │
│              ▼                        │                    ▼           │
│   ┌───────────────────────────────────┴────────────────────────────┐   │
│   │                 GOOGLE CLOUD RUN (UNIFIED)                     │   │
│   │      Next.js Frontline PWA + FastAPI/Node.js Agent Mesh        │   │
│   └───────────────────────────────────┬────────────────────────────┘   │
│                                       │ libSQL Protocol                │
│                                       ▼                                │
│                         ┌───────────────────────────┐                  │
│                         │   TURSO EDGE DATABASE     │                  │
│                         │   Drizzle ORM Schema      │                  │
│                         └───────────────────────────┘                  │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Google Drive (Zero-Cost 5TB Media Vault)**:
   - Retail photo audits and training media are routed via Service Account directly into Google Drive.
   - The relational database stores only the lightweight `drive_file_id`, saving cloud bucket egress costs.
2. **Vertex AI (Multimodal Intelligence Engine)**:
   - **Gemini 2.5 Flash**: Sub-second agent tool dispatch, real-time multilingual translation (Tagalog, Malay, Singlish to English), and Fast-Sale intent extraction.
   - **Gemini 2.5 Pro**: Deep multimodal visual reasoning—pulls shelf image bytes directly from Drive to compute Share of Shelf (SoS) and planogram compliance.
3. **Google Sheets (Bidirectional Operational Bridge)**:
   - **Outbound**: Real-time sales transactions and shift completions stream directly into regional executive Google Sheets.
   - **Inbound**: When regional directors adjust daily quotas or promo focus in Sheets, webhook listeners mutate the Turso database and Pax immediately alerts the frontline promoter.

---

## 3. The 3-Second Fast-Sale Protocol (Frontline UX)

Instead of having promoters type unstructured sentences in chat (which creates terrible optics and cannot handle multi-SKU stores), BLOC delivers **Zero-Typing Sales Capture**:

1. **1-Tap Focus SKU Stepper**:
   - Pinned at the top of the chat: Today’s 3–5 focus promotional items with quick `[-] [Qty] [+]` steppers.
   - Promoters log sales in **under 3 seconds with 2 taps**.
2. **In-Chat Camera Barcode / QR Scanner**:
   - For catalog items not pinned on promo: tap `[📷 Scan Barcode]`, point camera at the box/packaging EAN-13 code &rarr; auto-populates product name, SKU, and unit price in 0.5s.
3. **Optional Cashier POS Receipt Snap**:
   - If store policy requires proof: snap photo of the register slip; Gemini Flash OCR cross-references timestamp, store ID, and total.
4. **Live Target Thermometer**:
   - Live visual indicator displays progress toward daily shift bonus (e.g. `₱8,450 / ₱15,000 · 56%`).

---

## 4. Multi-Agent Mesh Architecture

### Agent 1: Pax (The Frontline Copilot)
- **Engine**: Vertex AI Gemini 2.5 Flash
- **Responsibilities**:
  - Morning Mission Briefing (attendance GPS check-in, store route, today's targets).
  - Fast-Sale Capture coordination.
  - Multilingual Translation: Communicates in Tagalog/Malay/Singlish with the worker, while writing structured records to Turso and Sheets in corporate English.

### Agent 2: Vera (The Multimodal Shelf Auditor)
- **Engine**: Vertex AI Gemini 2.5 Pro
- **Responsibilities**:
  - Receives endcap and shelf camera uploads.
  - Compares layout against the Drive gold-standard planogram.
  - Calculates **Share of Shelf (SoS %)**, detects out-of-stock gaps, flags missing price tags, and issues immediate fix-and-retake guidance.

### Agent 3: Nexus (The Enterprise Router & Supervisor)
- **Engine**: Vertex AI Gemini 2.5 Flash
- **Responsibilities**:
  - Bidirectional Google Sheets synchronization.
  - Out-of-Stock and discrepancy alerts sent to supervisors.
  - End-of-Day executive anomaly digests.

---

## 5. Production Database Schema (Turso libSQL)

The complete schema is implemented in `src/db/schema.ts` using Drizzle ORM:
- `workspaces`: Multi-tenant organization configs, base currency (SGD/PHP/USD), root Drive folder ID, Sheets sync ID.
- `users`: Promoters, supervisors, preferred language (`tl-PH`, `en-SG`, etc.), timezones.
- `stores`: Retail branches (SM Megamall, FairPrice VivoCity), GPS geofence, default targets.
- `products`: SKU catalog, EAN-13 barcode, focus promo flag, unit prices, commissions.
- `shifts`: Daily attendance logs, clock-in/out timestamps, target quotas.
- `sales_transactions`: Auditable sell-out records (promoter, store, SKU, qty, price, captureMode, receiptDriveId).
- `shelf_audits`: Computer vision audit results (compliance score, SoS %, detected issues).
- `blocks`: Atomic composable blocks for custom metadata without migrations.
- `chat_messages`: Conversation transcripts with original language and English translations.
