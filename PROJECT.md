# PROJECT.md — IncidentIQ Machine Specification & AI Context

> **Target Audience:** Autonomous Coding Agents, LLMs, and System Evaluators  
> **Repository:** `https://github.com/sathishctech/incident-iq`  
> **System Classification:** Single-Page Reactive Operations Dashboard & Problem Management Engine  
> **Architectural Pattern:** Zero-Build Vanilla ES6+ / Modular Client-Side Ingestion / Dynamic Classification

---

## 1. Machine Manifest & Environment Metadata

```json
{
  "project_name": "IncidentIQ",
  "version": "2.1.0",
  "runtime_environment": "Modern Browser (ES6+), Standalone Static File Server",
  "build_pipeline": "None (No npm, no webpack, no node_modules)",
  "state_management": "Single Global Reactive State Object (Window.state)",
  "dependencies": {
    "css_framework": "Tailwind CSS v3 (CDN)",
    "charts": "Chart.js v4.4.1 (UMD)",
    "icons": "Lucide Icons (vLatest)",
    "parser": "PapaParse v5.4.1 (CDN)"
  },
  "source_dataset": "data/incidents.tsv",
  "fallback_dataset": "data/incidents-data.js",
  "entrypoint": "index.html",
  "engine": "app.js",
  "styling": "styles.css",
  "http_server": "serve.py (Python 3 http.server with CORS on :3000)"
}
```

---

## 2. System Architecture & State Machine

IncidentIQ operates as a pure client-side reactive application. All state mutations follow a unidirectional data flow:

```
[ Ingest (TSV / CSV) ]
       │
       ▼
[ Parse (PapaParse) ]
       │
       ▼
[ Algorithmic Normalization & Classification ]
  (Bug, Gap, User Experience, External)
       │
       ▼
[ Reactive State Store (state.allIncidents) ]
       │
       ▼
[ applyFilters() ──► state.filteredIncidents ]
       │
       ├─────────────────────┬─────────────────────┬─────────────────────┐
       ▼                     ▼                     ▼                     ▼
[ renderSummarySection ]  [ renderExploreSection ] [ renderConfluenceCTA ] [ renderServiceMatrix ]
  - Overall Trend           - Category Tabs         - CAPA Registry        - Risk Scoring
  - Category Share Donut    - Problem Profiles      - Storage Format Copy  - Health Matrix
  - Top 3 Contributors      - Grouped Tables        - CSV Export
  - Change Impact Combo     - Modal Drawers
```

### 2.1 Global State Contract (`state`)
```typescript
interface ApplicationState {
  allIncidents: IncidentRecord[];
  filteredIncidents: IncidentRecord[];
  filters: {
    month: string;          // 'ALL' | 'YYYY-MM'
    category: string;       // 'ALL' | 'Bug' | 'Gap' | 'User Experience' | 'External'
    service: string;        // 'ALL' | Application_Service string
    priority: string;       // 'ALL' | '1 - Critical' | '2 - High' | '3 - Moderate' | '4 - Low'
    changeRelated: string;  // 'ALL' | 'Yes' | 'No'
    search: string;         // Case-insensitive substring query
  };
  charts: {
    overallTrend?: Chart;
    categoryTrend?: Chart;
    categoryShare?: Chart;
    changeTrend?: Chart;
  };
  tablePage: number;        // Default 1
  pageSize: number;         // Default 10
  sortCol: keyof IncidentRecord;
  sortDir: 'asc' | 'desc';
  activeTab: 'summary' | 'explorer' | 'cta' | 'services';
  exploreCategory: 'ALL' | 'Bug' | 'Gap' | 'User Experience' | 'External';
  confluenceCategoryFilter: 'ALL' | 'Bug' | 'Gap' | 'User Experience' | 'External';
  lastLoadedTime: string;
  fileName: string;
}
```

---

## 3. Dynamic Classification Engine (Zero-Hardcoding Specification)

To satisfy the **strict zero-hardcode principle**, all incident records are classified into the four problem management categories using deterministic heuristics based on composite keyword scanning over `Root_Cause`, `Subcategory`, `Short_Description`, and `Category`.

### 3.1 Decision Tree Heuristic (`classifyIncident(r)`)

```javascript
function classifyIncident(r) {
  // 1. Direct pass-through if already classified
  const rawCat = (r.Category || '').trim();
  if (['Bug', 'Gap', 'User Experience', 'External'].includes(rawCat)) {
    return rawCat;
  }

  const cause = (r.Root_Cause || '').toLowerCase();
  const sub = (r.Subcategory || '').toLowerCase();
  const desc = (r.Short_Description || '').toLowerCase();
  const combined = `${cause} ${sub} ${desc} ${rawCat.toLowerCase()}`;

  // 2. External Domain Heuristic (Vendors, Gateways, Upstream, Network)
  if (
    cause.includes('third-party') || cause.includes('vendor') || cause.includes('gateway') ||
    cause.includes('cdn') || cause.includes('external') || cause.includes('sms') ||
    combined.includes('rate limit') || combined.includes('breaking change') || combined.includes('ssl cert')
  ) {
    return 'External';
  }

  // 3. User Experience Heuristic (Auth Friction, Password Resets, Usability)
  if (
    cause.includes('user error') || cause.includes('expired credential') ||
    sub.includes('password reset') || combined.includes('user experience') ||
    combined.includes('login screen') || combined.includes('usability') ||
    combined.includes('redirect back to login')
  ) {
    return 'User Experience';
  }

  // 4. Gap Heuristic (Capacity, Scaling Lag, Schema Drift, Contention, Scheduler)
  if (
    cause.includes('lag') || cause.includes('contention') || cause.includes('capacity') ||
    cause.includes('schema drift') || cause.includes('scheduler') || cause.includes('downstream api data delay') ||
    cause.includes('misconfiguration') || cause.includes('scaling') || combined.includes('resource limit')
  ) {
    return 'Gap';
  }

  // 5. Bug Heuristic (Defect, Deadlock, Memory Leak, Crash, Regression, Asset Caching)
  if (
    cause.includes('defect') || cause.includes('bug') || cause.includes('regression') ||
    cause.includes('lock') || cause.includes('crash') || cause.includes('deadlock') ||
    combined.includes('broken') || combined.includes('timeout after') || combined.includes('exception')
  ) {
    return 'Bug';
  }

  // Fallback Default
  return 'Bug';
}
```

---

## 4. Problem Management Category Meta Contracts

Every category maps to a deterministic metadata profile (`CATEGORY_META`) containing visual styling and its 4-pillar problem management specification:

```typescript
interface CategoryDefinition {
  color: string;         // Hex code
  bgLight: string;       // RGBA 12% opacity
  border: string;        // RGBA 30% opacity
  icon: string;          // Lucide icon identifier
  badgeClass: string;    // Tailwind CSS utility classes
  title: string;         // Full semantic category name
  summary: {
    rootCause: string;   // Technical origin & failure mode
    workaround: string;  // Immediate mitigation procedure
    sop: string;         // L1/L2 Runbook ID and steps
    fixPlan: string;     // PRB ticket & long-term engineering fix
  };
}
```

### Standard Profiles Registry
1. **`Bug`** (`#EF4444` / Rose):
   - **Root Cause:** Code defects, database deadlocks, memory leaks, CDN cache drift.
   - **Workaround:** Recycle worker pods, purge CDN edge cache, kill blocked DB queries.
   - **SOP:** `SOP-BUG-104: Production Service Triage & Pod Recycling`.
   - **Fix Plan:** `PRB-2026-004: Read Committed snapshot isolation & webpack chunk hashing`.
2. **`Gap`** (`#F59E0B` / Amber):
   - **Root Cause:** Auto-scaling lags during 09:00 peak, compute contention between OLAP and OLTP, schema drift.
   - **Workaround:** Pre-scale container replica pool, pause heavy analytic batch extracts.
   - **SOP:** `SOP-GAP-218: Peak Capacity Surge & Contention Runbook`.
   - **Fix Plan:** `PRB-2026-012: KEDA predictive autoscaling & compute warehouse isolation`.
3. **`User Experience`** (`#3B82F6` / Blue):
   - **Root Cause:** Confusing reset redirects, expired tokens without refresh, cookie caching.
   - **Workaround:** Revoke stale sessions, issue direct magic link, clear client browser cache.
   - **SOP:** `SOP-UX-307: Customer Identity & Auth Support Runbook`.
   - **Fix Plan:** `PRB-2026-029: Silent PKCE token renewal & redirect UX redesign`.
4. **`External`** (`#A855F7` / Purple):
   - **Root Cause:** Carrier SMS delivery latency (>120s), vendor API rate-limits, CDN PoP drops.
   - **Workaround:** Reroute outbound traffic to secondary carrier, throttle outbound request concurrency.
   - **SOP:** `SOP-EXT-402: Third-Party & Vendor Outage Runbook`.
   - **Fix Plan:** `PRB-2026-033: Active-active multi-gateway routing with circuit breakers`.

---

## 5. Metric Derivation Formulas & Mathematical Contracts

### 5.1 Period-over-Period Delta Calculation ($\Delta_{\text{period}}$)
Given the selected month index $t$ and immediately preceding month $t-1$:
$$\Delta_{\text{MoM}} = \frac{N_t - N_{t-1}}{N_{t-1}} \times 100$$
* A positive delta renders as an alert (`text-rose-400` with `trending-up`).
* A negative delta renders as an improvement (`text-emerald-400` with `trending-down`).

### 5.2 Category Share Percentage ($S_{\text{cat}}$)
$$S_{\text{cat}} = \left( \frac{\sum \text{Incidents in Category}}{\sum \text{Total Filtered Incidents}} \right) \times 100$$

### 5.3 Change-Induced Inflow Ratio ($R_{\text{change}}$)
$$R_{\text{change}} = \left( \frac{\sum \text{Incidents with } \text{Change\_Related} = \text{'Yes'}}{\sum \text{Total Monthly Incidents}} \right) \times 100$$

### 5.4 Service Risk Score Calculation
$$\text{Score} = (4 \times N_{P1/P2}) + (1.5 \times N_{\text{Change}}) + (0.5 \times N_{\text{Total}}) - (0.2 \times \text{SLA}_{\text{Met}}\%)$$
* $\text{Score} > 35 \implies \mathbf{Critical}$ (Red)
* $18 < \text{Score} \le 35 \implies \mathbf{Elevated}$ (Amber)
* $\text{Score} \le 18 \implies \mathbf{Low}$ (Green)

---

## 6. DOM Elements, Canvases, & Binding Index

| Element ID | Tag | Section | Bound Function / Role |
| :--- | :--- | :--- | :--- |
| `chart-overall-trend` | `<canvas>` | Summary | `renderOverallTrendChart()` |
| `chart-category-trend` | `<canvas>` | Summary | `renderCategoryTrendChart()` |
| `chart-category-share` | `<canvas>` | Summary | `renderCategoryShareChart()` |
| `chart-change-trend` | `<canvas>` | Summary | `renderChangeTrendChart()` |
| `top-contributors-grid` | `<div>` | Summary | `renderTopContributorsGrid()` |
| `summary-total-incidents` | `<div>` | Summary | Display current filtered total |
| `summary-period-delta` | `<div>` | Summary | Display calculated MoM delta |
| `explore-category-pills` | `<div>` | Explore | Category switcher tabs (`selectExploreCategory()`) |
| `category-problem-summary-card`| `<div>` | Explore | 4-Pillar Problem Management Profile |
| `incident-table-tbody` | `<tbody>`| Explore | Grouped records table rows |
| `confluence-actions-tbody` | `<tbody>`| Call to Action | CAPA registry rows |
| `service-matrix-tbody` | `<tbody>`| Services | Application reliability matrix rows |
| `incident-modal` | `<div>` | Global | Slide-over incident detail modal |
| `upload-modal` | `<div>` | Global | Drag & Drop TSV/CSV ingestion modal |

---

## 7. Guidelines for Autonomous AI Agents Extending This Codebase

When modifying or expanding IncidentIQ:
1. **Never Hardcode Counts or Strings:** Always query `state.filteredIncidents` or `state.allIncidents`.
2. **Chart Lifecycle Invariant:** Always destroy existing Chart.js instances before re-initializing (`if (state.charts.xyz) state.charts.xyz.destroy()`).
3. **Preserve CSS Token Semantics:** Use Tailwind utility classes matching the existing color scheme (`#090D16`, `#101626`, `#6366F1`, `#EF4444`, `#F59E0B`, `#3B82F6`, `#A855F7`).
4. **Data Fallback Compatibility:** Maintain backward compatibility with `window.EMBEDDED_INCIDENTS_DATA` for zero-server `file://` execution.
5. **Confluence Interoperability:** Output tables must adhere to standard Atlassian Storage Format / GFM Table specs (`|| Header ||` or `| Header |`).
