window.__ENV__ = window.__ENV__ || {};
if (!('apiBase' in window.__ENV__)) {
  const isFile = window.location.protocol === 'file:' || window.location.origin === 'null';
  window.__ENV__.apiBase = isFile ? 'http://localhost:3010' : '';
}
