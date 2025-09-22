// Insights section removed per request

// Enhanced Metadata Update Function
function updateMetadata(data) {
  try {
    const isCustomRole = !!window.__CUSTOM_ROLE_NAME__;
    
    // Update data freshness
    const dataFreshnessEl = document.getElementById('data-freshness');
    if (dataFreshnessEl) {
      if (isCustomRole && data.metadata && data.metadata.created_at) {
        // For custom roles, use the role creation date
        const createdDate = new Date(data.metadata.created_at);
        dataFreshnessEl.textContent = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();
      } else if (!isCustomRole && data.metrics) {
        // For built-in roles, find latest data date
        let latestDate = null;
        const tables = ['campaign_kpis', 'ecom_funnel', 'sku_efficiency', 'creative_ctr'];
        for (const table of tables) {
          if (data.metrics[table] && data.metrics[table].length > 0) {
            const dates = data.metrics[table].map(row => row.day).filter(Boolean);
            if (dates.length > 0) {
              const maxDate = dates.reduce((a, b) => a > b ? a : b);
              if (!latestDate || maxDate > latestDate) {
                latestDate = maxDate;
              }
            }
          }
        }
        if (latestDate) {
          const date = new Date(latestDate);
          dataFreshnessEl.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        } else {
          dataFreshnessEl.textContent = 'Current';
        }
      } else {
        dataFreshnessEl.textContent = 'Current';
      }
    }
    
    // Update total records
    const totalRecordsEl = document.getElementById('total-records');
    if (totalRecordsEl) {
      if (isCustomRole && data.metadata && data.metadata.total_records !== undefined) {
        // For custom roles, use the stored total record count
        totalRecordsEl.textContent = data.metadata.total_records.toLocaleString();
      } else if (!isCustomRole && data.metrics) {
        // For built-in roles, count rows in specific tables
        let totalCount = 0;
        const tables = ['campaign_kpis', 'ecom_funnel', 'sku_efficiency', 'creative_ctr'];
        for (const table of tables) {
          if (data.metrics[table]) {
            totalCount += data.metrics[table].length;
          }
        }
        totalRecordsEl.textContent = totalCount.toLocaleString();
      } else {
        totalRecordsEl.textContent = '0';
      }
    }
  } catch (e) {
    console.error('Error updating metadata:', e);
  }
}

// Enhanced KPI Functions
function enhanceKPICards() {
  const kpiCards = document.querySelectorAll('.kpi-card');
  
  kpiCards.forEach(card => {
    const titleElement = card.querySelector('.kpi-title');
    const valueElement = card.querySelector('.kpi-value');
    
    if (!titleElement || !valueElement) return;
    
    const title = titleElement.textContent.toLowerCase();
    const valueText = valueElement.textContent;
    
    // Extract numeric value for range analysis
    const numericValue = parseFloat(valueText.replace(/[^\d.-]/g, ''));
    
    // Determine icon based on title keywords
    let icon = 'default';
    if (title.includes('revenue') || title.includes('sales') || title.includes('income') || title.includes('profit')) {
      icon = 'revenue';
    } else if (title.includes('customer') || title.includes('user') || title.includes('visitor')) {
      icon = 'customers';
    } else if (title.includes('conversion') || title.includes('rate') || title.includes('percentage')) {
      icon = 'conversion';
    } else if (title.includes('retention') || title.includes('churn') || title.includes('repeat')) {
      icon = 'retention';
    } else if (title.includes('satisfaction') || title.includes('rating') || title.includes('score')) {
      icon = 'satisfaction';
    } else if (title.includes('growth') || title.includes('increase') || title.includes('growth')) {
      icon = 'growth';
    } else if (title.includes('efficiency') || title.includes('performance') || title.includes('speed')) {
      icon = 'efficiency';
    }
    
    // Determine value range for color coding
    let valueRange = 'good'; // default
    
    // For percentage values
    if (valueText.includes('%')) {
      if (numericValue >= 80) valueRange = 'excellent';
      else if (numericValue >= 60) valueRange = 'good';
      else if (numericValue >= 40) valueRange = 'warning';
      else valueRange = 'critical';
    }
    // For revenue/monetary values
    else if (valueText.includes('$') || title.includes('revenue') || title.includes('sales')) {
      if (numericValue >= 100000) valueRange = 'excellent';
      else if (numericValue >= 50000) valueRange = 'good';
      else if (numericValue >= 25000) valueRange = 'warning';
      else valueRange = 'critical';
    }
    // For customer counts
    else if (title.includes('customer') || title.includes('user')) {
      if (numericValue >= 1000) valueRange = 'excellent';
      else if (numericValue >= 500) valueRange = 'good';
      else if (numericValue >= 100) valueRange = 'warning';
      else valueRange = 'critical';
    }
    // For ratings/scores (1-10 scale)
    else if (title.includes('rating') || title.includes('score')) {
      if (numericValue >= 8) valueRange = 'excellent';
      else if (numericValue >= 6) valueRange = 'good';
      else if (numericValue >= 4) valueRange = 'warning';
      else valueRange = 'critical';
    }
    // Default numeric ranges
    else {
      if (numericValue >= 100) valueRange = 'excellent';
      else if (numericValue >= 50) valueRange = 'good';
      else if (numericValue >= 25) valueRange = 'warning';
      else if (numericValue < 25 && numericValue > 0) valueRange = 'critical';
    }
    
    // Apply enhancements
    card.setAttribute('data-icon', icon);
    card.setAttribute('data-value-range', valueRange);
    
    // Add animation delay for staggered appearance
    const cardIndex = Array.from(kpiCards).indexOf(card);
    card.style.animationDelay = `${cardIndex * 0.1}s`;
    card.classList.add('kpi-card-animated');
  });
}

// Update metadata bar
function updateMetadata(data) {
  try {
    const isCustomRole = !!window.__CUSTOM_ROLE_NAME__;
    
    // Update data freshness (latest data date)
    const dataFreshnessEl = document.getElementById('data-freshness');
    if (dataFreshnessEl && data.metrics) {
      let latestDate = null;
      
      if (isCustomRole) {
        // For custom roles, look for date columns in chart data
        const chartKeys = Object.keys(data.metrics).filter(k => k.startsWith('chart_'));
        for (const chartKey of chartKeys) {
          const chartData = data.metrics[chartKey];
          if (Array.isArray(chartData) && chartData.length > 0) {
            // Look for common date column names
            const dateColumns = ['day', 'date', 'registration_date', 'registration_month', 'date_of_last_purchase', 'first_purchase_date'];
            for (const row of chartData) {
              for (const col of dateColumns) {
                if (row[col]) {
                  const dateStr = row[col];
                  if (!latestDate || dateStr > latestDate) {
                    latestDate = dateStr;
                  }
                }
              }
            }
          }
        }
      } else {
        // For built-in roles, check specific tables
        const tables = ['campaign_kpis', 'ecom_funnel', 'sku_efficiency', 'creative_ctr'];
        for (const table of tables) {
          if (data.metrics[table] && data.metrics[table].length > 0) {
            const dates = data.metrics[table].map(row => row.day).filter(Boolean);
            if (dates.length > 0) {
              const maxDate = dates.reduce((a, b) => a > b ? a : b);
              if (!latestDate || maxDate > latestDate) {
                latestDate = maxDate;
              }
            }
          }
        }
      }
      
      if (latestDate) {
        const date = new Date(latestDate);
        dataFreshnessEl.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      } else {
        dataFreshnessEl.textContent = 'Unknown';
      }
    }
    
    // Update data range
    const dataRangeEl = document.getElementById('data-range');
    if (dataRangeEl && data.metrics) {
      let earliestDate = null;
      let latestDate = null;
      
      if (isCustomRole) {
        // For custom roles, look for date columns in chart data
        const chartKeys = Object.keys(data.metrics).filter(k => k.startsWith('chart_'));
        for (const chartKey of chartKeys) {
          const chartData = data.metrics[chartKey];
          if (Array.isArray(chartData) && chartData.length > 0) {
            const dateColumns = ['day', 'date', 'registration_date', 'registration_month', 'date_of_last_purchase', 'first_purchase_date'];
            for (const row of chartData) {
              for (const col of dateColumns) {
                if (row[col]) {
                  const dateStr = row[col];
                  if (!earliestDate || dateStr < earliestDate) {
                    earliestDate = dateStr;
                  }
                  if (!latestDate || dateStr > latestDate) {
                    latestDate = dateStr;
                  }
                }
              }
            }
          }
        }
      } else {
        // For built-in roles, check specific tables
        const tables = ['campaign_kpis', 'ecom_funnel', 'sku_efficiency', 'creative_ctr'];
        for (const table of tables) {
          if (data.metrics[table] && data.metrics[table].length > 0) {
            const dates = data.metrics[table].map(row => row.day).filter(Boolean);
            if (dates.length > 0) {
              const minDate = dates.reduce((a, b) => a < b ? a : b);
              const maxDate = dates.reduce((a, b) => a > b ? a : b);
              if (!earliestDate || minDate < earliestDate) {
                earliestDate = minDate;
              }
              if (!latestDate || maxDate > latestDate) {
                latestDate = maxDate;
              }
            }
          }
        }
      }
      
      if (earliestDate && latestDate) {
        const startDate = new Date(earliestDate);
        const endDate = new Date(latestDate);
        dataRangeEl.textContent = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
      } else {
        dataRangeEl.textContent = 'Unknown';
      }
    }
    
    // Update total records
    const totalRecordsEl = document.getElementById('total-records');
    if (totalRecordsEl && data.metrics) {
      let totalCount = 0;
      
      if (isCustomRole) {
        // For custom roles, count all chart data rows
        const chartKeys = Object.keys(data.metrics).filter(k => k.startsWith('chart_'));
        for (const chartKey of chartKeys) {
          const chartData = data.metrics[chartKey];
          if (Array.isArray(chartData)) {
            totalCount += chartData.length;
          }
        }
      } else {
        // For built-in roles, count specific tables
        const tables = ['campaign_kpis', 'ecom_funnel', 'sku_efficiency', 'creative_ctr'];
        for (const table of tables) {
          if (data.metrics[table]) {
            totalCount += data.metrics[table].length;
          }
        }
      }
      
      totalRecordsEl.textContent = totalCount.toLocaleString();
    }
  } catch (e) {
    console.error('Error updating metadata:', e);
  }
}

// Convert a free-form summary into concise bullet points and inject into container
function renderSummaryInto(containerEl, summaryText) {
  if (!containerEl) return;
  try {
    let bullets = [];
    if (Array.isArray(summaryText)) {
      bullets = summaryText.map(String);
    } else if (typeof summaryText === 'object' && summaryText !== null) {
      // If model returned an object like {bullets: [...]} or {points: [...]} use that
      const arr = summaryText.bullets || summaryText.points || summaryText.items;
      if (Array.isArray(arr)) bullets = arr.map(String);
    }
    if (bullets.length === 0 && typeof summaryText === 'string') {
      const raw = summaryText.trim();
      // Prefer pre-bulleted text first (lines starting with - or •)
      const preBulleted = raw.split(/\n+/).filter(l => /^\s*[-•–\d+\.]/.test(l)).map(l => l.replace(/^\s*[-•–\d+\.]+\s*/, '').trim());
      if (preBulleted.length > 0) {
        bullets = preBulleted;
      } else {
        // Otherwise split into sentences and take the most informative first few
        bullets = raw
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && /[a-zA-Z]/.test(s));
      }
    }
    // Limit and tidy bullets
    bullets = bullets.slice(0, 4).map(b => b.replace(/^[-•\s]+/, '').trim());
    const html = bullets.length
      ? `<ul class="summary-bullets">${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
      : `<div class="summary-text">${escapeHtml(typeof summaryText === 'string' ? summaryText : '')}</div>`;
    containerEl.innerHTML = html;
  } catch (_) {
    containerEl.textContent = typeof summaryText === 'string' ? summaryText : '';
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchMetrics() {
  try {
    const customRole = window.__CUSTOM_ROLE_NAME__;
    const url = customRole ? `/api/custom_role/metrics?role_name=${encodeURIComponent(customRole)}` : '/api/metrics';
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    window.__LATEST_METRICS__ = data; // keep for analysis
    
    // Update metadata bar
    updateMetadata(data);
    
    // Update page title/header with role
    try {
      const role = data && data.role ? data.role : '';
      if (role) {
        document.title = `Crazy Fashion Corp - ${role}`;
        const header = document.querySelector('.header h1');
        if (header) header.textContent = `${role} Dashboard`;
      }
    } catch(_) {}
    try { 
      console.debug('sku_efficiency sample:', (data.metrics && data.metrics.sku_efficiency) ? data.metrics.sku_efficiency.slice(0,3) : null);
      console.debug('campaign_kpis sample:', (data.metrics && data.metrics.campaign_kpis) ? data.metrics.campaign_kpis.slice(0,3) : null);
      console.debug('campaign_kpis total rows:', (data.metrics && data.metrics.campaign_kpis) ? data.metrics.campaign_kpis.length : 0);
    } catch(_) {}
    
    // For custom roles, always use simple renderer
    if (window.__CUSTOM_ROLE_NAME__) {
      console.log('Custom role detected, using simple renderer');
      renderCustomSimple(data.metrics);
      // Also render charts using the visualizer if available
      if (window.metricsVisualizer) {
        try {
          const topics = document.getElementById('topic-groups');
          window.metricsVisualizer.renderCustomRoleCharts(topics, data.metrics);
        } catch (e) {
          console.warn('Custom role chart rendering via visualizer failed; keeping tables only.', e);
        }
      }
    } else if (window.metricsVisualizer) {
      // Use new visualization system for built-in roles
      window.metricsVisualizer.render(data.role, data.metrics);
    } else {
      // Fallback to old rendering
      renderMetrics(data);
    }
    // Load latest saved analysis for both built-in and custom roles
    try {
      const isCustom = !!window.__CUSTOM_ROLE_NAME__;
      const analysisUrl = isCustom ? 
        `/api/custom_role/analysis_latest?role_name=${encodeURIComponent(window.__CUSTOM_ROLE_NAME__)}` : 
        '/api/analysis_latest';
      
      const ares = await fetch(analysisUrl);
      if (ares.ok) {
          const a = await ares.json();
          
          // Update last analysis timestamp
          const lastAnalysisEl = document.getElementById('last-analysis');
          if (lastAnalysisEl && a.created_ts) {
            const analysisDate = new Date(a.created_ts);
            lastAnalysisEl.textContent = analysisDate.toLocaleDateString() + ' ' + analysisDate.toLocaleTimeString();
          } else if (lastAnalysisEl) {
            lastAnalysisEl.textContent = 'No analysis yet';
          }
          
          if (a && a.analysis) {
            const analysis = a.analysis;
            
            // Handle new structure with short_term and long_term
            if (analysis.short_term && analysis.long_term) {
              // New structure
              const shortPriorities = Array.isArray(analysis.short_term.prioritized_issues) ? analysis.short_term.prioritized_issues : [];
              const longPriorities = Array.isArray(analysis.long_term.prioritized_issues) ? analysis.long_term.prioritized_issues : [];
              
              shortPriorities.sort((x,y)=>(x.priority||99)-(y.priority||99));
              longPriorities.sort((x,y)=>(x.priority||99)-(y.priority||99));
              
              renderPriorityCards(shortPriorities, 'short-term');
              renderPriorityCards(longPriorities, 'long-term');
              
              // Show summaries
              const shortSummaryEl = document.getElementById('short-term-summary');
              const longSummaryEl = document.getElementById('long-term-summary');
              if (shortSummaryEl && analysis.short_term.summary) {
                const body = document.getElementById('short-term-summary-body');
                if (body) renderSummaryInto(body, analysis.short_term.summary);
                shortSummaryEl.style.display = '';
              }
              if (longSummaryEl && analysis.long_term.summary) {
                const body = document.getElementById('long-term-summary-body');
                if (body) renderSummaryInto(body, analysis.long_term.summary);
                longSummaryEl.style.display = '';
              }
              
              // Add visual indicator that results are available
              const toggle = document.getElementById('priorities-toggle');
              if (toggle && (shortPriorities.length > 0 || longPriorities.length > 0)) {
                toggle.classList.add('has-results');
              }
            } else {
              // Legacy structure - render as short-term
              const priorities = Array.isArray(analysis.prioritized_issues) ? analysis.prioritized_issues : [];
              priorities.sort((x,y)=>(x.priority||99)-(y.priority||99));
              renderPriorityCards(priorities, 'short-term');
              
              const shortSummaryEl = document.getElementById('short-term-summary');
              if (shortSummaryEl && analysis.summary) {
                const body = document.getElementById('short-term-summary-body');
                if (body) renderSummaryInto(body, analysis.summary);
                shortSummaryEl.style.display = '';
              }
            }
        }
      }
    } catch(_) {}
  } catch (e) {
    const el = document.getElementById('metrics');
    if (el) el.textContent = 'Failed to load metrics.';
  }
}

// Simple fallback renderer for custom roles (ensures something shows even if advanced renderer fails)
function renderCustomSimple(metrics) {
  console.log('renderCustomSimple called with:', metrics);
  try {
    const kpiGrid = document.getElementById('kpi-grid');
    console.log('KPI grid element:', kpiGrid);
    if (kpiGrid && kpiGrid.children.length === 0) {
      const kpiKeys = Object.keys(metrics).filter(k => k.startsWith('kpi_'));
      console.log('Found KPI keys:', kpiKeys);
      kpiKeys.forEach(key => {
        const box = document.createElement('div');
        box.className = 'kpi-card';
        const kpiData = metrics[key];
        const value = kpiData ? Object.values(kpiData).find(v => typeof v === 'number' || typeof v === 'string') : null;
        const changePct = kpiData && kpiData.change_pct !== undefined ? kpiData.change_pct : null;
        const title = key.replace('kpi_', '').replace(/_/g, ' ').replace(/\b\w/g, c=>c.toUpperCase());
        
        let changeHtml = '';
        if (changePct !== null) {
          const dir = changePct > 0 ? 'trend-up' : changePct < 0 ? 'trend-down' : 'trend-neutral';
          const arrow = changePct > 0 ? '▲' : changePct < 0 ? '▼' : '■';
          changeHtml = `<div class="kpi-trend ${dir}"><span class="trend-arrow">${arrow}</span>${Math.abs(changePct)}% vs prev 30d</div>`;
        }
        
        box.innerHTML = `
          <div class="kpi-title">${title}</div>
          <div class="kpi-value">${(typeof value === 'number' ? value.toLocaleString() : value) ?? '—'}</div>
          ${changeHtml}
        `;
        kpiGrid.appendChild(box);
        console.log('Added KPI card:', title, value, 'change:', changePct);
      });
    }
    const topics = document.getElementById('topic-groups');
    console.log('Topics element:', topics);
    if (topics && topics.children.length === 0) {
      const topic = document.createElement('div');
      topic.className = 'topic';
      topic.innerHTML = '<h3>Data Analysis</h3>';
      const container = document.createElement('div');
      container.className = 'metrics-tables';
      const chartKeys = Object.keys(metrics).filter(k => k.startsWith('chart_'));
      console.log('Found chart keys:', chartKeys);
      chartKeys.forEach(key => {
        const table = document.createElement('div');
        table.className = 'metrics-table';
        table.innerHTML = `<div class="table-title">${key.replace('chart_', '').replace(/_/g, ' ').replace(/\b\w/g, c=>c.toUpperCase())}</div>`;
        const content = document.createElement('div');
        content.className = 'table-content';
        const rows = metrics[key] || [];
        if (rows.length > 0) {
          const headers = Object.keys(rows[0]);
          const thead = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
          const tbody = `<tbody>${rows.map(r=>`<tr>${headers.map(h=>`<td>${r[h]}</td>`).join('')}</tr>`).join('')}</tbody>`;
          content.innerHTML = `<table>${thead}${tbody}</table>`;
        } else {
          content.textContent = 'No data';
        }
        table.appendChild(content);
        container.appendChild(table);
        console.log('Added chart table:', key);
      });
      topic.appendChild(container);
      topics.appendChild(topic);
    }
    console.log('renderCustomSimple completed successfully');
  } catch (e) {
    console.error('Fallback render failed', e);
  }
}

// Hook range buttons to re-render with selected window
// Remove global range controls
window.__RANGE_DAYS__ = 90;

// Accordion functionality
function initAccordion() {
  const toggle = document.getElementById('priorities-toggle');
  const content = document.getElementById('priorities-content');
  
  if (toggle && content) {
    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      
      if (isExpanded) {
        // Close accordion
        toggle.setAttribute('aria-expanded', 'false');
        content.style.setProperty('display', 'none', 'important');
      } else {
        // Open accordion
        toggle.setAttribute('aria-expanded', 'true');
        content.style.setProperty('display', 'block', 'important');
      }
    });
  }
}

// Force accordion closed immediately (fallback)
function forceAccordionClosed() {
  const toggle = document.getElementById('priorities-toggle');
  const content = document.getElementById('priorities-content');
  if (toggle && content) {
    toggle.setAttribute('aria-expanded', 'false');
    content.style.setProperty('display', 'none', 'important');
  }
}

// Try to close accordion immediately
forceAccordionClosed();

// Initialize accordion when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Force accordion to be closed immediately
  forceAccordionClosed();
  
  // Then initialize the click handler
  initAccordion();
  
  // Final check after a short delay to ensure it stays closed
  setTimeout(() => {
    const toggle = document.getElementById('priorities-toggle');
    const content = document.getElementById('priorities-content');
    if (toggle && content && toggle.getAttribute('aria-expanded') === 'false') {
      content.style.setProperty('display', 'none', 'important');
    }
  }, 100);
});

// Priorities: render three cards with Gemini results
function renderPriorityCards(priorities, gridType = 'short-term') {
  const grid = document.getElementById(gridType + '-grid');
  if (!grid) return;
  const slots = Array.from(grid.querySelectorAll('.priority-card'));
  const top3 = (priorities || []).slice(0, 3);
  slots.forEach((slot, i) => {
    const p = top3[i];
    if (!p) { slot.innerHTML = ''; return; }
    const title = p.title || `Priority #${p.priority || (i + 1)}`;
    const why = p.why || '';
    const evidence = p.evidence || {};
    // Determine category from text/evidence keys
    const txt = `${title} ${why} ${Object.keys(evidence).join(' ')}`.toLowerCase();
    let category = 'general';
    if (/(roas|ctr|cvr|campaign|creative|paid|social|display|email)/.test(txt)) category = 'marketing';
    else if (/(lcp|fid|cls|perf|core web|web vitals|latency|page)/.test(txt)) category = 'performance';
    else if (/(checkout|payment|decline|gateway|failure)/.test(txt)) category = 'checkout';
    else if (/(search|zero result|query)/.test(txt)) category = 'search';
    else if (/(return|rma)/.test(txt)) category = 'returns';
    else if (/(sku|inventory|merch|pdp|plp)/.test(txt)) category = 'merch';

    const iconMap = { marketing:'📣', performance:'⚡', checkout:'💳', search:'🔎', returns:'↩', merch:'🛒', general:'⚑' };
    const icon = iconMap[category] || '⚑';

    // Extract up to two key signals and render as category-colored chips
    let evObj = evidence;
    // evidence may be serialized text in DB; try parse JSON; if not JSON, drop to avoid artifacts
    if (typeof evObj === 'string') {
      try { 
        // Handle both JSON and Python dict string formats
        if (evObj.startsWith('{') && evObj.endsWith('}')) {
          evObj = JSON.parse(evObj); 
        } else {
          // Try to convert Python dict string to JSON
          evObj = JSON.parse(evObj.replace(/'/g, '"'));
        }
      }
      catch(_) { evObj = {}; }
    }
    // If evidence is an array of {metric, value} objects, normalize to pairs
    if (Array.isArray(evObj)) {
      const pairs = evObj.map(e => [e.metric || e.name || e.key || '', e.value ?? e.val ?? '']).filter(([k,_])=>k);
      const signals = pairs.slice(0,2);
      const chips = signals.map(([k,v])=> `<span class="chip cat-${category}"><span class="dot"></span>${k}: ${typeof v==='number'? v.toLocaleString(): v}</span>`).join('');
      slot.classList.add('compact');
      slot.innerHTML = `
        <div class="title"><span class="icon-circle">${icon}</span><span>${title}</span></div>
        <div class="chips">${chips}</div>
        <div class="body">${why}</div>
        <div class="priority-actions">
          <button class="btn-explore-act" data-priority-id="${i + 1}" data-grid-type="${gridType}" data-priority-data='${JSON.stringify(p).replace(/'/g, '&apos;')}'>
            🔍 Explore & Act
          </button>
        </div>
      `;
      return;
    }
    // Robust evidence parsing - handles all possible structures Gemini might generate
    const signals = [];
    
    function extractMetrics(obj, prefix = '', maxDepth = 3, currentDepth = 0) {
      if (currentDepth >= maxDepth || signals.length >= 2) return;
      
      if (Array.isArray(obj)) {
        // Handle arrays - look for objects with numeric values
        obj.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            extractMetrics(item, `${prefix}[${index}]`, maxDepth, currentDepth + 1);
          } else if (typeof item === 'number' && signals.length < 2) {
            signals.push([`${prefix}[${index}]`, item]);
          }
        });
      } else if (typeof obj === 'object' && obj !== null) {
        // Handle objects - extract numeric values and recurse into nested objects
        Object.entries(obj).forEach(([subKey, subValue]) => {
          const newPrefix = prefix ? `${prefix}.${subKey}` : subKey;
          
          if (typeof subValue === 'number' && signals.length < 2) {
            signals.push([newPrefix, subValue]);
          } else if (typeof subValue === 'string' && signals.length < 2 && subValue.length < 50) {
            // Include short strings as context
            signals.push([newPrefix, subValue]);
          } else if (typeof subValue === 'object' && subValue !== null) {
            extractMetrics(subValue, newPrefix, maxDepth, currentDepth + 1);
          }
        });
      } else if ((typeof obj === 'number' || typeof obj === 'string') && signals.length < 2) {
        // Handle primitive values
        if (typeof obj === 'string' && obj.length >= 50) return; // Skip long strings
        signals.push([prefix || 'value', obj]);
      }
    }
    
    extractMetrics(evObj);
    
    const chips = signals.map(([k,v])=> `<span class="chip cat-${category}"><span class="dot"></span>${k}: ${typeof v==='number'? v.toLocaleString(): v}</span>`).join('');
    slot.classList.add('compact');
    slot.innerHTML = `
      <div class="title"><span class="icon-circle">${icon}</span><span>${title}</span></div>
      <div class="chips">${chips}</div>
      <div class="body">${why}</div>
      <div class="priority-actions">
        <button class="btn-explore-act" data-priority-id="${i + 1}" data-grid-type="${gridType}" data-priority-data='${JSON.stringify(p).replace(/'/g, '&apos;')}'>
          🔍 Explore & Act
        </button>
      </div>
    `;
  });
}

function clearPriorityCards() { 
  renderPriorityCards([], 'short-term'); 
  renderPriorityCards([], 'long-term'); 
}

// Add event listener for Explore & Act buttons
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('btn-explore-act')) {
    console.log('Explore & Act button clicked!');
    const priorityId = e.target.getAttribute('data-priority-id');
    const gridType = e.target.getAttribute('data-grid-type');
    const priorityData = JSON.parse(e.target.getAttribute('data-priority-data').replace(/&apos;/g, "'"));
    
    console.log('Priority data:', { priorityId, gridType, priorityData });
    
    // Open the modal
    if (window.priorityExploreModal) {
      console.log('Opening modal...');
      window.priorityExploreModal.open(priorityData, priorityId, gridType);
    } else {
      console.error('PriorityExploreModal not available!');
    }
  }
});


async function runGeminiAnalysis() {
  const analyzeBtn = document.getElementById('analyze');
  if (analyzeBtn) { 
    analyzeBtn.disabled = true; 
    analyzeBtn.classList.add('loading');
    analyzeBtn.textContent = 'Analyzing…'; 
  }
  
  // Clear existing results
  const shortTermSummaryEl = document.getElementById('short-term-summary');
  const longTermSummaryEl = document.getElementById('long-term-summary');
  if (shortTermSummaryEl) { 
    shortTermSummaryEl.style.display='none'; 
    const body=document.getElementById('short-term-summary-body'); 
    if (body) body.textContent=''; 
  }
  if (longTermSummaryEl) { 
    longTermSummaryEl.style.display='none'; 
    const body=document.getElementById('long-term-summary-body'); 
    if (body) body.textContent=''; 
  }
  
  try {
    await fetchMetrics();
    
    // Use different endpoint for custom roles
    const customRole = window.__CUSTOM_ROLE_NAME__;
    const url = customRole ? '/api/custom_role/analyze' : '/api/analyze';
    const body = customRole ? JSON.stringify({ role_name: customRole }) : undefined;
    
    const res = await fetch(url, { 
      method: 'POST',
      headers: customRole ? { 'Content-Type': 'application/json' } : undefined,
      body: body
    });
    const payload = await res.json();
    const analysis = payload && payload.analysis ? payload.analysis : null;
    
    if (analysis) {
      // Handle short-term analysis
      const shortTermAnalysis = analysis.short_term;
      if (shortTermAnalysis) {
        const shortPriorities = Array.isArray(shortTermAnalysis.prioritized_issues) ? shortTermAnalysis.prioritized_issues : [];
        shortPriorities.sort((a,b)=>(a.priority||99)-(b.priority||99));
        renderPriorityCards(shortPriorities.slice(0,3), 'short-term');
        
        if (shortTermSummaryEl) {
          const body = document.getElementById('short-term-summary-body');
          if (body) renderSummaryInto(body, shortTermAnalysis.summary || '');
          shortTermSummaryEl.style.display='';
        }
        
        // Update last analysis timestamp
        const lastAnalysisEl = document.getElementById('last-analysis');
        if (lastAnalysisEl && analysis.created_ts) {
          const analysisDate = new Date(analysis.created_ts);
          lastAnalysisEl.textContent = analysisDate.toLocaleDateString() + ' ' + analysisDate.toLocaleTimeString();
        }
        
        // Auto-open accordion when NEW analysis results are available
        const toggle = document.getElementById('priorities-toggle');
        const content = document.getElementById('priorities-content');
        if (toggle && content && toggle.getAttribute('aria-expanded') === 'false') {
          toggle.setAttribute('aria-expanded', 'true');
          content.style.setProperty('display', 'block', 'important');
        }
      }
      
      // Handle long-term analysis
      const longTermAnalysis = analysis.long_term;
      if (longTermAnalysis) {
        const longPriorities = Array.isArray(longTermAnalysis.prioritized_issues) ? longTermAnalysis.prioritized_issues : [];
        longPriorities.sort((a,b)=>(a.priority||99)-(b.priority||99));
        renderPriorityCards(longPriorities.slice(0,3), 'long-term');
        
        if (longTermSummaryEl) {
          const body = document.getElementById('long-term-summary-body');
          if (body) renderSummaryInto(body, longTermAnalysis.summary || '');
          longTermSummaryEl.style.display='';
        }
      }
    } else {
      // Handle error case
      if (shortTermSummaryEl) {
        const body = document.getElementById('short-term-summary-body');
        if (body) body.textContent = payload.analysis_error || 'No analysis';
        shortTermSummaryEl.style.display='';
      }
    }
  } catch (e) {
    if (shortTermSummaryEl) {
      const body = document.getElementById('short-term-summary-body');
      if (body) body.textContent = 'Analysis failed.';
      shortTermSummaryEl.style.display='';
    }
  } finally {
    if (analyzeBtn) { 
      analyzeBtn.disabled = false; 
      analyzeBtn.classList.remove('loading');
      analyzeBtn.textContent = 'Analyze with Gemini'; 
    }
  }
}

function asPct(n) {
  if (n === null || n === undefined) return '—';
  return (n * 100).toFixed(1) + '%';
}

function renderMetrics(data) {
  const m = (data && data.metrics) ? data.metrics : {};
  const el = document.getElementById('metrics');
  el.innerHTML = '';

  const hasAny = Object.keys(m).length > 0;

  if (m.ecom_funnel && m.ecom_funnel.length) {
    const [today, yesterday] = m.ecom_funnel;
    const box = document.createElement('div');
    box.innerHTML = `
      <h3>E-commerce Funnel</h3>
      <div>Sessions: ${today.sessions} ${yesterday ? `(prev ${yesterday.sessions})` : ''}</div>
      <div>PDP→ATC: ${asPct(today.rate_pdp_to_atc)} ${yesterday ? `(prev ${asPct(yesterday.rate_pdp_to_atc)})` : ''}</div>
      <div>ATC→CO: ${asPct(today.rate_atc_to_co)} ${yesterday ? `(prev ${asPct(yesterday.rate_atc_to_co)})` : ''}</div>
      <div>CO→Purchase: ${asPct(today.rate_co_to_purchase)} ${yesterday ? `(prev ${asPct(yesterday.rate_co_to_purchase)})` : ''}</div>
    `;
    el.appendChild(box);
  }

  if (m.payment_failures && m.payment_failures.length) {
    const [today, yesterday] = m.payment_failures;
    const box = document.createElement('div');
    box.innerHTML = `
      <h3>Payment Failures</h3>
      <div>Failures: ${today.payment_failures}</div>
      <div>Failure rate: ${asPct(today.payment_failure_rate)} ${yesterday ? `(prev ${asPct(yesterday.payment_failure_rate)})` : ''}</div>
    `;
    el.appendChild(box);
  }

  if (m.zero_result_search && m.zero_result_search.length) {
    const [today, yesterday] = m.zero_result_search;
    const box = document.createElement('div');
    box.innerHTML = `
      <h3>Zero-result Search</h3>
      <div>Rate: ${asPct(today.zero_result_rate)} ${yesterday ? `(prev ${asPct(yesterday.zero_result_rate)})` : ''}</div>
    `;
    el.appendChild(box);
  }

  if (m.plp_perf && m.plp_perf.length) {
    const [today] = m.plp_perf;
    const box = document.createElement('div');
    box.innerHTML = `
      <h3>PLP Performance</h3>
      <div>LCP p75: ${(today.p75_lcp_ms/1000).toFixed(2)}s</div>
    `;
    el.appendChild(box);
  }

  if (m.product_conv && m.product_conv.length) {
    const box = document.createElement('div');
    box.innerHTML = '<h3>Product Conversion</h3>' +
      '<ul>' + m.product_conv.map(r => `<li>${r.day} ${r.product}: ${(r.view_to_purchase*100).toFixed(1)}%</li>`).join('') + '</ul>';
    el.appendChild(box);
  }

  // Advanced E-com
  if (m.ecom_rates_by_day && m.ecom_rates_by_day.length) {
    const box = document.createElement('div');
    box.innerHTML = '<h3>Rates by Day/Device/Source</h3>' +
      '<ul>' + m.ecom_rates_by_day.map(r => `<li>${r.day} ${r.device}/${r.source}: ATC ${asPct(r.atc_rate)}, CO ${asPct(r.co_start_rate)}, Purchase ${asPct(r.purchase_rate)}</li>`).join('') + '</ul>';
    el.appendChild(box);
  }

  if (m.ecom_mobile_desktop_delta && m.ecom_mobile_desktop_delta.length) {
    const [today] = m.ecom_mobile_desktop_delta;
    const box = document.createElement('div');
    box.innerHTML = `
      <h3>Mobile vs Desktop Purchase Rate</h3>
      <div>Mobile: ${asPct(today.mobile_purchase_rate)} Desktop: ${asPct(today.desktop_purchase_rate)} (Δ ${asPct(today.mobile_minus_desktop)})</div>
    `;
    el.appendChild(box);
  }

  if (m.zero_result_top_share && m.zero_result_top_share.length) {
    const [today] = m.zero_result_top_share;
    const box = document.createElement('div');
    box.innerHTML = `
      <h3>Top Zero-result Query Share</h3>
      <div>${today.top_query}: ${(today.top_zero_share*100).toFixed(1)}% of total searches</div>
    `;
    el.appendChild(box);
  }

  if (m.sku_efficiency && m.sku_efficiency.length) {
    const box = document.createElement('div');
    box.innerHTML = '<h3>SKU Efficiency</h3>' +
      '<ul>' + m.sku_efficiency.map(r => `<li>${r.day} ${r.product}: ${(r.purchase_per_view*100).toFixed(1)}%</li>`).join('') + '</ul>';
    el.appendChild(box);
  }

  if (m.return_rate_trend && m.return_rate_trend.length) {
    const box = document.createElement('div');
    box.innerHTML = '<h3>Return Rate Trend</h3>' +
      '<ul>' + m.return_rate_trend.map(r => `<li>${r.day} ${r.product}: ${(r.return_rate*100).toFixed(1)}%</li>`).join('') + '</ul>';
    el.appendChild(box);
  }

  // Marketing
  if (m.mkt_roas_campaign && m.mkt_roas_campaign.length) {
    const box = document.createElement('div');
    box.innerHTML = '<h3>Campaign ROAS (worst first)</h3>' +
      '<ul>' + m.mkt_roas_campaign.map(r => `<li>${r.day} ${r.channel} / ${r.campaign}: ROAS ${(r.roas).toFixed(2)}</li>`).join('') + '</ul>';
    el.appendChild(box);
  }

  if (m.creative_ctr && m.creative_ctr.length) {
    const box = document.createElement('div');
    box.innerHTML = '<h3>Creative CTR/CVR</h3>' +
      '<ul>' + m.creative_ctr.map(r => `<li>${r.day} ${r.creative_id}: CTR ${asPct(r.ctr)} CVR ${asPct(r.conv_rate)}</li>`).join('') + '</ul>';
    el.appendChild(box);
  }

  if (m.budget_pacing && m.budget_pacing.length) {
    const box = document.createElement('div');
    box.innerHTML = '<h3>Budget Pacing</h3>' +
      '<ul>' + m.budget_pacing.map(r => `<li>${r.day} ${r.channel}: variance ${(r.variance>=0?'+':'')}${r.variance.toFixed(0)}</li>`).join('') + '</ul>';
    el.appendChild(box);
  }

  if (m.disapprovals && m.disapprovals.length) {
    const box = document.createElement('div');
    box.innerHTML = '<h3>Ad Disapprovals</h3>' +
      '<ul>' + m.disapprovals.map(r => `<li>${r.day} ${r.channel}: ${r.disapprovals} (${r.reason})</li>`).join('') + '</ul>';
    el.appendChild(box);
  }

  if (m.brand_health && m.brand_health.length) {
    const [today] = m.brand_health;
    const box = document.createElement('div');
    box.innerHTML = `
      <h3>Brand Health</h3>
      <div>Branded search: ${today.branded_search_volume}</div>
      <div>Sentiment: ${today.social_sentiment_score.toFixed(2)}</div>
      <div>NPS: ${today.nps}</div>
    `;
    el.appendChild(box);
  }

  if (m.campaign_kpis && m.campaign_kpis.length) {
    const box = document.createElement('div');
    box.innerHTML = '<h3>Campaign KPIs</h3>' +
      '<ul>' + m.campaign_kpis.map(r => `<li>${r.day} ${r.channel}/${r.campaign}: ROAS ${(r.roas).toFixed(2)} CAC ${r.cac ? r.cac.toFixed(2) : '—'} CTR ${asPct(r.ctr)} CVR ${asPct(r.cvr)}</li>`).join('') + '</ul>';
    el.appendChild(box);
  }

  if (m.disapproval_rate && m.disapproval_rate.length) {
    const box = document.createElement('div');
    box.innerHTML = '<h3>Disapproval Rate</h3>' +
      '<ul>' + m.disapproval_rate.map(r => `<li>${r.day} ${r.channel}: ${r.disapprovals_per_10k_impr ? r.disapprovals_per_10k_impr.toFixed(2) : '—'} per 10k impressions</li>`).join('') + '</ul>';
    el.appendChild(box);
  }

  if (m.brand_lift_proxy && m.brand_lift_proxy.length) {
    const [today] = m.brand_lift_proxy;
    const box = document.createElement('div');
    box.innerHTML = `
      <h3>Brand Lift Proxy</h3>
      <div>Branded search: ${today.branded_search_volume} vs Brand sessions: ${today.brand_sessions || '—'}</div>
    `;
    el.appendChild(box);
  }

  if (m.sentiment_social_roas && m.sentiment_social_roas.length) {
    const [today] = m.sentiment_social_roas;
    const box = document.createElement('div');
    box.innerHTML = `
      <h3>Sentiment vs Social ROAS</h3>
      <div>Sentiment: ${today.social_sentiment_score?.toFixed ? today.social_sentiment_score.toFixed(2) : today.social_sentiment_score}</div>
      <div>Social ROAS: ${today.social_roas ? today.social_roas.toFixed(2) : '—'}</div>
    `;
    el.appendChild(box);
  }

  if (!hasAny) {
    const debug = document.createElement('pre');
    debug.textContent = JSON.stringify(data, null, 2);
    el.appendChild(debug);
  }
}

// legacy runAnalysis removed; using runGeminiAnalysis

async function logout() {
  await fetch('/logout', { method: 'POST' });
  window.location.href = '/';
}

document.getElementById('logout').addEventListener('click', logout);
// Custom Visualization Modal Functions
let currentEditingChartId = null;

function openCustomVizModal(chartId = null) {
  const modal = document.getElementById('custom-viz-modal');
  const title = document.getElementById('custom-viz-title');
  const input = document.getElementById('custom-viz-input');
  const status = document.getElementById('custom-viz-status');
  
  currentEditingChartId = chartId;
  
  if (chartId) {
    title.textContent = 'Edit Chart';
    input.placeholder = `Edit this chart. Examples:
• 'Change to a line chart showing trends over time'
• 'Make this a pie chart instead'  
• 'Show more detailed breakdown'
• 'Focus on the last 6 months only'
• 'Add customer segment filtering'`;
  } else {
    title.textContent = 'Add Custom Visualization';
    input.placeholder = `Describe what you want to visualize. Examples:
• 'Show me customer acquisition trends by month' (line chart)
• 'Compare sales by product category' (bar chart)  
• 'Breakdown of customers by age group' (pie chart)
• 'List all high-value customers with details' (table)
• 'Create a pie chart showing revenue by region'
• 'Make a line chart of monthly growth'`;
  }
  
  input.value = '';
  status.textContent = '';
  modal.style.display = 'flex';
  input.focus();
}

// Make function globally accessible for edit buttons
window.openCustomVizModal = openCustomVizModal;

function closeCustomVizModal() {
  const modal = document.getElementById('custom-viz-modal');
  modal.style.display = 'none';
  currentEditingChartId = null;
}

async function generateCustomVisualization() {
  const input = document.getElementById('custom-viz-input');
  const status = document.getElementById('custom-viz-status');
  const generateBtn = document.getElementById('custom-viz-generate');
  
  const description = input.value.trim();
  if (!description) {
    status.textContent = 'Please enter a description of what you want to visualize.';
    status.style.color = '#dc2626';
    return;
  }
  
  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating...';
  status.textContent = 'Creating your visualization...';
  status.style.color = '#666';
  
  // Add loading spinner
  const loadingSpinner = document.createElement('div');
  loadingSpinner.style.cssText = `
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #666;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-left: 8px;
    vertical-align: middle;
  `;
  status.appendChild(loadingSpinner);
  
  try {
    const customRole = window.__CUSTOM_ROLE_NAME__;
    if (!customRole) {
      throw new Error('This feature is only available for custom roles');
    }
    
    // Get Enhanced Insights checkbox value
    const insightsCheckbox = document.getElementById('enhanced-insights-checkbox');
    const generateInsights = insightsCheckbox ? insightsCheckbox.checked : true;
    
    const response = await fetch('/api/custom_role/create_visualization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role_name: customRole,
        description: description,
        chart_id: currentEditingChartId,
        generate_insights: generateInsights
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      // Remove loading spinner
      const spinner = status.querySelector('div[style*="animation: spin"]');
      if (spinner) spinner.remove();
      
      status.textContent = 'Visualization created successfully!';
      status.style.color = '#059669';
      
      // Close modal and refresh the dashboard
      setTimeout(() => {
        closeCustomVizModal();
        // Clear existing charts first
        if (window.metricsVisualizer && window.metricsVisualizer.charts) {
          window.metricsVisualizer.charts.forEach((chart, canvasId) => {
            chart.destroy();
          });
          window.metricsVisualizer.charts.clear();
        }
        // Clear the topic groups container
        const topics = document.getElementById('topic-groups');
        if (topics) {
          topics.innerHTML = '';
        }
        fetchMetrics(); // Refresh to show new visualization
      }, 1500);
    } else {
      // Remove loading spinner
      const spinner = status.querySelector('div[style*="animation: spin"]');
      if (spinner) spinner.remove();
      
      throw new Error(result.error || 'Failed to generate visualization');
    }
  } catch (error) {
    // Remove loading spinner
    const spinner = status.querySelector('div[style*="animation: spin"]');
    if (spinner) spinner.remove();
    
    status.textContent = `Error: ${error.message}`;
    status.style.color = '#dc2626';
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Visualization';
  }
}

// Wire new priorities actions
const analyzeBtn = document.getElementById('analyze');
if (analyzeBtn) analyzeBtn.addEventListener('click', runGeminiAnalysis);
const clearBtn = document.getElementById('clear-priorities');
if (clearBtn) clearBtn.addEventListener('click', clearPriorityCards);

// Wire custom visualization modal actions
const addCustomVizBtn = document.getElementById('btn-add-custom-viz');
if (addCustomVizBtn) {
  addCustomVizBtn.addEventListener('click', () => {
    // Add loading state to the button
    addCustomVizBtn.disabled = true;
    addCustomVizBtn.innerHTML = '<span style="color: white;">⏳</span> Opening...';
    
    // Open modal
    openCustomVizModal();
    
    // Reset button state after modal opens
    setTimeout(() => {
      addCustomVizBtn.disabled = false;
      addCustomVizBtn.innerHTML = '<span style="color: white;">+</span> Add Custom Visualization';
    }, 100);
  });
}

const customVizClose = document.getElementById('custom-viz-close');
if (customVizClose) customVizClose.addEventListener('click', closeCustomVizModal);

const customVizCancel = document.getElementById('custom-viz-cancel');
if (customVizCancel) customVizCancel.addEventListener('click', closeCustomVizModal);

const customVizGenerate = document.getElementById('custom-viz-generate');
if (customVizGenerate) customVizGenerate.addEventListener('click', generateCustomVisualization);

// Close modal when clicking outside
const customVizModal = document.getElementById('custom-viz-modal');
if (customVizModal) {
  customVizModal.addEventListener('click', (e) => {
    if (e.target === customVizModal) {
      closeCustomVizModal();
    }
  });
}

fetchMetrics();

// Set up KPI enhancement observer to automatically enhance KPIs when they're added to the DOM
const kpiObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the added node contains KPI cards or is a KPI card itself
          if (node.classList?.contains('kpi-card') || node.querySelector?.('.kpi-card')) {
            setTimeout(() => enhanceKPICards(), 100); // Small delay to ensure DOM is ready
          }
        }
      });
    }
  });
});

// Set up a global function to update metadata when metrics are loaded
window.updateMetadataFromData = function(data) {
  updateMetadata(data);
};

// Make updateMetadata globally available for other scripts to call
window.updateMetadata = updateMetadata;

// Add a manual trigger for debugging
window.forceUpdateMetadata = async function() {
  if (window.__CUSTOM_ROLE_NAME__) {
    console.log('Force updating metadata...');
    try {
      const response = await fetch(`/api/custom_role/metrics?role_name=${encodeURIComponent(window.__CUSTOM_ROLE_NAME__)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Received data:', data);
        updateMetadata(data);
        console.log('Metadata updated successfully');
      } else {
        console.error('Failed to fetch metrics:', response.status);
      }
    } catch (error) {
      console.error('Error updating metadata:', error);
    }
  } else {
    console.log('Not a custom role dashboard');
  }
};

// Start observing the document for KPI card additions
kpiObserver.observe(document.body, {
  childList: true,
  subtree: true
});

// Simple metadata observer - only triggers on incorrect values
const metadataObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'characterData') {
      const target = mutation.target;
      
      // Only check if this is a metadata element with incorrect values
      if (target.parentElement?.id === 'data-freshness' || target.parentElement?.id === 'total-records') {
        const text = target.textContent;
        
        // Only update if we see the specific incorrect values
        if (text === 'Unknown' || text === '104') {
          console.log('Detected incorrect metadata value:', text, '- updating...');
          if (window.__CUSTOM_ROLE_NAME__) {
            fetch(`/api/custom_role/metrics?role_name=${encodeURIComponent(window.__CUSTOM_ROLE_NAME__)}`)
              .then(response => response.json())
              .then(data => updateMetadata(data))
              .catch(error => console.error('Failed to update metadata:', error));
          }
        }
      }
    }
  });
});

// Start observing metadata elements only after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const dataFreshnessEl = document.getElementById('data-freshness');
  const totalRecordsEl = document.getElementById('total-records');
  if (dataFreshnessEl) metadataObserver.observe(dataFreshnessEl, { characterData: true });
  if (totalRecordsEl) metadataObserver.observe(totalRecordsEl, { characterData: true });
});

// Also enhance any existing KPIs when the page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => enhanceKPICards(), 500); // Delay to ensure KPIs are rendered
});

// Load schema information for custom roles
async function loadSchemaInfo() {
  const customRole = window.__CUSTOM_ROLE_NAME__;
  if (!customRole) return;
  
  const schemaPanel = document.getElementById('schema-section-panel');
  const schemaInfo = document.getElementById('schema-info');
  
  if (!schemaPanel || !schemaInfo) return;
  
  try {
    const response = await fetch(`/api/custom_role/schema?role_name=${encodeURIComponent(customRole)}`);
    if (!response.ok) return;
    
    const result = await response.json();
    if (!result.ok || !result.schema) return;
    
    // Show the schema panel
    schemaPanel.style.display = 'block';
    
    // Render schema information
    renderSchemaInfo(result.schema);
    
  } catch (error) {
    console.error('Failed to load schema info:', error);
    schemaInfo.innerHTML = '<div class="schema-loading">Failed to load data fields</div>';
  }
}

function renderSchemaInfo(schema) {
  const schemaInfo = document.getElementById('schema-info');
  if (!schemaInfo) return;
  
  const tables = Object.keys(schema);
  if (tables.length === 0) {
    schemaInfo.innerHTML = '<div class="schema-loading">No data tables found</div>';
    return;
  }
  
  let html = '';
  
  tables.forEach(tableName => {
    const table = schema[tableName];
    const columns = table.columns || [];
    const rowCount = table.row_count || 0;
    
    html += `
      <div class="schema-table">
        <div class="schema-table-header">
          <div class="schema-table-name">${tableName}</div>
          <div class="schema-table-count">${rowCount.toLocaleString()} rows</div>
        </div>
        <div class="schema-columns">
    `;
    
    columns.forEach(column => {
      // Use inferred_type if available, fallback to type
      const displayType = column.inferred_type || column.type;
      const iconClass = getColumnIconClass(displayType);
      const iconText = getColumnIconText(displayType);
      
      let badges = '';
      if (column.primary_key) {
        badges += '<span class="schema-badge primary">PK</span>';
      }
      if (column.nullable) {
        badges += '<span class="schema-badge nullable">NULL</span>';
      }
      
      html += `
        <div class="schema-column">
          <div class="schema-column-icon ${iconClass}">${iconText}</div>
          <div class="schema-column-info">
            <div class="schema-column-name">${column.name}</div>
            <div class="schema-column-type">${displayType}</div>
            ${badges ? `<div class="schema-column-badges">${badges}</div>` : ''}
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  schemaInfo.innerHTML = html;
}

function getColumnIconClass(type) {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('text') || lowerType.includes('varchar') || lowerType.includes('char')) {
    return 'text';
  } else if (lowerType.includes('int') || lowerType.includes('integer')) {
    return 'integer';
  } else if (lowerType.includes('real') || lowerType.includes('float') || lowerType.includes('double') || lowerType.includes('decimal')) {
    return 'real';
  } else if (lowerType.includes('date') || lowerType.includes('time') || lowerType.includes('timestamp')) {
    return 'date';
  } else if (lowerType.includes('bool')) {
    return 'boolean';
  } else if (lowerType.includes('blob')) {
    return 'blob';
  } else {
    return 'text'; // default
  }
}

function getColumnIconText(type) {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('text') || lowerType.includes('varchar') || lowerType.includes('char')) {
    return 'T';
  } else if (lowerType.includes('int') || lowerType.includes('integer')) {
    return '#';
  } else if (lowerType.includes('real') || lowerType.includes('float') || lowerType.includes('double') || lowerType.includes('decimal')) {
    return '#';
  } else if (lowerType.includes('date') || lowerType.includes('time') || lowerType.includes('timestamp')) {
    return '📅';
  } else if (lowerType.includes('bool')) {
    return '✓';
  } else if (lowerType.includes('blob')) {
    return 'B';
  } else {
    return 'T'; // default
  }
}

// Delete custom chart function
async function deleteCustomChart(chartId) {
  const customRole = window.__CUSTOM_ROLE_NAME__;
  if (!customRole) {
    alert('This feature is only available for custom roles');
    return;
  }
  
  // Show confirmation dialog
  const chartTitle = chartId.replace('chart_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const confirmed = confirm(`Are you sure you want to delete the "${chartTitle}" chart?\n\nThis action cannot be undone.`);
  
  if (!confirmed) {
    return;
  }
  
  try {
    const response = await fetch('/api/custom_role/delete_chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role_name: customRole,
        chart_id: chartId
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      // Success - refresh the dashboard
      // Clear existing charts first
      if (window.metricsVisualizer && window.metricsVisualizer.charts) {
        window.metricsVisualizer.charts.forEach((chart, canvasId) => {
          chart.destroy();
        });
        window.metricsVisualizer.charts.clear();
      }
      // Clear the topic groups container
      const topics = document.getElementById('topic-groups');
      if (topics) {
        topics.innerHTML = '';
      }
      fetchMetrics(); // Refresh to show updated visualizations
    } else {
      alert(`Failed to delete chart: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    alert(`Error deleting chart: ${error.message}`);
  }
}

// Make deleteCustomChart available globally
window.deleteCustomChart = deleteCustomChart;

// Update metadata function for custom roles
function updateMetadata(data) {
  try {
    console.log('Updating metadata with data:', data);
    
    if (!data.metadata) {
      console.log('No metadata in response');
      return;
    }
    
    // Update data freshness
    const dataFreshnessEl = document.getElementById('data-freshness');
    if (dataFreshnessEl && data.metadata.created_at) {
      const createdDate = new Date(data.metadata.created_at);
      dataFreshnessEl.textContent = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();
      console.log('Updated data freshness to:', dataFreshnessEl.textContent);
    }
    
    // Update total records
    const totalRecordsEl = document.getElementById('total-records');
    if (totalRecordsEl && data.metadata.total_records !== undefined) {
      totalRecordsEl.textContent = data.metadata.total_records.toLocaleString();
      console.log('Updated total records to:', totalRecordsEl.textContent);
    }
  } catch (e) {
    console.error('Error updating metadata:', e);
  }
}

// Make updateMetadata available globally
window.updateMetadata = updateMetadata;

// Manual trigger function for debugging
window.forceUpdateMetadata = async function() {
  if (window.__CUSTOM_ROLE_NAME__) {
    console.log('Force updating metadata...');
    try {
      const response = await fetch(`/api/custom_role/metrics?role_name=${encodeURIComponent(window.__CUSTOM_ROLE_NAME__)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Received data:', data);
        updateMetadata(data);
        console.log('Metadata updated successfully');
      } else {
        console.error('Failed to fetch metrics:', response.status);
      }
    } catch (error) {
      console.error('Error updating metadata:', error);
    }
  } else {
    console.log('Not a custom role dashboard');
  }
};

// Load schema info when page loads
document.addEventListener('DOMContentLoaded', loadSchemaInfo);

// Fetch and update metadata for custom roles on page load
if (window.__CUSTOM_ROLE_NAME__) {
  const fetchAndUpdateMetadata = async () => {
    // Check if DOM elements exist before trying to update
    const dataFreshnessEl = document.getElementById('data-freshness');
    const totalRecordsEl = document.getElementById('total-records');
    
    if (!dataFreshnessEl || !totalRecordsEl) {
      console.log('Metadata elements not found, skipping update');
      return;
    }
    
    try {
      const response = await fetch(`/api/custom_role/metrics?role_name=${encodeURIComponent(window.__CUSTOM_ROLE_NAME__)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched metadata:', data.metadata);
        updateMetadata(data);
      }
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
    }
  };
  
  // Only call after DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure all elements are rendered
    setTimeout(fetchAndUpdateMetadata, 100);
    
    // Load saved analyses
    setTimeout(loadSavedAnalyses, 200);
    
    // Add accordion functionality for saved analyses
    const savedAnalysesToggle = document.getElementById('saved-analyses-toggle');
    const savedAnalysesContent = document.getElementById('saved-analyses-content');
    
    if (savedAnalysesToggle && savedAnalysesContent) {
      savedAnalysesToggle.addEventListener('click', () => {
        const isExpanded = savedAnalysesContent.style.display !== 'none';
        savedAnalysesContent.style.display = isExpanded ? 'none' : 'block';
        savedAnalysesToggle.setAttribute('aria-expanded', !isExpanded);
        
        const icon = savedAnalysesToggle.querySelector('.accordion-icon');
        if (icon) {
          icon.textContent = '▶';
        }
      });
    }
  });
}

// Saved Analyses Functionality
async function loadSavedAnalyses() {
    console.log('Loading saved workspaces...');
    try {
        const response = await fetch('/api/priority-insights/saved');
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Saved workspaces data:', data);
            renderSavedAnalyses(data.analyses);
        } else {
            console.error('Failed to load saved workspaces, status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);
        }
    } catch (error) {
        console.error('Error loading saved workspaces:', error);
    }
}

// Render saved workspaces
function renderSavedAnalyses(analyses) {
    console.log('Rendering saved workspaces:', analyses);
    const container = document.getElementById('saved-analyses-list');
    
    if (!container) {
        console.error('Saved workspaces container not found!');
        return;
    }
    
    if (!analyses || analyses.length === 0) {
        console.log('No saved workspaces found, showing empty state');
        container.innerHTML = `
            <div class="empty-state">
                <p>No saved workspaces yet. Use the "💾 Save Analysis" button in the Explore & Act modal to save your priority workspaces.</p>
            </div>
        `;
        return;
    }
    
        console.log(`Rendering ${analyses.length} saved workspaces`);
    
    const analysesHtml = analyses.map(analysis => {
        const priorityData = JSON.parse(analysis.priority_data);
        const actionsData = analysis.actions_data ? JSON.parse(analysis.actions_data) : [];
        const notesData = analysis.notes_data ? JSON.parse(analysis.notes_data) : [];
        
        return `
            <div class="saved-analysis-item">
                <div class="saved-analysis-header">
                    <h3 class="saved-analysis-title">${escapeHtml(analysis.priority_title)}</h3>
                    <div class="saved-analysis-actions">
                        <button class="saved-analysis-btn saved-analysis-btn-primary" onclick="openSavedAnalysis(${analysis.id})">
                            🔍 View Analysis
                        </button>
                        <button class="saved-analysis-btn saved-analysis-btn-danger" onclick="deleteSavedAnalysis(${analysis.id})">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
                <div class="saved-analysis-meta">
                    <span class="saved-analysis-type">${analysis.grid_type}</span>
                    <span class="saved-analysis-date">Saved: ${new Date(analysis.created_ts).toLocaleString()}</span>
                </div>
                <div class="saved-analysis-summary">
                    ${analysis.insights_content ? '✅ Insights generated' : '❌ No insights'} • 
                    ${actionsData.length} actions • 
                    ${notesData.length} notes
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = analysesHtml;
        console.log('Saved workspaces rendered successfully');
}

// Open saved workspace in modal
async function openSavedAnalysis(analysisId) {
    try {
        // First, get the saved analysis data
        const response = await fetch('/api/priority-insights/saved');
        if (!response.ok) {
            throw new Error('Failed to fetch saved analyses');
        }
        
        const data = await response.json();
        const analysis = data.analyses.find(a => a.id === analysisId);
        
        if (!analysis) {
            alert('Analysis not found');
            return;
        }
        
        // Parse the saved data
        const priorityData = JSON.parse(analysis.priority_data);
        
        // Open the Explore & Act modal with the saved data
        if (window.priorityExploreModal) {
            // Create a mock priority object that matches what the modal expects
            const mockPriority = {
                data: priorityData,
                id: analysis.priority_id,
                gridType: analysis.grid_type
            };
            
            // Open the modal
            window.priorityExploreModal.open(mockPriority.data, mockPriority.id, mockPriority.gridType);
            
            // Load the saved insights, actions, and notes into the modal
            setTimeout(async () => {
                try {
                    // Load insights if they exist
                    if (analysis.insights_content) {
                        const insightsElement = document.getElementById('insights-content');
                        if (insightsElement) {
                            insightsElement.innerHTML = `
                                <div class="insights-display">
                                    <div class="insights-meta">
                                        <span class="insights-date">Generated: ${new Date(analysis.created_ts).toLocaleString()}</span>
                                        <button class="btn-delete-subtle" onclick="priorityExploreModal.deleteInsight(${analysisId})" title="Delete insight">
                                            🗑️
                                        </button>
                                    </div>
                                    <div class="insights-text">${window.priorityExploreModal.formatInsightsText(analysis.insights_content)}</div>
                                </div>
                            `;
                        }
                    }
                    
                    // Load actions if they exist
                    if (analysis.actions_data) {
                        const actionsData = JSON.parse(analysis.actions_data);
                        const actionsElement = document.getElementById('actions-content');
                        if (actionsElement && actionsData.length > 0) {
                            const actionsHtml = actionsData.map(action => {
                                // Helper functions for styling
                                const getPriorityInfo = (level) => {
                                    switch(level) {
                                        case 1: case 'high': return { icon: '🔴', class: 'priority-high' };
                                        case 2: case 'medium': return { icon: '🟡', class: 'priority-medium' };
                                        case 3: case 'low': return { icon: '🟢', class: 'priority-low' };
                                        default: return { icon: '⚪', class: '' };
                                    }
                                };
                                
                                const getEffortInfo = (effort) => {
                                    switch(effort?.toLowerCase()) {
                                        case 'high': return { icon: '⚡', class: 'effort-high' };
                                        case 'medium': return { icon: '⚖️', class: 'effort-medium' };
                                        case 'low': return { icon: '🐌', class: 'effort-low' };
                                        default: return { icon: '❓', class: '' };
                                    }
                                };
                                
                                const getImpactInfo = (impact) => {
                                    switch(impact?.toLowerCase()) {
                                        case 'high': return { icon: '🚀', class: 'impact-high' };
                                        case 'medium': return { icon: '📈', class: 'impact-medium' };
                                        case 'low': return { icon: '📊', class: 'impact-low' };
                                        default: return { icon: '❓', class: '' };
                                    }
                                };
                                
                                const priorityInfo = getPriorityInfo(action.priority_level);
                                const effortInfo = getEffortInfo(action.estimated_effort);
                                const impactInfo = getImpactInfo(action.estimated_impact);
                                
                                return `
                                    <div class="action-item">
                                        <div class="action-header">
                                            <h4 class="action-title">${escapeHtml(action.action_title)}</h4>
                                            <div class="action-meta">
                                                <span class="action-priority ${priorityInfo.class}">
                                                    ${priorityInfo.icon} Priority ${action.priority_level}
                                                </span>
                                                ${action.estimated_effort ? `
                                                    <span class="action-effort ${effortInfo.class}">
                                                        ${effortInfo.icon} Effort: ${action.estimated_effort}
                                                    </span>
                                                ` : ''}
                                                ${action.estimated_impact ? `
                                                    <span class="action-impact ${impactInfo.class}">
                                                        ${impactInfo.icon} Impact: ${action.estimated_impact}
                                                    </span>
                                                ` : ''}
                                                <button class="btn-delete-subtle" onclick="priorityExploreModal.deleteAction(${action.id})" title="Delete action">
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                        <div class="action-description">${escapeHtml(action.action_description)}</div>
                                    </div>
                                `;
                            }).join('');
                            
                            actionsElement.innerHTML = `
                                <div class="actions-list">
                                    ${actionsHtml}
                                </div>
                            `;
                        }
                    }
                    
                    // Load notes if they exist
                    if (analysis.notes_data) {
                        const notesData = JSON.parse(analysis.notes_data);
                        const notesElement = document.getElementById('notes-content');
                        if (notesElement && notesData.length > 0) {
                            const notesHtml = notesData.map(note => `
                                <div class="note-item">
                                    <div class="note-content">${escapeHtml(note.note_content)}</div>
                                    <div class="note-meta">
                                        <span class="note-date">${new Date(note.created_ts).toLocaleString()}</span>
                                        <button class="btn-delete-subtle" onclick="priorityExploreModal.deleteNote(${note.id})" title="Delete note">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            `).join('');
                            
                            notesElement.innerHTML = `
                                <div class="notes-list">
                                    ${notesHtml}
                                </div>
                            `;
                        }
                    }
                    
                } catch (error) {
                    console.error('Error loading saved analysis data:', error);
                }
            }, 100);
            
        } else {
            alert('Explore & Act modal not available');
        }
        
    } catch (error) {
        console.error('Error opening saved analysis:', error);
        alert('Failed to open saved analysis. Please try again.');
    }
}

// Delete saved analysis
async function deleteSavedAnalysis(analysisId) {
    if (!confirm('Are you sure you want to delete this saved analysis? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/priority-insights/saved/${analysisId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Reload saved analyses
            await loadSavedAnalyses();
        } else {
            throw new Error('Failed to delete analysis');
        }
    } catch (error) {
        console.error('Error deleting saved analysis:', error);
        alert('Failed to delete analysis. Please try again.');
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


