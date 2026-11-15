import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';

const moduleUrl = new URL('../src/scene-time.mjs', import.meta.url).href;

// Keep the first RED an assertion about the missing feature, not a loader error.
const implementation = await import('../src/scene-time.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const { sampleSceneTime } = implementation;

test('automatic scene samples the injected local civil clock', () => {
  assert.equal(typeof sampleSceneTime, 'function', 'sampleSceneTime must exist');
  const date = new Date(2026, 10, 14, 14, 5);
  assert.deepEqual(sampleSceneTime({ now: () => date }), {
    mode: 'auto', hour: 14 + 5 / 60,
  });
});

test('sub-minute time is retained for continuous scene evolution', () => {
  const date = new Date(2026, 10, 14, 14, 5, 30, 250);
  assert.equal(sampleSceneTime({ now: () => date }).hour,
    14 + 5 / 60 + 30 / 3600 + 250 / 3_600_000);
});

test('manual override pins the scene without consulting the machine clock', () => {
  const now = () => { throw new Error('manual mode must not read the clock'); };
  assert.deepEqual(sampleSceneTime({ now, overrideHour: 23.5 }), {
    mode: 'manual', hour: 23.5,
  });
  assert.deepEqual(sampleSceneTime({ now, overrideHour: 0 }), {
    mode: 'manual', hour: 0,
  });
});

test('finite manual hours wrap onto the 24-hour scene cycle', () => {
  const now = () => { throw new Error('unexpected clock read'); };
  for (const [input, expected] of [[24, 0], [-1, 23], [49.5, 1.5], [-24, 0]]) {
    assert.equal(sampleSceneTime({ now, overrideHour: input }).hour, expected);
  }
});

test('invalid manual input is rejected rather than producing a broken scene', () => {
  for (const overrideHour of [NaN, Infinity, -Infinity, '12', false, {}, 12n]) {
    assert.throws(() => sampleSceneTime({ overrideHour }), {
      name: 'TypeError', message: 'overrideHour must be a finite number or null',
    });
  }
});

test('automatic mode rejects an invalid Date rather than leaking NaN', () => {
  assert.throws(() => sampleSceneTime({ now: () => new Date(NaN) }), {
    name: 'TypeError', message: 'now() must return a valid Date',
  });
});

test('midnight advances by one millisecond on the cyclic scene-hour domain', () => {
  let date = new Date(2026, 10, 14, 23, 59, 59, 999);
  const now = () => date;
  const before = sampleSceneTime({ now }).hour;
  date = new Date(2026, 10, 15, 0, 0, 0, 0);
  const after = sampleSceneTime({ now }).hour;
  assert.equal(after, 0);
  assert.ok(Math.abs((after - before + 24) % 24 - 1 / 3_600_000) < 1e-12);
  // Periodic scene inputs do not jump at the 24→0 numeric wrap.
  assert.ok(Math.abs(Math.cos(before * Math.PI / 12)
    - Math.cos(after * Math.PI / 12)) < 1e-12);
});

test('wake samples current time immediately, with no elapsed-tick catch-up', () => {
  let date = new Date(2026, 10, 14, 22, 30);
  let reads = 0;
  const now = () => { reads += 1; return date; };
  assert.equal(sampleSceneTime({ now }).hour, 22.5);
  // No intervening samples during a multi-day sleep.
  date = new Date(2026, 10, 17, 8, 15);
  assert.equal(sampleSceneTime({ now }).hour, 8.25);
  assert.equal(reads, 2);
});

test('backward clock correction follows the new local clock rather than elapsed time', () => {
  let date = new Date(2026, 10, 14, 14, 5);
  const now = () => date;
  assert.ok(sampleSceneTime({ now }).hour > 14);
  date = new Date(2026, 10, 14, 9, 30);
  assert.equal(sampleSceneTime({ now }).hour, 9.5);
});

test('manual override survives wake until null explicitly resumes current machine time', () => {
  let date = new Date(2026, 10, 14, 14, 5);
  const now = () => date;
  assert.equal(sampleSceneTime({ now, overrideHour: 23 }).hour, 23);
  date = new Date(2026, 10, 17, 8, 15);
  assert.equal(sampleSceneTime({ now, overrideHour: 23 }).hour, 23);
  assert.deepEqual(sampleSceneTime({ now, overrideHour: null }), {
    mode: 'auto', hour: 8.25,
  });
});

test('a sample is fresh and does not mutate the injected Date or caller options', () => {
  const date = new Date(2026, 10, 14, 14, 5);
  const timestamp = date.getTime();
  const options = Object.freeze({ now: () => date });
  const first = sampleSceneTime(options);
  first.hour = 0;
  assert.equal(sampleSceneTime(options).hour, 14 + 5 / 60);
  assert.equal(date.getTime(), timestamp);
});

// TZ only changes isolated child processes, never OS/app/profile settings.
function inZone(zone, body) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { sampleSceneTime } from ${JSON.stringify(moduleUrl)};
    ${body}
  `], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('local scene time is not UTC: Phoenix, Berlin and Tokyo at the same instant', () => {
  for (const [zone, hour] of [
    ['America/Phoenix', 5], ['Europe/Berlin', 13], ['Asia/Tokyo', 21],
  ]) {
    inZone(zone, `assert.equal(sampleSceneTime({
      now: () => new Date('2026-11-14T12:00:00Z'),
    }).hour, ${hour});`);
  }
});

test('DST spring-forward follows the missing civil hour, not a 24-hour epoch modulus', () => {
  inZone('America/New_York', `
    let date = new Date('2026-03-08T06:59:59Z');
    const now = () => date;
    assert.equal(sampleSceneTime({ now }).hour, 1 + 59 / 60 + 59 / 3600);
    date = new Date('2026-03-08T07:00:00Z');
    assert.equal(sampleSceneTime({ now }).hour, 3);
  `);
});

test('DST fall-back repeats the civil hour rather than forcing monotonic scene time', () => {
  inZone('America/New_York', `
    let date = new Date('2026-11-01T05:59:59Z');
    const now = () => date;
    assert.equal(sampleSceneTime({ now }).hour, 1 + 59 / 60 + 59 / 3600);
    date = new Date('2026-11-01T06:00:00Z');
    assert.equal(sampleSceneTime({ now }).hour, 1);
    date = new Date('2026-11-01T06:30:00Z');
    assert.equal(sampleSceneTime({ now }).hour, 1.5);
  `);
});

test('fractional-hour DST is delegated to Date local civil fields', () => {
  inZone('Australia/Lord_Howe', `
    let date = new Date('2026-10-03T15:29:59Z');
    const now = () => date;
    assert.equal(sampleSceneTime({ now }).hour, 1 + 59 / 60 + 59 / 3600);
    date = new Date('2026-10-03T15:30:00Z');
    assert.equal(sampleSceneTime({ now }).hour, 2.5);
  `);
});

test('mid-session time-zone change is visible at the next sample of the same Date', () => {
  inZone('America/Phoenix', `
    const date = new Date('2026-11-14T12:00:00Z');
    const now = () => date;
    assert.equal(sampleSceneTime({ now }).hour, 5);
    process.env.TZ = 'Europe/Berlin';
    assert.equal(sampleSceneTime({ now }).hour, 13);
    assert.deepEqual(sampleSceneTime({ now, overrideHour: 23 }), {
      mode: 'manual', hour: 23,
    });
    process.env.TZ = 'Asia/Tokyo';
    assert.deepEqual(sampleSceneTime({ now, overrideHour: null }), {
      mode: 'auto', hour: 21,
    });
  `);
});

test('in-range fractional manual hours retain precision at both ends of the cycle', () => {
  for (const hour of [0.1, 23.999999999999996, Number.EPSILON]) {
    assert.equal(sampleSceneTime({ overrideHour: hour }).hour, hour);
  }
});
