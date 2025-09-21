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
  initializeModalListeners();
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
    } else {
      await loadBuiltInRoleMetrics();
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showNotification('Failed to load dashboard data', 'error');
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
    const endpoint = isCustomRole ? '/api/custom_role/analyze' : '/api/analyze';
    
    const payload = {};
    if (isCustomRole) {
      payload.role_name = window.__CUSTOM_ROLE_NAME__;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.analysis_error) {
      throw new Error(result.analysis_error);
    }
    
    if (!result.analysis) {
      throw new Error('No analysis results received');
    }
    
    currentAnalysis = result.analysis;
    
    // Render analysis results
    renderAnalysisResults(result.analysis);
    
    showNotification('Analysis completed successfully!', 'success');
    
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
