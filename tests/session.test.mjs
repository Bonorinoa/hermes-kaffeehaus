import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../src/controls.mjs';

// A minimal stand-in for the one DOM call the session makes.
globalThis.document = { querySelectorAll: () => [{}] };

function fakeScene() {
  const s = { enabled: true, disposed: 0, patches: [], update(p) { s.patches.push(p); }, dispose() { s.disposed++; }, state: () => ({}) };
  return s;
}
function fakeCtx() {
  const onDispose = [];
  return { onDispose: fn => onDispose.push(fn), unload: () => onDispose.forEach(fn => fn()) };
}

test('the scene belongs to the plugin session, not to the sidebar tab', () => {
  const ctx = fakeCtx(); let scene;
  const session = createSession(ctx, {}, { mount: () => (scene = fakeScene()) });
  const seen = [];
  const unsubscribe = session.subscribe(s => seen.push(s));
  session.apply({ mode: 'window', width: 780 });
  assert.equal(session.scene, scene);
  assert.deepEqual(scene.patches, [{ mode: 'window', width: 780 }]);
  unsubscribe(); // what closing the tab does
  assert.equal(scene.disposed, 0, 'closing the tab must not switch the scene off');
  session.update({ mode: 'focus' });
  assert.deepEqual(scene.patches.at(-1), { mode: 'focus' });
  session.off();
  assert.equal(scene.disposed, 1); assert.equal(session.scene, null);
  assert.equal(seen.length, 1, 'an unsubscribed view gets no further reports');
});

test('plugin unload disposes the scene; a refused Apply leaves nothing mounted', () => {
  const ctx = fakeCtx(); let scene;
  const session = createSession(ctx, {}, { mount: () => (scene = fakeScene()) });
  session.apply({});
  ctx.unload();
  assert.equal(scene.disposed, 1);
  const refused = createSession(fakeCtx(), {}, { mount: () => ({ enabled: false, reason: 'light theme', dispose() {} }) });
  let last; refused.subscribe(s => (last = s));
  refused.apply({});
  assert.equal(refused.scene, null);
  assert.equal(last.disabled, true); assert.match(last.reason, /light theme/);
});
