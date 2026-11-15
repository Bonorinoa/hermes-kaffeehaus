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
 *   o = { wx, tx, state }  wx window centre x, tx table centre x (logical px);
 *                          state 'busy' | 'idle' | 'still'
 *   hour: local civil time as a float 0..24. Illustrative sky, NOT astronomical sunrise.
 *
 * State meaning (art only): busy = writing; idle = resting, with a slow glance/think; still = one
 * fixed frame for reduced motion/off. None of these says anything about success or failure of a task.
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

  /* ---- character poses: data, not code. Offsets are logical px relative to the writing pose. ----
   * pen: pen-hand nudge in y (rest lifts the pen 1 px off the page, write-b presses down 1 px). eye: pupil shift in x (-1 = toward the window).
   * hand: 'page' (pen on notebook) or 'chin' (pen raised, forearm up). Torso bob comes from poseFor. */
  const POSES = {
    'write-a': { pen: 0, eye: 0, hand: 'page' },
    'write-b': { pen: 1, eye: 0, hand: 'page' },
    'rest':    { pen: -1, eye: 0, hand: 'page' },
    'glance':  { pen: 0, eye: -1, hand: 'page' },
    'think':   { pen: 0, eye: 0, hand: 'chin' }
  };
  /* Pose picker. busy: pen alternates every 2 frames, slow torso bob. idle: 20 s cycle (80 frames at 4/s):
   * rest, glance to the window, rest, think, rest; 4 s breathing bob. still: fixed 'rest'. */
  function poseFor(state, frame) {
    if (state === 'still') return { name: 'rest', bob: 0 };
    if (state === 'busy') { const p = (frame >> 1) & 1; return { name: p ? 'write-b' : 'write-a', bob: (frame >> 3) & 1 }; }
    const f = ((frame % 80) + 80) % 80;
    const name = f < 32 ? 'rest' : f < 44 ? 'glance' : f < 60 ? 'rest' : f < 72 ? 'think' : 'rest';
    return { name: name, bob: (frame >> 4) & 1 };
  }

  const painter = ctx => (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const eff = (state, frame) => (state === 'still' ? 0 : frame);

  function drawRoom(ctx, W, hour, frame, o) {
    frame = eff(o.state, frame); hour = wrapHour(hour);
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
    R(wx - 40, 92, 80, 4, '#d2b685'); R(wx - 40, 96, 80, 1, '#8c6c40');                          // sill
    for (const s of [-1, 1]) for (let i = 0; i < 14; i++) { const x = s < 0 ? wx - 50 + i : wx + 37 + i; R(x, 12, 1, 78, (i % 4 < 2) ? '#7a2431' : '#5e1a26'); }
    R(wx - 54, 10, 108, 2, '#b08a3c'); R(wx - 54, 8, 2, 6, '#b08a3c'); R(wx + 52, 8, 2, 6, '#b08a3c');
    const lx = tx; R(lx, 0, 1, 80, '#2a1a14'); R(lx - 8, 80, 17, 3, '#b08a3c'); R(lx - 6, 77, 13, 3, '#caa04a');   // pendant lamp
    if (night > 0.2) { ctx.fillStyle = 'rgba(255,200,110,' + (0.22 * night) + ')'; ctx.beginPath(); ctx.moveTo(lx - 6, 83); ctx.lineTo(lx + 7, 83); ctx.lineTo(lx + 34, 118); ctx.lineTo(lx - 33, 118); ctx.fill(); }
    R(lx - 3, 83, 7, 1, night > 0.2 ? '#ffe3a0' : '#e8d9a8');
    if (d > 0.15) { ctx.fillStyle = 'rgba(255,236,170,' + (0.10 * d) + ')'; ctx.beginPath(); ctx.moveTo(wx - 34, 92); ctx.lineTo(wx + 34, 92); ctx.lineTo(wx + 86, H); ctx.lineTo(wx - 8, H); ctx.fill(); }
    const px = tx + 46; R(px, 34, 22, 28, '#b08a3c'); R(px + 2, 36, 18, 24, '#d9c9a3'); R(px + 5, 48, 12, 9, '#6f7f6a'); R(px + 8, 41, 6, 6, '#a8543c');   // framed picture
    R(tx - 24, 108, 49, 1, '#efe6d2'); R(tx - 22, 109, 45, 1, '#cfc3aa'); R(tx - 18, 110, 37, 1, '#9b8e78');                                           // marble top
    R(tx - 2, 111, 5, 19, '#3b2218'); R(tx - 9, 130, 19, 2, '#2a1810'); R(tx - 12, 132, 25, 1, '#2a1810');
    R(tx + 2, 106, 9, 2, '#f4efe6'); R(tx + 4, 102, 5, 4, '#f4efe6'); R(tx + 4, 102, 5, 1, '#4a2a18'); R(tx + 9, 103, 2, 2, '#f4efe6');                // cup + saucer
    const st = (frame >> 2) & 3; R(tx + 5 + (st & 1), 98 - (st >> 1), 1, 3, 'rgba(255,255,255,.5)');                                                     // steam (one fixed wisp when still)
    R(tx + 13, 104, 9, 4, '#f1d9a0'); R(tx + 13, 104, 9, 1, '#6a3a22'); R(tx + 13, 106, 9, 1, '#a0522d');                                                // cake
    R(tx - 16, 105, 12, 3, '#e6dcc4'); R(tx - 16, 105, 12, 1, '#a0432f');                                                                                // notebook
  }

  function drawCharacter(ctx, W, hour, frame, o) {
    frame = eff(o.state, frame);
    const tx = o.tx, R = painter(ctx), ps = poseFor(o.state || 'busy', frame), P = POSES[ps.name], bob = ps.bob, cx = tx - 33;
    R(cx - 9, 92, 3, 34, '#3b2218'); R(cx - 9, 92, 10, 2, '#3b2218'); R(cx - 9, 121, 19, 3, '#4a2c20'); R(cx - 9, 124, 2, 12, '#2a1810'); R(cx + 8, 124, 2, 12, '#2a1810');   // chair
    R(cx - 4, 99 + bob, 9, 21 - bob, '#2f7f86'); R(cx - 4, 99 + bob, 9, 2, '#a0432f'); R(cx - 1, 101 + bob, 3, 5, '#a0432f');                                            // sweater + scarf
    R(cx - 3, 89 + bob, 8, 9, '#e5b894'); R(cx - 4, 88 + bob, 10, 3, '#2a1a14'); R(cx - 4, 90 + bob, 2, 6, '#2a1a14');                                                    // head + hair
    R(cx + P.eye, 93 + bob, 2, 2, '#14100e'); R(cx + 3 + P.eye, 93 + bob, 2, 2, '#14100e'); R(cx + 2 + P.eye, 94 + bob, 1, 1, '#14100e');                                // round glasses
    R(cx - 4, 119, 17, 4, '#3a3550'); R(cx + 10, 119, 3, 8, '#3a3550'); R(cx + 10, 127, 5, 2, '#1c1410');                                                                // legs
    if (P.hand === 'chin') { R(cx + 4, 103 + bob, 5, 3, '#2f7f86'); R(cx + 7, 97 + bob, 3, 7, '#2f7f86'); R(cx + 7, 95 + bob, 3, 3, '#e5b894'); R(cx + 9, 93 + bob, 1, 3, '#c0392b'); }
    else { R(cx + 4, 107 + bob, 13, 3, '#2f7f86'); R(cx + 16, 106 + bob + P.pen, 3, 3, '#e5b894'); R(cx + 18, 105 + bob + P.pen, 1, 3, '#c0392b'); }                     // arm, hand, pen
  }

  function drawTint(ctx, W, hour) {
    hour = wrapHour(hour);
    const night = 1 - day(hour);
    ctx.fillStyle = 'rgba(12,18,60,' + (0.5 * night) + ')'; ctx.fillRect(0, 0, W, SH);
    const dusk = smooth(16, 18, hour) * (1 - smooth(19, 20.5, hour)) + smooth(5, 6.5, hour) * (1 - smooth(7, 8.5, hour));
    ctx.fillStyle = 'rgba(255,140,60,' + (0.16 * dusk) + ')'; ctx.fillRect(0, 0, W, SH);
  }
  function draw(ctx, W, hour, frame, o) { drawRoom(ctx, W, hour, frame, o); drawCharacter(ctx, W, hour, frame, o); drawTint(ctx, W, hour); }

  const api = { SH, ART_L, ART_R, POSES, poseFor, hourOf, wrapHour, skyAt, day, drawRoom, drawCharacter, drawTint, draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Kaffeehaus = api;
})(typeof window !== 'undefined' ? window : globalThis);
