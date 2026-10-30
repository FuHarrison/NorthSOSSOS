# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

北境求生 is a top-down survival game. The project has no build step, no npm dependencies, no tests, and no linter. It has three files:

- `北境求生.html`: the whole game, including CSS, HTML, and one `<script>` IIFE that draws on a canvas. UI text and comments are in Traditional Chinese.
- `server.js`: the LAN multiplayer host. It uses only Node built-ins. It serves the HTML and relays messages over a hand-written WebSocket (RFC 6455).
- `開主機.bat`: runs `node server.js 8080 --open`. It must keep CRLF line endings and use UTF-8 text with `chcp 65001`.

## Commands

```bash
node server.js 8080          # start the multiplayer host (add --open to launch the browser on Windows)
```

Syntax-check the game script by extracting it and running `node --check`:

```bash
awk '/^<script>/{f=1;next}/^<\/script>/{f=0}f' 北境求生.html > /tmp/game.js && node --check /tmp/game.js && node --check server.js
```

Opening `北境求生.html` directly (`file://`) runs the single-player version. Opening it over http (`http://localhost:8080`) runs the multiplayer version.

## Architecture

### Modes

The game has a `MODE` variable, which is set at boot:

- `solo`: the page was opened as `file://`, or the WebSocket failed to connect. Everything pauses when `paused` is true.
- `host`: the first tab that connects from loopback. The server decides this in `onOpen`. The host's browser tab simulates the whole world.
- `client`: every other tab. It only simulates its own player, and renders mobs and the world from the host's snapshots.

Boot paths: `bootSolo`, `bootHost`, and `bootClient(worldMsg)`. Each one ends with `ready=true; setupIntro()`. Nothing in the world exists before `ready`. `genWorld()` is deterministic from `seed`, so a client regenerates the terrain and altar itself, then replaces `resGrid` with the resource list the host sends.

### Intents vs. world changes

This split is the core of the multiplayer design. Keep it when adding features.

- **`act(msg)`** is a player intent, such as `hit`, `res`, `build`, `sleep`, or `summon`. A client sends it to the host. In solo or host mode it calls `handleAct(msg, ME)` directly. Checks that depend on the player's own bag (tools, costs, `afford`, `take`) happen locally before `act`.
- **`handleAct(m, from)`** runs world-side logic, in solo or on the host only. Loot goes back through `giveTo(from, …)` or `giveAll`. A rejected build is paid back with `refund`.
- **`evt(msg)`** is a world change, such as `rh`, `rx`, `ra`, `bd`, `sa`, `bn`, or `mk`. It runs `applyEvt` locally and, on the host, broadcasts the change to every client. Visual effects for world changes belong in `applyEvt`, so every client shows them.
- The host sends `sendSnap()` at 10 Hz with mob positions, day, and flags. Clients apply it in `applySnap` and interpolate toward `tx/ty`.
- Each player sends `sendState()` at 15 Hz (`t:'st', all:1`). The server fans these out to everyone. Remote players live in the `others` Map and are drawn with `drawPlayer(pl)`.
- Mob AI targets the nearest entry in `TG = targets()`: the local `P` if started and alive, plus the remote players in `others`. `hurt(T, …)` either hits `P` locally or sends `hurt` to that client. Roll and invulnerability frames are checked on the receiving client.

### Server routing (`onMsg` in server.js)

- A message with `all` goes to everyone except the sender.
- A message from the host with `to` goes to that peer only. Without `to`, it goes to all clients.
- Every other message goes to the host. The server stamps `from` with the sender's peer id.
- When the host disconnects, clients get `nohost`. When the host reconnects, clients get `host` and reload.

### Frame loop

`frame()` calls the following functions:

- `updateLocal`: input and the local player. It skipped while `paused`.
- `updateWorld`: solo or host only.
- `tickClient`: client only.
- `tickOthers`, `updateFx`, and `netTick`.

In multiplayer the world keeps running while the panel is open or the player is dead. Only local input stops.

### Saves (localStorage)

- Solo saves everything under `northland-save-v1`. Keep this format backward compatible. The old `flags.ate` field is still read into `ate`.
- The host saves the world under `northland-mp-world-v1`.
- Each player saves their own bag under `northland-mp-p-${seed}-${name}`. This happens only after the player has started (`started`).

### Behaviour that differs from solo

- In multiplayer, bush regrowth (`o.dep`) counts down in `netTick` for every bush. In solo it counts down in `drawRes`, so only visible bushes regrow.
- Sleeping skips the night for everyone.
- The boss's loot goes to every player.
