/**
 * Metrics rendering and data processing
 */

/**
 * Renders metrics data into the dashboard
 * @param {Object} data - Metrics data object
 */
function renderMetrics(data) {
  if (!data || !data.metrics) {
    console.error('No metrics data provided');
    return;
  }

  const metrics = data.metrics;
  const role = data.role;

  // Clear existing content
  const metricsContainer = document.getElementById('metrics-container');
  if (metricsContainer) {
    metricsContainer.innerHTML = '';
  }

  // Render role-specific metrics
  if (role === 'E-commerce Manager') {
    renderEcommerceMetrics(metrics);
  } else if (role === 'Marketing Lead') {
    renderMarketingMetrics(metrics);
  } else if (role === 'Merchandiser') {
    renderMerchandiserMetrics(metrics);
  } else {
    // Custom role or unknown role
    renderCustomRoleMetrics(metrics, data);
  }

  // Update metadata
  updateMetadata(data);
}

/**
 * Renders e-commerce specific metrics
 * @param {Object} metrics - Metrics data
 */
function renderEcommerceMetrics(metrics) {
  const container = document.getElementById('metrics-container');
  
  // E-commerce Funnel
  if (metrics.ecom_funnel && metrics.ecom_funnel.length > 0) {
    const funnelSection = createMetricSection('E-commerce Funnel', 'ecom-funnel');
    funnelSection.innerHTML = `
      <div class="chart-container">
        <canvas id="ecom-funnel-chart"></canvas>
      </div>
    `;
    container.appendChild(funnelSection);
    
    // Create funnel chart
    setTimeout(() => {
      if (window.metricsVisualizer) {
        window.metricsVisualizer.createFunnelChart('ecom-funnel-chart', metrics.ecom_funnel);
      }
    }, 100);
  }

  // Payment Failures
  if (metrics.payment_failures && metrics.payment_failures.length > 0) {
    const paymentSection = createMetricSection('Payment Failures', 'payment-failures');
    paymentSection.innerHTML = `
      <div class="chart-container">
        <canvas id="payment-failures-chart"></canvas>
      </div>
    `;
    container.appendChild(paymentSection);
    
    setTimeout(() => {
      if (window.metricsVisualizer) {
        window.metricsVisualizer.createTimeSeriesChart('payment-failures-chart', metrics.payment_failures, 'Payment Failures', '#ef4444');
      }
    }, 100);
  }

  // Product Conversion
  if (metrics.product_conv && metrics.product_conv.length > 0) {
    const productSection = createMetricSection('Product Conversion', 'product-conversion');
    productSection.innerHTML = `
      <div class="chart-container">
        <canvas id="product-conv-chart"></canvas>
      </div>
    `;
    container.appendChild(productSection);
    
    setTimeout(() => {
      if (window.metricsVisualizer) {
        window.metricsVisualizer.createProductConversionChart('product-conv-chart', metrics.product_conv);
      }
    }, 100);
  }

  // SKU Efficiency
  if (metrics.sku_efficiency && metrics.sku_efficiency.length > 0) {
    const skuSection = createMetricSection('SKU Efficiency', 'sku-efficiency');
    skuSection.innerHTML = `
      <div class="chart-container">
        <canvas id="sku-efficiency-chart"></canvas>
      </div>
    `;
    container.appendChild(skuSection);
    
    setTimeout(() => {
      if (window.metricsVisualizer) {
        window.metricsVisualizer.createSKUEfficiencyChart('sku-efficiency-chart', metrics.sku_efficiency);
      }
    }, 100);
  }
}

/**
 * Renders marketing specific metrics
 * @param {Object} metrics - Metrics data
 */
function renderMarketingMetrics(metrics) {
  const container = document.getElementById('metrics-container');
  
  // Campaign KPIs
  if (metrics.campaign_kpis && metrics.campaign_kpis.length > 0) {
    const campaignSection = createMetricSection('Campaign Performance', 'campaign-kpis');
    campaignSection.innerHTML = `
      <div class="chart-container">
        <canvas id="campaign-kpis-chart"></canvas>
      </div>
    `;
    container.appendChild(campaignSection);
    
    setTimeout(() => {
      if (window.metricsVisualizer) {
        window.metricsVisualizer.createCampaignKPIsChart('campaign-kpis-chart', metrics.campaign_kpis);
      }
    }, 100);
  }

  // Creative CTR
  if (metrics.creative_ctr && metrics.creative_ctr.length > 0) {
    const creativeSection = createMetricSection('Creative Performance', 'creative-ctr');
    creativeSection.innerHTML = `
      <div class="chart-container">
        <canvas id="creative-ctr-chart"></canvas>
      </div>
    `;
    container.appendChild(creativeSection);
    
    setTimeout(() => {
      if (window.metricsVisualizer) {
        window.metricsVisualizer.createCreativeCTRChart('creative-ctr-chart', metrics.creative_ctr);
      }
    }, 100);
  }

  // Brand Health
  if (metrics.brand_health && metrics.brand_health.length > 0) {
    const brandSection = createMetricSection('Brand Health', 'brand-health');
    brandSection.innerHTML = `
      <div class="chart-container">
        <canvas id="brand-health-chart"></canvas>
      </div>
    `;
    container.appendChild(brandSection);
    
    setTimeout(() => {
      if (window.metricsVisualizer) {
        window.metricsVisualizer.createBrandHealthChart('brand-health-chart', metrics.brand_health);
      }
    }, 100);
  }
}

/**
 * Renders merchandiser specific metrics
 * @param {Object} metrics - Metrics data
 */
function renderMerchandiserMetrics(metrics) {
  const container = document.getElementById('metrics-container');
  
  // Product Performance
  if (metrics.product_conv && metrics.product_conv.length > 0) {
    const productSection = createMetricSection('Product Performance', 'product-performance');
    productSection.innerHTML = `
      <div class="chart-container">
        <canvas id="product-performance-chart"></canvas>
      </div>
    `;
    container.appendChild(productSection);
    
    setTimeout(() => {
      if (window.metricsVisualizer) {
        window.metricsVisualizer.createProductConversionChart('product-performance-chart', metrics.product_conv);
      }
    }, 100);
  }

  // SKU Efficiency
  if (metrics.sku_efficiency && metrics.sku_efficiency.length > 0) {
    const skuSection = createMetricSection('SKU Efficiency', 'sku-efficiency');
    skuSection.innerHTML = `
      <div class="chart-container">
        <canvas id="sku-efficiency-chart"></canvas>
      </div>
    `;
    container.appendChild(skuSection);
    
    setTimeout(() => {
      if (window.metricsVisualizer) {
        window.metricsVisualizer.createSKUEfficiencyChart('sku-efficiency-chart', metrics.sku_efficiency);
      }
    }, 100);
  }
}

/**
 * Renders custom role metrics
 * @param {Object} metrics - Metrics data
 * @param {Object} data - Full data object from the API
 */
function renderCustomRoleMetrics(metrics, data) {
  console.log('Metrics object:', metrics);
  const container = document.getElementById('metrics-container');
  if (!container) return;
  
  const plan = data.plan;

  // Render KPI cards
  const kpiCards = [];
  Object.entries(metrics).forEach(([key, value]) => {
    if (key.startsWith('kpi_') && typeof value === 'object' && value !== null) {
      const kpiId = key.substring(4);
      const kpiInfo = plan?.kpis?.find(k => k.id === kpiId);
      const kpiTitle = kpiInfo?.title || kpiId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const kpiValue = Object.values(value)[0];
      const changePct = value.change_pct;
      
      // For now, previousValue is null as it's not calculated for custom KPIs yet
      kpiCards.push(createKPICard(kpiTitle, kpiValue, null, 'integer', '', false));
    }
  });
  
  if (kpiCards.length > 0) {
    const kpiSection = createMetricSection('Key Performance Indicators', 'custom-kpis');
    kpiSection.innerHTML = `<div class="kpi-grid">${kpiCards.join('')}</div>`;
    container.appendChild(kpiSection);
  }
  
  // Render charts
  Object.entries(metrics).forEach(([key, value]) => {
    if (key.startsWith('chart_') && Array.isArray(value) && value.length > 0) {
      const chartId = key.substring(6);
      
      // Find the chart object in the plan to get the real title and description
      const chartInfo = plan?.charts?.find(c => c.id === parseInt(chartId, 10));
      const chartTitle = chartInfo?.title || chartId.replace(/_/g, ' ');
      const chartDescription = chartInfo?.description || '';

      const chartSection = createMetricSection(chartTitle, key, chartDescription);
      chartSection.innerHTML += `
        <div class="chart-container">
          <canvas id="${key}-chart"></canvas>
        </div>
      `;
      container.appendChild(chartSection);
      
      setTimeout(() => {
        if (window.metricsVisualizer) {
          window.metricsVisualizer.createCustomChart(`${key}-chart`, value, chartTitle);
        }
      }, 100);
    }
  });
}

/**
 * Creates a metric section container
 * @param {string} title - Section title
 * @param {string} id - Section ID
 * @param {string} description - Optional description for the section
 * @returns {HTMLElement} Section element
 */
function createMetricSection(title, id, description = '') {
  const section = document.createElement('div');
  section.className = 'metric-section';
  section.id = id;
  
  const header = document.createElement('div');
  header.className = 'metric-section-header';
  header.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    ${description ? `<p class="metric-description">${escapeHtml(description)}</p>` : ''}
  `;
  
  section.appendChild(header);
  return section;
}

/**
 * Renders custom simple metrics (legacy function)
 * @param {Object} metrics - Metrics data
 */
function renderCustomSimple(metrics) {
  const container = document.getElementById('metrics-container');
  if (!container) return;
  
  container.innerHTML = '<div class="custom-metrics-placeholder">Custom metrics will be rendered here</div>';
}
