/**
 * Main Dashboard Application
 * Coordinates all dashboard functionality and initializes components
 */

// Global variables
let metricsVisualizer = null;
let currentAnalysis = null;

/**
 * Initializes the dashboard application
 */
function initializeDashboard() {
  console.log('Initializing dashboard...');
  
  // Initialize the metrics visualizer
  metricsVisualizer = new MetricsVisualizer();
  window.metricsVisualizer = metricsVisualizer;
  
  // Initialize UI components
  initAccordion();
  enhanceKPICards();
  
  // Set up event listeners
  setupEventListeners();
  
  // Load initial data
  loadDashboardData();
  
  console.log('Dashboard initialized successfully');
}

/**
 * Sets up global event listeners
 */
function setupEventListeners() {
  // Analyze button
  const analyzeBtn = document.getElementById('analyze');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', triggerAnalysis);
  }
  
  // Clear priorities button
  const clearBtn = document.getElementById('clear-priorities');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearPriorityCards);
  }
  
  // Add custom visualization button
  const addCustomVizBtn = document.getElementById('btn-add-custom-viz');
  if (addCustomVizBtn) {
    addCustomVizBtn.addEventListener('click', () => openCustomVizModal());
  }
  
  // Set up mutation observers for dynamic content
  setupMutationObservers();
}

/**
 * Sets up mutation observers to watch for dynamic content changes
 */
function setupMutationObservers() {
  // KPI observer
  const kpiObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const kpiCards = node.querySelectorAll ? node.querySelectorAll('.kpi-card') : [];
            if (kpiCards.length > 0) {
              enhanceKPICards();
            }
          }
        });
      }
    });
  });
  
  const kpiGrid = document.getElementById('kpi-grid');
  if (kpiGrid) {
    kpiObserver.observe(kpiGrid, { childList: true, subtree: true });
  }
  
  // Metadata observer
  const metadataObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const metadataElements = node.querySelectorAll ? node.querySelectorAll('[id*="freshness"], [id*="records"]') : [];
            if (metadataElements.length > 0) {
              // Metadata was updated, no additional action needed
            }
          }
        });
      }
    });
  });
  
  const metadataContainer = document.querySelector('.metadata-container');
  if (metadataContainer) {
    metadataObserver.observe(metadataContainer, { childList: true, subtree: true });
  }
}

/**
 * Loads dashboard data based on the current role
 */
async function loadDashboardData() {
  try {
    const isCustomRole = !!window.__CUSTOM_ROLE_NAME__;
    
    if (isCustomRole) {
      await loadCustomRoleMetrics();
      // Load saved analyses and actions for custom roles
      await loadSavedAnalyses();
      await loadSavedActions();
    } else {
      await loadBuiltInRoleMetrics();
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showNotification('Failed to load dashboard data', 'error');
  }
}

/**
 * Loads and renders saved analyses for the current custom role.
 */
async function loadSavedAnalyses() {
  try {
    const roleName = window.__CUSTOM_ROLE_NAME__;
    if (!roleName) return;

    const response = await fetch('/api/priority-insights/saved');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (result.success && result.analyses) {
      renderSavedAnalyses(result.analyses);
    }
  } catch (error) {
    console.error('Error loading saved analyses:', error);
    showNotification('Failed to load saved analyses', 'error');
  }
}

/**
 * Loads and renders saved actions for the current custom role.
 */
async function loadSavedActions() {
  try {
    const roleName = window.__CUSTOM_ROLE_NAME__;
    if (!roleName) return;

    const response = await fetch('/api/actions/saved');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (result.success && result.actions_by_priority) {
      renderSavedActions(result.actions_by_priority);
    }
  } catch (error) {
    console.error('Error loading saved actions:', error);
    showNotification('Failed to load saved actions', 'error');
  }
}

/**
 * Renders the list of saved analyses into the DOM.
 * @param {Array} analyses - The array of saved analysis objects.
 */
function renderSavedAnalyses(analyses) {
  const container = document.getElementById('saved-analyses-list');
  if (!container) return;

  if (analyses.length === 0) {
    container.innerHTML = `<div class="empty-state">
        <p>No saved workspaces yet. Use the "💾 Save Analysis" button in the Explore & Act modal to save your priority workspaces.</p>
      </div>`;
    return;
  }

  container.innerHTML = analyses.map(analysis => `
    <div class="saved-analysis-item" data-analysis-id="${analysis.id}">
      <h4 class="font-bold">${escapeHtml(analysis.priority_title)}</h4>
      <p class="text-sm text-gray-600">Saved on ${new Date(analysis.created_ts).toLocaleDateString()}</p>
      <button class="btn-secondary btn-sm mt-2 btn-view-saved-analysis">View</button>
    </div>
  `).join('');
}

/**
 * Renders the list of saved actions into the DOM, grouped by priority.
 * @param {Object} actionsByPriority - An object where keys are priority titles
 *                                     and values are arrays of action objects.
 */
function renderSavedActions(actionsByPriority) {
  const container = document.getElementById('saved-actions-list');
  if (!container) return;

  const priorities = Object.keys(actionsByPriority);

  if (priorities.length === 0) {
    container.innerHTML = `<div class="empty-state">
        <p>No saved actions yet. Use the "🔍 Explore Action" button in priority insights, then "💾 Save to Workspace" to save your action plans.</p>
      </div>`;
    return;
  }

  container.innerHTML = priorities.map(priorityTitle => `
    <div class="saved-action-group">
      <h3 class="priority-group-title">${escapeHtml(priorityTitle)}</h3>
      <div class="saved-action-list">
        ${actionsByPriority[priorityTitle].map(action => `
          <div class="saved-action-list-item" data-action-id="${action.action_id}">
            <div class="action-list-item-main">
              <span class="action-list-item-title">${escapeHtml(action.action_title)}</span>
              <span class="action-list-item-status status-${action.status}">${escapeHtml(action.status)}</span>
            </div>
            <div class="action-list-item-actions">
               <button class="btn-icon btn-view-saved-action" title="View Details">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

/**
 * Loads metrics for built-in roles (E-commerce Manager, Marketing Lead, etc.)
 */
async function loadBuiltInRoleMetrics() {
  try {
    const response = await fetch('/api/metrics');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    window.__LATEST_METRICS__ = data;
    
    // Render metrics
    renderMetrics(data);
    
    // Render KPI grid
    if (metricsVisualizer) {
      metricsVisualizer.renderKPIGrid(data.role, data.metrics);
    }
    
    // Render charts
    if (metricsVisualizer) {
      metricsVisualizer.renderCharts(data.role, data.metrics);
    }
    
  } catch (error) {
    console.error('Error loading built-in role metrics:', error);
    throw error;
  }
}

/**
 * Loads metrics for custom roles
 */
async function loadCustomRoleMetrics() {
  try {
    const roleName = window.__CUSTOM_ROLE_NAME__;
    if (!roleName) {
      throw new Error('No custom role name found');
    }
    
    const response = await fetch(`/api/custom_role/metrics?role_name=${encodeURIComponent(roleName)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    window.__LATEST_METRICS__ = data;
    
    // Render custom role metrics
    renderCustomRoleMetrics(data.metrics, data);
    
    // Render KPI grid
    if (metricsVisualizer) {
      metricsVisualizer.renderKPIGrid(data.role, data.metrics);
    }
    
    // Render charts
    if (metricsVisualizer) {
      metricsVisualizer.renderCustomRoleCharts(document.getElementById('topic-groups'), data.metrics);
    }
    
  } catch (error) {
    console.error('Error loading custom role metrics:', error);
    throw error;
  }
}

/**
 * Triggers Gemini analysis for the current role
 */
async function triggerAnalysis() {
  const analyzeBtn = document.getElementById('analyze');
  if (!analyzeBtn) return;
  
  // Show loading state
  const originalText = analyzeBtn.textContent;
  analyzeBtn.textContent = 'Analyzing...';
  analyzeBtn.disabled = true;
  
  try {
    const isCustomRole = !!window.__CUSTOM_ROLE_NAME__;
    
    // Step 1: Trigger the analysis generation
    const analyzeEndpoint = isCustomRole ? '/api/custom_role/analyze' : '/api/analyze';
    const analyzePayload = isCustomRole ? { role_name: window.__CUSTOM_ROLE_NAME__ } : {};
    
    const analyzeResponse = await fetch(analyzeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analyzePayload)
    });
    
    const analyzeResult = await analyzeResponse.json();
    if (!analyzeResult.ok && analyzeResult.error) {
        throw new Error(analyzeResult.error);
    }

    // Step 2: Fetch the generated actions for the priorities
    // This assumes the analysis populates short-term and long-term priorities
    // and we now need to fetch the actions for them.
    // We will need to trigger this for both short-term and long-term grids.
    // This part of the logic may need to be adjusted based on what `analyzeResult` contains.
    
    // For now, let's assume the analysis endpoint returns the priorities, and we render them.
    if (analyzeResult.plan) {
      // In the new flow, the analysis endpoint just generates the plan.
      // The actions are generated on demand by the user clicking a button on a priority card.
      // So, we will just render the high-level analysis summary.
      renderAnalysisSummary(analyzeResult.plan);
      showNotification('Analysis plan generated. Next, generate actions for each priority.', 'success');
    } else {
       // Fallback for old analysis structure
       renderAnalysisResults(analyzeResult.analysis);
    }

  } catch (error) {
    console.error('Error during analysis:', error);
    showNotification('Analysis failed: ' + error.message, 'error');
  } finally {
    // Restore button state
    analyzeBtn.textContent = originalText;
    analyzeBtn.disabled = false;
  }
}

/**
 * Renders analysis summary into the dashboard.
 * @param {Object} plan - The analysis plan object from the backend.
 */
function renderAnalysisSummary(plan) {
    if (!plan || !plan.insights) return;
    const summaryContainer = document.getElementById('analysis-summary');
    if (summaryContainer) {
        summaryContainer.innerHTML = `<ul>${plan.insights.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
    }
}

/**
 * Renders analysis results into the dashboard
 * @param {Object} analysis - Analysis results object
 */
function renderAnalysisResults(analysis) {
  if (!analysis) return;
  
  // Render summary
  const summaryContainer = document.getElementById('analysis-summary');
  if (summaryContainer && analysis.short_term && analysis.short_term.summary) {
    renderSummaryInto(summaryContainer, analysis.short_term.summary);
  }
  
  // Render priority cards
  if (analysis.short_term && analysis.short_term.prioritized_issues) {
    renderPriorityCards(analysis.short_term.prioritized_issues, 'short-term');
  }
  
  if (analysis.long_term && analysis.long_term.prioritized_issues) {
    renderPriorityCards(analysis.long_term.prioritized_issues, 'long-term');
  }
}

/**
 * Loads the latest analysis for the current role
 */
async function loadLatestAnalysis() {
  try {
    const isCustomRole = !!window.__CUSTOM_ROLE_NAME__;
    const endpoint = isCustomRole ? '/api/custom_role/analysis_latest' : '/api/analysis_latest';
    
    const url = isCustomRole 
      ? `${endpoint}?role_name=${encodeURIComponent(window.__CUSTOM_ROLE_NAME__)}`
      : endpoint;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.analysis) {
      currentAnalysis = result.analysis;
      renderAnalysisResults(result.analysis);
    }
    
  } catch (error) {
    console.error('Error loading latest analysis:', error);
    // Don't show error notification for this - it's expected to fail sometimes
  }
}

/**
 * Records a user action for analytics
 * @param {string} actionType - Type of action performed
 * @param {Object} details - Additional action details
 */
async function recordAction(actionType, details = {}) {
  try {
    await fetch('/api/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action_type: actionType,
        details: details
      })
    });
  } catch (error) {
    console.error('Error recording action:', error);
    // Don't show error notification for analytics failures
  }
}

/**
 * Renders schema information for custom roles
 * @param {Object} schema - Database schema object
 */
function renderSchemaInfo(schema) {
  const container = document.getElementById('schema-info');
  if (!container || !schema) return;
  
  let html = '<div class="schema-section"><h3>Database Schema</h3>';
  
  Object.entries(schema).forEach(([tableName, tableInfo]) => {
    html += `
      <div class="table-schema">
        <h4>${escapeHtml(tableName)} (${tableInfo.row_count.toLocaleString()} rows)</h4>
        <div class="columns-grid">
    `;
    
    tableInfo.columns.forEach(column => {
      const iconClass = getColumnIconClass(column.inferred_type);
      const iconText = getColumnIconText(column.inferred_type);
      
      html += `
        <div class="column-item">
          <i class="${iconClass}"></i>
          <span class="column-name">${escapeHtml(column.name)}</span>
          <span class="column-type">${escapeHtml(iconText)}</span>
          ${column.primary_key ? '<span class="primary-key">PK</span>' : ''}
        </div>
      `;
    });
    
    html += '</div></div>';
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Initialize dashboard when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
  initializeDashboard();
}
