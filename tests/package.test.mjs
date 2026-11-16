import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { bundle } from '../build.mjs';

const source = fs.readFileSync(new URL('../desktop/plugin.js', import.meta.url), 'utf8');

test('desktop/plugin.js is up to date with src/ and scenes/ (run `node build.mjs`)', () => {
  assert.equal(source, bundle());
});

test('every src/ module is in the bundle (a missing one only fails inside Hermes)', async () => {
  const { SOURCES } = await import('../build.mjs');
  const all = fs.readdirSync(new URL('../src/', import.meta.url)).filter(f => f.endsWith('.mjs')).map(f => 'src/' + f).sort();
  assert.deepEqual(SOURCES.filter(p => p.startsWith('src/')).sort(), all);
});

test('every shipped scene folder is in the bundle (art and manifest)', async () => {
  const { SOURCES, SCENE_IDS } = await import('../build.mjs');
  assert.ok(SCENE_IDS.length >= 1);
  for (const id of SCENE_IDS) { assert.ok(SOURCES.includes(`scenes/${id}/scene.mjs`), id); assert.ok(source.includes(`${JSON.stringify(id)}:(()=>{`), id); }
});

test('plugin is opt-in, imports only the SDK and React, and has no network or storage calls', () => {
  const imports = [...source.matchAll(/^import .*? from ['"]([^'"]+)['"];$/gm)].map(x => x[1]);
  assert.deepEqual(imports, ['@hermes/plugin-sdk', 'react']);
  let definition; const regs = [];
  const context = { sdk: {}, createElement: () => null, useEffect() {}, useRef() {}, capture: x => definition = x };
  vm.runInNewContext(source.replace(/^import .*;\n/gm, '').replace('export default plugin;', 'capture(plugin);'), context);
  assert.equal(definition.id, 'hermes-kaffeehaus'); assert.equal(definition.defaultEnabled, false);
  definition.register({ register: c => regs.push(c), onDispose() {} });
  assert.deepEqual(regs.map(r => r.area), ['panes', 'palette', 'palette']);
  for (const r of regs.slice(1)) assert.equal(typeof r.data.run, 'function');
  for (const pattern of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /localStorage/, /sessionStorage/, /indexedDB/, /geolocation/, /sendBeacon/, /\beval\s*\(/, /new Function\s*\(/, /\bimport\s*\(/])
    assert.equal(pattern.test(source), false, String(pattern));
});
