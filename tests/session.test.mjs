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

// Hermes keeps inactive chats mounted. A hidden one must not look like a split.
function withChats(nodes, fn) {
  const prev = globalThis.document;
  globalThis.document = { querySelectorAll: () => nodes };
  try { return fn(); } finally { globalThis.document = prev; }
}
const shown = () => ({ closest: () => null });
const kept = () => ({ closest: sel => (sel === '[data-pane-hidden]' ? {} : null) });

test('a hidden keep-alive chat does not block the chat on screen', () => {
  const visible = shown(), hidden = kept();
  withChats([hidden, visible], () => {
    let mounted;
    const session = createSession(fakeCtx(), {}, { mount: surface => (mounted = surface, fakeScene()) });
    session.apply({ mode: 'window', width: 780 });
    assert.equal(mounted, visible);
    assert.equal(session.scene.enabled, true);
  });
});

test('two chats on screen stay native, and the refusal is announced', () => {
  const notes = [];
  withChats([shown(), shown()], () => {
    let last, mounted = false;
    const session = createSession(fakeCtx(), { host: { notify: n => notes.push(n) } }, {
      mount: () => { mounted = true; return fakeScene(); },
    });
    session.subscribe(s => (last = s));
    session.apply({});
    assert.equal(mounted, false);
    assert.equal(session.scene, null);
    assert.match(last.reason, /More than one chat is open/);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].message, last.reason);
  });
});

test('the palette opens the chat on screen instead of turning off a hidden scene', () => {
  const first = shown(), next = shown();
  const mounted = surface => ({ enabled: true, surface, update() {}, dispose() {} });
  const session = createSession(fakeCtx(), {}, { mount: mounted });
  withChats([first], () => {
    session.toggle({ mode: 'window' });
    assert.equal(session.scene.surface, first);
    assert.equal(session.live(), true);
    session.toggle({});
    assert.equal(session.scene, null, 'toggle off only when the scene is on the chat you are reading');
    session.toggle({ mode: 'window' });
    assert.equal(session.scene.surface, first);
  });
  first.closest = () => ({}); // that chat is now a hidden keep-alive tab
  withChats([first, next], () => {
    assert.equal(session.live(), false);
    session.toggle({ mode: 'focus' });
    assert.equal(session.scene.surface, next);
    assert.equal(session.live(), true);
  });
});
