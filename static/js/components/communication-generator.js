/**
 * Communication Generator Component
 * 
 * This module provides a UI for generating various communication drafts (email, Slack, slide)
 * related to a specific action plan task.
 */
console.log('CommunicationGenerator component loading...');
console.log('Script path: /static/js/components/communication-generator.js');
console.log('Current timestamp:', new Date().toISOString());

class CommunicationGenerator {
    constructor(container, actionId, step) {
        if (!container) {
            throw new Error('A container element must be provided for the CommunicationGenerator.');
        }
        this.container = container;
        this.actionId = actionId;
        this.step = step;
        this.taskId = step.id;
        this.isLoading = false;

        this.render();
        this.bindEvents();
        this.loadExistingCommunications();
    }

    render() {
        this.container.innerHTML = `
            <details class="communication-generator-details">
                <summary class="communication-generator-summary">Communication Assistance</summary>
                <div class="communication-generator-content">
                    <div class="communication-options">
                        <button class="btn btn-secondary btn-sm" data-type="email"><span>📧</span> Draft Email</button>
                        <button class="btn btn-secondary btn-sm" data-type="slack"><span>💬</span> Draft Slack Message</button>
                        <button class="btn btn-secondary btn-sm" data-type="slide"><span>🖥️</span> Draft Presentation Slide</button>
                    </div>
                    <div class="communication-display" style="display: none;">
                        <div class="communication-header">
                            <h5 class="communication-title"></h5>
                            <button class="btn btn-secondary btn-sm copy-communication-btn">Copy</button>
                        </div>
                        <div class="communication-text"></div>
                    </div>
                    <div class="communication-loading" style="display: none;">
                        <p>Generating...</p>
                    </div>
                </div>
            </details>
        `;
    }

    bindEvents() {
        this.container.querySelectorAll('.communication-options button').forEach(button => {
            button.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                this.generateCommunication(type);
            });
        });

        const copyBtn = this.container.querySelector('.copy-communication-btn');
        copyBtn.addEventListener('click', () => this.copyToClipboard());
    }

    async generateCommunication(type) {
        if (this.isLoading) return;
        this.setLoading(true);

        try {
            const response = await fetch(`/api/actions/${this.actionId}/steps/${this.taskId}/generate-communication`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Communication response data:', data);
                this.displayCommunication(data.content, type);
            } else {
                console.error('Response not ok:', response.status, response.statusText);
                throw new Error(`Failed to generate ${type}.`);
            }
        } catch (error) {
            console.error('Error generating communication:', error);
            this.displayError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    displayCommunication(content, type) {
        console.log('displayCommunication called with:', { content, type });
        const displayDiv = this.container.querySelector('.communication-display');
        const titleEl = this.container.querySelector('.communication-title');
        const textEl = this.container.querySelector('.communication-text');

        console.log('DOM elements found:', { displayDiv: !!displayDiv, titleEl: !!titleEl, textEl: !!textEl });

        const titles = {
            email: "Draft Email",
            slack: "Draft Slack Message",
            slide: "Draft Presentation Slide"
        };
        
        titleEl.textContent = titles[type] || "Generated Content";
        
        // Format the content based on type and content structure
        const formattedContent = this.formatContent(content, type);
        textEl.innerHTML = formattedContent;
        
        displayDiv.style.display = 'block';

        console.log('Content set, display shown. Element visibility:', {
            displayDivStyle: displayDiv.style.display,
            textContent: textEl.textContent.substring(0, 50) + '...'
        });

        // Keep accordion closed by default - user can open manually if needed
        console.log('Content displayed, accordion remains closed by default');
    }

    displayError(message) {
        const displayDiv = this.container.querySelector('.communication-display');
        const textEl = this.container.querySelector('.communication-text');
        
        textEl.textContent = message;
        displayDiv.style.display = 'block';
    }

    formatContent(content, type) {
        // Clean up the content and handle different formatting needs
        let cleaned = content.trim();
        
        // Remove markdown code block wrappers if present
        cleaned = cleaned.replace(/^```[\w]*\n|```$/g, '');
        
        // Convert basic markdown formatting to HTML
        const formatters = {
            email: (text) => {
                // Format emails with proper line breaks and structure
                return text
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
                    .replace(/^Subject: (.+)$/gm, '<div class="email-subject"><strong>Subject:</strong> $1</div>') // Subject line
                    .replace(/^(To|From|Cc|Bcc): (.+)$/gm, '<div class="email-header"><strong>$1:</strong> $2</div>') // Email headers
                    .replace(/\n\n/g, '</p><p>') // Paragraphs
                    .replace(/\n/g, '<br>') // Line breaks
                    .replace(/^(.)/gm, '<p>$1') // Start paragraphs
                    .replace(/(.)\n/g, '$1</p>'); // End paragraphs
            },
            slack: (text) => {
                // Format Slack messages with emojis and mentions
                return text
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
                    .replace(/@(\w+)/g, '<span class="slack-mention">@$1</span>') // Mentions
                    .replace(/#(\w+)/g, '<span class="slack-channel">#$1</span>') // Channels
                    .replace(/\n/g, '<br>'); // Line breaks
            },
            slide: (text) => {
                // Format presentation slides with bullet points and structure
                return text
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
                    .replace(/^[\-\*\+] (.+)$/gm, '<li>$1</li>') // Bullet points
                    .replace(/^(\d+\.) (.+)$/gm, '<li>$1 $2</li>') // Numbered lists
                    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>') // Wrap lists
                    .replace(/^# (.+)$/gm, '<h3>$1</h3>') // Headers
                    .replace(/^## (.+)$/gm, '<h4>$1</h4>') // Sub-headers
                    .replace(/\n\n/g, '</p><p>') // Paragraphs
                    .replace(/\n/g, '<br>') // Line breaks
                    .replace(/^([^<])/gm, '<p>$1') // Start paragraphs
                    .replace(/([^>])\n/g, '$1</p>'); // End paragraphs
            }
        };
        
        const formatter = formatters[type] || ((text) => text.replace(/\n/g, '<br>'));
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

    copyToClipboard() {
        const content = this.container.querySelector('.communication-text').textContent;
        navigator.clipboard.writeText(content).then(() => {
            const copyBtn = this.container.querySelector('.copy-communication-btn');
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        });
    }

    setLoading(isLoading) {
        this.isLoading = isLoading;
        const loadingDiv = this.container.querySelector('.communication-loading');
        const optionsDiv = this.container.querySelector('.communication-options');
        
        loadingDiv.style.display = isLoading ? 'block' : 'none';
        optionsDiv.style.display = isLoading ? 'none' : 'block';
        // Don't hide the communication display when loading finishes - let displayCommunication control it
    }

    loadExistingCommunications() {
        // Check if there are any previously generated communications
        if (this.step.generated_communications) {
            const comms = this.step.generated_communications;
            // Load the most recent communication or prioritize email > slack > slide
            const priority = ['email', 'slack', 'slide'];
            for (const type of priority) {
                if (comms[type]) {
                    console.log(`Loading existing ${type} communication:`, comms[type]);
                    this.displayCommunication(comms[type], type);
                    // Keep accordion closed by default even with existing content
                    break;
                }
            }
        }
    }
}

// Export for use in other modules
window.CommunicationGenerator = CommunicationGenerator;
console.log('CommunicationGenerator class exported to window:', !!window.CommunicationGenerator);
