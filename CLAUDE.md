# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

北境求生 is a top-down survival game. There is no build step to run it and no npm dependency; the tools below use only Node built-ins (Node 22+). UI text and comments are in Traditional Chinese.

- `北境求生.html`: the HTML shell. It links `css/game.css` and loads the game as plain classic scripts, in order: `<script src="js/core.js">` … `<script src="js/main.js">`. This list is the one source of the load order (server.js and tools/build.mjs read it).
- `js/*.js`: the game, one canvas game split by area, in load order:
  `core` (canvas, `$`, `HEADLESS`, noise) · `data` (items, icons, foods, weapons, armour, recipes, pets, world settings `CFG`) · `world` (state variables, fog, terrain and biome generation, `makeMob`) · `save` (save/load, `addStruct`, collision) · `player` (stats, bag, toast, input, settings, sound, hotbar, combat, gathering, durability) · `panel` (build mode, bag/craft/chest/furnace panel, upgrades, goals) · `sim` (world simulation, mob and boss AI, local player update, effects, pets) · `net` (`act`/`handleAct`/`evt`, snapshots, admin commands, connection) · `render` (drawing) · `hud` (HUD, maps, emotes, map pins and pings) · `sea` (fish and sharks) · `main` (frame loop, intro, login, boot; last).
- They are **not** modules: top-level `const`/`let`/`function` are shared between the files (one global scope, like the old IIFE body). Each file starts with `'use strict'`. Code that runs at load time may only use what earlier files (or the same file) define: a function declared in a later file does not exist yet. Event handlers and functions called later can use anything.
- `css/game.css`: all the game's styles.
- `server.js`: the LAN multiplayer host. It uses only Node built-ins. It serves the HTML, `js/` and `css/` (only `.js` / `.css` directly in those folders), relays messages over a hand-written WebSocket (RFC 6455), stores saves, and runs the world itself (see Server-run world).
- `admin.html`: the admin page that `server.js` serves at `/admin` (host machine only).
- `開主機.bat`: runs `node server.js 8080 --open`. It must keep CRLF line endings and use UTF-8 text with `chcp 65001`.

## Commands

```bash
node server.js 8080            # start the multiplayer host (add --open to launch the browser on Windows)
node tests/run.mjs             # all browser tests (headless Chrome or Edge); node tests/run.mjs admin bag  = only files matching
node tools/format.mjs          # Prettier (settings in .prettierrc.json); --check only reports. Uses node_modules or the VS Code Prettier extension's copy
node tools/build.mjs           # release: dist/北境求生.html with all css and js inlined, plus server.js, admin.html, 開主機.bat, README.md
for f in js/*.js server.js; do node --check "$f"; done   # quick syntax check
```

- Run `node tools/format.mjs` before committing; keep lines within the Prettier width.
- `tests/`: one file per feature (`NN-name.mjs`), using `tests/lib/harness.mjs` (Chrome DevTools protocol, no npm). A test works on a copy of the game in `tests/.tmp`; the copy gets an extra `<script>` defining `__dbg(code)`, which evals in the game's global scope, so tests read and set game variables directly. Multiplayer tests start their own server on a port from 18190 up.
- `dist/` and `tests/.tmp/` are gitignored.

Opening `北境求生.html` directly (`file://`) runs the single-player version. Opening it over http (`http://localhost:8080`) runs the multiplayer version.

## Architecture

### Modes

The game has a `MODE` variable, which is set at boot:

- `solo`: the page was opened as `file://`, or the WebSocket failed to connect. Everything pauses when `paused` is true.
- `host`: only the copy of the game script that `server.js` runs in Node (`startSim`). It simulates the whole world. No browser tab is ever the host.
- `client`: every browser tab in multiplayer, including tabs on the host machine (`netInfo.local`, which only adds the LAN address and a link to the admin page in the settings). It only simulates its own player, and renders mobs and the world from the host's snapshots.

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

- `startSim` reads the `<script src="js/…">` list from 北境求生.html (`gameScripts`) and runs each file in order with `vm.runInContext` in one context, so they share top-level declarations like in the browser; a single-file release (one inline `<script>`) works too. The context has fake browser globals: DOM, canvas and `Path2D` are a no-op Proxy `stub`, storage is in memory, `WebSocket` is `FakeSocket` wired straight into `onOpen`/`onMsg`, and `requestAnimationFrame` is a 30 Hz timer that keeps going if a frame throws.
- The script sees `globalThis.__NORTH_HEADLESS__` as `HEADLESS` and skips `render`, `hud` and `sea.update`. Anything else it touches at load time must work against the stub, so a new top-level browser API needs a stub in `startSim` too.
- `world.json` is put into the fake localStorage so the script picks the right map size (`W`) at load; `bootHost(hello.world)` then loads it.
- `stopSim(true)` fires the script's `visibilitychange` listener, which calls `writeSave()` synchronously. `shutdown` does this on SIGINT/SIGHUP (closing the console window on Windows). In multiplayer, new worlds come only from the admin page (`ADMIN_POST.newWorld`); the game itself has a new-world button in solo only (`resetSave`).

### Bosses

- Every boss is woken at the stone altar (`doUse` → `act` → `handleAct`). Only one boss is awake at a time (`boss`).
- The 灰鬃狼王 takes 獠牙 ×3 + 樹脂 ×5. Each later boss needs two things: the previous boss's keepsake, which is never used up, and a crafted summon item, which is. The player holds either one in hand (`hot[hotSel]`) at the altar. 狼王的心臟 + 古樹種子 wake the 樹精長老 (`treant`); the 長老年輪 is meant for the next boss.
- A keepsake is given on a player's kill when they don't already have one (`pup` / `tdown` in `onPrivate`).
- The 樹精長老 (`updateTreant`) calls a wave of 小樹精 (`sprout` mobs; 2 per player, 4 in phase 2, a new wave only once none are left; in phase 2 any still alive after `EAT_T` are called back and eaten, each healing `EAT_HEAL` of max HP; while it eats, state `eat`, it takes no damage, see `shielded`), casts black fog (`fogs`; each client checks its own player and shrinks the view to `BLIND_R`), and grows a ring of choppable `etree` resources that never regrow and wither after `ETREE_LIFE`. Below half HP it enters phase 2 (`m.p2`) with shorter cooldowns.
- Bosses are drawn as jointed rigs: 3D joints (x = its right, y = down, z = its forward) projected for the nearest of 8 facings, worked out from `m.face` while drawing. Each limb is one tapering shape (`teTube`) so joints have no seams. The animation state lives in `m.rg` and is driven only by `m.state` and the movement it sees, so clients animate from snapshots alone. Eye positions go to `m.eyes` for the night glow.

### Admin page (`/admin`, `/api/admin/*` in server.js)

- Only the host machine can use it: `localReq` needs a loopback remote address and a `localhost`/`127.0.0.1` Host header (403 otherwise). POSTs also need the header `X-North-Admin: 1`, so another web page cannot submit them.
- `ADMIN_GET` (`status`, `worlds`, `accounts`, `download`) and `ADMIN_POST` (`newWorld`, `switchWorld`, `deleteWorld`, `restoreBackup`, `resetPin`, `kick`, `deleteAccount`) are the whole API. File names are checked against `WORLD_RE` / `BACKUP_RE`.
- Live world numbers come from the sim: `askSim` sends `{t:'adm'}` to the host, the game answers `{t:'admr'}` (handled in `SRV.admr`, host only). `onMsg` drops `adm` from anyone but the sim, so a player cannot fake it.
- Switching worlds, a new world and restoring a backup all `stopSim(true)` (save first) and end with `startSim()`; clients reload on `host`. Switching and a new world call `archiveWorld()` in between, which renames `world.json` to `world-<stamp>.json`. A restore does not archive: after `stopSim(true)` it copies everything into `saves/backups/restore-<stamp>/` (newest `RESTORE_KEEP` kept), then overwrites `world.json` (and deletes its `.bak`) and copies back every player file in the backup, for all seeds. Player saves are keyed by seed, so they follow the world. Accounts are never restored.
- `kick(name, why)` sends `kicked` with a reason the client shows.
- `ADMIN_POST.world` runs a live command in the sim (`SIM_CMDS`: pause, resume, time, clearMobs, endBoss, announce) through `askSim(c, v)`; the game does it in `adminDo` and answers with its status (plus `err`). `worldPaused` stops `updateWorld` on the host and `tickClient`/`updatePet` on clients, goes out in every snapshot (`wp`), and feeds `syncPaused` so local input stops too. It is not saved.
- World settings (`CFG`, phase 3): `CFG_DEF` (number: default, min, max), `CFG_BOOL`, `CFG_DEATH`; `normCfg` clamps, `applyCfg` also sets `BAG_SLOTS` and `DAY_LEN` (now `let`). Each world keeps its own in `world.json` (`cfg`); `applyWorld` and `bootClient` load it, `sendWorld` sends it, and `adminDo('setCfg')` changes it and broadcasts `evt cfg`. Solo always runs on defaults. World loot goes through `dropN` / `lootTo` / `lootAll` (scaled by `CFG.drops`); refunds and chest moves do not. `freeB` / `canPay` make buildings free under `CFG.freeBuild`, and then demolishing refunds no materials.

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
- World saves carry `mapW`. Saves without it are the old 3200 map, and `genWorld` must keep generating those exactly as before. 7200 worlds (`MID_MAP`) are one continent with the biome zones on it (`placeZones`). New worlds use `NEW_MAP` (14400): the same mainland plus three outer continents (`addContinents`, `placeBigBiomes`). All map arrays are sized once at load, so a tab that learns it has the wrong size stores the right one in sessionStorage and reloads (`wrongMapSize`). Over http, server.js writes the current world's size into the page as `window.__NORTH_MAPW` (tracked from `wsave`), which `W` uses first, so clients normally never reload.
- Multiplayer saves live on the host machine in `saves/` (gitignored), written by `server.js`. `writeSave()` sends `wsave` (host only, `worldData()`) and `psave` (after `started`, `personal()`). The server handles `login`/`psave`/`wsave`/`wipe` itself (`SRV` in server.js) and never forwards them, because the host passes every other message to `handleAct`.
  - `saves/world.json`: sent to the sim in `hello.world`; `bootHost(w)` uses it. Only the sim may `wsave`.
  - `saves/accounts.json`: per name, a scrypt PIN hash (`salt:hash`) and sha256 hashes of up to 5 remember-me tokens. Deleting a name's `pin` lets that name register a new PIN.
  - `saves/players/<seed>-<name>.json`: returned in the `login` reply (`d`). Characters invalid in file names become `%xx`.
  - Files are read fresh on every load (no cache) and written via temp file + rename, keeping a `.bak` that `loadSave` falls back to. `archiveWorld` (admin new world / switch / restore) renames `world.json` to `world-<local YYYYMMDD-HHMMSS>.json`. `dailyBackup` copies `world.json`, `accounts.json` and `players/*.json` to `saves/backups/<YYYYMMDD>/` at startup and hourly (once per day), keeping the newest 7.
- Login: the player sends name + PIN (or the token in localStorage `northland-tok`). 5 wrong PINs lock PIN entry for that name for 60 s; a valid token is not blocked. A new valid login kicks the older connection with the same name (`kicked`).
- Migration: a player's old localStorage bag (`northland-mp-p-${seed}-${name}`) is uploaded once on login when the server has none, with `ack`; the browser copy is removed on the `saved` reply. (The old browser-host world, `northland-mp-world-v1`, is no longer uploaded: the sim has no browser storage.)

### Behaviour that differs from solo

- In multiplayer, bush regrowth (`o.dep`) counts down in `netTick` for every bush. In solo it counts down in `drawRes`, so only visible bushes regrow.
- Sleeping skips the night for everyone.
- The boss's loot goes to every player.
- The fog of war is shared. Newly seen cells go to everyone as `t:'fog', all:1` (batched in `netTick`). The host holds the union, sends it with `world`, and saves it as `seen` in `world.json`; a player's personal `seen` is merged in on login and shared on.
