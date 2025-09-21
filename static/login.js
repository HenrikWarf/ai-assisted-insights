async function loadCustomRoles() {
  try {
    const res = await fetch('/api/custom_roles');
    if (!res.ok) return;
    const data = await res.json();
    const customRoles = data.custom_roles || [];
    
    const roleGrid = document.querySelector('.role-grid');
    if (!roleGrid || customRoles.length === 0) return;
    
    // Add custom role buttons
    customRoles.forEach(role => {
      const button = document.createElement('button');
      button.className = 'role-card';
      button.id = `btn-custom-${role.id}`;
      button.innerHTML = `
        <div class="role-circle" aria-hidden="true">
          <svg class="role-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12l2 2 4-4M21 12c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="role-label">${role.name}</div>
      `;
      
      button.addEventListener('click', () => {
        window.location.href = `/dashboard/${encodeURIComponent(role.name)}`;
      });
      
      roleGrid.appendChild(button);
    });
  } catch (e) {
    console.error('Failed to load custom roles:', e);
  }
}

async function login(role) {
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    alert('Failed to login');
    return;
  }
  window.location.href = '/dashboard';
}

document.getElementById('btn-merch').addEventListener('click', () => login('E-commerce Manager'));
document.getElementById('btn-store').addEventListener('click', () => login('Marketing Lead'));

const addRoleBtn = document.getElementById('btn-add-role');
if (addRoleBtn) {
  addRoleBtn.addEventListener('click', () => {
    window.location.href = '/register';
  });
}

// Load custom roles when page loads
document.addEventListener('DOMContentLoaded', loadCustomRoles);


