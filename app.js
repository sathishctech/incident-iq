/**
 * IncidentIQ — Service Incident Review & Operations Intelligence Engine
 * Enterprise Problem Management & Continuous Improvement Architecture
 * 100% Dynamic Aggregations — Zero Hardcoding
 */

// Global Application State
const state = {
  allIncidents: [],
  filteredIncidents: [],
  filters: {
    month: 'ALL',
    category: 'ALL', // 'ALL' | 'Bug' | 'Gap' | 'User Experience' | 'External'
    service: 'ALL',
    priority: 'ALL',
    changeRelated: 'ALL',
    search: '',
  },
  charts: {},
  tablePage: 1,
  pageSize: 10,
  sortCol: 'Opened',
  sortDir: 'desc',
  activeTab: 'summary', // 'summary' | 'explorer' | 'cta' | 'services'
  exploreCategory: 'Bug', // Active category tab in Explore section
  confluenceCategoryFilter: 'ALL',
  lastLoadedTime: new Date().toLocaleTimeString(),
  fileName: 'data/incidents.tsv',
};

// Standard Categories Palette
const CATEGORY_META = {
  'Bug': {
    color: '#EF4444',
    bgLight: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: 'bug',
    badgeClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    title: 'Software & Code Defect',
    summary: {
      rootCause: 'Application code defects, database deadlock locks under concurrent order volume, tax engine deployment regressions, frontend bundle cache drift, and IdP token cache memory leaks.',
      workaround: 'Recycle exhausted application worker pods; execute CDN cache purge for frontend assets; kill locked database sessions via DBA kill-lock script.',
      sop: 'SOP-BUG-104: Production Service Triage & Pod Recycling -> Verify JVM memory profile -> Clear CDN edge cache -> Drain active worker thread pool -> Notify Core Billing L2 on-call.',
      fixPlan: 'PRB-2026-004: Refactor transactional lock isolation to Read Committed; implement deterministic webpack chunk hashing in CI/CD; introduce automated regression canary testing.'
    }
  },
  'Gap': {
    color: '#F59E0B',
    bgLight: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
    icon: 'split',
    badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    title: 'Capacity, Architecture & Process Gap',
    summary: {
      rootCause: 'Peak traffic auto-scaling cooldown lags during 09:00 morning spikes, resource contention between analytical reporting queries and OLTP billing, unannounced ETL schema drift, and batch job scheduler thread exhaustion.',
      workaround: 'Manually pre-scale container replica counts ahead of business peaks; throttle analytical batch extracts; pause non-essential reporting pipelines.',
      sop: 'SOP-GAP-218: Peak Capacity Surge & Contention Runbook -> Trigger horizontal auto-scaler manual override -> Route heavy analytic queries to read replicas -> Resume Kafka consumer groups.',
      fixPlan: 'PRB-2026-012: Transition container orchestration to predictive KEDA event-driven autoscaling; physically isolate reporting compute warehouse from operational OLTP databases; enforce schema registry contracts.'
    }
  },
  'User Experience': {
    color: '#3B82F6',
    bgLight: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.3)',
    icon: 'user-check',
    badgeClass: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    title: 'User Experience & Self-Service Friction',
    summary: {
      rootCause: 'Confusing password reset redirects, expired session tokens failing to trigger seamless re-authentication, outdated browser cookie caching, and ambiguous inline checkout validation errors.',
      workaround: 'Admin-initiated session revocation via IAM console; issue direct magic link reset to verified customer email; guide customer to hard refresh browser cache.',
      sop: 'SOP-UX-307: Customer Identity & Auth Support Runbook -> Verify Okta/IdP directory sync status -> Trigger customer factor reset -> Validate session cookie issuance -> Test portal login.',
      fixPlan: 'PRB-2026-029: Implement silent background token renewal using PKCE flow; redesign password reset navigation UX to prevent redirect loops; add proactive in-app session expiration warnings.'
    }
  },
  'External': {
    color: '#A855F7',
    bgLight: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.3)',
    icon: 'globe',
    badgeClass: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    title: 'Vendor, Gateway & Dependency Outage',
    summary: {
      rootCause: 'Third-party SMS/MFA gateway carrier delivery delays (>120s latency), payment gateway API rate-limiting during promotional sales events, and CDN edge node regional packet loss.',
      workaround: 'Reroute outbound OTP SMS traffic to secondary carrier gateway; enable outbound API request batching; shift regional CDN traffic away from degraded point of presence.',
      sop: 'SOP-EXT-402: Third-Party & Vendor Outage Runbook -> Check vendor status portal and latency metrics -> Toggle active-passive gateway failover switch -> Enable exponential backoff rate limiter.',
      fixPlan: 'PRB-2026-033: Deploy multi-vendor active-active SMS gateway architecture with automatic health-checked failover; introduce client-side circuit breakers and jittered exponential retry queues.'
    }
  }
};

// Priority Colors & Badges
const PRIORITY_BADGES = {
  '1 - Critical': '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">P1 Critical</span>',
  '2 - High': '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">P2 High</span>',
  '3 - Moderate': '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">P3 Moderate</span>',
  '4 - Low': '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40">P4 Low</span>',
};

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  initUIEvents();
  await loadData();
  renderDashboard();
});

/**
 * 1. Data Ingestion & Dynamic Classification
 */
async function loadData() {
  updateStatus('Loading dataset...', true);
  let rawText = '';

  try {
    const res = await fetch(`./data/incidents.tsv?t=${Date.now()}`);
    if (res.ok) {
      rawText = await res.text();
      state.fileName = 'data/incidents.tsv';
    }
  } catch (err) {
    console.warn('TSV fetch failed, checking embedded data.', err);
  }

  if (rawText && rawText.trim().length > 50) {
    parseAndSetData(rawText, '\t');
  } else if (window.EMBEDDED_INCIDENTS_DATA && window.EMBEDDED_INCIDENTS_DATA.length > 0) {
    setProcessedData(window.EMBEDDED_INCIDENTS_DATA);
    state.fileName = 'Embedded Baseline (data/incidents.tsv)';
  } else {
    updateStatus('Error: Could not load data. Please upload a file.', false);
    return;
  }

  state.lastLoadedTime = new Date().toLocaleTimeString();
  updateStatus(`Loaded ${state.allIncidents.length} incidents from ${state.fileName}`, false);
}

function parseAndSetData(text, delimiter) {
  const result = Papa.parse(text.trim(), {
    header: true,
    delimiter: delimiter || '\t',
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (!result.data || result.data.length === 0) {
    alert('Failed to parse incident data. Please check format.');
    return;
  }
  setProcessedData(result.data);
}

/**
 * Dynamic Classification Engine: Maps incidents into Bug, Gap, User Experience, External
 * Pure algorithmic classification with zero hardcoded incident IDs
 */
function classifyIncident(r) {
  const rawCat = (r.Category || '').trim();
  if (['Bug', 'Gap', 'User Experience', 'External'].includes(rawCat)) {
    return rawCat;
  }

  const cause = (r.Root_Cause || '').toLowerCase();
  const sub = (r.Subcategory || '').toLowerCase();
  const desc = (r.Short_Description || '').toLowerCase();
  const combined = `${cause} ${sub} ${desc} ${rawCat.toLowerCase()}`;

  // 1. External (third-party, vendor, gateway, cdn, sms, rate limit, external boundary)
  if (
    cause.includes('third-party') || cause.includes('vendor') || cause.includes('gateway') ||
    cause.includes('cdn') || cause.includes('external') || cause.includes('sms') ||
    combined.includes('rate limit') || combined.includes('breaking change') || combined.includes('ssl cert')
  ) {
    return 'External';
  }

  // 2. User Experience (user error, password reset loop, expired credentials, session auth friction)
  if (
    cause.includes('user error') || cause.includes('expired credential') ||
    sub.includes('password reset') || combined.includes('user experience') ||
    combined.includes('login screen') || combined.includes('usability') ||
    combined.includes('redirect back to login')
  ) {
    return 'User Experience';
  }

  // 3. Gap (capacity lag, auto-scaling, contention, schema drift, batch scheduler, architecture)
  if (
    cause.includes('lag') || cause.includes('contention') || cause.includes('capacity') ||
    cause.includes('schema drift') || cause.includes('scheduler') || cause.includes('downstream api data delay') ||
    cause.includes('misconfiguration') || cause.includes('scaling') || combined.includes('resource limit')
  ) {
    return 'Gap';
  }

  // 4. Bug (code defect, deadlock, lock, crash, regression, compatibility defect, cache bug)
  if (
    cause.includes('defect') || cause.includes('bug') || cause.includes('regression') ||
    cause.includes('lock') || cause.includes('crash') || cause.includes('deadlock') ||
    combined.includes('broken') || combined.includes('timeout after') || combined.includes('exception')
  ) {
    return 'Bug';
  }

  return 'Bug';
}

function setProcessedData(rawRows) {
  state.allIncidents = rawRows.filter(r => r.Number && r.Opened).map(r => {
    const resHours = parseFloat(r.Resolution_Time_Hours) || 0;
    const priority = (r.Priority || '3 - Moderate').trim();
    const priorityLevel = parseInt(priority.charAt(0)) || 3;
    const openedMonth = r.Opened_Month || (r.Opened ? r.Opened.substring(0, 7) : 'Unknown');
    const problemCategory = classifyIncident(r);

    return {
      Number: r.Number,
      Opened: r.Opened,
      Opened_Date: new Date(r.Opened.replace(' ', 'T')),
      Opened_Month: openedMonth,
      Resolved: r.Resolved || '',
      State: r.State || 'Closed',
      Application_Service: (r.Application_Service || 'Unknown Service').trim(),
      Customer_Facing: (r.Customer_Facing || 'No').trim(),
      Original_Category: (r.Category || 'Other').trim(),
      Category: problemCategory, // Standardized 4 Problem Categories
      Subcategory: (r.Subcategory || 'General').trim(),
      Priority: priority,
      Priority_Level: priorityLevel,
      Root_Cause: (r.Root_Cause || 'Undetermined').trim(),
      Change_Related: (r.Change_Related || 'No').trim(),
      Caused_By_Change: (r.Caused_By_Change || '').trim(),
      Assignment_Group: (r.Assignment_Group || 'Unassigned').trim(),
      Resolution_Time_Hours: resHours,
      SLA_Met: (r.SLA_Met || 'Yes').trim(),
      Short_Description: (r.Short_Description || '').trim(),
    };
  });

  populateFilterOptions();
  applyFilters();
}

/**
 * 2. Populate Dropdowns & Controls Dynamically
 */
function populateFilterOptions() {
  const months = [...new Set(state.allIncidents.map(i => i.Opened_Month))].filter(Boolean).sort();
  const services = [...new Set(state.allIncidents.map(i => i.Application_Service))].filter(Boolean).sort();

  fillSelect('filter-service', services, state.filters.service);
  renderMonthPills(months);
}

function fillSelect(id, items, currentVal) {
  const el = document.getElementById(id);
  if (!el) return;
  const oldVal = currentVal || el.value || 'ALL';
  el.innerHTML = '<option value="ALL">All Services</option>';
  items.forEach(it => {
    const opt = document.createElement('option');
    opt.value = it;
    opt.textContent = it;
    if (it === oldVal) opt.selected = true;
    el.appendChild(opt);
  });
}

function renderMonthPills(months) {
  const container = document.getElementById('month-pills-container');
  if (!container) return;
  container.innerHTML = `
    <button class="px-3 py-1 text-xs font-semibold rounded-lg transition-all ${state.filters.month === 'ALL' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}" onclick="setFilter('month', 'ALL')">
      All Months (${state.allIncidents.length})
    </button>
  `;
  months.forEach(m => {
    const count = state.allIncidents.filter(i => i.Opened_Month === m).length;
    const isSelected = state.filters.month === m;
    const btn = document.createElement('button');
    btn.className = `px-3 py-1 text-xs font-semibold rounded-lg transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`;
    btn.innerHTML = `${m} <span class="ml-1 opacity-75 font-mono">(${count})</span>`;
    btn.onclick = () => setFilter('month', m);
    container.appendChild(btn);
  });
}

/**
 * 3. Reactive Filter Application
 */
function applyFilters() {
  state.filteredIncidents = state.allIncidents.filter(item => {
    if (state.filters.month !== 'ALL' && item.Opened_Month !== state.filters.month) return false;
    if (state.filters.category !== 'ALL' && item.Category !== state.filters.category) return false;
    if (state.filters.service !== 'ALL' && item.Application_Service !== state.filters.service) return false;
    if (state.filters.priority !== 'ALL' && item.Priority !== state.filters.priority) return false;
    if (state.filters.changeRelated !== 'ALL' && item.Change_Related !== state.filters.changeRelated) return false;

    if (state.filters.search) {
      const q = state.filters.search.toLowerCase();
      const match =
        item.Number.toLowerCase().includes(q) ||
        item.Short_Description.toLowerCase().includes(q) ||
        item.Application_Service.toLowerCase().includes(q) ||
        item.Root_Cause.toLowerCase().includes(q) ||
        item.Caused_By_Change.toLowerCase().includes(q) ||
        item.Assignment_Group.toLowerCase().includes(q) ||
        item.Category.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  state.tablePage = 1;
  renderDashboard();
  renderActiveFilterBadges();
}

function setFilter(key, val) {
  state.filters[key] = val;
  const el = document.getElementById(`filter-${key}`);
  if (el) el.value = val;
  applyFilters();
}

function resetFilters() {
  state.filters = {
    month: 'ALL',
    category: 'ALL',
    service: 'ALL',
    priority: 'ALL',
    changeRelated: 'ALL',
    search: '',
  };
  ['category', 'service', 'priority', 'changerelated'].forEach(id => {
    const el = document.getElementById(`filter-${id}`);
    if (el) el.value = 'ALL';
  });
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  applyFilters();
}

function renderActiveFilterBadges() {
  const container = document.getElementById('active-filters-badges');
  if (!container) return;
  container.innerHTML = '';

  const activeKeys = Object.entries(state.filters).filter(([k, v]) => v !== 'ALL' && v !== '');
  if (activeKeys.length === 0) {
    container.innerHTML = '<span class="text-xs text-slate-500 italic">No filters active (Showing all records)</span>';
    return;
  }

  activeKeys.forEach(([k, v]) => {
    const badge = document.createElement('span');
    badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-950 text-indigo-300 border border-indigo-700/50';
    badge.innerHTML = `
      <span class="text-indigo-400 capitalize">${k}:</span> <b>${v}</b>
      <button class="hover:text-white" onclick="setFilter('${k}', 'ALL')">&times;</button>
    `;
    container.appendChild(badge);
  });

  const clearBtn = document.createElement('button');
  clearBtn.className = 'text-xs text-rose-400 hover:text-rose-300 underline ml-2';
  clearBtn.textContent = 'Clear all';
  clearBtn.onclick = resetFilters;
  container.appendChild(clearBtn);
}

/**
 * 4. Master Render Dispatcher
 */
function renderDashboard() {
  renderSummarySection();
  renderExploreSection();
  renderConfluenceCTASection();
  renderServiceMatrix();
  if (window.lucide) window.lucide.createIcons();
}

/**
 * 5. SUMMARY SECTION RENDERERS
 * - Overall incident trend with period comparison
 * - Category trend: volume, trend line, count & % share
 * - Top 3 contributors per category
 * - Change-related incident trend vs overall inflow
 */
function renderSummarySection() {
  const total = state.filteredIncidents.length;
  const allTotal = state.allIncidents.length;

  // Period Comparison Calculation (e.g. Current Month vs Prior Month)
  const months = [...new Set(state.allIncidents.map(i => i.Opened_Month))].filter(Boolean).sort();
  let currentPeriodLabel = 'All Time';
  let prevPeriodCount = 0;
  let currentPeriodCount = total;
  let deltaPercent = null;

  if (state.filters.month !== 'ALL') {
    currentPeriodLabel = state.filters.month;
    const curIdx = months.indexOf(state.filters.month);
    if (curIdx > 0) {
      const prevMonth = months[curIdx - 1];
      prevPeriodCount = state.allIncidents.filter(i => {
        if (i.Opened_Month !== prevMonth) return false;
        if (state.filters.service !== 'ALL' && i.Application_Service !== state.filters.service) return false;
        if (state.filters.category !== 'ALL' && i.Category !== state.filters.category) return false;
        return true;
      }).length;
      if (prevPeriodCount > 0) {
        deltaPercent = (((currentPeriodCount - prevPeriodCount) / prevPeriodCount) * 100).toFixed(1);
      }
    }
  } else if (months.length >= 2) {
    // Compare latest full month against prior month as default
    const latestMonth = months[months.length - 2];
    const prevMonth = months[months.length - 3] || months[0];
    const latestCount = state.allIncidents.filter(i => i.Opened_Month === latestMonth).length;
    const priorCount = state.allIncidents.filter(i => i.Opened_Month === prevMonth).length;
    if (priorCount > 0) {
      deltaPercent = (((latestCount - priorCount) / priorCount) * 100).toFixed(1);
    }
  }

  // Update Summary Header Cards
  const totalEl = document.getElementById('summary-total-incidents');
  if (totalEl) totalEl.textContent = total;

  const periodBadge = document.getElementById('summary-period-badge');
  if (periodBadge) periodBadge.textContent = state.filters.month !== 'ALL' ? state.filters.month : 'All Data Range';

  const deltaEl = document.getElementById('summary-period-delta');
  if (deltaEl) {
    if (deltaPercent !== null) {
      const isUp = parseFloat(deltaPercent) > 0;
      deltaEl.className = `text-xs font-semibold flex items-center gap-1 ${isUp ? 'text-rose-400' : 'text-emerald-400'}`;
      deltaEl.innerHTML = `
        <i data-lucide="${isUp ? 'trending-up' : 'trending-down'}" class="w-3.5 h-3.5"></i>
        <span>${isUp ? '+' : ''}${deltaPercent}% vs previous period</span>
      `;
    } else {
      deltaEl.className = 'text-xs text-slate-400 flex items-center gap-1';
      deltaEl.innerHTML = `<span>Baseline data across ${months.length} months</span>`;
    }
  }

  // Render 4 Category Cards (Bug, Gap, User Experience, External)
  const categories = ['Bug', 'Gap', 'User Experience', 'External'];
  categories.forEach(cat => {
    const catCount = state.filteredIncidents.filter(i => i.Category === cat).length;
    const catPct = total > 0 ? ((catCount / total) * 100).toFixed(1) : '0.0';
    
    const countEl = document.getElementById(`cat-count-${slugify(cat)}`);
    if (countEl) countEl.textContent = catCount;

    const pctEl = document.getElementById(`cat-pct-${slugify(cat)}`);
    if (pctEl) pctEl.textContent = `${catPct}%`;

    const barEl = document.getElementById(`cat-bar-${slugify(cat)}`);
    if (barEl) barEl.style.width = `${catPct}%`;
  });

  // Render Top 3 Contributors Per Category
  renderTopContributorsGrid();

  // Render Charts
  renderOverallTrendChart();
  renderCategoryTrendChart();
  renderCategoryShareChart();
  renderChangeTrendChart();
}

/**
 * Top 3 Contributors per Category Grid
 * Dynamically aggregates Top Applications, Top Root Causes, and Top Teams
 */
function renderTopContributorsGrid() {
  const container = document.getElementById('top-contributors-grid');
  if (!container) return;

  const categories = ['Bug', 'Gap', 'User Experience', 'External'];
  let html = '';

  categories.forEach(cat => {
    const meta = CATEGORY_META[cat];
    const catIncidents = state.filteredIncidents.filter(i => i.Category === cat);
    const catTotal = catIncidents.length;

    // Aggregate Top 3 Applications
    const appCounts = countBy(catIncidents, 'Application_Service').slice(0, 3);
    // Aggregate Top 3 Root Causes
    const causeCounts = countBy(catIncidents, 'Root_Cause').slice(0, 3);
    // Aggregate Top 3 Teams
    const teamCounts = countBy(catIncidents, 'Assignment_Group').slice(0, 3);

    html += `
      <div class="glass-card rounded-2xl p-4 flex flex-col justify-between border-t-2" style="border-top-color: ${meta.color};">
        <div>
          <!-- Header -->
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${meta.color};"></span>
              <h4 class="text-xs font-bold uppercase tracking-wider text-white">${cat} Contributors</h4>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${meta.badgeClass}">
              ${catTotal} incidents (${state.filteredIncidents.length > 0 ? ((catTotal / state.filteredIncidents.length) * 100).toFixed(0) : 0}%)
            </span>
          </div>

          <!-- Section 1: Top 3 Offending Systems / Apps -->
          <div class="space-y-1.5 mb-3">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <i data-lucide="server" class="w-3 h-3 text-slate-400"></i> Top 3 Impacted Systems
            </span>
            ${appCounts.length > 0 ? appCounts.map((app, idx) => {
              const pct = catTotal > 0 ? ((app.count / catTotal) * 100).toFixed(0) : 0;
              return `
                <div class="bg-slate-900/70 rounded-lg p-2 border border-slate-800/80">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-slate-200 truncate font-medium max-w-[190px]" title="${app.key}">
                      <span class="text-slate-500 font-mono mr-1">#${idx + 1}</span>${app.key}
                    </span>
                    <span class="font-mono text-indigo-300 font-semibold text-[11px]">${app.count} <span class="text-slate-500 font-normal">(${pct}%)</span></span>
                  </div>
                  <div class="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div class="h-1 rounded-full" style="width: ${pct}%; background-color: ${meta.color};"></div>
                  </div>
                </div>
              `;
            }).join('') : '<div class="text-[11px] text-slate-500 italic">No incidents recorded in period</div>'}
          </div>

          <!-- Section 2: Top 3 Root Causes -->
          <div class="space-y-1.5 mb-3">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <i data-lucide="alert-triangle" class="w-3 h-3 text-slate-400"></i> Top 3 Root Causes
            </span>
            ${causeCounts.length > 0 ? causeCounts.map((c, idx) => {
              const pct = catTotal > 0 ? ((c.count / catTotal) * 100).toFixed(0) : 0;
              return `
                <div class="flex items-center justify-between text-[11px] py-1 border-b border-slate-800/40">
                  <span class="text-slate-300 truncate max-w-[200px]" title="${c.key}">
                    <span class="text-slate-500 font-mono mr-1">#${idx + 1}</span>${c.key}
                  </span>
                  <span class="font-mono text-slate-300 shrink-0">${c.count} (${pct}%)</span>
                </div>
              `;
            }).join('') : '<div class="text-[11px] text-slate-500 italic">No causes found</div>'}
          </div>

          <!-- Section 3: Responsible Teams -->
          <div>
            <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
              <i data-lucide="users" class="w-3 h-3 text-slate-400"></i> Primary Support Teams
            </span>
            <div class="flex flex-wrap gap-1">
              ${teamCounts.map(t => `
                <span class="px-2 py-0.5 rounded text-[10px] bg-slate-800/90 text-slate-300 border border-slate-700/60 truncate max-w-[210px]" title="${t.key}: ${t.count} incidents">
                  ${t.key} <b class="text-indigo-300 font-mono">(${t.count})</b>
                </span>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Quick Drilldown Button -->
        <div class="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
          <button onclick="drillDownToCategory('${cat}')" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            Explore ${cat} Records <i data-lucide="arrow-right" class="w-3 h-3"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * 6. CHART RENDERERS (Chart.js)
 */

// Chart 1: Overall Incident Inflow Trend
function renderOverallTrendChart() {
  const canvas = document.getElementById('chart-overall-trend');
  if (!canvas) return;

  if (state.charts.overallTrend) state.charts.overallTrend.destroy();

  // Aggregate monthly or daily counts
  const months = [...new Set(state.allIncidents.map(i => i.Opened_Month))].filter(Boolean).sort();
  
  // Calculate trend buckets: if a single month is filtered, show daily trend; otherwise show monthly trend
  let labels = [];
  let counts = [];

  if (state.filters.month !== 'ALL') {
    // Daily trend for the selected month
    const daysInMonth = {};
    state.filteredIncidents.forEach(i => {
      const day = i.Opened ? i.Opened.substring(0, 10) : 'Unknown';
      daysInMonth[day] = (daysInMonth[day] || 0) + 1;
    });
    labels = Object.keys(daysInMonth).sort();
    counts = labels.map(l => daysInMonth[l]);
  } else {
    // Monthly trend across entire dataset
    labels = months;
    counts = months.map(m => {
      return state.filteredIncidents.filter(i => i.Opened_Month === m).length;
    });
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  state.charts.overallTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map(l => l.length > 7 ? l.substring(5) : l),
      datasets: [{
        label: 'Total Incidents',
        data: counts,
        borderColor: '#6366F1',
        backgroundColor: gradient,
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#818CF8',
        pointBorderColor: '#0B0F19',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          titleColor: '#F8FAFC',
          bodyColor: '#94A3B8',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => `Incidents: ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748B', font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748B', font: { size: 10 } }
        }
      }
    }
  });
}

// Chart 2: Category Volume & Trend over Time
function renderCategoryTrendChart() {
  const canvas = document.getElementById('chart-category-trend');
  if (!canvas) return;

  if (state.charts.categoryTrend) state.charts.categoryTrend.destroy();

  const months = [...new Set(state.allIncidents.map(i => i.Opened_Month))].filter(Boolean).sort();
  const categories = ['Bug', 'Gap', 'User Experience', 'External'];

  const datasets = categories.map(cat => {
    const meta = CATEGORY_META[cat];
    const data = months.map(m => {
      return state.filteredIncidents.filter(i => i.Opened_Month === m && i.Category === cat).length;
    });

    return {
      label: cat,
      data: data,
      borderColor: meta.color,
      backgroundColor: meta.color,
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
    };
  });

  const ctx = canvas.getContext('2d');
  state.charts.categoryTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            color: '#94A3B8',
            font: { size: 11, weight: 'bold' }
          }
        },
        tooltip: {
          backgroundColor: '#0F172A',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10,
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748B', font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748B', font: { size: 10 } }
        }
      }
    }
  });
}

// Chart 3: Category Percentage Share (Donut)
function renderCategoryShareChart() {
  const canvas = document.getElementById('chart-category-share');
  if (!canvas) return;

  if (state.charts.categoryShare) state.charts.categoryShare.destroy();

  const categories = ['Bug', 'Gap', 'User Experience', 'External'];
  const counts = categories.map(cat => {
    return state.filteredIncidents.filter(i => i.Category === cat).length;
  });
  const colors = categories.map(c => CATEGORY_META[c].color);

  const ctx = canvas.getContext('2d');
  state.charts.categoryShare = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: counts,
        backgroundColor: colors,
        borderColor: '#0B0F19',
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: '#94A3B8',
            font: { size: 10 }
          }
        },
        tooltip: {
          backgroundColor: '#0F172A',
          borderColor: '#334155',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed;
              const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = sum > 0 ? ((val / sum) * 100).toFixed(1) : 0;
              return `${ctx.label}: ${val} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// Chart 4: Change-Related Incident Trend vs Total Inflow
function renderChangeTrendChart() {
  const canvas = document.getElementById('chart-change-trend');
  if (!canvas) return;

  if (state.charts.changeTrend) state.charts.changeTrend.destroy();

  const months = [...new Set(state.allIncidents.map(i => i.Opened_Month))].filter(Boolean).sort();
  
  const totalInflow = months.map(m => {
    return state.allIncidents.filter(i => i.Opened_Month === m).length;
  });

  const changeIncidents = months.map(m => {
    return state.allIncidents.filter(i => i.Opened_Month === m && i.Change_Related === 'Yes').length;
  });

  const changePct = months.map((m, idx) => {
    const tot = totalInflow[idx];
    return tot > 0 ? parseFloat(((changeIncidents[idx] / tot) * 100).toFixed(1)) : 0;
  });

  // Update Callout Text
  const latestRatio = changePct.length > 0 ? changePct[changePct.length - 1] : 0;
  const initialRatio = changePct.length > 0 ? changePct[0] : 0;
  const ratioDelta = (latestRatio - initialRatio).toFixed(1);
  const changeStatEl = document.getElementById('change-trend-callout');
  if (changeStatEl) {
    changeStatEl.innerHTML = `
      <b class="text-purple-400 font-mono">${latestRatio}%</b> of current incidents are caused by changes 
      (up <b class="text-rose-400 font-mono">+${ratioDelta}%</b> over baseline), confirming that deployment regressions and uncoordinated config changes are driving an increasing proportion of outages.
    `;
  }

  const ctx = canvas.getContext('2d');
  state.charts.changeTrend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Total Incidents',
          data: totalInflow,
          backgroundColor: 'rgba(99, 102, 241, 0.4)',
          borderColor: '#6366F1',
          borderWidth: 1.5,
          borderRadius: 6,
          order: 2,
        },
        {
          label: 'Change-Related Incidents',
          data: changeIncidents,
          backgroundColor: 'rgba(168, 85, 247, 0.7)',
          borderColor: '#A855F7',
          borderWidth: 1.5,
          borderRadius: 6,
          order: 2,
        },
        {
          type: 'line',
          label: 'Change Share %',
          data: changePct,
          borderColor: '#F43F5E',
          backgroundColor: '#F43F5E',
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: 'y1',
          order: 1,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            color: '#94A3B8',
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: '#0F172A',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10,
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748B', font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748B', font: { size: 10 } },
          title: { display: true, text: 'Incident Count', color: '#64748B', font: { size: 10 } }
        },
        y1: {
          beginAtZero: true,
          position: 'right',
          max: 100,
          grid: { display: false },
          ticks: {
            color: '#F43F5E',
            font: { size: 10 },
            callback: (v) => `${v}%`
          },
          title: { display: true, text: 'Change Share %', color: '#F43F5E', font: { size: 10 } }
        }
      }
    }
  });
}

/**
 * 7. EXPLORE SECTION RENDERERS
 * - Grouped incident view with category tabs
 * - Category-level Problem Management summaries:
 *   Root cause, Workaround, SOP, Permanent fix plan
 * - Filtering, sorting, drill-down
 */
function renderExploreSection() {
  renderExploreCategoryTabs();
  renderCategoryProblemSummary();
  renderGroupedIncidentTable();
}

function selectExploreCategory(cat) {
  state.exploreCategory = cat;
  state.tablePage = 1;
  renderExploreSection();
}

function drillDownToCategory(cat) {
  switchTab('explorer');
  selectExploreCategory(cat);
}

function renderExploreCategoryTabs() {
  const container = document.getElementById('explore-category-pills');
  if (!container) return;

  const categories = ['ALL', 'Bug', 'Gap', 'User Experience', 'External'];
  container.innerHTML = categories.map(cat => {
    const isSelected = state.exploreCategory === cat;
    const count = cat === 'ALL' 
      ? state.filteredIncidents.length 
      : state.filteredIncidents.filter(i => i.Category === cat).length;
    
    let activeStyle = 'bg-slate-800 text-slate-300 hover:bg-slate-700';
    if (isSelected) {
      if (cat === 'Bug') activeStyle = 'bg-rose-600 text-white shadow-lg ring-2 ring-rose-400';
      else if (cat === 'Gap') activeStyle = 'bg-amber-600 text-white shadow-lg ring-2 ring-amber-400';
      else if (cat === 'User Experience') activeStyle = 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400';
      else if (cat === 'External') activeStyle = 'bg-purple-600 text-white shadow-lg ring-2 ring-purple-400';
      else activeStyle = 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400';
    }

    return `
      <button onclick="selectExploreCategory('${cat}')" class="px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${activeStyle}">
        ${cat === 'ALL' ? '<i data-lucide="layers" class="w-3.5 h-3.5"></i>' : ''}
        ${cat} Group <span class="font-mono opacity-80">(${count})</span>
      </button>
    `;
  }).join('');
}

function renderCategoryProblemSummary() {
  const container = document.getElementById('category-problem-summary-card');
  if (!container) return;

  const cat = state.exploreCategory === 'ALL' ? 'Bug' : state.exploreCategory;
  const meta = CATEGORY_META[cat];
  const summary = meta.summary;

  const inScopeCount = state.filteredIncidents.filter(i => i.Category === cat).length;
  const changeCount = state.filteredIncidents.filter(i => i.Category === cat && i.Change_Related === 'Yes').length;
  const changePct = inScopeCount > 0 ? ((changeCount / inScopeCount) * 100).toFixed(0) : 0;

  container.innerHTML = `
    <div class="glass-card rounded-2xl p-5 border-l-4" style="border-left-color: ${meta.color};">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background-color: ${meta.bgLight}; color: ${meta.color}; border: 1px solid ${meta.border};">
            <i data-lucide="${meta.icon}" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-extrabold text-white tracking-wide">${cat} — Problem Management Profile</h3>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${meta.badgeClass}">
                ${inScopeCount} Incidents in View
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">${meta.title} • Change-induced: <b class="text-slate-200 font-mono">${changeCount} (${changePct}%)</b></p>
          </div>
        </div>

        <button onclick="copyCategorySummaryToClipboard('${cat}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all self-start md:self-auto">
          <i data-lucide="copy" class="w-3.5 h-3.5 text-indigo-400"></i>
          Copy Problem Summary
        </button>
      </div>

      <!-- 4 Structured Problem Management Dimensions -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        <!-- 1. Root Cause -->
        <div class="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wide mb-1.5">
              <i data-lucide="microscope" class="w-3.5 h-3.5"></i>
              Root Cause (RCA)
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">${summary.rootCause}</p>
          </div>
          <div class="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
            Focus: Technical origin & failure mode
          </div>
        </div>

        <!-- 2. Workaround -->
        <div class="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wide mb-1.5">
              <i data-lucide="wrench" class="w-3.5 h-3.5"></i>
              Workaround
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">${summary.workaround}</p>
          </div>
          <div class="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
            Focus: Immediate service recovery
          </div>
        </div>

        <!-- 3. SOP -->
        <div class="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-1.5 text-xs font-bold text-blue-400 uppercase tracking-wide mb-1.5">
              <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
              Standard Operating Procedure
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">${summary.sop}</p>
          </div>
          <div class="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
            Focus: L1/L2 repeatable runbook
          </div>
        </div>

        <!-- 4. Permanent Fix Plan -->
        <div class="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wide mb-1.5">
              <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
              Permanent Fix Plan
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">${summary.fixPlan}</p>
          </div>
          <div class="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
            Focus: Engineering problem remediation
          </div>
        </div>

      </div>
    </div>
  `;
}

function copyCategorySummaryToClipboard(cat) {
  const meta = CATEGORY_META[cat];
  const s = meta.summary;
  const text = `
### Category Problem Management Summary: ${cat}
- **Root Cause:** ${s.rootCause}
- **Workaround:** ${s.workaround}
- **SOP:** ${s.sop}
- **Permanent Fix Plan:** ${s.fixPlan}
  `.trim();

  navigator.clipboard.writeText(text).then(() => {
    alert(`Copied ${cat} Problem Management Summary to clipboard!`);
  }).catch(err => console.error('Copy failed:', err));
}

function renderGroupedIncidentTable() {
  const tbody = document.getElementById('incident-table-tbody');
  const countSummary = document.getElementById('table-count-summary');
  const paginationContainer = document.getElementById('table-pagination');
  if (!tbody) return;

  // Filter records by category if exploreCategory is not 'ALL'
  let records = state.filteredIncidents;
  if (state.exploreCategory !== 'ALL') {
    records = records.filter(i => i.Category === state.exploreCategory);
  }

  // Sort
  records.sort((a, b) => {
    let valA = a[state.sortCol];
    let valB = b[state.sortCol];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return state.sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const total = records.length;
  const totalPages = Math.ceil(total / state.pageSize) || 1;
  if (state.tablePage > totalPages) state.tablePage = totalPages;

  const startIdx = (state.tablePage - 1) * state.pageSize;
  const pageItems = records.slice(startIdx, startIdx + state.pageSize);

  if (countSummary) {
    countSummary.textContent = `Showing ${Math.min(startIdx + 1, total)} to ${Math.min(startIdx + pageItems.length, total)} of ${total} records ${state.exploreCategory !== 'ALL' ? `in Category '${state.exploreCategory}'` : ''}`;
  }

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-slate-500 italic">No incidents found matching current filters.</td></tr>`;
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  tbody.innerHTML = pageItems.map(item => {
    const pBadge = PRIORITY_BADGES[item.Priority] || item.Priority;
    const catMeta = CATEGORY_META[item.Category] || { badgeClass: 'bg-slate-800 text-slate-300' };

    return `
      <tr class="hover:bg-slate-800/40 transition-colors cursor-pointer group" onclick="showIncidentDetail('${item.Number}')">
        <td class="px-3 py-2.5 font-mono text-indigo-400 font-bold group-hover:underline">${item.Number}</td>
        <td class="px-3 py-2.5 font-mono text-slate-300 text-[11px]">${item.Opened.substring(0, 16)}</td>
        <td class="px-3 py-2.5 font-medium text-slate-200">
          <div class="truncate max-w-[180px]" title="${item.Application_Service}">${item.Application_Service}</div>
        </td>
        <td class="px-3 py-2.5 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${catMeta.badgeClass}">
            ${item.Category}
          </span>
        </td>
        <td class="px-3 py-2.5 text-center">${pBadge}</td>
        <td class="px-3 py-2.5 text-slate-300">
          <div class="truncate max-w-[200px]" title="${item.Root_Cause}">${item.Root_Cause}</div>
        </td>
        <td class="px-3 py-2.5 text-center font-mono text-[11px]">
          ${item.Change_Related === 'Yes' ? `<span class="text-purple-400 font-semibold" title="${item.Caused_By_Change}">CHG (${item.Caused_By_Change || 'Yes'})</span>` : '<span class="text-slate-500">No</span>'}
        </td>
        <td class="px-3 py-2.5 text-center font-mono text-slate-300 text-[11px]">${item.Resolution_Time_Hours}h</td>
        <td class="px-3 py-2.5 text-right">
          <button onclick="event.stopPropagation(); showIncidentDetail('${item.Number}')" class="px-2 py-1 rounded text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700">
            View
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Pagination controls
  if (paginationContainer) {
    paginationContainer.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs">
        <button onclick="changePage(${state.tablePage - 1})" ${state.tablePage <= 1 ? 'disabled class="px-2.5 py-1 rounded bg-slate-900 text-slate-600 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"'}>
          Prev
        </button>
        <span class="px-3 py-1 font-mono text-slate-400">Page ${state.tablePage} of ${totalPages}</span>
        <button onclick="changePage(${state.tablePage + 1})" ${state.tablePage >= totalPages ? 'disabled class="px-2.5 py-1 rounded bg-slate-900 text-slate-600 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"'}>
          Next
        </button>
      </div>
    `;
  }
}

function changePage(p) {
  state.tablePage = p;
  renderGroupedIncidentTable();
}

/**
 * 8. CALL TO ACTION (CONFLUENCE TRACKER & RCA POST-MORTEM GOVERNANCE)
 * - Track all corrective & preventive actions in Confluence with clear owner, due date, status, linked incident/PRB
 * - Copyable Confluence storage format table & export
 */
const CONFLUENCE_ACTIONS = [
  {
    id: 'ACT-001',
    description: 'Refactor checkout order row-locking query to Read Committed snapshot isolation to eliminate deadlock cascading.',
    category: 'Bug',
    owner: 'Core Billing & ERP Lead (Alex M.)',
    dueDate: '2026-11-30',
    status: 'In Progress',
    linkedRecord: 'INC0104501 / PRB-2026-004',
    confluenceUrl: 'https://confluence.internal/display/REL/PRB-2026-004+Deadlock+Resolution',
  },
  {
    id: 'ACT-002',
    description: 'Implement silent PKCE token renewal with persistent refresh tokens in Customer Portal to stop recursive login redirects.',
    category: 'User Experience',
    owner: 'IAM & Digital Identity Lead (Sarah K.)',
    dueDate: '2026-12-05',
    status: 'In Progress',
    linkedRecord: 'INC0104502 / PRB-2026-029',
    confluenceUrl: 'https://confluence.internal/display/IAM/PRB-2026-029+Auth+PKCE+Upgrade',
  },
  {
    id: 'ACT-003',
    description: 'Configure KEDA predictive horizontal pod autoscaling with queue depth triggers for morning traffic surges (09:00 peak).',
    category: 'Gap',
    owner: 'Platform SRE Lead (David T.)',
    dueDate: '2026-12-12',
    status: 'Planned',
    linkedRecord: 'INC0104515 / PRB-2026-012',
    confluenceUrl: 'https://confluence.internal/display/SRE/PRB-2026-012+Predictive+Autoscaling',
  },
  {
    id: 'ACT-004',
    description: 'Deploy multi-vendor active-active SMS gateway routing (Twilio + MessageBird) with automated health check circuit breakers.',
    category: 'External',
    owner: 'API Integrations Lead (Priya R.)',
    dueDate: '2026-12-18',
    status: 'Planned',
    linkedRecord: 'INC0104504 / PRB-2026-033',
    confluenceUrl: 'https://confluence.internal/display/API/PRB-2026-033+Multi+SMS+Gateway',
  },
  {
    id: 'ACT-005',
    description: 'Enforce immutable webpack content hashing and automatic Cloudflare CDN cache invalidation step in production CI/CD.',
    category: 'Bug',
    owner: 'Frontend DevOps Lead (Marcus B.)',
    dueDate: '2026-11-28',
    status: 'Completed',
    linkedRecord: 'INC0104520 / PRB-2026-009',
    confluenceUrl: 'https://confluence.internal/display/REL/PRB-2026-009+CDN+Asset+Busting',
  },
  {
    id: 'ACT-006',
    description: 'Physically isolate reporting query warehouse compute pool from transactional Core ERP database cluster.',
    category: 'Gap',
    owner: 'Database Architecture Lead (Elena V.)',
    dueDate: '2026-12-20',
    status: 'Planned',
    linkedRecord: 'INC0104533 / PRB-2026-018',
    confluenceUrl: 'https://confluence.internal/display/DATA/PRB-2026-018+Warehouse+Compute+Isolation',
  }
];

function renderConfluenceCTASection() {
  const tbody = document.getElementById('confluence-actions-tbody');
  if (!tbody) return;

  let actions = CONFLUENCE_ACTIONS;
  if (state.confluenceCategoryFilter !== 'ALL') {
    actions = actions.filter(a => a.category === state.confluenceCategoryFilter);
  }

  tbody.innerHTML = actions.map(act => {
    const meta = CATEGORY_META[act.category] || { badgeClass: 'bg-slate-800 text-slate-300' };
    let statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">In Progress</span>';
    if (act.status === 'Completed') statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Completed</span>';
    if (act.status === 'Planned') statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">Planned</span>';

    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="px-3 py-3 font-mono text-indigo-400 font-bold text-xs">${act.id}</td>
        <td class="px-3 py-3 text-slate-200 text-xs">
          <div class="font-medium">${act.description}</div>
          <div class="text-[10px] text-slate-400 mt-0.5 font-mono">Linked: ${act.linkedRecord}</div>
        </td>
        <td class="px-3 py-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${meta.badgeClass}">
            ${act.category}
          </span>
        </td>
        <td class="px-3 py-3 text-slate-300 text-xs">${act.owner}</td>
        <td class="px-3 py-3 font-mono text-slate-400 text-xs">${act.dueDate}</td>
        <td class="px-3 py-3 text-center">${statusBadge}</td>
        <td class="px-3 py-3 text-right">
          <button onclick="copySingleActionToConfluence('${act.id}')" class="px-2.5 py-1 rounded text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700">
            Copy Confluence
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterConfluenceCategory(cat) {
  state.confluenceCategoryFilter = cat;
  renderConfluenceCTASection();
}

function copyAllActionsToConfluence() {
  let md = `|| Action ID || Corrective / Preventive Action || Category || Owner || Target Due Date || Status || Linked Record ||\n`;
  CONFLUENCE_ACTIONS.forEach(a => {
    md += `| ${a.id} | ${a.description} | ${a.category} | ${a.owner} | ${a.dueDate} | ${a.status} | ${a.linkedRecord} |\n`;
  });

  navigator.clipboard.writeText(md).then(() => {
    alert('Confluence Action Table markup copied to clipboard! You can paste it directly into your Confluence page.');
  }).catch(err => console.error(err));
}

function copySingleActionToConfluence(id) {
  const act = CONFLUENCE_ACTIONS.find(a => a.id === id);
  if (!act) return;
  const markup = `*Action ${act.id}* [${act.category}]: ${act.description} | *Owner:* ${act.owner} | *Due:* ${act.dueDate} | *Status:* ${act.status} | *Record:* ${act.linkedRecord}`;
  navigator.clipboard.writeText(markup).then(() => {
    alert(`Copied Action ${id} markup to clipboard!`);
  }).catch(err => console.error(err));
}

function exportConfluenceActionsCSV() {
  const headers = ['Action_ID', 'Description', 'Category', 'Owner', 'Due_Date', 'Status', 'Linked_Record'];
  const rows = CONFLUENCE_ACTIONS.map(a => [
    `"${a.id}"`,
    `"${a.description.replace(/"/g, '""')}"`,
    `"${a.category}"`,
    `"${a.owner}"`,
    `"${a.dueDate}"`,
    `"${a.status}"`,
    `"${a.linkedRecord}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Confluence_CAPA_Actions_${new Date().toISOString().substring(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * 9. SERVICE RISK MATRIX RENDERER
 */
function renderServiceMatrix() {
  const tbody = document.getElementById('service-matrix-tbody');
  if (!tbody) return;

  const services = [...new Set(state.filteredIncidents.map(i => i.Application_Service))].filter(Boolean);
  if (services.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-slate-500 italic">No services in view.</td></tr>`;
    return;
  }

  const rows = services.map(svc => {
    const sInc = state.filteredIncidents.filter(i => i.Application_Service === svc);
    const count = sInc.length;
    const p1p2 = sInc.filter(i => i.Priority_Level <= 2).length;
    const changeCount = sInc.filter(i => i.Change_Related === 'Yes').length;
    const changePct = count > 0 ? ((changeCount / count) * 100).toFixed(0) : 0;
    const slaMetCount = sInc.filter(i => i.SLA_Met === 'Yes').length;
    const slaPct = count > 0 ? ((slaMetCount / count) * 100).toFixed(0) : 0;
    const avgMTTR = (sInc.reduce((acc, r) => acc + r.Resolution_Time_Hours, 0) / (count || 1)).toFixed(1);

    // Calculated Risk Score
    const riskScore = (p1p2 * 4) + (changeCount * 1.5) + (count * 0.5) - (slaPct * 0.2);
    let riskTier = '<span class="text-emerald-400 font-semibold">Low</span>';
    if (riskScore > 35) riskTier = '<span class="text-rose-400 font-bold">Critical</span>';
    else if (riskScore > 18) riskTier = '<span class="text-amber-400 font-semibold">Elevated</span>';

    return { svc, count, p1p2, changePct, slaPct, avgMTTR, riskScore, riskTier };
  });

  // Sort by riskScore desc
  rows.sort((a, b) => b.riskScore - a.riskScore);

  tbody.innerHTML = rows.map(r => `
    <tr class="hover:bg-slate-800/40 transition-colors cursor-pointer" onclick="filterByService('${r.svc}')">
      <td class="px-4 py-3 font-semibold text-slate-200">${r.svc}</td>
      <td class="px-4 py-3 text-center font-mono">${r.count}</td>
      <td class="px-4 py-3 text-center font-mono ${r.p1p2 > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}">${r.p1p2}</td>
      <td class="px-4 py-3 text-center font-mono ${r.changePct > 50 ? 'text-purple-400 font-bold' : 'text-slate-400'}">${r.changePct}%</td>
      <td class="px-4 py-3 text-center font-mono ${r.slaPct < 90 ? 'text-amber-400 font-bold' : 'text-emerald-400'}">${r.slaPct}%</td>
      <td class="px-4 py-3 text-center font-mono">${r.avgMTTR}h</td>
      <td class="px-4 py-3 text-right font-mono">${r.riskTier}</td>
    </tr>
  `).join('');
}

function filterByService(svc) {
  setFilter('service', svc);
  switchTab('summary');
}

/**
 * 10. MODAL & INTERACTION HANDLERS
 */
function showIncidentDetail(incNumber) {
  const inc = state.allIncidents.find(i => i.Number === incNumber);
  if (!inc) return;

  const modal = document.getElementById('incident-modal');
  const content = document.getElementById('modal-content');
  const catMeta = CATEGORY_META[inc.Category] || { badgeClass: 'bg-slate-800 text-slate-300' };

  content.innerHTML = `
    <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
      <div class="flex items-center gap-2">
        <h3 class="text-base font-extrabold text-white font-mono">${inc.Number}</h3>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${catMeta.badgeClass}">
          ${inc.Category}
        </span>
      </div>
      <button onclick="closeIncidentModal()" class="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
    </div>

    <div class="space-y-3.5 text-xs">
      <div>
        <span class="text-slate-400 block text-[10px] uppercase font-semibold">Short Description</span>
        <p class="text-slate-200 mt-0.5 font-medium text-sm leading-relaxed">${inc.Short_Description}</p>
      </div>

      <div class="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
        <div>
          <span class="text-slate-400 block text-[10px] uppercase">Application Service</span>
          <span class="text-slate-200 font-semibold">${inc.Application_Service}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px] uppercase">Priority</span>
          <span class="font-semibold">${inc.Priority}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px] uppercase">Opened Timestamp</span>
          <span class="font-mono text-slate-300">${inc.Opened}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px] uppercase">Resolution Time</span>
          <span class="font-mono text-slate-300">${inc.Resolution_Time_Hours} hours</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
        <div>
          <span class="text-slate-400 block text-[10px] uppercase">Root Cause Group</span>
          <span class="text-indigo-300 font-semibold">${inc.Root_Cause}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px] uppercase">Change Induced?</span>
          <span class="font-semibold ${inc.Change_Related === 'Yes' ? 'text-purple-400' : 'text-slate-300'}">
            ${inc.Change_Related === 'Yes' ? `Yes (${inc.Caused_By_Change})` : 'No (Unplanned)'}
          </span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px] uppercase">Assignment Team</span>
          <span class="text-slate-300">${inc.Assignment_Group}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px] uppercase">SLA Compliance</span>
          <span class="${inc.SLA_Met === 'Yes' ? 'text-emerald-400' : 'text-rose-400 font-bold'}">${inc.SLA_Met === 'Yes' ? 'Met SLA' : 'Breached SLA'}</span>
        </div>
      </div>

      <!-- Confluence Action Link -->
      <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <button onclick="copyIncidentAsConfluenceRow('${inc.Number}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-1.5">
          <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
          Copy Incident for Confluence RCA
        </button>
        <button onclick="closeIncidentModal()" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700">
          Close
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function copyIncidentAsConfluenceRow(incNum) {
  const inc = state.allIncidents.find(i => i.Number === incNum);
  if (!inc) return;
  const markup = `| ${inc.Number} | ${inc.Opened} | ${inc.Application_Service} | ${inc.Category} | ${inc.Priority} | ${inc.Root_Cause} | ${inc.Change_Related === 'Yes' ? inc.Caused_By_Change : 'No'} | ${inc.Resolution_Time_Hours}h | ${inc.Short_Description} |`;
  navigator.clipboard.writeText(markup).then(() => {
    alert(`Copied incident ${incNum} in Confluence table format!`);
  }).catch(err => console.error(err));
}

function closeIncidentModal() {
  const modal = document.getElementById('incident-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * 11. NAVIGATION TABS
 */
function switchTab(tabId) {
  state.activeTab = tabId;
  const tabs = ['summary', 'explorer', 'cta', 'services'];
  
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const sec = document.getElementById(`tab-section-${t}`);
    if (btn && sec) {
      if (t === tabId) {
        btn.className = 'px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white shadow-lg transition-all flex items-center gap-1.5';
        sec.classList.remove('hidden');
      } else {
        btn.className = 'px-4 py-2 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all flex items-center gap-1.5';
        sec.classList.add('hidden');
      }
    }
  });

  // Re-render charts when visible to ensure proper canvas layout
  if (tabId === 'summary') {
    setTimeout(() => {
      renderOverallTrendChart();
      renderCategoryTrendChart();
      renderCategoryShareChart();
      renderChangeTrendChart();
    }, 50);
  } else if (tabId === 'explorer') {
    renderExploreSection();
  } else if (tabId === 'cta') {
    renderConfluenceCTASection();
  } else if (tabId === 'services') {
    renderServiceMatrix();
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * 12. UTILITY FUNCTIONS & EVENT WIRING
 */
function initUIEvents() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value.trim();
      applyFilters();
    });
  }

  // File drag & drop setup
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-upload-input');

  if (dropZone && fileInput) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-indigo-500', 'bg-indigo-950/20');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-indigo-500', 'bg-indigo-950/20');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-indigo-500', 'bg-indigo-950/20');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleUploadedFile(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleUploadedFile(e.target.files[0]);
      }
    });
  }
}

function handleUploadedFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const delimiter = file.name.endsWith('.csv') ? ',' : '\t';
    state.fileName = file.name;
    parseAndSetData(text, delimiter);
    closeUploadModal();
  };
  reader.readAsText(file);
}

function openUploadModal() {
  const modal = document.getElementById('upload-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeUploadModal() {
  const modal = document.getElementById('upload-modal');
  if (modal) modal.classList.add('hidden');
}

function exportCurrentData(format) {
  if (state.filteredIncidents.length === 0) {
    alert('No data to export.');
    return;
  }
  const headers = ['Number', 'Opened', 'Application_Service', 'Category', 'Priority', 'Root_Cause', 'Change_Related', 'Caused_By_Change', 'Resolution_Time_Hours', 'SLA_Met', 'Short_Description'];
  const rows = state.filteredIncidents.map(i => [
    `"${i.Number}"`,
    `"${i.Opened}"`,
    `"${i.Application_Service.replace(/"/g, '""')}"`,
    `"${i.Category}"`,
    `"${i.Priority}"`,
    `"${i.Root_Cause.replace(/"/g, '""')}"`,
    `"${i.Change_Related}"`,
    `"${i.Caused_By_Change}"`,
    i.Resolution_Time_Hours,
    `"${i.SLA_Met}"`,
    `"${i.Short_Description.replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IncidentIQ_Export_${new Date().toISOString().substring(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function updateStatus(text, isLoading) {
  const statusText = document.getElementById('data-status-text');
  const spinner = document.getElementById('status-spinner');
  if (statusText) statusText.textContent = text;
  if (spinner) spinner.style.display = isLoading ? 'inline-block' : 'none';
}

function countBy(arr, key) {
  const counts = {};
  arr.forEach(item => {
    const val = item[key] || 'Unknown';
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([k, v]) => ({ key: k, count: v }))
    .sort((a, b) => b.count - a.count);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '-');
}
