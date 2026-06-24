/* ── DevLaunch renderer ──────────────────────────────────────────────────────
   Author: Crispin Joe Kenslin A
   ─────────────────────────────────────────────────────────────────────────── */
'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let projects = [];
let activeProjectId = null;
let editingProjectId = null;
let activeLogTab = 'frontend';
const processStatus = {};
const logBuffers = {};

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ansiToHtml(text) {
  text = escapeHtml(text);
  text = text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
  text = text.replace(/(error|Error|ERROR|failed|FAILED|exception|Exception)/g, '<span class="log-error">$1</span>');
  text = text.replace(/(warning|Warning|WARN|warn)/g,                         '<span class="log-warn">$1</span>');
  text = text.replace(/(success|SUCCESS|ready|READY|started|listening|running)/gi,'<span class="log-success">$1</span>');
  text = text.replace(/(\[DevLaunch\][^\n]*)/g,                               '<span class="log-meta">$1</span>');
  return text;
}

function getStatus(id) { return processStatus[id] || { frontend:'stopped', backend:'stopped' }; }

function overallStatus(id) {
  const s = getStatus(id);
  const p = projects.find(x => x.id === id);
  if (!p) return 'stopped';
  const hasFe = !!(p.frontend?.command), hasBe = !!(p.backend?.command);
  if ((hasFe && s.frontend === 'error') || (hasBe && s.backend === 'error')) return 'error';
  if ((!hasFe || s.frontend === 'running') && (!hasBe || s.backend === 'running')) return 'running';
  if ((hasFe && s.frontend === 'running') || (hasBe && s.backend === 'running')) return 'partial';
  return 'stopped';
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Theme ─────────────────────────────────────────────────────────────────────
const THEME_KEY = 'devlaunch-theme';
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
// Apply saved theme on load
applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

// ── Sidebar ───────────────────────────────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('project-list');
  list.innerHTML = '';
  if (!projects.length) {
    list.innerHTML = `<div style="padding:20px 10px;text-align:center;color:var(--text-dim);font-size:12px;line-height:1.7">
      No projects yet.<br/>Click <strong style="color:var(--text-muted)">+</strong> to add one.</div>`;
    return;
  }
  for (const p of projects) {
    const st = overallStatus(p.id);
    const el = document.createElement('div');
    el.className = 'project-item' + (p.id === activeProjectId ? ' active' : '');
    el.dataset.id = p.id;
    el.innerHTML = `
      <div class="project-item-dot ${st}"></div>
      <div class="project-item-info">
        <div class="project-item-name">${escapeHtml(p.name)}</div>
        <div class="project-item-type">${escapeHtml(p.type || 'frontend')}</div>
      </div>`;
    el.addEventListener('click', () => selectProject(p.id));
    list.appendChild(el);
  }
}

// ── Project panel ─────────────────────────────────────────────────────────────
function selectProject(id) {
  activeProjectId = id;
  renderSidebar();
  renderProjectPanel();
}

function renderProjectPanel() {
  const p = projects.find(x => x.id === activeProjectId);
  document.getElementById('empty-state').classList.toggle('hidden', !!p);
  document.getElementById('project-panel').classList.toggle('hidden', !p);
  if (!p) return;

  document.getElementById('panel-project-name').textContent = p.name;
  document.getElementById('panel-project-desc').textContent = p.description || '';
  document.getElementById('panel-project-type').textContent = p.type || 'frontend';
  document.getElementById('panel-status-dot').className = 'project-dot ' + overallStatus(p.id);

  renderServicesRow(p);
  renderLogTabs(p);
  renderLogOutput(p.id);
}

function renderServicesRow(p) {
  const row = document.getElementById('services-row');
  row.innerHTML = '';
  const st = getStatus(p.id);
  if (p.frontend?.command) row.appendChild(buildServiceCard(p, 'frontend', st.frontend));
  if (p.backend?.command)  row.appendChild(buildServiceCard(p, 'backend',  st.backend));

  // Master control card
  const master = document.createElement('div');
  master.className = 'service-card';
  master.style.cssText = 'max-width:200px;display:flex;flex-direction:column;justify-content:center;gap:8px;';
  master.innerHTML = `
    <div class="service-card-header"><span class="service-label">All Services</span></div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <button class="btn btn-run" id="btn-run-all">
        <svg width="11" height="11" viewBox="0 0 11 11"><polygon points="2,1 10,5.5 2,10" fill="currentColor"/></svg>
        Run All
      </button>
      <button class="btn btn-stop btn-sm" id="btn-stop-all">
        <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1" fill="currentColor"/></svg>
        Stop All
      </button>
      <button class="btn btn-restart btn-sm" id="btn-restart-all">
        <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 5.5A3.5 3.5 0 0 1 9 3.5M9 1v3H6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/></svg>
        Restart
      </button>
    </div>`;
  master.querySelector('#btn-run-all').addEventListener('click',     () => runProject(p));
  master.querySelector('#btn-stop-all').addEventListener('click',    () => stopProject(p.id));
  master.querySelector('#btn-restart-all').addEventListener('click', () => restartProject(p));
  row.appendChild(master);
}

function buildServiceCard(p, service, status) {
  const cfg = p[service];
  const card = document.createElement('div');
  card.className = 'service-card';
  const pythonLabel = cfg.pythonPath
    ? `<div title="${escapeHtml(cfg.pythonPath)}" class="service-cmd" style="font-size:10.5px;margin-bottom:6px">🐍 ${escapeHtml(cfg.pythonPath.split(/[\\/]/).pop())}</div>`
    : '';
  card.innerHTML = `
    <div class="service-card-header">
      <span class="service-label">${service}</span>
      <span class="service-status-pill ${status}" id="svc-pill-${p.id}-${service}">${status}</span>
    </div>
    ${pythonLabel}
    <div class="service-cmd" title="${escapeHtml(cfg.command)}">${escapeHtml(cfg.command)}</div>
    <div class="service-btns">
      <button class="btn btn-run btn-sm" id="svc-run-${p.id}-${service}">
        <svg width="9" height="9" viewBox="0 0 9 9"><polygon points="1,0.5 8.5,4.5 1,8.5" fill="currentColor"/></svg> Run
      </button>
      <button class="btn btn-stop btn-sm" id="svc-stop-${p.id}-${service}">
        <svg width="9" height="9" viewBox="0 0 9 9"><rect x=".5" y=".5" width="8" height="8" rx="1" fill="currentColor"/></svg> Stop
      </button>
    </div>`;
  card.querySelector(`#svc-run-${p.id}-${service}`).addEventListener('click',  () => runSingleService(p, service));
  card.querySelector(`#svc-stop-${p.id}-${service}`).addEventListener('click', () => stopSingleService(p.id, service));
  return card;
}

// ── Log ───────────────────────────────────────────────────────────────────────
function renderLogTabs(p) {
  const tabs = document.getElementById('log-tabs');
  tabs.innerHTML = '';
  const hasFe = !!(p.frontend?.command), hasBe = !!(p.backend?.command);
  if (hasFe && hasBe) {
    if (!['combined','frontend','backend'].includes(activeLogTab)) activeLogTab = 'combined';
    addTab(tabs, 'combined', 'All');
    addTab(tabs, 'frontend', 'Frontend');
    addTab(tabs, 'backend',  'Backend');
  } else if (hasBe) { activeLogTab = 'backend';   addTab(tabs, 'backend', 'Backend'); }
  else               { activeLogTab = 'frontend';  addTab(tabs, 'frontend', 'Frontend'); }
}

function addTab(container, id, label) {
  const btn = document.createElement('button');
  btn.className = 'log-tab' + (activeLogTab === id ? ' active' : '');
  btn.textContent = label;
  btn.addEventListener('click', () => {
    activeLogTab = id;
    container.querySelectorAll('.log-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderLogOutput(activeProjectId);
  });
  container.appendChild(btn);
}

function renderLogOutput(id) {
  const out = document.getElementById('log-output');
  if (!id) { out.innerHTML = ''; return; }
  const buf = logBuffers[id] || { frontend:'', backend:'' };
  const content = activeLogTab === 'combined' ? buf.frontend + buf.backend : (buf[activeLogTab] || '');
  if (!content) {
    out.innerHTML = '<span style="color:var(--text-dim)">No output yet. Run the project to see logs here.</span>';
    return;
  }
  out.innerHTML = ansiToHtml(content);
  out.scrollTop = out.scrollHeight;
}

function appendLog(id, service, text) {
  if (!logBuffers[id]) logBuffers[id] = { frontend:'', backend:'' };
  logBuffers[id][service] += text;
  const MAX = 200_000;
  if (logBuffers[id][service].length > MAX) logBuffers[id][service] = logBuffers[id][service].slice(-MAX);
  if (id === activeProjectId && (activeLogTab === 'combined' || activeLogTab === service)) {
    renderLogOutput(id);
  }
}

// ── Process control ───────────────────────────────────────────────────────────
async function runProject(p) {
  if (!processStatus[p.id]) processStatus[p.id] = { frontend:'stopped', backend:'stopped' };
  setServiceStatus(p.id, 'frontend', 'starting');
  setServiceStatus(p.id, 'backend',  'starting');
  logBuffers[p.id] = { frontend:'', backend:'' };
  if (activeProjectId === p.id) renderLogOutput(p.id);
  await window.api.startProject(p);
}

async function stopProject(id) { await window.api.stopProject(id); }

async function restartProject(p) {
  await stopProject(p.id);
  await delay(600);
  await runProject(p);
}

async function runSingleService(p, service) {
  if (!processStatus[p.id]) processStatus[p.id] = { frontend:'stopped', backend:'stopped' };
  setServiceStatus(p.id, service, 'starting');
  if (!logBuffers[p.id]) logBuffers[p.id] = { frontend:'', backend:'' };
  logBuffers[p.id][service] = '';
  const clone = { ...p };
  if (service === 'frontend') clone.backend  = null;
  if (service === 'backend')  clone.frontend = null;
  await window.api.startProject(clone);
}

async function stopSingleService(id, service) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  const otherService = service === 'frontend' ? 'backend' : 'frontend';
  const otherRunning = getStatus(id)[otherService] === 'running';
  await window.api.stopProject(id);
  setServiceStatus(id, service, 'stopped');
  if (otherRunning && p[otherService]?.command) { await delay(400); await runSingleService(p, otherService); }
}

function setServiceStatus(id, service, status) {
  if (!processStatus[id]) processStatus[id] = { frontend:'stopped', backend:'stopped' };
  processStatus[id][service] = status;
  updateStatusUI(id, service, status);
}

function updateStatusUI(id, service, status) {
  const dot = document.querySelector(`.project-item[data-id="${id}"] .project-item-dot`);
  if (dot) dot.className = 'project-item-dot ' + overallStatus(id);
  if (id !== activeProjectId) return;
  const panelDot = document.getElementById('panel-status-dot');
  if (panelDot) panelDot.className = 'project-dot ' + overallStatus(id);
  const pill = document.getElementById(`svc-pill-${id}-${service}`);
  if (pill) { pill.className = `service-status-pill ${status}`; pill.textContent = status; }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(id = null) {
  editingProjectId = id;
  document.getElementById('modal-title').textContent = id ? 'Edit Project' : 'New Project';
  document.getElementById('modal-backdrop').classList.remove('hidden');

  const p = id ? projects.find(x => x.id === id) : null;
  document.getElementById('f-name').value       = p?.name        || '';
  document.getElementById('f-desc').value       = p?.description || '';
  document.getElementById('f-type').value       = p?.type        || 'fullstack';
  document.getElementById('f-fe-cwd').value     = p?.frontend?.cwd        || '';
  document.getElementById('f-fe-python').value  = p?.frontend?.pythonPath || '';
  document.getElementById('f-fe-cmd').value     = p?.frontend?.command    || '';
  document.getElementById('f-be-cwd').value     = p?.backend?.cwd         || '';
  document.getElementById('f-be-python').value  = p?.backend?.pythonPath  || '';
  document.getElementById('f-be-cmd').value     = p?.backend?.command     || '';

  updateFormSections();
  document.getElementById('f-name').focus();
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
  editingProjectId = null;
}

function updateFormSections() {
  const type = document.getElementById('f-type').value;
  document.getElementById('fs-frontend').classList.toggle('hidden', type === 'backend');
  document.getElementById('fs-backend').classList.toggle('hidden',  type === 'frontend');
}

async function saveModal() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { document.getElementById('f-name').focus(); return; }
  const type = document.getElementById('f-type').value;

  const project = {
    id: editingProjectId || uid(),
    name,
    description: document.getElementById('f-desc').value.trim(),
    type,
    frontend: type !== 'backend' ? {
      cwd:        document.getElementById('f-fe-cwd').value.trim(),
      pythonPath: document.getElementById('f-fe-python').value.trim(),
      command:    document.getElementById('f-fe-cmd').value.trim(),
    } : null,
    backend: type !== 'frontend' ? {
      cwd:        document.getElementById('f-be-cwd').value.trim(),
      pythonPath: document.getElementById('f-be-python').value.trim(),
      command:    document.getElementById('f-be-cmd').value.trim(),
    } : null,
  };

  projects = await window.api.saveProject(project);
  closeModal();
  renderSidebar();
  if (activeProjectId === project.id) renderProjectPanel();
  else selectProject(project.id);
}

// ── Delete confirm ────────────────────────────────────────────────────────────
function openConfirmDelete(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  document.getElementById('confirm-project-name').textContent = p.name;
  document.getElementById('confirm-backdrop').classList.remove('hidden');
  document.getElementById('confirm-backdrop').dataset.projectId = id;
}

async function confirmDelete() {
  const id = document.getElementById('confirm-backdrop').dataset.projectId;
  projects = await window.api.deleteProject(id);
  document.getElementById('confirm-backdrop').classList.add('hidden');
  if (activeProjectId === id) activeProjectId = projects.length ? projects[0].id : null;
  renderSidebar();
  renderProjectPanel();
}

// ── IPC listeners ─────────────────────────────────────────────────────────────
window.api.onProcessLog(({ projectId, service, text }) => appendLog(projectId, service, text));
window.api.onProcessStatus(({ projectId, service, status }) => {
  setServiceStatus(projectId, service, status);
  const p = projects.find(x => x.id === projectId);
  if (p && projectId === activeProjectId) renderServicesRow(p);
});

// ── Event wiring ──────────────────────────────────────────────────────────────
document.getElementById('tb-theme').addEventListener('click', toggleTheme);
document.getElementById('btn-new-project').addEventListener('click', () => openModal());
document.getElementById('btn-new-project-empty').addEventListener('click', () => openModal());
document.getElementById('btn-edit-project').addEventListener('click', () => { if (activeProjectId) openModal(activeProjectId); });
document.getElementById('btn-delete-project').addEventListener('click', () => { if (activeProjectId) openConfirmDelete(activeProjectId); });

document.getElementById('btn-clear-log').addEventListener('click', () => {
  if (!activeProjectId) return;
  if (!logBuffers[activeProjectId]) logBuffers[activeProjectId] = { frontend:'', backend:'' };
  if (activeLogTab === 'combined') { logBuffers[activeProjectId].frontend = ''; logBuffers[activeProjectId].backend = ''; }
  else logBuffers[activeProjectId][activeLogTab] = '';
  renderLogOutput(activeProjectId);
});

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
document.getElementById('btn-modal-save').addEventListener('click', saveModal);
document.getElementById('modal-backdrop').addEventListener('click', e => { if (e.target === document.getElementById('modal-backdrop')) closeModal(); });
document.getElementById('f-type').addEventListener('change', updateFormSections);

// Browse buttons (folder and python.exe)
document.querySelectorAll('.browse-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const type   = btn.dataset.type;
    const target = btn.dataset.target;
    let result;
    if (type === 'python') {
      result = await window.api.browseFile([
        { name: 'Python Executable', extensions: ['exe', '*'] },
        { name: 'All Files', extensions: ['*'] },
      ]);
    } else {
      result = await window.api.browseFolder();
    }
    if (result) document.getElementById(target).value = result;
  });
});

document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
  document.getElementById('confirm-backdrop').classList.add('hidden');
});
document.getElementById('btn-confirm-delete').addEventListener('click', confirmDelete);
document.getElementById('confirm-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('confirm-backdrop')) document.getElementById('confirm-backdrop').classList.add('hidden');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    document.getElementById('confirm-backdrop').classList.add('hidden');
  }
});

document.getElementById('tb-min').addEventListener('click',   () => window.api.minimize());
document.getElementById('tb-max').addEventListener('click',   () => window.api.maximize());
document.getElementById('tb-close').addEventListener('click', () => window.api.close());

// ── Init ──────────────────────────────────────────────────────────────────────
(async function init() {
  projects = await window.api.getProjects();
  for (const p of projects) {
    const st = await window.api.getProcessStatus(p.id);
    processStatus[p.id] = st;
  }
  renderSidebar();
  if (projects.length) selectProject(projects[0].id);
})();
