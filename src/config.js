window.__ENV__ = window.__ENV__ || {};
if (!('apiBase' in window.__ENV__)) {
  window.__ENV__.apiBase = (window.location.protocol === 'file:' || window.location.origin === 'null')
    ? 'http://localhost:3010'
    : '';
}
