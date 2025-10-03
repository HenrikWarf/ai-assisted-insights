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
  window.loadCustomRoleMetrics = loadCustomRoleMetrics;
  
  // Initialize UI components
  initAccordion();
  enhanceKPICards();
  
  // Initialize modal listeners
  if (typeof initializeModalListeners === 'function') {
    initializeModalListeners();
  }
  
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
  // Logout button
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
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
  
  // Event delegation for dynamically generated saved analysis buttons
  document.addEventListener('click', (e) => {
    // View saved analysis button
    if (e.target.closest('.btn-view-saved-analysis')) {
      const analysisItem = e.target.closest('.saved-analysis-item');
      if (analysisItem) {
        const analysisId = analysisItem.getAttribute('data-analysis-id');
        viewSavedAnalysis(analysisId);
      }
    }
    
    // View saved action button
    if (e.target.closest('.btn-view-saved-action')) {
      const actionItem = e.target.closest('.saved-action-list-item');
      if (actionItem) {
        const actionId = actionItem.getAttribute('data-action-id');
        viewSavedAction(actionId);
      }
    }
  });
  
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
      // Load latest priority analysis if available
      await loadLatestAnalysis();
    } else {
      await loadBuiltInRoleMetrics();
      // Load latest priority analysis if available
      await loadLatestAnalysis();
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
 * Opens a saved analysis in the Priority Explore Modal
 * @param {string} analysisId - ID of the saved analysis
 */
async function viewSavedAnalysis(analysisId) {
  try {
    console.log('Viewing saved analysis:', analysisId);
    
    // Fetch the saved analysis data
    const response = await fetch(`/api/priority-insights/saved/${analysisId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success || !result.analysis) {
      throw new Error('Failed to load analysis data');
    }
    
    const analysis = result.analysis;
    
    // Open the Priority Explore Modal with the saved data
    if (window.priorityExploreModal) {
      window.priorityExploreModal.open(analysis.priority_data, analysis.priority_id, analysis.grid_type);
    } else {
      console.error('PriorityExploreModal not initialized');
      showNotification('Modal not available', 'error');
    }
  } catch (error) {
    console.error('Error viewing saved analysis:', error);
    showNotification('Failed to load saved analysis', 'error');
  }
}

/**
 * Opens a saved action in the Explore Action Modal
 * @param {string} actionId - ID of the saved action
 */
async function viewSavedAction(actionId) {
  try {
    console.log('Viewing saved action:', actionId);
    
    // Fetch the saved action data
    const response = await fetch(`/api/actions/saved/${actionId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success || !result.action) {
      throw new Error('Failed to load action data');
    }
    
    const action = result.action;
    
    // Open the Explore Action Modal with the saved data
    if (window.exploreActionModal) {
      window.exploreActionModal.open(action.action_data, action.priority_data, action.priority_id, action.grid_type);
    } else {
      console.error('ExploreActionModal not initialized');
      showNotification('Modal not available', 'error');
    }
  } catch (error) {
    console.error('Error viewing saved action:', error);
    showNotification('Failed to load saved action', 'error');
  }
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
    
    // Update dashboard title with role name
    const dashboardTitle = document.querySelector('.header h1');
    if (dashboardTitle) {
      dashboardTitle.textContent = `${data.role} Dashboard`;
    }
    
    // Render metrics (this also calls updateMetadata)
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
    
    // Update dashboard title with role name
    const dashboardTitle = document.querySelector('.header h1');
    if (dashboardTitle) {
      dashboardTitle.textContent = `${data.role} Dashboard`;
    }
    
    // Update metadata (data freshness, total records)
    if (typeof updateMetadata === 'function') {
      updateMetadata(data);
    }
    
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
    
    // Load and render schema information
    await loadSchemaInfo(roleName);
    
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
    
    // Debug logging
    console.log('=== ANALYSIS DEBUG ===');
    console.log('Current URL:', window.location.pathname);
    console.log('Is Custom Role:', isCustomRole);
    console.log('Role Name:', window.__CUSTOM_ROLE_NAME__);
    console.log('=====================');
    
    // Step 1: Trigger the analysis generation
    const analyzeEndpoint = isCustomRole ? '/api/custom_role/analyze' : '/api/analyze';
    const analyzePayload = isCustomRole ? { role_name: window.__CUSTOM_ROLE_NAME__ } : {};
    
    console.log('Analysis Endpoint:', analyzeEndpoint);
    console.log('Analysis Payload:', analyzePayload);
    
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
    
    // After analysis is complete, load and render the latest analysis results
    await loadLatestAnalysis();
    
    showNotification('Analysis complete! Priority insights generated.', 'success');

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
 * Handles user logout
 */
async function handleLogout() {
  try {
    const response = await fetch('/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      // Redirect to login page
      window.location.href = '/';
    } else {
      showNotification('Logout failed. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error during logout:', error);
    showNotification('Logout failed. Please try again.', 'error');
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
 * Loads schema information for a custom role
 * @param {string} roleName - Name of the role
 */
async function loadSchemaInfo(roleName) {
  const container = document.getElementById('schema-info');
  const panel = document.getElementById('schema-section-panel');
  
  if (!container) return;
  
  try {
    const response = await fetch(`/api/custom_role/schema?role_name=${encodeURIComponent(roleName)}`);
    const result = await response.json();
    
    if (result.ok && result.schema) {
      renderSchemaInfo(result.schema);
      if (panel) {
        panel.style.display = 'block';
      }
    } else {
      container.innerHTML = '<div class="schema-loading">No schema information available</div>';
    }
  } catch (error) {
    console.error('Error loading schema info:', error);
    container.innerHTML = '<div class="schema-loading">Failed to load schema information</div>';
  }
}

/**
 * Renders schema information for custom roles
 * @param {Object} schema - Database schema object
 */
function renderSchemaInfo(schema) {
  const container = document.getElementById('schema-info');
  if (!container || !schema) return;
  
  let html = '<div class="schema-section">';
  
  Object.entries(schema).forEach(([tableName, tableInfo]) => {
    html += `
      <div class="schema-table">
        <div class="schema-table-header">
          <span class="schema-table-name">${escapeHtml(tableName)}</span>
          <span class="schema-table-count">${tableInfo.row_count.toLocaleString()} rows</span>
        </div>
        <div class="schema-columns">
    `;
    
    tableInfo.columns.forEach(column => {
      const typeClass = (column.inferred_type || column.type || 'text').toLowerCase();
      const iconText = getColumnIconText(column.inferred_type || column.type);
      
      html += `
        <div class="schema-column">
          <div class="schema-column-icon ${typeClass}">${iconText.charAt(0)}</div>
          <div class="schema-column-info">
            <div class="schema-column-name">${escapeHtml(column.name)}</div>
            <div class="schema-column-type">${escapeHtml(iconText)}</div>
          </div>
          ${column.primary_key ? '<span style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: auto;">PK</span>' : ''}
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
