# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

北境求生 is a top-down survival game. The project has no build step, no npm dependencies, no tests, and no linter. It has three files:

- `北境求生.html`: the whole game, including CSS, HTML, and one `<script>` IIFE that draws on a canvas. UI text and comments are in Traditional Chinese.
- `server.js`: the LAN multiplayer host. It uses only Node built-ins. It serves the HTML, relays messages over a hand-written WebSocket (RFC 6455), stores saves, and runs the world itself (see Server-run world).
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
- `host`: only the copy of the game script that `server.js` runs in Node (`startSim`). It simulates the whole world. No browser tab is ever the host.
- `client`: every browser tab in multiplayer, including tabs on the host machine (`netInfo.local`, which only adds the LAN address and the 新世界 button). It only simulates its own player, and renders mobs and the world from the host's snapshots.

Boot paths: `bootSolo`, `bootHost`, and `bootClient(worldMsg)`. Each one ends with `ready=true; setupIntro()`. Nothing in the world exists before `ready`. `genWorld()` is deterministic from `seed`, so a client regenerates the terrain and altar itself, then replaces `resGrid` with the resource list the host sends.

### Intents vs. world changes

This split is the core of the multiplayer design. Keep it when adding features.

- **`act(msg)`** is a player intent, such as `hit`, `res`, `build`, `sleep`, or `summon`. A client sends it to the host. In solo or host mode it calls `handleAct(msg, ME)` directly. Checks that depend on the player's own bag (tools, costs, `afford`, `take`) happen locally before `act`.
- **`handleAct(m, from)`** runs world-side logic, in solo or on the host only. Loot goes back through `giveTo(from, …)` or `giveAll`. A rejected build is paid back with `refund`.
- **`evt(msg)`** is a world change, such as `rh`, `rx`, `ra`, `bd`, `sa`, `bn`, or `mk`. It runs `applyEvt` locally and, on the host, broadcasts the change to every client. Visual effects for world changes belong in `applyEvt`, so every client shows them.
- The host sends `sendSnap()` at 10 Hz with mob positions, day, and flags. Clients apply it in `applySnap` and interpolate toward `tx/ty`.
- Each player sends `sendState()` at 15 Hz (`t:'st', all:1`). The server fans these out to everyone. Remote players live in the `others` Map and are drawn with `drawPlayer(pl)`.
- Mob AI targets the nearest entry in `TG = targets()`: the local `P` if started and alive, plus the remote players in `others`. `hurt(T, …)` either hits `P` locally or sends `hurt` to that client. Roll and invulnerability frames are checked on the receiving client.

### Pets

- The player owns `pets` (any number) and `petOut` (the id of the summoned pet). Each pet's runtime fields live on the same object, but only `id/k/name/hp/bag/down` are saved.
- The summoned pet is simulated by its **owner** in `updatePet`, the same way as the player. The pet's hits and pickups go through `act` with `pet:1`. Gathered items go to `pet.bag` through `give(..., toPet)`.
- Mobs target a pet only after that pet hits them (`m.petT`). `hurt()` routes damage to the owner (`hurtPet` locally, or the `phurt` message).
- Taming (`feed`) and dropped loot bags (`drop`/`pick`, kept in the `loots` world list) are host-side intents. Taming progress and new pets reach a player through `toPlayer`/`toAll` → `onPrivate`.

### Server-run world (`startSim` in server.js)

- `startSim` extracts the `<script>` from 北境求生.html and runs it with `vm.runInNewContext` under fake browser globals: DOM, canvas and `Path2D` are a no-op Proxy `stub`, storage is in memory, `WebSocket` is `FakeSocket` wired straight into `onOpen`/`onMsg`, and `requestAnimationFrame` is a 30 Hz timer that keeps going if a frame throws.
- The script sees `globalThis.__NORTH_HEADLESS__` as `HEADLESS` and skips `render`, `hud` and `sea.update`. Anything else it touches at load time must work against the stub, so a new top-level browser API needs a stub in `startSim` too.
- `world.json` is put into the fake localStorage so the script picks the right map size (`W`) at load; `bootHost(hello.world)` then loads it.
- `stopSim(true)` fires the script's `visibilitychange` listener, which calls `writeSave()` synchronously. `shutdown` does this on SIGINT/SIGHUP (closing the console window on Windows). `wipe` (only from a `local` peer) stops the sim without saving, archives `world.json`, and starts a new one.

### Server routing (`onMsg` in server.js)

- A message with `all` goes to everyone except the sender.
- A message from the host with `to` goes to that peer only. Without `to`, it goes to all clients.
- Every other message goes to the host. The server stamps `from` with the sender's peer id.
- When the host (the sim) stops, clients get `nohost`. When it starts again, clients get `host` and reload.

### Frame loop

`frame()` calls the following functions:

- `updateLocal`: input and the local player. It skipped while `paused`.
- `updateWorld`: solo or host only.
- `tickClient`: client only.
- `tickOthers`, `updateFx`, and `netTick`.

In multiplayer the world keeps running while the panel is open or the player is dead. Only local input stops.

### Saves

- Solo saves everything in localStorage under `northland-save-v1`. Keep this format backward compatible. The old `flags.ate` field is still read into `ate`.
- World saves carry `mapW`. Saves without it are the old 3200 map, and `genWorld` must keep generating those exactly as before. New worlds use `NEW_MAP`. All map arrays are sized once at load, so a tab that learns it has the wrong size stores the right one in sessionStorage and reloads (`wrongMapSize`). Over http, server.js writes the current world's size into the page as `window.__NORTH_MAPW` (tracked from `wsave`), which `W` uses first, so clients normally never reload.
- Multiplayer saves live on the host machine in `saves/` (gitignored), written by `server.js`. `writeSave()` sends `wsave` (host only, `worldData()`) and `psave` (after `started`, `personal()`). The server handles `login`/`psave`/`wsave`/`wipe` itself (`SRV` in server.js) and never forwards them, because the host passes every other message to `handleAct`.
  - `saves/world.json`: sent to the sim in `hello.world`; `bootHost(w)` uses it. Only the sim may `wsave`.
  - `saves/accounts.json`: per name, a scrypt PIN hash (`salt:hash`) and sha256 hashes of up to 5 remember-me tokens. Deleting a name's `pin` lets that name register a new PIN.
  - `saves/players/<seed>-<name>.json`: returned in the `login` reply (`d`). Characters invalid in file names become `%xx`.
  - Files are read fresh on every load (no cache) and written via temp file + rename, keeping a `.bak` that `loadSave` falls back to. `wipe` renames `world.json` to `world-<local YYYYMMDD-HHMMSS>.json`. `dailyBackup` copies `world.json`, `accounts.json` and `players/*.json` to `saves/backups/<YYYYMMDD>/` at startup and hourly (once per day), keeping the newest 7.
- Login: the player sends name + PIN (or the token in localStorage `northland-tok`). 5 wrong PINs lock PIN entry for that name for 60 s; a valid token is not blocked. A new valid login kicks the older connection with the same name (`kicked`).
- Migration: a player's old localStorage bag (`northland-mp-p-${seed}-${name}`) is uploaded once on login when the server has none, with `ack`; the browser copy is removed on the `saved` reply. (The old browser-host world, `northland-mp-world-v1`, is no longer uploaded: the sim has no browser storage.)

### Behaviour that differs from solo

- In multiplayer, bush regrowth (`o.dep`) counts down in `netTick` for every bush. In solo it counts down in `drawRes`, so only visible bushes regrow.
- Sleeping skips the night for everyone.
- The boss's loot goes to every player.
