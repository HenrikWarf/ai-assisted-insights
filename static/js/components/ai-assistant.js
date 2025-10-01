/**
 * AI Assistant Component
 * 
 * This module provides an AI Assistant interface for asking questions about specific
 * action plan steps or context sections.
 */
console.log('AI Assistant component loading...');

class AIAssistant {
    constructor(container, actionId, targetType, targetId, targetData = {}) {
        if (!container) {
            throw new Error('A container element must be provided for the AI Assistant.');
        }
        this.container = container;
        this.actionId = actionId;
        this.targetType = targetType; // 'step' or 'context'
        this.targetId = targetId;
        this.targetData = targetData; // step data or context section data
        this.conversations = [];
        this.isLoading = false;

        this.render();
        this.bindEvents();
        this.loadExistingConversations();
    }

    render() {
        const targetName = this.targetType === 'step' 
            ? `Step: ${this.targetData.title || 'Untitled Step'}`
            : `Context: ${this.targetData.name || 'Section'}`;

        this.container.innerHTML = `
            <details class="ai-assistant-details">
                <summary class="ai-assistant-summary">💬 Ask AI Assistant</summary>
                <div class="ai-assistant-content">
                    <div class="ai-assistant-header">
                        <h6 class="ai-assistant-target">${targetName}</h6>
                        <p class="ai-assistant-description">Ask questions about this ${this.targetType} to get AI-powered insights and guidance.</p>
                    </div>
                    
                    <div class="ai-question-form">
                        <textarea 
                            class="ai-question-input" 
                            placeholder="Ask a question about this ${this.targetType}..."
                            rows="3"
                        ></textarea>
                        <div class="ai-question-actions">
                            <button class="btn btn-primary btn-sm ai-ask-btn" disabled>
                                <span class="ai-ask-icon">🤖</span> Ask AI
                            </button>
                        </div>
                    </div>
                    
                    <div class="ai-conversations-list">
                        <!-- Conversations will be rendered here -->
                    </div>
                    
                    <div class="ai-loading" style="display: none;">
                        <div class="ai-loading-spinner"></div>
                        <p>AI is thinking...</p>
                    </div>
                </div>
            </details>
        `;
    }

    bindEvents() {
        const questionInput = this.container.querySelector('.ai-question-input');
        const askBtn = this.container.querySelector('.ai-ask-btn');

        // Enable/disable ask button based on input
        questionInput.addEventListener('input', () => {
            const hasQuestion = questionInput.value.trim().length > 0;
            askBtn.disabled = !hasQuestion || this.isLoading;
        });

        // Handle ask button click
        askBtn.addEventListener('click', () => {
            const question = questionInput.value.trim();
            if (question && !this.isLoading) {
                this.askQuestion(question);
                questionInput.value = '';
                askBtn.disabled = true;
            }
        });

        // Handle Enter key in textarea (Shift+Enter for new line, Enter to submit)
        questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const question = questionInput.value.trim();
                if (question && !this.isLoading) {
                    this.askQuestion(question);
                    questionInput.value = '';
                    askBtn.disabled = true;
                }
            }
        });
    }

    async askQuestion(question) {
        if (this.isLoading) return;
        
        this.setLoading(true);

        try {
            const response = await fetch(`/api/actions/${this.actionId}/ai-assistant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question,
                    target_type: this.targetType,
                    target_id: this.targetId
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('AI Assistant response:', data);
                
                if (data.success && data.conversation) {
                    this.conversations.push(data.conversation);
                    this.renderConversations();
                    
                    // Open the accordion if it's closed
                    const details = this.container.querySelector('details');
                    if (details && !details.open) {
                        details.open = true;
                    }
                } else {
                    this.displayError('Failed to get AI response');
                }
            } else {
                console.error('AI Assistant response not ok:', response.status, response.statusText);
                this.displayError(`Failed to get AI response: ${response.status}`);
            }
        } catch (error) {
            console.error('Error asking AI Assistant:', error);
            this.displayError('Network error occurred');
        } finally {
            this.setLoading(false);
        }
    }

    async deleteConversation(conversationId) {
        try {
            const response = await fetch(`/api/actions/${this.actionId}/ai-assistant/${conversationId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.conversations = this.conversations.filter(conv => conv.id !== conversationId);
                this.renderConversations();
            } else {
                console.error('Failed to delete conversation:', response.status);
                this.displayError('Failed to delete conversation');
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            this.displayError('Network error occurred');
        }
    }

    loadExistingConversations() {
        // This will be called after the data is loaded from the backend
        // The conversations are passed in when the component is initialized
        const targetKey = `${this.targetType}_${this.targetId}`;
        
        // For now, we'll load conversations from the action data if available
        // This will be improved when we implement data loading
        console.log(`Loading existing conversations for ${targetKey}`);
    }

    setExistingConversations(conversations) {
        this.conversations = conversations || [];
        this.renderConversations();
    }

    renderConversations() {
        const conversationsList = this.container.querySelector('.ai-conversations-list');
        
        if (this.conversations.length === 0) {
            conversationsList.innerHTML = '';
            return;
        }

        const conversationsHtml = this.conversations.map(conversation => {
            const timestamp = new Date(conversation.timestamp).toLocaleString();
            return `
                <div class="ai-conversation" data-conversation-id="${conversation.id}">
                    <div class="ai-conversation-header">
                        <div class="ai-conversation-meta">
                            <span class="ai-conversation-time">${timestamp}</span>
                            <button class="ai-conversation-delete" title="Delete conversation">
                                <span class="ai-delete-icon">🗑️</span>
                            </button>
                        </div>
                    </div>
                    <div class="ai-conversation-content">
                        <div class="ai-question">
                            <div class="ai-message-label">Question:</div>
                            <div class="ai-message-text">${this.escapeHtml(conversation.question)}</div>
                        </div>
                        <div class="ai-response">
                            <div class="ai-message-label-container">
                                <div class="ai-message-label">AI Response:</div>
                                <button class="ai-copy-response-btn" title="Copy AI response" data-conversation-id="${conversation.id}">
                                    <span class="ai-copy-icon">📋</span>
                                </button>
                            </div>
                            <div class="ai-message-text">${this.formatResponse(conversation.response)}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        conversationsList.innerHTML = conversationsHtml;

        // Bind delete button events
        conversationsList.querySelectorAll('.ai-conversation-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const conversationId = e.target.closest('.ai-conversation').dataset.conversationId;
                if (confirm('Are you sure you want to delete this conversation?')) {
                    this.deleteConversation(conversationId);
                }
            });
        });

        // Bind copy response button events
        conversationsList.querySelectorAll('.ai-copy-response-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const conversationId = button.dataset.conversationId;
                const conversation = this.conversations.find(conv => conv.id === conversationId);
                if (conversation) {
                    this.copyResponseToClipboard(conversation.response, button);
                }
            });
        });
    }

    formatResponse(response, type = 'ai-response') {
        // Reuse the same formatting logic from CommunicationGenerator
        let cleaned = response.trim();
        
        // Remove markdown code block wrappers if present
        cleaned = cleaned.replace(/^```[\w]*\n|```$/g, '');
        
        // Convert basic markdown formatting to HTML
        const formatter = this.getResponseFormatter();
        let formatted = formatter(cleaned);
        
        // Clean up any malformed HTML
        formatted = formatted
            .replace(/<p><\/p>/g, '') // Remove empty paragraphs
            .replace(/<p>(<[^>]+>)/g, '$1<p>') // Fix paragraph tags around HTML elements
            .replace(/(<\/[^>]+>)<\/p>/g, '$1') // Fix closing paragraph tags
            .replace(/<ul><ul>/g, '<ul>') // Fix nested lists
            .replace(/<\/ul><\/ul>/g, '</ul>'); // Fix nested lists
        
        return formatted;
    }

    getResponseFormatter() {
        return (text) => {
            // First, handle headers (must come before other formatting)
            let formatted = text
                .replace(/^##### (.+)$/gm, '<h6>$1</h6>') // H5 headers
                .replace(/^#### (.+)$/gm, '<h5>$1</h5>') // H4 headers
                .replace(/^### (.+)$/gm, '<h4>$1</h4>') // H3 headers
                .replace(/^## (.+)$/gm, '<h3>$1</h3>') // H2 headers
                .replace(/^# (.+)$/gm, '<h2>$1</h2>'); // H1 headers

            // Handle bold and italic (process in specific order to avoid conflicts)
            formatted = formatted
                .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>') // Bold + italic first
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // Bold
                .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>') // Italic (single asterisks, avoiding **)
                .replace(/_([^_\n]+?)_/g, '<em>$1</em>'); // Alternative italic with underscores

            // Handle code blocks and inline code
            formatted = formatted
                .replace(/```[\w]*\n([\s\S]*?)\n```/g, '<pre><code>$1</code></pre>') // Code blocks
                .replace(/`(.+?)`/g, '<code>$1</code>'); // Inline code

            // Handle lists with better spacing
            formatted = formatted
                .replace(/^[\-\*\+] (.+)$/gm, '<li>$1</li>') // Bullet points
                .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>'); // Numbered lists

            // Wrap consecutive list items in ul tags
            formatted = formatted.replace(/(<li>.*<\/li>(\n<li>.*<\/li>)*)/g, '<ul>$1</ul>');

            // Handle blockquotes
            formatted = formatted.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

            // Handle paragraphs - split on double newlines first
            const paragraphs = formatted.split(/\n\s*\n/);
            formatted = paragraphs.map(para => {
                // Don't wrap headers, lists, blockquotes, or code blocks in p tags
                if (para.match(/^<(?:h[1-6]|ul|ol|blockquote|pre|li)/)) {
                    return para;
                }
                // Convert single newlines to br tags within paragraphs
                const withBreaks = para.replace(/\n/g, '<br>');
                return withBreaks.trim() ? `<p>${withBreaks}</p>` : '';
            }).filter(para => para).join('\n');

            return formatted;
        };
    }

    copyResponseToClipboard(response, button) {
        // Copy the raw text content, not the HTML formatted version
        navigator.clipboard.writeText(response).then(() => {
            const originalIcon = button.querySelector('.ai-copy-icon');
            const originalText = originalIcon.textContent;
            
            // Show success feedback
            originalIcon.textContent = '✅';
            button.style.color = '#059669';
            
            // Reset after 2 seconds
            setTimeout(() => {
                originalIcon.textContent = originalText;
                button.style.color = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy AI response:', err);
            
            // Show error feedback
            const originalIcon = button.querySelector('.ai-copy-icon');
            const originalText = originalIcon.textContent;
            originalIcon.textContent = '❌';
            button.style.color = '#dc2626';
            
            // Reset after 2 seconds
            setTimeout(() => {
                originalIcon.textContent = originalText;
                button.style.color = '';
            }, 2000);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    displayError(message) {
        const conversationsList = this.container.querySelector('.ai-conversations-list');
        conversationsList.innerHTML = `
            <div class="ai-error">
                <span class="ai-error-icon">⚠️</span>
                <span class="ai-error-message">${message}</span>
            </div>
        `;
        setTimeout(() => {
            if (conversationsList.querySelector('.ai-error')) {
                this.renderConversations();
            }
        }, 3000);
    }

    setLoading(isLoading) {
        this.isLoading = isLoading;
        const loadingDiv = this.container.querySelector('.ai-loading');
        const askBtn = this.container.querySelector('.ai-ask-btn');
        const questionInput = this.container.querySelector('.ai-question-input');
        
        loadingDiv.style.display = isLoading ? 'block' : 'none';
        askBtn.disabled = isLoading || questionInput.value.trim().length === 0;
        questionInput.disabled = isLoading;

        if (isLoading) {
            askBtn.innerHTML = '<span class="ai-ask-icon">⏳</span> Thinking...';
        } else {
            askBtn.innerHTML = '<span class="ai-ask-icon">🤖</span> Ask AI';
        }
    }
}

// Export for use in other modules
window.AIAssistant = AIAssistant;
console.log('AI Assistant class exported to window:', !!window.AIAssistant);
