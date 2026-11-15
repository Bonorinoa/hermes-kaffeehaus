// Stand-in for @hermes/plugin-sdk: only what Kaffeehaus touches.
const atom = get => ({ get });
export const host = { state: { busy: atom(() => !!window.__busy), awaitingResponse: atom(() => !!window.__awaiting) } };
export function createBudgetedLoop(fn, { fps = 4 } = {}) { const id = setInterval(fn, 1000 / fps); return { dispose: () => clearInterval(id) }; }
