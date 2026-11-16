// A template scene: a window onto a city. Copy this folder to scenes/<your-id>/ and make it yours.
// Every field is required unless marked optional. Contract and walkthrough: SCENES.md.
export const NIGHT_WINDOW = Object.freeze({
  id: 'night-window',                 // lowercase, a-z 0-9 and -, the same as the folder name
  name: 'Night Window',               // shown on the card, the pill, ⌘K and the launcher
  icon: '🌃',                          // one emoji for the pill
  tagline: 'A city window that keeps your hours',
  open: 'Open the window',            // the launcher button
  character: false,                   // optional: true only if art.js exports STATES and poseFor
  // The menu: the board on the wall and the card it opens. Write it in your scene's own voice.
  card: Object.freeze({
    title: 'Settings', sub: 'night window', board: 'Settings', glosses: false, // glosses: true shows "word · english" pairs
    sections: [['Seat', ''], ['Light', ''], ['Presets', ''], ['Look', 'this seat'], ['Room', '']],
    seats: { window: 'Window Seat', focus: 'Focus', classic: 'Classic' }, follow: 'Follow clock', reset: 'Reset this seat',
    width: ['Reading width', ''], motion: ['Motion on', 'Motion off'], peek: 'Peek at the view',
    looks: { blur: 'Blur', brightness: 'Brightness', veil: 'Text panel', glass: 'Glass' },
    classicNote: 'Classic is this scene\'s palette over the normal layout, without the view.' }),
  // Named looks. Ranges: blur 0–24 px, brightness 20–100 %, veil 0–100 %, glass 0–30 px.
  blends: Object.freeze([
    { name: 'Late shift', note: 'dark, reading first',
      focus: { blur: 12, brightness: 45, veil: 90, glass: 16 }, window: { blur: 0, brightness: 80, veil: 96, glass: 0 } },
    { name: 'Lights on', note: 'the city comes through',
      focus: { blur: 3, brightness: 90, veil: 60, glass: 8 }, window: { blur: 0, brightness: 100, veil: 75, glass: 14 } }]),
  // Classic palette: Hermes theme variables (allowed keys: PALETTE_KEYS in src/scenes.mjs). Keep text ≥ 4.5:1 on a dark ground.
  palette: Object.freeze({ '--ui-text-primary': '#e8ecf4', '--ui-text-secondary': '#c6cede', '--ui-text-tertiary': '#a3aec4',
    '--ui-accent': '#f0b45a', '--ui-chat-bubble-background': '#1c2233' }),
});
