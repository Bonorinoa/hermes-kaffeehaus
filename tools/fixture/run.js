// Drives the real bundle (copied as plugin.js) through a scenario from the query string:
// ?seat=window|focus|classic&hour=15&open=1&busy=1&wait=1500
import plugin from './plugin.js';
const q = new URLSearchParams(location.search), regs = [];
const ctx = { register: c => regs.push(c), onDispose() {}, setInterval: (f, ms) => { const id = setInterval(f, ms); return () => clearInterval(id); },
  addEventListener: (t, type, fn) => { t.addEventListener(type, fn); return () => t.removeEventListener(type, fn); } };
plugin.register(ctx);
window.__busy = q.get('busy') === '1';
const toggle = regs.find(r => r.id === 'toggle');
toggle.data.run();
const $ = s => document.querySelector(s);
const step = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await step(300);
  const openCard = () => { const b = $('[data-kaffeehaus-ui=board]'); const p = $('[data-kaffeehaus-ui=pill]'); (b && b.style.display !== 'none' ? b : p).click(); };
  const seat = q.get('seat') || 'window';
  if (q.get('hour')) { openCard(); const h = document.querySelector('[data-kaffeehaus-ui^=panel-][style*="display: block"] input[aria-label=Hour]'); h.value = q.get('hour'); h.dispatchEvent(new Event('input')); openCard(); }
  await step(200);
  if (seat !== 'window') { openCard(); document.querySelector(`[data-kaffeehaus-ui^=panel-][style*="display: block"] [data-mode=${seat}]`).click(); }
  await step(700);
  const open = !!document.querySelector('[data-kaffeehaus-ui^=panel-][style*="display: block"]');
  if (q.get('open') === '1' && !open) openCard();
  if (q.get('open') !== '1' && open) openCard();
  await step(Number(q.get('wait') || 1200));
  document.title = 'ready';
})();
