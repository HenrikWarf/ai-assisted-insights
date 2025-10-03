/**
 * Modal management and custom visualization functionality
 */

let currentEditingChartId = null;

/**
 * Opens the custom visualization modal for creating or editing charts
 * @param {string|null} chartId - Chart ID to edit, or null for new chart
 */
function openCustomVizModal(chartId = null) {
  currentEditingChartId = chartId;
  const modal = document.getElementById('custom-viz-modal');
  const modalTitle = document.getElementById('custom-viz-title');
  const descriptionInput = document.getElementById('custom-viz-input');
  const generateBtn = document.getElementById('custom-viz-generate');
  const enhancedInsightsCheckbox = document.getElementById('enhanced-insights-checkbox');
  
  if (!modal || !modalTitle || !descriptionInput || !generateBtn) {
    console.error('Custom viz modal elements not found');
    return;
  }
  
  // Clear form and reset checkbox to default (checked)
  descriptionInput.value = '';
  if (enhancedInsightsCheckbox) {
    enhancedInsightsCheckbox.checked = true;  // Reset to default checked state
  }
  
  // Update UI based on mode
  if (chartId) {
    // Edit mode
    modalTitle.textContent = 'Edit Visualization';
    generateBtn.textContent = 'Update Chart';
    generateBtn.style.backgroundColor = '#059669';
    
    // Leave description input empty for user to enter new description
  } else {
    // Create mode
    modalTitle.textContent = 'Add Custom Visualization';
    generateBtn.textContent = 'Generate Visualization';
    generateBtn.style.backgroundColor = '#3b82f6';
  }
  
  modal.style.display = 'flex';
  descriptionInput.focus();
}

/**
 * Closes the custom visualization modal
 */
function closeCustomVizModal() {
  const modal = document.getElementById('custom-viz-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  currentEditingChartId = null;
}

/**
 * Generates or updates a custom visualization
 */
async function generateCustomVisualization() {
  const descriptionInput = document.getElementById('custom-viz-input');
  const generateBtn = document.getElementById('custom-viz-generate');
  const enhancedInsightsCheckbox = document.getElementById('enhanced-insights-checkbox');
  
  if (!descriptionInput || !generateBtn) {
    console.error('Custom viz form elements not found');
    return;
  }
  
  const chartDescription = descriptionInput.value.trim();
  
  if (!chartDescription) {
    alert('Please provide a description for the visualization');
    return;
  }
  
  // Read checkbox state - default to false if checkbox not found to respect user's choice
  const generateInsights = enhancedInsightsCheckbox ? enhancedInsightsCheckbox.checked : false;
  console.log('Generate insights checkbox state:', generateInsights);
  
  // Disable button and show loading state
  const originalText = generateBtn.textContent;
  generateBtn.textContent = 'Generating...';
  generateBtn.disabled = true;
  
  try {
    const roleName = window.__CUSTOM_ROLE_NAME__;
    if (!roleName) {
      throw new Error('No custom role name found');
    }
    
    const payload = {
      role_name: roleName,
      description: chartDescription,
      generate_insights: generateInsights
    };
    
    if (currentEditingChartId) {
      payload.chart_id = currentEditingChartId;
    }
    
    const response = await fetch('/api/custom_role/create_visualization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || 'Failed to generate visualization');
    }
    
    // Close modal
    closeCustomVizModal();
    
    // Refresh metrics to show new chart
    if (typeof loadCustomRoleMetrics === 'function') {
      await loadCustomRoleMetrics();
    } else {
      // Fallback: reload the page
      window.location.reload();
    }
    
    // Show success message
    showNotification(
      currentEditingChartId ? 'Chart updated successfully!' : 'Chart created successfully!',
      'success'
    );
    
  } catch (error) {
    console.error('Error generating visualization:', error);
    showNotification('Failed to generate visualization: ' + error.message, 'error');
  } finally {
    // Restore button state
    generateBtn.textContent = originalText;
    generateBtn.disabled = false;
  }
}

/**
 * Deletes a custom chart
 * @param {string} chartId - Chart ID to delete
 */
async function deleteCustomChart(chartId) {
  if (!confirm('Are you sure you want to delete this chart?')) {
    return;
  }
  
  try {
    const roleName = window.__CUSTOM_ROLE_NAME__;
    if (!roleName) {
      throw new Error('No custom role name found');
    }
    
    // Remove 'chart_' prefix if present for API call
    const apiChartId = chartId.startsWith('chart_') ? chartId.substring(6) : chartId;
    
    const response = await fetch('/api/custom_role/delete_chart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role_name: roleName,
        chart_id: apiChartId
      })
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || 'Failed to delete chart');
    }
    
    // Refresh metrics to remove deleted chart
    await loadCustomRoleMetrics();
    
    showNotification('Chart deleted successfully!', 'success');
    
  } catch (error) {
    console.error('Error deleting chart:', error);
    showNotification('Failed to delete chart: ' + error.message, 'error');
  }
}

/**
 * Shows a notification message to the user
 * @param {string} message - Notification message
 * @param {string} type - Notification type ('success', 'error', 'info')
 */
function showNotification(message, type = 'info') {
  // Remove any existing notifications
  const existing = document.querySelector('.notification');
  if (existing) {
    existing.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Style the notification
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease-out;
  `;
  
  // Set background color based on type
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6'
  };
  notification.style.backgroundColor = colors[type] || colors.info;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

/**
 * Initializes modal event listeners
 */
function initializeModalListeners() {
  // Custom visualization modal
  const customVizModal = document.getElementById('custom-viz-modal');
  const customVizClose = document.getElementById('custom-viz-close');
  const customVizCancel = document.getElementById('custom-viz-cancel');
  const customVizGenerate = document.getElementById('custom-viz-generate');
  
  if (customVizClose) {
    customVizClose.addEventListener('click', closeCustomVizModal);
  }
  
  if (customVizCancel) {
    customVizCancel.addEventListener('click', closeCustomVizModal);
  }
  
  if (customVizGenerate) {
    customVizGenerate.addEventListener('click', generateCustomVisualization);
  }
  
  // Close modal when clicking outside
  if (customVizModal) {
    customVizModal.addEventListener('click', (e) => {
      if (e.target === customVizModal) {
        closeCustomVizModal();
      }
    });
  }
  
  // Handle edit/delete chart buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-chart-btn')) {
      const chartId = e.target.dataset.chartId;
      openCustomVizModal(chartId);
    } else if (e.target.classList.contains('delete-chart-btn')) {
      const chartId = e.target.dataset.chartId;
      deleteCustomChart(chartId);
    }
  });
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Export functions to global scope
window.initializeModalListeners = initializeModalListeners;
window.openCustomVizModal = openCustomVizModal;
window.closeCustomVizModal = closeCustomVizModal;
window.generateCustomVisualization = generateCustomVisualization;
window.deleteCustomChart = deleteCustomChart;
window.showNotification = showNotification;
