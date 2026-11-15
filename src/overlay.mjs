import { DEFAULT_LOOKS, LOOK_RANGES, BLENDS } from './controller.mjs';

// In-scene controls (hybrid): a chalkboard menu board on the café wall when the
// room is visible (wide Window Seat), a frosted-glass pill otherwise (Focus,
// narrow Window Seat). Both open the same settings. Styled with element.style
// only (no <style> injection); positioned against private host geometry.
const LOOK_ROWS = [['blur', 'Unschärfe', 'Scene blur', 'px'], ['brightness', 'Helligkeit', 'Scene brightness', '%'],
  ['veil', 'Schleier', 'Text panel', '%'], ['glass', 'Glas', 'Glass', 'px']];
const THEMES = {
  paper: { panel: 'background:#f2e9d6;color:#2a211b;border-radius:4px;padding:16px 18px 14px;box-shadow:0 18px 40px rgba(0,0,0,.5);font:14px/1.45 "Iowan Old Style",Palatino,Georgia,serif;width:330px',
    title: 'Die Karte', sub: 'café settings', head: 'font:600 11px/1 -apple-system,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8a6a45;margin:14px 0 7px',
    btn: 'flex:1;padding:6px 8px;border:1px solid #b59a73;background:transparent;border-radius:3px;color:#2a211b;font:inherit;cursor:pointer',
    on: 'background:#2a211b;color:#f2e9d6;border-color:#2a211b', muted: '#7a6650', accent: '#6b4a2f',
    sections: [['Platz', 'where you sit'], ['Uhrzeit', 'light in the room'], ['Hausmischungen', 'house blends'], ['À la carte', 'for this seat'], ['Im Raum', 'the room']],
    seats: [['window', 'Fensterplatz'], ['focus', 'Fokus'], ['classic', 'Klassisch']], follow: 'Jetzt', reset: 'Zurücksetzen · reset this seat', width: ['Lesebreite', 'reading width'], motion: ['Bewegung', 'Stillleben'], peek: 'Nur der Raum · peek', german: true },
  glass: { panel: 'background:rgba(22,26,36,.94);color:#eef0f4;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:14px 16px 12px;box-shadow:0 20px 44px rgba(0,0,0,.45);font:13px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;width:340px;backdrop-filter:blur(26px) saturate(1.5)',
    title: 'Café', sub: 'scene settings', head: 'font:600 10.5px/1 -apple-system,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:rgba(238,240,244,.68);margin:12px 0 7px',
    btn: 'flex:1;padding:6px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);border-radius:8px;color:#eef0f4;font:inherit;cursor:pointer',
    on: 'background:rgba(201,163,106,.28);border-color:rgba(201,163,106,.7)', muted: 'rgba(238,240,244,.6)', accent: '#c9a36a',
    sections: [['Seat', ''], ['Light', ''], ['House blends', ''], ['Look · this seat', ''], ['Room', '']],
    seats: [['window', 'Window Seat'], ['focus', 'Focus'], ['classic', 'Classic']], follow: 'Follow clock', reset: 'Reset this seat', width: ['Reading width', ''], motion: ['Motion on', 'Motion off'], peek: 'Peek at the room', german: false } };

const blendOf = looks => {
  const same = (a, b) => Object.keys(LOOK_RANGES).every(k => a[k] === b[k]);
  const b = BLENDS.find(x => same(x.focus, looks.focus) && same(x.window, looks.window));
  return b ? b.name : same(DEFAULT_LOOKS.focus, looks.focus) && same(DEFAULT_LOOKS.window, looks.window) ? 'House default' : 'Your own';
};
const fmtHour = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;
const partOfDay = h => h < 5 ? 'night' : h < 8 ? 'dawn' : h < 17 ? 'day' : h < 20.5 ? 'dusk' : 'night';

export function createOverlay({ root, listen, update, peek = () => {}, reduced = () => false }) {
  const el = (tag, css, text) => { const n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; };

  // Triggers
  const board = el('button', 'position:absolute;z-index:40;width:180px;padding:11px 14px;text-align:left;background:#26282a;border:0;border-radius:0;box-shadow:0 0 0 3px #4a2c20,0 0 0 6px #6b4a2f,0 12px 22px rgba(0,0,0,.45);color:#ecebe4;cursor:pointer;display:none');
  board.type = 'button'; board.dataset.kaffeehausUi = 'board'; board.setAttribute('aria-controls', 'kaffeehaus-paper'); board.setAttribute('aria-haspopup', 'dialog'); board.setAttribute('aria-expanded', 'false');
  const bTitle = el('div', 'font:italic 600 19px/1.1 "Snell Roundhand","Apple Chancery","Bradley Hand",cursive;color:#f4f1e6', 'Die Karte');
  const bBlend = el('div', 'font:12.5px/1.4 "Chalkboard","Bradley Hand",sans-serif;color:#c9a36a;margin-top:6px');
  const bTime = el('div', 'font:12.5px/1.4 "Chalkboard","Bradley Hand",sans-serif;color:#d8d6cc');
  const bHint = el('div', 'font:11.5px/1.3 "Chalkboard",sans-serif;color:#c9c6ba;margin-top:6px', 'click to adjust ›');
  board.append(bTitle, bBlend, bTime, bHint);
  const pill = el('button', 'position:absolute;z-index:40;left:16px;top:14px;height:32px;padding:0 12px;border-radius:999px;font:12.5px/1 -apple-system,sans-serif;color:#eef0f4;background:rgba(28,32,44,.5);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(18px) saturate(1.4);box-shadow:0 6px 18px rgba(0,0,0,.28);cursor:pointer;display:none;white-space:nowrap');
  pill.type = 'button'; pill.dataset.kaffeehausUi = 'pill'; pill.setAttribute('aria-controls', 'kaffeehaus-glass'); pill.setAttribute('aria-haspopup', 'dialog'); pill.setAttribute('aria-expanded', 'false');

  // One panel per theme, built once.
  const panels = {};
  for (const [name, T] of Object.entries(THEMES)) {
    const panel = el('div', `position:absolute;z-index:41;overflow:auto;display:none;${T.panel}`);
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Café scene settings'); panel.id = 'kaffeehaus-' + name; panel.dataset.kaffeehausUi = 'panel-' + name;
    const top = el('div', `display:flex;align-items:baseline;gap:8px;${T.german ? 'border-bottom:3px double #8a6a45;padding-bottom:8px' : ''}`);
    const close = el('button', `margin-left:auto;background:none;border:0;font-size:20px;line-height:1;color:${T.muted};cursor:pointer`, '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Close');
    top.append(el('strong', `font-size:${T.german ? 20 : 15}px`, T.title), el('small', `font-style:italic;color:${T.muted}`, T.sub), close);
    panel.append(top);
    const head = i => { const h = el('div', T.head, T.sections[i][0]); if (T.sections[i][1]) h.append(el('em', `font:italic 12px Palatino,serif;letter-spacing:0;text-transform:none;color:${T.muted};margin-left:6px`, '· ' + T.sections[i][1])); panel.append(h); };
    const row = () => { const r = el('div', 'display:flex;gap:8px;align-items:center;flex-wrap:wrap'); panel.append(r); return r; };
    const button = (parent, text, fn) => { const b = el('button', T.btn, text); b.type = 'button'; listen(b, 'click', fn); parent.append(b); return b; };
    const range = ([lo, hi], step, label) => { const r = el('input', `width:100%;accent-color:${T.accent}`); r.type = 'range'; r.min = lo; r.max = hi; r.step = step; r.setAttribute('aria-label', label); return r; };

    head(0); const seatRow = row();
    const seats = T.seats.map(([mode, text]) => { const b = button(seatRow, text, () => update({ mode })); b.dataset.mode = mode; return b; });
    const classicNote = el('p', `margin:10px 0 2px;font-style:italic;color:${T.muted}`, 'Classic is the Kaffeehaus palette and type without the room. Pick a seat above to step into the café.');
    panel.append(classicNote); const roomFrom = panel.childElementCount;
    head(1); const hourRow = row(); const hour = range([0, 23.75], 0.25, 'Hour'); hour.style.flex = '1';
    const hourOut = el('span', `font-variant-numeric:tabular-nums;color:${T.muted}`);
    listen(hour, 'input', () => update({ overrideHour: Number(hour.value) }));
    hourRow.append(hour, hourOut); const follow = button(hourRow, T.follow, () => update({ overrideHour: null })); follow.style.flex = '0 0 auto';
    head(2); const blendRow = row();
    const blends = BLENDS.map(b => { const x = button(blendRow, b.name, () => update({ looks: { focus: { ...b.focus }, window: { ...b.window } } })); x.title = b.note; x.dataset.blend = b.name; x.style.flex = '0 0 auto'; return x; });
    head(3);
    const looks = {};
    for (const [key, de, en, unit] of LOOK_ROWS) {
      const lab = el('label', 'display:block;margin-bottom:4px');
      const line = el('span', 'display:flex;gap:6px;align-items:baseline');
      line.append(el('span', '', T.german ? de : en));
      if (T.german) line.append(el('i', `font-size:12px;color:${T.muted}`, en.toLowerCase()));
      line.append(el('span', `flex:1;${T.german ? 'border-bottom:1px dotted #a58b67;transform:translateY(-4px)' : ''}`));
      const out = el('span', `font-variant-numeric:tabular-nums;color:${T.muted}`); line.append(out);
      const input = range(LOOK_RANGES[key], 1, en);
      listen(input, 'input', () => update({ look: { [key]: Number(input.value) } }));
      lab.append(line, input); panel.append(lab); looks[key] = { input, out, unit };
    }
    head(4);
    const wLab = el('label', 'display:block;margin-bottom:4px'), wLine = el('span', 'display:flex;gap:6px;align-items:baseline');
    wLine.append(el('span', '', T.width[0])); if (T.width[1]) wLine.append(el('i', `font-size:12px;color:${T.muted}`, T.width[1]));
    wLine.append(el('span', `flex:1;${T.german ? 'border-bottom:1px dotted #a58b67;transform:translateY(-4px)' : ''}`));
    const widthOut = el('span', `font-variant-numeric:tabular-nums;color:${T.muted}`); wLine.append(widthOut);
    const width = range([360, 1000], 10, 'Reading width'); listen(width, 'input', () => update({ width: Number(width.value) }));
    wLab.append(wLine, width); panel.append(wLab);
    const roomRow = row(); roomRow.style.marginTop = '8px';
    const motion = button(roomRow, T.motion[0], () => last && update({ motionRequested: !last.state.motionRequested }));
    const peekBtn = button(roomRow, T.peek, () => { setOpen(false, false); peek(); });
    const foot = el('div', `display:flex;justify-content:space-between;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid ${T.german ? '#d7c6a6' : 'rgba(255,255,255,.1)'};font-size:12px;color:${T.muted}`);
    const blendName = el('span'); const reset = el('button', `background:none;border:0;color:${T.accent};text-decoration:underline;cursor:pointer;font:inherit`, T.reset); reset.type = 'button';
    foot.append(blendName, reset); panel.append(foot);
    const roomOnly = [...panel.children].slice(roomFrom);
    panels[name] = { panel, close, reset, seats, hour, hourOut, follow, blends, looks, blendName, T, classicNote, roomOnly, width, widthOut, motion, peekBtn };
  }
  root.append(board, pill, panels.paper.panel, panels.glass.panel);

  let open = false, variant = null, last = null;
  const trigger = () => variant === 'board' ? board : pill;
  const current = () => panels[variant === 'board' ? 'paper' : 'glass'];
  const setOpen = (value, refocus = true) => {
    if (open === value) return; open = value;
    for (const p of Object.values(panels)) p.panel.style.display = 'none';
    trigger().setAttribute('aria-expanded', String(open));
    if (open) {
      const p = current().panel; p.style.display = 'block'; place();
      if (!reduced()) { // a short fade from the board/pill
        p.style.transition = 'none'; p.style.opacity = '0'; p.style.transform = 'translateY(-4px) scale(.985)'; void p.offsetWidth;
        p.style.transition = 'opacity 160ms ease, transform 160ms ease'; p.style.opacity = '1'; p.style.transform = 'none';
      }
      current().seats.find(b => b.dataset.mode === last?.state.mode)?.focus({ preventScroll: true });
    } else if (refocus) trigger().focus({ preventScroll: true });
  };
  listen(board, 'click', () => setOpen(!open)); listen(pill, 'click', () => setOpen(!open));
  for (const p of Object.values(panels)) {
    listen(p.close, 'click', () => setOpen(false));
    listen(p.reset, 'click', () => last && update({ look: { ...DEFAULT_LOOKS[last.state.mode] } }));
  }
  listen(document, 'keydown', e => {
    if (!open || e.defaultPrevented) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    if (e.key !== 'Tab') return; // keep keyboard focus inside the open card
    const items = [...current().panel.querySelectorAll('button,input')].filter(n => n.offsetParent !== null);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement), next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
    e.preventDefault(); items[next].focus({ preventScroll: true });
  });

  function place() {
    if (!last) return;
    const { g, r } = last, op = trigger().offsetParent || root, o = op.getBoundingClientRect();
    const dx = r.left - o.left, dy = r.top - o.top, h = r.height;
    if (variant === 'board') {
      const H = Math.max(144, Math.ceil(h / g.scale)), band = (H - 144) * g.scale, cord = g.tx * g.scale;
      // Short wall above the window: shrink to a compact sign rather than cover the arch.
      const compact = band < 160; bTime.style.display = bHint.style.display = compact ? 'none' : '';
      const bh = board.offsetHeight || (compact ? 56 : 104);
      let left = cord - 180 - 22; if (left < 16) left = Math.min(cord + 22, g.chatLeft - 220);
      const top = Math.max(12, band - bh - 8);
      board.style.left = `${dx + left}px`; board.style.top = `${dy + top}px`;
      // Open the card over the chat column, never over the room: you change the hour to watch the window.
      const p = panels.paper.panel;
      p.style.left = `${dx + Math.max(g.chatLeft + 16, Math.min(g.chatLeft + 24, r.width - 346))}px`; p.style.top = `${dy + 48}px`; p.style.maxHeight = `${h - 64}px`;
    } else {
      pill.style.left = `${dx + 16}px`; pill.style.top = `${dy + 14}px`;
      const p = panels.glass.panel; p.style.left = `${dx + 16}px`; p.style.top = `${dy + 54}px`; p.style.maxHeight = `${h - 74}px`;
    }
  }

  function render(state, g, peek, r) {
    last = { state, g, r };
    const next = state.mode === 'window' && g.wide ? 'board' : 'pill';
    if (next !== variant) { if (open) setOpen(false); variant = next; }
    board.style.display = !peek && variant === 'board' ? 'block' : 'none';
    pill.style.display = !peek && variant === 'pill' ? 'block' : 'none';
    if (peek && open) setOpen(false);
    const h = state.clock.hour, name = blendOf(state.looks), live = state.clock.mode === 'auto';
    const time = `${fmtHour(h)} · ${live ? partOfDay(h) : 'hour set by hand'}`;
    if (bBlend.textContent !== name) bBlend.textContent = name;
    if (bTime.textContent !== time) bTime.textContent = time;
    const classic = state.mode === 'classic';
    const pillText = classic ? '☕ Kaffeehaus Classic ▾' : `☕ ${name} · ${fmtHour(h)}${live ? '' : ' · by hand'} · ${state.mode === 'window' ? 'Window Seat' : 'Focus'} ▾`;
    if (pill.textContent !== pillText) pill.textContent = pillText;
    board.setAttribute('aria-label', `Café settings: ${name}, ${time}`);
    for (const p of Object.values(panels)) {
      for (const b of p.seats) { const on = b.dataset.mode === state.mode; b.setAttribute('aria-pressed', String(on)); b.style.cssText = p.T.btn + (on ? ';' + p.T.on : ''); }
      for (const b of p.blends) { const on = b.dataset.blend === name; b.setAttribute('aria-pressed', String(on)); b.style.cssText = p.T.btn + ';flex:0 0 auto' + (on ? ';' + p.T.on : ''); }
      if (document.activeElement !== p.hour) p.hour.value = String(h);
      p.hourOut.textContent = fmtHour(h); p.follow.setAttribute('aria-pressed', String(live));
      p.classicNote.style.display = classic ? '' : 'none';
      for (const n of p.roomOnly) n.style.display = classic ? 'none' : '';
      const L = state.looks[classic ? 'focus' : state.mode];
      for (const [key] of LOOK_ROWS) { const s = p.looks[key], v = String(L[key]); if (s.input.value !== v && document.activeElement !== s.input) s.input.value = v; s.out.textContent = v + s.unit; }
      p.blendName.textContent = 'Blend: ' + name;
      if (document.activeElement !== p.width) p.width.value = String(state.width); p.widthOut.textContent = state.width + ' px';
      p.motion.textContent = state.motion ? p.T.motion[0] : p.T.motion[1]; p.motion.setAttribute('aria-pressed', String(!!state.motion));
      p.motion.disabled = !!state.reduced; p.motion.title = state.reduced ? 'macOS Reduce motion is on' : '';
    }
    place();
  }
  const dispose = () => { open = false; for (const n of [board, pill, panels.paper.panel, panels.glass.panel]) n.remove(); };
  return { render, dispose };
}
