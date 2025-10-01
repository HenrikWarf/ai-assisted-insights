/**
 * Query Generator Component
 * 
 * This module provides a UI for generating, displaying, and copying AI-generated
 * SQL queries related to a specific action plan task.
 */
console.log('QueryGenerator component loading...');

class QueryGenerator {
    constructor(container, actionId, step) {
        if (!container) {
            throw new Error('A container element must be provided for the QueryGenerator.');
        }
        this.container = container;
        this.actionId = actionId;
        this.step = step;
        this.taskId = step.id;
        this.isLoading = false;

        this.render();
        this.bindEvents();

        if (this.step.generated_query && this.step.generated_query_explanation) {
            this.displayQuery(this.step.generated_query_explanation, this.step.generated_query);
        }
    }

    render() {
        this.container.innerHTML = `
            <details class="query-generator-details">
                <summary class="query-generator-summary">SQL Query Assistance</summary>
                <div class="query-generator-content">
                    <button class="btn btn-secondary btn-sm generate-query-btn">
                        <span>🤖</span> Generate SQL Query
                    </button>
                    <div class="query-display" style="display: none;">
                        <p class="query-explanation"></p>
                        <pre><code class="language-sql"></code></pre>
                        <button class="btn btn-secondary btn-sm copy-query-btn">Copy</button>
                    </div>
                </div>
            </details>
        `;
    }

    bindEvents() {
        const generateBtn = this.container.querySelector('.generate-query-btn');
        generateBtn.addEventListener('click', () => this.generateQuery());

        const copyBtn = this.container.querySelector('.copy-query-btn');
        copyBtn.addEventListener('click', () => this.copyToClipboard());
    }

    async generateQuery() {
        if (this.isLoading) return;
        this.setLoading(true);

        try {
            const response = await fetch(`/api/actions/${this.actionId}/steps/${this.taskId}/generate-query`, {
                method: 'POST'
            });

            if (response.ok) {
                const data = await response.json();
                this.displayQuery(data.explanation, data.sql_query);
            } else {
                throw new Error('Failed to generate query.');
            }
        } catch (error) {
            console.error('Error generating query:', error);
            this.displayError('Could not generate query. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    displayQuery(explanation, query) {
        const displayDiv = this.container.querySelector('.query-display');
        const explanationP = this.container.querySelector('.query-explanation');
        const codeElement = this.container.querySelector('code');
        const generateBtn = this.container.querySelector('.generate-query-btn');
        
        explanationP.textContent = explanation;
        codeElement.textContent = query;
        displayDiv.style.display = 'block';

        generateBtn.innerHTML = `<span>🤖</span> Regenerate SQL Query`;

        // If Prism.js is available for syntax highlighting
        if (window.Prism) {
            Prism.highlightElement(codeElement);
        }
    }

    displayError(message) {
        const displayDiv = this.container.querySelector('.query-display');
        displayDiv.innerHTML = `<p class="error-text">${message}</p>`;
        displayDiv.style.display = 'block';
    }

    copyToClipboard() {
        const query = this.container.querySelector('code').textContent;
        navigator.clipboard.writeText(query).then(() => {
            const copyBtn = this.container.querySelector('.copy-query-btn');
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        });
    }

    setLoading(isLoading) {
        this.isLoading = isLoading;
        const generateBtn = this.container.querySelector('.generate-query-btn');
        generateBtn.disabled = isLoading;
        generateBtn.innerHTML = isLoading 
            ? '<span>⏳</span> Generating...' 
            : '<span>🤖</span> Generate SQL Query';
    }
}
