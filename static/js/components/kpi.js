/**
 * KPI Card rendering and management
 */

/**
 * Creates a KPI card HTML element with trend information
 * @param {string} title - KPI title
 * @param {number} value - Current value
 * @param {number} previousValue - Previous value for trend calculation
 * @param {string} type - Value type for formatting
 * @param {string} unit - Unit suffix
 * @param {boolean} invert - Whether to invert trend colors (e.g., for error rates)
 * @returns {string} HTML string for the KPI card
 */
function createKPICard(title, value, previousValue, type = 'number', unit = '', invert = false) {
  const trend = calculateTrend(value, previousValue);
  const formattedValue = formatNumber(value, type) + unit;
  const trendText = previousValue ? `${trend.change.toFixed(1)}% vs last month` : '';
  const trendClass = (() => {
    if (trend.direction === 'neutral') return 'trend-neutral';
    if (!invert) return trend.direction === 'up' ? 'trend-up' : 'trend-down';
    return trend.direction === 'up' ? 'trend-down' : 'trend-up';
  })();
  
  return `
    <div class="kpi-card">
      <div class="kpi-title">${title}</div>
      <div class="kpi-value">${formattedValue}</div>
      <div class="kpi-trend ${trendClass}">
        ${trend.direction !== 'neutral' ? `<span class="trend-arrow">${trend.direction === 'up' ? '↗' : '↘'}</span>` : ''}
        ${trendText}
      </div>
    </div>
  `;
}

/**
 * Renders priority cards for analysis results
 * @param {Array} priorities - Array of priority objects
 * @param {string} gridType - Type of grid ('short-term' or 'long-term')
 */
function renderPriorityCards(priorities, gridType = 'short-term') {
  const containerId = gridType === 'short-term' ? 'short-term-priorities' : 'long-term-priorities';
  const container = document.getElementById(containerId);
  if (!container) return;

  // Clear existing cards
  container.innerHTML = '';

  if (!priorities || priorities.length === 0) {
    container.innerHTML = '<div class="no-priorities">No priorities identified</div>';
    return;
  }

  priorities.forEach((priority, index) => {
    const priorityCard = createPriorityCard(priority, index + 1, gridType);
    container.appendChild(priorityCard);
  });
}

/**
 * Creates a priority card element
 * @param {Object} priority - Priority object with title, why, category, evidence
 * @param {number} index - Priority index (1-based)
 * @param {string} gridType - Type of grid
 * @returns {HTMLElement} Priority card element
 */
function createPriorityCard(priority, index, gridType) {
  const card = document.createElement('div');
  card.className = 'priority-card';
  card.setAttribute('data-priority', index);
  card.setAttribute('data-category', priority.category || 'general');

  const evidenceHtml = priority.evidence ? 
    Object.entries(priority.evidence)
      .map(([key, value]) => `<div class="evidence-item"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</div>`)
      .join('') : '';

  card.innerHTML = `
    <div class="priority-header">
      <div class="priority-number">${index}</div>
      <div class="priority-title">${escapeHtml(priority.title || 'Untitled Priority')}</div>
      <div class="priority-category">${escapeHtml(priority.category || 'general')}</div>
    </div>
    <div class="priority-content">
      <div class="priority-description">${escapeHtml(priority.why || 'No description available')}</div>
      ${evidenceHtml ? `<div class="priority-evidence">${evidenceHtml}</div>` : ''}
    </div>
  `;

  return card;
}

/**
 * Clears all priority cards from both short-term and long-term containers
 */
function clearPriorityCards() {
  const shortTermContainer = document.getElementById('short-term-priorities');
  const longTermContainer = document.getElementById('long-term-priorities');
  
  if (shortTermContainer) {
    shortTermContainer.innerHTML = '';
  }
  
  if (longTermContainer) {
    longTermContainer.innerHTML = '';
  }
}

/**
 * Renders summary text into a specified container
 * @param {HTMLElement} containerEl - Container element to render into
 * @param {string} summaryText - Summary text to render
 */
function renderSummaryInto(containerEl, summaryText) {
  if (!containerEl || !summaryText) return;
  
  // Split summary into paragraphs and render each as a separate paragraph
  const paragraphs = summaryText.split('\n\n').filter(p => p.trim());
  
  containerEl.innerHTML = paragraphs
    .map(paragraph => `<p>${escapeHtml(paragraph.trim())}</p>`)
    .join('');
}
