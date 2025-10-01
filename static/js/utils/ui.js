/**
 * DOM manipulation and UI utility functions
 */

/**
 * Updates metadata display elements with data freshness and record counts
 * @param {Object} data - Data object containing metrics and metadata
 */
function updateMetadata(data) {
  try {
    const isCustomRole = !!window.__CUSTOM_ROLE_NAME__;
    
    // Update data freshness
    const dataFreshnessEl = document.getElementById('data-freshness');
    if (dataFreshnessEl) {
      if (isCustomRole && data.metadata && data.metadata.created_at) {
        // For custom roles, use the role creation date
        const createdDate = new Date(data.metadata.created_at);
        dataFreshnessEl.textContent = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();
      } else if (!isCustomRole && data.metrics) {
        // For built-in roles, find latest data date
        let latestDate = null;
        const tables = ['campaign_kpis', 'ecom_funnel', 'sku_efficiency', 'creative_ctr'];
        for (const table of tables) {
          if (data.metrics[table] && data.metrics[table].length > 0) {
            const dates = data.metrics[table].map(row => row.day).filter(Boolean);
            if (dates.length > 0) {
              const maxDate = dates.reduce((a, b) => a > b ? a : b);
              if (!latestDate || maxDate > latestDate) {
                latestDate = maxDate;
              }
            }
          }
        }
        if (latestDate) {
          const date = new Date(latestDate);
          dataFreshnessEl.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        } else {
          dataFreshnessEl.textContent = 'Current';
        }
      } else {
        dataFreshnessEl.textContent = 'Current';
      }
    }
    
    // Update total records
    const totalRecordsEl = document.getElementById('total-records');
    if (totalRecordsEl) {
      if (isCustomRole && data.metadata && data.metadata.total_records !== undefined) {
        // For custom roles, use the stored total record count
        totalRecordsEl.textContent = data.metadata.total_records.toLocaleString();
      } else if (!isCustomRole && data.metrics) {
        // For built-in roles, count rows in specific tables
        let totalCount = 0;
        const tables = ['campaign_kpis', 'ecom_funnel', 'sku_efficiency', 'creative_ctr'];
        for (const table of tables) {
          if (data.metrics[table]) {
            totalCount += data.metrics[table].length;
          }
        }
        totalRecordsEl.textContent = totalCount.toLocaleString();
      } else {
        totalRecordsEl.textContent = '0';
      }
    }
  } catch (e) {
    console.error('Error updating metadata:', e);
  }
}

/**
 * Enhances KPI cards with icons and styling based on their content
 */
function enhanceKPICards() {
  const kpiCards = document.querySelectorAll('.kpi-card');
  
  kpiCards.forEach(card => {
    const titleElement = card.querySelector('.kpi-title');
    const valueElement = card.querySelector('.kpi-value');
    
    if (!titleElement || !valueElement) return;
    
    const title = titleElement.textContent.toLowerCase();
    const valueText = valueElement.textContent;
    
    // Extract numeric value for range analysis
    const numericValue = parseFloat(valueText.replace(/[^\d.-]/g, ''));
    
    // Determine icon based on title keywords
    let icon = 'default';
    if (title.includes('revenue') || title.includes('sales') || title.includes('income') || title.includes('profit')) {
      icon = 'revenue';
    } else if (title.includes('customer') || title.includes('user') || title.includes('visitor')) {
      icon = 'customers';
    } else if (title.includes('conversion') || title.includes('rate') || title.includes('percentage')) {
      icon = 'conversion';
    } else if (title.includes('retention') || title.includes('churn') || title.includes('repeat')) {
      icon = 'retention';
    } else if (title.includes('satisfaction') || title.includes('rating') || title.includes('score')) {
      icon = 'satisfaction';
    } else if (title.includes('growth') || title.includes('increase') || title.includes('growth')) {
      icon = 'growth';
    } else if (title.includes('efficiency') || title.includes('performance') || title.includes('speed')) {
      icon = 'efficiency';
    }
    
    // Determine value range for color coding
    let rangeClass = 'range-normal';
    if (!isNaN(numericValue)) {
      if (numericValue < 0) {
        rangeClass = 'range-negative';
      } else if (numericValue > 1000000) {
        rangeClass = 'range-high';
      } else if (numericValue > 100000) {
        rangeClass = 'range-medium';
      }
    }
    
    // Add icon and range classes
    card.classList.add(`kpi-icon-${icon}`, rangeClass);
    
    // Add icon element if not already present
    if (!card.querySelector('.kpi-icon')) {
      const iconElement = document.createElement('div');
      iconElement.className = 'kpi-icon';
      iconElement.innerHTML = getIconForType(icon);
      card.insertBefore(iconElement, titleElement);
    }
  });
}

/**
 * Gets the appropriate icon HTML for a KPI type
 * @param {string} type - KPI type
 * @returns {string} HTML string for the icon
 */
function getIconForType(type) {
  const icons = {
    revenue: '<i class="fas fa-dollar-sign"></i>',
    customers: '<i class="fas fa-users"></i>',
    conversion: '<i class="fas fa-percentage"></i>',
    retention: '<i class="fas fa-heart"></i>',
    satisfaction: '<i class="fas fa-smile"></i>',
    growth: '<i class="fas fa-chart-line"></i>',
    efficiency: '<i class="fas fa-tachometer-alt"></i>',
    default: '<i class="fas fa-chart-bar"></i>'
  };
  return icons[type] || icons.default;
}

/**
 * Initializes accordion functionality for collapsible sections
 */
function initAccordion() {
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const isOpen = content.style.display === 'block';
      
      // Close all other accordions
      document.querySelectorAll('.accordion-content').forEach(acc => {
        acc.style.display = 'none';
      });
      
      // Toggle current accordion
      content.style.display = isOpen ? 'none' : 'block';
      
      // Update header icon
      const icon = header.querySelector('.accordion-icon');
      if (icon) {
        icon.textContent = isOpen ? '▶' : '▼';
      }
    });
  });
}

/**
 * Forces all accordions to be closed
 */
function forceAccordionClosed() {
  document.querySelectorAll('.accordion-content').forEach(content => {
    content.style.display = 'none';
  });
  
  document.querySelectorAll('.accordion-icon').forEach(icon => {
    icon.textContent = '▶';
  });
}

// Export functions to global scope
window.enhanceKPICards = enhanceKPICards;
window.initAccordion = initAccordion;
