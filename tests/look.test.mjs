import test from 'node:test';
import assert from 'node:assert/strict';
import { createController, DEFAULT_LOOKS } from '../src/controller.mjs';

const make = () => createController({ now: () => new Date(2026, 10, 14, 20, 30), every: () => () => {}, draw: () => {} });

test('looks default to the reviewed values, one per mode', () => {
  const c = make();
  assert.deepEqual(c.state().looks, { focus: { ...DEFAULT_LOOKS.focus }, window: { ...DEFAULT_LOOKS.window } });
});

test('look patches only the active mode', () => {
  const c = make();
  c.update({ look: { blur: 3, veil: 60 } });
  assert.equal(c.state().looks.focus.blur, 3);
  assert.equal(c.state().looks.focus.veil, 60);
  assert.deepEqual(c.state().looks.window, { ...DEFAULT_LOOKS.window });
  c.update({ mode: 'window', look: { glass: 12 } });
  assert.equal(c.state().looks.window.glass, 12);
  assert.equal(c.state().looks.focus.glass, DEFAULT_LOOKS.focus.glass);
});

test('looks replace both modes (re-Apply keeps the user values)', () => {
  const c = make();
  const looks = { focus: { blur: 4, brightness: 80, veil: 70, glass: 6 }, window: { blur: 2, brightness: 90, veil: 80, glass: 8 } };
  c.update({ looks });
  assert.deepEqual(c.state().looks, looks);
  looks.focus.blur = 20; // caller mutation must not leak into state
  assert.equal(c.state().looks.focus.blur, 4);
});

test('out-of-range or non-finite looks are rejected and leave state unchanged', () => {
  const c = make();
  assert.throws(() => c.update({ look: { blur: 99 } }), RangeError);
  assert.throws(() => c.update({ look: { brightness: 5 } }), RangeError);
  assert.throws(() => c.update({ look: { veil: NaN } }), TypeError);
  assert.equal(c.state().looks.focus.blur, DEFAULT_LOOKS.focus.blur);
});
