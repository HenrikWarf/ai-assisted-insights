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

  /**
   * Renders the KPI grid based on role
   * @param {string} role - Role name
   * @param {Object} metrics - Metrics data
   */
  renderKPIGrid(role, metrics) {
    const container = document.getElementById('kpi-grid');
    if (!container) return;
    
    container.innerHTML = '';

    if (role === 'E-commerce Manager') {
      this.renderEcommerceKPIs(metrics);
    } else if (role === 'Marketing Lead') {
      this.renderMarketingKPIs(metrics);
    } else {
      // Custom role - render KPIs from generated plan
      this.renderCustomRoleKPIs(metrics);
    }
  }

  /**
   * Renders KPIs for custom roles
   * @param {Object} metrics - Metrics data
   */
  renderCustomRoleKPIs(metrics) {
    const container = document.getElementById('kpi-grid');
    if (!container) return;
    
    // Find all KPI metrics (prefixed with kpi_)
    const kpiMetrics = Object.keys(metrics).filter(key => key.startsWith('kpi_'));
    
    if (kpiMetrics.length === 0) {
      container.innerHTML = '<div class="kpi-card"><div class="kpi-title">No KPIs Available</div><div class="kpi-value">—</div></div>';
      return;
    }
    
    kpiMetrics.forEach(kpiKey => {
      const kpiData = metrics[kpiKey];
      if (!kpiData) return;
      
      // Extract the actual value from the KPI data
      const value = Object.values(kpiData)[0];
      const title = kpiKey.replace('kpi_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Determine format type based on title
      let formatType = 'number';
      let unit = '';
      if (title.toLowerCase().includes('rate') || title.toLowerCase().includes('percent')) {
        formatType = 'percentage';
      } else if (title.toLowerCase().includes('value') || title.toLowerCase().includes('ltv') || title.toLowerCase().includes('aov')) {
        formatType = 'currency';
      } else if (title.toLowerCase().includes('days') || title.toLowerCase().includes('time')) {
        formatType = 'decimal';
        unit = ' days';
      }
      
      container.insertAdjacentHTML('beforeend', this.createKPICard(title, value, null, formatType, unit));
    });
  }

  /**
   * Renders E-commerce KPIs
   * @param {Object} metrics - Metrics data
   */
  renderEcommerceKPIs(metrics) {
    const container = document.getElementById('kpi-grid');
    if (!container) return;
    
    // E-commerce Funnel KPIs
    if (metrics.ecom_funnel && metrics.ecom_funnel.length > 0) {
      const today = metrics.ecom_funnel[metrics.ecom_funnel.length - 1];
      const yesterday = metrics.ecom_funnel[metrics.ecom_funnel.length - 2];
      
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Conversion Rate', today.rate_co_to_purchase, yesterday?.rate_co_to_purchase, 'percentage')
      );
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Sessions', today.sessions, yesterday?.sessions, 'integer')
      );
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('PDP→ATC Rate', today.rate_pdp_to_atc, yesterday?.rate_pdp_to_atc, 'percentage')
      );
    }

    // Payment Failures
    if (metrics.payment_failures && metrics.payment_failures.length > 0) {
      const today = metrics.payment_failures[metrics.payment_failures.length - 1];
      const yesterday = metrics.payment_failures[metrics.payment_failures.length - 2];
      
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Payment Failure Rate', today.payment_failure_rate, yesterday?.payment_failure_rate, 'percentage', '', true)
      );
    }

    // Zero Result Search
    if (metrics.zero_result_search && metrics.zero_result_search.length > 0) {
      const today = metrics.zero_result_search[metrics.zero_result_search.length - 1];
      const yesterday = metrics.zero_result_search[metrics.zero_result_search.length - 2];
      
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Zero Result Rate', today.zero_result_rate, yesterday?.zero_result_rate, 'percentage', '', true)
      );
    }
  }

  /**
   * Renders Marketing KPIs
   * @param {Object} metrics - Metrics data
   */
  renderMarketingKPIs(metrics) {
    const container = document.getElementById('kpi-grid');
    if (!container) return;
    
    // Campaign ROAS
    if (metrics.campaign_kpis && metrics.campaign_kpis.length > 0) {
      const desc = [...metrics.campaign_kpis];
      const todayDay = desc[desc.length - 1].day;
      const todayRows = desc.filter(r => r.day === todayDay);
      const avgRoasToday = todayRows.reduce((s,r)=>s+(r.roas||0),0) / (todayRows.length || 1);
      
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Avg ROAS', avgRoasToday, null, 'decimal')
      );
    }

    // Creative CTR
    if (metrics.creative_ctr && metrics.creative_ctr.length > 0) {
      const desc = [...metrics.creative_ctr];
      const todayDay = desc[desc.length - 1].day;
      const todayRows = desc.filter(r => r.day === todayDay);
      const avgCtr = todayRows.reduce((s,r)=>s+(r.ctr||0),0) / (todayRows.length || 1);
      
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Avg CTR', avgCtr, null, 'percentage')
      );
    }

    // Brand Health
    if (metrics.brand_health && metrics.brand_health.length > 0) {
      const today = metrics.brand_health[metrics.brand_health.length - 1];
      const yesterday = metrics.brand_health[metrics.brand_health.length - 2];
      
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Brand Sentiment', today.social_sentiment_score, yesterday?.social_sentiment_score ?? null, 'sentiment')
      );
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('NPS Score', today.nps, yesterday?.nps ?? null, 'nps')
      );
    }
  }

  /**
   * Renders charts based on role
   * @param {string} role - Role name
   * @param {Object} metrics - Metrics data
   */
  renderCharts(role, metrics) {
    const topics = document.getElementById('topic-groups');
    if (!topics) return;
    
    topics.innerHTML = '';

    if (role === 'E-commerce Manager' || role === 'Marketing Lead') {
      // For built-in roles, render a placeholder or skip
      topics.innerHTML = '<div class="topic"><h3>Charts for built-in roles</h3><p>Chart rendering for built-in roles to be implemented.</p></div>';
    } else {
      // Custom role - render charts from generated plan
      this.renderCustomRoleCharts(topics, metrics);
    }

    // After topics are rendered, build quick links
    this.buildSectionLinks();
  }

  /**
   * Renders custom role charts
   * @param {HTMLElement} container - Container element
   * @param {Object} metrics - Metrics data
   */
  renderCustomRoleCharts(container, metrics) {
    // Find all chart metrics (prefixed with chart_)
    const chartMetrics = Object.keys(metrics).filter(key => key.startsWith('chart_'));
    
    if (chartMetrics.length === 0) {
      container.innerHTML = '<div class="topic"><h3>No Charts Available</h3><p>No visualization data found for this role.</p></div>';
      return;
    }
    
    // Clear container before re-rendering
    container.innerHTML = '';
    
    chartMetrics.forEach(chartKey => {
      const chartData = metrics[chartKey];
      if (!chartData || !Array.isArray(chartData) || chartData.length === 0) return;
      
      // Extract chart ID from key (e.g., "chart_1" -> "1")
      const chartIdFromKey = chartKey.replace('chart_', '');
      const sectionId = `section-${chartIdFromKey}`.toLowerCase();
      const chartCanvasId = `custom-${chartKey}`;
      
      // Get chart info from the plan
      let title = chartIdFromKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // fallback
      let description = '';
      let chartType = 'bar'; // default fallback
      
      if (window.__LATEST_METRICS__ && window.__LATEST_METRICS__.plan) {
        const charts = window.__LATEST_METRICS__.plan.charts || [];
        // Match by ID (the chart ID in plan is "1", "2", etc., not "chart_1")
        const matchingChart = charts.find(chart => String(chart.id) === chartIdFromKey);
        if (matchingChart) {
          if (matchingChart.title) title = matchingChart.title;
          if (matchingChart.description) description = matchingChart.description;
          if (matchingChart.type) chartType = matchingChart.type;
        }
      }
      
      // Create a topic per chart
      const topic = document.createElement('div');
      topic.className = 'topic';
      topic.id = sectionId;
      
      const headerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${description ? '8px' : '0'};">
          <h3 style="margin: 0;">${escapeHtml(title)}</h3>
          <div style="display: flex; gap: 8px;">
            <button class="edit-chart-btn" data-chart-id="${chartKey}" style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer; color: #374151;" title="Edit this chart">
              ✏️ Edit
            </button>
            <button class="delete-chart-btn" data-chart-id="${chartKey}" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer; color: #dc2626;" title="Delete this chart">
              🗑️ Delete
            </button>
          </div>
        </div>
        ${description ? `<p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px; line-height: 1.5;">${escapeHtml(description)}</p>` : ''}
      `;
      topic.innerHTML = headerHtml;
      
      const bundle = document.createElement('div');
      bundle.className = 'charts-container';
      
      const chartWrapper = document.createElement('div');
      chartWrapper.className = 'chart-wrapper';
      chartWrapper.innerHTML = `
        <div class="chart-title">${escapeHtml(title)}</div>
        <canvas id="${chartCanvasId}" width="400" height="300"></canvas>
      `;
      bundle.appendChild(chartWrapper);
      
      // Table alongside/below chart
      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'chart-wrapper';
      tableWrapper.innerHTML = `
        <div class="chart-title">${escapeHtml(title)} (Data)</div>
        <div class="table-content"></div>
      `;
      const content = tableWrapper.querySelector('.table-content');
      const rows = chartData || [];
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const thead = `<thead><tr>${headers.map(h=>`<th>${escapeHtml(h.replace(/_/g,' '))}</th>`).join('')}</tr></thead>`;
        const tbody = `<tbody>${rows.map(r=>`<tr>${headers.map(h=>`<td>${escapeHtml(String(r[h] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>`;
        content.innerHTML = `<table>${thead}${tbody}</table>`;
      } else {
        content.textContent = 'No data';
      }
      bundle.appendChild(tableWrapper);
      
      topic.appendChild(bundle);
      
      // Add enhanced insights container (will be populated after chart loads)
      const insightsDiv = document.createElement('div');
      insightsDiv.className = 'enhanced-insights';
      insightsDiv.id = `insights-${chartKey}`;
      insightsDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #9ca3af;"><em>Loading insights...</em></div>';
      topic.appendChild(insightsDiv);
      
      container.appendChild(topic);
      
      // Create the chart
      setTimeout(() => {
        this.createCustomChartAdvanced(chartCanvasId, chartData, chartType, title);
        // Load insights after chart is rendered
        this.loadChartInsights(chartKey, chartIdFromKey, title, chartData, chartType);
      }, 50);
    });
    
    // Add event listeners for edit and delete buttons
    setTimeout(() => {
      const editButtons = document.querySelectorAll('.edit-chart-btn');
      editButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const chartId = btn.getAttribute('data-chart-id');
          if (window.openCustomVizModal) {
            window.openCustomVizModal(chartId);
          }
        });
      });
      
      const deleteButtons = document.querySelectorAll('.delete-chart-btn');
      deleteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const chartId = btn.getAttribute('data-chart-id');
          if (window.deleteCustomChart) {
            window.deleteCustomChart(chartId);
          }
        });
      });
    }, 200);
    
    // Build section quick links
    this.buildSectionLinks();
  }

  /**
   * Creates a custom chart with advanced type handling
   * @param {string} canvasId - Canvas ID
   * @param {Array} data - Chart data
   * @param {string} type - Chart type
   * @param {string} title - Chart title
   */
  createCustomChartAdvanced(canvasId, data, type, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    if (type === 'table') {
      // Render as HTML table instead of chart
      const tableHtml = this.createDataTable(data, title);
      canvas.parentElement.innerHTML = `
        <div class="chart-title">${title}</div>
        <div class="table-content">${tableHtml}</div>
      `;
      return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Prepare chart data
    const labels = [];
    const datasets = [];
    
    if (data.length > 0) {
      const keys = Object.keys(data[0]);
      const valueKey = keys.find(key => 
        key.includes('count') || key.includes('number') || key.includes('value') || 
        key.includes('customers') || key.includes('total') || key.includes('avg')
      ) || keys[1];
      
      const labelKey = keys.find(key => 
        key !== valueKey && !key.includes('id')
      ) || keys[0];
      
      labels.push(...data.map(row => row[labelKey]));
      
      const values = data.map(row => {
        const val = row[valueKey];
        return typeof val === 'string' ? parseFloat(val) || 0 : val;
      });
      
      datasets.push({
        label: valueKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        data: values,
        backgroundColor: type === 'pie' ? 
          ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'] :
          '#36A2EB',
        borderColor: '#36A2EB',
        borderWidth: 1
      });
    }
    
    const config = {
      type: type,
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: type === 'pie'
          }
        },
        scales: type !== 'pie' ? {
          y: {
            beginAtZero: true
          }
        } : {}
      }
    };
    
    const chart = new Chart(ctx, config);
    this.charts.set(canvasId, chart);
  }

  /**
   * Creates HTML table from data
   * @param {Array} data - Table data
   * @param {string} title - Table title
   * @returns {string} HTML table string
   */
  createDataTable(data, title) {
    if (!data || data.length === 0) return '<p>No data available</p>';
    
    const headers = Object.keys(data[0]);
    const headerRow = headers.map(h => `<th>${h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</th>`).join('');
    const rows = data.map(row => 
      `<tr>${headers.map(h => `<td>${row[h]}</td>`).join('')}</tr>`
    ).join('');
    
    return `
      <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  /**
   * Builds section navigation links
   */
  buildSectionLinks() {
    const container = document.getElementById('section-links');
    if (!container) return;
    
    const topics = Array.from(document.querySelectorAll('#topic-groups .topic'));
    const links = topics.map(topic => {
      const titleEl = topic.querySelector('h3');
      const id = topic.id || 'section-' + (titleEl?.textContent || 'section').toLowerCase().replace(/[^a-z0-9]+/g,'-');
      if (!topic.id) topic.id = id;
      const label = titleEl ? titleEl.textContent.trim() : 'Section';
      return { id, label };
    });
    
    container.innerHTML = links.map(l => `<a class="link-btn" href="#${l.id}"><span class="icon">🔗</span>${l.label}</a>`).join('');
    
    // Add back-to-data buttons
    this.addBackToDataButtons(topics);
  }

  /**
   * Adds back-to-top buttons to topic sections
   * @param {Array} topics - Array of topic elements
   */
  addBackToDataButtons(topics) {
    topics.forEach(topic => {
      if (topic.querySelector('.back-to-data-btn')) return;
      
      const backBtn = document.createElement('a');
      backBtn.href = '#content-section-panel';
      backBtn.className = 'back-to-data-btn';
      backBtn.innerHTML = '<span class="icon">⬆</span> Back to Content';
      backBtn.title = 'Return to Content Section';
      backBtn.style.cssText = `
        display: inline-block;
        margin-top: 16px;
        padding: 8px 12px;
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        text-decoration: none;
        color: #374151;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
      `;
      
      backBtn.addEventListener('mouseenter', () => {
        backBtn.style.background = '#e5e7eb';
        backBtn.style.borderColor = '#9ca3af';
      });
      
      backBtn.addEventListener('mouseleave', () => {
        backBtn.style.background = '#f3f4f6';
        backBtn.style.borderColor = '#d1d5db';
      });
      
      topic.appendChild(backBtn);
    });
  }

  /**
   * Loads and displays enhanced insights for a chart
   * @param {string} chartKey - Full chart key (e.g., "chart_1")
   * @param {string} chartId - Chart ID without prefix (e.g., "1")
   * @param {string} chartTitle - Chart title
   * @param {Array} chartData - Chart data
   * @param {string} chartType - Chart type
   */
  async loadChartInsights(chartKey, chartId, chartTitle, chartData, chartType) {
    const insightsDiv = document.getElementById(`insights-${chartKey}`);
    if (!insightsDiv) return;

    try {
      const roleName = window.__CUSTOM_ROLE_NAME__;
      if (!roleName) {
        insightsDiv.innerHTML = '<p style="color: #9ca3af; text-align: center; padding: 20px;"><em>Insights not available</em></p>';
        return;
      }

      // Fetch insights from API
      const response = await fetch(`/api/custom_role/insights/${roleName}/${chartId}`);
      const result = await response.json();

      if (result.ok && result.insights && result.insights.length > 0) {
        this.renderChartInsights(insightsDiv, result.insights, chartKey, chartId, chartTitle, chartData, chartType);
      } else {
        // No insights available, offer to generate
        insightsDiv.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #6b7280;">
            <p style="margin-bottom: 12px;"><em>No insights available yet</em></p>
            <button 
              class="generate-insights-btn" 
              data-chart-key="${chartKey}"
              data-chart-id="${chartId}"
              data-chart-title="${escapeHtml(chartTitle)}"
              data-chart-type="${chartType}"
              style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
              🔍 Generate Insights
            </button>
          </div>
        `;
        
        // Add event listener for generate button
        const generateBtn = insightsDiv.querySelector('.generate-insights-btn');
        if (generateBtn) {
          generateBtn.addEventListener('click', () => {
            this.generateNewInsights(chartKey, chartId, chartTitle, chartData, chartType);
          });
        }
      }
    } catch (error) {
      console.error('Error loading chart insights:', error);
      insightsDiv.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 20px;"><em>Failed to load insights</em></p>';
    }
  }

  /**
   * Renders chart insights HTML
   * @param {HTMLElement} container - Container element
   * @param {Array} insights - Array of insight strings
   * @param {string} chartKey - Full chart key
   * @param {string} chartId - Chart ID
   * @param {string} chartTitle - Chart title
   * @param {Array} chartData - Chart data
   * @param {string} chartType - Chart type
   */
  renderChartInsights(container, insights, chartKey, chartId, chartTitle, chartData, chartType) {
    const insightsList = insights.map(insight => `<li>${escapeHtml(insight)}</li>`).join('');
    
    container.innerHTML = `
      <h4 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px;">
        Enhanced Insights
      </h4>
      <ul style="margin: 0 0 16px 0; padding-left: 24px; color: #475569; line-height: 1.8;">
        ${insightsList}
      </ul>
      <button 
        class="regenerate-insights-btn" 
        data-chart-key="${chartKey}"
        data-chart-id="${chartId}"
        data-chart-title="${escapeHtml(chartTitle)}"
        data-chart-type="${chartType}"
        style="background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s;">
        🔄 Update Analysis
      </button>
    `;
    
    // Add event listener for regenerate button
    const regenerateBtn = container.querySelector('.regenerate-insights-btn');
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', () => {
        this.generateNewInsights(chartKey, chartId, chartTitle, chartData, chartType);
      });
      
      // Add hover effects
      regenerateBtn.addEventListener('mouseenter', () => {
        regenerateBtn.style.background = '#e5e7eb';
        regenerateBtn.style.borderColor = '#9ca3af';
      });
      
      regenerateBtn.addEventListener('mouseleave', () => {
        regenerateBtn.style.background = '#f3f4f6';
        regenerateBtn.style.borderColor = '#d1d5db';
      });
    }
  }

  /**
   * Generates new insights for a chart
   * @param {string} chartKey - Full chart key
   * @param {string} chartId - Chart ID
   * @param {string} chartTitle - Chart title
   * @param {Array} chartData - Chart data
   * @param {string} chartType - Chart type
   */
  async generateNewInsights(chartKey, chartId, chartTitle, chartData, chartType) {
    const insightsDiv = document.getElementById(`insights-${chartKey}`);
    if (!insightsDiv) return;

    // Show loading state
    insightsDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #3b82f6;"><em>Generating insights...</em></div>';

    try {
      const roleName = window.__CUSTOM_ROLE_NAME__;
      if (!roleName) {
        throw new Error('No role name found');
      }

      const response = await fetch('/api/chart/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role_name: roleName,
          chart_id: chartId,
          chart_title: chartTitle,
          chart_data: chartData,
          chart_type: chartType
        })
      });

      const result = await response.json();

      if (result.ok && result.insights && result.insights.length > 0) {
        this.renderChartInsights(insightsDiv, result.insights, chartKey, chartId, chartTitle, chartData, chartType);
        if (window.showNotification) {
          window.showNotification('Insights generated successfully!', 'success');
        }
      } else {
        throw new Error(result.error || 'No insights returned');
      }
    } catch (error) {
      console.error('Error generating insights:', error);
      insightsDiv.innerHTML = `
        <p style="color: #ef4444; text-align: center; padding: 20px;">
          <em>Failed to generate insights: ${escapeHtml(error.message)}</em>
        </p>
      `;
      if (window.showNotification) {
        window.showNotification('Failed to generate insights', 'error');
      }
    }
  }
}
