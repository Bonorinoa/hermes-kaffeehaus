import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../src/character.mjs';

const T = { lookup: 2, wrapup: 3, rest: 2, dozeAfter: 5, sleepAfter: 4 };
const run = (c, n, input) => { let s; for (let i = 0; i < n; i++) s = c.step(input); return s; };

test('a turn: write while waiting, look up at the first words, write, then close the notebook', () => {
  const c = createCharacter(T);
  assert.equal(run(c, 1, { hour: 15 }).state, 'idle');
  assert.equal(run(c, 3, { busy: true, awaiting: true, hour: 15 }).state, 'busy');
  assert.equal(c.step({ busy: true, awaiting: false, hour: 15 }).state, 'lookup');
  assert.equal(run(c, 2, { busy: true, hour: 15 }).state, 'busy');
  const end = c.step({ busy: false, hour: 15 });
  assert.deepEqual(end, { state: 'wrapup', since: 0 });
  assert.equal(run(c, 4, { hour: 15 }).state, 'wrapup', 'the wrap-up gesture is never cut short');
  assert.equal(run(c, 1, { hour: 15 }).state, 'idle');
});

test('a new send interrupts the wrap-up, a doze or the sleeping bag at once', () => {
  const c = createCharacter(T);
  run(c, 2, { busy: true, hour: 15 }); c.step({ hour: 15 });
  assert.equal(c.step({ busy: true, awaiting: true, hour: 15 }).state, 'busy');
  const n = createCharacter(T);
  run(n, 5, { hour: 2 });
  assert.equal(n.get().state, 'doze');
  assert.equal(run(n, 4, { hour: 2 }).state, 'sleep');
  assert.equal(n.step({ busy: true, awaiting: true, hour: 2 }).state, 'busy');
});

test('dozing only late at night, the sleeping bag only after 01:00, awake by morning', () => {
  const day = createCharacter(T);
  assert.equal(run(day, 50, { hour: 15 }).state, 'idle');
  const eleven = createCharacter(T);
  assert.equal(run(eleven, 50, { hour: 23.5 }).state, 'doze', 'dozes before midnight but no sleeping bag');
  const two = createCharacter(T);
  assert.equal(run(two, 10, { hour: 2 }).state, 'sleep');
  assert.equal(two.step({ hour: 6 }).state, 'idle');
});

test('without motion the figure holds one still pose but keeps its place in the story', () => {
  const c = createCharacter(T);
  assert.deepEqual(c.step({ busy: true, motion: false, hour: 15 }), { state: 'still', since: 0 });
  assert.equal(c.get().state, 'busy');
  assert.equal(c.step({ busy: true, hour: 15 }).state, 'busy');
});
