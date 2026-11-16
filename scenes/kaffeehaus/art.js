/* Kaffeehaus scene source: original pixel art drawn with rectangles on a 2D canvas.
 * No dependencies, no network, no storage, no chat input. Plain script: sets window.Kaffeehaus
 * (or module.exports under Node). Drawing is derived from design/corrected/ (same author, same
 * session lineage); the pose layer, state machine and layer split are new in art/.
 *
 * Logical room is SH=144 px tall and any width W. Scale it by an integer or by CSS; use
 * image-rendering:pixelated. The geometry constants are ART GUIDANCE, not Hermes SDK facts.
 *
 *   drawRoom(ctx,W,hour,frame,o)       wall, floor, window, curtains, lamp, table, props (no person, no tint)
 *   drawCharacter(ctx,W,hour,frame,o)  chair + note-taker only; transparent elsewhere (no tint)
 *   drawTint(ctx,W,hour)               civil-time grade, fills the whole canvas; draw last
 *   draw(...)                          all three in order
 *   o = { wx, tx, state, since, passers }  wx window centre x, tx table centre x (logical px);
 *                          state 'idle'|'busy'|'still'|'lookup'|'wrapup'|'doze'|'sleep' (unknown = idle);
 *                          since = frames since the state began (one-shots); passers:false hides passers-by
 *   hour: local civil time as a float 0..24. Illustrative sky, NOT astronomical sunrise.
 *
 * State meaning (art only): busy = writing; idle = resting, with a slow glance/think; still = one
 * fixed frame for reduced motion/off; lookup = pen up, head rises (first words arrive); wrapup = one-shot 16 frames:
 * book closes, lean back, sip, hold relaxed; doze = late-night nodding; sleep = empty chair, figure in a sleeping bag.
 * Passers-by cross the window deterministically from (hour, frame). None of these says anything about success or failure of a task.
 * Caller advances `frame` at about 4 per second. 'still' ignores `frame` (always frame 0).
 */
(function (root) {
  'use strict';
  const SH = 144, ART_L = 54, ART_R = 40;      // room height; art cluster extent left/right of window centre
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = c => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  const SKY = [[0, [10, 14, 36], [26, 38, 78]], [5, [30, 36, 76], [120, 90, 120]], [6.5, [120, 150, 200], [250, 190, 150]], [9, [96, 160, 226], [190, 222, 244]],
    [16, [96, 160, 226], [200, 222, 240]], [18, [110, 120, 190], [250, 170, 110]], [19.5, [40, 40, 90], [190, 100, 90]], [21, [14, 18, 44], [30, 40, 84]], [24, [10, 14, 36], [26, 38, 78]]];
  function skyAt(h) { for (let i = 0; i < SKY.length - 1; i++) { const a = SKY[i], b = SKY[i + 1]; if (h >= a[0] && h <= b[0]) { const t = (h - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; } } return [SKY[0][1], SKY[0][2]]; }
  const day = h => smooth(5.5, 8, h) * (1 - smooth(18, 20.5, h));
  const hash = n => { n = Math.sin(n * 127.1) * 43758.5453; return n - Math.floor(n); };
  const wrapHour = h => ((h % 24) + 24) % 24;      // callers pass [0,24); wrap defensively so 24 == 0 (cyclic at midnight)
  const hourOf = d => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;   // machine-local civil time

  /* ---- character poses: data, not code. Offsets are logical px relative to the idle writing pose. ----
   * pen: pen-hand nudge in y (rest lifts the pen 1 px off the page, write-b presses down 1 px). eye: glasses x shift (-1 = toward the window).
   * ey: glasses y shift (eyes up/down inside the head); hx/hy: head nudge forward/down; lean: torso+head back toward the chair (neg = slump forward);
   * tilt: extra hair rows; back: head tipped back; ext: legs extended under the table.
   * hand: 'page' (pen on notebook, travels dx along it) 'chin' 'flat' 'reach' 'carry' 'sip' 'cross'. Torso bob comes from poseFor. */
  const POSES = {
    // busy: head bowed toward the page (forward + down 1, eyes down 1); the writing hand travels along the notebook (poseFor dx)
    'write-a': { pen: 0, eye: 0, hx: 1, hy: 1, ey: 1, tilt: 1, hand: 'page' },
    'write-b': { pen: 1, eye: 0, hx: 1, hy: 1, ey: 1, tilt: 1, hand: 'page' },
    'rest':    { pen: -1, eye: 0, hand: 'page' },
    'glance':  { pen: 0, eye: -1, hand: 'page' },
    'think':   { pen: 0, eye: 0, hand: 'chin' },
    // lookup: head stays seated on the shoulders; torso leans back 1, glasses/eyes shift up, pen lifts off the page
    'up1':     { pen: -3, eye: -1, ey: -1, lean: 1, hand: 'page' },
    'up2':     { pen: -3, eye: 0, ey: -1, lean: 1, hand: 'page' },
    // wrapup: close book, lean back, take the cup, sip, put it back, settle back with arms crossed
    'w-close': { eye: 0, hand: 'flat' },
    'w-lean':  { eye: 0, lean: 1, hand: 'flat' },
    'reach':   { eye: 0, hand: 'reach' },
    'carry':   { eye: 0, lean: 1, hand: 'carry' },
    'sip':     { lean: 1, hand: 'sip', closed: 1 },
    'relax':   { lean: 2, hand: 'cross', closed: 1, back: 1, ext: 1 },
    // doze: eyes shut, head dips forward in 3 steps (lean<0 = torso and head slump forward, hy dips the head, tilt shows more hair, ey = glasses slip)
    'dz0':     { hand: 'flat', closed: 1 },
    'dz1':     { hand: 'flat', closed: 1, lean: -1, hy: 1, ey: 1 },
    'dz2':     { hand: 'flat', closed: 1, lean: -2, hy: 3, tilt: 2, ey: 1 }
  };
  const STATES = ['idle', 'busy', 'still', 'lookup', 'wrapup', 'doze', 'sleep'];
  const WRAP = ['w-close', 'w-close', 'w-close', 'w-lean', 'reach', 'reach', 'carry', 'sip', 'sip', 'sip', 'sip', 'carry', 'reach', 'reach', 'w-lean'];
  const WRAP_LEN = 16;                               // wrapup is one-shot: 16 frames (4 s), then the last pose holds
  /* Pose picker. busy: pen alternates every 2 frames, slow torso bob. idle: 20 s cycle (80 frames at 4/s):
   * rest, glance to the window, rest, think, rest; 4 s breathing bob. still: fixed 'rest'.
   * lookup(since): up1 for 2 frames, then up2. wrapup(since): WRAP table, then 'relax' held (no bob).
   * doze: 40-frame loop, steps change every 9-12 frames. cup:'lift' while the cup is in the hand, 'near' while it is slid toward the sitter for the reach (shorter arm), else 'rest'; busy adds dx (hand travel on the page). */
  function poseFor(state, frame, since) {
    since = since > 0 ? Math.floor(since) : 0;
    if (state === 'still') return { name: 'rest', bob: 0 };
    if (state === 'busy') { const p = (frame >> 1) & 1; return { name: p ? 'write-b' : 'write-a', bob: (frame >> 3) & 1, dx: [0, 1, 2, 3, 3, 2, 1, 0][frame & 7] }; }
    if (state === 'lookup') return { name: since < 2 ? 'up1' : 'up2', bob: 0 };
    if (state === 'wrapup') { const n = since < WRAP_LEN - 1 ? WRAP[since] : 'relax'; return { name: n, bob: 0, cup: since >= 6 && since <= 11 ? 'lift' : since === 4 || since === 5 || since === 12 || since === 13 ? 'near' : 'rest' }; }
    if (state === 'doze') { const f = ((frame % 40) + 40) % 40; return { name: f < 10 ? 'dz0' : f < 19 ? 'dz1' : f < 31 ? 'dz2' : 'dz1', bob: (frame >> 4) & 1, f: f }; }
    const f = ((frame % 80) + 80) % 80;
    const name = f < 32 ? 'rest' : f < 44 ? 'glance' : f < 60 ? 'rest' : f < 72 ? 'think' : 'rest';
    return { name: name, bob: (frame >> 4) & 1 };
  }
  // o.state -> one of STATES. Missing state keeps the original default (busy); anything unknown is idle.
  const stateOf = o => (o.state === undefined ? 'busy' : STATES.indexOf(o.state) < 0 ? 'idle' : o.state);
  const sinceOf = o => (o.since > 0 ? Math.floor(o.since) : 0);
  // notebook: 0 open, 1 closed (pen still in hand), 2 closed with the pen on top
  const bookOf = (st, since) => (st === 'doze' || st === 'sleep' ? 2 : st === 'wrapup' ? (since < 1 ? 0 : since < 2 ? 1 : 2) : 0);

  const painter = ctx => (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const eff = (state, frame) => (state === 'still' ? 0 : frame);

  /* ---- passers-by: pure function of (hour, frame). One walker may start per 24-frame slot; each crossing lasts
   * 24..35 frames (6-9 s) and starts at most 8 frames into its slot, so at most 2 overlap. ---- */
  const SLOT = 24;
  const density = h => { h = wrapHour(h); return h >= 1 && h < 5.5 ? 0 : h < 7 ? 0.12 : h < 19 ? 0.5 : h < 23 ? 0.25 : 0.08; };
  function passersAt(hour, frame) {
    const out = [], p = density(hour), s0 = Math.floor(frame / SLOT);
    for (let s = s0 - 1; s <= s0; s++) {
      if (s < 0 || hash(s * 7.31 + 0.5) >= p) continue;
      const start = s * SLOT + Math.floor(hash(s * 3.7 + 1.1) * 9), dur = 24 + Math.floor(hash(s * 5.3 + 2.2) * 12), t = frame - start;
      if (t < 0 || t >= dur) continue;
      out.push({ u: t / dur, t: t, dir: hash(s * 9.9 + 3.3) < 0.5 ? -1 : 1, kind: Math.floor(hash(s * 1.7 + 4.4) * 5), tone: Math.floor(hash(s * 2.9 + 5.5) * 4) });
    }
    return out;
  }
  const COATS = [[70, 52, 78], [44, 82, 80], [128, 74, 52], [48, 60, 104]];
  function drawPassers(R, wx, hour, frame, night) {
    const Rc = (x, y, w, h, c) => { const x0 = Math.max(x, wx - 33), x1 = Math.min(x + w, wx + 34); if (x1 > x0) R(x0, y, x1 - x0, h, c); };   // stay inside the glass
    const sh = c => rgb(lerp(c, [176, 170, 214], night * 0.55));   // night: lighter cool lavender body (distinct from the amber windows) with an amber lamp edge
    for (const w of passersAt(hour, frame)) {
      const x = Math.round(w.dir > 0 ? wx - 38 + w.u * 76 : wx + 34 - w.u * 76), ph = [0, 1, 2, 1][w.t & 3], coat = sh(COATS[w.tone]), dark = sh([50, 46, 60]), skin = sh([200, 160, 130]);
      const tall = w.kind === 4 ? 1 : 0, top = 82 - tall;                                                // feet end at y 88, on the pavement strip
      Rc(x + (ph === 1 ? 1 : ph === 0 ? 0 : 1), 87, ph === 1 ? 2 : 1, 2, dark); if (ph !== 1) Rc(x + (ph === 0 ? 2 : 3), 87, 1, 2, dark);   // legs: apart / together / apart
      Rc(x, top + 2, 4, 5 + tall, coat); Rc(x + 1, top, 2, 2, skin);                              // coat, head
      if (w.kind === 2) Rc(x, top - 1, 4, 1, dark);                                                      // hat
      if (w.kind === 1) { const uc = sh([170, 56, 56]); Rc(x - 2, top - 2, 8, 1, uc); Rc(x - 1, top - 3, 6, 1, uc); Rc(x, top - 4, 4, 1, uc); Rc(x + 2, top - 1, 1, 3, dark); }   // umbrella
      if (w.kind === 3) Rc(x + (w.dir > 0 ? 3 : -1), top + 3, 1, 3, sh([120, 90, 50]));                  // bag
      if (night > 0.3) Rc(x + (w.dir > 0 ? 3 : 0), top, 1, 6 + tall, 'rgb(255,208,120)');                        // lamplit edge
    }
  }

  function drawRoom(ctx, W, hour, frame, o) {
    const st = stateOf(o), since = sinceOf(o); frame = eff(st, frame); hour = wrapHour(hour);
    const cs = poseFor(st, frame, since).cup, lift = cs === 'lift', near = cs === 'near';          // lift: cup is in the hand (wrapup sip); near: slid toward the sitter, off the saucer
    const H = SH, d = day(hour), night = 1 - d, wx = o.wx, tx = o.tx, R = painter(ctx);
    for (let x = 0; x < W; x++) R(x, 0, 1, 88, (x % 8 < 4) ? '#86654e' : '#7f5f49');          // plaster, faint paper stripes
    R(0, 88, W, 2, '#c9a36a'); R(0, 90, W, 12, '#4a2c20');                                      // rail + wainscot
    for (let x = 0; x < W; x += 16) R(x, 92, 1, 8, '#3b2218');
    for (let y = 102; y < H; y++) for (let x = 0; x < W; x += 8) {                              // cream/walnut floor
      const k = (((x >> 3) + ((y - 102) >> 3)) & 1), f = 1 - 0.18 * (y - 102) / 42, c = k ? [205, 187, 152] : [138, 106, 76];
      R(x, y, 8, 1, rgb(c.map(v => Math.round(v * f)))); }
    // arched window (sun only while d>0.2, moon only while night>0.8, so they never share the sky; a change from the mockups): sky, stars, clouds, sun/moon, skyline in one pixel loop
    const sk = skyAt(hour), top = sk[0], bot = sk[1], p = (hour - 6) / 12, pn = ((hour - 18 + 24) % 24) / 12;
    const sun = d > 0.2 ? [wx - 28 + 56 * clamp(p, 0, 1), 64 - 40 * Math.sin(Math.PI * clamp(p, 0, 1))] : null;
    const moon = night > 0.8 ? [wx - 28 + 56 * clamp(pn, 0, 1), 64 - 38 * Math.sin(Math.PI * clamp(pn, 0, 1))] : null;
    const cl = [[wx - 30 + ((frame * 0.03) % 90), 30, 14, 3], [wx - 8 + ((frame * 0.02) % 90), 42, 18, 3], [wx - 40 + ((frame * 0.015) % 90), 52, 12, 2]];
    for (let y = 14; y <= 92; y++) for (let x = wx - 36; x <= wx + 36; x++) {
      const dx = x - wx, dy = y - 50, inO = y >= 50 ? Math.abs(dx) <= 36 : dx * dx + dy * dy <= 1296; if (!inO) continue;
      const inI = y >= 50 ? (Math.abs(dx) <= 34 && y <= 90) : dx * dx + dy * dy <= 1156; let c;
      if (!inI) c = [58, 34, 24];
      else if (dx === 0 || y === 58 || (y < 50 && Math.abs(dx) === Math.round(Math.abs(dy) * 0.7))) c = [42, 26, 20];
      else {
        c = lerp(top, bot, (y - 14) / 78);
        if (night > 0.3 && hash(x * 7.3 + y * 3.1) > 0.985) c = [230, 230, 255];
        for (const q of cl) if (x >= q[0] && x < q[0] + q[2] && y >= q[1] && y < q[1] + q[3]) c = lerp(c, [255, 255, 255], 0.55 * d + 0.12);
        if (sun && (x - sun[0]) ** 2 + (y - sun[1]) ** 2 <= 30) c = [255, 226, 140];
        if (moon && (x - moon[0]) ** 2 + (y - moon[1]) ** 2 <= 18) c = [235, 235, 250];
        if (y >= 66) { const bx = Math.floor((x - wx + 36) / 7), hh = 10 + Math.floor(hash(bx * 3.7) * 20);
          if (y >= 92 - hh - 4) { c = lerp([60, 62, 84], [16, 16, 32], night * 0.8);
            if ((x - wx + 36) % 7 >= 2 && (y % 5 === 2) && hash(bx * 9 + y) > 0.45 && night > 0.3) c = [255, 208, 120]; } }
      }
      R(x, y, 1, 1, rgb(c));
    }
    if (o.passers !== false && st !== 'still') {                                                // pavement strip + passers-by, then the centre muntin back on top
      R(wx - 33, 88, 67, 3, rgb(lerp([150, 146, 154], [26, 26, 44], night * 0.9)));
      drawPassers(R, wx, hour, frame, night);
      R(wx, 78, 1, 13, '#2a1a14');
    }
    R(wx - 40, 92, 80, 4, '#d2b685'); R(wx - 40, 96, 80, 1, '#8c6c40');                          // sill
    for (const s of [-1, 1]) for (let i = 0; i < 14; i++) { const x = s < 0 ? wx - 50 + i : wx + 37 + i; R(x, 12, 1, 78, (i % 4 < 2) ? '#7a2431' : '#5e1a26'); }
    R(wx - 54, 10, 108, 2, '#b08a3c'); R(wx - 54, 8, 2, 6, '#b08a3c'); R(wx + 52, 8, 2, 6, '#b08a3c');
    const lx = tx; R(lx, 0, 1, 80, '#2a1a14'); R(lx - 8, 80, 17, 3, '#b08a3c'); R(lx - 6, 77, 13, 3, '#caa04a');   // pendant lamp
    if (night > 0.2) { ctx.fillStyle = 'rgba(255,200,110,' + (0.34 * night) + ')'; ctx.beginPath(); ctx.moveTo(lx - 6, 83); ctx.lineTo(lx + 7, 83); ctx.lineTo(lx + 38, 124); ctx.lineTo(lx - 38, 124); ctx.fill();
      ctx.fillStyle = 'rgba(255,214,140,' + (0.16 * night) + ')'; ctx.beginPath(); ctx.moveTo(lx - 3, 83); ctx.lineTo(lx + 4, 83); ctx.lineTo(lx + 20, 112); ctx.lineTo(lx - 19, 112); ctx.fill(); }   // warm cone + brighter core
    R(lx - 3, 83, 7, 1, night > 0.2 ? '#ffe3a0' : '#e8d9a8');
    if (d > 0.15) { ctx.fillStyle = 'rgba(255,236,170,' + (0.10 * d) + ')'; ctx.beginPath(); ctx.moveTo(wx - 34, 92); ctx.lineTo(wx + 34, 92); ctx.lineTo(wx + 86, H); ctx.lineTo(wx - 8, H); ctx.fill(); }
    const px = tx + 46; R(px, 34, 22, 28, '#b08a3c'); R(px + 2, 36, 18, 24, '#d9c9a3'); R(px + 5, 48, 12, 9, '#6f7f6a'); R(px + 8, 41, 6, 6, '#a8543c');   // framed picture
    R(tx - 24, 108, 49, 1, '#efe6d2'); R(tx - 22, 109, 45, 1, '#cfc3aa'); R(tx - 18, 110, 37, 1, '#9b8e78');                                           // marble top
    R(tx - 2, 111, 5, 19, '#3b2218'); R(tx - 9, 130, 19, 2, '#2a1810'); R(tx - 12, 132, 25, 1, '#2a1810');
    R(tx + 2, 106, 9, 2, '#f4efe6');                                                                                                          // saucer
    if (near) { R(tx - 4, 104, 5, 4, '#f4efe6'); R(tx - 4, 104, 5, 1, '#4a2a18'); R(tx + 1, 105, 2, 2, '#f4efe6'); }
    else if (!lift) { R(tx + 4, 102, 5, 4, '#f4efe6'); R(tx + 4, 102, 5, 1, '#4a2a18'); R(tx + 9, 103, 2, 2, '#f4efe6'); }                          // cup
    const sf = (frame >> 2) & 3; if (!lift && !near) R(tx + 5 + (sf & 1), 98 - (sf >> 1), 1, 3, 'rgba(255,255,255,.5)');                                                     // steam (one fixed wisp when still)
    R(tx + 13, 104, 9, 4, '#f1d9a0'); R(tx + 13, 104, 9, 1, '#6a3a22'); R(tx + 13, 106, 9, 1, '#a0522d');                                                // cake
    const bk = bookOf(st, since);                                                                                                               // notebook: open page, or closed cover (+ pen on top)
    if (bk === 0) { R(tx - 16, 105, 12, 3, '#e6dcc4'); R(tx - 16, 105, 12, 1, '#a0432f'); }
    else { R(tx - 16, 105, 12, 3, '#a0432f'); R(tx - 16, 105, 2, 3, '#6e2c1f'); R(tx - 16, 107, 12, 1, '#7d3224'); R(tx - 8, 105, 1, 3, '#3b2218');
      if (bk === 2) { R(tx - 13, 104, 7, 1, '#c0392b'); R(tx - 6, 104, 1, 1, '#14100e'); } }
  }

  // 3x3 'z'
  const zed = (R, x, y, c) => { R(x, y, 5, 1, c); R(x + 3, y + 1, 1, 1, c); R(x + 2, y + 2, 1, 1, c); R(x + 1, y + 3, 1, 1, c); R(x, y + 4, 5, 1, c); };
  const mug = (R, x, y) => { R(x, y, 5, 4, '#f4efe6'); R(x, y, 5, 1, '#4a2a18'); R(x + 5, y + 1, 1, 2, '#f4efe6'); };

  // sleep: chair stays empty; figure lies on the floor in open space right of the chair's front leg, in front of the table base:
  // pillow, head lying on it (hair at the pillow end, face up, closed eye), bag continuing from the shoulders, z's drifting up-left into the gap under the table
  function drawSleeper(R, tx, frame) {
    const bx = tx - 21, br = (frame >> 3) & 1, B = (x, y, w, h, c) => R(x, y + 1, w, h, c);   // B: body one row lower, clear of the table foot
    B(bx - 1, 138, 14, 5, '#efe6d2'); B(bx, 137, 12, 1, '#efe6d2'); B(bx - 1, 142, 14, 1, '#cfc3aa');           // pillow
    B(bx + 1, 134, 5, 4, '#2a1a14'); B(bx + 2, 133, 4, 1, '#2a1a14');                                           // hair at the pillow end
    B(bx + 5, 134, 6, 4, '#e5b894'); B(bx + 6, 133, 4, 1, '#e5b894');                                           // face up, lying flat on the pillow
    B(bx + 7, 135, 3, 1, '#14100e'); B(bx + 8, 137, 2, 1, '#c98f6b');                                           // closed eye line, mouth
    for (let i = 0; i < 31; i++) { const x = bx + 11 + i, t = 134 + (i >> 3) + (i < 12 ? -br : 0), e = i === 30 ? 1 : 0;   // bag: shoulders high, sloping to the feet
      if (e) { B(x, t + 1, 1, 141 - t, '#2f7f86'); continue; }
      B(x, t, 1, 142 - t, '#2f7f86'); B(x, t, 1, 1, '#4aa0a7'); if (i % 8 === 5) B(x, t + 2, 1, 140 - t, '#27696f'); }
    B(bx + 11, 142, 31, 1, '#235f65');                                                                           // shaded underside
    B(bx + 11, 134 - br, 3, 8 + br, '#58aab0');                                                                  // folded collar at the shoulders
    for (let i = 0; i < 2; i++) { const ph = (frame + 20 * i) % 40; if (ph >= 36) continue;               // z's: up and LEFT into the open floor under the table; x >= bx-1 stays clear of the chair seat (ends bx-3), ph<36 keeps y >= 116 (table underside is 111)
      const zx = bx + 6 - Math.floor(ph / 5), zy = 127 - Math.floor(ph / 3), c = 'rgba(244,248,255,' + (ph < 24 ? 1 : 0.55) + ')';
      if (ph < 12) { R(zx, zy + 1, 3, 1, c); R(zx + 1, zy + 2, 1, 1, c); R(zx, zy + 3, 3, 1, c); } else zed(R, zx, zy, c); }   // small z first, grows
  }

  function drawCharacter(ctx, W, hour, frame, o) {
    const st = stateOf(o), since = sinceOf(o); frame = eff(st, frame);
    const tx = o.tx, R = painter(ctx), cx = tx - 33;
    R(cx - 9, 92, 3, 34, '#3b2218'); R(cx - 9, 92, 10, 2, '#3b2218'); R(cx - 9, 121, 19, 3, '#4a2c20'); R(cx - 9, 124, 2, 12, '#2a1810'); R(cx + 8, 124, 2, 12, '#2a1810');   // chair
    if (st === 'sleep') { drawSleeper(R, tx, frame); return; }
    const ps = poseFor(st, frame, since), P = POSES[ps.name], bob = ps.bob, L = P.lean || 0, hx = -L + (P.hx || 0), hy = bob + (P.hy || 0), ey = (P.ey || 0) - (P.back || 0), eye = P.eye || 0;
    const sw = '#2f7f86', sd = '#27696f', sk = '#e5b894', dk = '#14100e', gold = '#b08a3c', h = P.hand, pen = P.pen || 0, dx = ps.dx || 0, X = cx - L;   // X: torso back edge; arms hang from X+5
    const m = L - Math.trunc(L / 2);                                                                           // torso sheared in 3 bands so a lean reads as a slope: shoulders back most, hips stay
    R(X - 4, 99 + bob, 9, 6 - bob, sw); R(X - 4 + m, 105, 9, 7, sw); R(cx - 4, 112, 9, 8, sw); R(X - 4, 99 + bob, 9, 2, '#a0432f'); R(X - 1, 101 + bob, 3, 5, '#a0432f');   // sweater + scarf
    // legs: seated, or (relax) thighs and shins extended forward under the table
    if (P.ext) { R(X - 4, 119, 19, 3, '#3a3550'); R(cx + 12, 121, 5, 3, '#3a3550'); R(cx + 16, 124, 5, 3, '#3a3550'); R(cx + 19, 127, 6, 2, '#1c1410'); }   // thigh forward, shin slopes down to the floor
    else { R(cx - 4, 119, 17, 4, '#3a3550'); R(cx + 10, 119, 3, 8, '#3a3550'); R(cx + 10, 127, 5, 2, '#1c1410'); }
    // head sits directly on the shoulders (no neck strip): skin, hair
    R(X - 1, 98 + bob, 3, 1, sk);                                                                         // 1 px of neck so no gap shows between chin and collar
    const hh = 3 + (P.tilt || 0) - (P.back || 0);
    R(cx - 3 + hx, 89 + hy, 8, 9, sk); R(cx - 4 + hx, 88 + hy, 10, hh, '#2a1a14'); R(cx - 4 + hx, 90 + hy, 2, 6, '#2a1a14');
    if (P.back) R(cx + 5 + hx, 94 + hy, 1, 2, sk);                                                         // chin/nose lifted: head tipped back
    // round glasses: two lenses with a 1 px skin gap, dark bridge on the top row (lower row stays skin) and a gold temple, a glint on each lens
    const gx = cx + eye + hx, gy = 93 + hy + ey;
    if (P.closed) { for (const o2 of [0, 3]) { R(gx + o2, gy, 2, 1, gold); R(gx + o2, gy + 1, 2, 1, dk); R(gx + o2, gy + 2, 2, 1, gold); } }   // shut: lids inside gold lens rims, skin between the lenses
    else { R(gx, gy, 2, 2, dk); R(gx + 3, gy, 2, 2, dk); R(gx, gy, 1, 1, '#5a7088'); R(gx + 3, gy, 1, 1, '#5a7088'); }
    R(gx + 2, gy, 1, 1, dk); R(gx - 1, gy, 1, 1, gold);   // bridge on the top row, temple
    // arms: upper arm hangs from the shoulder (darker edge), forearm leaves the elbow; hand + pen/cup
    const upper = (y, n) => { R(X + 2, y, 4, n, sw); R(X + 2, y, 1, n, sd); };
    if (h === 'chin') { R(cx + 4, 103 + bob, 5, 3, sw); R(cx + 7, 97 + bob, 3, 7, sw); R(cx + 7, 95 + bob, 3, 3, sk); R(cx + 9, 93 + bob, 1, 3, '#c0392b'); }
    else if (h === 'page') { upper(101 + bob, 7); R(X + 4, 107 + bob, 9 + L + dx, 3, sw); R(cx + 12 + dx, 107 + bob + Math.min(0, pen + 1), 5, 3, sw); R(cx + 16 + dx, 106 + bob + pen, 3, 3, sk); R(cx + 18 + dx, 105 + bob + pen, 1, 3, '#c0392b'); R(cx + 18 + dx, 108 + bob + pen, 1, 1, dk); }   // pen tip
    else if (h === 'flat') { upper(101, 7); R(X + 4, 107, 12 + L, 3, sw); R(cx + 16, 106, 3, 3, sk); }                         // hand rests on the notebook
    else if (h === 'reach') { upper(101, 7); R(X + 4, 107, 11, 3, sw); R(cx + 14, 106, 8, 3, sw); R(cx + 21, 105, 6, 3, sw); R(cx + 26, 105, 3, 3, sk); }   // stepped forearm to the slid-over cup
    else if (h === 'carry') { upper(101, 6); R(X + 4, 105, 9 + L, 3, sw); R(cx + 12, 103, 3, 3, sk); mug(R, cx + 11, 99); }                  // cup carried up
    else if (h === 'sip') { upper(101, 6); R(X + 4, 104, 6, 3, sw); R(X + 7, 101, 3, 5, sw); R(X + 7, 98, 3, 3, sk); mug(R, X + 6, 94); }   // forearm folds up, cup at the mouth
    else if (h === 'cross') { R(X - 2 + m, 105, 8, 3, sd); R(X - 2 + m, 105, 8, 1, '#4aa0a7'); R(X + 6 + m, 106, 2, 2, sk); }   // arms folded over the chest, hand tucked
    if (st === 'doze' && ps.name === 'dz2') { const t = ((ps.f - 19) >> 1) * 2; zed(R, cx + 3 + hx, 85 - t, 'rgba(244,248,255,' + (t < 8 ? 1 : 0.55) + ')'); if (t >= 6) zed(R, cx + 9 + hx, 92 - t, 'rgba(244,248,255,.7)'); }   // z spawns just above the head, rises ~10 px
  }

  function drawTint(ctx, W, hour) {
    hour = wrapHour(hour);
    const night = 1 - day(hour);
    ctx.fillStyle = 'rgba(12,18,60,' + (0.36 * night) + ')'; ctx.fillRect(0, 0, W, SH);
    const dusk = smooth(16, 18, hour) * (1 - smooth(19, 20.5, hour)) + smooth(5, 6.5, hour) * (1 - smooth(7, 8.5, hour));
    ctx.fillStyle = 'rgba(255,140,60,' + (0.16 * dusk) + ')'; ctx.fillRect(0, 0, W, SH);
  }
  function draw(ctx, W, hour, frame, o) { drawRoom(ctx, W, hour, frame, o); drawCharacter(ctx, W, hour, frame, o); drawTint(ctx, W, hour); }

  const api = { STATES, passersAt, SH, ART_L, ART_R, POSES, poseFor, hourOf, wrapHour, skyAt, day, drawRoom, drawCharacter, drawTint, draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Kaffeehaus = api;
})(typeof window !== 'undefined' ? window : globalThis);
