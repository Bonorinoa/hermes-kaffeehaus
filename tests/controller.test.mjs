import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = new URL('../src/controller.mjs', import.meta.url);
test('manual midnight persists across resume; Follow samples current clock', async () => {
  const { createController } = await import(source);
  let date = new Date(2026, 10, 14, 12), tick;
  const c = createController({ now: () => date, every(fn) { tick = fn; return () => {}; }, draw() {} });
  assert.equal(typeof c.update, 'function');
  c.update({ overrideHour: 0 }); date = new Date(2026, 11, 3, 16, 30); tick(); c.resume();
  assert.deepEqual(c.state().clock, {mode: 'manual', hour: 0});
  c.update({overrideHour: null}); assert.equal(c.state().clock.hour, 16.5);
  assert.throws(() => c.update({overrideHour: NaN}), TypeError);
  assert.equal(c.state().clock.hour, 16.5); c.dispose();
});
test('manual controls are validated; OS reduced motion cannot be overridden', async () => {
  const { createController } = await import(source);
  const c = createController({now: () => new Date(),every: () => () => {},draw() {}});
  assert.equal(c.state().mode,'focus');
  c.update({mode:'window', width:600, motionRequested:true});
  assert.equal(c.state().motion,true); assert.equal(c.state().width,600);
  c.update({reduced:true}); assert.equal(c.state().motion,false);
  c.update({motionRequested:true}); assert.equal(c.state().motion,false);
  c.update({reduced:false}); assert.equal(c.state().motion,true);
  assert.throws(() => c.update({mode:'magic'}),TypeError);
  assert.throws(() => c.update({width:Infinity}),TypeError);
  assert.throws(() => c.update({width:12}),RangeError);
  c.dispose();
});
test('automatic clock samples independently of decorative motion and disposes once', async () => {
  assert.ok(fs.existsSync(source), 'clock controller is implemented');
  const { createController } = await import(source);
  let date = new Date(2026, 10, 14, 23, 59, 59), tick, clears = 0;
  const states = [], draws = [];
  const c = createController({now: () => date,
    every(fn, ms) { assert.equal(ms, 1000); tick = fn; return () => clears++; },
    draw: s => draws.push(s), onState: s => states.push(s)});
  assert.equal(c.state().clock.mode, 'auto');
  assert.equal(c.state().motion, false);
  date = new Date(2026, 10, 15, 0, 0, 1); tick();
  assert.ok(c.state().clock.hour < .001);
  assert.equal(draws.length, 2);
  c.dispose(); c.dispose(); tick();
  assert.equal(clears, 1); assert.equal(draws.length, 2);
});
