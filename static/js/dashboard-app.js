/**
 * Main Dashboard Application
 * Coordinates all dashboard functionality and initializes components
 */

// Global variables
let metricsVisualizer = null;
let currentAnalysis = null;
let kpiManager = null;

/**
 * Reload metrics - exposed globally for KPI manager
 */
window.loadMetrics = async function() {
  const isCustomRole = !!window.__CUSTOM_ROLE_NAME__;
  if (isCustomRole) {
    await loadCustomRoleMetrics();
  } else {
    await loadBuiltInRoleMetrics();
  }
};

/**
 * Initializes the dashboard application
 */
function initializeDashboard() {
  console.log('Initializing dashboard...');
  
  // Set default user immediately as fallback
  const loggedInUserEl = document.getElementById('logged-in-user');
  if (loggedInUserEl && loggedInUserEl.textContent === 'Loading...') {
    loggedInUserEl.textContent = 'Henrik Warfvinge';
  }
  
  // Initialize the metrics visualizer
  metricsVisualizer = new MetricsVisualizer();
  window.metricsVisualizer = metricsVisualizer;
  window.loadCustomRoleMetrics = loadCustomRoleMetrics;
  
  // Initialize KPI Manager
  if (typeof KPIManager !== 'undefined') {
    kpiManager = new KPIManager();
    window.kpiManager = kpiManager;
    kpiManager.init();
  }
  
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
  
  // Event delegation is now handled via onclick attributes in the HTML
  
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
    
    // Update workspace metadata after loading
    await updateWorkspaceMetadata();
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
 * Updates the workspace metadata in the accordion header
 */
async function updateWorkspaceMetadata() {
  try {
    // Fetch both saved analyses and actions
    const [analysesResponse, actionsResponse] = await Promise.all([
      fetch('/api/priority-insights/saved'),
      fetch('/api/actions/saved')
    ]);
    
    const analyses = analysesResponse.ok ? await analysesResponse.json() : { analyses: [] };
    const actions = actionsResponse.ok ? await actionsResponse.json() : { actions_by_priority: {} };
    
    const analysesList = analyses.analyses || [];
    const actionsByPriority = actions.actions_by_priority || {};
    
    // Count total saved items
    const totalAnalyses = analysesList.length;
    const totalActions = Object.values(actionsByPriority).reduce((sum, arr) => sum + arr.length, 0);
    
    // Count insights (analyses with insights_content)
    const withInsights = analysesList.filter(a => a.insights_content).length;
    
    // Count total notes (this would require additional API calls, so we'll estimate)
    const totalNotes = 0; // Placeholder - would need to fetch notes for each analysis
    
    // Find last activity
    const allDates = [
      ...analysesList.map(a => new Date(a.updated_ts || a.created_ts)),
      ...Object.values(actionsByPriority).flat().map(a => new Date(a.updated_ts || a.saved_ts))
    ];
    const lastActivity = allDates.length > 0 
      ? new Date(Math.max(...allDates))
      : null;
    
    // Update UI elements - show only saved priority analyses count
    const workspaceCount = document.getElementById('workspace-count');
    if (workspaceCount) {
      workspaceCount.textContent = `${totalAnalyses} saved`;
    }
    
    const insightsCount = document.getElementById('insights-count');
    if (insightsCount) {
      insightsCount.textContent = `${withInsights} with insights`;
    }
    
    const notesTotal = document.getElementById('workspace-notes-total');
    if (notesTotal) {
      notesTotal.textContent = `${totalNotes} notes`;
    }
    
    const lastActivityEl = document.getElementById('workspace-last-activity');
    if (lastActivityEl && lastActivity) {
      lastActivityEl.textContent = formatRelativeTime(lastActivity);
    }
  } catch (error) {
    console.error('Error updating workspace metadata:', error);
  }
}

/**
 * Formats a date to relative time (e.g., "2 hours ago", "3 days ago")
 * @param {Date} date - The date to format
 * @returns {string} - Formatted relative time string
 */
function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
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

  container.innerHTML = analyses.map(analysis => {
    const gridTypeBadge = analysis.grid_type === 'short-term' 
      ? '<span class="badge badge-short-term">🚀 Short Term</span>' 
      : '<span class="badge badge-long-term">🎯 Long Term</span>';
    
    const hasInsights = analysis.insights_content 
      ? '<span class="badge badge-success">✓ Insights</span>' 
      : '<span class="badge badge-warning">⚠ No Insights</span>';
    
    const lastUpdated = formatRelativeTime(new Date(analysis.updated_ts || analysis.created_ts));
    
    return `
      <div class="saved-analysis-item clickable" data-analysis-id="${analysis.id}" onclick="viewSavedAnalysis(${analysis.id})">
        <div class="saved-analysis-header">
          <h4 class="saved-analysis-title">${escapeHtml(analysis.priority_title)}</h4>
          <button class="btn-delete-icon" onclick="event.stopPropagation(); deleteSavedAnalysis(${analysis.id})" title="Delete">
            🗑️
          </button>
        </div>
        <div class="saved-analysis-metadata">
          ${gridTypeBadge}
          ${hasInsights}
          <span class="badge badge-muted">📅 ${lastUpdated}</span>
        </div>
      </div>
    `;
  }).join('');
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

  container.innerHTML = priorities.map(priorityTitle => {
    const actions = actionsByPriority[priorityTitle];
    return `
    <div class="saved-action-group">
      <h3 class="priority-group-title">📋 ${escapeHtml(priorityTitle)}</h3>
      <div class="saved-action-list">
        ${actions.map(action => {
          const statusIcon = {
            'pending': '⏳',
            'in_progress': '🔄',
            'completed': '✅',
            'blocked': '🚫'
          }[action.status] || '⏳';
          
          const statusClass = {
            'pending': 'status-pending',
            'in_progress': 'status-in-progress',
            'completed': 'status-completed',
            'blocked': 'status-blocked'
          }[action.status] || 'status-pending';
          
          const lastUpdated = formatRelativeTime(new Date(action.updated_ts || action.saved_ts));
          
          const effortBadge = action.estimated_effort 
            ? `<span class="badge badge-effort" title="Estimated Effort">💪 ${escapeHtml(action.estimated_effort)}</span>`
            : '';
          
          const impactBadge = action.estimated_impact
            ? `<span class="badge badge-impact" title="Estimated Impact">🎯 ${escapeHtml(action.estimated_impact)}</span>`
            : '';
          
          return `
          <div class="saved-action-list-item clickable" data-action-id="${action.action_id}" onclick="viewSavedAction('${action.action_id}')">
            <div class="action-list-item-header">
              <span class="action-list-item-title">${escapeHtml(action.action_title)}</span>
              <div class="action-list-item-actions">
                <button class="btn-icon btn-delete-icon" onclick="event.stopPropagation(); deleteSavedAction('${action.action_id}')" title="Delete Action">
                  🗑️
                </button>
              </div>
            </div>
            <div class="action-list-item-meta">
              <span class="badge ${statusClass}">${statusIcon} ${escapeHtml(action.status.replace('_', ' '))}</span>
              ${effortBadge}
              ${impactBadge}
              <span class="badge badge-muted">📅 ${lastUpdated}</span>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  }).join('');
}

/**
 * Deletes a saved analysis
 * @param {number} analysisId - ID of the saved analysis to delete
 */
async function deleteSavedAnalysis(analysisId) {
  if (!confirm('Are you sure you want to delete this saved priority workspace? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/priority-insights/saved/${analysisId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (result.success) {
      showNotification('Priority workspace deleted successfully', 'success');
      // Reload the saved analyses list
      await loadSavedAnalyses();
      await updateWorkspaceMetadata();
    } else {
      throw new Error('Failed to delete priority workspace');
    }
  } catch (error) {
    console.error('Error deleting saved analysis:', error);
    showNotification('Failed to delete priority workspace', 'error');
  }
}

/**
 * Deletes a saved action
 * @param {string} actionId - ID of the saved action to delete
 */
async function deleteSavedAction(actionId) {
  if (!confirm('Are you sure you want to delete this saved action? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/actions/saved/${actionId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (result.success) {
      showNotification('Action deleted successfully', 'success');
      // Reload the saved actions list
      await loadSavedActions();
      await updateWorkspaceMetadata();
    } else {
      throw new Error('Failed to delete action');
    }
  } catch (error) {
    console.error('Error deleting saved action:', error);
    showNotification('Failed to delete action', 'error');
  }
}

/**
 * Show a notification message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'info', 'warning')
 */
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    font-weight: 500;
    animation: slideIn 0.3s ease-out;
  `;

  // Set colors based on type
  const colors = {
    success: { bg: '#10b981', text: '#ffffff' },
    error: { bg: '#ef4444', text: '#ffffff' },
    warning: { bg: '#f59e0b', text: '#ffffff' },
    info: { bg: '#3b82f6', text: '#ffffff' }
  };

  const color = colors[type] || colors.info;
  notification.style.backgroundColor = color.bg;
  notification.style.color = color.text;

  document.body.appendChild(notification);

  // Remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 4000);
}

/**
 * Opens a saved analysis in the Priority Explore Modal
 * @param {string} analysisId - ID of the saved analysis
 */
async function viewSavedAnalysis(analysisId) {
  try {
    console.log('[Dashboard] Viewing saved analysis:', analysisId);
    
    // Fetch the saved analysis data
    const response = await fetch(`/api/priority-insights/saved/${analysisId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('[Dashboard] Fetched analysis result:', result);
    
    if (!result.success || !result.analysis) {
      throw new Error('Failed to load analysis data');
    }
    
    const analysis = result.analysis;
    console.log('[Dashboard] Analysis data:', { 
      id: analysis.id,
      priority_id: analysis.priority_id, 
      grid_type: analysis.grid_type,
      has_insights: !!analysis.insights_content,
      has_actions: !!analysis.actions_json
    });
    
    // Parse priority_data if it's a JSON string
    let priorityData = analysis.priority_data;
    if (typeof priorityData === 'string') {
      try {
        priorityData = JSON.parse(priorityData);
      } catch (e) {
        console.error('Error parsing priority_data:', e);
        priorityData = {
          title: analysis.priority_title || 'Untitled Priority',
          why: '',
          category: 'general'
        };
      }
    }
    
    // Ensure priority_data has required fields
    if (!priorityData || typeof priorityData !== 'object') {
      priorityData = {
        title: analysis.priority_title || 'Untitled Priority',
        why: '',
        category: 'general'
      };
    }
    
    console.log('[Dashboard] Opening modal with:', { 
      priorityData, 
      priority_id: analysis.priority_id, 
      grid_type: analysis.grid_type 
    });
    
    // Open the Priority Explore Modal with the saved data
    if (window.priorityExploreModal) {
      window.priorityExploreModal.open(priorityData, analysis.priority_id, analysis.grid_type);
    } else {
      console.error('PriorityExploreModal not initialized');
      showNotification('Modal not available', 'error');
    }
  } catch (error) {
    console.error('[Dashboard] Error viewing saved analysis:', error);
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
      window.exploreActionModal.open(
        action.action_data, 
        action.priority_data, 
        action.priority_id, 
        action.grid_type
      );
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
    
    // Render enhanced KPI cards
    if (kpiManager && data.plan && data.plan.kpis && data.plan.kpis.length > 0) {
      // Show Add KPI button for custom roles
      const addKPIBtn = document.getElementById('btn-add-kpi');
      if (addKPIBtn) {
        addKPIBtn.style.display = 'flex';
      }
      kpiManager.renderEnhancedKPICards(data.metrics, data.plan);
    } else if (metricsVisualizer) {
      // Fallback to regular KPI rendering for built-in roles
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
    
    // Update the "Last analysis" metadata in the top bar
    const lastAnalysisEl = document.getElementById('last-analysis');
    if (lastAnalysisEl) {
      const now = new Date();
      lastAnalysisEl.textContent = now.toLocaleString();
    }
    
    // Update the priorities accordion metadata
    if (window.accordionMetadataManager) {
      await window.accordionMetadataManager.updatePrioritiesMetadata();
    }
    
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
      
      // Update the "Last analysis" metadata in the top bar
      const lastAnalysisEl = document.getElementById('last-analysis');
      if (lastAnalysisEl && result.analysis.created_ts) {
        const analysisDate = new Date(result.analysis.created_ts);
        lastAnalysisEl.textContent = analysisDate.toLocaleString();
      }
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
