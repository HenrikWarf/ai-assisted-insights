(function(){
  let modalChartInstance = null;
  async function loadModal() {
    try {
      const res = await fetch('/static/modal.html', { cache: 'no-store' });
      const html = await res.text();
      const mount = document.getElementById('modal-mount');
      if (mount) mount.innerHTML = html;
      wireModal();
    } catch (e) {
      console.error('Failed to load modal markup', e);
    }
  }

  function wireModal() {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;
    const rangeEl = modal.querySelector('.range-local');
    let rebuild = null; // callback to rebuild chart/table with selected range
    function close() {
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      // Destroy modal chart instance on close
      try {
        if (modalChartInstance) { modalChartInstance.destroy(); modalChartInstance = null; }
      } catch(_) {}
    }
    function open() {
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]')) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') close();
    });

    window.detailModal = {
      open,
      close,
      setTitle(title){
        const t = document.getElementById('detail-modal-title');
        if (t) t.textContent = title || 'Details';
      },
      // Provide a builder to regenerate chart+table given a number of days
      setBuilders({ buildChartConfig, buildTableHtml, defaultDays = 90 }){
        // attach handlers
        const buttons = rangeEl ? Array.from(rangeEl.querySelectorAll('button')) : [];
        buttons.forEach(b => b.classList.remove('active'));
        const defBtn = buttons.find(b => b.dataset.d == String(defaultDays)) || buttons[buttons.length-1];
        if (defBtn) defBtn.classList.add('active');
        rebuild = (days) => {
          const canvas = document.getElementById('detail-modal-canvas');
          const table = document.getElementById('detail-modal-table');
          const chartConfig = buildChartConfig(days);
          const tableHtml = buildTableHtml(days);
          if (table) table.innerHTML = tableHtml || '';
          if (canvas) {
            try { if (modalChartInstance) { modalChartInstance.destroy(); modalChartInstance = null; } } catch(_) {}
            modalChartInstance = new Chart(canvas.getContext('2d'), chartConfig);
          }
        };
        // Wire click events
        buttons.forEach(btn => btn.onclick = (e) => {
          buttons.forEach(b => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
          const days = parseInt(e.currentTarget.dataset.d, 10) || defaultDays;
          if (rebuild) rebuild(days);
        });
        // initial render
        if (rebuild) rebuild(defaultDays);
      },
      // Backwards compatibility (direct config/table set)
      setContent({ chartConfig, tableHtml }){
        const canvas = document.getElementById('detail-modal-canvas');
        const table = document.getElementById('detail-modal-table');
        if (table) table.innerHTML = tableHtml || '';
        if (canvas) {
          // Destroy any existing chart bound to modal canvas
          try { if (modalChartInstance) { modalChartInstance.destroy(); modalChartInstance = null; } } catch(_) {}
          const ctx = canvas.getContext('2d');
          modalChartInstance = new Chart(ctx, chartConfig);
        }
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadModal);
  } else {
    loadModal();
  }
})();


