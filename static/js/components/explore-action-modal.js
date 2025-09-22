/**
 * Explore Action Modal Component
 * 
 * This module handles the modal interface for exploring detailed action entities
 * with Gemini-generated context, next steps, notes, and workspace management.
 */

class ExploreActionModal {
    constructor() {
        this.modal = null;
        this.currentAction = null;
        this.isLoading = false;
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
                                    <button class="btn btn-primary" id="generate-next-steps-btn">
                                        <span class="btn-text">Generate Next Steps</span>
                                        <span class="btn-loading" style="display: none;">Generating...</span>
                                    </button>
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

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Generate context
        document.getElementById('generate-context-btn').addEventListener('click', () => this.generateContext());

        // Generate next steps
        document.getElementById('generate-next-steps-btn').addEventListener('click', () => this.generateNextSteps());

        // Notes functionality will be bound in bindNotesEvents()

        // Save to workspace
        document.getElementById('save-action-btn').addEventListener('click', () => this.saveToWorkspace());

        // Share action
        document.getElementById('share-action-btn').addEventListener('click', () => this.shareAction());

        // Delete action (header icon)
        document.getElementById('delete-action-header-btn').addEventListener('click', () => this.deleteAction());
    }

    bindNotesEvents() {
        // Use event delegation to handle clicks on the modal
        this.modal.addEventListener('click', (e) => {
            console.log('Modal clicked, target:', e.target);
            
            // Handle Add Note button click
            if (e.target.id === 'add-action-note-btn' || e.target.id === 'add-note-btn') {
                console.log('Add note button clicked via delegation');
                e.preventDefault();
                e.stopPropagation();
                this.showAddNoteForm();
                return;
            }
            
            // Handle Save Note button click
            if (e.target.id === 'save-note-btn' || e.target.id === 'save-action-note-btn') {
                console.log('Save note button clicked via delegation');
                e.preventDefault();
                e.stopPropagation();
                this.saveNote();
                return;
            }
            
            // Handle Cancel Note button click
            if (e.target.id === 'cancel-note-btn' || e.target.id === 'cancel-action-note-btn') {
                console.log('Cancel note button clicked via delegation');
                e.preventDefault();
                e.stopPropagation();
                this.hideAddNoteForm();
                return;
            }
        });
        
        console.log('Notes event delegation set up');
    }

    open(actionData, priorityData, priorityId, gridType) {
        this.currentAction = {
            data: actionData,
            priority: priorityData,
            priorityId: priorityId,
            gridType: gridType
        };

        this.updateActionInfo();
        this.loadActionData();
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Re-bind events after modal is displayed to ensure elements exist
        this.bindNotesEvents();
        
        // Check save status after a short delay
        setTimeout(() => {
            this.checkAndUpdateSaveStatus();
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
                    ${escapeHtml(action.action_description || 'No description available')}
                </div>
                <div class="priority-context-modal">
                    <h4>Related Action:</h4>
                    <div class="priority-card-modal">
                        <div class="priority-header-modal">
                            <span class="priority-number-modal">${this.currentAction.priorityId}</span>
                            <h4 class="priority-title-modal">${escapeHtml(action.action_title || 'Untitled Action')}</h4>
                            <span class="priority-category-modal">${escapeHtml(this.currentAction.gridType || 'general')}</span>
                        </div>
                        <div class="priority-description-modal">
                            ${escapeHtml(action.action_description || 'No description available')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            console.log('Removing active from panel:', panel.id, 'classes:', panel.className);
            panel.classList.remove('active');
        });
        const targetPanel = document.getElementById(`tab-${tabName}`);
        console.log('Target panel:', targetPanel);
        if (targetPanel) {
            targetPanel.classList.add('active');
            console.log('Added active class to panel. Panel classes:', targetPanel.className);
            
            // Debug: Log all buttons in the active tab
            if (tabName === 'notes') {
                console.log('Notes tab content:', targetPanel.innerHTML);
                const addBtn = targetPanel.querySelector('#add-note-btn') || targetPanel.querySelector('#add-action-note-btn');
                console.log('Add note button in tab:', addBtn);
                if (addBtn) {
                    console.log('Button styles:', window.getComputedStyle(addBtn));
                }
                
                // Check if tab panel is actually visible
                const computedStyle = window.getComputedStyle(targetPanel);
                console.log('Tab panel display:', computedStyle.display);
                console.log('Tab panel visibility:', computedStyle.visibility);
                console.log('Tab panel opacity:', computedStyle.opacity);
                console.log('Tab panel height:', computedStyle.height);
                console.log('Tab panel width:', computedStyle.width);
            }
        } else {
            console.error('Target panel not found for tab:', tabName);
        }
    }

    async loadActionData() {
        if (!this.currentAction.data.action_id) {
            // This is a new action exploration, no existing data to load
            return;
        }

        // Check if we already have context and next steps data
        if (this.currentAction.data.gemini_context || this.currentAction.data.next_steps) {
            this.updateContextContent(this.currentAction.data.gemini_context);
            this.updateNextStepsContent(this.currentAction.data.next_steps);
            this.updateNotesContent(this.currentAction.data.notes || []);
            return;
        }

        try {
            const response = await fetch(`/api/actions/${this.currentAction.data.action_id}`);
            
            if (response.ok) {
                const data = await response.json();
                this.currentAction.data = data.action;
                this.updateContextContent(data.action.gemini_context);
                this.updateNextStepsContent(data.action.next_steps);
                this.updateNotesContent(data.action.notes || []);
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
                    priority_id: this.currentAction.priorityId,
                    grid_type: this.currentAction.gridType,
                    priority_title: this.currentAction.priority.title,
                    priority_description: this.currentAction.priority.why,
                    action_data: this.currentAction.data
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.currentAction.data.action_id = data.action_id;
                this.updateContextContent(data.action.gemini_context);
                this.updateNextStepsContent(data.action.next_steps);
                // Switch to context tab to show the generated content
                this.switchTab('context');
                // Check save status after generating context
                this.checkAndUpdateSaveStatus();
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

    async generateNextSteps() {
        if (this.isLoading) return;
        
        this.setLoading('generate-next-steps-btn', true);
        
        try {
            const response = await fetch(`/api/actions/${this.currentAction.data.action_id}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    next_steps: 'regenerate'
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.updateNextStepsContent(data.action.next_steps);
                // Switch to next steps tab to show the generated content
                this.switchTab('next-steps');
            } else {
                throw new Error('Failed to generate next steps');
            }
        } catch (error) {
            console.error('Error generating next steps:', error);
            this.showError('next-steps-content', 'Failed to generate next steps. Please try again.');
        } finally {
            this.setLoading('generate-next-steps-btn', false);
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

        content.innerHTML = `
            <div class="context-display">
                <div class="context-text">${this.formatContextText(context)}</div>
            </div>
        `;
    }

    updateNextStepsContent(nextSteps) {
        const content = document.getElementById('next-steps-content');
        
        if (!nextSteps) {
            content.innerHTML = `
                <div class="empty-state">
                    <p>Click "Generate Next Steps" to get specific, actionable steps for this action.</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="next-steps-display">
                <div class="next-steps-text">${this.formatNextStepsText(nextSteps)}</div>
            </div>
        `;
    }

    updateNotesContent(notes) {
        console.log('updateNotesContent called with:', notes);
        const content = document.getElementById('action-notes-content') || document.getElementById('notes-content');
        console.log('Notes content element:', content);
        
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
                <div class="note-content">${escapeHtml(note.note_content)}</div>
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
        console.log('showAddNoteForm called');
        const form = document.getElementById('add-note-form') || document.getElementById('add-action-note-form');
        const textarea = document.getElementById('note-textarea') || document.getElementById('action-note-textarea');
        console.log('Form element:', form);
        console.log('Textarea element:', textarea);
        if (form) {
            form.style.display = 'block';
            console.log('Form display set to block');
        }
        if (textarea) {
            textarea.focus();
            console.log('Textarea focused');
        }
    }

    hideAddNoteForm() {
        const form = document.getElementById('add-note-form') || document.getElementById('add-action-note-form');
        const textarea = document.getElementById('note-textarea') || document.getElementById('action-note-textarea');
        if (form) form.style.display = 'none';
        if (textarea) textarea.value = '';
    }

    async saveNote() {
        const textarea = document.getElementById('note-textarea') || document.getElementById('action-note-textarea');
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
                    note_content: noteContent
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Clear the textarea
                if (textarea) textarea.value = '';
                this.hideAddNoteForm();
                // Reload notes to show new note
                this.updateNotesContent(data.notes);
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

    async saveToWorkspace() {
        if (!this.currentAction.data.action_id) {
            alert('Please generate context first before saving to workspace.');
            return;
        }

        try {
            const response = await fetch(`/api/actions/${this.currentAction.data.action_id}/save`, {
                method: 'POST'
            });

            if (response.ok) {
                this.updateSaveButtonState(true);
                this.showSuccessMessage('Action saved to workspace successfully!');
                
                // Reload workspace actions in dashboard
                if (typeof loadWorkspaceActions === 'function') {
                    loadWorkspaceActions();
                }
            } else {
                throw new Error('Failed to save action to workspace');
            }
        } catch (error) {
            console.error('Error saving action to workspace:', error);
            alert('Failed to save action to workspace. Please try again.');
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

    updateSaveButtonState(isSaved) {
        const saveBtn = document.getElementById('save-action-btn');
        if (!saveBtn) return;

        if (isSaved) {
            saveBtn.innerHTML = '✅ Saved to Workspace';
            saveBtn.disabled = true;
            saveBtn.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
            saveBtn.style.color = '#059669';
            saveBtn.title = 'Action is saved to workspace';
        } else {
            saveBtn.innerHTML = '💾 Save to Workspace';
            saveBtn.disabled = false;
            saveBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            saveBtn.style.color = 'white';
            saveBtn.title = 'Save this action to your workspace';
        }
    }

    checkAndUpdateSaveStatus() {
        if (!this.currentAction?.data?.action_id) return;
        
        // Check if this action is saved to workspace
        fetch('/api/actions/workspace')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const isSaved = data.actions.some(action => 
                        action.action_id === this.currentAction.data.action_id
                    );
                    this.updateSaveButtonState(isSaved);
                }
            })
            .catch(error => {
                console.error('Error checking save status:', error);
                this.updateSaveButtonState(false);
            });
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
}

// Initialize the modal when the page loads
let exploreActionModal;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing ExploreActionModal...');
    try {
        exploreActionModal = new ExploreActionModal();
        console.log('ExploreActionModal initialized successfully');
        window.exploreActionModal = exploreActionModal; // Make it globally available
    } catch (error) {
        console.error('Error initializing ExploreActionModal:', error);
    }
});

// Export for use in other modules
window.ExploreActionModal = ExploreActionModal;
