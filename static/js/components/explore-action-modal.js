/**
 * Explore Action Modal Component
 * 
 * This module handles the modal interface for exploring detailed action entities
 * with Gemini-generated context, next steps, notes, and workspace management.
 */

console.log('ExploreActionModal script loading...');

class ExploreActionModal {
    constructor() {
        this.modal = null;
        this.currentAction = null;
        this.isLoading = false;
        this.actionPlan = null; // Add a property for the action plan component
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        // Create modal HTML
        const modalHTML = `
            <div id="explore-action-modal" class="modal-overlay" style="display: none;">
                <div class="modal-container action-modal">
                    <div class="modal-header">
                        <h2 id="action-modal-title">Explore Action</h2>
                        <div class="modal-header-actions">
                            <button class="btn-delete-subtle" id="delete-action-header-btn" title="Delete this action">
                                🗑️
                            </button>
                            <button class="btn btn-primary btn-sm" id="save-action-btn" title="Save this action to your workspace">
                                💾 Save to Workspace
                            </button>
                            <button class="btn btn-secondary btn-sm" id="share-action-btn" title="Share this action">
                                🔗 Share
                            </button>
                            <button class="modal-close" id="action-modal-close-btn">&times;</button>
                        </div>
                    </div>
                    <div class="modal-content">
                        <div class="action-info" id="action-info">
                            <!-- Action details will be loaded here -->
                        </div>
                        
                        <div class="modal-tabs">
                            <button class="tab-btn active" data-tab="context">🔍 Context</button>
                            <button class="tab-btn" data-tab="next-steps">📋 Next Steps</button>
                            <button class="tab-btn" data-tab="notes">📝 Notes</button>
                        </div>
                        
                        <div class="tab-content">
                            <!-- Context Tab -->
                            <div id="tab-context" class="tab-panel active">
                                <div class="context-header">
                                    <h3>AI-Generated Context</h3>
                                    <button class="btn btn-primary" id="generate-context-btn">
                                        <span class="btn-text">Generate Context</span>
                                        <span class="btn-loading" style="display: none;">Generating...</span>
                                    </button>
                                </div>
                                <div id="context-content" class="context-content">
                                    <div class="empty-state">
                                        <p>Click "Generate Context" to get AI-powered analysis and context for this action.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Next Steps Tab -->
                            <div id="tab-next-steps" class="tab-panel">
                                <div class="next-steps-header">
                                    <h3>Recommended Next Steps</h3>
                                </div>
                                <div id="next-steps-content" class="next-steps-content">
                                    <div class="empty-state">
                                        <p>Click "Generate Next Steps" to get specific, actionable steps for this action.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Notes Tab -->
                            <div id="tab-notes" class="tab-panel">
                                <div class="notes-header">
                                    <h3>Your Notes</h3>
                                    <button class="btn btn-primary" id="add-action-note-btn">Add Note</button>
                                </div>
                                <div id="action-notes-content" class="action-notes-content">
                                    <div class="empty-state">
                                        <p>No notes yet. Add your thoughts and observations about this action.</p>
                                    </div>
                                </div>
                                <div class="add-note-form" id="add-action-note-form" style="display: none;">
                                    <textarea id="action-note-textarea" placeholder="Add your note here..."></textarea>
                                    <div class="form-actions">
                                        <button class="btn btn-primary" id="save-action-note-btn">Save Note</button>
                                        <button class="btn btn-secondary" id="cancel-action-note-btn">Cancel</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="action-modal-close-footer-btn">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('explore-action-modal');
    }

    bindEvents() {
        // Close modal events
        document.getElementById('action-modal-close-btn').addEventListener('click', () => this.close());
        document.getElementById('action-modal-close-footer-btn').addEventListener('click', () => this.close());
        document.getElementById('explore-action-modal').addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // Tab switching (scope to this modal only)
        this.modal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Generate context
        document.getElementById('generate-context-btn').addEventListener('click', () => this.generateContext());

        // Notes functionality
        this.bindNotesEvents();

        // Save to workspace
        document.getElementById('save-action-btn').addEventListener('click', () => this._saveAction());

        // Share action
        document.getElementById('share-action-btn').addEventListener('click', () => this.shareAction());

        // Delete action (header icon)
        document.getElementById('delete-action-header-btn').addEventListener('click', () => this.deleteAction());
    }

    _resetModalContent() {
        const contextContent = document.getElementById('context-content');
        if (contextContent) {
            contextContent.innerHTML = `
                <div class="empty-state">
                    <p>Click "Generate Context" to get AI-powered analysis and context for this action.</p>
                </div>
            `;
        }

        const nextStepsContent = document.getElementById('next-steps-content');
        if (nextStepsContent) {
            nextStepsContent.innerHTML = `
                <div class="empty-state">
                    <p>Click "Generate Next Steps" to get specific, actionable steps for this action.</p>
                </div>
            `;
        }

        const notesContent = this.modal.querySelector('#action-notes-content, #notes-content');
        if (notesContent) {
            notesContent.innerHTML = `
                <div class="empty-state">
                    <p>No notes yet. Add your thoughts and observations about this action.</p>
                </div>
            `;
        }
        
        // Also reset to the first tab
        this.switchTab('context');
    }

    bindNotesEvents() {
        // Use event delegation to handle clicks on the modal
        this.modal.addEventListener('click', (e) => {
            // Handle Add Note button click
            if (e.target.id === 'add-action-note-btn' || e.target.id === 'add-note-btn') {
                e.preventDefault();
                e.stopPropagation();
                this.showAddNoteForm();
                return;
            }
            
            // Handle Save Note button click
            if (e.target.id === 'save-note-btn' || e.target.id === 'save-action-note-btn') {
                e.preventDefault();
                e.stopPropagation();
                this.saveNote();
                return;
            }
            
            // Handle Cancel Note button click
            if (e.target.id === 'cancel-note-btn' || e.target.id === 'cancel-action-note-btn') {
                e.preventDefault();
                e.stopPropagation();
                this.hideAddNoteForm();
                return;
            }
        });
    }

    open(actionData, priorityData, priorityId, gridType) {
        this._resetModalContent();
        this.currentAction = {
            data: actionData,
            priority: priorityData,
            priorityId: priorityId,
            gridType: gridType
        };

        // Initialize ActionPlan component for the 'Next Steps' tab
        const nextStepsContainer = this.modal.querySelector('#next-steps-content');
        this.actionPlan = new ActionPlan(nextStepsContainer, this.currentAction.data.action_id);

        this.updateActionInfo();
        this.loadActionData();
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Re-bind events after modal is displayed to ensure elements exist - MOVED TO BIND EVENTS
        
        // Check save status after a short delay
        setTimeout(() => {
            // This is now handled via autosave.
            // Initially, determine if the action is already saved.
            this.updateSaveButtonState(this.currentAction.data.source_table === 'saved_actions');
        }, 500);
    }

    close() {
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
        this.currentAction = null;
    }

    updateActionInfo() {
        const actionInfo = document.getElementById('action-info');
        const action = this.currentAction.data;
        const priority = this.currentAction.priority;
        
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
        
        // Ensure we have a normalized priority object for the Related Action card
        const normalizedPriority = (this.currentAction?.priority && this.currentAction.priority.data)
            ? this.currentAction.priority.data
            : (this.currentAction?.priority || {});
        
        // Attempt to resolve placeholder objects inside text using known priority data
        const resolveDataPlaceholders = (text, ctx) => {
            if (!text) return '';
            let output = String(text);
            const tryStringify = (val) => {
                try {
                    if (val === undefined || val === null) return '';
                    if (typeof val === 'string') return val;
                    return JSON.stringify(val, null, 2);
                } catch { return ''; }
            };
            const replacements = {
                aov_by_segment: ctx?.aov_by_segment,
                ltv_by_source: ctx?.ltv_by_source,
                channel_volume_mismatch: ctx?.channel_volume_mismatch
            };
            Object.entries(replacements).forEach(([key, val]) => {
                // Replace common placeholder patterns
                output = output.replace(new RegExp(`${key}:\\s*\\[object Object\\](,\\s*\\[object Object\\])*`, 'g'), `${key}:\n${tryStringify(val)}`);
                output = output.replace(new RegExp(`${key}\\s*=\\s*\\[object Object\\]`, 'g'), `${key} = ${tryStringify(val)}`);
            });
            return output;
        };

        // Resolved texts
        const resolvedActionDesc = resolveDataPlaceholders(action.action_description, normalizedPriority);
        const resolvedPriorityWhy = resolveDataPlaceholders(normalizedPriority.why || action.action_description, normalizedPriority);

        actionInfo.innerHTML = `
            <div class="action-card-modal">
                <div class="action-header-modal">
                    <h3 class="action-title-modal">${escapeHtml(action.action_title || 'Untitled Action')}</h3>
                    <div class="action-meta-modal">
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
                <div class="action-description-modal">
                    ${this.formatContentText(resolvedActionDesc)}
                </div>
                <div class="priority-context-modal">
                    <h4>Related Priority:</h4>
                    <div class="priority-card-modal">
                        <div class="priority-header-modal">
                            <span class="priority-number-modal">${this.currentAction.priorityId}</span>
                            <h4 class="priority-title-modal">${escapeHtml(normalizedPriority.title || 'Untitled Priority')}</h4>
                            <span class="priority-category-modal">${escapeHtml(this.currentAction.gridType || 'general')}</span>
                        </div>
                        <div class="priority-description-modal">
                            ${this.formatContentText(resolvedPriorityWhy)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    switchTab(tabName) {
        // Update tab buttons
        this.modal.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const tabButton = this.modal.querySelector(`[data-tab="${tabName}"]`);
        if (tabButton) {
            tabButton.classList.add('active');
        }

        // Update tab panels
        this.modal.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        const targetPanel = this.modal.querySelector(`#tab-${tabName}`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
    }

    async loadActionData() {
        this.loadNotes();

        try {
            const response = await fetch(`/api/actions/${this.currentAction.data.action_id}`);
            
            if (response.ok) {
                const data = await response.json();
                this.currentAction.data = data.action;
                this.updateContextContent(data.action.gemini_context);
                this.updateNextStepsContent(data.action.next_steps);
                // Notes are now loaded separately
            }
        } catch (error) {
            console.error('Error loading action data:', error);
        }
    }

    async generateContext() {
        if (this.isLoading) return;
        
        this.setLoading('generate-context-btn', true);
        
        try {
            const response = await fetch('/api/actions/explore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action_id: this.currentAction.data.action_id,
                    action_data: this.currentAction.data,
                    priority_title: this.currentAction.priority.title,
                    priority_description: this.currentAction.priority.why
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.currentAction.data = data.action;
                this.updateContextContent(data.action.gemini_context);
                this.updateNextStepsContent(data.action.next_steps);
                this.switchTab('context');
            } else {
                throw new Error('Failed to generate context');
            }
        } catch (error) {
            console.error('Error generating context:', error);
            this.showError('context-content', 'Failed to generate context. Please try again.');
        } finally {
            this.setLoading('generate-context-btn', false);
        }
    }

    updateContextContent(context) {
        const content = document.getElementById('context-content');
        
        if (!context) {
            content.innerHTML = `
                <div class="empty-state">
                    <p>Click "Generate Context" to get AI-powered analysis and context for this action.</p>
                </div>
            `;
            return;
        }

        let contextData = {};
        try {
            contextData = typeof context === 'string' ? JSON.parse(context) : context;
            if (typeof contextData !== 'object' || contextData === null) {
                // Fallback for plain text context from older records
                content.innerHTML = `<div class="context-display"><div class="context-text">${this.formatContextText(String(context))}</div></div>`;
                return;
            }
        } catch (error) {
            // Fallback for plain text context that isn't valid JSON
            console.warn('Context was not valid JSON, displaying as plain text.');
            content.innerHTML = `<div class="context-display"><div class="context-text">${this.formatContextText(String(context))}</div></div>`;
            return;
        }

        const sections = [
            { key: 'strategic_alignment', title: 'Strategic Alignment', icon: '🎯' },
            { key: 'market_rationale', title: 'Market Rationale', icon: '📈' },
            { key: 'potential_impact', title: 'Potential Impact', icon: '⚡' },
            { key: 'risk_assessment', title: 'Risk Assessment', icon: '⚠️' }
        ];

        const contextHtml = sections.map(section => {
            const sectionContent = contextData[section.key];
            if (!sectionContent) return '';

            return `
                <div class="context-section-card">
                    <div class="context-section-header">
                        <h4 class="context-section-title">${this.escapeHtml(section.title)}</h4>
                        <div class="context-section-icon">${section.icon}</div>
                    </div>
                    <div class="context-section-content">
                        ${this.formatContextText(sectionContent)}
                    </div>
                    <div class="ai-assistant-container" id="ai-assistant-context-${section.key}"></div>
                </div>
            `;
        }).join('');

        content.innerHTML = `
            <div class="context-display">
                ${contextHtml}
            </div>
        `;

        // Initialize AI Assistant for each context section
        setTimeout(() => {
            sections.forEach(section => {
                if (!contextData[section.key]) return;
                
                const aiAssistantContainer = content.querySelector(`#ai-assistant-context-${section.key}`);
                if (aiAssistantContainer) {
                    if (typeof AIAssistant !== 'undefined') {
                        const aiAssistant = new AIAssistant(
                            aiAssistantContainer, 
                            this.currentAction.data.action_id, 
                            'context', 
                            section.key, 
                            {
                                title: section.title,
                                content: contextData[section.key],
                                fullContext: contextData
                            }
                        );
                        
                        // Load existing conversations if they exist
                        if (this.currentAction.data && this.currentAction.data.ai_conversations) {
                            const conversations = JSON.parse(this.currentAction.data.ai_conversations);
                            const sectionConversations = conversations[`context_${section.key}`] || [];
                            aiAssistant.setExistingConversations(sectionConversations);
                        }
                    } else {
                        console.error('AIAssistant class not found. Check if the script is loaded properly.');
                        aiAssistantContainer.innerHTML = '<p style="color: red;">AI Assistant not available. Please refresh the page.</p>';
                    }
                }
            });
        }, 100); // Small delay to ensure DOM is ready
    }

    updateNextStepsContent(nextSteps) {
        if (this.actionPlan) {
            let steps = [];
            try {
                steps = typeof nextSteps === 'string' ? JSON.parse(nextSteps) : nextSteps;
                if (!Array.isArray(steps)) {
                    steps = [];
                }
            } catch (error) {
                console.error('Error parsing next steps:', error);
                steps = [];
            }
            
            // Update the ActionPlan's actionData so AI Assistant can access it
            this.actionPlan.actionData = this.currentAction.data;
            this.actionPlan.render(steps);
        } else {
            const content = document.getElementById('next-steps-content');
            content.innerHTML = `
                <div class="empty-state">
                    <p>Click "Generate Next Steps" to get specific, actionable steps for this action.</p>
                </div>
            `;
        }
    }

    updateNotesContent(notes) {
        const content = this.modal.querySelector('#action-notes-content, #notes-content');
        
        if (!notes || notes.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <p>No notes yet. Add your thoughts and observations about this action.</p>
                </div>
            `;
            return;
        }

        const notesHtml = notes.map(note => `
            <div class="note-item">
                <div class="note-content">${escapeHtml(note.note_text)}</div>
                <div class="note-meta">
                    <span class="note-date">${new Date(note.created_ts).toLocaleString()}</span>
                    <button class="btn-delete-subtle" onclick="exploreActionModal.deleteNote(${note.id})" title="Delete note">
                        🗑️
                    </button>
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
        // Scope to active notes tab within this modal
        const activeNotesPanel = this.modal.querySelector('#tab-notes.tab-panel.active') || this.modal.querySelector('#tab-notes');
        const form = activeNotesPanel?.querySelector('#add-action-note-form, #add-note-form');
        const textarea = activeNotesPanel?.querySelector('#action-note-textarea, #note-textarea');
        if (form) {
            form.style.display = 'block';
        }
        if (textarea) {
            textarea.focus();
        }
    }

    hideAddNoteForm() {
        const activeNotesPanel = this.modal.querySelector('#tab-notes.tab-panel.active') || this.modal.querySelector('#tab-notes');
        const form = activeNotesPanel?.querySelector('#add-action-note-form, #add-note-form');
        const textarea = activeNotesPanel?.querySelector('#action-note-textarea, #note-textarea');
        if (form) form.style.display = 'none';
        if (textarea) textarea.value = '';
    }

    async saveNote() {
        const activeNotesPanel = this.modal.querySelector('#tab-notes.tab-panel.active') || this.modal.querySelector('#tab-notes');
        const textarea = activeNotesPanel?.querySelector('#action-note-textarea, #note-textarea');
        const noteContent = (textarea ? textarea.value : '').trim();
        if (!noteContent) return;

        if (!this.currentAction.data.action_id) {
            alert('Please generate context first before adding notes.');
            return;
        }

        try {
            const response = await fetch(`/api/actions/${this.currentAction.data.action_id}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    note_text: noteContent
                })
            });

            if (response.ok) {
                // Clear the textarea
                if (textarea) textarea.value = '';
                this.hideAddNoteForm();
                // Reload notes to show new note
                this.loadNotes();
                this._saveAction(); // Autosave after adding a note
            } else {
                const errorText = await response.text();
                console.error('Save note error response:', errorText);
                throw new Error('Failed to save note');
            }
        } catch (error) {
            console.error('Error saving note:', error);
            alert('Failed to save note. Please try again.');
        }
    }

    async loadNotes() {
        if (!this.currentAction?.data?.action_id) {
            this.updateNotesContent([]);
            return;
        }
        try {
            const response = await fetch(`/api/actions/${this.currentAction.data.action_id}/notes`);
            if (response.ok) {
                const data = await response.json();
                this.updateNotesContent(data.notes || []);
            } else {
                this.showError('action-notes-content', 'Failed to load notes.');
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            this.showError('action-notes-content', 'Error loading notes.');
        }
    }

    async deleteNote(noteId) {
        if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/actions/${this.currentAction.data.action_id}/notes/${noteId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                const data = await response.json();
                this.updateNotesContent(data.notes);
            } else {
                throw new Error('Failed to delete note');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            alert('Failed to delete note. Please try again.');
        }
    }

    async _saveAction() {
        if (!this.currentAction.data.action_id) {
            alert('Please generate context first before saving to workspace.');
            return;
        }

        this.updateSaveButtonState(false, true); // Indicate saving

        try {
            const response = await fetch(`/api/actions/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action_id: this.currentAction.data.action_id })
            });

            if (response.ok) {
                this.updateSaveButtonState(true); // Indicate saved
                this.showSuccessMessage('Action saved successfully!');
                
                if (typeof loadSavedActions === 'function') {
                    loadSavedActions();
                }
            } else {
                this.updateSaveButtonState(false); // Re-enable save button on error
                throw new Error('Failed to save action to workspace');
            }
        } catch (error) {
            console.error('Error saving action to workspace:', error);
            alert('Failed to save action to workspace. Please try again.');
            this.updateSaveButtonState(false); // Re-enable save button on error
        }
    }

    async shareAction() {
        if (!this.currentAction.data.action_id) {
            alert('Please generate context first before sharing.');
            return;
        }

        try {
            const response = await fetch(`/api/actions/${this.currentAction.data.action_id}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    expires_days: 30
                })
            });

            if (response.ok) {
                const data = await response.json();
                const shareUrl = `${window.location.origin}${data.share.share_url}`;
                
                // Copy to clipboard
                await navigator.clipboard.writeText(shareUrl);
                this.showSuccessMessage('Share link copied to clipboard!');
            } else {
                throw new Error('Failed to create share link');
            }
        } catch (error) {
            console.error('Error sharing action:', error);
            alert('Failed to create share link. Please try again.');
        }
    }

    async deleteAction() {
        if (!confirm('Are you sure you want to delete this action? This action cannot be undone.')) {
            return;
        }

        if (!this.currentAction.data.action_id) {
            this.close();
            return;
        }

        try {
            const response = await fetch(`/api/actions/${this.currentAction.data.action_id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.close();
                this.showSuccessMessage('Action deleted successfully!');
                
                // Reload workspace actions in dashboard
                if (typeof loadWorkspaceActions === 'function') {
                    loadWorkspaceActions();
                }
            } else {
                throw new Error('Failed to delete action');
            }
        } catch (error) {
            console.error('Error deleting action:', error);
            alert('Failed to delete action. Please try again.');
        }
    }

    updateSaveButtonState(isSaved, isSaving = false) {
        const saveBtn = document.getElementById('save-action-btn');
        if (!saveBtn) return;

        if (isSaving) {
            saveBtn.innerHTML = '⏳ Saving...';
            saveBtn.disabled = true;
            saveBtn.style.background = 'var(--color-background-muted)';
            saveBtn.style.color = 'var(--color-text-muted)';
            saveBtn.title = 'Saving action...';
        } else if (isSaved) {
            saveBtn.innerHTML = '✅ Saved';
            saveBtn.disabled = true;
            saveBtn.style.background = 'var(--color-success-light)';
            saveBtn.style.color = 'var(--color-success-dark)';
            saveBtn.title = 'Action is saved to workspace';
        } else {
            saveBtn.innerHTML = '💾 Save';
            saveBtn.disabled = false;
            saveBtn.style.background = 'var(--color-primary)';
            saveBtn.style.color = 'white';
            saveBtn.title = 'Save this action to your workspace';
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

    formatContextText(text) {
        // Convert markdown-like formatting to HTML
        let html = escapeHtml(text);
        
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
        
        // Convert line breaks to paragraphs
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

    formatNextStepsText(text) {
        // Use the same formatting as context text
        return this.formatContextText(text);
    }

    formatContentText(text) {
        // Remove unwanted introductory text
        let cleanedText = text;
        
        // Remove common AI introductory phrases
        const unwantedPhrases = [
            /^Of course\.?\s*/i,
            /^As a business strategy expert,?\s*/i,
            /^here is a comprehensive analysis of the\s*/i,
            /^priority for the Customer Analyst role\.?\s*/i,
            /^This priority represents\s*/i,
            /^A \d+% quarter-over-quarter drop\s*/i,
            /^quarter-over-quarter drop in new customers,?\s*/i,
            /^especially with a \d+% decline\s*/i,
            /^signals an urgent and potentially systemic failure\s*/i,
            /^that requires immediate, data-driven investigation\.?\s*/i
        ];
        
        // Clean up the text by removing unwanted phrases
        unwantedPhrases.forEach(phrase => {
            cleanedText = cleanedText.replace(phrase, '');
        });
        
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

    // Render structured context (context_json) if present on window from latest insights call
    renderStructuredContext() {
        try {
            const ctx = this.currentAction?.data?.context_json || null;
            if (!ctx || typeof ctx !== 'object') return '';
            const mc = ctx.market_context || {}; const bi = ctx.business_impact || {};
            const kc = Array.isArray(ctx.key_challenges) ? ctx.key_challenges : [];
            const sm = Array.isArray(ctx.success_metrics) ? ctx.success_metrics : [];
            const ii = Array.isArray(ctx.industry_insights) ? ctx.industry_insights : [];

            const section = (title, body) => body ? `<div class="structured-section"><h4>${title}</h4>${body}</div>` : '';
            const list = (items) => `<ul>${items.map(x=>`<li>${this.escapeHtml(String(x))}</li>`).join('')}</ul>`;
            const table = (rows, cols) => {
                if (!rows.length) return '';
                return `<table><thead><tr>${cols.map(c=>`<th>${c.header}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${this.escapeHtml(String(r[c.key] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
            };

            const mcHtml = section('Market Context', [
                mc.summary ? `<p>${this.escapeHtml(mc.summary)}</p>` : '',
                Array.isArray(mc.trends) && mc.trends.length ? section('Trends', list(mc.trends)) : '',
                Array.isArray(mc.sources) && mc.sources.length ? section('Sources', table(mc.sources, [
                    {key:'title', header:'Title'}, {key:'url', header:'URL'}, {key:'snippet', header:'Snippet'}
                ])) : ''
            ].join(''));

            const biHtml = section('Business Impact', [
                bi.summary ? `<p>${this.escapeHtml(bi.summary)}</p>` : ''
            ].join(''));

            const kcHtml = kc.length ? section('Key Challenges', table(kc, [
                {key:'challenge', header:'Challenge'}, {key:'why_it_matters', header:'Why it matters'}, {key:'risk_level', header:'Risk'}
            ])) : '';

            const smHtml = sm.length ? section('Success Metrics', table(sm, [
                {key:'metric', header:'Metric'}, {key:'target', header:'Target'}, {key:'timeline_weeks', header:'Weeks'}
            ])) : '';

            const iiHtml = ii.length ? section('Industry Insights', table(ii, [
                {key:'practice', header:'Practice'}, {key:'evidence', header:'Evidence'}, {key:'source_url', header:'Source URL'}
            ])) : '';

            const assembled = [mcHtml, biHtml, kcHtml, smHtml, iiHtml].filter(Boolean).join('');
            return assembled ? `<div class="structured-context">${assembled}</div>` : '';
        } catch(_) { return ''; }
    }

    // local html escape
    escapeHtml(v){
        const div=document.createElement('div'); div.textContent=String(v); return div.innerHTML;
    }
}

// Initialize the modal when the page loads
let exploreActionModal;

// Function to initialize the modal
function initializeExploreActionModal() {
    if (window.exploreActionModal) {
        console.log('ExploreActionModal is already initialized.');
        return false;
    }
    console.log('Initializing ExploreActionModal...');
    try {
        exploreActionModal = new ExploreActionModal();
        console.log('ExploreActionModal initialized successfully');
        window.exploreActionModal = exploreActionModal; // Make it globally available
        console.log('window.exploreActionModal set:', !!window.exploreActionModal);
        return true;
    } catch (error) {
        console.error('Error initializing ExploreActionModal:', error);
        console.error('Error stack:', error.stack);
        return false;
    }
}

// Try multiple initialization strategies
document.addEventListener('DOMContentLoaded', initializeExploreActionModal);

// Also try to initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is already loaded, initialize immediately
    console.log('DOM already loaded, initializing ExploreActionModal immediately...');
    initializeExploreActionModal();
}

// Fallback: try again after a short delay
setTimeout(() => {
    if (!window.exploreActionModal) {
        console.log('Fallback initialization attempt...');
        initializeExploreActionModal();
    }
}, 1000);

// Export for use in other modules - do this immediately
window.ExploreActionModal = ExploreActionModal;
console.log('ExploreActionModal class exported to window:', !!window.ExploreActionModal);

// Debug function to check modal status
window.debugExploreActionModal = function() {
    console.log('=== ExploreActionModal Debug Info ===');
    console.log('window.exploreActionModal exists:', !!window.exploreActionModal);
    console.log('window.ExploreActionModal class exists:', !!window.ExploreActionModal);
    console.log('Document ready state:', document.readyState);
    console.log('Modal element in DOM:', !!document.getElementById('explore-action-modal'));
    console.log('Available modal globals:', Object.keys(window).filter(k => k.includes('Modal')));
    console.log('=====================================');
};
