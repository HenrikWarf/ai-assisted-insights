/**
 * KPI Manager Component
 * 
 * Handles enhanced KPI display, editing, deletion, and creation
 * with AI-assisted features.
 */

class KPIManager {
  constructor() {
    this.kpis = [];
    this.isCustomRole = false;
    this.currentRole = null;
  }

  /**
   * Initialize the KPI manager
   */
  async init() {
    await this.loadKPIs();
    this.attachEventListeners();
  }

  /**
   * Load KPIs from the API
   */
  async loadKPIs() {
    try {
      const response = await fetch('/api/kpis');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      this.kpis = data.kpis || [];
      this.isCustomRole = data.is_custom_role;
      
      console.log('Loaded KPIs:', this.kpis);
    } catch (error) {
      console.error('Error loading KPIs:', error);
      if (window.showNotification) {
        showNotification('Failed to load KPIs', 'error');
      }
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Add KPI button
    const addBtn = document.getElementById('btn-add-kpi');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddKPIModal());
    }
  }

  /**
   * Render enhanced KPI cards
   * @param {Object} metrics - Metrics data containing KPI values
   * @param {Object} plan - Plan data containing KPI definitions
   */
  renderEnhancedKPICards(metrics, plan) {
    const container = document.getElementById('kpi-grid');
    if (!container) return;

    container.innerHTML = '';

    // Get KPI definitions from plan
    const kpiDefinitions = plan?.kpis || [];
    
    if (kpiDefinitions.length === 0) {
      container.innerHTML = `
        <div class="no-kpis-message">
          <p>No KPIs defined yet.</p>
          ${this.isCustomRole ? '<button class="btn btn-primary" id="add-first-kpi">Add Your First KPI</button>' : ''}
        </div>
      `;
      
      if (this.isCustomRole) {
        document.getElementById('add-first-kpi')?.addEventListener('click', () => this.openAddKPIModal());
      }
      return;
    }

    // Render each KPI
    kpiDefinitions.forEach(kpiDef => {
      const kpiKey = `kpi_${kpiDef.id}`;
      const kpiData = metrics[kpiKey];
      
      if (kpiData && typeof kpiData === 'object') {
        const card = this.createEnhancedKPICard(kpiDef, kpiData);
        container.appendChild(card);
      }
    });
  }

  /**
   * Create an enhanced KPI card with expandable details
   * @param {Object} kpiDef - KPI definition with id, title, description, formula
   * @param {Object} kpiData - KPI data with current value
   * @returns {HTMLElement} KPI card element
   */
  createEnhancedKPICard(kpiDef, kpiData) {
    const card = document.createElement('div');
    card.className = 'kpi-card enhanced';
    card.setAttribute('data-kpi-id', kpiDef.id);

    // Extract value and format
    const value = Object.values(kpiData)[0];
    const changePct = kpiData.change_pct;
    
    // Determine format type
    let formatType = 'number';
    let unit = '';
    const title = kpiDef.title.toLowerCase();
    
    // Check if SQL already calculates percentage (contains "* 100" in formula)
    const sqlCalculatesPercentage = kpiDef.formula && kpiDef.formula.includes('* 100');
    
    if (title.includes('rate') || title.includes('percent') || title.includes('%')) {
      if (sqlCalculatesPercentage) {
        // SQL already multiplied by 100, just add % symbol
        formatType = 'decimal';
        unit = '%';
      } else {
        // SQL returns decimal (0.4647), need to multiply by 100
        formatType = 'percentage';
      }
    } else if (title.includes('value') || title.includes('revenue') || title.includes('sales') || title.includes('profit')) {
      formatType = 'currency';
    } else if (title.includes('days') || title.includes('time')) {
      formatType = 'decimal';
      unit = ' days';
    }

    const formattedValue = formatNumber(value, formatType) + unit;
    const trendText = changePct !== undefined && changePct !== null ? 
      `${changePct > 0 ? '↗' : '↘'} ${Math.abs(changePct).toFixed(1)}% vs last period` : '';

    card.innerHTML = `
      <div class="kpi-card-header">
        <div class="kpi-card-main">
           <div class="kpi-title-row">
             <h3 class="kpi-title">${escapeHtml(kpiDef.title)}</h3>
             <div class="kpi-actions-group">
               ${this.isCustomRole ? `
                 <button class="btn-icon" title="Edit KPI" data-action="edit">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                     <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                     <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                   </svg>
                 </button>
               ` : ''}
               <button class="kpi-expand-btn" title="Show details">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <polyline points="6 9 12 15 18 9"></polyline>
                 </svg>
               </button>
             </div>
           </div>
          <div class="kpi-value">${formattedValue}</div>
          ${trendText ? `<div class="kpi-trend ${changePct >= 0 ? 'trend-up' : 'trend-down'}">${trendText}</div>` : ''}
          <p class="kpi-description">${escapeHtml(kpiDef.description || 'No description available')}</p>
        </div>
      </div>
      
      <div class="kpi-details" style="display: none;">
        <div class="kpi-detail-section">
          <h4>Calculation Details</h4>
          <div class="kpi-detail-item">
            <span class="label">Table:</span>
            <span class="value"><code>${escapeHtml(kpiDef.table || 'N/A')}</code></span>
          </div>
          <div class="kpi-detail-item">
            <span class="label">Current Value:</span>
            <span class="value">${formattedValue}</span>
          </div>
        </div>
        
        <div class="kpi-detail-section">
          <h4>SQL Query</h4>
          <div class="sql-container">
            <pre><code class="sql-query">${escapeHtml(kpiDef.formula || 'No formula available')}</code></pre>
            <button class="btn-copy-sql" title="Copy SQL">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="kpi-detail-section">
          <button class="btn btn-secondary btn-analyze-columns">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            </svg>
            Show Columns Used
          </button>
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachCardEventListeners(card, kpiDef);

    return card;
  }

  /**
   * Attach event listeners to a KPI card
   * @param {HTMLElement} card - KPI card element
   * @param {Object} kpiDef - KPI definition
   */
  attachCardEventListeners(card, kpiDef) {
    // Expand/collapse button
    const expandBtn = card.querySelector('.kpi-expand-btn');
    const detailsSection = card.querySelector('.kpi-details');
    
    expandBtn?.addEventListener('click', () => {
      const isExpanded = detailsSection.style.display === 'block';
      detailsSection.style.display = isExpanded ? 'none' : 'block';
      expandBtn.classList.toggle('expanded', !isExpanded);
    });

    // Copy SQL button
    const copySQLBtn = card.querySelector('.btn-copy-sql');
    copySQLBtn?.addEventListener('click', () => {
      navigator.clipboard.writeText(kpiDef.formula);
      if (window.showNotification) {
        showNotification('SQL copied to clipboard', 'success');
      }
    });

    // Analyze columns button
    const analyzeBtn = card.querySelector('.btn-analyze-columns');
    analyzeBtn?.addEventListener('click', async () => {
      await this.showKPIColumns(kpiDef.id);
    });

    // Edit button
    const editBtn = card.querySelector('[data-action="edit"]');
    editBtn?.addEventListener('click', () => {
      this.openEditKPIModal(kpiDef);
    });
  }

  /**
   * Show columns used in a KPI
   * @param {string} kpiId - KPI ID
   */
  async showKPIColumns(kpiId) {
    try {
      const response = await fetch(`/api/kpis/${kpiId}/columns`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      const message = `
        <div class="kpi-columns-info">
          <h4>Columns Used:</h4>
          <ul>
            ${data.columns.map(col => `<li><code>${escapeHtml(col)}</code></li>`).join('')}
          </ul>
          
          ${data.aggregations.length > 0 ? `
            <h4>Aggregations:</h4>
            <ul>
              ${data.aggregations.map(agg => `<li><strong>${agg}</strong></li>`).join('')}
            </ul>
          ` : ''}
          
          <p class="meta-info">Table: <code>${escapeHtml(data.table)}</code></p>
        </div>
      `;
      
      if (window.showModal) {
        showModal('KPI Column Analysis', message);
      } else {
        alert(message.replace(/<[^>]*>/g, ' '));
      }
    } catch (error) {
      console.error('Error fetching KPI columns:', error);
      if (window.showNotification) {
        showNotification('Failed to analyze KPI columns', 'error');
      }
    }
  }

  /**
   * Open the Edit KPI modal
   * @param {Object} kpiDef - KPI definition
   */
  openEditKPIModal(kpiDef) {
    const modal = document.getElementById('kpi-edit-modal') || this.createEditModal();
    
    // Populate modal with KPI data
    document.getElementById('edit-kpi-id').value = kpiDef.id;
    document.getElementById('edit-kpi-title').value = kpiDef.title;
    document.getElementById('edit-kpi-description').value = kpiDef.description;
    document.getElementById('edit-kpi-formula').value = kpiDef.formula;
    document.getElementById('edit-kpi-table').value = kpiDef.table;
    
    // Show modal
    modal.style.display = 'flex';
  }

  /**
   * Open the Add KPI modal
   */
  openAddKPIModal() {
    const modal = document.getElementById('kpi-add-modal') || this.createAddModal();
    
    // Clear form
    document.getElementById('add-kpi-id').value = '';
    document.getElementById('add-kpi-title').value = '';
    document.getElementById('add-kpi-description').value = '';
    document.getElementById('add-kpi-formula').value = '';
    document.getElementById('add-kpi-table').value = '';
    
    // Show modal
    modal.style.display = 'flex';
  }

  /**
   * Create the Edit KPI modal
   * @returns {HTMLElement} Modal element
   */
  createEditModal() {
    const modal = document.createElement('div');
    modal.id = 'kpi-edit-modal';
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content large">
        <div class="modal-header">
          <h2>Edit KPI</h2>
          <button class="modal-close" data-modal="kpi-edit-modal">&times;</button>
        </div>
        
        <div class="modal-body">
          <form id="edit-kpi-form">
            <input type="hidden" id="edit-kpi-id">
            
            <div class="form-group">
              <label for="edit-kpi-title">Title</label>
              <input type="text" id="edit-kpi-title" class="form-control" required>
            </div>
            
            <div class="form-group">
              <label for="edit-kpi-description">Description</label>
              <textarea id="edit-kpi-description" class="form-control" rows="3" required></textarea>
            </div>
            
            <div class="form-group">
              <label for="edit-kpi-table">Table</label>
              <input type="text" id="edit-kpi-table" class="form-control" required>
            </div>
            
            <div class="form-group">
              <label for="edit-kpi-formula">SQL Formula</label>
              <textarea id="edit-kpi-formula" class="form-control sql-editor" rows="6" required></textarea>
              <small class="form-text">Complete SQLite SELECT statement</small>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" id="btn-test-kpi">Test Query</button>
              <button type="button" class="btn btn-secondary" id="btn-improve-kpi">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
                Ask Gemini to Improve
              </button>
            </div>
            
            <div id="kpi-test-result" style="display: none;"></div>
          </form>
        </div>
        
         <div class="modal-footer">
           <button type="button" class="btn btn-danger" id="btn-delete-kpi" style="margin-right: auto;">Delete KPI</button>
           <button type="button" class="btn btn-secondary" data-modal="kpi-edit-modal">Cancel</button>
           <button type="button" class="btn btn-primary" id="btn-save-kpi">Save Changes</button>
         </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Attach event listeners
    this.attachEditModalListeners(modal);
    
    return modal;
  }

  /**
   * Create the Add KPI modal
   * @returns {HTMLElement} Modal element
   */
  createAddModal() {
    const modal = document.createElement('div');
    modal.id = 'kpi-add-modal';
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content large">
        <div class="modal-header">
          <h2>Add New KPI</h2>
          <button class="modal-close" data-modal="kpi-add-modal">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="add-kpi-tabs">
            <button class="tab-btn active" data-tab="manual">Manual Entry</button>
            <button class="tab-btn" data-tab="ai">AI-Assisted</button>
          </div>
          
          <div class="tab-content active" id="tab-manual">
            <form id="add-kpi-form-manual">
              <div class="form-group">
                <label for="add-kpi-id">ID (unique identifier)</label>
                <input type="text" id="add-kpi-id" class="form-control" required>
                <small class="form-text">Use snake_case, e.g., total_revenue</small>
              </div>
              
              <div class="form-group">
                <label for="add-kpi-title">Title</label>
                <input type="text" id="add-kpi-title" class="form-control" required>
              </div>
              
              <div class="form-group">
                <label for="add-kpi-description">Description</label>
                <textarea id="add-kpi-description" class="form-control" rows="3" required></textarea>
              </div>
              
              <div class="form-group">
                <label for="add-kpi-table">Table</label>
                <input type="text" id="add-kpi-table" class="form-control" required>
              </div>
              
              <div class="form-group">
                <label for="add-kpi-formula">SQL Formula</label>
                <textarea id="add-kpi-formula" class="form-control sql-editor" rows="6" required></textarea>
                <small class="form-text">Complete SQLite SELECT statement</small>
              </div>
              
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="btn-test-new-kpi">Test Query</button>
              </div>
              
              <div id="add-kpi-test-result" style="display: none;"></div>
            </form>
          </div>
          
          <div class="tab-content" id="tab-ai">
            <form id="add-kpi-form-ai">
              <div class="form-group">
                <label for="ai-kpi-description">Describe the KPI you want to create</label>
                <textarea id="ai-kpi-description" class="form-control" rows="4" 
                  placeholder="E.g., 'Total year-to-date sales' or 'Average customer lifetime value'"></textarea>
                <small class="form-text">Be specific about what you want to measure</small>
              </div>
              
              <button type="button" class="btn btn-primary" id="btn-generate-kpi">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
                Generate KPI with AI
              </button>
              
              <div id="ai-generated-kpi" style="display: none;">
                <h4>Generated KPI</h4>
                <pre id="ai-kpi-preview"></pre>
                <button type="button" class="btn btn-primary" id="btn-use-generated-kpi">Use This KPI</button>
              </div>
            </form>
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-modal="kpi-add-modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-create-kpi">Create KPI</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Attach event listeners
    this.attachAddModalListeners(modal);
    
    return modal;
  }

  /**
   * Attach event listeners to Edit modal
   * @param {HTMLElement} modal - Modal element
   */
  attachEditModalListeners(modal) {
    // Close buttons (both X and Cancel)
    const closeButtons = modal.querySelectorAll('[data-modal="kpi-edit-modal"], .modal-close');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    });

    // Test KPI button
    document.getElementById('btn-test-kpi')?.addEventListener('click', async () => {
      await this.testKPIFormula(document.getElementById('edit-kpi-formula').value, 'kpi-test-result');
    });

    // Improve with AI button
    document.getElementById('btn-improve-kpi')?.addEventListener('click', async () => {
      await this.improveKPIWithAI();
    });

    // Save button
    document.getElementById('btn-save-kpi')?.addEventListener('click', async () => {
      await this.saveKPIChanges();
    });

    // Delete button
    document.getElementById('btn-delete-kpi')?.addEventListener('click', async () => {
      const kpiId = document.getElementById('edit-kpi-id').value;
      const kpiTitle = document.getElementById('edit-kpi-title').value;
      await this.deleteKPI(kpiId, kpiTitle);
      // Close modal after deletion
      modal.style.display = 'none';
    });
  }

  /**
   * Attach event listeners to Add modal
   * @param {HTMLElement} modal - Modal element
   */
  attachAddModalListeners(modal) {
    // Close button
    const closeBtn = modal.querySelector('[data-modal="kpi-add-modal"]');
    closeBtn?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.querySelector('.modal-close')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // Tab switching
    const tabButtons = modal.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        
        // Update active tab button
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active tab content
        modal.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        modal.querySelector(`#tab-${tabName}`).classList.add('active');
      });
    });

    // Test new KPI button
    document.getElementById('btn-test-new-kpi')?.addEventListener('click', async () => {
      await this.testKPIFormula(document.getElementById('add-kpi-formula').value, 'add-kpi-test-result');
    });

    // Generate KPI with AI button
    document.getElementById('btn-generate-kpi')?.addEventListener('click', async () => {
      await this.generateKPIWithAI();
    });

    // Use generated KPI button
    document.getElementById('btn-use-generated-kpi')?.addEventListener('click', () => {
      this.useGeneratedKPI();
    });

    // Create KPI button
    document.getElementById('btn-create-kpi')?.addEventListener('click', async () => {
      await this.createNewKPI();
    });
  }

  /**
   * Test a KPI formula
   * @param {string} formula - SQL formula to test
   * @param {string} resultContainerId - ID of result container
   */
  async testKPIFormula(formula, resultContainerId) {
    const resultContainer = document.getElementById(resultContainerId);
    if (!resultContainer) return;

    try {
      const response = await fetch('/api/kpis/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formula })
      });

      const data = await response.json();

      if (data.success) {
        resultContainer.innerHTML = `
          <div class="test-result success">
            <h4>✓ Query Successful</h4>
            <p>Result: <strong>${data.value !== null ? data.value : 'NULL'}</strong></p>
            <pre>${JSON.stringify(data.result, null, 2)}</pre>
          </div>
        `;
      } else {
        resultContainer.innerHTML = `
          <div class="test-result error">
            <h4>✗ Query Failed</h4>
            <p>${escapeHtml(data.error)}</p>
          </div>
        `;
      }
      
      resultContainer.style.display = 'block';
    } catch (error) {
      console.error('Error testing KPI:', error);
      resultContainer.innerHTML = `
        <div class="test-result error">
          <h4>✗ Error</h4>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
      resultContainer.style.display = 'block';
    }
  }

  /**
   * Improve KPI with AI
   */
  async improveKPIWithAI() {
    const kpiId = document.getElementById('edit-kpi-id').value;
    const request = prompt('How would you like to improve this KPI?', 'Make it more accurate and useful');
    
    if (!request) return;

    try {
      if (window.showNotification) {
        showNotification('Asking Gemini to improve KPI...', 'info');
      }

      const response = await fetch(`/api/kpis/${kpiId}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const improved = data.kpi;

      // Update form fields
      document.getElementById('edit-kpi-title').value = improved.title;
      document.getElementById('edit-kpi-description').value = improved.description;
      document.getElementById('edit-kpi-formula').value = improved.formula;
      document.getElementById('edit-kpi-table').value = improved.table;

      if (window.showNotification) {
        showNotification('KPI improved! Review and save changes.', 'success');
      }
    } catch (error) {
      console.error('Error improving KPI:', error);
      if (window.showNotification) {
        showNotification('Failed to improve KPI', 'error');
      }
    }
  }

  /**
   * Save KPI changes
   */
  async saveKPIChanges() {
    const kpiId = document.getElementById('edit-kpi-id').value;
    const kpiData = {
      title: document.getElementById('edit-kpi-title').value,
      description: document.getElementById('edit-kpi-description').value,
      formula: document.getElementById('edit-kpi-formula').value,
      table: document.getElementById('edit-kpi-table').value
    };

    console.log('[KPI Manager] Saving KPI:', kpiId, kpiData);

    try {
      const url = `/api/kpis/${kpiId}`;
      console.log('[KPI Manager] PUT request to:', url);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kpiData)
      });

      console.log('[KPI Manager] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[KPI Manager] Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[KPI Manager] Success:', result);

      if (window.showNotification) {
        showNotification('KPI updated successfully!', 'success');
      }

      // Close modal
      document.getElementById('kpi-edit-modal').style.display = 'none';

      // Reload metrics
      if (window.loadMetrics) {
        await loadMetrics();
      }
    } catch (error) {
      console.error('[KPI Manager] Error saving KPI:', error);
      if (window.showNotification) {
        showNotification(`Failed to save KPI: ${error.message}`, 'error');
      }
    }
  }

  /**
   * Delete a KPI
   * @param {string} kpiId - KPI ID
   * @param {string} kpiTitle - KPI title for confirmation
   */
  async deleteKPI(kpiId, kpiTitle) {
    if (!confirm(`Are you sure you want to delete "${kpiTitle}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/kpis/${kpiId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      if (window.showNotification) {
        showNotification('KPI deleted successfully!', 'success');
      }

      // Reload metrics
      if (window.loadMetrics) {
        await loadMetrics();
      }
    } catch (error) {
      console.error('Error deleting KPI:', error);
      if (window.showNotification) {
        showNotification('Failed to delete KPI', 'error');
      }
    }
  }

  /**
   * Generate KPI with AI
   */
  async generateKPIWithAI() {
    const description = document.getElementById('ai-kpi-description').value.trim();
    
    if (!description) {
      if (window.showNotification) {
        showNotification('Please describe the KPI you want to create', 'warning');
      }
      return;
    }

    try {
      if (window.showNotification) {
        showNotification('Generating KPI with AI...', 'info');
      }

      const response = await fetch('/api/kpis/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      
      // Store generated KPI
      this.generatedKPI = data.kpi;

      // Display generated KPI
      const previewContainer = document.getElementById('ai-kpi-preview');
      previewContainer.textContent = JSON.stringify(data.kpi, null, 2);

      const generatedSection = document.getElementById('ai-generated-kpi');
      generatedSection.style.display = 'block';

      if (window.showNotification) {
        showNotification('KPI generated successfully!', 'success');
      }
    } catch (error) {
      console.error('Error generating KPI:', error);
      if (window.showNotification) {
        showNotification('Failed to generate KPI', 'error');
      }
    }
  }

  /**
   * Use the generated KPI (copy to manual form)
   */
  useGeneratedKPI() {
    if (!this.generatedKPI) return;

    // Switch to manual tab
    document.querySelector('.tab-btn[data-tab="manual"]').click();

    // Populate manual form
    document.getElementById('add-kpi-id').value = this.generatedKPI.id;
    document.getElementById('add-kpi-title').value = this.generatedKPI.title;
    document.getElementById('add-kpi-description').value = this.generatedKPI.description;
    document.getElementById('add-kpi-formula').value = this.generatedKPI.formula;
    document.getElementById('add-kpi-table').value = this.generatedKPI.table;

    if (window.showNotification) {
      showNotification('Generated KPI copied to form. Review and create.', 'info');
    }
  }

  /**
   * Create a new KPI
   */
  async createNewKPI() {
    const kpiData = {
      id: document.getElementById('add-kpi-id').value.trim(),
      title: document.getElementById('add-kpi-title').value.trim(),
      description: document.getElementById('add-kpi-description').value.trim(),
      formula: document.getElementById('add-kpi-formula').value.trim(),
      table: document.getElementById('add-kpi-table').value.trim()
    };

    // Validate
    if (!kpiData.id || !kpiData.title || !kpiData.description || !kpiData.formula || !kpiData.table) {
      if (window.showNotification) {
        showNotification('Please fill in all fields', 'warning');
      }
      return;
    }

    try {
      const response = await fetch('/api/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kpiData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      if (window.showNotification) {
        showNotification('KPI created successfully!', 'success');
      }

      // Close modal
      document.getElementById('kpi-add-modal').style.display = 'none';

      // Reload metrics
      if (window.loadMetrics) {
        await loadMetrics();
      }
    } catch (error) {
      console.error('Error creating KPI:', error);
      if (window.showNotification) {
        showNotification(`Failed to create KPI: ${error.message}`, 'error');
      }
    }
  }
}

// Export for use in dashboard
window.KPIManager = KPIManager;

