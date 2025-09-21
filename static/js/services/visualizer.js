/**
 * Advanced Metrics Visualization System
 * Handles chart creation, data processing, and visualization rendering
 */
class MetricsVisualizer {
  constructor() {
    this.charts = new Map();
    this.kpiCards = new Map();
  }

  /**
   * Formats numbers with appropriate suffixes and decimal places
   * @param {number} value - The value to format
   * @param {string} type - The type of formatting ('percentage', 'currency', 'decimal', 'integer', 'sentiment', 'nps')
   * @returns {string} Formatted number string
   */
  formatNumber(value, type = 'number') {
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
  calculateTrend(current, previous) {
    if (!previous || previous === 0) return { direction: 'neutral', change: 0 };
    
    const change = ((current - previous) / previous) * 100;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    
    return { direction, change: Math.abs(change) };
  }

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
  createKPICard(title, value, previousValue, type = 'number', unit = '', invert = false) {
    const trend = this.calculateTrend(value, previousValue);
    const formattedValue = this.formatNumber(value, type) + unit;
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
   * Creates a Chart.js chart instance
   * @param {string} canvasId - ID of the canvas element
   * @param {string} type - Chart type ('line', 'bar', 'pie', etc.)
   * @param {Object} data - Chart data object
   * @param {Object} options - Chart options
   * @returns {Chart|null} Chart instance or null if canvas not found
   */
  createChart(canvasId, type, data, options = {}) {
    // Destroy any existing chart bound to this canvas to avoid stacking/resizing loops
    if (this.charts.has(canvasId)) {
      try { this.charts.get(canvasId).destroy(); } catch (_) {}
      this.charts.delete(canvasId);
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        }
      },
      scales: type !== 'pie' && type !== 'doughnut' ? {
        x: {
          display: true,
          grid: {
            display: false
          }
        },
        y: {
          display: true,
          grid: {
            color: '#f0f0f0'
          }
        }
      } : {}
    };

    const chartOptions = { ...defaultOptions, ...options };
    
    const chart = new Chart(ctx, {
      type: type,
      data: data,
      options: chartOptions
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  /**
   * Creates a funnel chart for e-commerce conversion data
   * @param {string} canvasId - ID of the canvas element
   * @param {Array|Object} funnelData - Funnel data (array of days or single day object)
   * @returns {Chart|null} Chart instance
   */
  createFunnelChart(canvasId, funnelData) {
    // Handle both single day data and array of days
    let aggregatedData;
    if (Array.isArray(funnelData)) {
      // Aggregate data over the selected time period
      aggregatedData = funnelData.reduce((acc, day) => {
        acc.sessions += day.sessions || 0;
        acc.pdp_views += day.pdp_views || 0;
        acc.add_to_cart += day.add_to_cart || 0;
        acc.checkouts += day.checkouts || 0;
        acc.purchases += day.purchases || 0;
        return acc;
      }, { sessions: 0, pdp_views: 0, add_to_cart: 0, checkouts: 0, purchases: 0 });
    } else {
      // Single day data - map field names
      aggregatedData = {
        sessions: funnelData.sessions || 0,
        pdp_views: funnelData.pdp_views || 0,
        add_to_cart: funnelData.add_to_cart || funnelData.atc || 0,
        checkouts: funnelData.checkouts || funnelData.checkout || 0,
        purchases: funnelData.purchases || funnelData.purchase || 0
      };
    }

    const labels = ['Sessions', 'PDP Views', 'ATC', 'Checkout', 'Purchase'];
    const values = [
      aggregatedData.sessions,
      aggregatedData.pdp_views,
      aggregatedData.add_to_cart,
      aggregatedData.checkouts,
      aggregatedData.purchases
    ];

    const data = {
      labels: labels,
      datasets: [{
        label: 'Funnel Steps',
        data: values,
        backgroundColor: [
          '#3b82f6',
          '#8b5cf6',
          '#06b6d4',
          '#10b981',
          '#f59e0b'
        ],
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    };

    return this.createChart(canvasId, 'bar', data, {
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      }
    });
  }

  /**
   * Creates a time series line chart
   * @param {string} canvasId - ID of the canvas element
   * @param {Array} timeData - Array of time series data points
   * @param {string} label - Dataset label
   * @param {string} color - Chart color
   * @returns {Chart|null} Chart instance
   */
  createTimeSeriesChart(canvasId, timeData, label, color = '#3b82f6') {
    // Do NOT slice here; callers already clip by range. Just sort ASC for display.
    const sorted = [...timeData].sort((a,b) => (a.day > b.day ? 1 : (a.day < b.day ? -1 : 0)));
    try {
      if (sorted.length) {
        console.debug(`[${canvasId}] plotting ${sorted.length} points: ${sorted[0].day} -> ${sorted[sorted.length-1].day}`);
      } else {
        console.debug(`[${canvasId}] no data to plot`);
      }
    } catch(_) {}
    const data = {
      labels: sorted.map(d => d.day),
      datasets: [{
        label: label,
        data: sorted.map(d => d.value),
        borderColor: color,
        backgroundColor: color + '20',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    };

    return this.createChart(canvasId, 'line', data);
  }

  /**
   * Creates a comparison bar chart
   * @param {string} canvasId - ID of the canvas element
   * @param {Array} data - Array of dataset objects
   * @param {Array} labels - Chart labels
   * @returns {Chart|null} Chart instance
   */
  createComparisonChart(canvasId, data, labels) {
    const chartData = {
      labels: labels,
      datasets: data.map((dataset, index) => ({
        label: dataset.label,
        data: dataset.values,
        backgroundColor: dataset.color || `hsl(${index * 60}, 70%, 50%)`,
        borderColor: dataset.color || `hsl(${index * 60}, 70%, 50%)`,
        borderWidth: 1
      }))
    };

    return this.createChart(canvasId, 'bar', chartData);
  }

  /**
   * Creates a custom chart based on data structure
   * @param {string} canvasId - ID of the canvas element
   * @param {Array} chartData - Chart data array
   * @param {string} title - Chart title
   * @returns {Chart|null} Chart instance
   */
  createCustomChart(canvasId, chartData, title) {
    if (!chartData || chartData.length === 0) return null;

    const firstRow = chartData[0];
    const keys = Object.keys(firstRow);
    
    // Determine chart type based on data structure
    let chartType = 'bar';
    if (keys.some(key => key.includes('month') || key.includes('date') || key.includes('time'))) {
      chartType = 'line';
    } else if (keys.length > 5) {
      chartType = 'table';
    }

    if (chartType === 'table') {
      // For table charts, create a simple bar chart showing the first numeric column
      const numericKeys = keys.filter(key => {
        const sample = chartData[0][key];
        return typeof sample === 'number' && !isNaN(sample);
      });
      
      if (numericKeys.length === 0) return null;
      
      const dataKey = numericKeys[0];
      const labels = chartData.map(row => String(row[keys[0]] || 'Unknown'));
      const values = chartData.map(row => row[dataKey] || 0);
      
      const data = {
        labels: labels,
        datasets: [{
          label: dataKey.replace(/_/g, ' '),
          data: values,
          backgroundColor: '#3b82f6',
          borderColor: '#1d4ed8',
          borderWidth: 1
        }]
      };
      
      return this.createChart(canvasId, 'bar', data);
    } else {
      // For line/bar charts, use the first two columns
      const labelKey = keys[0];
      const valueKey = keys.find(key => {
        const sample = chartData[0][key];
        return typeof sample === 'number' && !isNaN(sample);
      });
      
      if (!valueKey) return null;
      
      const labels = chartData.map(row => String(row[labelKey] || 'Unknown'));
      const values = chartData.map(row => row[valueKey] || 0);
      
      const data = {
        labels: labels,
        datasets: [{
          label: valueKey.replace(/_/g, ' '),
          data: values,
          backgroundColor: chartType === 'line' ? '#3b82f620' : '#3b82f6',
          borderColor: '#3b82f6',
          borderWidth: 2,
          fill: chartType === 'line'
        }]
      };
      
      return this.createChart(canvasId, chartType, data);
    }
  }

  /**
   * Utility: get clipped time series by local range buttons
   * @param {string} canvasId - Canvas ID
   * @param {Array} series - Time series data
   * @returns {Array} Clipped series data
   */
  clipSeriesByCanvas(canvasId, series) {
    const wrapper = document.querySelector(`.range-local[data-target="${canvasId}"]`);
    const days = wrapper ? parseInt(wrapper.querySelector('button.active')?.dataset.d || '90', 10) : 90;
    // Always sort by day DESC before slicing to ensure we truly get the most recent N days
    const desc = [...series].sort((a, b) => (a.day < b.day ? 1 : (a.day > b.day ? -1 : 0)));
    return desc.slice(0, days);
  }

  /**
   * Creates a data table HTML string
   * @param {string} title - Table title
   * @param {Array} data - Table data
   * @param {Array} columns - Column definitions
   * @returns {string} HTML string for the table
   */
  buildTableHtml(title, data, columns) {
    return `
      <div class="metrics-table">
        <div class="table-title">${title}</div>
        <div class="table-content">
          <table>
            <thead>
              <tr>
                ${columns.map(col => `<th>${col.header}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${columns.map(col => `<td>${col.render ? col.render(row[col.key]) : (row[col.key] ?? '—')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  /**
   * Destroys all charts to prevent memory leaks
   */
  destroyAllCharts() {
    this.charts.forEach(chart => {
      try {
        chart.destroy();
      } catch (e) {
        console.warn('Error destroying chart:', e);
      }
    });
    this.charts.clear();
  }
}
