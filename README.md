# IncidentIQ — Service Incident Review & Operations Intelligence

An enterprise-grade operational intelligence and problem management dashboard built for joint **Business & Engineering** service review reviews. Designed using the **UI/UX Pro Max** design system (Dark OLED / Bento Box architecture) and **21st.dev** interactive component patterns.

![IncidentIQ Dashboard Preview](screenshot.png)

---

## 🚀 Quick Start

### Option 1: Run with Built-in Server (Recommended)
From this directory, run:
```bash
./start.sh
```
Or directly with Python:
```bash
python3 serve.py
```
Open **[http://localhost:3000](http://localhost:3000)** in any modern web browser.

### Option 2: Open Directly (Zero Installation)
Double-click `index.html` or run:
```bash
open index.html
```
*(The dashboard includes offline embedded baseline data fallback for `file://` protocol support).*

---

## 🎯 Architecture & Sections

### 1. 📊 Summary Section
- **Overall Incident Trend:** Tracks total incidents over the selected period with continuous inflow timeline curves and period-over-period comparison deltas.
- **Category Trend:** Classifies incidents dynamically into four core problem management categories:
  - **Bug (39.1%):** Application code defects, database deadlocks, memory issues, and release asset cache drift.
  - **Gap (25.3%):** Auto-scaling lags, batch scheduler chokes, and warehouse compute contention.
  - **User Experience (21.1%):** Usability friction, password reset loops, and expired session tokens.
  - **External (14.6%):** Third-party SMS/MFA gateway latencies, vendor API rate limiting, and CDN edge packet drops.
- **Top Three Contributors per Category:** Identifies the top 3 offending applications/systems, top 3 root causes, and primary support teams to prioritize engineering work.
- **Change-Related Incident Trend:** Tracks the rising ratio of change-induced outages (62.5% of current incidents) to evaluate release quality and CI/CD stability.

### 2. 🔍 Explore Section
- **Incident View Grouped by Category:** Interactive group filters (`Bug`, `Gap`, `User Experience`, `External`, `ALL`) with live search, column sorting, and pagination.
- **Category-Level Problem Management Profiles:** Structured documentation for each category covering:
  - **Root Cause (RCA):** Deep technical failure origin.
  - **Workaround:** Immediate service restoration procedures.
  - **SOP:** Standard Operating Procedure runbook links (`SOP-BUG-104`, `SOP-GAP-218`, `SOP-UX-307`, `SOP-EXT-402`).
  - **Permanent Fix Plan:** Remediation tickets (`PRB-2026-004`, `PRB-2026-012`, `PRB-2026-029`, `PRB-2026-033`).
- **Incident Detail Drawer:** Click any incident record to view full timestamps, change numbers, and RCA summaries.

### 3. 📋 Call to Action (Confluence Tracking & RCA Governance)
- **CAPA Action Registry:** Track corrective and preventive actions with Action ID, description, owner, target due date, status, and linked problem records.
- **One-Click Confluence Integration:**
  - **"Copy Confluence Markup"**: Generates native Confluence table markup to paste directly into Post-Incident Review (PIR) and Knowledge Base spaces.
  - **"Export Actions CSV"**: Instant export for project tracking.

### 4. 🛡️ Service Reliability Matrix
- Evaluates application services across volume, P1/P2 major incidents, change exposure %, SLA compliance %, and MTTR to compute operational risk tiers.

---

## 🔄 Monthly Data Auto-Update Workflow

The dashboard adheres strictly to the **zero-hardcode principle**:
1. Replace `data/incidents.tsv` on disk with your latest ServiceNow / Jira export, OR
2. Drag and drop your `.tsv` / `.csv` file directly into the **"Update Monthly Data"** modal.
3. All metrics, categories, contributor rankings, and change ratios recalculate automatically!

---

## 📁 File Structure

```
incident-iq/
├── index.html            # Main dashboard application
├── app.js                # Reactive classification engine, metrics & Chart.js
├── styles.css            # Dark OLED styling & print layout
├── serve.py              # Lightweight static HTTP server with CORS
├── start.sh              # One-click startup script
├── data/
│   ├── incidents.tsv     # Source-of-truth incident dataset
│   ├── incidents.json    # JSON baseline representation
│   └── incidents-data.js # Embedded offline fallback
├── snippets/             # High-resolution dashboard screenshots
└── README.md             # Project documentation
```

---

## 📄 License
MIT License. Built for enterprise incident intelligence and problem management.
