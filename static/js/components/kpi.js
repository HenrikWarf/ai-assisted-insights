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
  const containerId = gridType === 'short-term' ? 'short-term-grid' : 'long-term-grid';
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Priority container not found: ${containerId}`);
    return;
  }

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
  card.setAttribute('data-grid-type', gridType);
  card.setAttribute('data-category', priority.category || 'general');

  // Get category class for chip styling
  const categoryClass = priority.category ? `cat-${priority.category.toLowerCase().replace(/\s+/g, '-')}` : '';

  card.innerHTML = `
    <div class="title">
      <div class="icon-circle">${index}</div>
      <span>${escapeHtml(priority.title || 'Untitled Priority')}</span>
    </div>
    <div class="chips">
      <div class="chip ${categoryClass}">
        <span class="dot"></span>
        <span>${escapeHtml(priority.category || 'General')}</span>
      </div>
    </div>
    <div class="body">
      ${escapeHtml(priority.why || 'No description available')}
    </div>
    <div class="priority-actions">
      <button class="btn-explore-act" 
              data-priority-index="${index}" 
              data-grid-type="${gridType}"
              title="Explore this priority in detail">
        🔍 Explore & Act
      </button>
    </div>
  `;

  // Add click handler for the explore button
  const exploreBtn = card.querySelector('.btn-explore-act');
  if (exploreBtn) {
    exploreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPriorityModal(priority, index, gridType);
    });
  }

  return card;
}

/**
 * Opens the Priority Explore Modal for a specific priority
 * @param {Object} priorityData - Priority data object
 * @param {number} priorityIndex - Priority index (1-based)
 * @param {string} gridType - Type of grid ('short-term' or 'long-term')
 */
function openPriorityModal(priorityData, priorityIndex, gridType) {
  if (!window.priorityExploreModal) {
    console.error('PriorityExploreModal not initialized');
    if (window.showNotification) {
      showNotification('Priority explore modal not available', 'error');
    }
    return;
  }

  console.log('Opening priority modal for:', priorityData.title);
  
  // Open the modal with the priority data
  window.priorityExploreModal.open(priorityData, priorityIndex, gridType);
}

/**
 * Clears all priority cards from both short-term and long-term containers
 */
function clearPriorityCards() {
  const shortTermGrid = document.getElementById('short-term-grid');
  const longTermGrid = document.getElementById('long-term-grid');
  
  if (shortTermGrid) {
    shortTermGrid.innerHTML = '';
  }
  
  if (longTermGrid) {
    longTermGrid.innerHTML = '';
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
