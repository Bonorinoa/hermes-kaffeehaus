# Make a scene

A **scene** is a living place behind your Hermes chat: a picture that keeps your hours, a menu in its own voice, a few house looks, and a palette for Classic. Kaffeehaus is one. Yours could be a night train, a city window, a reading room, an empty office at 3 a.m.

A scene is two small files in `scenes/<your-id>/`. The core does everything else: the seats (Window Seat, Focus, Classic), the clock, the look sliders, the card, motion, Peek, keyboard access, and switching off cleanly. You only draw and name.

## The two files

### `art.js`: the picture

Plain JavaScript, no imports. Export one function through `module.exports`:

```js
function draw(ctx, W, hour, frame, o) { /* paint the room */ }
module.exports = { draw };
```

| Argument | What it is |
|---|---|
| `ctx` | A 2D canvas context. The room is **144 px tall** and `W` px wide, in logical pixels; the core scales it up crisply. |
| `hour` | 0 to 24: local time, or the hour set by hand on the card. |
| `frame` | Counts up about 4 times a second while motion is on. Use it for small movement (stars, steam, rain). |
| `o.wx` | x of the window's centre: put the thing people look at here. |
| `o.tx` | x of the table, where a character would sit. |
| `o.state`, `o.since` | The character's state and how many frames it has lasted (`'still'` when motion is off). Only if your scene has a character. |

Rules:
- Draw with the canvas only. **No network, no storage, no timers of your own, nothing from the chat.**
- The **top row of pixels is repeated upward** when the pane is taller than 144 px, so keep it plain wall or sky.
- Same inputs, same picture. If you want randomness, use a seeded hash (see the template).
- Original art only. If you adapt someone's work, say so and respect its licence.

A scene with a character also exports `STATES` (covering every state in `EMITTED_STATES`, `src/character.mjs`) and `poseFor`, and sets `character: true`. The character may react only to whether the agent is working (`busy`, `awaiting`) and to the clock. See `scenes/kaffeehaus/art.js` and `src/character.mjs`.

### `scene.mjs`: the name, the voice, the looks

One exported object. The template (`scenes/_template/scene.mjs`) has every field with a comment. In short:

| Field | Purpose |
|---|---|
| `id` | Same as the folder name; `a-z`, `0-9`, `-`. |
| `name`, `icon`, `tagline`, `open` | Shown on the card, the pill, ⌘K and the sidebar launcher. |
| `card` | The words on your scene's menu board and the card it opens in Window Seat, in your scene's own voice (Kaffeehaus writes German with English glosses). In Focus and Classic the menu is the glass pill card: plain English, titled with your scene's name. |
| `blends` | Named looks (blur, brightness, text panel, glass) for Focus and Window Seat. |
| `palette` | Classic: Hermes theme variables for your scene's colours over the normal layout. Allowed keys are `PALETTE_KEYS` in `src/scenes.mjs`; keys you leave out keep Hermes's own colours. Keep body text at 4.5:1 contrast or better on a dark ground. |
| `classic` | Optional: `ground` (a CSS background behind the chat in Classic, no `url()`) and `font` (a font stack for the chat text). Without them: a neutral dark and Hermes's own font. |
| `character` | Optional. `true` only with `STATES` and `poseFor` in `art.js`. |

## Try it

```sh
cp -R scenes/_template scenes/night-train        # then rename id/name in scene.mjs and draw in art.js
tools/preview/shoot.sh night-train                # your scene at six times of day, no Hermes needed
node --test                                       # the contract test checks every field and draws every hour
```

To run it in Hermes, put your scene first in `src/scenes.mjs` (only the first scene is used until there is a picker), then `node build.mjs` and copy `desktop/plugin.js` to `~/.hermes/desktop-plugins/scenes/` and reload Hermes. `tools/fixture/shoot.sh` shows it behind a stand-in chat.

## Build one with your agent

Paste this into Hermes (or any coding agent) from the repo folder:

> Make a new scene for the Scenes plugin: **[a night train window, rain on the glass, the occasional station going past]**. Read `SCENES.md`, copy `scenes/_template/`, and draw original pixel art in `art.js` (144 px tall, `wx` is the window centre, follow the hour: night, dawn, day, dusk). Give the menu its own voice in `scene.mjs`, two house looks, and a Classic palette with readable contrast. Check it with `tools/preview/shoot.sh <id>` and `node --test` until both pass, and show me the preview at six times of day. Don't touch `src/` or other scenes.

## Share it

Open a pull request with your folder, a preview image and a line about the place. Scenes that read the chat, call the network or copy someone else's art won't be merged.
