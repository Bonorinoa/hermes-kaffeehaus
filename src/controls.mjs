import { mountScene } from './scene.mjs';
import { DEFAULT_LOOKS } from './controller.mjs';
import { SCENE } from './scenes.mjs';

// The scene belongs to the plugin, not to the sidebar tab: closing the tab or
// hiding the sidebar must not switch the scene off. createSession lives for the
// plugin's lifetime (disposed via ctx.onDispose); mountControls is one view of it.
// Hermes keeps inactive chats mounted behind data-pane-hidden. Only the chat on
// screen counts. Two chats actually on screen stay native.
function chatsOnScreen() {
  return [...document.querySelectorAll('[data-chat-surface]')].filter(el => !el.closest?.('[data-pane-hidden]'));
}

const PLAIN = {
  'Unavailable or already owned chat surface': 'This chat is not ready for a scene.',
  'Scoped lifecycle unavailable': 'The app did not give the scene a place to live.',
  'Expected private chat hooks missing (floating/HUD not supported)': 'This layout is not supported. Pop-out and HUD stay as they are.',
  'Unsupported appearance / forced colors; native chat preserved': 'This theme is too light, or the colors could not be read. Dark themes only.',
  'Canvas unavailable': 'This window cannot draw the scene.',
};

function plain(reason) {
  if (PLAIN[reason]) return `${SCENE.name} did not open. ` + PLAIN[reason];
  if (typeof reason === 'string' && reason.startsWith('Mount failed')) return `${SCENE.name} did not open. Something in this chat blocked it.`;
  return `${SCENE.name} did not open. ` + reason;
}

export function createSession(ctx, sdk, { mount = mountScene } = {}) {
  let scene = null, mountedEl = null, last = { disabled: true, reason: 'Off. Click Apply to start. Experimental: relies on Hermes internals that may change.' };
  const subs = new Set();
  // Settings are remembered in memory only (no storage), so Off then Apply returns to the same scene.
  let prefs = { mode: 'window', width: 780, looks: { focus: { ...DEFAULT_LOOKS.focus }, window: { ...DEFAULT_LOOKS.window } }, motionRequested: true };
  const report = s => {
    last = s;
    if (!s.disabled && s.mode) prefs = { mode: s.mode, width: s.width, looks: s.looks, motionRequested: s.motionSupported === false ? prefs.motionRequested : s.motionRequested, overrideHour: s.clock?.mode === 'manual' ? s.clock.hour : null };
    for (const fn of subs) { try { fn(s); } catch {} }
  };
  const announce = reason => {
    report({ disabled: true, reason });
    try { sdk?.host?.notify?.({ kind: 'info', message: reason }); } catch {}
  };
  const session = {
    get scene() { return scene; },
    // True only when the scene is on the chat the user is reading. A scene left on a hidden tab is not.
    live() {
      const surfaces = chatsOnScreen();
      return !!(scene?.enabled && surfaces.length === 1 && mountedEl === surfaces[0]);
    },
    last: () => last,
    prefs: () => prefs,
    subscribe(fn) { subs.add(fn); fn(last); return () => subs.delete(fn); },
    apply(prefs) {
      scene?.dispose(); scene = null; mountedEl = null;
      const surfaces = chatsOnScreen();
      if (surfaces.length !== 1) {
        announce(surfaces.length === 0
          ? `${SCENE.name} did not open. No chat is on screen in this window.`
          : `${SCENE.name} did not open. More than one chat is open. Close the extra pane and try again.`);
        return;
      }
      scene = mount(surfaces[0], ctx, sdk, { onState: report });
      if (scene.enabled) { mountedEl = surfaces[0]; scene.update(prefs); }
      else { const reason = plain(scene.reason); scene = null; announce(reason); }
    },
    off() { scene?.dispose(); scene = null; mountedEl = null; report({ disabled: true, reason: 'Off. Prior settings restored.' }); },
    // Palette row: turn off only the scene you can see. Otherwise open the one on screen.
    toggle(prefs) { if (session.live()) session.off(); else session.apply(prefs); },
    update(patch) { if (scene?.enabled) scene.update(patch); },
    dispose() { scene?.dispose(); scene = null; mountedEl = null; subs.clear(); },
  };
  ctx.onDispose(session.dispose);
  return session;
}

// The sidebar tab is only the launcher: Hermes starts plugins like this from a tab, so the
// scene has to be switched on here. Every setting lives on the scene's own card (the menu
// board in Window Seat, the ☕ pill in Focus and Classic), so the tab can be closed.
export function mountControls(container, ctx, session) {
  let disposed = false;
  const off = [];
  const el = (tag, css, text) => { const n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; };
  const form = el('div', 'display:flex;flex-direction:column;gap:12px;color:var(--ui-text-primary);font:14px/1.5 system-ui');
  const title = el('strong', 'font:600 16px/1.2 "Iowan Old Style",Palatino,Georgia,serif', 'Scenes');
  const sub = el('span', 'margin-top:-8px;color:var(--ui-text-tertiary);font-size:13px', `${SCENE.icon} ${SCENE.name} · ${SCENE.tagline}`);
  const btnCss = 'color:inherit;background:var(--ui-panel-background,var(--ui-chat-surface-background));border:1px solid var(--ui-stroke-secondary);padding:8px 10px;border-radius:6px;font:inherit;cursor:pointer;text-align:left';
  const apply = el('button', btnCss, SCENE.open); apply.type = 'button'; apply.dataset.kh = 'apply';
  const stop = el('button', btnCss, 'Off · restore Hermes'); stop.type = 'button'; stop.dataset.kh = 'off';
  const status = el('p', 'margin:0;color:var(--ui-text-secondary)'); status.setAttribute('role', 'status'); status.dataset.kh = 'status';
  const how = el('p', 'margin:0;color:var(--ui-text-tertiary);font-size:13px', 'Change the seat, the hour, the blend and the look from inside the scene: the board on the wall in Window Seat, or the pill in Focus and Classic. You can close this tab; the scene keeps running.');
  const note = el('p', 'margin:0;color:var(--ui-text-tertiary);font-size:12px', 'Runs entirely on your Mac: no network, no storage, never reads your chats. The note-taker only knows whether Hermes is working. Experimental: relies on Hermes internals that may change. Inspired by Borealis.');
  form.append(title, sub, apply, stop, status, how, note);
  container.append(form);
  const SEATS = { window: 'Window Seat', focus: 'Focus', classic: 'Classic' };
  const say = text => { if (status.textContent !== text) status.textContent = text; };
  const report = s => {
    if (disposed) return;
    if (s.disabled) { say(s.reason); apply.textContent = SCENE.open; stop.disabled = true; return; }
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
