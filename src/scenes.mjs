import { KAFFEEHAUS } from '../scenes/kaffeehaus/scene.mjs';

// The scenes this build ships. One for now; a picker comes later.
export const SCENES = Object.freeze([KAFFEEHAUS]);
export const SCENE = SCENES[0];
// Hermes theme variables a scene's Classic palette may set (the core saves and restores exactly these).
export const PALETTE_KEYS = Object.freeze(['--ui-text-primary', '--ui-text-secondary', '--ui-text-tertiary', '--ui-text-quaternary', '--ui-accent',
  '--muted-foreground', '--ui-stroke-secondary', '--ui-stroke-tertiary', '--ui-chat-bubble-background', '--ui-inline-code-background', '--ui-inline-code-foreground']);
