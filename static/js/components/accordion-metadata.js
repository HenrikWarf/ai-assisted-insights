/**
 * Accordion Metadata Manager
 * 
 * This module handles the dynamic calculation and display of metadata
 * for the three main accordions: Priorities, Workspace, and Saved Actions.
 */

class AccordionMetadataManager {
  constructor() {
    this.lastAnalysisTime = null;
    this.lastWorkspaceUpdate = null;
    this.lastActionsUpdate = null;
  }

  /**
   * Initialize metadata updates for all accordions
   */
  async initialize() {
    console.log('Initializing accordion metadata...');
    
    // Update all metadata sections
    await this.updatePrioritiesMetadata();
    await this.updateWorkspaceMetadata();
    await this.updateActionsMetadata();
    
    // Set up periodic updates for relative time displays
    this.startPeriodicUpdates();
  }

  /**
   * Update metadata for the Priorities accordion
   */
  async updatePrioritiesMetadata() {
    try {
      // Get current analysis data
      const isCustomRole = !!window.__CUSTOM_ROLE_NAME__;
      const analysisUrl = isCustomRole 
        ? `/api/custom_role/analysis_latest?role_name=${encodeURIComponent(window.__CUSTOM_ROLE_NAME__)}`
        : '/api/analysis_latest';
      
      const response = await fetch(analysisUrl);
      
      if (response.ok) {
        const data = await response.json();
        this.renderPrioritiesMetadata(data);
      } else {
        this.renderEmptyPrioritiesMetadata();
      }
    } catch (error) {
      console.error('Error updating priorities metadata:', error);
      this.renderEmptyPrioritiesMetadata();
    }
  }

  /**
   * Render priorities metadata in the UI
   */
  renderPrioritiesMetadata(data) {
    if (!data || !data.analysis) {
      this.renderEmptyPrioritiesMetadata();
      return;
    }

    const analysis = data.analysis;
    let totalCount = 0;
    const categories = new Set();

    // Count priorities and extract categories
    if (analysis.short_term && analysis.short_term.prioritized_issues) {
      totalCount += Math.min(analysis.short_term.prioritized_issues.length, 3);
      analysis.short_term.prioritized_issues.slice(0, 3).forEach(p => {
        const category = this.extractCategory(p);
        if (category) categories.add(category);
      });
    }

    if (analysis.long_term && analysis.long_term.prioritized_issues) {
      totalCount += Math.min(analysis.long_term.prioritized_issues.length, 3);
      analysis.long_term.prioritized_issues.slice(0, 3).forEach(p => {
        const category = this.extractCategory(p);
        if (category) categories.add(category);
      });
    }

    // Update priority count
    const countEl = document.getElementById('priority-count');
    if (countEl) {
      countEl.textContent = `${totalCount} priorit${totalCount === 1 ? 'y' : 'ies'}`;
    }

    // Update last analyzed time
    if (data.created_ts) {
      this.lastAnalysisTime = new Date(data.created_ts);
      this.updateLastAnalyzedDisplay();
    } else {
      this.lastAnalysisTime = null;
      this.updateLastAnalyzedDisplay();
    }

    // Update status dot
    const statusDot = document.getElementById('priorities-status-dot');
    if (statusDot) {
      statusDot.className = 'status-dot';
      if (totalCount > 0) {
        const age = this.lastAnalysisTime ? Date.now() - this.lastAnalysisTime : Infinity;
        const hoursSinceAnalysis = age / (1000 * 60 * 60);
        
        if (hoursSinceAnalysis < 24) {
          statusDot.classList.add('fresh');
        } else if (hoursSinceAnalysis < 168) { // 7 days
          statusDot.classList.add('stale');
        } else {
          statusDot.classList.add('empty');
        }
      } else {
        statusDot.classList.add('empty');
      }
    }

    // Update categories
    const categoriesEl = document.getElementById('priority-categories');
    if (categoriesEl) {
      const categoryArray = Array.from(categories).slice(0, 3);
      categoriesEl.innerHTML = categoryArray.map(cat => 
        `<span class="category-tag ${cat.toLowerCase()}">${cat}</span>`
      ).join('');
    }
  }

  /**
   * Render empty state for priorities metadata
   */
  renderEmptyPrioritiesMetadata() {
    const countEl = document.getElementById('priority-count');
    if (countEl) countEl.textContent = '0 priorities';

    const lastAnalyzedEl = document.getElementById('last-analyzed-mini');
    if (lastAnalyzedEl) lastAnalyzedEl.textContent = 'No analysis yet';

    const statusDot = document.getElementById('priorities-status-dot');
    if (statusDot) {
      statusDot.className = 'status-dot empty';
    }

    const categoriesEl = document.getElementById('priority-categories');
    if (categoriesEl) categoriesEl.innerHTML = '';
  }

  /**
   * Extract category from priority data
   */
  extractCategory(priority) {
    if (!priority) return 'General';
    
    const text = `${priority.title || ''} ${priority.why || ''} ${JSON.stringify(priority.evidence || {})}`.toLowerCase();
    
    if (/(roas|ctr|cvr|campaign|creative|paid|social|display|email|marketing|ad)/.test(text)) {
      return 'Marketing';
    } else if (/(lcp|fid|cls|perf|core web|web vitals|latency|page|performance|speed)/.test(text)) {
      return 'Performance';
    } else if (/(checkout|payment|decline|gateway|failure|cart)/.test(text)) {
      return 'Checkout';
    } else if (/(search|zero result|query|seo)/.test(text)) {
      return 'Search';
    } else if (/(return|rma|refund)/.test(text)) {
      return 'Returns';
    } else if (/(sku|inventory|merch|pdp|plp|product)/.test(text)) {
      return 'Merchandising';
    }
    
    return 'General';
  }

  /**
   * Update metadata for the Workspace accordion
   */
  async updateWorkspaceMetadata() {
    try {
      const response = await fetch('/api/priority-insights/saved');
      
      if (response.ok) {
        const data = await response.json();
        const analyses = data.saved || data.analyses || [];
        this.renderWorkspaceMetadata(analyses);
      } else {
        this.renderEmptyWorkspaceMetadata();
      }
    } catch (error) {
      console.error('Error updating workspace metadata:', error);
      this.renderEmptyWorkspaceMetadata();
    }
  }

  /**
   * Render workspace metadata in the UI
   */
  renderWorkspaceMetadata(analyses) {
    const totalCount = analyses.length;
    let insightsCount = 0;
    let actionsCount = 0;
    let notesCount = 0;
    let latestUpdate = null;

    analyses.forEach(analysis => {
      if (analysis.insights_content) insightsCount++;
      
      if (analysis.actions_data) {
        try {
          const actions = JSON.parse(analysis.actions_data);
          actionsCount += actions.length;
        } catch (e) {}
      }
      
      if (analysis.notes_data) {
        try {
          const notes = JSON.parse(analysis.notes_data);
          notesCount += notes.length;
        } catch (e) {}
      }

      const updateTime = new Date(analysis.updated_ts || analysis.created_ts);
      if (!latestUpdate || updateTime > latestUpdate) {
        latestUpdate = updateTime;
      }
    });

    // Update workspace count
    const countEl = document.getElementById('workspace-count');
    if (countEl) {
      countEl.textContent = `${totalCount} saved`;
    }

    // Update insights count
    const insightsEl = document.getElementById('insights-count');
    if (insightsEl) {
      insightsEl.textContent = `${insightsCount} with insights`;
    }

    // Update notes total
    const notesEl = document.getElementById('workspace-notes-total');
    if (notesEl) {
      notesEl.textContent = `${notesCount} note${notesCount === 1 ? '' : 's'}`;
    }

    // Update last activity
    this.lastWorkspaceUpdate = latestUpdate;
    this.updateWorkspaceActivityDisplay();
  }

  /**
   * Render empty state for workspace metadata
   */
  renderEmptyWorkspaceMetadata() {
    const countEl = document.getElementById('workspace-count');
    if (countEl) countEl.textContent = '0 saved';

    const insightsEl = document.getElementById('insights-count');
    if (insightsEl) insightsEl.textContent = '0 with insights';

    const notesEl = document.getElementById('workspace-notes-total');
    if (notesEl) notesEl.textContent = '0 notes';

    const activityEl = document.getElementById('workspace-last-activity');
    if (activityEl) activityEl.textContent = 'Never updated';
  }

  /**
   * Update metadata for the Saved Actions accordion
   */
  async updateActionsMetadata() {
    try {
      const response = await fetch('/api/actions/saved');
      
      if (response.ok) {
        const data = await response.json();
        const actionsByPriority = data.actions_by_priority || {};
        this.renderActionsMetadata(actionsByPriority);
      } else {
        this.renderEmptyActionsMetadata();
      }
    } catch (error) {
      console.error('Error updating actions metadata:', error);
      this.renderEmptyActionsMetadata();
    }
  }

  /**
   * Render actions metadata in the UI
   */
  renderActionsMetadata(actionsByPriority) {
    const allActions = [];
    Object.values(actionsByPriority).forEach(actions => {
      allActions.push(...actions);
    });

    const totalCount = allActions.length;
    let pendingCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let urgentCount = 0;
    let latestUpdate = null;

    allActions.forEach(action => {
      const status = (action.status || 'pending').toLowerCase();
      
      if (status === 'pending') pendingCount++;
      else if (status === 'in-progress' || status === 'in_progress') inProgressCount++;
      else if (status === 'completed' || status === 'done') completedCount++;

      if (action.priority_level === 1 || action.priority_level === 'high') {
        urgentCount++;
      }

      const updateTime = new Date(action.updated_ts || action.saved_ts || action.created_ts);
      if (!latestUpdate || updateTime > latestUpdate) {
        latestUpdate = updateTime;
      }
    });

    // Update total count
    const countEl = document.getElementById('total-actions-count');
    if (countEl) {
      countEl.textContent = `${totalCount} action${totalCount === 1 ? '' : 's'}`;
    }

    // Update urgent actions (only show if > 0)
    const urgentBadge = document.getElementById('urgent-actions-badge');
    const urgentEl = document.getElementById('urgent-actions');
    if (urgentCount > 0) {
      if (urgentBadge) urgentBadge.style.display = '';
      if (urgentEl) urgentEl.textContent = `${urgentCount} urgent`;
    } else {
      if (urgentBadge) urgentBadge.style.display = 'none';
    }

    // Update status breakdown text
    const statusTextEl = document.getElementById('status-text-content');
    if (statusTextEl) {
      statusTextEl.textContent = `${pendingCount} pending · ${inProgressCount} in-progress · ${completedCount} done`;
    }

    // Update status bar (only show if there are actions)
    const statusBar = document.getElementById('actions-status-bar');
    if (totalCount > 0 && statusBar) {
      statusBar.style.display = 'inline-flex';
      
      const pendingBar = document.getElementById('status-pending-bar');
      const progressBar = document.getElementById('status-progress-bar');
      const completedBar = document.getElementById('status-completed-bar');
      
      const pendingPct = (pendingCount / totalCount) * 100;
      const progressPct = (inProgressCount / totalCount) * 100;
      const completedPct = (completedCount / totalCount) * 100;
      
      if (pendingBar) pendingBar.style.width = `${pendingPct}%`;
      if (progressBar) progressBar.style.width = `${progressPct}%`;
      if (completedBar) completedBar.style.width = `${completedPct}%`;
    } else if (statusBar) {
      statusBar.style.display = 'none';
    }

    // Update last update time
    this.lastActionsUpdate = latestUpdate;
    this.updateActionsUpdateDisplay();
  }

  /**
   * Render empty state for actions metadata
   */
  renderEmptyActionsMetadata() {
    const countEl = document.getElementById('total-actions-count');
    if (countEl) countEl.textContent = '0 actions';

    const urgentBadge = document.getElementById('urgent-actions-badge');
    if (urgentBadge) urgentBadge.style.display = 'none';

    const statusBar = document.getElementById('actions-status-bar');
    if (statusBar) statusBar.style.display = 'none';

    const statusTextEl = document.getElementById('status-text-content');
    if (statusTextEl) statusTextEl.textContent = '0 pending · 0 in-progress · 0 done';

    const updateEl = document.getElementById('actions-last-update');
    if (updateEl) updateEl.textContent = 'Never updated';
  }

  /**
   * Format relative time (e.g., "2 hours ago", "3 days ago")
   */
  formatRelativeTime(date) {
    if (!date) return 'Never';
    
    const now = Date.now();
    const then = date.getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  }

  /**
   * Update the "last analyzed" display with relative time
   */
  updateLastAnalyzedDisplay() {
    const el = document.getElementById('last-analyzed-mini');
    if (el) {
      if (this.lastAnalysisTime) {
        el.textContent = `Updated ${this.formatRelativeTime(this.lastAnalysisTime)}`;
      } else {
        el.textContent = 'No analysis yet';
      }
    }
  }

  /**
   * Update the "last activity" display for workspace
   */
  updateWorkspaceActivityDisplay() {
    const el = document.getElementById('workspace-last-activity');
    if (el) {
      if (this.lastWorkspaceUpdate) {
        el.textContent = `Updated ${this.formatRelativeTime(this.lastWorkspaceUpdate)}`;
      } else {
        el.textContent = 'Never updated';
      }
    }
  }

  /**
   * Update the "last update" display for actions
   */
  updateActionsUpdateDisplay() {
    const el = document.getElementById('actions-last-update');
    if (el) {
      if (this.lastActionsUpdate) {
        el.textContent = `Updated ${this.formatRelativeTime(this.lastActionsUpdate)}`;
      } else {
        el.textContent = 'Never updated';
      }
    }
  }

  /**
   * Start periodic updates for relative time displays
   */
  startPeriodicUpdates() {
    // Update relative times every minute
    setInterval(() => {
      this.updateLastAnalyzedDisplay();
      this.updateWorkspaceActivityDisplay();
      this.updateActionsUpdateDisplay();
    }, 60000); // 60 seconds
  }

  /**
   * Refresh all metadata (call this after any data changes)
   */
  async refresh() {
    await this.updatePrioritiesMetadata();
    await this.updateWorkspaceMetadata();
    await this.updateActionsMetadata();
  }
}

// Create global instance
window.accordionMetadata = new AccordionMetadataManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.accordionMetadata.initialize();
  });
} else {
  window.accordionMetadata.initialize();
}

