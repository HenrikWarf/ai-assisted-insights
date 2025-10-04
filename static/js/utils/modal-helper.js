/**
 * Modal helper utilities
 * Provides simple modal display functions
 */

/**
 * Show a simple modal with title and content
 * @param {string} title - Modal title
 * @param {string} content - Modal content (HTML)
 */
function showModal(title, content) {
  // Check if modal already exists
  let modal = document.getElementById('generic-modal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'generic-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="generic-modal-title"></h2>
          <button class="modal-close" id="generic-modal-close">&times;</button>
        </div>
        <div class="modal-body" id="generic-modal-body"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="generic-modal-ok">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('generic-modal-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    document.getElementById('generic-modal-ok').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
  
  // Set content
  document.getElementById('generic-modal-title').textContent = title;
  document.getElementById('generic-modal-body').innerHTML = content;
  
  // Show modal
  modal.style.display = 'block';
}

// Export for global use
window.showModal = showModal;

