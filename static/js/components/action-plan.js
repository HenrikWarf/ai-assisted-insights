/**
 * Action Plan Component
 * 
 * This module renders and manages an interactive checklist for the "Next Steps"
 * of a given action. It handles state changes (e.g., marking tasks as complete)
 * and communicates with the backend to persist those changes.
 */
console.log('ActionPlan component loading...');

class ActionPlan {
    constructor(container, actionId, actionData = null) {
        if (!container) {
            throw new Error('A container element must be provided for the ActionPlan.');
        }
        this.container = container;
        this.actionId = actionId;
        this.actionData = actionData;
        this.steps = [];

        this.bindEvents();
    }

    /**
     * Renders the action plan into the container.
     * @param {Array} stepsData - The array of step objects from the backend.
     */
    render(stepsData) {
        this.steps = stepsData || [];
        
        if (this.steps.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <p>No next steps were generated. You can try generating context first.</p>
                </div>
            `;
            return;
        }

        const stepsHtml = this.steps.map((step, index) => this.renderStep(step, index)).join('');
        this.container.innerHTML = `<div class="action-plan-list">${stepsHtml}</div>`;

        // After rendering, initialize any QueryGenerator and AI Assistant components
        this.steps.forEach(step => {
            if (step.query_generation_enabled) {
                const queryGenContainer = this.container.querySelector(`#query-gen-${step.id}`);
                if (queryGenContainer) {
                    new QueryGenerator(queryGenContainer, this.actionId, step);
                }
            } else {
                const commsGenContainer = this.container.querySelector(`#comms-gen-${step.id}`);
                if (commsGenContainer) {
                    if (typeof CommunicationGenerator !== 'undefined') {
                        new CommunicationGenerator(commsGenContainer, this.actionId, step);
                    } else {
                        console.error('CommunicationGenerator class not found. Check if the script is loaded properly.');
                        commsGenContainer.innerHTML = '<p style="color: red;">Communication Generator not available. Please refresh the page.</p>';
                    }
                }
            }
            
            // Initialize AI Assistant for each step
            const aiAssistantContainer = this.container.querySelector(`#ai-assistant-${step.id}`);
            if (aiAssistantContainer) {
                if (typeof AIAssistant !== 'undefined') {
                    const aiAssistant = new AIAssistant(aiAssistantContainer, this.actionId, 'step', step.id, step);
                    
                    // Load existing conversations if they exist
                    if (this.actionData && this.actionData.ai_conversations) {
                        const conversations = JSON.parse(this.actionData.ai_conversations);
                        const stepConversations = conversations[`step_${step.id}`] || [];
                        aiAssistant.setExistingConversations(stepConversations);
                    }
                } else {
                    console.error('AIAssistant class not found. Check if the script is loaded properly.');
                    aiAssistantContainer.innerHTML = '<p style="color: red;">AI Assistant not available. Please refresh the page.</p>';
                }
            }
        });
    }

    renderStep(step, index) {
        const isCompleted = step.status === 'completed';
        const canGenerateQuery = step.query_generation_enabled;

        return `
            <div class="action-plan-step ${isCompleted ? 'completed' : ''}" data-step-id="${step.id}">
                <div class="step-header">
                    <span class="step-number-icon">📝</span>
                    <h4 class="step-number-title">Step ${index + 1}</h4>
                </div>
                <div class="step-main">
                    <input type="checkbox" id="step-${step.id}" class="step-checkbox" ${isCompleted ? 'checked' : ''}>
                    <label for="step-${step.id}" class="step-label">
                        <span class="step-title">${this.escapeHtml(step.title || 'Untitled Step')}</span>
                        <p class="step-description">${this.escapeHtml(step.description || '')}</p>
                    </label>
                </div>
                ${canGenerateQuery 
                    ? `<div class="query-generator-container" id="query-gen-${step.id}"></div>`
                    : `<div class="communication-generator-container" id="comms-gen-${step.id}"></div>`
                }
                <div class="ai-assistant-container" id="ai-assistant-${step.id}"></div>
            </div>
        `;
    }

    /**
     * Binds event listeners for interactivity.
     */
    bindEvents() {
        this.container.addEventListener('change', (e) => {
            if (e.target.classList.contains('step-checkbox')) {
                const stepElement = e.target.closest('.action-plan-step');
                const stepId = stepElement.dataset.stepId;
                const isCompleted = e.target.checked;
                
                this.updateTaskStatus(stepId, isCompleted);
            }
        });
    }

    /**
     * Updates the status of a step or sub-task.
     * @param {string} taskId - The unique ID of the task or sub-task.
     * @param {boolean} isCompleted - The new completion status.
     */
    async updateTaskStatus(taskId, isCompleted) {
        const newStatus = isCompleted ? 'completed' : 'pending';
        
        try {
            const response = await fetch(`/api/actions/${this.actionId}/steps/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: taskId,
                    status: newStatus
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Update the local state and re-render the specific step
                const stepIndex = this.steps.findIndex(s => s.id === taskId);
                if (stepIndex > -1) {
                    this.steps[stepIndex].status = newStatus;
                    const stepElement = this.container.querySelector(`[data-step-id="${taskId}"]`);
                    if (stepElement) {
                        stepElement.classList.toggle('completed', isCompleted);
                    }
                }
            } else {
                throw new Error('Failed to update task status');
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            // Optionally revert the checkbox state on error
            const checkbox = this.container.querySelector(`#step-${taskId}`);
            if (checkbox) {
                checkbox.checked = !isCompleted;
            }
            alert('Could not update task status. Please try again.');
        }
    }

    escapeHtml(v) {
        const div = document.createElement('div');
        div.textContent = String(v);
        return div.innerHTML;
    }
}
