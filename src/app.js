const env = window.__ENV__ || {};
const API_BASE = 'apiBase' in env ? env.apiBase : (window.location.protocol === 'file:' ? 'http://localhost:3010' : '');

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
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function formatComponent(name) {
  return String(name || '')
    .split('_')
    .map((w) => w[0] ? w[0].toUpperCase() + w.slice(1) : '')
    .join(' ');
}

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (['completed', 'success', 'queued'].includes(s)) return 'completed';
  if (['failed', 'error', 'dropped'].includes(s)) return 'failed';
  if (['running', 'active', 'throttled'].includes(s)) return 'running';
  return '';
}

function sumComponents(breakdown) {
  return Object.values(breakdown || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

function parseTimeWindow(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([smhd])$/i);
  if (m) {
    const n = parseFloat(m[1]);
    const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()];
    return Math.round(n * mult);
  }
  const n = Number(s);
  return Number.isNaN(n) ? '' : Math.round(n);
}

async function api(path, params = {}) {
  const q = new URLSearchParams(params);
  const res = await fetch(`${API_BASE}${path}?${q}`, { mode: 'cors' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadList() {
  const params = {
    org_id: 'default',
    date_from: $('#list-from').value || '',
    date_to: $('#list-to').value || ''
  };
  try {
    const data = await api('/api/deployments', params);
    renderList(data);
  } catch (err) {
    $('#list-summary').innerHTML = `<div class="card"><div class="value">Error</div><div class="label">${err.message}</div></div>`;
  }
}

function renderList(data) {
  const deployments = data.deployments || [];
  const container = $('#deployments-container');
  container.innerHTML = '';

  const totalFrames = deployments.reduce((s, d) => s + (d.frame_count || 0), 0);
  $('#list-summary').innerHTML = `
    <div class="card"><div class="value">${deployments.length}</div><div class="label">Running deployments</div></div>
    <div class="card"><div class="value">${totalFrames}</div><div class="label">Frames (last 10 each)</div></div>
  `;

  if (!deployments.length) {
    container.innerHTML = '<p class="card">No running deployments found.</p>';
    return;
  }

  deployments.forEach((dep) => {
    const section = document.createElement('div');
    section.className = 'deployment-block';

    const frames = dep.frames || [];
    const frameRows = frames.map((f, idx) => {
      const bd = f.component_breakdown || {};
      const items = Object.entries(bd)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<div class="detail-item"><span>${formatComponent(k)}</span><strong>${humanize(v)}</strong></div>`)
        .join('') || '<div class="detail-item">No component data</div>';
      return `
        <tr>
          <td>${f.frame_id}</td>
          <td>${f.device_id || '-'}</td>
          <td>${f.event_type || '-'}</td>
          <td><span class="status ${statusClass(f.decision)}">${f.decision || '-'}</span></td>
          <td>${formatDate(f.started_at)}</td>
          <td>${humanize(f.total_ms)}</td>
          <td><button class="toggle" data-id="${dep.id}-${idx}">Components</button></td>
        </tr>
        <tr class="detail-row" data-for="${dep.id}-${idx}">
          <td colspan="7"><div class="detail-grid">${items}</div></td>
        </tr>
      `;
    }).join('');

    section.innerHTML = `
      <div class="deployment-header">
        <h3>${dep.workflow_name || dep.id}</h3>
        <span class="status ${statusClass(dep.status)}">${dep.status}</span>
        <span class="meta">Devices: ${(dep.device_ids || []).join(', ') || '-'} · Deployed: ${formatDate(dep.deployed_at)} · Frames total: ${humanize(sumComponents(dep.component_totals))}</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Frame</th>
            <th>Device</th>
            <th>Event type</th>
            <th>Decision</th>
            <th>Received</th>
            <th>Total time</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${frameRows || '<tr><td colspan="7">No frames captured yet for this deployment.</td></tr>'}</tbody>
      </table>
    `;
    container.appendChild(section);
  });

  $$('.toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const row = document.querySelector(`.detail-row[data-for="${id}"]`);
      if (row) row.classList.toggle('open');
    });
  });
}

async function loadAnalytics() {
  const custom = $('#analytics-time').value.trim();
  const active = $('.time-btn.active');
  const tw = custom ? parseTimeWindow(custom) : (active ? active.dataset.ms : '');
  const params = { org_id: 'default', time_window: String(tw) };
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
  const s = data.executions_summary || {};
  $('#analytics-summary').innerHTML = `
    <div class="card"><div class="value">${s.total || 0}</div><div class="label">Frames</div></div>
    <div class="card"><div class="value">${s.completed || 0}</div><div class="label">Completed workflows</div></div>
    <div class="card"><div class="value">${s.running || 0}</div><div class="label">Running deployments</div></div>
    <div class="card"><div class="value">${humanize(s.avg_duration_ms)}</div><div class="label">Avg frame time</div></div>
    <div class="card"><div class="value">${humanize(s.total_duration_ms)}</div><div class="label">Total time</div></div>
  `;

  const totals = data.component_totals || [];
  const max = totals.reduce((m, c) => Math.max(m, Number(c.total_ms) || 0), 0) || 1;
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
        <div class="bar-track"><div class="bar-fill" style="width: ${((Number(c.total_ms) || 0) / max) * 100}%"></div></div>
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
  if (view === 'list') loadList();
  else loadAnalytics();
}

function init() {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  $('#list-to').value = today.toISOString().split('T')[0];
  $('#list-from').value = weekAgo.toISOString().split('T')[0];

  $$('.sub-tab').forEach((t) => t.addEventListener('click', () => setActiveTab(t.dataset.view)));
  $('#list-apply').addEventListener('click', loadList);
  $('#list-reset').addEventListener('click', () => {
    $('#list-from').value = '';
    $('#list-to').value = '';
    loadList();
  });
  $$('.time-btn').forEach((btn) => btn.addEventListener('click', (e) => {
    $$('.time-btn').forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
  }));
  $('#analytics-apply').addEventListener('click', loadAnalytics);

  loadList();
}

document.addEventListener('DOMContentLoaded', init);
