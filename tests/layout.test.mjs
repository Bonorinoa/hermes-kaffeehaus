import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('layout protects full chat height and fits room cluster in wide and tall Peek', async () => {
  const url = new URL('../src/layout.mjs', import.meta.url);
  assert.ok(fs.existsSync(url), 'layout is implemented');
  const { layout } = await import(url);
  for (const w of [320,390,480,560,899,900,1100,1440]) for (const h of [280,700,1200]) {
    const g = layout({w,h,mode:'window',width:608});
    assert.equal(g.height,h); assert.ok(g.chatWidth<=w-32);
    if (g.wide) {
      assert.ok(g.scale>=3); assert.ok(g.artLeft>=0); assert.ok(g.artRight<g.chatLeft);
    } else assert.equal(g.chatLeft,(w-g.chatWidth)/2);
    const p = layout({w,h,mode:'window',width:608,peek:true});
    assert.ok(p.artLeft>=0); assert.ok(p.artRight<=w);
    assert.ok(p.scale*144<=h);
  }
  const f = layout({w:1440,h:900,mode:'focus',width:780});
  assert.equal(f.chatLeft,330); assert.equal(f.chatWidth,780);
});
test('Window Seat gives up reading width so the room stays beside the text', async () => {
  const { layout } = await import(new URL('../src/layout.mjs', import.meta.url));
  // A large reading width must not silently fall back to the Focus-like overlay.
  const g = layout({w:1200,h:900,mode:'window',width:1000});
  assert.ok(g.wide, 'room shown beside text');
  assert.ok(g.chatWidth>=360 && g.chatWidth<1000, `chat narrowed to ${g.chatWidth}`);
  assert.ok(g.artRight<g.chatLeft);
  // Width preference is kept when it already fits; Focus is unaffected.
  assert.equal(layout({w:1440,h:900,mode:'window',width:560}).chatWidth,560);
  assert.equal(layout({w:1200,h:900,mode:'focus',width:1000}).chatWidth,1000);
  // Only a window too small for room + 360px text uses the overlay.
  assert.equal(layout({w:800,h:900,mode:'window',width:1000}).wide,false);
});
