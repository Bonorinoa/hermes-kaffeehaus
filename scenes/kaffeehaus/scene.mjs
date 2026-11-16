// Kaffeehaus: a Viennese café that keeps your hours. Everything here is this scene's own:
// its name, its menu's voice (German, with English glosses), its house blends and its Classic palette.
// The drawing is art.js next to this file (draw, STATES, poseFor, passersAt). Contract: SCENES.md.
export const KAFFEEHAUS = Object.freeze({
  id: 'kaffeehaus', name: 'Kaffeehaus', icon: '☕', tagline: 'A Viennese café that keeps your hours',
  open: 'Open the café', character: true,
  // The menu (the chalkboard and the card it opens). Each scene has its own voice.
  card: Object.freeze({
    title: 'Die Karte', sub: 'café settings', board: 'Die Karte', glosses: true,
    sections: [['Platz', 'where you sit'], ['Uhrzeit', 'light in the room'], ['Hausmischungen', 'house blends'], ['À la carte', 'for this seat'], ['Im Raum', 'the room']],
    seats: { window: 'Fensterplatz', focus: 'Fokus', classic: 'Klassisch' }, follow: 'Jetzt', reset: 'Zurücksetzen · reset this seat',
    width: ['Lesebreite', 'reading width'], motion: ['Bewegung', 'Stillleben'], peek: 'Nur der Raum · peek',
    looks: { blur: 'Unschärfe', brightness: 'Helligkeit', veil: 'Schleier', glass: 'Glas' },
    classicNote: 'Classic is the Kaffeehaus palette and type without the room. Pick a seat above to step into the café.' }),
  // House blends: named looks picked by hand (manual, not adaptive). Window Seat keeps the room sharp.
  blends: Object.freeze([
    { name: 'Kleiner Schwarzer', note: 'dark, reading first',
      focus: { blur: 12, brightness: 45, veil: 90, glass: 16 }, window: { blur: 0, brightness: 80, veil: 97, glass: 0 } },
    { name: 'Melange', note: 'balanced',
      focus: { blur: 5, brightness: 75, veil: 72, glass: 10 }, window: { blur: 0, brightness: 100, veil: 88, glass: 12 } },
    { name: 'Einspänner', note: 'the room comes through',
      focus: { blur: 2, brightness: 95, veil: 55, glass: 6 }, window: { blur: 0, brightness: 100, veil: 70, glass: 18 } }]),
  // Classic: this scene's palette (espresso ground, oxblood, sand, cream) over Hermes's own layout, no room.
  palette: Object.freeze({ '--ui-text-primary': '#efe6d6', '--ui-text-secondary': '#dccbb0', '--ui-text-tertiary': '#c8b394', '--ui-text-quaternary': '#a8967c',
    '--ui-accent': '#b4534a', '--muted-foreground': '#cbb38c', '--ui-stroke-secondary': 'rgba(201,163,106,.30)', '--ui-stroke-tertiary': 'rgba(201,163,106,.18)',
    '--ui-chat-bubble-background': '#2d221e', '--ui-inline-code-background': 'rgba(201,163,106,.13)', '--ui-inline-code-foreground': '#e6c99a' }),
  // Classic ground (a CSS background behind the chat) and type. Both optional: without them, a neutral dark and Hermes's own font.
  classic: Object.freeze({
    ground: 'radial-gradient(110% 70% at 0% 0%,rgba(122,34,40,.30),rgba(122,34,40,0) 60%),radial-gradient(80% 60% at 100% 100%,rgba(201,163,106,.07),rgba(201,163,106,0) 70%),linear-gradient(180deg,#221a17,#171315)',
    font: '"Iowan Old Style",Palatino,"Times New Roman",Georgia,serif' }),
});
