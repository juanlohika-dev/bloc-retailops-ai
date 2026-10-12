# Enterprise Admin & Operations Console Specification

**System**: Project BLOC Management Portal  
**Target Roles**: Company Admin, Operations Director, Field Supervisors  
**Access URL**: `/admin` (or `/console/[tenant_slug]`)  

---

## 1. Overview & Architecture

Project BLOC operates with a **dual-interface model**:
1. **Frontline Mobile PWA**: A focused, low-bandwidth, conversational micro-app for field promoters (Pax Copilot, 3-Second Fast-Sale Stepper, Vera Camera Shelf Audit).
2. **Enterprise Admin Console**: A responsive web portal for Operations Managers and Brand Executives to manage **Stores, Products, Promos, Staff, and System Settings**.

```text
┌────────────────────────────────────────────────────────────────────────┐
│               PROJECT BLOC · OPERATIONS COMMAND CENTER                 │
│                                                                        │
│  [ 🏢 Workspace: Unilever PH ]   [ 👤 Lester Alarcon (Company Admin) ] │
├────────────────────────────────────────────────────────────────────────┤
│  NAV:                                                                  │
│  [ 📊 Overview ]  [ 🏬 Stores ]  [ 📦 Products ]  [ 🏷️ Promos ]         │
│  [ 👥 Staff & Routes ]  [ 📋 Shifts & Targets ]  [ ⚙️ Settings ]       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 6 Core Management Modules

### Module 1: Store & Route Management (`/admin/stores`)
Allows operations managers to manage retail branches across multiple chains:
- **Store Code & Name**: e.g., `SM-MEGA-01` (SM Megamall Cyberzone), `FP-VIVO-02` (FairPrice VivoCity).
- **Retail Chain**: Modern trade chain (e.g., SM Supermalls, Robinsons, FairPrice, Watsons).
- **Geofence Coordinates**: Latitude, Longitude, and Radius (150m default) used by Pax for automated GPS clock-in verification.
- **Daily Target Default**: Benchmark daily sales quota for the branch (e.g., ₱25,000 or SGD $1,200).
- **Active Roster**: Displays which promoters are currently clocked into this branch.

```text
┌────────────────────────────────────────────────────────────────────────┐
│  🏬 STORE MANAGEMENT                                 [ + Add Store ]   │
├────────────────────────────────────────────────────────────────────────┤
│  Code        Name               Chain       City      Target   Status  │
│  SM-MEGA-01  SM Megamall        SM Malls    Manila    ₱25,000  Active  │
│  FP-VIVO-01  FairPrice VivoCity FairPrice   SG        $1,200   Active  │
│  ROB-GAL-01  Robinsons Galleria Robinsons   Manila    ₱18,000  Active  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Module 2: Product Catalog & Barcode Registry (`/admin/products`)
Maintains the SKU catalog and configures camera scanning:
- **SKU Code & Name**: e.g., `OLED-55-B4` (55" 4K OLED TV).
- **Barcode / QR String**: EAN-13, UPC, or QR string used by the in-chat camera barcode scanner for instant 0.5s auto-fill.
- **Unit Price & Currency**: Local pricing (e.g., ₱45,990 PHP or SGD $1,299).
- **Promoter Commission**: Direct incentive per unit sold (e.g., ₱150/unit) to motivate accurate reporting.
- **"Focus Promo" Pin Toggle (`isFocusPromo`)**:
  - When toggled **ON**, this SKU appears directly on the promoter's **1-Tap Fast-Sale Stepper card in Pax chat**!
  - When OFF, it remains searchable via barcode scan or catalog search.

---

### Module 3: Promotional Campaign Builder (`/admin/promos`)
Configures daily focus promotions, flash sales, and product bundles:
- **Campaign Name & Code**: e.g., `WEEKEND-BUNDLE-A`, `SUMMER-FLASH-10`.
- **Bundle Items**: Combine multiple SKUs into a package (e.g., 1x 55" OLED + 1x Soundbar).
- **Discount Structure**: Percentage discount, fixed amount off, or promotional package pricing.
- **Promoter Incentive Bonus**: Extra commission credit for promoters who successfully push the promotional bundle during the campaign window.
- **Start / End Dates**: Automated activation and deactivation.

---

### Module 4: Staff & Promoter Administration (`/admin/users`)
Manages field staff, roles, and communication preferences:
- **Name, Email, Phone**: Staff identity.
- **Role Assignment**: `promoter`, `supervisor`, `company_admin`, `super_admin`.
- **Preferred Language**: Tagalog (`tl-PH`), Singlish/English (`en-SG`), Malay (`ms-MY`), Japanese (`ja-JP`).
  - *Pax dynamically speaks this language to the promoter, while logging structured data in corporate English.*
- **Supervisor Assignment**: Groups promoters under regional team leads for exception routing.

---

### Module 5: Roster & Store Scheduling (`/admin/shifts`)
Maps promoters to specific store locations and dates:
- **Weekly Schedule**: Assign Sarah to FairPrice VivoCity on Mon–Wed, and Orchard on Thu–Fri.
- **Custom Shift Targets**: Set specialized quotas based on weekend foot traffic vs. weekday norms.
- **Live Attendance Status**: Real-time indicator showing who has clocked in via GPS, who is late, and who is absent.

---

### Module 6: Workspace & Tri-Pillar Settings (`/admin/settings`)
Configures enterprise-wide cloud connections:
- **Base Reporting Currency**: SGD, PHP, USD, MYR, JPY.
- **Google Drive 5TB Media Vault Folder ID**: Points to the client company's dedicated Drive folder for shelf photos and video audits.
- **Bidirectional Google Sheets ID**: The live spreadsheet URL/ID for 2-way synchronization with executive dashboards.
- **Operating Hours & SLA**: Shift cutoff times and automated End-of-Day Nexus digest dispatch times.
