import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const K = createRequire(import.meta.url)('../art/kaffeehaus.js');

const W = 180, O = { wx: 48, tx: 112 };
function rec() {
  const calls = []; let fs = '';
  const ctx = { set fillStyle(v) { fs = v; }, get fillStyle() { return fs; }, fillRect: (...a) => calls.push([...a, fs].join(',')),
    beginPath() {}, moveTo() {}, lineTo() {}, fill() {}, save() {}, restore() {}, drawImage() {} };
  return { ctx, calls };
}
const opts = (state, since = 0, extra = {}) => ({ ...O, state, since, ...extra });
const char = (state, hour, frame, since = frame, extra) => { const r = rec(); K.drawCharacter(r.ctx, W, hour, frame, opts(state, since, extra)); return r.calls; };
const room = (state, hour, frame, since = frame, extra) => { const r = rec(); K.drawRoom(r.ctx, W, hour, frame, opts(state, since, extra)); return r.calls; };
const parse = c => { const a = c.split(','); return [a[0], a[1], a[2], a[3], a.slice(4).join(',')]; };   // fillStyle may itself contain commas (rgba)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

test('every state x hour draws without throwing', () => {
  for (const s of K.STATES) for (const h of [3, 15, 23]) for (const f of [0, 5, 17, 40, 99]) {
    const r = rec(); assert.doesNotThrow(() => K.draw(r.ctx, W, h, f, opts(s, f)));
    assert.ok(r.calls.length > 100);
  }
});

test('each of the 7 states has a distinct character drawing at 23:00', () => {
  assert.equal(K.STATES.length, 7);
  for (const a of K.STATES) for (const b of K.STATES) if (a < b) {
    let differs = false;
    for (let f = 0; f < 80 && !differs; f++) differs = !same(char(a, 23, f), char(b, 23, f));
    assert.ok(differs, a + ' vs ' + b);
  }
});

test('still is identical across frames', () => {
  const base = char('still', 23, 0);
  for (const f of [1, 7, 33, 200]) assert.ok(same(base, char('still', 23, f, f)));
  assert.ok(same(room('still', 13, 0), room('still', 13, 90)));
});

test('wrapup holds its final pose from since>=16', () => {
  const base = char('wrapup', 23, 100, 16);
  for (const f of [101, 107, 140]) assert.ok(same(base, char('wrapup', 23, f, 16 + (f - 100))));
  assert.ok(!same(char('wrapup', 23, 8, 0), char('wrapup', 23, 8, 8)));
  assert.ok(!same(char('wrapup', 23, 8, 8), base));
});

test('wrapup lifts the cup off the saucer and closes the notebook', () => {
  const cup = '106,102,5,4,#f4efe6'.replace('106', String(O.tx + 4)); // cup body
  const has = c => c.includes(cup);
  assert.ok(has(room('wrapup', 23, 0, 0)));
  assert.ok(!has(room('wrapup', 23, 8, 8)));
  assert.ok(has(room('wrapup', 23, 20, 20)));
  assert.ok(!same(room('wrapup', 23, 20, 0).filter(c => c.includes('#e6dcc4')), room('wrapup', 23, 20, 20).filter(c => c.includes('#e6dcc4'))));
});

test('sleep: empty chair, figure on the floor', () => {
  const cx = O.tx - 33, body = ['#2f7f86', '#e5b894', '#2a1a14', '#14100e', '#a0432f', '#3a3550', '#c0392b'];
  const rects = char('sleep', 23, 10).map(c => c.split(','));
  const onChair = rects.filter(([x, y, w, h, c]) => body.includes(c) && +x < cx + 22 && +x + +w > cx - 9 && +y < 125 && +y + +h > 88);
  assert.deepEqual(onChair, []);
  const teal = ['#2f7f86', '#4aa0a7', '#235f65', '#58aab0'];
  const floor = rects.filter(([x, y, w, h, c]) => teal.includes(c) && +y >= 102 && +y + +h <= 144);
  assert.ok(floor.length > 0 && floor.some(r => +r[2] >= 30), 'bag at least 30 px wide');
  const top = Math.min(...floor.map(r => +r[1])), bot = Math.max(...floor.map(r => +r[1] + +r[3]));
  assert.ok(bot - top >= 8, 'bag at least 8 px tall');
  assert.ok(!same(char('sleep', 23, 0), char('sleep', 23, 8)), 'breathing/z move');
});

test('doze changes slowly', () => {
  const sigs = []; for (let f = 0; f < 40; f++) sigs.push(JSON.stringify(char('doze', 23, f)));
  const changes = sigs.filter((s, i) => i && s !== sigs[i - 1]).length;
  assert.ok(changes >= 3 && changes <= 14, 'changes: ' + changes);
});

test('passers-by: none at 03:00, some at 13:00, never more than 2', () => {
  for (let f = 0; f <= 400; f++) assert.equal(K.passersAt(3, f).length, 0);
  let seen = 0, max = 0;
  for (let f = 0; f < 2000; f++) { const n = K.passersAt(13, f).length; seen += n; max = Math.max(max, n); }
  assert.ok(seen > 0 && max <= 2 && max >= 1);
  for (const h of [0.5, 6, 20, 23.5]) for (let f = 0; f < 2000; f++) assert.ok(K.passersAt(h, f).length <= 2);
  let nightSeen = 0; for (let f = 0; f < 4000; f++) nightSeen += K.passersAt(22, f).length;
  assert.ok(nightSeen > 0);
});

test('passers can be disabled and are absent in still', () => {
  let f = 0; while (!K.passersAt(13, f).length) f++;
  assert.ok(!same(room('idle', 13, f), room('idle', 13, f, 0, { passers: false })));
  assert.ok(same(room('idle', 13, f, 0, { passers: false }), room('idle', 13, f, 0, { passers: false })));
});

test('unknown state behaves like idle', () => {
  for (const f of [0, 20, 40, 70]) { assert.ok(same(char('banana', 23, f), char('idle', 23, f))); assert.ok(same(room('banana', 23, f), room('idle', 23, f))); }
});

test('poseFor keeps working for the original states', () => {
  assert.deepEqual(K.poseFor('still', 9), { name: 'rest', bob: 0 });
  assert.equal(K.poseFor('busy', 0).name, 'write-a');
  assert.equal(K.poseFor('busy', 2).name, 'write-b');
  assert.equal(K.poseFor('idle', 36).name, 'glance');
});

test('busy differs from idle in any single frame, and the writing hand travels', () => {
  for (const f of [0, 1, 2, 3, 4, 5, 6, 7, 40]) assert.ok(!same(char('busy', 23, f), char('idle', 23, f)), 'frame ' + f);
  const dxs = new Set(); for (let f = 0; f < 8; f++) dxs.add(K.poseFor('busy', f).dx);
  assert.ok(Math.max(...dxs) - Math.min(...dxs) >= 2 && Math.max(...dxs) - Math.min(...dxs) <= 4);
});

test('lookup keeps the head on the shoulders (no skin neck column above the collar)', () => {
  for (const since of [0, 1, 2, 9]) {
    const rects = char('lookup', 15, since, since).map(parse);
    const neck = rects.filter(([x, y, w, h, c]) => c === '#e5b894' && +w <= 3 && +h > 2 && +y < 98);
    assert.deepEqual(neck, []);
  }
});

test('wrapup relaxed hold has no skin or sweater block floating above the head', () => {
  const rects = char('wrapup', 23, 40, 40).map(parse), headTop = Math.min(...rects.filter(r => r[4] === '#2a1a14').map(r => +r[1]));
  assert.deepEqual(rects.filter(([x, y, w, h, c]) => (c === '#2f7f86' || c === '#e5b894') && +y + +h <= headTop), []);
});

test('sleep: z never enters the table rect, stays clear of the chair, bag clear of the chair leg', () => {
  const tx = O.tx, cx = tx - 33;
  let seen = 0;
  for (let f = 0; f < 160; f++) {
    const rects = char('sleep', 23, f).map(parse);
    for (const [x, y, w, h, c] of rects) {
      if (!c.startsWith('rgba(244,248,255')) continue; seen++;
      assert.ok(+y >= 112, 'z y ' + y + ' f' + f);                                                       // table top 108-110, underside 111
      assert.ok(!(+x < cx + 10 && +x + +w > cx - 9 && +y + +h > 121 && +y < 125), 'z on chair seat f' + f);
    }
    for (const [x, y, w, h, c] of rects) if (['#2f7f86', '#efe6d2', '#e5b894'].includes(c)) assert.ok(+x > cx + 9, 'figure overlaps chair leg');
  }
  assert.ok(seen > 0, 'z drawn');
});

test('doze z spawns just above the head and rises 10-14 px', () => {
  const zs = [];
  for (let f = 19; f < 31; f++) { const r = char('doze', 23, f).map(parse).filter(r => r[4].startsWith('rgba(244,248,255')); if (r.length) zs.push(Math.min(...r.map(q => +q[1]))); }
  assert.ok(zs.length > 0 && Math.min(...zs) >= 72 && Math.max(...zs) <= 88 && Math.max(...zs) - Math.min(...zs) >= 10 && Math.max(...zs) - Math.min(...zs) <= 14);
});

test('night passers-by are lighter than the skyline behind them', () => {
  let f = 0; while (!K.passersAt(22, f).length || K.passersAt(22, f)[0].u < 0.3 || K.passersAt(22, f)[0].u > 0.7) f++;
  const off = new Set(room('idle', 22, f, 0, { passers: false })), body = room('idle', 22, f).filter(c => !off.has(c) && /rgb\(/.test(c));
  assert.ok(body.length > 0);
  const lum = c => c.match(/rgb\((\d+),(\d+),(\d+)\)/).slice(1).map(Number).reduce((a, b) => a + b);
  const big = body.filter(c => +c.split(',')[2] >= 2 && +c.split(',')[3] >= 4);   // coat/legs, not the 1 px lamp edge
  assert.ok(big.length > 0);
  assert.ok(big.some(c => lum(c) >= 260), 'at least one clearly lamplit body rect: ' + big.join(' | '));
});
