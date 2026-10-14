let currentUser = JSON.parse(localStorage.getItem('crtv_user')) || null;
let authToken = localStorage.getItem('crtv_token') || null;
let authModalMode = 'login';
let authModalRole = 'student';
let cachedStudentIssues = [];
let allPublicActiveIssues = [];

const API_BASE = '/api';

// Toast Notification Manager
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? 'fa-circle-check text-emerald-400' 
             : type === 'error' ? 'fa-triangle-exclamation text-rose-400' 
             : 'fa-circle-info text-indigo-400';

  toast.innerHTML = `
    <i class="fa-solid ${icon} text-base"></i>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  renderCurrentView();
  renderChatbotRoleUI();

  document.getElementById('auth-form')?.addEventListener('submit', handleAuthSubmit);
  document.getElementById('raise-issue-form')?.addEventListener('submit', handleRaiseIssueSubmit);
  document.getElementById('profile-form')?.addEventListener('submit', handleProfileUpdate);
});

function renderNavbar() {
  const container = document.getElementById('nav-auth-container');
  if (!container) return;
  if (currentUser) {
    container.innerHTML = `
      <div class="flex items-center space-x-3">
        <div class="text-right hidden sm:block">
          <p class="text-xs font-bold text-white">${currentUser.name}</p>
          <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">${currentUser.role}</span>
        </div>
        <button onclick="logout()" class="px-3.5 py-2 border border-slate-700 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-300 transition-colors">
          Sign Out
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="flex items-center space-x-2">
        <button onclick="openAuthModal('student', 'login')" class="px-3.5 py-2 text-xs font-bold text-indigo-400 hover:bg-slate-800/60 rounded-xl transition-colors">
          Sign In
        </button>
        <button onclick="openAuthModal('student', 'signup')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold btn-shimmer shadow-xs">
          Sign Up
        </button>
      </div>
    `;
  }
}

function renderCurrentView() {
  document.getElementById('guest-view')?.classList.add('hidden');
  document.getElementById('about-view')?.classList.add('hidden');
  document.getElementById('student-view')?.classList.add('hidden');
  document.getElementById('technician-view')?.classList.add('hidden');
  document.getElementById('management-view')?.classList.add('hidden');

  renderChatbotRoleUI();

  if (!currentUser) {
    document.getElementById('guest-view')?.classList.remove('hidden');
    return;
  }

  if (currentUser.role === 'student') {
    document.getElementById('student-view')?.classList.remove('hidden');
    populateStudentProfile();
    loadStudentIssues();
    renderSeatGrid();
  } else if (currentUser.role === 'technician') {
    document.getElementById('technician-view')?.classList.remove('hidden');
    loadTechnicianFeed();
  } else if (currentUser.role === 'management') {
    document.getElementById('management-view')?.classList.remove('hidden');
    loadManagementOverview();
  }
}

function showHome() {
  renderCurrentView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAboutPage() {
  document.getElementById('guest-view')?.classList.add('hidden');
  document.getElementById('student-view')?.classList.add('hidden');
  document.getElementById('technician-view')?.classList.add('hidden');
  document.getElementById('management-view')?.classList.add('hidden');

  const aboutView = document.getElementById('about-view');
  if (aboutView) {
    aboutView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function openAuthModal(role, mode) {
  authModalRole = role;
  authModalMode = mode;
  setAuthRole(role);
  updateAuthModalUI();
  document.getElementById('auth-modal')?.classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.add('hidden');
}

function setAuthRole(role) {
  authModalRole = role;
  ['student', 'technician', 'management'].forEach(r => {
    const btn = document.getElementById(`role-btn-${r}`);
    if (btn) {
      btn.className = r === role 
        ? 'py-2 text-xs font-bold rounded-xl bg-indigo-600 shadow-xs text-white transition-all'
        : 'py-2 text-xs font-semibold rounded-xl text-slate-400 transition-all';
    }
  });

  const rollField = document.getElementById('roll-field-container');
  if (role === 'student' && authModalMode === 'signup') {
    rollField?.classList.remove('hidden');
  } else {
    rollField?.classList.add('hidden');
  }
}

function toggleAuthMode() {
  authModalMode = authModalMode === 'login' ? 'signup' : 'login';
  updateAuthModalUI();
}

function updateAuthModalUI() {
  const isSignup = authModalMode === 'signup';
  document.getElementById('modal-title').innerText = isSignup ? 'Create Account' : 'Sign In';
  document.getElementById('auth-submit-btn').innerText = isSignup ? 'Sign Up' : 'Sign In';
  document.getElementById('signup-fields')?.classList.toggle('hidden', !isSignup);
  document.getElementById('auth-toggle-prompt').innerText = isSignup ? 'Already have an account?' : "Don't have an account?";
  document.getElementById('auth-toggle-link').innerText = isSignup ? 'Sign In' : 'Sign Up';

  const rollField = document.getElementById('roll-field-container');
  if (authModalRole === 'student' && isSignup) {
    rollField?.classList.remove('hidden');
  } else {
    rollField?.classList.add('hidden');
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const endpoint = authModalMode === 'signup' ? `${API_BASE}/auth/register` : `${API_BASE}/auth/login`;

  const payload = { email, password, role: authModalRole };

  if (authModalMode === 'signup') {
    payload.name = document.getElementById('auth-name').value;
    if (authModalRole === 'student') {
      payload.rollNumber = document.getElementById('auth-roll').value;
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');

    currentUser = data.user;
    authToken = data.token;
    localStorage.setItem('crtv_user', JSON.stringify(currentUser));
    localStorage.setItem('crtv_token', authToken);

    showToast(`Welcome, ${currentUser.name}!`, 'success');
    closeAuthModal();
    renderNavbar();
    renderCurrentView();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function logout() {
  currentUser = null;
  authToken = null;
  cachedStudentIssues = [];
  allPublicActiveIssues = [];
  localStorage.removeItem('crtv_user');
  localStorage.removeItem('crtv_token');
  showToast('Logged out successfully.', 'info');
  renderNavbar();
  renderCurrentView();
}

function switchStudentTab(tab) {
  document.getElementById('subview-grid')?.classList.add('hidden');
  document.getElementById('subview-raise')?.classList.add('hidden');
  document.getElementById('subview-my-issues')?.classList.add('hidden');
  document.getElementById('subview-profile')?.classList.add('hidden');

  ['grid', 'raise', 'my-issues', 'profile'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    if (btn) {
      btn.className = t === tab 
        ? 'pb-3 text-sm font-bold border-b-2 border-indigo-400 text-indigo-400 transition-colors whitespace-nowrap'
        : 'pb-3 text-sm font-semibold text-slate-400 hover:text-white transition-colors whitespace-nowrap';
    }
  });

  if (tab === 'grid') {
    document.getElementById('subview-grid')?.classList.remove('hidden');
    renderSeatGrid();
  }
  if (tab === 'raise') document.getElementById('subview-raise')?.classList.remove('hidden');
  if (tab === 'my-issues') {
    document.getElementById('subview-my-issues')?.classList.remove('hidden');
    loadStudentIssues();
  }
  if (tab === 'profile') document.getElementById('subview-profile')?.classList.remove('hidden');
}

// Technician Module Switcher (Active Queue vs Resolved History)
function switchTechTab(tab) {
  const activeModule = document.getElementById('tech-active-module');
  const completedModule = document.getElementById('tech-completed-module');
  const btnActive = document.getElementById('tech-tab-active');
  const btnCompleted = document.getElementById('tech-tab-completed');

  if (tab === 'active') {
    activeModule?.classList.remove('hidden');
    completedModule?.classList.add('hidden');
    btnActive.className = 'pb-3 text-sm font-bold border-b-2 border-indigo-400 text-indigo-400 transition-colors flex items-center gap-2';
    btnCompleted.className = 'pb-3 text-sm font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-2';
  } else {
    activeModule?.classList.add('hidden');
    completedModule?.classList.remove('hidden');
    btnCompleted.className = 'pb-3 text-sm font-bold border-b-2 border-emerald-400 text-emerald-400 transition-colors flex items-center gap-2';
    btnActive.className = 'pb-3 text-sm font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-2';
  }
}

function populateStudentProfile() {
  if (!currentUser) return;
  document.getElementById('prof-name').value = currentUser.name || '';
  document.getElementById('prof-roll').value = currentUser.rollNumber || '';
  document.getElementById('prof-dept').value = currentUser.department || '';
  document.getElementById('prof-phone').value = currentUser.phone || '';
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  try {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: document.getElementById('prof-name').value,
        rollNumber: document.getElementById('prof-roll').value,
        department: document.getElementById('prof-dept').value,
        phone: document.getElementById('prof-phone').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    currentUser = data.user;
    localStorage.setItem('crtv_user', JSON.stringify(currentUser));
    showToast('Profile details saved successfully!', 'success');
    renderNavbar();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function applyFormPreset(component, priority, description) {
  const compSelect = document.getElementById('issue-component');
  if (compSelect) compSelect.value = component;

  const prioSelect = document.getElementById('issue-priority');
  if (prioSelect) prioSelect.value = priority;

  const descBox = document.getElementById('issue-desc');
  if (descBox) descBox.value = description;

  showToast(`Preset loaded for ${component}! Enter PC number.`, 'info');
}

function filterStudentTable(searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  const rows = document.querySelectorAll('#student-issues-table-body tr');
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(term) ? '' : 'none';
  });
}

function exportAuditReportCSV() {
  const rows = Array.from(document.querySelectorAll('#mgmt-issues-table-body tr'));
  if (!rows.length || rows[0].innerText.includes('No records')) {
    showToast('No records available to export.', 'error');
    return;
  }

  let csvContent = 'data:text/csv;charset=utf-8,';
  csvContent += 'Lab & PC,Student Name & Roll,Component,Priority,Status,Technician,Reported Date,Resolved Date\n';

  rows.forEach(row => {
    const cols = Array.from(row.querySelectorAll('td')).map(td => `"${td.innerText.replace(/"/g, '""').replace(/\n/g, ' ')}"`);
    csvContent += cols.join(',') + '\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `LabFix_Audit_Report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Audit Report downloaded as CSV!', 'success');
}

// ========================================================
// 🎟️ 60-SEAT WORKSTATION FLOOR PLAN (RED → YELLOW → GREEN)
// ========================================================

function normalizeLab(str) {
  return (str || '').toUpperCase().replace(/LAB/g, '').replace(/[^A-Z0-9]/g, '').trim();
}

function extractSystemNumber(str) {
  if (!str) return null;
  const match = str.toString().match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

async function fetchGlobalActiveIssues() {
  allPublicActiveIssues = [];
  try {
    const res = await fetch(`${API_BASE}/issues/active-map`);
    if (res.ok) {
      allPublicActiveIssues = await res.json();
    }
  } catch (e) {
    console.error('active-map error:', e);
  }

  if ((!allPublicActiveIssues || allPublicActiveIssues.length === 0) && authToken) {
    try {
      const res = await fetch(`${API_BASE}/issues/my-issues`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const myIssues = await res.json();
        allPublicActiveIssues = myIssues.filter(i => i.status !== 'Completed');
      }
    } catch (e) {}
  }
}

async function renderSeatGrid() {
  const selectedLab = document.getElementById('grid-lab-select')?.value || 'MG-001';
  const container = document.getElementById('seats-grid-container');
  if (!container) return;

  await fetchGlobalActiveIssues();

  const targetLabNorm = normalizeLab(selectedLab);

  let html = '';
  // Renders 60 WORKSTATIONS per lab: SYS-01 to SYS-60
  for (let i = 1; i <= 60; i++) {
    const sysNumber = `SYS-${i < 10 ? '0' + i : i}`;
    const currentSeatNum = i;

    const issue = allPublicActiveIssues.find(iss => {
      if (iss.status === 'Completed') return false;
      const issLabNorm = normalizeLab(iss.labName);
      const issSeatNum = extractSystemNumber(iss.systemNumber);
      return issLabNorm === targetLabNorm && issSeatNum === currentSeatNum;
    });

    let seatClass = 'seat-green';
    let icon = '<i class="fa-solid fa-desktop text-sm mb-1"></i>';
    let statusLabel = 'OK';

    if (issue) {
      if (issue.status === 'Accepted' || issue.status === 'Processing') {
        seatClass = 'seat-yellow'; // 🟡 YELLOW
        icon = '<i class="fa-solid fa-screwdriver-wrench text-sm mb-1"></i>';
        statusLabel = 'In Repair';
      } else {
        seatClass = 'seat-red'; // 🔴 RED
        icon = '<i class="fa-solid fa-triangle-exclamation text-sm mb-1"></i>';
        statusLabel = issue.componentType || 'Broken';
      }
    }

    const safeIssueJson = issue ? encodeURIComponent(JSON.stringify(issue)) : '';

    html += `
      <div onclick="handleSeatClick('${selectedLab}', '${sysNumber}', '${safeIssueJson}')" 
           class="seat-btn ${seatClass} group" title="${sysNumber}: ${statusLabel}">
        ${icon}
        <span class="tracking-wide text-xs">${sysNumber}</span>
        <span class="text-[8px] opacity-80 font-bold truncate max-w-full uppercase">${statusLabel}</span>
      </div>
    `;
  }

  container.innerHTML = html;
}

function handleSeatClick(labName, sysNumber, encodedIssue) {
  const modal = document.getElementById('seat-modal');
  const icon = document.getElementById('seat-modal-icon');
  const title = document.getElementById('seat-modal-title');
  const subtitle = document.getElementById('seat-modal-subtitle');
  const body = document.getElementById('seat-modal-body');
  const actions = document.getElementById('seat-modal-actions');

  title.innerText = sysNumber;
  subtitle.innerText = labName;

  if (!encodedIssue) {
    icon.className = 'w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl border border-emerald-500/40';
    icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    body.innerHTML = `
      <p class="text-emerald-400 font-bold flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Workstation Status: 100% Operational (Green)
      </p>
      <p class="text-slate-400">No active malfunctions reported for ${sysNumber} in ${labName}. PC is ready for lab use.</p>
      <p class="text-slate-400">If you noticed a broken mouse, keyboard, or display here, you can report an issue now.</p>
    `;
    actions.innerHTML = `
      <button onclick="bookSeatIssue('${labName}', '${sysNumber}')" class="flex-1 py-3 btn-aurora-student text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2">
        <i class="fa-solid fa-flag"></i> Report Issue on ${sysNumber} (Mark Red for Everyone)
      </button>
    `;
  } else {
    const issue = JSON.parse(decodeURIComponent(encodedIssue));
    
    const isOwner = currentUser && (
      currentUser.id === issue.student || 
      currentUser.name === issue.studentName ||
      currentUser.rollNumber === issue.rollNumber
    );

    const isInRepair = (issue.status === 'Accepted' || issue.status === 'Processing');

    icon.className = isInRepair 
      ? 'w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl border border-amber-500/40'
      : 'w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl border border-rose-500/40';
    
    icon.innerHTML = isInRepair ? '<i class="fa-solid fa-screwdriver-wrench"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';

    body.innerHTML = `
      <div class="flex justify-between items-center pb-2 border-b border-slate-800">
        <span class="font-bold text-white">Issue: ${issue.componentType}</span>
        <span class="badge ${isInRepair ? 'badge-processing' : 'badge-pending'}">${issue.status} (${isInRepair ? 'Yellow' : 'Red'})</span>
      </div>
      <p><span class="text-slate-400">Reported By:</span> <strong class="text-white">${issue.studentName} (${issue.rollNumber})</strong></p>
      <p><span class="text-slate-400">Priority:</span> <span class="text-rose-400 font-bold">${issue.priority} Priority</span></p>
      ${issue.technicianName ? `<p><span class="text-slate-400">Assigned Tech:</span> <span class="text-indigo-400 font-semibold">${issue.technicianName}</span></p>` : ''}
      
      <div class="mt-2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-amber-300 flex items-center gap-2">
        <i class="fa-solid fa-info-circle text-amber-400"></i>
        <span>${isOwner ? 'You reported this issue. You can withdraw it below to restore the PC to Green.' : 'This computer is already marked broken. Technicians have been notified; please do not submit duplicate tickets.'}</span>
      </div>
    `;

    if (isOwner) {
      actions.innerHTML = `
        <button onclick="cancelStudentIssue('${issue._id}')" class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md">
          <i class="fa-solid fa-rotate-left"></i> Cancel / Withdraw Issue (Turn Back to Green)
        </button>
      `;
    } else {
      actions.innerHTML = `
        <button onclick="closeSeatModal()" class="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs">
          Got it (Avoid Duplicate)
        </button>
      `;
    }
  }

  modal.classList.remove('hidden');
}

function closeSeatModal() {
  document.getElementById('seat-modal')?.classList.add('hidden');
}

function bookSeatIssue(labName, sysNumber) {
  closeSeatModal();
  switchStudentTab('raise');
  document.getElementById('issue-lab').value = labName;
  document.getElementById('issue-system').value = sysNumber;
  showToast(`Workstation ${sysNumber} in ${labName} selected! Choose broken component & submit.`, 'info');
}

async function cancelStudentIssue(issueId) {
  try {
    const res = await fetch(`${API_BASE}/issues/${issueId}/cancel`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    closeSeatModal();
    showToast('Issue withdrawn! Workstation restored to Green globally.', 'success');
    await loadStudentIssues();
    renderSeatGrid();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRaiseIssueSubmit(e) {
  e.preventDefault();
  const labSelected = document.getElementById('issue-lab').value;
  const sysSelected = document.getElementById('issue-system').value;

  const payload = {
    labName: labSelected,
    systemNumber: sysSelected,
    componentType: document.getElementById('issue-component').value,
    priority: document.getElementById('issue-priority').value,
    description: document.getElementById('issue-desc').value
  };

  try {
    const res = await fetch(`${API_BASE}/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast('Issue reported! Workstation is now marked RED on the map.', 'success');
    document.getElementById('raise-issue-form').reset();
    
    const floorPlanSelect = document.getElementById('grid-lab-select');
    if (floorPlanSelect) floorPlanSelect.value = labSelected;

    switchStudentTab('grid');
    await renderSeatGrid();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadStudentIssues() {
  try {
    const res = await fetch(`${API_BASE}/issues/my-issues`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const issues = await res.json();
    cachedStudentIssues = issues;
    
    const countBadge = document.getElementById('student-issue-count');
    if (countBadge) countBadge.innerText = issues.length;

    const tbody = document.getElementById('student-issues-table-body');
    if (!tbody) return;

    if (!issues.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">No issues reported yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = issues.map(iss => {
      const isDone = iss.status === 'Completed';
      const isInRepair = (iss.status === 'Accepted' || iss.status === 'Processing');

      return `
        <tr class="hover:bg-slate-800/50 transition-colors">
          <td class="p-4 font-bold text-white">
            ${iss.labName} <br/>
            <span class="text-xs font-medium text-slate-400">${iss.systemNumber}</span>
          </td>
          <td class="p-4 font-semibold text-slate-200">
            ${iss.componentType}<br/>
            <span class="text-xs font-normal text-slate-400">${iss.description}</span>
          </td>
          <td class="p-4">
            ${isDone ? `
              <span class="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <span class="radar-pulse-green"></span> Operational (Green)
              </span>
            ` : isInRepair ? `
              <span class="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <i class="fa-solid fa-screwdriver-wrench text-xs"></i> In Repair (Yellow)
              </span>
            ` : `
              <span class="inline-flex items-center gap-1.5 text-xs font-bold ${iss.priority === 'High' ? 'text-rose-400' : iss.priority === 'Moderate' ? 'text-amber-400' : 'text-slate-400'}">
                ${iss.priority === 'High' ? '<span class="radar-pulse-rose"></span>' : '<span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>'}
                ${iss.priority} (Red)
              </span>
            `}
          </td>
          <td class="p-4">
            ${isDone ? `
              <span class="badge badge-completed font-extrabold shadow-sm shadow-emerald-500/25">
                <i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> Completed (Green)
              </span>
            ` : isInRepair ? `
              <span class="badge badge-processing font-bold text-amber-300 border-amber-600/50 bg-amber-950/40">
                ${iss.status} (Yellow)
              </span>
            ` : `
              <span class="badge badge-pending font-bold text-rose-300 border-rose-600/50 bg-rose-950/40">
                ${iss.status} (Red)
              </span>
            `}
          </td>
          <td class="p-4">
            ${!isDone ? `
              <button onclick="cancelStudentIssue('${iss._id}')" class="px-2.5 py-1 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white rounded-lg text-xs font-bold border border-slate-700 transition-colors">
                Cancel (Set Green)
              </button>
            ` : `
              <span class="text-xs text-slate-500 font-semibold">Restored</span>
            `}
          </td>
          <td class="p-4 text-xs text-slate-500">${new Date(iss.createdAt).toLocaleDateString()}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

// Technician Feed - Renders Active Queue and Completed Module separately
async function loadTechnicianFeed() {
  const priority = document.getElementById('tech-filter-priority')?.value || 'All';

  try {
    const res = await fetch(`${API_BASE}/issues/technician-feed?priority=${priority}&status=All`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const issues = await res.json();
    
    // Split issues into Active Queue vs Completed History
    const activeIssues = issues.filter(iss => iss.status !== 'Completed');
    const completedIssues = issues.filter(iss => iss.status === 'Completed');

    // Update Counts
    const activeBadge = document.getElementById('tech-active-count');
    if (activeBadge) activeBadge.innerText = activeIssues.length;
    const completedBadge = document.getElementById('tech-completed-count');
    if (completedBadge) completedBadge.innerText = completedIssues.length;

    // 1. Render Active Work Queue
    const activeGrid = document.getElementById('technician-cards-grid');
    if (activeGrid) {
      if (!activeIssues.length) {
        activeGrid.innerHTML = `<div class="col-span-full p-12 text-center text-slate-500">🎉 All caught up! No active lab malfunctions pending.</div>`;
      } else {
        activeGrid.innerHTML = activeIssues.map(iss => {
          const isInRepair = (iss.status === 'Accepted' || iss.status === 'Processing');

          return `
            <div class="glass-panel p-5 rounded-3xl interactive-card flex flex-col justify-between ${isInRepair ? 'border-amber-500/30' : 'border-rose-500/30'}">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div>
                    <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">${iss.labName}</span>
                    <h3 class="text-xl font-black text-white tracking-tight">${iss.systemNumber}</h3>
                  </div>
                  <div class="text-right">
                    ${isInRepair ? `
                      <span class="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                        <i class="fa-solid fa-wrench text-xs"></i> In Repair
                      </span>
                      <span class="badge badge-processing block mt-1 font-bold text-amber-300 border-amber-600/50 bg-amber-950/40">🟡 Yellow</span>
                    ` : `
                      <span class="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400">
                        <span class="radar-pulse-rose"></span> ${iss.priority}
                      </span>
                      <span class="badge badge-pending block mt-1 font-bold text-rose-300 border-rose-600/50 bg-rose-950/40">🔴 Red</span>
                    `}
                  </div>
                </div>
                <div class="bg-slate-950/60 p-3.5 rounded-2xl text-xs space-y-1.5 mb-4 border border-slate-800">
                  <p><span class="font-bold text-slate-300">Issue:</span> <span class="text-white">${iss.componentType}</span></p>
                  <p><span class="font-bold text-slate-300">Details:</span> <span class="text-slate-300">${iss.description}</span></p>
                  <p><span class="font-bold text-slate-300">Student:</span> <span class="text-slate-400">${iss.studentName} (${iss.rollNumber})</span></p>
                </div>
              </div>
              <div class="pt-3 border-t border-slate-800 space-y-2">
                ${iss.status === 'Pending' ? `
                  <button onclick="acceptIssue('${iss._id}')" class="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2">
                    <i class="fa-solid fa-check"></i> Accept Issue (Turn Yellow)
                  </button>
                ` : `
                  <div class="space-y-2">
                    <input type="text" id="tech-notes-${iss._id}" placeholder="Resolution note (e.g. Replaced mouse)..." class="w-full px-3.5 py-2 border border-slate-700 bg-slate-900 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500">
                    <div class="flex gap-2">
                      <button onclick="updateIssueStatus('${iss._id}', 'Processing')" class="flex-1 py-2 bg-blue-950/60 text-blue-300 border border-blue-700/50 hover:bg-blue-900/80 rounded-xl text-xs font-bold transition-colors">
                        Processing (Yellow)
                      </button>
                      <button onclick="updateIssueStatus('${iss._id}', 'Completed')" class="flex-1 py-2 btn-aurora-tech btn-shimmer text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-circle-check"></i> Mark Done (Go Green)
                      </button>
                    </div>
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 2. Render Completed History Module (Separate Tab Table)
    const completedTable = document.getElementById('technician-completed-grid');
    if (completedTable) {
      if (!completedIssues.length) {
        completedTable.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">No completed repairs recorded yet.</td></tr>`;
      } else {
        completedTable.innerHTML = completedIssues.map(iss => `
          <tr class="hover:bg-slate-800/50 text-xs transition-colors">
            <td class="p-4 font-bold text-white">${iss.labName} (${iss.systemNumber})</td>
            <td class="p-4 text-slate-300">${iss.studentName}<br/><span class="text-slate-500">${iss.rollNumber}</span></td>
            <td class="p-4 text-slate-200">${iss.componentType}</td>
            <td class="p-4 text-slate-300">${iss.resolutionNotes || 'Repaired & bench tested'}</td>
            <td class="p-4">
              <span class="badge badge-completed font-bold">
                <i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> Green (Restored)
              </span>
            </td>
            <td class="p-4 text-slate-500">${iss.resolvedAt ? new Date(iss.resolvedAt).toLocaleDateString() : '-'}</td>
          </tr>
        `).join('');
      }
    }

  } catch (err) {
    console.error(err);
  }
}

async function acceptIssue(id) {
  try {
    const res = await fetch(`${API_BASE}/issues/${id}/accept`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!res.ok) throw new Error('Failed to accept ticket');
    showToast('Issue accepted! Workstation turned YELLOW on the floor map.', 'success');
    loadTechnicianFeed();
    renderSeatGrid();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateIssueStatus(id, newStatus) {
  const notes = document.getElementById(`tech-notes-${id}`)?.value || '';
  try {
    const res = await fetch(`${API_BASE}/issues/${id}/status`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}` 
      },
      body: JSON.stringify({ status: newStatus, resolutionNotes: notes })
    });
    if (!res.ok) throw new Error('Failed to update status');

    if (newStatus === 'Completed') {
      showToast('Completed! Workstation moved to Resolved Module & turned GREEN.', 'success');
    } else {
      showToast('Workstation marked In Repair (YELLOW).', 'info');
    }

    loadTechnicianFeed();
    renderSeatGrid();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadManagementOverview() {
  const status = document.getElementById('mgmt-filter-status')?.value || 'All';
  const labName = document.getElementById('mgmt-filter-lab')?.value || 'All';
  const month = document.getElementById('mgmt-filter-month')?.value || 'All';
  const year = document.getElementById('mgmt-filter-year')?.value || 'All';

  const url = `${API_BASE}/management/overview?status=${status}&labName=${labName}&month=${month}&year=${year}`;

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('stat-total').innerText = data.metrics.totalRaised;
    document.getElementById('stat-pending').innerText = data.metrics.pendingCount;
    document.getElementById('stat-processing').innerText = data.metrics.processingCount;
    document.getElementById('stat-completed').innerText = data.metrics.completedCount;
    document.getElementById('stat-rate').innerText = `${data.metrics.resolutionRate}%`;

    const labDropdown = document.getElementById('mgmt-filter-lab');
    if (labDropdown && labDropdown.options.length <= 1) {
      const mgLabs = ['MG-001', 'MG-002', 'MG-003', 'MG-004', 'MG-401', 'MG-402', 'MG-403', 'MG-404', 'MG-405'];
      mgLabs.forEach(lab => {
        const opt = document.createElement('option');
        opt.value = lab;
        opt.innerText = lab;
        labDropdown.appendChild(opt);
      });
    }

    document.getElementById('mgmt-issue-count-badge').innerText = `${data.issues.length} records`;
    const tbody = document.getElementById('mgmt-issues-table-body');
    if (!tbody) return;

    if (!data.issues.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500">No records found matching filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.issues.map(iss => {
      const isDone = iss.status === 'Completed';
      const isInRepair = (iss.status === 'Accepted' || iss.status === 'Processing');

      return `
        <tr class="hover:bg-slate-800/50 text-xs transition-colors">
          <td class="p-4 font-bold text-white">${iss.labName} <br/><span class="text-slate-400 font-normal">${iss.systemNumber}</span></td>
          <td class="p-4 font-semibold text-slate-200">${iss.studentName}<br/><span class="text-slate-400 font-normal">${iss.rollNumber}</span></td>
          <td class="p-4 font-medium text-slate-300">${iss.componentType}</td>
          <td class="p-4">
            ${isDone ? `
              <span class="inline-flex items-center gap-1.5 font-bold text-emerald-400">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Operational (Green)
              </span>
            ` : isInRepair ? `
              <span class="inline-flex items-center gap-1.5 font-bold text-amber-400">
                <span class="w-2 h-2 rounded-full bg-amber-400"></span> In Repair (Yellow)
              </span>
            ` : `
              <span class="inline-flex items-center gap-1.5 font-bold text-rose-400">
                <span class="radar-pulse-rose"></span> Pending (Red)
              </span>
            `}
          </td>
          <td class="p-4"><span class="badge ${isDone ? 'badge-completed' : isInRepair ? 'badge-processing' : 'badge-pending'}">${iss.status}</span></td>
          <td class="p-4 font-medium text-slate-300">${iss.technicianName || '<span class="text-slate-500 italic">Unassigned</span>'}</td>
          <td class="p-4 text-slate-500">${new Date(iss.createdAt).toLocaleDateString()}</td>
          <td class="p-4 text-slate-500">${iss.resolvedAt ? new Date(iss.resolvedAt).toLocaleDateString() : '-'}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

// AI Agent Controller
function toggleAgentChat() {
  const chatWindow = document.getElementById('ai-chat-window');
  if (chatWindow) {
    chatWindow.classList.toggle('hidden');
    if (!chatWindow.classList.contains('hidden')) {
      renderChatbotRoleUI();
      document.getElementById('ai-input')?.focus();
    }
  }
}

function renderChatbotRoleUI() {
  const chipsContainer = document.getElementById('ai-faq-chips');
  const greetingBubble = document.querySelector('#ai-chat-messages > div:first-child');
  if (!chipsContainer) return;

  if (currentUser && currentUser.role === 'technician') {
    if (greetingBubble) {
      greetingBubble.innerHTML = `🔧 <strong>Technician Assistant:</strong> Ready to assist. Inquire about unaccepted pending issues, high priority breakdowns, or lab numbers below:`;
    }
    chipsContainer.innerHTML = `
      <div class="space-y-1.5">
        <span class="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block">Technician Triage:</span>
        <div class="flex flex-wrap gap-1.5">
          <button type="button" onclick="sendQuickQuestion('How many pending unaccepted issues and which labs?')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-amber-950/60 text-amber-300 hover:text-white rounded-xl border border-amber-700/50 text-[11px] font-bold transition-all flex items-center gap-1.5">
            <i class="fa-solid fa-bell text-amber-400"></i> Unaccepted Pending Issues
          </button>
          <button type="button" onclick="sendQuickQuestion('Which labs have high priority tickets?')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950/60 text-rose-300 hover:text-white rounded-xl border border-rose-700/50 text-[11px] font-bold transition-all">
            🚨 Urgent Breakdowns
          </button>
        </div>
      </div>
    `;
  } else if (currentUser && currentUser.role === 'management') {
    if (greetingBubble) {
      greetingBubble.innerHTML = `📊 <strong>Management Analytics Assistant:</strong> Inquire about any month or year (e.g. <em>"2024 issues in oct"</em>) to get numerical reports:`;
    }
    chipsContainer.innerHTML = `
      <div class="space-y-1.5">
        <span class="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider block">Executive Analytics:</span>
        <div class="flex flex-wrap gap-1.5">
          <button type="button" onclick="sendQuickQuestion('How many issues in 2024 in oct?')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-cyan-950/60 text-cyan-300 hover:text-white rounded-xl border border-cyan-700/50 text-[11px] font-bold transition-all flex items-center gap-1.5">
            <i class="fa-solid fa-calendar-days text-cyan-400"></i> Oct 2024 Issues
          </button>
          <button type="button" onclick="sendQuickQuestion('How many total issues in 2024?')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-indigo-950/60 text-indigo-300 hover:text-white rounded-xl border border-indigo-700/50 text-[11px] font-bold transition-all flex items-center gap-1.5">
            <i class="fa-solid fa-calendar text-indigo-400"></i> Year 2024 Issues
          </button>
          <button type="button" onclick="sendQuickQuestion('What is the overall resolution rate?')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-emerald-950/60 text-emerald-300 hover:text-white rounded-xl border border-emerald-700/50 text-[11px] font-bold transition-all">
            📈 Resolution Rate %
          </button>
        </div>
      </div>
    `;
  } else {
    if (greetingBubble) {
      greetingBubble.innerHTML = `👋 Hi! I'm your LabFix virtual assistant. Inquire about issue status, floor plans, or pick an option below:`;
    }
    chipsContainer.innerHTML = `
      <div class="space-y-1.5">
        <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Student Help:</span>
        <div class="flex flex-wrap gap-1.5">
          <button type="button" onclick="sendQuickQuestion('Are my issues resolved or not?')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-indigo-900/60 text-indigo-300 hover:text-white rounded-xl border border-indigo-700/50 text-[11px] font-bold transition-all flex items-center gap-1.5">
            <i class="fa-solid fa-clipboard-check text-indigo-400"></i> Check my issue status
          </button>
          <button type="button" onclick="sendQuickQuestion('How do I report an issue?')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 text-[11px] font-semibold transition-all">
            📝 How to report?
          </button>
        </div>
      </div>
    `;
  }
}

function sendQuickQuestion(questionText) {
  const input = document.getElementById('ai-input');
  if (input) {
    input.value = questionText;
    processAgentQuery(questionText);
  }
}

function handleAgentMessage(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('ai-input');
  const query = input.value.trim();
  if (!query) return;
  input.value = '';
  processAgentQuery(query);
}

// Master Processor for Role-Aware Queries
async function processAgentQuery(query) {
  const messagesContainer = document.getElementById('ai-chat-messages');
  if (!messagesContainer) return;

  messagesContainer.innerHTML += `
    <div class="flex justify-end animate-fade-in">
      <div class="bg-indigo-600 text-white p-2.5 rounded-2xl rounded-tr-xs max-w-[85%] text-xs shadow-xs font-medium">
        ${query}
      </div>
    </div>
  `;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  const loadingId = 'ai-loading-' + Date.now();
  messagesContainer.innerHTML += `
    <div id="${loadingId}" class="flex items-center gap-2 text-slate-400 text-xs italic">
      <i class="fa-solid fa-circle-notch fa-spin text-indigo-400"></i> Analyzing lab data...
    </div>
  `;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  await new Promise(r => setTimeout(r, 350));
  document.getElementById(loadingId)?.remove();

  const normalized = query.toLowerCase();

  // =========================================================
  // 1. MANAGEMENT CHATBOT (PARSES ANY MONTH & YEAR: e.g. "2024 issues in oct")
  // =========================================================
  if (currentUser && currentUser.role === 'management') {
    // Extract year (e.g. 2024, 2025, 2026)
    const yearMatch = query.match(/\b(202\d)\b/);
    const parsedYear = yearMatch ? yearMatch[1] : (normalized.includes('year') ? new Date().getFullYear().toString() : null);

    // Extract month (jan to dec, october, oct, etc.)
    const monthsMap = {
      'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
      'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
      'aug': 8, 'august': 8, 'sep': 9, 'september': 9, 'oct': 10, 'october': 10,
      'nov': 11, 'november': 11, 'dec': 12, 'december': 12
    };

    let parsedMonthNum = null;
    let parsedMonthName = null;
    for (const [mName, mNum] of Object.entries(monthsMap)) {
      if (new RegExp(`\\b${mName}\\b`).test(normalized)) {
        parsedMonthNum = mNum;
        parsedMonthName = mName.charAt(0).toUpperCase() + mName.slice(1);
        break;
      }
    }

    // If query specifies year AND month (e.g., "2024 issues in oct")
    if (parsedYear && parsedMonthNum) {
      try {
        const res = await fetch(`${API_BASE}/management/overview?status=All&labName=All&year=${parsedYear}&month=${parsedMonthNum}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        const count = data.issues ? data.issues.length : 0;

        appendBotReply(`📅 <strong>Management Record for ${parsedMonthName} ${parsedYear}:</strong><br/><br/>
          • <strong>${count} total issue${count === 1 ? '' : 's'}</strong> were recorded in ${parsedMonthName} ${parsedYear}.<br/>
          • Successfully Resolved: <strong class="text-emerald-400">${data.metrics.completedCount}</strong><br/>
          • Unresolved / In Progress: <strong class="text-amber-400">${data.metrics.pendingCount + data.metrics.processingCount}</strong>`);
        return;
      } catch (e) {
        appendBotReply(`Unable to retrieve data for ${parsedMonthName} ${parsedYear}.`);
        return;
      }
    }

    // If query specifies only year (e.g., "how many issues in 2024")
    if (parsedYear && !parsedMonthNum) {
      try {
        const res = await fetch(`${API_BASE}/management/overview?status=All&labName=All&year=${parsedYear}&month=All`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        const total = data.metrics.totalRaised;
        const resolved = data.metrics.completedCount;

        appendBotReply(`📆 <strong>Annual Report for Year ${parsedYear}:</strong><br/><br/>
          • <strong>Total Issues Recorded:</strong> <span class="text-indigo-300 font-extrabold text-sm">${total}</span><br/>
          • <strong>Resolved:</strong> <span class="text-emerald-400 font-bold">${resolved}</span><br/>
          • <strong>Annual Resolution Rate:</strong> <span class="text-indigo-400 font-extrabold text-sm">${data.metrics.resolutionRate}%</span>`);
        return;
      } catch (e) {
        appendBotReply(`Unable to retrieve annual data for ${parsedYear}.`);
        return;
      }
    }

    // If query is for current month
    if (normalized.includes('this month') || (normalized.includes('month') && !parsedYear)) {
      const curMonth = new Date().getMonth() + 1;
      const curYear = new Date().getFullYear();
      try {
        const res = await fetch(`${API_BASE}/management/overview?status=All&labName=All&year=${curYear}&month=${curMonth}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        appendBotReply(`📅 <strong>Current Month Issues:</strong> • <strong>${data.issues.length} total issues</strong> reported this month across all MG Labs.`);
        return;
      } catch (e) {}
    }

    if (normalized.includes('rate') || normalized.includes('resolution')) {
      try {
        const res = await fetch(`${API_BASE}/management/overview?status=All&labName=All&year=All&month=All`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        appendBotReply(`📈 <strong>System Overall Performance:</strong><br/><br/>
          • Total Historic Issues: <strong>${data.metrics.totalRaised}</strong><br/>
          • Completed: <strong class="text-emerald-400">${data.metrics.completedCount}</strong><br/>
          • Overall Resolution Rate: <strong class="text-indigo-400">${data.metrics.resolutionRate}%</strong>`);
        return;
      } catch (e) {}
    }
  }

  // =========================================================
  // 2. TECHNICIAN CHATBOT LOGIC (Pending unaccepted issues by Lab)
  // =========================================================
  if (currentUser && currentUser.role === 'technician') {
    if (
      normalized.includes('pending') ||
      normalized.includes('unaccepted') ||
      normalized.includes('not accepted') ||
      normalized.includes('how many') ||
      normalized.includes('lab name') ||
      normalized.includes('urgent')
    ) {
      try {
        const res = await fetch(`${API_BASE}/issues/technician-feed?priority=All&status=Pending`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const pendingIssues = await res.json();

        if (!pendingIssues || pendingIssues.length === 0) {
          appendBotReply(`✅ <strong>Great news!</strong> There are currently <strong>0 unaccepted pending issues</strong> across all MG Labs.`);
          return;
        }

        const labCounts = {};
        let highCount = 0;
        pendingIssues.forEach(iss => {
          const lab = iss.labName || 'MG Lab';
          labCounts[lab] = (labCounts[lab] || 0) + 1;
          if (iss.priority === 'High') highCount++;
        });

        let labListHtml = Object.keys(labCounts).map(lab => `• <strong>${lab}</strong>: <span class="text-rose-400 font-bold">${labCounts[lab]} pending</span>`).join('<br/>');

        appendBotReply(`🔔 <strong>Technician Work Queue:</strong> There are <strong>${pendingIssues.length} unaccepted pending issues</strong>:<br/><br/>
          ${labListHtml}<br/><br/>
          Click <strong>Accept</strong> on your Active Work Queue to turn them <strong>YELLOW (In Repair)</strong>!`);
        return;
      } catch (err) {
        appendBotReply(`Unable to fetch technician feed.`);
        return;
      }
    }
  }

  // =========================================================
  // 3. STUDENT CHATBOT LOGIC
  // =========================================================
  if (normalized.includes('resolve') || normalized.includes('status') || normalized.includes('my issue')) {
    if (!currentUser || currentUser.role !== 'student') {
      appendBotReply(`👋 Please **Sign In as a Student** to check your tickets, or view the **"Lab Floor Plan"** tab.`);
      return;
    }

    let issues = cachedStudentIssues;
    if (!issues || issues.length === 0) {
      appendBotReply(`🔍 You currently have **0 reported issues**. All workstations on your floor map are **Green (Operational)**!`);
      return;
    }

    let statusList = issues.map((iss, idx) => {
      const isDone = iss.status === 'Completed';
      const isInRepair = (iss.status === 'Accepted' || iss.status === 'Processing');
      const icon = isDone ? '🟢' : isInRepair ? '🟡' : '🔴';
      return `<div class="p-2.5 bg-slate-900 border border-slate-700 rounded-xl space-y-1">
        <div class="flex justify-between items-center">
          <strong class="text-white">${idx + 1}. ${iss.labName} (${iss.systemNumber})</strong>
          <span class="badge ${isDone ? 'badge-completed' : isInRepair ? 'badge-processing' : 'badge-pending'}">${icon} ${isDone ? 'Green (Fixed)' : isInRepair ? 'Yellow (In Repair)' : 'Red (Pending)'}</span>
        </div>
        <div class="text-[11px] text-slate-300">
          Component: <strong class="text-slate-100">${iss.componentType}</strong>
        </div>
      </div>`;
    }).join('');

    appendBotReply(`Here is your ticket status:<div class="space-y-2 my-2">${statusList}</div>`);
    return;
  }

  appendBotReply(`I am your <strong>LabFix Virtual Assistant</strong>.<br/><br/>
    • 🟢 <strong>Green</strong> = Working / Completed.<br/>
    • 🔴 <strong>Red</strong> = Issue Reported (Pending).<br/>
    • 🟡 <strong>Yellow</strong> = In Repair by Technician.`);
}

function appendBotReply(htmlContent) {
  const container = document.getElementById('ai-chat-messages');
  if (!container) return;
  container.innerHTML += `
    <div class="bg-slate-900 p-3.5 rounded-2xl rounded-tl-xs border border-slate-700/80 text-slate-200 space-y-2 shadow-xs animate-fade-in leading-relaxed font-medium">
      ${htmlContent}
    </div>
  `;
  container.scrollTop = container.scrollHeight;
}