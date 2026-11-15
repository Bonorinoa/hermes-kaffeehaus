# Changelog

## 0.2.0 (2026-11-15)
- **The note-taker comes alive.** They write while Hermes works, look up when the first words arrive, close the notebook and sip when the turn ends, doze after 23:00 and may bring out a sleeping bag after 01:00. Driven only by the SDK's public `host.state.busy` and `awaitingResponse` signals and the clock; no chat content is read.
- **People walk past the window**, more by day, none in the small hours.
- **One place for settings.** Everything (seat, hour, blends, look, reading width, motion, peek) is on the in-scene card. The sidebar tab is now a launcher: *Open the café* / *Off*.
- **⌘K rows:** *Kaffeehaus café* (on/off) and *Kaffeehaus: show the tab*.
- **Smoother:** seat changes ease the chat column and fade the room across; the card fades in. Reduced motion snaps.
- **Motion is on by default** (still off under macOS Reduce motion).
- **The card works from the keyboard:** Tab stays inside it, Esc closes it, focus rings in the house colours.
- Brighter night room; Classic has brighter table headers and tool lines; the glass card is more opaque.
- Settings survive Off → Open within a session (memory only, nothing written to disk).

## 0.1.2 (2026-11-15)
- New seat, **Classic**: the Kaffeehaus palette and type (espresso ground, oxblood accent, cream and sand text, serif prose) over Hermes's own layout, with no room. The pill stays, so you can step back into the café.
- Die Karte now opens over the chat column in Window Seat, so the window stays in view while you change the hour.
- Apply starts in Window Seat. In Classic, the room-only sliders in the side pane are greyed out.

## 0.1.1 (2026-11-14)
- Fix: closing or hiding the Kaffeehaus sidebar tab no longer switches the scene off. The scene now lives as long as the plugin; the tab is one view of it. Regression test: `tests/session.test.mjs`.

## 0.1.0 (2026-11-14)
- First public release: Focus and Window Seat, local-time light, house blends, look sliders, in-scene menu board and glass pill.
