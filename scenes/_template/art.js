/* Template scene: a window onto a city, drawn with rectangles on a 2D canvas.
 * Copy this folder to scenes/<your-id>/, rename it in scene.mjs, and draw your own place.
 * Contract (SCENES.md): export draw(ctx, W, hour, frame, o) via module.exports.
 *   ctx   2D canvas context; the room is 144 logical px tall and W px wide (the core scales it).
 *   hour  0 to 24 (local time, or the hour set by hand). frame: ~4 per second while motion is on.
 *   o.wx  x of the window's centre (where the eye goes). o.tx: x of the table / character spot.
 *   o.state, o.since: the character's state ('still' when motion is off). Ignore them if you have no character.
 * Rules: original art only; no network, no storage, no timers of your own, never anything from the chat.
 * The top row of pixels is repeated upward when the pane is taller than 144 px, so keep it plain wall. */
(function () {
  const SH = 144;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  // Sky colour by hour: night, dawn, day, dusk. Smooth enough at four keyframes per side.
  const SKY = [[0, [14, 18, 38]], [5, [14, 18, 38]], [7, [236, 170, 130]], [10, [120, 170, 220]], [16, [120, 170, 220]], [19, [230, 120, 90]], [21, [30, 30, 60]], [24, [14, 18, 38]]];
  function skyAt(h) {
    for (let i = 1; i < SKY.length; i++) if (h <= SKY[i][0]) { const [h0, c0] = SKY[i - 1], [h1, c1] = SKY[i]; return mix(c0, c1, (h - h0) / (h1 - h0)); }
    return SKY[0][1];
  }
  const night = h => (h < 6 || h >= 20.5 ? 1 : h < 7 ? 7 - h : h > 18 ? (h - 18) / 2.5 : 0); // 1 at night, 0 by day
  const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }; // deterministic "random"

  function draw(ctx, W, hour, frame, o) {
    const n = night(hour), wx = o.wx;
    ctx.fillStyle = rgb(mix([86, 80, 92], [34, 32, 44], n)); ctx.fillRect(0, 0, W, SH);             // wall
    const x0 = wx - 34, y0 = 22, w = 68, h = 78;                                                       // window opening
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();                                     // everything outside stays inside the frame
    ctx.fillStyle = rgb(skyAt(hour)); ctx.fillRect(x0, y0, w, h);                                       // sky
    if (n > 0.6) for (let i = 0; i < 18; i++) {                                                         // stars, a slow twinkle
      if (hash(i + Math.floor(frame / 8) * 0.01) < 0.15) continue;
      ctx.fillStyle = `rgba(255,255,240,${(0.4 + 0.6 * hash(i * 3)) * n})`; ctx.fillRect(x0 + Math.floor(hash(i) * w), y0 + Math.floor(hash(i + 50) * h * 0.5), 1, 1);
    }
    for (let i = 0; i < 9; i++) {                                                                       // skyline
      const bw = 6 + Math.floor(hash(i + 9) * 8), bh = 18 + Math.floor(hash(i + 19) * 40), bx = x0 + i * 8 - 2;
      ctx.fillStyle = rgb(mix([70, 84, 104], [30, 32, 52], n)); ctx.fillRect(bx, y0 + h - bh, bw, bh);
      if (n > 0.5) for (let y = y0 + h - bh + 3; y < y0 + h - 2; y += 4) for (let x = bx + 1; x < bx + bw - 1; x += 3)
        if (hash(x * 7 + y) > 0.55) { ctx.fillStyle = 'rgba(255,214,140,.85)'; ctx.fillRect(x, y, 1, 2); }  // lit windows
    }
    ctx.restore();
    ctx.fillStyle = rgb(mix([150, 120, 90], [70, 52, 40], n));                                          // frame and mullions
    ctx.fillRect(x0 - 3, y0 - 3, w + 6, 3); ctx.fillRect(x0 - 3, y0 + h, w + 6, 4); ctx.fillRect(x0 - 3, y0, 3, h); ctx.fillRect(x0 + w, y0, 3, h);
    ctx.fillRect(x0 + w / 2 - 1, y0, 2, h); ctx.fillRect(x0, y0 + 30, w, 2);
    ctx.fillStyle = rgb(mix([120, 92, 70], [48, 36, 30], n)); ctx.fillRect(0, SH - 22, W, 22);          // desk
    ctx.fillStyle = rgb(mix([150, 116, 88], [64, 48, 38], n)); ctx.fillRect(0, SH - 22, W, 2);
    ctx.fillStyle = `rgba(255,200,120,${0.18 * n})`; ctx.fillRect(o.tx - 30, SH - 22, 60, 22);           // lamp glow on the desk at night
  }

  const api = { SH, skyAt, draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
