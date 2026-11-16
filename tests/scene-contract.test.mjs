import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { SCENES, PALETTE_KEYS } from '../src/scenes.mjs';
import { LOOK_RANGES, MODES } from '../src/controller.mjs';
import { EMITTED_STATES } from '../src/character.mjs';
import { bundle } from '../build.mjs';

// The contract every scene meets (SCENES.md). The template is checked too, so the docs stay honest.
const require = createRequire(import.meta.url);
const dirs = fs.readdirSync(new URL('../scenes/', import.meta.url)).filter(d => !d.startsWith('.'));
const fakeCtx = () => new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : typeof k === 'string' && /^[a-z]/.test(k) ? () => {} : undefined), set: (t, k, v) => { t[k] = v; return true; } });
const nonEmpty = s => typeof s === 'string' && s.trim().length > 0;
const loadManifest = async id => Object.values(await import(`../scenes/${id}/scene.mjs`))[0];

for (const id of dirs) {
  test(`scene ${id}: manifest has everything the core needs`, async () => {
    const m = await loadManifest(id);
    assert.equal(m.id, id === '_template' ? m.id : id); assert.match(m.id, /^[a-z][a-z0-9-]*$/);
    for (const k of ['name', 'icon', 'tagline', 'open']) assert.ok(nonEmpty(m[k]), k);
    const c = m.card;
    for (const k of ['title', 'sub', 'board', 'follow', 'reset', 'peek', 'classicNote']) assert.ok(nonEmpty(c[k]), 'card.' + k);
    assert.deepEqual(Object.keys(c.seats).sort(), [...MODES].sort());
    assert.equal(c.sections.length, 5); assert.equal(c.width.length, 2); assert.equal(c.motion.length, 2);
    assert.deepEqual(Object.keys(c.looks).sort(), Object.keys(LOOK_RANGES).sort());
    assert.ok(m.blends.length >= 1);
    for (const b of m.blends) {
      assert.ok(nonEmpty(b.name) && nonEmpty(b.note));
      for (const seat of ['focus', 'window']) for (const [k, [lo, hi]] of Object.entries(LOOK_RANGES)) assert.ok(b[seat][k] >= lo && b[seat][k] <= hi, `${b.name}.${seat}.${k}`);
    }
    for (const [k, v] of Object.entries(m.palette)) { assert.ok(PALETTE_KEYS.includes(k), k); assert.match(v, /^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i, k); }
    if (m.classic) { for (const k of Object.keys(m.classic)) assert.ok(['ground', 'font'].includes(k), 'classic.' + k); for (const v of Object.values(m.classic)) assert.ok(nonEmpty(v) && !/url\(/i.test(v), 'classic values are CSS without url()'); }
  });
  test(`scene ${id}: art draws every hour and state without throwing`, async () => {
    const m = await loadManifest(id), art = require(`../scenes/${id}/art.js`);
    assert.equal(typeof art.draw, 'function');
    // A character scene must draw every state the core can send (src/character.mjs), and export poseFor.
    const states = m.character ? EMITTED_STATES : ['still'];
    if (m.character) { assert.equal(typeof art.poseFor, 'function'); for (const st of EMITTED_STATES) assert.ok(art.STATES.includes(st), 'STATES has ' + st); }
    for (const hour of [0, 3, 6, 9, 12, 15, 18, 21, 23.75]) for (const state of states)
      art.draw(fakeCtx(), 640, hour, 17, { wx: 120, tx: 360, state, since: 3 });
  });
}

test('the shipped scenes are the folders that do not start with _, and the template is not bundled', async () => {
  assert.deepEqual(SCENES.map(s => s.id).sort(), dirs.filter(d => !d.startsWith('_')).sort());
  const t = await loadManifest('_template');
  assert.equal(bundle().includes(`id: '${t.id}'`), false);
});
