/**
 * Priority Explore & Act Modal Component
 * 
 * This module handles the modal interface for exploring priorities
 * and managing insights, notes, and actions.
 */

class PriorityExploreModal {
    constructor() {
        this.modal = null;
        this.currentPriority = null;
        this.isLoading = false;
        this.actionsMap = new Map();
        this.init();
    }

    formatPriorityDescription(priority) {
        const text = priority.why || '';
        const replacements = {
            aov_by_segment: priority.aov_by_segment,
            ltv_by_source: priority.ltv_by_source,
            channel_volume_mismatch: priority.channel_volume_mismatch
        };
        const tryStringify = (val) => {
            try {
                if (val === undefined || val === null) return '';
                if (typeof val === 'string') return val;
                return JSON.stringify(val, null, 2);
            } catch { return ''; }
        };
        let output = String(text);
        Object.entries(replacements).forEach(([key, val]) => {
            output = output.replace(new RegExp(`${key}:\\s*\\[object Object\\](,\\s*\\[object Object\\])*`, 'g'), `${key}:\n${tryStringify(val)}`);
            output = output.replace(new RegExp(`${key}\\s*=\\s*\\[object Object\\]`, 'g'), `${key} = ${tryStringify(val)}`);
        });
        // Basic escape to prevent HTML injection
        return output.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;')
                     .replace(/\n/g, '<br/>');
    }

    init() {
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        // Create modal HTML
        const modalHTML = `
            <div id="priority-explore-modal" class="modal-overlay" style="display: none;">
                <div class="modal-container priority-modal">
                    <div class="modal-header">
                        <h2 id="modal-title">Explore & Act</h2>
                        <div class="modal-header-actions">
                            <button class="btn btn-primary btn-sm" id="save-priority-btn" title="Save this priority analysis for future reference">
                                💾 Save Analysis
                            </button>
                            <button class="modal-close" id="modal-close-btn">&times;</button>
                        </div>
                    </div>
                    <div class="modal-content">
                        <div class="priority-info" id="priority-info">
                            <!-- Priority details will be loaded here -->
                        </div>
                        
                        <div class="modal-tabs">
                            <button class="tab-btn active" data-tab="insights">🔍 Insights</button>
                            <button class="tab-btn" data-tab="actions">🎯 Actions</button>
                            <button class="tab-btn" data-tab="notes">📝 Notes</button>
                        </div>
                        
                        <div class="tab-panels-container">
                            <!-- Insights Tab -->
                            <div id="tab-insights" class="tab-panel active">
                                <div class="insights-header">
                                    <h3>AI-Generated Insights</h3>
                                    <button class="btn btn-primary" id="generate-insights-btn">
                                        <span class="btn-text">Generate Insights</span>
                                        <span class="btn-loading" style="display: none;">Generating...</span>
                                    </button>
                                </div>
                                <div id="insights-content" class="insights-content">
                                    <div class="empty-state">
                                        <p>Click "Generate Insights" to get AI-powered analysis of this priority with current market data.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Actions Tab -->
                            <div id="tab-actions" class="tab-panel">
                                <div class="actions-header">
                                    <h3>Action Recommendations</h3>
                                    <button class="btn btn-secondary" id="generate-actions-btn">
                                        <span class="btn-text">Generate Actions</span>
                                        <span class="btn-loading" style="display: none;">Generating...</span>
                                    </button>
                                </div>
                                <div id="actions-content" class="actions-content">
                                    <div class="empty-state">
                                        <p>Click "Generate Actions" to get specific recommendations for addressing this priority.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Notes Tab -->
                            <div id="tab-notes" class="tab-panel">
                                <div class="notes-header">
                                    <h3>Your Notes</h3>
                                    <button class="btn btn-primary" id="add-note-btn">Add Note</button>
                                </div>
                                <div id="notes-content" class="notes-content">
                                    <div class="empty-state">
                                        <p>No notes yet. Add your thoughts and observations about this priority.</p>
                                    </div>
                                </div>
                                <div class="add-note-form" id="add-note-form" style="display: none;">
                                    <textarea id="note-textarea" placeholder="Add your note here..."></textarea>
                                    <div class="form-actions">
                                        <button class="btn btn-primary" id="save-note-btn">Save Note</button>
                                        <button class="btn btn-secondary" id="cancel-note-btn">Cancel</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
        <div class="modal-footer">
            <button class="btn-delete-subtle" id="clear-data-btn" title="Clear all data for this priority">🗑️ Clear All</button>
            <button class="btn btn-secondary" id="modal-close-footer-btn">Close</button>
        </div>
                    </div>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('priority-explore-modal');
    }

    bindEvents() {
        // Close modal events
        document.getElementById('modal-close-btn').addEventListener('click', () => this.close());
        document.getElementById('modal-close-footer-btn').addEventListener('click', () => this.close());
        document.getElementById('priority-explore-modal').addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Generate insights
        document.getElementById('generate-insights-btn').addEventListener('click', () => this.generateInsights());

        // Generate actions
        document.getElementById('generate-actions-btn').addEventListener('click', () => this.generateActions());

        // Notes functionality
        document.getElementById('add-note-btn').addEventListener('click', () => this.showAddNoteForm());
        document.getElementById('save-note-btn').addEventListener('click', () => this.saveNote());
        document.getElementById('cancel-note-btn').addEventListener('click', () => this.hideAddNoteForm());

        // Clear data
        document.getElementById('clear-data-btn').addEventListener('click', () => this.clearPriorityData());
        
        // Save priority analysis
        document.getElementById('save-priority-btn').addEventListener('click', () => this.savePriorityAnalysis());
    }

    open(priorityData, priorityId, gridType) {
        this.currentPriority = {
            data: priorityData,
            id: priorityId,
            gridType: gridType,
            insights: null // Reset insights when opening
        };

        this.updatePriorityInfo();
        this.loadPriorityData();
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Check save status after a short delay to ensure data is loaded
        setTimeout(() => {
            this.checkAndUpdateSaveStatus();
        }, 500);
    }

    close() {
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
        this.currentPriority = null;
    }

    updatePriorityInfo() {
        const priorityInfo = document.getElementById('priority-info');
        const priority = this.currentPriority.data;
        
        priorityInfo.innerHTML = `
            <div class="priority-card-modal">
                <div class="priority-header-modal">
                    <span class="priority-number-modal">${this.currentPriority.id}</span>
                    <h3 class="priority-title-modal">${escapeHtml(priority.title || 'Untitled Priority')}</h3>
                    <span class="priority-category-modal">${escapeHtml(priority.category || 'general')}</span>
                </div>
                <div class="priority-description-modal">
                    ${this.formatPriorityDescription(priority)}
                </div>
                ${priority.evidence ? this.renderEvidence(priority.evidence) : ''}
            </div>
        `;
    }

    renderEvidence(evidence) {
        const toTable = (items) => {
            if (!Array.isArray(items) || items.length === 0) return '';
            const keys = Array.from(items.reduce((set, item) => {
                Object.keys(item || {}).forEach(k => set.add(k));
                return set;
            }, new Set()));
            const thead = `<thead><tr>${keys.map(k => `<th>${escapeHtml(k)}</th>`).join('')}</tr></thead>`;
            const rows = items.map(it => `<tr>${keys.map(k => `<td>${escapeHtml(String(it?.[k] ?? ''))}</td>`).join('')}</tr>`).join('');
            return `<table class="evidence-table">${thead}<tbody>${rows}</tbody></table>`;
        };
        const toKeyValueTable = (obj) => {
            if (!obj || typeof obj !== 'object') return '';
            const rows = Object.entries(obj).map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v ?? ''))}</td></tr>`).join('');
            return `<table class="evidence-table"><tbody>${rows}</tbody></table>`;
        };
        const isPrimitiveObject = (obj) => {
            if (!obj || typeof obj !== 'object') return false;
            return Object.values(obj).every(v => (v === null) || (typeof v !== 'object'));
        };

        let evidenceHtml = '';
        try {
            const evObj = typeof evidence === 'string' ? JSON.parse(evidence) : evidence;
            if (evObj && typeof evObj === 'object' && !Array.isArray(evObj)) {
                evidenceHtml = Object.entries(evObj).map(([key, value]) => {
                    if (Array.isArray(value) && value.length && typeof value[0] === 'object') {
                        return `
                            <div class="evidence-item-modal">
                                <div><strong>${escapeHtml(key)}:</strong></div>
                                ${toTable(value)}
                            </div>
                        `;
                    }
                    if (isPrimitiveObject(value)) {
                        return `
                            <div class="evidence-item-modal">
                                <div><strong>${escapeHtml(key)}:</strong></div>
                                ${toKeyValueTable(value)}
                            </div>
                        `;
                    }
                    if (value && typeof value === 'object') {
                        return `
                            <div class="evidence-item-modal">
                                <div><strong>${escapeHtml(key)}:</strong></div>
                                <pre class="evidence-pre">${escapeHtml(JSON.stringify(value, null, 2))}</pre>
                            </div>
                        `;
                    }
                    return `<div class="evidence-item-modal"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value ?? ''))}</div>`;
                }).join('');
            } else if (Array.isArray(evObj)) {
                // Generic array of key/value pairs
                evidenceHtml = toTable(evObj);
            } else if (evObj != null) {
                if (isPrimitiveObject(evObj)) {
                    evidenceHtml = toKeyValueTable(evObj);
                } else {
                    evidenceHtml = `<div class="evidence-item-modal"><pre class="evidence-pre">${escapeHtml(JSON.stringify(evObj, null, 2))}</pre></div>`;
                }
            }
        } catch (e) {
            evidenceHtml = `<div class="evidence-item-modal">${escapeHtml(String(evidence))}</div>`;
        }

        return evidenceHtml ? `<div class="priority-evidence-modal">${evidenceHtml}</div>` : '';
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
    }

    async loadPriorityData() {
        this.loadInsights();
        this.loadActions();
        this.loadNotes();
    }

    async loadInsights() {
        console.log('[Priority Modal] Loading insights for:', { 
            priority_id: this.currentPriority.id, 
            grid_type: this.currentPriority.gridType 
        });
        
        // Try to load insights from saved analysis
        try {
            const response = await fetch('/api/priority-insights/saved');
            if (response.ok) {
                const data = await response.json();
                const list = Array.isArray(data.analyses) ? data.analyses : [];
                console.log('[Priority Modal] Found saved analyses:', list.length);
                
                const savedAnalysis = list.find(analysis =>
                    analysis.priority_id === this.currentPriority.id &&
                    analysis.grid_type === this.currentPriority.gridType
                );
                
                console.log('[Priority Modal] Matching analysis:', savedAnalysis ? 'Found' : 'Not found');
                
                if (savedAnalysis) {
                    console.log('[Priority Modal] Analysis has insights:', !!savedAnalysis.insights_content);
                    
                    if (savedAnalysis.insights_content) {
                        // Load saved insights
                        this.currentPriority.insights = {
                            insights_content: savedAnalysis.insights_content,
                            created_ts: savedAnalysis.updated_ts || savedAnalysis.created_ts
                        };
                        this.updateInsightsContent(this.currentPriority.insights);
                        return;
                    }
                }
            } else {
                console.warn('[Priority Modal] Failed to fetch saved analyses:', response.status);
            }
        } catch (error) {
            console.error('[Priority Modal] Error loading saved insights:', error);
        }
        
        // Show empty state if no insights found
        console.log('[Priority Modal] Showing empty state for insights');
        const insightsContent = document.getElementById('insights-content');
        insightsContent.innerHTML = `<div class="empty-state"><p>Click "Generate Insights" to get AI-powered analysis.</p></div>`;
    }

    async loadActions() {
        console.log('[Priority Modal] Loading actions for:', { 
            priority_id: this.currentPriority.id, 
            grid_type: this.currentPriority.gridType 
        });
        
        try {
            const response = await fetch(`/api/priority-insights/proposed-actions?priority_id=${this.currentPriority.id}&grid_type=${this.currentPriority.gridType}`);
            console.log('[Priority Modal] Actions fetch response:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('[Priority Modal] Actions data:', data.actions ? data.actions.length : 0, 'actions');
                this.updateActionsContent(data.actions || []);
            } else {
                console.warn('[Priority Modal] Failed to load actions:', response.status);
                this.showError('actions-content', 'Failed to load actions.');
            }
        } catch (error) {
            console.error('[Priority Modal] Error loading actions:', error);
            this.showError('actions-content', 'Error loading actions.');
        }
    }

    async generateInsights() {
        if (this.isLoading) return;
        
        this.setLoading('generate-insights-btn', true);
        
        try {
            const response = await fetch('/api/priority-insights/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priority_id: this.currentPriority.id,
                    grid_type: this.currentPriority.gridType,
                    priority_data: this.currentPriority.data
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.currentPriority.insights = data.insights; // Store the new insights
                this.updateInsightsContent(data.insights);
                
                // Auto-save insights to the saved analysis if it exists
                await this.saveInsightsToAnalysis(data.insights);
                
                // Switch to insights tab to show the generated content
                this.switchTab('insights');
            } else {
                throw new Error('Failed to generate insights');
            }
        } catch (error) {
            console.error('Error generating insights:', error);
            this.showError('insights-content', 'Failed to generate insights. Please try again.');
        } finally {
            this.setLoading('generate-insights-btn', false);
        }
    }
    
    async saveInsightsToAnalysis(insights) {
        try {
            // Check if this priority is already saved
            const response = await fetch('/api/priority-insights/saved');
            if (!response.ok) return;
            
            const data = await response.json();
            const list = Array.isArray(data.analyses) ? data.analyses : [];
            const savedAnalysis = list.find(analysis =>
                analysis.priority_id === this.currentPriority.id &&
                analysis.grid_type === this.currentPriority.gridType
            );
            
            if (savedAnalysis) {
                // Update the existing saved analysis with insights
                await fetch(`/api/priority-insights/saved/${savedAnalysis.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        insights_content: insights.insights_content
                    })
                });
                
                // Refresh workspace metadata
                if (typeof updateWorkspaceMetadata === 'function') {
                    updateWorkspaceMetadata();
                }
                
                // Refresh saved analyses list
                if (typeof loadSavedAnalyses === 'function') {
                    loadSavedAnalyses();
                }
            }
        } catch (error) {
            console.error('Error saving insights to analysis:', error);
            // Don't show error to user, just log it
        }
    }

    async generateActions() {
        if (this.isLoading) return;
        
        this.setLoading('generate-actions-btn', true);
        
        try {
            const response = await fetch('/api/priority-insights/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priority_id: this.currentPriority.id,
                    grid_type: this.currentPriority.gridType,
                    priority_data: this.currentPriority.data
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Store structured actions for merging
                if (Array.isArray(data.actions_structured)) {
                    window.__LATEST_STRUCTURED_ACTIONS__ = data.actions_structured;
                }
                this.updateActionsContent(data.actions);
                // Reload all data to ensure consistency
                await this.loadPriorityData();
                // Switch to actions tab to show the generated content
                this.switchTab('actions');
                // Check save status after generating actions
                this.checkAndUpdateSaveStatus();
            } else {
                throw new Error('Failed to generate actions');
            }
        } catch (error) {
            console.error('Error generating actions:', error);
            this.showError('actions-content', 'Failed to generate actions. Please try again.');
        } finally {
            this.setLoading('generate-actions-btn', false);
        }
    }

    updateInsightsContent(insights) {
        const content = document.getElementById('insights-content');
        console.log('[Priority Modal] updateInsightsContent called with:', insights ? 'has insights' : 'no insights');
        console.log('[Priority Modal] insights-content element exists:', !!content);
        
        if (!content) {
            console.error('[Priority Modal] insights-content element not found!');
            return;
        }
        
        if (!insights) {
            console.log('[Priority Modal] Rendering empty state for insights');
            content.innerHTML = `
                <div class="empty-state">
                    <p>Click "Generate Insights" to get AI-powered analysis of this priority with current market data.</p>
                </div>
            `;
            return;
        }

        console.log('[Priority Modal] Rendering insights content');
        content.innerHTML = `
            <div class="insights-display">
                <div class="insights-meta">
                    <span class="insights-date">Generated: ${new Date(insights.created_ts).toLocaleString()}</span>
                </div>
                <div class="insights-text">${this.formatInsightsText(insights.insights_content)}</div>
            </div>
        `;
        console.log('[Priority Modal] Insights content rendered, HTML length:', content.innerHTML.length);
    }

    updateActionsContent(actions) {
        const content = document.getElementById('actions-content');
        console.log('[Priority Modal] updateActionsContent called with:', actions ? actions.length + ' actions' : 'no actions');
        console.log('[Priority Modal] actions-content element exists:', !!content);
        
        if (!content) {
            console.error('[Priority Modal] actions-content element not found!');
            return;
        }
        
        this.actionsMap.clear();
        
        if (!actions || actions.length === 0) {
            console.log('[Priority Modal] Rendering empty state for actions');
            content.innerHTML = `
                <div class="empty-state">
                    <p>Click "Generate Actions" to get specific recommendations for addressing this priority.</p>
                </div>
            `;
            return;
        }

        console.log('[Priority Modal] Processing actions for rendering');
        // Merge structured actions into flat list by title (case-insensitive), and embed action_json for Explore
        try {
            actions = actions.map(a => {
                const actionDetails = JSON.parse(a.action_json || '{}');
                // Merge details from action_json into the top-level action object
                return { ...a, ...actionDetails };
            });
        } catch(e) {
            console.error("[Priority Modal] Error parsing action_json:", e);
        }

        const actionsHtml = actions.map(action => {
            // Store the action for later retrieval
            if (action.action_id) {
                this.actionsMap.set(action.action_id, action);
            }
            
            // Helper function to get icon and class for priority
            const getPriorityInfo = (level) => {
                switch(level) {
                    case 1: case 'high': return { icon: '🔴', class: 'priority-high' };
                    case 2: case 'medium': return { icon: '🟡', class: 'priority-medium' };
                    case 3: case 'low': return { icon: '🟢', class: 'priority-low' };
                    default: return { icon: '⚪', class: '' };
                }
            };
            
            // Helper function to get icon and class for effort
            const getEffortInfo = (effort) => {
                switch(effort?.toLowerCase()) {
                    case 'high': return { icon: '⚡', class: 'effort-high' };
                    case 'medium': return { icon: '⚖️', class: 'effort-medium' };
                    case 'low': return { icon: '🐌', class: 'effort-low' };
                    default: return { icon: '❓', class: '' };
                }
            };
            
            // Helper function to get icon and class for impact
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
                        </div>
                    </div>
                    <div class="action-description">${escapeHtml(action.action_description)}</div>
                    <div class="action-actions">
                        <button class="btn btn-primary btn-sm explore-action-btn" 
                                onclick='priorityExploreModal.exploreAction("${action.action_id}")'
                                title="Explore this action in detail">
                            🔍 Explore Action
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        console.log('[Priority Modal] Rendering actions HTML');
        content.innerHTML = `
            <div class="actions-list">
                ${actionsHtml}
            </div>
        `;
        console.log('[Priority Modal] Actions content rendered, HTML length:', content.innerHTML.length);
    }

    updateNotesContent(notes) {
        const content = document.getElementById('notes-content');
        
        if (!notes || notes.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <p>No notes yet. Add your thoughts and observations about this priority.</p>
                </div>
            `;
            return;
        }

        const notesHtml = notes.map(note => `
            <div class="note-item">
                <div class="note-content">${escapeHtml(note.note_text)}</div>
                <div class="note-meta">
                    <span class="note-date">${new Date(note.created_ts).toLocaleString()}</span>
                </div>
            </div>
        `).join('');

        content.innerHTML = `
            <div class="notes-list">
                ${notesHtml}
            </div>
        `;
    }

    showAddNoteForm() {
        document.getElementById('add-note-form').style.display = 'block';
        document.getElementById('note-textarea').focus();
    }

    hideAddNoteForm() {
        document.getElementById('add-note-form').style.display = 'none';
        document.getElementById('note-textarea').value = '';
    }

    async saveNote() {
        const noteContent = document.getElementById('note-textarea').value.trim();
        if (!noteContent) return;

        try {
            const response = await fetch('/api/priority-insights/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priority_id: this.currentPriority.id,
                    grid_type: this.currentPriority.gridType,
                    note_text: noteContent
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Clear the textarea
                document.getElementById('note-textarea').value = '';
                this.hideAddNoteForm();
                // Reload notes to show the new one
                await this.loadNotes();
            } else {
                throw new Error('Failed to save note');
            }
        } catch (error) {
            console.error('Error saving note:', error);
            alert('Failed to save note. Please try again.');
        }
    }

    async loadNotes() {
        if (!this.currentPriority) return;
        try {
            const response = await fetch(`/api/priority-insights/notes?priority_id=${this.currentPriority.id}&grid_type=${this.currentPriority.gridType}`);
            if (response.ok) {
                const data = await response.json();
                this.updateNotesContent(data.notes || []);
            } else {
                this.showError('notes-content', 'Failed to load notes.');
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            this.showError('notes-content', 'Error loading notes.');
        }
    }
    
    async clearPriorityData() {
        if (!confirm('Are you sure you want to clear all data for this priority? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch('/api/priority-insights/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priority_id: this.currentPriority.id,
                    grid_type: this.currentPriority.gridType
                })
            });

            if (response.ok) {
                this.loadPriorityData(); // Reload to show cleared state
            } else {
                throw new Error('Failed to clear data');
            }
        } catch (error) {
            console.error('Error clearing data:', error);
            alert('Failed to clear data. Please try again.');
        }
    }

    async savePriorityAnalysis() {
        if (!this.currentPriority) {
            alert('No priority data to save');
            return;
        }

        try {
            const response = await fetch('/api/priority-insights/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priority_id: this.currentPriority.id,
                    grid_type: this.currentPriority.gridType,
                    priority_data: this.currentPriority.data,
                    insights_content: this.currentPriority.insights ? this.currentPriority.insights.insights_content : null
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Update save button to show saved state
                this.updateSaveButtonState(true);
                
                // Show success message
                this.showSuccessMessage('Priority analysis saved to workspace!');
                
                // Reload saved analyses in dashboard
                if (typeof loadSavedAnalyses === 'function') {
                    await loadSavedAnalyses();
                }
                
                // Update workspace metadata
                if (typeof updateWorkspaceMetadata === 'function') {
                    updateWorkspaceMetadata();
                }
            } else {
                throw new Error('Failed to save priority analysis');
            }
        } catch (error) {
            console.error('Error saving priority analysis:', error);
            alert('Failed to save priority analysis. Please try again.');
        }
    }

    updateSaveButtonState(isSaved) {
        const saveBtn = document.getElementById('save-priority-btn');
        if (!saveBtn) return;

        if (isSaved) {
            saveBtn.innerHTML = '✅ Saved';
            saveBtn.disabled = true;
            saveBtn.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
            saveBtn.style.color = '#059669';
            saveBtn.title = 'Analysis is saved';
        } else {
            saveBtn.innerHTML = '💾 Save Analysis';
            saveBtn.disabled = false;
            saveBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            saveBtn.style.color = 'white';
            saveBtn.title = 'Save this priority analysis for future reference';
        }
    }

    checkAndUpdateSaveStatus() {
        // Always check if this specific analysis is saved
        // The DOM content check was flawed because it doesn't distinguish between different priorities
        this.checkIfAnalysisIsSaved();
    }

    async checkIfAnalysisIsSaved() {
        if (!this.currentPriority) return;

        try {
            const response = await fetch('/api/priority-insights/saved');
            if (response.ok) {
                const data = await response.json();
                const list = Array.isArray(data.analyses)
                    ? data.analyses
                    : (Array.isArray(data.saved) ? data.saved : []);
                const isSaved = list.some(analysis =>
                    analysis.priority_id === this.currentPriority.id &&
                    analysis.grid_type === this.currentPriority.gridType
                );
                this.updateSaveButtonState(isSaved);
            }
        } catch (error) {
            console.error('Error checking save status:', error);
            // Default to showing save button as available
            this.updateSaveButtonState(false);
        }
    }

    showSuccessMessage(message) {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
            color: #059669;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-weight: 600;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(successDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            successDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (successDiv.parentNode) {
                    successDiv.parentNode.removeChild(successDiv);
                }
            }, 300);
        }, 3000);
    }

    setLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        const textSpan = button.querySelector('.btn-text');
        const loadingSpan = button.querySelector('.btn-loading');
        
        if (isLoading) {
            textSpan.style.display = 'none';
            loadingSpan.style.display = 'inline';
            button.disabled = true;
        } else {
            textSpan.style.display = 'inline';
            loadingSpan.style.display = 'none';
            button.disabled = false;
        }
    }

    showError(containerId, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="error-state">
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    }

    async exploreAction(actionId) {
        const actionData = this.actionsMap.get(actionId);
        if (!actionData) {
            console.error('Could not find action data for ID:', actionId);
            alert('An error occurred while trying to explore the action. Please try again.');
            return;
        }

        if (!window.exploreActionModal) {
            alert('Explore Action modal not available. Please refresh the page.');
            console.error('ExploreActionModal instance not found on window object.');
            return;
        }

        let finalActionData = { ...actionData };

        // If the action has an ID, it might have been saved with more details (like context).
        // Fetch the latest version of the action to ensure we have the most up-to-date info.
        if (finalActionData.action_id) {
            try {
                const response = await fetch(`/api/actions/${finalActionData.action_id}`);
                if (response.ok) {
                    const updatedAction = await response.json();
                    // Merge with existing data, preferring the fresh data from the DB
                    finalActionData = { ...finalActionData, ...updatedAction };
                    console.log('Fetched latest action data:', finalActionData);
                } else {
                    console.warn(`Failed to fetch latest data for action ${finalActionData.action_id}. Using existing data.`);
                }
            } catch (error) {
                console.error(`Error fetching action ${finalActionData.action_id}:`, error);
            }
        }

        // This logic ensures the structured action_json is attached if it exists on the window
        // but not on the action object itself (for newly generated, unsaved actions).
        if (!finalActionData.action_json && window.__LATEST_STRUCTURED_ACTIONS__) {
            const matchingStructuredAction = window.__LATEST_STRUCTURED_ACTIONS__.find(
                (a) => a.title === finalActionData.title || (a.summary && a.summary.title === finalActionData.title)
            );
            if (matchingStructuredAction && matchingStructuredAction.action_json) {
                finalActionData.action_json = matchingStructuredAction.action_json;
            }
        }

        window.exploreActionModal.open(
            finalActionData,
            this.currentPriority.data,
            this.currentPriority.id,
            this.currentPriority.gridType
        );
    }

    formatInsightsText(text) {
        // Remove unwanted introductory text
        let cleanedText = text;
        
        // Convert markdown-like formatting to HTML
        let html = escapeHtml(cleanedText);
        
        // Convert ## headers to <h2>
        html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
        
        // Convert ### headers to <h3>
        html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
        
        // Convert #### headers to <h4>
        html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
        
        // Convert **bold** to <strong>
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert *italic* to <em>
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert bullet points (- or •) to proper list items
        html = html.replace(/^[\s]*[-•]\s+(.+)$/gm, '<li>$1</li>');
        
        // Wrap consecutive list items in <ul>
        html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
            const listItems = match.match(/<li>.*?<\/li>/g);
            if (listItems && listItems.length > 1) {
                return `<ul>${match}</ul>`;
            }
            return match;
        });
        
        // Convert numbered lists (1. 2. etc.)
        html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li>$1</li>');
        
        // Wrap consecutive numbered list items in <ol>
        html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
            const listItems = match.match(/<li>.*?<\/li>/g);
            if (listItems && listItems.length > 1) {
                return `<ol>${match}</ol>`;
            }
            return match;
        });
        
        // Convert line breaks to paragraphs, but preserve headers and lists
        const lines = html.split('\n');
        let result = '';
        let inList = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<ol') || line.startsWith('<li')) {
                if (inList && !line.startsWith('<li')) {
                    result += '</ul></ol>';
                    inList = false;
                }
                result += line + '\n';
            } else if (line.startsWith('<li')) {
                if (!inList) {
                    result += '<ul>';
                    inList = true;
                }
                result += line + '\n';
            } else if (line === '') {
                if (inList) {
                    result += '</ul>';
                    inList = false;
                }
                result += '\n';
            } else if (line) {
                if (inList) {
                    result += '</ul>';
                    inList = false;
                }
                result += `<p>${line}</p>\n`;
            }
        }
        
        if (inList) {
            result += '</ul>';
        }
        
        return result;
    }
}

// Initialize the modal when the page loads
let priorityExploreModal;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing PriorityExploreModal...');
    try {
        priorityExploreModal = new PriorityExploreModal();
        console.log('PriorityExploreModal initialized successfully');
        window.priorityExploreModal = priorityExploreModal; // Make it globally available
    } catch (error) {
        console.error('Error initializing PriorityExploreModal:', error);
    }
});

// Export for use in other modules
window.PriorityExploreModal = PriorityExploreModal;
