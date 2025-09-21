function setStepState(stepId, state) {
  const el = document.getElementById(stepId);
  if (!el) return;
  el.classList.remove('active');
  if (state === 'active') el.classList.add('active');
  if (state === 'done') el.classList.add('done');
}

function logProgress(msg) {
  const log = document.getElementById('progress-log');
  log.style.display = 'block';
  const p = document.createElement('div');
  p.textContent = msg;
  log.appendChild(p);
}

document.getElementById('btn-cancel').addEventListener('click', () => {
  window.location.href = '/';
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('progress-panel').style.display = 'block';
  setStepState('step-1', 'active');

  const role_name = document.getElementById('role_name').value.trim();
  const gcp_project = document.getElementById('gcp_project').value.trim();
  const bq_dataset = document.getElementById('bq_dataset').value.trim();
  const bq_tables = document.getElementById('bq_tables').value.split(',').map(s => s.trim()).filter(Boolean);
  const sa_json_file = document.getElementById('sa_json_file').files[0];

  try {
    // Step 1: validate & create scenario
    let sa_json_content = '';
    if (sa_json_file) {
      sa_json_content = await sa_json_file.text();
    }
    
    const createRes = await fetch('/api/new_role/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_name, gcp_project, bq_dataset, bq_tables, sa_json: sa_json_content })
    });
    const createJson = await createRes.json();
    if (!createRes.ok || !createJson.ok) throw new Error(createJson.error || 'Failed to create role');
    setStepState('step-1', 'done');
    setStepState('step-2', 'active');
    logProgress('Created role configuration.');

    // Step 2: create sqlite instance happens server-side with create
    setStepState('step-2', 'done');
    setStepState('step-3', 'active');
    logProgress('SQLite instance ready. Starting BigQuery import...');

    // Step 3: import
    const importRes = await fetch('/api/new_role/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_name })
    });
    const importJson = await importRes.json();
    if (!importRes.ok || !importJson.ok) throw new Error(importJson.error || 'Import failed');
    setStepState('step-3', 'done');
    setStepState('step-4', 'active');
    logProgress('Import completed. Running analysis...');

    // Step 4: analyze
    const analyzeRes = await fetch('/api/new_role/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_name })
    });
    const analyzeJson = await analyzeRes.json();
    if (!analyzeRes.ok || !analyzeJson.ok) throw new Error(analyzeJson.error || 'Analysis failed');
    setStepState('step-4', 'done');
    setStepState('step-5', 'active');
    logProgress('Analysis finished. Generating dashboard...');

    // Step 5: finalize and redirect to new dashboard
    const finalizeRes = await fetch('/api/new_role/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_name })
    });
    const finalizeJson = await finalizeRes.json();
    if (!finalizeRes.ok || !finalizeJson.ok) throw new Error(finalizeJson.error || 'Finalize failed');
    setStepState('step-5', 'done');
    logProgress('Setup complete. Redirecting...');

    window.location.href = `/dashboard/${encodeURIComponent(role_name)}`;
  } catch (err) {
    logProgress(`Error: ${err.message}`);
    alert(err.message);
  }
});


