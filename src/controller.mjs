import { SCENE } from './scenes.mjs';
import { sampleSceneTime } from './scene-time.mjs';

// Per-mode look: scene blur (px), scene brightness (%), text-panel veil opacity
// (%), glass blur behind the text panel (px). Defaults reproduce the reviewed look.
export const DEFAULT_LOOKS = Object.freeze({
  focus: Object.freeze({ blur: 11, brightness: 55, veil: 86, glass: 14 }),
  window: Object.freeze({ blur: 0, brightness: 100, veil: 96, glass: 0 }) });
// House blends belong to the scene. classic: the scene's palette and type over Hermes's own layout, no room.
export const BLENDS = SCENE.blends;
export const MODES = Object.freeze(['window', 'focus', 'classic']);
export const LOOK_RANGES = Object.freeze({ blur: [0, 24], brightness: [20, 100], veil: [0, 100], glass: [0, 30] });

const checkLook = look => {
  for (const [key, [lo, hi]] of Object.entries(LOOK_RANGES)) {
    const v = look[key];
    if (!Number.isFinite(v)) throw new TypeError(`${key} must be finite`);
    if (v < lo || v > hi) throw new RangeError(`${key} must be ${lo}–${hi}`);
  }
};

// Pure local state; scheduler supplied by the SDK adapter, never content or RPC.
export function createController({ now, every, draw, onState = () => {} }) {
  let disposed = false;
  // Motion is on by default: the note-taker is half the point. OS reduced motion still wins.
  let state = { clock: null, motion: true, overrideHour: null,
    mode: 'focus', width: 780, motionRequested: true, reduced: false,
    looks: { focus: { ...DEFAULT_LOOKS.focus }, window: { ...DEFAULT_LOOKS.window } } };
  const sample = () => {
    if (disposed) return;
    state = { ...state, clock: sampleSceneTime({ now, overrideHour: state.overrideHour }) };
    draw(state); onState(state);
  };
  sample();
  const cancel = every(sample, 1000);
  return { state: () => state, resume: sample, update(patch) {
    if (disposed) return;
    const { look, ...rest } = patch;
    const next = { ...state, ...rest };
    if (!MODES.includes(next.mode)) throw new TypeError('unknown mode');
    if (!Number.isFinite(next.width)) throw new TypeError('width must be finite');
    if (next.width<360 || next.width>1000) throw new RangeError('width must be 360–1000 px');
    // `look` patches the active mode only; `looks` replaces both (re-Apply keeps them).
    next.looks = { focus: { ...next.looks.focus }, window: { ...next.looks.window } };
    if (look) next.looks[next.mode] = { ...next.looks[next.mode], ...look };
    checkLook(next.looks.focus); checkLook(next.looks.window);
    sampleSceneTime({ now, overrideHour: next.overrideHour });
    next.motion = next.motionRequested === true && next.reduced !== true;
    state = next; sample();
  }, dispose() {
    if (disposed) return;
    disposed = true; cancel();
  } };
}
