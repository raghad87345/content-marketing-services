// ===== UTILS =====
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function showToast(msg, type = 'success') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  t.classList.remove('hidden');
  setTimeout(() => { t.classList.add('hidden'); }, 3500);
}

function badge(value, prefix = '') {
  return `<span class="badge badge-${prefix}${value}">${value.replace('_', ' ')}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ===== AUTH =====
async function tryAutoLogin() {
  if (!api.token) return showAuth();
  try {
    const { user } = await api.me();
    showDashboard(user);
  } catch {
    api.setToken(null);
    showAuth();
  }
}

function showAuth() {
  document.body.className = 'auth-page';
  $('#auth-screen').classList.remove('hidden');
  $('#dashboard').classList.add('hidden');
}

function showDashboard(user) {
  document.body.className = '';
  $('#auth-screen').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
  $('#user-name').textContent = user.name;
  $('#user-role').textContent = user.role;
  $('#user-avatar').textContent = user.name[0].toUpperCase();
  $('#today-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  loadPage('overview');
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = $('#login-error');
  errorEl.classList.add('hidden');
  try {
    const { token, user } = await api.login($('#login-email').value, $('#login-password').value);
    api.setToken(token);
    showDashboard(user);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

$('#register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = $('#register-error');
  errorEl.classList.add('hidden');
  try {
    const { token, user } = await api.register($('#reg-name').value, $('#reg-email').value, $('#reg-password').value);
    api.setToken(token);
    showDashboard(user);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

$('#go-register').addEventListener('click', (e) => {
  e.preventDefault();
  $('#login-form').classList.add('hidden');
  $('#register-form').classList.remove('hidden');
});

$('#go-login').addEventListener('click', (e) => {
  e.preventDefault();
  $('#register-form').classList.add('hidden');
  $('#login-form').classList.remove('hidden');
});

$('#logout-btn').addEventListener('click', () => {
  api.setToken(null);
  showAuth();
});

// ===== NAVIGATION =====
$$('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    $$('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    loadPage(page);
  });
});

function loadPage(page) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $(`#page-${page}`).classList.add('active');
  if (page === 'overview') loadOverview();
  if (page === 'content') loadContent();
  if (page === 'campaigns') loadCampaigns();
  if (page === 'analytics') loadAnalytics();
}

// ===== OVERVIEW =====
async function loadOverview() {
  try {
    const [overviewData, topData] = await Promise.all([api.getOverview(), api.getTopContent()]);
    const { overview, contentByType, contentByStatus } = overviewData;

    $('#stat-total-content').textContent = overview.totalContent;
    $('#stat-published').textContent = overview.publishedContent;
    $('#stat-campaigns').textContent = overview.totalCampaigns;
    $('#stat-active-campaigns').textContent = overview.activeCampaigns;

    renderBarList('#content-by-type', contentByType);

    const topEl = $('#top-content-list');
    if (!topData.topContent.length) { topEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No published content yet.</p>'; return; }
    topEl.innerHTML = topData.topContent.map((c, i) => `
      <div class="top-item">
        <div class="top-rank">${i + 1}</div>
        <div class="top-info">
          <div class="top-title">${c.title}</div>
          <div class="top-meta">${c.type.replace('_', ' ')} &bull; ${fmtDate(c.publishedAt)}</div>
        </div>
        <div class="top-views"><i class="fa-solid fa-eye" style="margin-right:4px;font-size:11px"></i>${c.views}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

function renderBarList(selector, items) {
  const el = $(selector);
  if (!items.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No data.</p>'; return; }
  const max = Math.max(...items.map(i => i.count), 1);
  el.innerHTML = items.map(i => `
    <div class="bar-item">
      <div class="bar-label"><span>${i._id.replace('_', ' ')}</span><span>${i.count}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(i.count/max)*100}%"></div></div>
    </div>
  `).join('');
}

// ===== CONTENT =====
async function loadContent(params = {}) {
  const tbody = $('#content-table-body');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Loading...</td></tr>';
  try {
    const { contents } = await api.getContents(params);
    if (!contents.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No content found.</td></tr>';
      return;
    }
    tbody.innerHTML = contents.map(c => `
      <tr>
        <td><strong>${escHtml(c.title)}</strong></td>
        <td>${badge(c.type)}</td>
        <td>${badge(c.status, '')}</td>
        <td>${c.author ? escHtml(c.author.name) : '—'}</td>
        <td>${fmtDate(c.createdAt)}</td>
        <td>
          <div class="action-btns">
            <button class="btn btn-secondary btn-sm" onclick="editContent('${c._id}', ${JSON.stringify(c).replace(/"/g, '&quot;')})">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteContent('${c._id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-row">${err.message}</td></tr>`;
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

$('#apply-content-filter').addEventListener('click', () => {
  const params = {};
  const type = $('#content-filter-type').value;
  const status = $('#content-filter-status').value;
  if (type) params.type = type;
  if (status) params.status = status;
  loadContent(params);
});

$('#new-content-btn').addEventListener('click', () => {
  $('#content-modal-title').textContent = 'New Content';
  $('#content-form').reset();
  $('#content-id').value = '';
  openModal('content-modal');
});

function editContent(id, data) {
  $('#content-modal-title').textContent = 'Edit Content';
  $('#content-id').value = id;
  $('#content-title').value = data.title;
  $('#content-type').value = data.type;
  $('#content-status').value = data.status;
  $('#content-body').value = data.body;
  $('#content-tags').value = (data.tags || []).join(', ');
  openModal('content-modal');
}

async function deleteContent(id) {
  if (!confirm('Delete this content?')) return;
  try {
    await api.deleteContent(id);
    showToast('Content deleted');
    loadContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

$('#content-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#content-id').value;
  const payload = {
    title: $('#content-title').value,
    type: $('#content-type').value,
    status: $('#content-status').value,
    body: $('#content-body').value,
    tags: $('#content-tags').value.split(',').map(t => t.trim()).filter(Boolean),
  };
  try {
    if (id) await api.updateContent(id, payload);
    else await api.createContent(payload);
    closeModal('content-modal');
    showToast(id ? 'Content updated' : 'Content created');
    loadContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ===== CAMPAIGNS =====
async function loadCampaigns() {
  const grid = $('#campaigns-grid');
  grid.innerHTML = '<div class="loading-row">Loading...</div>';
  try {
    const { campaigns } = await api.getCampaigns();
    if (!campaigns.length) {
      grid.innerHTML = '<div class="loading-row">No campaigns yet.</div>';
      return;
    }
    grid.innerHTML = campaigns.map(c => `
      <div class="campaign-card">
        <div class="campaign-card-header">
          <h4>${escHtml(c.name)}</h4>
          ${badge(c.status, '')}
        </div>
        <div class="campaign-desc">${escHtml(c.description || 'No description.')}</div>
        <div class="campaign-meta">
          <span><i class="fa-solid fa-calendar-days"></i> ${fmtDate(c.startDate)} — ${fmtDate(c.endDate)}</span>
          <span><i class="fa-solid fa-dollar-sign"></i> Budget: $${(c.budget?.total || 0).toLocaleString()}</span>
          ${c.owner ? `<span><i class="fa-solid fa-user"></i> ${escHtml(c.owner.name)}</span>` : ''}
        </div>
        <div class="campaign-actions">
          <button class="btn btn-secondary btn-sm" onclick="editCampaign('${c._id}', ${JSON.stringify(c).replace(/"/g, '&quot;')})">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteCampaign('${c._id}')">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="loading-row">${err.message}</div>`;
  }
}

$('#new-campaign-btn').addEventListener('click', () => {
  $('#campaign-modal-title').textContent = 'New Campaign';
  $('#campaign-form').reset();
  $('#campaign-id').value = '';
  openModal('campaign-modal');
});

function editCampaign(id, data) {
  $('#campaign-modal-title').textContent = 'Edit Campaign';
  $('#campaign-id').value = id;
  $('#campaign-name').value = data.name;
  $('#campaign-description').value = data.description || '';
  $('#campaign-start').value = data.startDate ? data.startDate.slice(0, 10) : '';
  $('#campaign-end').value = data.endDate ? data.endDate.slice(0, 10) : '';
  $('#campaign-budget').value = data.budget?.total || 0;
  $('#campaign-status').value = data.status;
  openModal('campaign-modal');
}

async function deleteCampaign(id) {
  if (!confirm('Delete this campaign?')) return;
  try {
    await api.deleteCampaign(id);
    showToast('Campaign deleted');
    loadCampaigns();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

$('#campaign-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#campaign-id').value;
  const payload = {
    name: $('#campaign-name').value,
    description: $('#campaign-description').value,
    startDate: $('#campaign-start').value,
    endDate: $('#campaign-end').value,
    budget: { total: Number($('#campaign-budget').value) || 0 },
    status: $('#campaign-status').value,
  };
  try {
    if (id) await api.updateCampaign(id, payload);
    else await api.createCampaign(payload);
    closeModal('campaign-modal');
    showToast(id ? 'Campaign updated' : 'Campaign created');
    loadCampaigns();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ===== ANALYTICS =====
async function loadAnalytics() {
  try {
    const [overviewData, topData] = await Promise.all([api.getOverview(), api.getTopContent()]);
    const { contentByType, contentByStatus } = overviewData;

    renderBarList('#analytics-by-status', contentByStatus);
    renderBarList('#analytics-by-type', contentByType);

    const tbody = $('#analytics-top-table');
    if (!topData.topContent.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No data.</td></tr>';
      return;
    }
    tbody.innerHTML = topData.topContent.map(c => `
      <tr>
        <td><strong>${escHtml(c.title)}</strong></td>
        <td>${badge(c.type)}</td>
        <td>${c.views}</td>
        <td>${c.likes}</td>
        <td>${fmtDate(c.publishedAt)}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

// ===== MODALS =====
function openModal(id) { $(`#${id}`).classList.remove('hidden'); }
function closeModal(id) { $(`#${id}`).classList.add('hidden'); }

$$('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.modal));
});
$$('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', () => {
    overlay.closest('.modal').classList.add('hidden');
  });
});

// ===== INIT =====
tryAutoLogin();
