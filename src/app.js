const API_BASE = (window.__ENV__ && window.__ENV__.apiBase) || 'http://localhost:3010';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function humanize(ms) {
  if (ms == null || Number.isNaN(ms)) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60 * 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 60 * 60 * 1000) return `${(ms / (60 * 1000)).toFixed(2)}m`;
  return `${(ms / (60 * 60 * 1000)).toFixed(2)}h`;
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatComponent(name) {
  return String(name || '')
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed' || s === 'success') return 'completed';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'running') return 'running';
  return '';
}

function sumComponents(breakdown) {
  return Object.values(breakdown || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

async function api(path, params = {}) {
  const q = new URLSearchParams(params);
  const res = await fetch(`${API_BASE}${path}?${q}`, { mode: 'cors' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

let listState = { page: 1, page_size: 25 };

async function loadList(page = 1) {
  listState.page = page;
  const from = $('#list-from').value;
  const to = $('#list-to').value;
  const params = { page, page_size: listState.page_size, org_id: 'default' };
  if (from) params.date_from = from;
  if (to) params.date_to = to;
  try {
    const data = await api('/api/executions', params);
    renderList(data);
  } catch (err) {
    $('#list-summary').innerHTML = `<div class="card"><div class="value">Error</div><div class="label">${err.message}</div></div>`;
  }
}

function renderList(data) {
  const rows = data.executions || [];
  const tbody = $('#executions-table tbody');
  tbody.innerHTML = '';

  rows.forEach((row) => {
    const total = sumComponents(row.component_breakdown);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.human_id || row.id}</td>
      <td>${row.catalog_name || '-'}</td>
      <td><span class="status ${statusClass(row.status)}">${row.status}</span></td>
      <td>${formatDate(row.started_at)}</td>
      <td>${humanize(row.duration_ms)}</td>
      <td>${humanize(total)}</td>
      <td><button class="toggle" data-id="${row.id}">Components</button></td>
    `;
    tbody.appendChild(tr);

    const detail = document.createElement('tr');
    detail.className = 'detail-row';
    detail.dataset.for = row.id;
    const bd = row.component_breakdown || {};
    const items = Object.entries(bd)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<div class="detail-item"><span>${formatComponent(k)}</span><strong>${humanize(v)}</strong></div>`)
      .join('') || '<div class="detail-item">No component data</div>';
    detail.innerHTML = `<td colspan="7"><div class="detail-grid">${items}</div></td>`;
    tbody.appendChild(detail);
  });

  $$('.toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const row = document.querySelector(`.detail-row[data-for="${id}"]`);
      if (row) row.classList.toggle('open');
    });
  });

  const total = data.total_count || 0;
  const pages = Math.ceil(total / listState.page_size) || 1;
  const start = (data.page - 1) * data.page_size + 1;
  const end = Math.min(start + rows.length - 1, total);
  $('#list-summary').innerHTML = `
    <div class="card"><div class="value">${total}</div><div class="label">Total executions</div></div>
    <div class="card"><div class="value">${rows.length}</div><div class="label">This page</div></div>
    <div class="card"><div class="value">${data.page} / ${pages}</div><div class="label">Page</div></div>
  `;

  const pg = $('#list-pagination');
  pg.innerHTML = '';
  if (data.page > 1) {
    const prev = document.createElement('button');
    prev.className = 'btn';
    prev.textContent = 'Previous';
    prev.onclick = () => loadList(data.page - 1);
    pg.appendChild(prev);
  }
  const info = document.createElement('span');
  info.textContent = `${start}-${end} of ${total}`;
  pg.appendChild(info);
  if (data.page < pages) {
    const next = document.createElement('button');
    next.className = 'btn primary';
    next.textContent = 'Next';
    next.onclick = () => loadList(data.page + 1);
    pg.appendChild(next);
  }
}

async function loadAnalytics() {
  let tw = $('#analytics-time').value.trim();
  const active = $('.time-btn.active');
  if (!tw && active) tw = active.dataset.ms;
  const params = {};
  if (tw) params.time_window = tw;
  try {
    const data = await api('/api/analytics', params);
    renderAnalytics(data);
  } catch (err) {
    $('#analytics-summary').innerHTML = `<div class="card"><div class="value">Error</div><div class="label">${err.message}</div></div>`;
    $('#analytics-chart').innerHTML = '';
    $('#analytics-table tbody').innerHTML = '';
  }
}

function renderAnalytics(data) {
  const summary = data.executions_summary || {};
  $('#analytics-summary').innerHTML = `
    <div class="card"><div class="value">${summary.total || 0}</div><div class="label">Total executions</div></div>
    <div class="card"><div class="value">${summary.completed || 0}</div><div class="label">Completed</div></div>
    <div class="card"><div class="value">${summary.failed || 0}</div><div class="label">Failed</div></div>
    <div class="card"><div class="value">${summary.running || 0}</div><div class="label">Running</div></div>
    <div class="card"><div class="value">${humanize(summary.avg_duration_ms)}</div><div class="label">Avg duration</div></div>
    <div class="card"><div class="value">${humanize(summary.total_duration_ms)}</div><div class="label">Total duration</div></div>
  `;

  const totals = data.component_totals || [];
  const max = totals.reduce((m, c) => Math.max(m, c.total_ms), 0) || 1;
  const chart = $('#analytics-chart');
  chart.innerHTML = '';
  if (totals.length === 0) {
    chart.innerHTML = '<p class="card">No component data for the selected window.</p>';
  } else {
    totals.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'bar-row';
      row.innerHTML = `
        <div class="bar-label">${formatComponent(c.component)}</div>
        <div class="bar-track"><div class="bar-fill" style="width: ${(c.total_ms / max) * 100}%"></div></div>
        <div class="bar-value">${humanize(c.total_ms)}</div>
      `;
      chart.appendChild(row);
    });
  }

  const tbody = $('#analytics-table tbody');
  tbody.innerHTML = '';
  totals.forEach((c) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatComponent(c.component)}</td>
      <td>${humanize(c.total_ms)}</td>
      <td>${humanize(c.avg_ms)}</td>
      <td>${humanize(c.min_ms)}</td>
      <td>${humanize(c.max_ms)}</td>
      <td>${c.count}</td>
    `;
    tbody.appendChild(tr);
  });
}

function setActiveTab(view) {
  $$('.sub-tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `${view}-view`));
  if (view === 'list') loadList(1);
  else loadAnalytics();
}

function init() {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  $('#list-to').value = today.toISOString().split('T')[0];
  $('#list-from').value = weekAgo.toISOString().split('T')[0];

  $$('.sub-tab').forEach((t) => {
    t.addEventListener('click', () => setActiveTab(t.dataset.view));
  });

  $('#list-apply').addEventListener('click', () => loadList(1));
  $('#list-reset').addEventListener('click', () => {
    $('#list-from').value = '';
    $('#list-to').value = '';
    loadList(1);
  });

  $$('.time-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      $$('.time-btn').forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');
      $('#analytics-time').value = e.target.dataset.ms;
    });
  });

  $('#analytics-apply').addEventListener('click', loadAnalytics);
  $('#analytics-time').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadAnalytics(); });

  setActiveTab('list');
}

document.addEventListener('DOMContentLoaded', init);
