/**
 * Utility functions for data formatting and manipulation
 */

/**
 * Formats numbers with appropriate suffixes and decimal places
 * @param {number} value - The value to format
 * @param {string} type - The type of formatting ('percentage', 'currency', 'decimal', 'integer', 'sentiment', 'nps')
 * @returns {string} Formatted number string
 */
function formatNumber(value, type = 'number') {
  if (value === null || value === undefined) return '—';
  
  switch (type) {
    case 'percentage':
      return (value * 100).toFixed(1) + '%';
    case 'currency':
      return '$' + value.toLocaleString();
    case 'decimal':
      return value.toFixed(2);
    case 'integer':
      return Math.round(value).toLocaleString();
    case 'sentiment':
      return value.toFixed(3); // Show 3 decimal places for sentiment (-1.000 to +1.000)
    case 'nps':
      return value.toFixed(1); // Show 1 decimal place for NPS (0.0 to 10.0)
    default:
      return value.toLocaleString();
  }
}

/**
 * Calculates trend direction and percentage change between two values
 * @param {number} current - Current value
 * @param {number} previous - Previous value for comparison
 * @returns {Object} Object with direction ('up', 'down', 'neutral') and change percentage
 */
function calculateTrend(current, previous) {
  if (!previous || previous === 0) return { direction: 'neutral', change: 0 };
  
  const change = ((current - previous) / previous) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  
  return { direction, change: Math.abs(change) };
}

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} s - String to escape
 * @returns {string} HTML-escaped string
 */
function escapeHtml(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
}

/**
 * Formats a number as a percentage with proper rounding
 * @param {number} n - Number to format as percentage
 * @returns {string} Formatted percentage string
 */
function asPct(n) {
  if (typeof n !== 'number' || isNaN(n)) return '—';
  return (n * 100).toFixed(1) + '%';
}

/**
 * Gets the appropriate icon class for a column type
 * @param {string} type - Column type
 * @returns {string} CSS class name for the icon
 */
function getColumnIconClass(type) {
  const typeMap = {
    'INTEGER': 'fas fa-hashtag',
    'REAL': 'fas fa-calculator',
    'TEXT': 'fas fa-font',
    'DATETIME': 'fas fa-calendar-alt',
    'BOOLEAN': 'fas fa-toggle-on'
  };
  return typeMap[type] || 'fas fa-question';
}

/**
 * Gets the display text for a column type
 * @param {string} type - Column type
 * @returns {string} Human-readable type description
 */
function getColumnIconText(type) {
  const typeMap = {
    'INTEGER': 'Number',
    'REAL': 'Decimal',
    'TEXT': 'Text',
    'DATETIME': 'Date/Time',
    'BOOLEAN': 'True/False'
  };
  return typeMap[type] || 'Unknown';
}
