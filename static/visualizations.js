// Advanced Metrics Visualization System
class MetricsVisualizer {
  constructor() {
    this.charts = new Map();
    this.kpiCards = new Map();
  }

  // Format numbers with appropriate suffixes
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

  // Calculate trend direction and percentage change
  calculateTrend(current, previous) {
    if (!previous || previous === 0) return { direction: 'neutral', change: 0 };
    
    const change = ((current - previous) / previous) * 100;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    
    return { direction, change: Math.abs(change) };
  }

  // Create KPI Card
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

  // Create Chart.js chart
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

  // Create funnel chart
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

  // Create time series chart
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

  // Create comparison chart
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

  // Aggregate ROAS per campaign over a period
  aggregateRoasByCampaign(rows) {
    const acc = new Map();
    for (const r of rows) {
      const key = r.campaign;
      if (!acc.has(key)) acc.set(key, { revenue: 0, spend: 0, roasSum: 0, count: 0 });
      const a = acc.get(key);
      a.count += 1;
      a.roasSum += (r.roas || 0);
      if (typeof r.revenue === 'number') a.revenue += r.revenue;
      if (typeof r.spend === 'number') a.spend += r.spend;
    }
    const labels = [];
    const values = [];
    for (const [campaign, a] of acc.entries()) {
      const roas = a.spend > 0 ? (a.revenue / a.spend) : (a.roasSum / (a.count || 1));
      labels.push(campaign);
      values.push(roas);
    }
    return { labels, values };
  }

  // Build overall ROAS time series per day from campaign_kpis rows
  buildOverallRoasSeries(rows) {
    const byDay = new Map();
    for (const r of rows) {
      const key = r.day;
      if (!byDay.has(key)) byDay.set(key, { revenue: 0, spend: 0, roasSum: 0, count: 0 });
      const a = byDay.get(key);
      a.count += 1;
      a.roasSum += (r.roas || 0);
      if (typeof r.revenue === 'number') a.revenue += r.revenue;
      if (typeof r.spend === 'number') a.spend += r.spend;
    }
    // Return DESC by day to align with existing slicing logic
    return Array.from(byDay.entries())
      .map(([day, a]) => ({ day, value: a.spend > 0 ? (a.revenue / a.spend) : (a.roasSum / (a.count || 1)) }))
      .sort((a, b) => (a.day < b.day ? 1 : -1));
  }

  // Build per-day average series from arbitrary rows with a numeric value key
  buildDailyAverageSeries(rows, valueKey) {
    const byDay = new Map();
    for (const r of rows) {
      const day = r.day;
      const v = r[valueKey];
      if (v === null || v === undefined) continue;
      if (!byDay.has(day)) byDay.set(day, { sum: 0, count: 0 });
      const a = byDay.get(day);
      a.sum += v;
      a.count += 1;
    }
    return Array.from(byDay.entries())
      .map(([day, a]) => ({ day, value: a.count ? a.sum / a.count : 0 }))
      .sort((a, b) => (a.day < b.day ? 1 : -1));
  }

  // Utility: get clipped time series by local range buttons
  clipSeriesByCanvas(canvasId, series) {
    const wrapper = document.querySelector(`.range-local[data-target="${canvasId}"]`);
    const days = wrapper ? parseInt(wrapper.querySelector('button.active')?.dataset.d || '90', 10) : 90;
    // Always sort by day DESC before slicing to ensure we truly get the most recent N days
    const desc = [...series].sort((a, b) => (a.day < b.day ? 1 : (a.day > b.day ? -1 : 0)));
    return desc.slice(0, days);
  }

  // Create data table
  createDataTable(containerId, title, data, columns) {
    const container = document.getElementById(containerId);
    
    const tableHtml = `
      <div class="metrics-table">
        <div class="table-title">${title}</div>
        <div class="table-content">
          <table>
            <thead>
              <tr>
                ${columns.map(col => `<th onclick="sortTable(this)">${col.header}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${columns.map(col => `<td>${col.render ? col.render(row[col.key]) : row[col.key] || '—'}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', tableHtml);
  }

  // Build table HTML string (for modal)
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

  // Open details modal helper
  openDetails(title, chartConfig, tableHtml) {
    if (!window.detailModal) return;
    window.detailModal.setTitle(title);
    window.detailModal.setContent({ chartConfig, tableHtml });
    window.detailModal.open();
  }

  // Render KPI Grid
  renderKPIGrid(role, metrics) {
    const container = document.getElementById('kpi-grid');
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

  // Render E-commerce KPIs
  renderEcommerceKPIs(metrics) {
    const container = document.getElementById('kpi-grid');
    
    // E-commerce Funnel KPIs (month-over-month trends)
    if (metrics.ecom_funnel && metrics.ecom_funnel.length > 0) {
      const today = metrics.ecom_funnel[metrics.ecom_funnel.length - 1]; // Get the last (most recent) day
      
      // Calculate month-over-month comparison for conversion rate
      let monthOverMonthConv = null;
      if (metrics.ecom_funnel.length > 0) {
        const currentMonth = today.day.substring(0, 7); // YYYY-MM
        const currentMonthData = metrics.ecom_funnel.filter(r => r.day.startsWith(currentMonth));
        const previousMonth = new Date(currentMonth + '-01');
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        const prevMonthStr = previousMonth.toISOString().substring(0, 7);
        const previousMonthData = metrics.ecom_funnel.filter(r => r.day.startsWith(prevMonthStr));
        
        if (currentMonthData.length > 0 && previousMonthData.length > 0) {
          const currentAvg = currentMonthData.reduce((sum, r) => sum + (r.rate_co_to_purchase || 0), 0) / currentMonthData.length;
          const previousAvg = previousMonthData.reduce((sum, r) => sum + (r.rate_co_to_purchase || 0), 0) / previousMonthData.length;
          monthOverMonthConv = previousAvg;
        }
      }
      
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Conversion Rate', today.rate_co_to_purchase, monthOverMonthConv, 'percentage')
      );
      
      // Sessions month-over-month
      let monthOverMonthSessions = null;
      if (metrics.ecom_funnel.length > 0) {
        const currentMonth = today.day.substring(0, 7);
        const currentMonthData = metrics.ecom_funnel.filter(r => r.day.startsWith(currentMonth));
        const previousMonth = new Date(currentMonth + '-01');
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        const prevMonthStr = previousMonth.toISOString().substring(0, 7);
        const previousMonthData = metrics.ecom_funnel.filter(r => r.day.startsWith(prevMonthStr));
        
        if (currentMonthData.length > 0 && previousMonthData.length > 0) {
          const currentAvg = currentMonthData.reduce((sum, r) => sum + (r.sessions || 0), 0) / currentMonthData.length;
          const previousAvg = previousMonthData.reduce((sum, r) => sum + (r.sessions || 0), 0) / previousMonthData.length;
          monthOverMonthSessions = previousAvg;
        }
      }
      
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Sessions', today.sessions, monthOverMonthSessions, 'integer')
      );
      
      // PDP→ATC Rate month-over-month
      let monthOverMonthPdpAtc = null;
      if (metrics.ecom_funnel.length > 0) {
        const currentMonth = today.day.substring(0, 7);
        const currentMonthData = metrics.ecom_funnel.filter(r => r.day.startsWith(currentMonth));
        const previousMonth = new Date(currentMonth + '-01');
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        const prevMonthStr = previousMonth.toISOString().substring(0, 7);
        const previousMonthData = metrics.ecom_funnel.filter(r => r.day.startsWith(prevMonthStr));
        
        if (currentMonthData.length > 0 && previousMonthData.length > 0) {
          const currentAvg = currentMonthData.reduce((sum, r) => sum + (r.rate_pdp_to_atc || 0), 0) / currentMonthData.length;
          const previousAvg = previousMonthData.reduce((sum, r) => sum + (r.rate_pdp_to_atc || 0), 0) / previousMonthData.length;
          monthOverMonthPdpAtc = previousAvg;
        }
      }
      
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('PDP→ATC Rate', today.rate_pdp_to_atc, monthOverMonthPdpAtc, 'percentage')
      );
    }

    // Payment Failures
    if (metrics.payment_failures && metrics.payment_failures.length > 0) {
      const today = metrics.payment_failures[metrics.payment_failures.length - 1]; // Get the last (most recent) day
      const yesterday = metrics.payment_failures[metrics.payment_failures.length - 2]; // Get the second to last day
      
      container.insertAdjacentHTML('beforeend', 
        // Higher failure rate is worse → invert coloring
        this.createKPICard('Payment Failure Rate', today.payment_failure_rate, yesterday?.payment_failure_rate, 'percentage', '', true)
      );
    }

    // Zero Result Search
    if (metrics.zero_result_search && metrics.zero_result_search.length > 0) {
      const today = metrics.zero_result_search[metrics.zero_result_search.length - 1]; // Get the last (most recent) day
      const yesterday = metrics.zero_result_search[metrics.zero_result_search.length - 2]; // Get the second to last day
      
      container.insertAdjacentHTML('beforeend', 
        // Higher zero-result rate is worse → invert coloring
        this.createKPICard('Zero Result Rate', today.zero_result_rate, yesterday?.zero_result_rate, 'percentage', '', true)
      );
    }
  }

  // Render Custom Role KPIs
  renderCustomRoleKPIs(metrics) {
    const container = document.getElementById('kpi-grid');
    
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
      
      const card = this.createKPICard(title, value, null, formatType, unit);
      container.appendChild(card);
    });
  }

  // Render Marketing KPIs
  renderMarketingKPIs(metrics) {
    const container = document.getElementById('kpi-grid');
    
    // Campaign ROAS (show month-over-month trend)
    if (metrics.campaign_kpis && metrics.campaign_kpis.length > 0) {
      const desc = [...metrics.campaign_kpis]; // now ASC ordered
      const todayDay = desc[desc.length - 1].day; // Get the last (most recent) day
      const todayRows = desc.filter(r => r.day === todayDay);
      const avgRoasToday = todayRows.reduce((s,r)=>s+(r.roas||0),0) / (todayRows.length || 1);
      
      // Calculate month-over-month comparison
      let monthOverMonthRoas = null;
      if (desc.length > 0) {
        const currentMonth = todayDay.substring(0, 7); // YYYY-MM
        const currentMonthData = desc.filter(r => r.day.startsWith(currentMonth));
        const previousMonth = new Date(currentMonth + '-01');
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        const prevMonthStr = previousMonth.toISOString().substring(0, 7);
        const previousMonthData = desc.filter(r => r.day.startsWith(prevMonthStr));
        
        if (currentMonthData.length > 0 && previousMonthData.length > 0) {
          const currentAvg = currentMonthData.reduce((sum, r) => sum + (r.roas || 0), 0) / currentMonthData.length;
          const previousAvg = previousMonthData.reduce((sum, r) => sum + (r.roas || 0), 0) / previousMonthData.length;
          monthOverMonthRoas = previousAvg;
        }
      }
      
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Avg ROAS', avgRoasToday, monthOverMonthRoas, 'decimal')
      );
    }

    // Creative CTR (show month-over-month trend)
    if (metrics.creative_ctr && metrics.creative_ctr.length > 0) {
      const desc = [...metrics.creative_ctr]; // now ASC ordered
      const todayDay = desc[desc.length - 1].day; // Get the last (most recent) day
      const todayRows = desc.filter(r => r.day === todayDay);
      const avgCtr = todayRows.reduce((s,r)=>s+(r.ctr||0),0) / (todayRows.length || 1);
      
      // Calculate month-over-month comparison
      let monthOverMonthCtr = null;
      if (desc.length > 0) {
        const currentMonth = todayDay.substring(0, 7); // YYYY-MM
        const currentMonthData = desc.filter(r => r.day.startsWith(currentMonth));
        const previousMonth = new Date(currentMonth + '-01');
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        const prevMonthStr = previousMonth.toISOString().substring(0, 7);
        const previousMonthData = desc.filter(r => r.day.startsWith(prevMonthStr));
        
        if (currentMonthData.length > 0 && previousMonthData.length > 0) {
          const currentAvg = currentMonthData.reduce((sum, r) => sum + (r.ctr || 0), 0) / currentMonthData.length;
          const previousAvg = previousMonthData.reduce((sum, r) => sum + (r.ctr || 0), 0) / previousMonthData.length;
          monthOverMonthCtr = previousAvg;
        }
      }
      
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Avg CTR', avgCtr, monthOverMonthCtr, 'percentage')
      );
    }

    // Brand Health
    if (metrics.brand_health && metrics.brand_health.length > 0) {
      const today = metrics.brand_health[metrics.brand_health.length - 1]; // Get the last (most recent) day
      const yesterday = metrics.brand_health[metrics.brand_health.length - 2]; // Get the second to last day
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('Brand Sentiment', today.social_sentiment_score, yesterday?.social_sentiment_score ?? null, 'sentiment')
      );
      container.insertAdjacentHTML('beforeend', 
        this.createKPICard('NPS Score', today.nps, yesterday?.nps ?? null, 'nps')
      );
    }
  }

  // Render Charts
  renderCharts(role, metrics) {
    const topics = document.getElementById('topic-groups');
    topics.innerHTML = '';

    if (role === 'E-commerce Manager') {
      this.renderEcommerceTopics(topics, metrics);
    } else if (role === 'Marketing Lead') {
      this.renderMarketingTopics(topics, metrics);
    } else {
      // Custom role - render charts from generated plan
      this.renderCustomRoleCharts(topics, metrics);
    }

    // After topics are rendered, build quick links
    this.buildSectionLinks();
  }

  // Render Custom Role Charts
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
      
      const title = chartKey.replace('chart_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const sectionId = `section-${chartKey.replace('chart_', '')}`.toLowerCase();
      const chartId = `custom-${chartKey}`;
      
      // Get chart type from the plan (ALWAYS respect Gemini's decision)
      let chartType = 'bar'; // default fallback
      
      // Try to get the chart type from the plan data - this is the source of truth
      if (window.__LATEST_METRICS__ && window.__LATEST_METRICS__.plan) {
        const charts = window.__LATEST_METRICS__.plan.charts || [];
        const matchingChart = charts.find(chart => chart.id === chartKey);
        if (matchingChart && matchingChart.type) {
          chartType = matchingChart.type;
          // If we found a chart type from the plan, use it and skip all auto-detection
        } else {
          // Only use fallback logic if no plan data is available
          if (chartData.length > 0) {
            const firstRow = chartData[0];
            const keys = Object.keys(firstRow);
            
            // Only auto-detect time series (line charts) and complex tables
            if (keys.some(key => key.includes('month') || key.includes('date') || key.includes('time'))) {
              chartType = 'line';
            } else if (keys.length > 5) { // Only convert to table for very complex data
              chartType = 'table';
            }
          }
        }
      } else {
        // No plan data available - use minimal fallback logic
        if (chartData.length > 0) {
          const firstRow = chartData[0];
          const keys = Object.keys(firstRow);
          
          if (keys.some(key => key.includes('month') || key.includes('date') || key.includes('time'))) {
            chartType = 'line';
          } else if (keys.length > 5) {
            chartType = 'table';
          }
        }
      }
      
      // Create a topic per chart, bundling chart + table
      const topic = document.createElement('div');
      topic.className = 'topic';
      topic.id = sectionId;
      
        // Add edit and delete buttons to the topic header
        const headerHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3>${title}</h3>
            <div style="display: flex; gap: 8px;">
              <button class="edit-chart-btn" data-chart-id="${chartKey}" style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer; color: #374151;" title="Edit this chart">
                ✏️ Edit
              </button>
              <button class="delete-chart-btn" data-chart-id="${chartKey}" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer; color: #dc2626;" title="Delete this chart">
                🗑️ Delete
              </button>
            </div>
          </div>
        `;
      topic.innerHTML = headerHtml;
      
      const bundle = document.createElement('div');
      bundle.className = 'charts-container';
      
      const chartWrapper = document.createElement('div');
      chartWrapper.className = 'chart-wrapper';
      chartWrapper.innerHTML = `
        <div class="chart-title">${title}</div>
        <canvas id="${chartId}" width="400" height="300"></canvas>
      `;
      bundle.appendChild(chartWrapper);
      
      // Table alongside/below chart
      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'chart-wrapper';
      tableWrapper.innerHTML = `
        <div class="chart-title">${title} (Data)</div>
        <div class="table-content"></div>
      `;
      const content = tableWrapper.querySelector('.table-content');
      const rows = chartData || [];
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const thead = `<thead><tr>${headers.map(h=>`<th>${h.replace(/_/g,' ')}</th>`).join('')}</tr></thead>`;
        const tbody = `<tbody>${rows.map(r=>`<tr>${headers.map(h=>`<td>${r[h]}</td>`).join('')}</tr>`).join('')}</tbody>`;
        content.innerHTML = `<table>${thead}${tbody}</table>`;
      } else {
        content.textContent = 'No data';
      }
      bundle.appendChild(tableWrapper);
      
      topic.appendChild(bundle);
      
      // Add Enhanced Insights section OUTSIDE the charts-container for full width
      const insightsWrapper = document.createElement('div');
      insightsWrapper.className = 'enhanced-insights';
      insightsWrapper.id = `insights-${chartKey}`;
      insightsWrapper.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4>Enhanced Insights</h4>
          <button class="update-insights-btn" data-chart-key="${chartKey}" style="background: #3b82f6; color: white; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-weight: 500;">
            🔄 Update Analysis
          </button>
        </div>
        <div class="insights-content">
          <div class="insights-loading">Loading insights...</div>
        </div>
        <div class="insights-timestamp" style="font-size: 11px; color: #6b7280; margin-top: 8px; font-style: italic;"></div>
      `;
      topic.appendChild(insightsWrapper);
      container.appendChild(topic);
      
      // Create the chart
      setTimeout(() => {
        this.createCustomChart(chartId, chartData, chartType, title);
        
        // Load Enhanced Insights for this chart
        this.loadChartInsights(title, chartData, chartType, chartKey);
      }, 50);
    });
    
      // Add event listeners for edit, delete, and update insights buttons after charts are rendered
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
        
        // Add event listeners for Update Analysis buttons
        const updateInsightsButtons = document.querySelectorAll('.update-insights-btn');
        updateInsightsButtons.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const chartKey = btn.getAttribute('data-chart-key');
            const chartData = metrics[chartKey];
            if (chartData && window.metricsVisualizer) {
              // Get chart title and type from the plan
              let chartTitle = chartKey.replace('chart_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              let chartType = 'bar'; // default
              
              if (window.__LATEST_METRICS__ && window.__LATEST_METRICS__.plan) {
                const charts = window.__LATEST_METRICS__.plan.charts || [];
                const matchingChart = charts.find(chart => chart.id === chartKey);
                if (matchingChart) {
                  chartTitle = matchingChart.title || chartTitle;
                  chartType = matchingChart.type || chartType;
                }
              }
              
              window.metricsVisualizer.generateNewInsights(chartTitle, chartData, chartType, chartKey);
            }
          });
        });
      }, 200);
    
    // Build section quick links and back buttons
    this.buildSectionLinks();
  }
  
  // Create custom chart based on data
  createCustomChart(canvasId, data, type, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (type === 'table') {
      // Render as HTML table instead of chart
      const tableHtml = this.createDataTable(data, title);
      canvas.parentElement.innerHTML = `
        <div class="chart-title">${title}</div>
        <div class="table-content">${tableHtml}</div>
      `;
      return;
    }
    
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
  
  // Create HTML table from data
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

  // Render E-commerce topics (bundled KPIs + charts + tables)
  renderEcommerceTopics(container, metrics) {
    // Topic: Conversion Funnel
    const funnel = document.createElement('div');
    funnel.id = 'section-conversion-funnel';
    funnel.className = 'topic';
    funnel.innerHTML = `
      <h3>Conversion Funnel</h3>
      <div class="kpi-grid" id="kpi-funnel"></div>
      <div class="chart-wrapper"><div class="chart-title">Funnel <span class="small-muted">(range)</span>
        <span class="range-local" data-target="funnel-chart">
          <button data-d="7">7d</button>
          <button data-d="30">30d</button>
          <button data-d="90">90d</button>
        </span>
      </div><canvas id="funnel-chart" height="300"></canvas></div>
      <div class="metrics-tables" style="margin:8px 0 0 0"><button class="view-details" data-detail="funnel">View details</button></div>
    `;
    container.appendChild(funnel);
    
    // E-commerce Funnel Chart
    if (metrics.ecom_funnel && metrics.ecom_funnel.length > 0) {
      const days = window.__RANGE_DAYS__ || 90;
      const desc = [...metrics.ecom_funnel];
      const recent = desc.slice(0, days);
      const today = recent[0];
      const yesterday = recent[1];
      const kpi = funnel.querySelector('#kpi-funnel');
      kpi.insertAdjacentHTML('beforeend', this.createKPICard('Conversion Rate', today.rate_co_to_purchase, yesterday?.rate_co_to_purchase, 'percentage'));
      kpi.insertAdjacentHTML('beforeend', this.createKPICard('Sessions', today.sessions, yesterday?.sessions, 'integer'));
      kpi.insertAdjacentHTML('beforeend', this.createKPICard('PDP→ATC Rate', today.rate_pdp_to_atc, yesterday?.rate_pdp_to_atc, 'percentage'));
      requestAnimationFrame(() => {
        // By default, aggregate the most recent 90 days (or available length)
        const defaultDays = 90;
        const rows = [...metrics.ecom_funnel].slice(0, defaultDays);
        let agg = { sessions:0, pdp_views:0, add_to_cart:0, checkouts:0, purchases:0 };
        if (rows.length === 1) {
          const r = rows[0];
          agg = { sessions: r.sessions||0, pdp_views: r.pdp_views||0, add_to_cart: r.add_to_cart||0, checkouts: r.checkouts||0, purchases: r.purchases||0 };
        } else if (rows.length > 1) {
          agg = rows.reduce((acc, d) => {
            acc.sessions += d.sessions || 0;
            acc.pdp_views += d.pdp_views || 0;
            acc.add_to_cart += d.add_to_cart || 0;
            acc.checkouts += d.checkouts || 0;
            acc.purchases += d.purchases || 0;
            return acc;
          }, agg);
        }
        const funnelData = [
          { stage:'Sessions', count: agg.sessions },
          { stage:'PDP Views', count: agg.pdp_views },
          { stage:'ATC', count: agg.add_to_cart },
          { stage:'Checkout', count: agg.checkouts },
          { stage:'Purchase', count: agg.purchases }
        ];
        this.createFunnelChart('funnel-chart', funnelData);
      });
      // Details button -> modal (Funnel)
      const fbtn = funnel.querySelector('button.view-details[data-detail="funnel"]');
      if (fbtn) {
        fbtn.addEventListener('click', () => {
          if (!window.detailModal) return;
          window.detailModal.setTitle('Conversion Funnel');
          window.detailModal.setBuilders({
            buildChartConfig: (days) => {
              const data = [...metrics.ecom_funnel].slice(0, days);
              const agg = data.reduce((acc,d)=>{ acc.sessions+=d.sessions||0; acc.pdp_views+=d.pdp_views||0; acc.add_to_cart+=d.add_to_cart||0; acc.checkouts+=d.checkouts||0; acc.purchases+=d.purchases||0; return acc; }, {sessions:0,pdp_views:0,add_to_cart:0,checkouts:0,purchases:0});
              return { type:'bar', data:{ labels:['Sessions','PDP Views','ATC','Checkout','Purchase'], datasets:[{ label:`Funnel (${days}d)`, data:[agg.sessions,agg.pdp_views,agg.add_to_cart,agg.checkouts,agg.purchases], backgroundColor:['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b'] }] }, options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y', plugins:{ legend:{ display:false } } } };
            },
            buildTableHtml: (days) => {
              const data = [...metrics.ecom_funnel].slice(0, days).sort((a,b)=>a.day.localeCompare(b.day));
              return this.buildTableHtml('Funnel Details', data, [
                { key:'day', header:'Date' },
                { key:'sessions', header:'Sessions' },
                { key:'pdp_views', header:'PDP Views' },
                { key:'add_to_cart', header:'ATC' },
                { key:'checkouts', header:'Checkouts' },
                { key:'purchases', header:'Purchases' }
              ]);
            },
            defaultDays: 90
          });
          window.detailModal.open();
        });
      }
    }

    // Topic: Payment Reliability
    const pay = document.createElement('div');
    pay.id = 'section-payment-failures';
    pay.className = 'topic';
    pay.innerHTML = `
      <h3>Payment Reliability</h3>
      <div class="kpi-grid" id="kpi-payment"></div>
      <div class="chart-wrapper"><div class="chart-title">Payment Failure Rate <span class="small-muted">(range)</span>
        <span class="range-local" data-target="payment-trend">
          <button data-d="7">7d</button>
          <button data-d="30">30d</button>
          <button data-d="90">90d</button>
        </span>
      </div><canvas id="payment-trend" height="300"></canvas></div>
      <div class="metrics-tables" style="margin:8px 0 0 0"><button class="view-details" data-detail="payment">View details</button></div>
    `;
    container.appendChild(pay);

    if (metrics.payment_failures && metrics.payment_failures.length > 1) {
      const days = window.__RANGE_DAYS__ || 90;
      const desc = [...metrics.payment_failures];
      const recent = desc.slice(0, days);
      const today = recent[0];
      const yesterday = recent[1];
      const kpi = pay.querySelector('#kpi-payment');
      // Higher failure rate is worse → invert coloring
      kpi.insertAdjacentHTML('beforeend', this.createKPICard('Failure Rate', today.payment_failure_rate, yesterday?.payment_failure_rate, 'percentage', '', true));
      requestAnimationFrame(() => {
        const clipped = this.clipSeriesByCanvas('payment-trend', metrics.payment_failures).map(d => ({ day: d.day, value: d.payment_failure_rate }));
        this.createTimeSeriesChart('payment-trend', clipped, 'Failure Rate', '#dc3545');
      });
      // Details button -> modal (Payment)
      const pbtn = pay.querySelector('button.view-details[data-detail="payment"]');
      if (pbtn) {
        pbtn.addEventListener('click', () => {
          if (!window.detailModal) return;
          window.detailModal.setTitle('Payment Failure Rate');
          window.detailModal.setBuilders({
            buildChartConfig: (days) => {
              const data = [...metrics.payment_failures].slice(0, days).sort((a,b)=>a.day.localeCompare(b.day));
              return { type:'line', data:{ labels:data.map(d=>d.day), datasets:[{ label:'Payment Failure Rate', data:data.map(d=>d.payment_failure_rate), borderColor:'#dc3545', backgroundColor:'#dc354520', borderWidth:2, fill:true, tension:0.4 }] }, options:{ responsive:true, maintainAspectRatio:false } };
            },
            buildTableHtml: (days) => {
              const data = [...metrics.payment_failures].slice(0, days).sort((a,b)=>a.day.localeCompare(b.day));
              return this.buildTableHtml('Payment Failures', data, [
                { key:'day', header:'Date' },
                { key:'payment_failures', header:'Payment Failures' },
                { key:'total_failures', header:'Total Failures' },
                { key:'payment_failure_rate', header:'Failure Rate', render:(v)=>this.formatNumber(v,'percentage') }
              ]);
            },
            defaultDays: 90
          });
          window.detailModal.open();
        });
      }
    }

    // Topic: SKU Efficiency
    const sku = document.createElement('div');
    sku.id = 'section-sku-efficiency';
    sku.className = 'topic';
    sku.innerHTML = `
      <h3>SKU Efficiency</h3>
      <div class="kpi-grid" id="kpi-sku"></div>
      <div class="chart-wrapper"><div class="chart-title">Efficiency Trend <span class="small-muted">(range)</span>
        <span class="range-local" data-target="sku-efficiency">
          <button data-d="7">7d</button>
          <button data-d="30">30d</button>
          <button data-d="90">90d</button>
        </span>
      </div><canvas id="sku-efficiency" height="300"></canvas></div>
      <div class="metrics-tables"><button class="view-details" data-detail="sku-eff">View details</button></div>
    `;
    container.appendChild(sku);

    if (metrics.sku_efficiency && metrics.sku_efficiency.length > 0) {
      requestAnimationFrame(() => {
        // Aggregate to per-day average efficiency before clipping
        const daily = this.buildDailyAverageSeries(metrics.sku_efficiency, 'efficiency_score');
        const clipped = this.clipSeriesByCanvas('sku-efficiency', daily);
        this.createTimeSeriesChart('sku-efficiency', clipped, 'Efficiency Score', '#10b981');
      });
      // Details button -> modal
      const btn = sku.querySelector('button.view-details[data-detail="sku-eff"]');
      if (btn) {
        btn.addEventListener('click', () => {
          if (!window.detailModal) return;
          window.detailModal.setTitle('SKU Efficiency');
          window.detailModal.setBuilders({
            buildChartConfig: (days) => {
              const daily = this.buildDailyAverageSeries(metrics.sku_efficiency, 'efficiency_score');
              const sorted = daily.slice(0, days).sort((a,b)=>a.day.localeCompare(b.day));
              return { type:'line', data:{ labels:sorted.map(d=>d.day), datasets:[{ label:'Avg Efficiency', data:sorted.map(d=>d.value), borderColor:'#10b981', backgroundColor:'#10b98120', borderWidth:2, fill:true, tension:0.4 }] }, options:{ responsive:true, maintainAspectRatio:false } };
            },
            buildTableHtml: (days) => {
              const sorted = [...metrics.sku_efficiency].slice(0, days).sort((a,b)=>a.day.localeCompare(b.day));
              return this.buildTableHtml('SKU Efficiency Details', sorted, [
                { key:'day', header:'Date' },
                { key:'sku', header:'SKU' },
                { key:'efficiency_score', header:'Efficiency', render:(v)=>this.formatNumber(v,'decimal') },
                { key:'inventory_turnover', header:'Turnover', render:(v)=>this.formatNumber(v,'decimal') }
              ]);
            },
            defaultDays: 90
          });
          window.detailModal.open();
        });
      }
    }
  }

  // Render Marketing topics (bundled KPIs + charts + tables)
  renderMarketingTopics(container, metrics) {
    // Topic: Overall ROAS Insights
    const roasOverall = document.createElement('div');
    roasOverall.id = 'section-overall-roas';
    roasOverall.className = 'topic';
    roasOverall.innerHTML = `
      <h3>Overall ROAS</h3>
      <div class="kpi-grid" id="kpi-roas"></div>
      <div class="chart-wrapper"><div class="chart-title">Overall ROAS Trend <span class="small-muted">(range)</span>
        <span class="range-local" data-target="roas-overall">
          <button data-d="7">7d</button>
          <button data-d="30">30d</button>
          <button data-d="90">90d</button>
        </span>
      </div><canvas id="roas-overall" height="300"></canvas></div>
      <div class="metrics-tables"><button class="view-details" data-detail="roas-overall">View details</button></div>
      <div class="enhanced-insights" id="insights-roas-overall">
        <h4>Enhanced Insights</h4>
        <div class="insights-content">
          <div class="insights-loading">Generating insights...</div>
        </div>
      </div>
    `;
    container.appendChild(roasOverall);

    // Build overall ROAS per day by averaging (or revenue/spend ratio if present)
    if (metrics.campaign_kpis && metrics.campaign_kpis.length > 0) {
      const byDay = {};
      for (const r of metrics.campaign_kpis) {
        if (!byDay[r.day]) byDay[r.day] = { revenue: 0, spend: 0, count: 0, roasSum: 0 };
        byDay[r.day].count += 1;
        byDay[r.day].roasSum += (r.roas || 0);
        if (typeof r.revenue === 'number') byDay[r.day].revenue += r.revenue;
        if (typeof r.spend === 'number') byDay[r.day].spend += r.spend;
      }
      const desc = Object.entries(byDay)
        .map(([day, agg]) => ({ 
          day, 
          value: agg.spend > 0 ? (agg.revenue/agg.spend) : (agg.roasSum/(agg.count||1)),
          // Also store individual campaign ROAS for consistency
          individualRoas: agg.roasSum/(agg.count||1),
          weightedRoas: agg.spend > 0 ? (agg.revenue/agg.spend) : null
        }))
        .sort((a,b) => (a.day < b.day ? 1 : -1));
      
      console.log(`[roas-overall] Aggregated ${desc.length} days from ${desc[desc.length-1]?.day} to ${desc[0]?.day}`);

      // KPI - Calculate proper month-over-month comparison
      const today = desc[0]?.value ?? null;
      const yesterday = desc[1]?.value ?? null;
      
      // Calculate month-over-month trend (compare current month vs previous month)
      let monthOverMonth = null;
      if (desc.length > 0) {
        const currentMonth = desc[0]?.day?.substring(0, 7); // YYYY-MM
        const currentMonthData = desc.filter(d => d.day.startsWith(currentMonth));
        const previousMonth = new Date(currentMonth + '-01');
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        const prevMonthStr = previousMonth.toISOString().substring(0, 7);
        const previousMonthData = desc.filter(d => d.day.startsWith(prevMonthStr));
        
        if (currentMonthData.length > 0 && previousMonthData.length > 0) {
          const currentAvg = currentMonthData.reduce((sum, d) => sum + d.value, 0) / currentMonthData.length;
          const previousAvg = previousMonthData.reduce((sum, d) => sum + d.value, 0) / previousMonthData.length;
          monthOverMonth = previousAvg;
        }
      }
      
      const kpi = roasOverall.querySelector('#kpi-roas');
      if (kpi) kpi.insertAdjacentHTML('beforeend', this.createKPICard('Overall ROAS', today, monthOverMonth, 'decimal'));

      requestAnimationFrame(() => {
        const clipped = this.clipSeriesByCanvas('roas-overall', desc);
        this.createTimeSeriesChart('roas-overall', clipped, 'ROAS', '#3b82f6');
        
        // Auto-load insights for this chart
        autoLoadInsightsForChart('Overall ROAS', clipped, 'line', 'roas-overall');
      });

      const btn = roasOverall.querySelector('button.view-details[data-detail="roas-overall"]');
      if (btn) {
        btn.addEventListener('click', () => {
          if (!window.detailModal) return;
          window.detailModal.setTitle('Overall ROAS');
          window.detailModal.setBuilders({
            buildChartConfig: (days) => {
              const sorted = [...desc].slice(0, days).sort((a,b)=>a.day.localeCompare(b.day));
              return { type:'line', data:{ labels:sorted.map(d=>d.day), datasets:[{ label:'ROAS', data:sorted.map(d=>d.value), borderColor:'#3b82f6', backgroundColor:'#3b82f620', borderWidth:2, fill:true, tension:0.4 }] }, options:{ responsive:true, maintainAspectRatio:false } };
            },
            buildTableHtml: (days) => {
              const sorted = [...desc].slice(0, days).sort((a,b)=>a.day.localeCompare(b.day));
              return this.buildTableHtml('Overall ROAS', sorted.map(d=>({ day:d.day, roas:d.value })), [
                { key:'day', header:'Date' },
                { key:'roas', header:'ROAS', render:(v)=>this.formatNumber(v,'decimal') }
              ]);
            },
            defaultDays: 90
          });
          window.detailModal.open();
        });
      }
    }

    // Topic: Campaign Insights (filter + comparison)
    const camp = document.createElement('div');
    camp.id = 'section-campaign-insights';
    camp.className = 'topic';
    camp.innerHTML = `
      <h3>Campaign Insights</h3>
      <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px">
        <label for="campaign-select" style="font-size:14px;color:#555">Campaign:</label>
        <select id="campaign-select" style="padding:6px 10px; border:1px solid #e0e0e0; border-radius:6px;"></select>
      </div>
      <div class="chart-wrapper"><div class="chart-title">Selected Campaign ROAS <span class="small-muted">(range)</span>
        <span class="range-local" data-target="roas-campaign">
          <button data-d="7">7d</button>
          <button data-d="30">30d</button>
          <button data-d="90">90d</button>
        </span>
      </div><canvas id="roas-campaign" height="300"></canvas></div>
      <div class="chart-wrapper"><div class="chart-title">Campaign Comparison <span class="small-muted">(range)</span>
        <span class="range-local" data-target="roas-comparison">
          <button data-d="7">7d</button>
          <button data-d="30">30d</button>
          <button data-d="90">90d</button>
        </span>
      </div><canvas id="roas-comparison" height="300"></canvas></div>
    `;
    container.appendChild(camp);

    if (metrics.campaign_kpis && metrics.campaign_kpis.length > 0) {
      const select = camp.querySelector('#campaign-select');
      const campaigns = Array.from(new Set(metrics.campaign_kpis.map(r => r.campaign))).sort();
      select.innerHTML = campaigns.map(c => `<option value="${c}">${c}</option>`).join('');

      const renderSelected = () => {
        const chosen = select.value || campaigns[0];
        const series = metrics.campaign_kpis.filter(r => r.campaign === chosen).map(r => ({ day: r.day, value: r.roas }));
        const clipped = this.clipSeriesByCanvas('roas-campaign', series);
        this.createTimeSeriesChart('roas-campaign', clipped, `${chosen} ROAS`, '#0ea5e9');
      };

      requestAnimationFrame(() => {
        renderSelected();
        const clippedCmp = this.clipSeriesByCanvas('roas-comparison', metrics.campaign_kpis || []);
        const agg = this.aggregateRoasByCampaign(clippedCmp);
        this.createComparisonChart('roas-comparison', [{ label: 'ROAS', values: agg.values, color: '#3b82f6' }], agg.labels);
      });

      select.addEventListener('change', renderSelected);
    }

    // Topic: Creative Performance
    const creative = document.createElement('div');
    creative.id = 'section-creative-ctr';
    creative.className = 'topic';
    creative.innerHTML = `
      <h3>Creative Performance</h3>
      <div class="chart-wrapper"><div class="chart-title">CTR Performance <span class="small-muted">(range)</span>
        <span class="range-local" data-target="creative-ctr">
          <button data-d="7">7d</button>
          <button data-d="30">30d</button>
          <button data-d="90" class="active">90d</button>
        </span>
      </div><canvas id="creative-ctr" height="300"></canvas></div>
      <div class="metrics-tables" style="margin:8px 0 0 0"><button class="view-details" data-detail="creative-ctr">View details</button></div>
    `;
    container.appendChild(creative);
    if (metrics.creative_ctr && metrics.creative_ctr.length > 0) {
      // Add range button functionality
      const rangeButtons = creative.querySelectorAll('.range-local[data-target="creative-ctr"] button');
      rangeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          // Remove active class from all buttons
          rangeButtons.forEach(b => b.classList.remove('active'));
          // Add active class to clicked button
          btn.classList.add('active');
          // Re-render chart with new range
          const daily = this.buildDailyAverageSeries(metrics.creative_ctr, 'ctr');
          const clipped = this.clipSeriesByCanvas('creative-ctr', daily);
          this.createTimeSeriesChart('creative-ctr', clipped, 'CTR', '#8b5cf6');
        });
      });
      
      requestAnimationFrame(() => {
        const daily = this.buildDailyAverageSeries(metrics.creative_ctr, 'ctr');
        const clipped = this.clipSeriesByCanvas('creative-ctr', daily);
        this.createTimeSeriesChart('creative-ctr', clipped, 'CTR', '#8b5cf6');
      });
      const cbtn = creative.querySelector('button.view-details[data-detail="creative-ctr"]');
      if (cbtn) {
        cbtn.addEventListener('click', () => {
          if (!window.detailModal) return;
          window.detailModal.setTitle('CTR Performance');
          window.detailModal.setBuilders({
            buildChartConfig: (days) => {
              const daily = this.buildDailyAverageSeries(metrics.creative_ctr, 'ctr');
              const data = daily.slice(0, days).sort((a,b)=>a.day.localeCompare(b.day));
              return { type:'line', data:{ labels:data.map(d=>d.day), datasets:[{ label:'CTR', data:data.map(d=>d.value), borderColor:'#8b5cf6', backgroundColor:'#8b5cf620', borderWidth:2, fill:true, tension:0.4 }] }, options:{ responsive:true, maintainAspectRatio:false } };
            },
            buildTableHtml: (days) => {
              const data = [...metrics.creative_ctr].slice(0, days).sort((a,b)=>a.day.localeCompare(b.day));
              return this.buildTableHtml('Creative CTR', data, [
                { key:'day', header:'Date' },
                { key:'channel', header:'Channel' },
                { key:'creative_id', header:'Creative' },
                { key:'ctr', header:'CTR', render:(v)=>this.formatNumber(v,'percentage') }
              ]);
            },
            defaultDays: 90
          });
          window.detailModal.open();
        });
      }
    }

    // Topic: Budget Pacing
    const budget = document.createElement('div');
    budget.id = 'section-budget-pacing';
    budget.className = 'topic';
    budget.innerHTML = `
      <h3>Budget Pacing</h3>
      <div class="chart-wrapper"><div class="chart-title">Pacing Variance <span class="small-muted">(range)</span>
        <span class="range-local" data-target="budget-pacing">
          <button data-d="7">7d</button>
          <button data-d="30">30d</button>
          <button data-d="90">90d</button>
        </span>
      </div><canvas id="budget-pacing" height="300"></canvas></div>
      <div class="metrics-tables" style="margin:8px 0 0 0"><button class="view-details" data-detail="budget-pacing">View details</button></div>
    `;
    container.appendChild(budget);
    if (metrics.budget_pacing && metrics.budget_pacing.length > 0) {
      requestAnimationFrame(() => {
        const daily = this.buildDailyAverageSeries(metrics.budget_pacing, 'pacing_variance');
        const clipped = this.clipSeriesByCanvas('budget-pacing', daily);
        this.createTimeSeriesChart('budget-pacing', clipped, 'Pacing Variance %', '#f59e0b');
      });
      const bbtn = budget.querySelector('button.view-details[data-detail="budget-pacing"]');
      if (bbtn) {
        bbtn.addEventListener('click', () => {
          if (!window.detailModal) return;
          window.detailModal.setTitle('Pacing Variance');
          window.detailModal.setBuilders({
            buildChartConfig: (days) => {
              const daily = this.buildDailyAverageSeries(metrics.budget_pacing, 'pacing_variance');
              const data = daily.slice(0, days).sort((a,b)=>a.day.localeCompare(b.day));
              return { type:'line', data:{ labels:data.map(d=>d.day), datasets:[{ label:'Pacing Variance %', data:data.map(d=>d.value), borderColor:'#f59e0b', backgroundColor:'#f59e0b20', borderWidth:2, fill:true, tension:0.4 }] }, options:{ responsive:true, maintainAspectRatio:false } };
            },
            buildTableHtml: (days) => {
              const data = [...metrics.budget_pacing].slice(0, days).sort((a,b)=>a.day.localeCompare(b.day));
              return this.buildTableHtml('Budget Pacing', data, [
                { key:'day', header:'Date' },
                { key:'channel', header:'Channel' },
                { key:'planned_spend', header:'Planned', render:(v)=>this.formatNumber(v,'currency') },
                { key:'actual_spend', header:'Actual', render:(v)=>this.formatNumber(v,'currency') },
                { key:'pacing_variance', header:'Variance %', render:(v)=>this.formatNumber(v,'percentage') }
              ]);
            },
            defaultDays: 90
          });
          window.detailModal.open();
        });
      }
    }

    // Topic: Brand Health
    const brandHealth = document.createElement('div');
    brandHealth.id = 'section-brand-health';
    brandHealth.className = 'topic';
    brandHealth.innerHTML = `
      <h3>Brand Health</h3>
      <div class="chart-wrapper">
        <div class="chart-title">Brand Sentiment & NPS Trends</div>
        <canvas id="brand-health-chart"></canvas>
      </div>
    `;
    container.appendChild(brandHealth);

    // Render Brand Health Chart
    if (metrics.brand_health && metrics.brand_health.length > 0) {
      const brandData = [...metrics.brand_health].sort((a,b) => a.day.localeCompare(b.day));
      
      const ctx = brandHealth.querySelector('#brand-health-chart');
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: brandData.map(d => d.day),
            datasets: [
              {
                label: 'Brand Sentiment',
                data: brandData.map(d => d.social_sentiment_score),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                yAxisID: 'sentiment',
                tension: 0.4
              },
              {
                label: 'NPS Score',
                data: brandData.map(d => d.nps),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                yAxisID: 'nps',
                tension: 0.4
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top'
              }
            },
            scales: {
              sentiment: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                  display: true,
                  text: 'Brand Sentiment (-1 to +1)'
                },
                min: -1,
                max: 1,
                grid: {
                  color: 'rgba(0,0,0,0.1)'
                }
              },
              nps: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                  display: true,
                  text: 'NPS Score (0-10)'
                },
                min: 0,
                max: 10,
                grid: {
                  drawOnChartArea: false
                }
              },
              x: {
                display: true,
                title: {
                  display: true,
                  text: 'Date'
                }
              }
            },
            interaction: {
              intersect: false,
              mode: 'index'
            }
          }
        });
      }
    }
  }

  // Build quick links row under KPI section
  buildSectionLinks() {
    const container = document.getElementById('section-links');
    if (!container) return;
    const topics = Array.from(document.querySelectorAll('#topic-groups .topic'));
    const links = topics.map(topic => {
      const titleEl = topic.querySelector('h3');
      const id = topic.id || 'section-' + (titleEl?.textContent || 'section').toLowerCase().replace(/[^a-z0-9]+/g,'-');
      // Ensure element has an id to anchor
      if (!topic.id) topic.id = id;
      const label = titleEl ? titleEl.textContent.trim() : 'Section';
      return { id, label };
    });
    container.innerHTML = links.map(l => `<a class="link-btn" href="#${l.id}"><span class="icon">🔗</span>${l.label}</a>`).join('');
    
    // Add back-to-data-section buttons to each topic
    this.addBackToDataButtons(topics);
  }

  // Build section quick links for navigation
  buildSectionLinks() {
    const contentPanel = document.getElementById('content-section-panel');
    const sectionLinksContainer = document.getElementById('section-links');
    const topics = document.querySelectorAll('#topic-groups .topic');
    
    if (!contentPanel || !sectionLinksContainer) return;
    
    // Clear existing links
    sectionLinksContainer.innerHTML = '';
    
    if (topics.length === 0) return;
    
    // Create quick links to each topic
    topics.forEach(topic => {
      const title = topic.querySelector('h3')?.textContent || 'Chart';
      const topicId = topic.id;
      
      if (topicId) {
        const link = document.createElement('a');
        link.href = `#${topicId}`;
        link.textContent = title;
        link.className = 'section-link';
        sectionLinksContainer.appendChild(link);
      }
    });
    
    // Add back buttons to each topic
    this.addBackToDataButtons(topics);
  }

  // Add small back-to-data-section buttons to each topic
  addBackToDataButtons(topics) {
    topics.forEach(topic => {
      // Check if back button already exists
      if (topic.querySelector('.back-to-data-btn')) return;
      
      // Create back button
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
      
      // Add hover effect
      backBtn.addEventListener('mouseenter', () => {
        backBtn.style.background = '#e5e7eb';
        backBtn.style.borderColor = '#9ca3af';
      });
      
      backBtn.addEventListener('mouseleave', () => {
        backBtn.style.background = '#f3f4f6';
        backBtn.style.borderColor = '#d1d5db';
      });
      
      // Insert at the end of the topic section
      topic.appendChild(backBtn);
    });
  }


  // Main render method
  render(role, metrics) {
    // Ensure previous charts are cleaned up to prevent resize loops
    this.destroy();
    this.renderKPIGrid(role, metrics);
    // Defer chart creation to next frame to allow DOM layout to settle
    requestAnimationFrame(() => {
      this.renderCharts(role, metrics);
      // Add click handlers for range buttons after DOM is ready
      this.attachRangeHandlers(role, metrics);
    });
  }

  // Attach click handlers to range buttons
  attachRangeHandlers(role, metrics) {
    document.querySelectorAll('.range-local button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const canvasId = e.target.closest('.range-local').dataset.target;
        const days = parseInt(e.target.dataset.d, 10);
        
        // Update active button
        e.target.closest('.range-local').querySelectorAll('button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Re-render the specific chart
        this.rerenderChart(canvasId, days, role, metrics);
      });
    });
    
    // Set default active button (90d)
    document.querySelectorAll('.range-local button[data-d="90"]').forEach(btn => btn.classList.add('active'));
  }

  // Re-render a specific chart with new range
  rerenderChart(canvasId, days, role, metrics) {
    const data = window.__LATEST_METRICS__;
    if (!data) return;
    
    // Destroy existing chart
    if (this.charts.has(canvasId)) {
      this.charts.get(canvasId).destroy();
      this.charts.delete(canvasId);
    }
    
    // Recreate chart with clipped data
    const clipped = [...(data.metrics[this.getMetricKey(canvasId)] || [])].slice(0, days);
    
    switch(canvasId) {
      case 'funnel-chart': {
        const rows = [...(data.metrics['ecom_funnel'] || [])].slice(0, days);
        if (!rows.length) break;
        let agg;
        if (rows.length === 1) {
          const r = rows[0];
          agg = { sessions: r.sessions||0, pdp_views: r.pdp_views||0, add_to_cart: r.add_to_cart||0, checkouts: r.checkouts||0, purchases: r.purchases||0 };
        } else {
          agg = rows.reduce((acc, d) => {
            acc.sessions += d.sessions || 0;
            acc.pdp_views += d.pdp_views || 0;
            acc.add_to_cart += d.add_to_cart || 0;
            acc.checkouts += d.checkouts || 0;
            acc.purchases += d.purchases || 0;
            return acc;
          }, { sessions:0, pdp_views:0, add_to_cart:0, checkouts:0, purchases:0 });
        }
        const funnelData = [
          { stage:'Sessions', count: agg.sessions },
          { stage:'PDP Views', count: agg.pdp_views },
          { stage:'ATC', count: agg.add_to_cart },
          { stage:'Checkout', count: agg.checkouts },
          { stage:'Purchase', count: agg.purchases }
        ];
        this.createFunnelChart('funnel-chart', funnelData);
        break;
      }
      case 'payment-trend':
        this.createTimeSeriesChart('payment-trend', 
          clipped.map(d => ({ day: d.day, value: d.payment_failure_rate })), 
          'Failure Rate', '#dc3545');
        break;
      case 'sku-efficiency': {
        const rows = [...(data.metrics['sku_efficiency'] || [])];
        const daily = this.buildDailyAverageSeries(rows, 'efficiency_score');
        const recent = daily.slice(0, days);
        this.createTimeSeriesChart('sku-efficiency', recent, 'Efficiency Score', '#10b981');
        break;
      }
      case 'roas-comparison':
        // Recompute aggregated ROAS per campaign for the selected window using campaign_kpis
        {
          const rows = [...(data.metrics['campaign_kpis'] || [])].slice(0, days);
          const agg = this.aggregateRoasByCampaign(rows);
          this.createComparisonChart('roas-comparison', [{ label: 'ROAS', values: agg.values, color: '#3b82f6' }], agg.labels);
        }
        break;
      case 'creative-ctr': {
        const rows = [...(data.metrics['creative_ctr'] || [])];
        const daily = this.buildDailyAverageSeries(rows, 'ctr');
        const recent = daily.slice(0, days);
        this.createTimeSeriesChart('creative-ctr', recent, 'CTR', '#8b5cf6');
        break;
      }
      case 'budget-pacing': {
        const rows = [...(data.metrics['budget_pacing'] || [])];
        const daily = this.buildDailyAverageSeries(rows, 'pacing_variance');
        const recent = daily.slice(0, days);
        this.createTimeSeriesChart('budget-pacing', recent, 'Pacing Variance %', '#f59e0b');
        break;
      }
      case 'roas-overall': {
        const rows = [...(data.metrics['campaign_kpis'] || [])];
        console.log(`[roas-overall] Raw data: ${rows.length} rows from ${rows[0]?.day} to ${rows[rows.length-1]?.day}`);
        const series = this.buildOverallRoasSeries(rows);
        console.log(`[roas-overall] Aggregated series: ${series.length} days from ${series[0]?.day} to ${series[series.length-1]?.day}`);
        const recent = series.slice(0, days);
        console.log(`[roas-overall] After slice(${days}): ${recent.length} days from ${recent[0]?.day} to ${recent[recent.length-1]?.day}`);
        this.createTimeSeriesChart('roas-overall', recent, 'ROAS', '#3b82f6');
        break;
      }
      case 'roas-campaign': {
        const select = document.getElementById('campaign-select');
        const chosen = select ? select.value : null;
        const rows = [...(data.metrics['campaign_kpis'] || [])];
        const series = chosen ? rows.filter(r => r.campaign === chosen).map(r => ({ day: r.day, value: r.roas })) : [];
        console.log(`[roas-campaign] Filtered series for ${chosen}: ${series.length} days`);
        const recent = series.sort((a,b)=> (a.day < b.day ? 1 : -1)).slice(0, days);
        console.log(`[roas-campaign] After slice(${days}): ${recent.length} days`);
        this.createTimeSeriesChart('roas-campaign', recent, `${chosen || 'Campaign'} ROAS`, '#0ea5e9');
        break;
      }
    }
  }

  // Map canvas ID to metric key
  getMetricKey(canvasId) {
    const mapping = {
      'funnel-chart': 'ecom_funnel',
      'payment-trend': 'payment_failures',
      'sku-efficiency': 'sku_efficiency', 
      'roas-comparison': 'mkt_roas_campaign',
      'creative-ctr': 'creative_ctr',
      'budget-pacing': 'budget_pacing'
    };
    return mapping[canvasId] || '';
  }

  // Create Chart.js chart
  createChart(canvasId, type, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`Canvas ${canvasId} not found`);
      return null;
    }

    // Destroy existing chart if it exists
    if (this.charts.has(canvasId)) {
      this.charts.get(canvasId).destroy();
    }

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: type === 'line' ? {
        x: {
          type: 'time',
          time: {
            parser: 'yyyy-MM-dd',
            displayFormats: {
              day: 'MMM dd'
            }
          }
        },
        y: {
          beginAtZero: true
        }
      } : {}
    };

    const chartOptions = { ...defaultOptions, ...options };
    const chart = new Chart(canvas, {
      type: type,
      data: data,
      options: chartOptions
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  // Create time series chart
  createTimeSeriesChart(canvasId, timeData, label, color = '#3b82f6') {
    console.log(`[${canvasId}] Creating time series chart with ${timeData.length} data points`);
    
    if (timeData.length === 0) {
      console.warn(`[${canvasId}] No data to plot`);
      return null;
    }

    // Sort data by day ascending for proper time series display
    const sorted = [...timeData].sort((a,b) => (a.day > b.day ? 1 : (a.day < b.day ? -1 : 0)));
    
    console.log(`[${canvasId}] Date range: ${sorted[0].day} to ${sorted[sorted.length-1].day}`);
    console.log(`[${canvasId}] Sample data:`, sorted.slice(0, 3));

    const chartData = {
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

    return this.createChart(canvasId, 'line', chartData);
  }

  // Create comparison chart (bar chart)
  createComparisonChart(canvasId, data, labels) {
    console.log(`[${canvasId}] Creating comparison chart with ${labels.length} categories`);
    
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

  // Create funnel chart
  createFunnelChart(canvasId, funnelData) {
    console.log(`[${canvasId}] Creating funnel chart with ${funnelData.length} stages`);
    
    const chartData = {
      labels: funnelData.map(d => d.stage),
      datasets: [{
        label: 'Count',
        data: funnelData.map(d => d.count),
        backgroundColor: [
          '#3b82f6',
          '#8b5cf6', 
          '#10b981',
          '#f59e0b',
          '#ef4444'
        ],
        borderWidth: 1
      }]
    };

    return this.createChart(canvasId, 'bar', chartData);
  }

  // Load Enhanced Insights for a specific chart (only load stored, don't auto-generate)
  async loadChartInsights(chartTitle, chartData, chartType, chartKey) {
    const insightsElement = document.getElementById(`insights-${chartKey}`);
    if (!insightsElement) return;
    
    const insightsContent = insightsElement.querySelector('.insights-content');
    const timestampElement = insightsElement.querySelector('.insights-timestamp');
    if (!insightsContent) return;
    
    // Show loading state
    insightsContent.innerHTML = '<div class="insights-loading">Loading insights...</div>';
    
    try {
      // Only try to get stored insights from database (no auto-generation)
      const customRole = window.__CUSTOM_ROLE_NAME__;
      if (customRole) {
        const storedInsightsResponse = await fetch(`/api/custom_role/insights/${encodeURIComponent(customRole)}/${chartKey}`);
        if (storedInsightsResponse.ok) {
          const storedResult = await storedInsightsResponse.json();
          if (storedResult.ok && storedResult.insights) {
            this.displayInsights(insightsContent, storedResult.insights);
            // Display timestamp
            if (timestampElement && storedResult.updated_at) {
              const date = new Date(storedResult.updated_at);
              timestampElement.textContent = `Last updated: ${date.toLocaleString()}`;
            }
            return;
          }
        }
      }
      
      // If no stored insights, show message to generate them
      insightsContent.innerHTML = '<div class="insights-empty">No insights available. Click "Update Analysis" to generate insights.</div>';
      if (timestampElement) {
        timestampElement.textContent = '';
      }
    } catch (error) {
      console.error('Error loading insights:', error);
      insightsContent.innerHTML = '<div class="insights-error">Failed to load insights</div>';
      if (timestampElement) {
        timestampElement.textContent = '';
      }
    }
  }
  
  // Generate new insights (called when Update Analysis button is clicked)
  async generateNewInsights(chartTitle, chartData, chartType, chartKey) {
    const insightsElement = document.getElementById(`insights-${chartKey}`);
    if (!insightsElement) return;
    
    const insightsContent = insightsElement.querySelector('.insights-content');
    const timestampElement = insightsElement.querySelector('.insights-timestamp');
    const updateBtn = insightsElement.querySelector('.update-insights-btn');
    
    if (!insightsContent) return;
    
    // Disable button and show loading
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.textContent = '🔄 Generating...';
    }
    insightsContent.innerHTML = '<div class="insights-loading">Generating new insights...</div>';
    
    try {
      // Generate new insights
      const customRole = window.__CUSTOM_ROLE_NAME__;
      const response = await fetch('/api/chart/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart_title: chartTitle,
          chart_data: chartData,
          chart_type: chartType,
          role_name: customRole,
          chart_id: chartKey
        })
      });
      
      const result = await response.json();
      
      if (result.ok && result.insights) {
        this.displayInsights(insightsContent, result.insights);
        // Update timestamp
        if (timestampElement) {
          timestampElement.textContent = `Last updated: ${new Date().toLocaleString()}`;
        }
      } else {
        insightsContent.innerHTML = `<div class="insights-error">${result.error || 'Failed to generate insights'}</div>`;
      }
    } catch (error) {
      console.error('Error generating insights:', error);
      insightsContent.innerHTML = '<div class="insights-error">Failed to generate insights</div>';
    } finally {
      // Re-enable button
      if (updateBtn) {
        updateBtn.disabled = false;
        updateBtn.textContent = '🔄 Update Analysis';
      }
    }
  }
  
  // Display insights in the UI
  displayInsights(container, insights) {
    if (!insights || insights.length === 0) {
      container.innerHTML = '<div class="insights-empty">No insights available</div>';
      return;
    }
    
    const insightsList = insights.map(insight => `<li>${insight}</li>`).join('');
    container.innerHTML = `<ul class="insights-list">${insightsList}</ul>`;
  }

  // Cleanup method
  destroy() {
    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();
  }
}

// Table sorting functionality
function sortTable(header) {
  const table = header.closest('table');
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const columnIndex = Array.from(header.parentNode.children).indexOf(header);
  
  const isAscending = header.classList.contains('sort-asc');
  
  // Remove existing sort classes
  header.parentNode.querySelectorAll('th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
  });
  
  // Add new sort class
  header.classList.add(isAscending ? 'sort-desc' : 'sort-asc');
  
  // Sort rows
  rows.sort((a, b) => {
    const aValue = a.children[columnIndex].textContent.trim();
    const bValue = b.children[columnIndex].textContent.trim();
    
    // Try to parse as numbers
    const aNum = parseFloat(aValue.replace(/[^0-9.-]/g, ''));
    const bNum = parseFloat(bValue.replace(/[^0-9.-]/g, ''));
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return isAscending ? bNum - aNum : aNum - bNum;
    }
    
    // Sort as strings
    return isAscending ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
  });
  
  // Re-append sorted rows
  rows.forEach(row => tbody.appendChild(row));
}

// Enhanced Insights Functions
async function loadChartInsights(chartTitle, chartData, chartType, insightsElementId) {
  const insightsElement = document.getElementById(insightsElementId);
  if (!insightsElement) return;
  
  const insightsContent = insightsElement.querySelector('.insights-content');
  if (!insightsContent) return;
  
  // Show loading state
  insightsContent.innerHTML = '<div class="insights-loading">Generating insights...</div>';
  
  try {
    const response = await fetch('/api/chart/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chart_title: chartTitle,
        chart_data: chartData,
        chart_type: chartType
      })
    });
    
    const result = await response.json();
    
    if (result.ok && result.insights) {
      displayInsights(insightsContent, result.insights);
    } else {
      insightsContent.innerHTML = `<div class="insights-error">${result.error || 'Failed to generate insights'}</div>`;
    }
  } catch (error) {
    console.error('Error loading insights:', error);
    insightsContent.innerHTML = '<div class="insights-error">Failed to load insights</div>';
  }
}

function displayInsights(container, insights) {
  if (!insights || insights.length === 0) {
    container.innerHTML = '<div class="insights-empty">No insights available</div>';
    return;
  }
  
  const insightsList = insights.map(insight => `<li>${insight}</li>`).join('');
  container.innerHTML = `<ul class="insights-list">${insightsList}</ul>`;
}

// Automatically load insights for charts when they are rendered
function autoLoadInsightsForChart(chartTitle, chartData, chartType, chartId) {
  // Generate insights element ID from chart ID
  const insightsId = `insights-${chartId}`;
  
  // Small delay to ensure the chart is rendered first
  setTimeout(() => {
    loadChartInsights(chartTitle, chartData, chartType, insightsId);
  }, 500);
}

// Initialize global visualizer
window.metricsVisualizer = new MetricsVisualizer();
