import { mountScene } from './scene.mjs';
import { DEFAULT_LOOKS } from './controller.mjs';

// The scene belongs to the plugin, not to the sidebar tab: closing the tab or
// hiding the sidebar must not switch the scene off. createSession lives for the
// plugin's lifetime (disposed via ctx.onDispose); mountControls is one view of it.
export function createSession(ctx, sdk, { mount = mountScene } = {}) {
  let scene = null, last = { disabled: true, reason: 'Off. Click Apply to start. Experimental: relies on Hermes internals that may change.' };
  const subs = new Set();
  // Settings are remembered in memory only (no storage), so Off then Apply returns to the same café.
  let prefs = { mode: 'window', width: 780, looks: { focus: { ...DEFAULT_LOOKS.focus }, window: { ...DEFAULT_LOOKS.window } }, motionRequested: true };
  const report = s => {
    last = s;
    if (!s.disabled && s.mode) prefs = { mode: s.mode, width: s.width, looks: s.looks, motionRequested: s.motionSupported === false ? prefs.motionRequested : s.motionRequested, overrideHour: s.clock?.mode === 'manual' ? s.clock.hour : null };
    for (const fn of subs) { try { fn(s); } catch {} }
  };
  const session = {
    get scene() { return scene; },
    last: () => last,
    prefs: () => prefs,
    subscribe(fn) { subs.add(fn); fn(last); return () => subs.delete(fn); },
    apply(prefs) {
      scene?.dispose(); scene = null;
      const surfaces = [...document.querySelectorAll('[data-chat-surface]')];
      if (surfaces.length !== 1) { report({ disabled: true, reason: 'Not applied: requires exactly one chat surface. Split panes stay native.' }); return; }
      scene = mount(surfaces[0], ctx, sdk, { onState: report });
      if (scene.enabled) scene.update(prefs);
      else { const reason = 'Not applied: ' + scene.reason; scene = null; report({ disabled: true, reason }); }
    },
    off() { scene?.dispose(); scene = null; report({ disabled: true, reason: 'Off. Prior settings restored.' }); },
    update(patch) { if (scene?.enabled) scene.update(patch); },
    dispose() { scene?.dispose(); scene = null; subs.clear(); },
  };
  ctx.onDispose(session.dispose);
  return session;
}

// The sidebar tab is only the launcher: Hermes starts plugins like this from a tab, so the
// scene has to be switched on here. Every setting lives on the café's own card (the menu
// board in Window Seat, the ☕ pill in Focus and Classic), so the tab can be closed.
export function mountControls(container, ctx, session) {
  let disposed = false;
  const off = [];
  const el = (tag, css, text) => { const n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; };
  const form = el('div', 'display:flex;flex-direction:column;gap:12px;color:var(--ui-text-primary);font:14px/1.5 system-ui');
  const title = el('strong', 'font:600 16px/1.2 "Iowan Old Style",Palatino,Georgia,serif', '☕ Kaffeehaus');
  const btnCss = 'color:inherit;background:var(--ui-panel-background,var(--ui-chat-surface-background));border:1px solid var(--ui-stroke-secondary);padding:8px 10px;border-radius:6px;font:inherit;cursor:pointer;text-align:left';
  const apply = el('button', btnCss, 'Open the café'); apply.type = 'button'; apply.dataset.kh = 'apply';
  const stop = el('button', btnCss, 'Off · restore Hermes'); stop.type = 'button'; stop.dataset.kh = 'off';
  const status = el('p', 'margin:0;color:var(--ui-text-secondary)'); status.setAttribute('role', 'status'); status.dataset.kh = 'status';
  const how = el('p', 'margin:0;color:var(--ui-text-tertiary);font-size:13px', 'Change the seat, the hour, the blend and the look from the café itself: the chalkboard on the wall in Window Seat, or the ☕ pill in Focus and Classic. You can close this tab; the café keeps running.');
  const note = el('p', 'margin:0;color:var(--ui-text-tertiary);font-size:12px', 'Runs entirely on your Mac: no network, no storage, never reads your chats. The note-taker only knows whether Hermes is working. Experimental: relies on Hermes internals that may change. Inspired by Borealis.');
  form.append(title, apply, stop, status, how, note);
  container.append(form);
  const SEATS = { window: 'Window Seat', focus: 'Focus', classic: 'Classic' };
  const say = text => { if (status.textContent !== text) status.textContent = text; };
  const report = s => {
    if (disposed) return;
    if (s.disabled) { say(s.reason); apply.textContent = 'Open the café'; stop.disabled = true; return; }
    apply.textContent = 'Reapply to this chat'; stop.disabled = false;
    // Describes state, not a ticking clock, so screen readers are not re-announced every minute.
    say(`On · ${SEATS[s.mode]} · ${s.clock.mode === 'auto' ? 'following the clock' : 'hour set by hand'} · motion ${s.motion ? 'on' : 'off'}${s.reduced ? ' (macOS Reduce motion)' : ''}${s.peek ? ' · peeking at the room' : ''}`);
  };
  off.push(ctx.addEventListener(stop, 'click', () => session.off()));
  off.push(ctx.addEventListener(apply, 'click', () => session.apply(session.prefs())));
  off.push(session.subscribe(report)); // shows the live state when the tab is reopened
  // Closing the tab removes only this view; the scene is the session's.
  const dispose = () => { if (disposed) return; disposed = true; off.reverse().forEach(fn => fn()); form.remove(); };
  return { dispose };
}
