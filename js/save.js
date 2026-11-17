// 北境求生 · save.js：存檔與讀檔、建築的建立、碰撞
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- load / save ---------- */
// solo keeps everything in localStorage (SKEY). In multiplayer everything is sent to server.js and stored in saves/ on the host machine:
// the host sends the world (wsave), every player sends their own bag (psave) after logging in with name + PIN.
// WKEY / pkey() are the old multiplayer localStorage saves: uploaded once, then removed when the server confirms (saved).
let noSave = false,
  loggingIn = false,
  kicked = false;
function worldData() {
  const w = {
    mapW: W,
    seed,
    day,
    dayT,
    flags: { summoned: flags.summoned, boss: flags.boss },
    structs: structs.map(s => ({ k: s.k, x: s.x, y: s.y, o: s.o, fz: s.fz, b: s.box, cr: s.crop })),
    loots: loots.map(l => ({ id: l.id, x: l.x, y: l.y, bag: l.bag, g: l.g })),
    cfg: CFG
  };
  if (MODE !== 'solo') w.seen = packSeen();
  return w;
}
function personal() {
  return {
    inv,
    dur,
    q,
    sk,
    eq,
    known: [...known],
    foods,
    ate,
    spawn: spawnPt,
    p: { x: P.x, y: P.y, hp: P.hp, w: P.weapon, b: P.boat ? 1 : 0 },
    hot,
    hotSel,
    pets: pets.map(p => ({ id: p.id, k: p.k, name: p.name, hp: p.hp, bag: p.bag, down: p.down })),
    petOut,
    seen: packSeen(),
    treant: treantDown,
    pins
  };
}
function pkey() {
  return `northland-mp-p-${seed}-${myName}`;
}
// ack: 'w' / 'p' asks the server to confirm that save, so the old localStorage copy can be removed
function writeSave(ack) {
  if (!ready || noSave) return;
  if (MODE === 'solo') {
    try {
      const w = worldData();
      w.flags.ate = ate;
      localStorage.setItem(SKEY, JSON.stringify(Object.assign(personal(), w)));
    } catch (e) {}
    return;
  }
  if (MODE === 'host') net({ t: 'wsave', d: worldData(), ack: ack === 'w' ? 1 : 0 });
  if (started) net({ t: 'psave', d: personal(), ack: ack === 'p' ? 1 : 0 });
}
// multiplayer: only a tab on the host machine (netInfo.local) gets the button; the server archives the world and restarts it
function resetSave() {
  if (MODE !== 'solo') {
    noSave = true;
    try {
      localStorage.removeItem(WKEY);
      sessionStorage.removeItem(MAPW_KEY);
    } catch (e) {}
    net({ t: 'wipe' });
    return;
  } // reloads on 'wiped'
  try {
    localStorage.removeItem(SKEY);
    sessionStorage.removeItem(MAPW_KEY);
  } catch (e) {}
  location.reload();
}
function applyWorld(s) {
  applyCfg(s.cfg);
  day = s.day || 1;
  dayT = s.dayT || 0.05;
  if (s.flags) {
    flags.summoned = !!s.flags.summoned;
    flags.boss = !!s.flags.boss;
  }
  // 舊存檔的木牆在格子中央、沒有方向：上下有鄰居的在左緣放直牆，左右有鄰居（或沒鄰居）的在下緣放橫牆，轉角兩種都放，圍起來的地方才不會漏
  const old = new Set((s.structs || []).filter(st => st.k === 'wall' && !st.o).map(st => ci(st.x, st.y)));
  for (const st of s.structs || []) {
    if (st.k !== 'wall' || st.o) {
      addStruct(st.k, st.x, st.y, st.o, st.fz || st.b || st.cr);
      continue;
    }
    const c = ci(st.x, st.y);
    if (c < 0) continue;
    const v = old.has(c - COLS) || old.has(c + COLS),
      h = old.has(c - 1) || old.has(c + 1);
    if (v) addWall('wall', st.x - CELL / 2, st.y, 'v');
    if (h || !v) addWall('wall', st.x, st.y + CELL / 2, 'h');
  }
  if (MODE !== 'solo' && s.seen) unpackSeen(s.seen);
  loots = (s.loots || [])
    .filter(l => l && isFinite(l.x) && isFinite(l.y) && l.bag)
    .map(l => ({ id: l.id | 0, x: +l.x, y: +l.y, bag: normBox(l.bag), g: l.g ? String(l.g).slice(0, 10) : undefined }));
  lootSeq = Math.max(0, ...loots.map(l => l.id));
  if (flags.summoned && !flags.boss) flags.summoned = false;
}
function applyPersonal(s) {
  inv = s.inv || {};
  known = new Set((Array.isArray(s.known) ? s.known : Object.keys(inv)).filter(k => ITEM[k]));
  q = {};
  for (const k in s.q || {}) if (DUR_MAX[k] && s.q[k] > 1) q[k] = Math.min(Q_MAX, s.q[k] | 0);
  sk = {};
  for (const k in s.sk || {}) if (SKILLS[k] && s.sk[k] > 0) sk[k] = Math.min(SK_MAX, +s.sk[k]);
  dur = {};
  for (const k in s.dur || {}) if (DUR_MAX[k] && s.dur[k] > 0) dur[k] = Math.min(durMax(k), s.dur[k]);
  // older saves have no slots: wear the best piece you own in each
  eq = noEq();
  if (s.eq)
    for (const [sl] of EQ_SLOTS) {
      const k = s.eq[sl];
      if (ARMOR[k] && ARMOR[k].slot === sl && (inv[k] || 0) > 0) eq[sl] = k;
    }
  else
    for (const k in ARMOR)
      if ((inv[k] || 0) > 0) {
        const sl = ARMOR[k].slot;
        if (!eq[sl] || ARMOR[k].arm > ARMOR[eq[sl]].arm) eq[sl] = k;
      }
  foods = (s.foods || []).filter(f => FOODS[f.k]);
  ate = !!(s.ate || (s.flags && s.flags.ate));
  spawnPt = s.spawn || spawnPt;
  if (s.p) {
    P.x = s.p.x;
    P.y = s.p.y;
    P.hp = s.p.hp || 25;
    P.weapon = WEAPONS[s.p.w] ? s.p.w : 'none';
    P.boat = !!s.p.b;
  }
  // older saves have no hotbar: fill it from the bag and select the weapon that was in hand
  if (Array.isArray(s.hot) && s.hot.length === HOT_N) {
    hot = s.hot.map(k => (typeof k === 'string' && ITEM[k] ? k : null));
    hotSel = Math.min(HOT_N - 1, Math.max(0, s.hotSel | 0));
  } else {
    hotDefault();
    hotSel = Math.max(0, hot.indexOf(P.weapon));
  }
  syncHeld();
  pets = (s.pets || [])
    .filter(p => PETS[p.k])
    .map(p => ({
      id: p.id,
      k: p.k,
      name: p.name,
      hp: p.hp > 0 ? p.hp : PETS[p.k].hp,
      bag: p.bag || {},
      down: p.down || 0
    }));
  petOut = pets.some(p => p.id === s.petOut) ? s.petOut : null;
  const cp = curPet();
  if (cp) placePet(cp, false);
  treantDown = !!s.treant;
  if (s.seen) unpackSeen(s.seen, MODE !== 'solo');
  pins = (Array.isArray(s.pins) ? s.pins : [])
    .filter(p => p && isFinite(p.x) && isFinite(p.y))
    .slice(0, PIN_MAX)
    .map(p => ({ x: +p.x, y: +p.y, t: String(p.t || '標記').slice(0, 12) }));
}
function bootSolo() {
  MODE = 'solo';
  save = loadKey(SKEY);
  if (wrongMapSize(mapWOf(save))) return;
  seed = (save && save.seed) || (Math.random() * 2e9) | 0;
  genWorld();
  if (save) {
    applyWorld(save);
    applyPersonal(save);
  }
  populate();
  ready = true;
  setupIntro();
}
function bootHost(w) {
  const old = w ? null : loadKey(WKEY);
  save = w || old;
  if (wrongMapSize(mapWOf(save))) return;
  seed = (save && save.seed) || (Math.random() * 2e9) | 0;
  genWorld();
  if (save) applyWorld(save);
  populate();
  ready = true;
  if (old) writeSave('w');
  setupIntro();
}
function bootClient(m) {
  if (wrongMapSize(m.mapW || OLD_MAP)) return;
  applyCfg(m.cfg);
  seed = m.seed;
  genWorld();
  resGrid.fill(null);
  const RK = Object.keys(RES);
  for (const [c, ki, x, y, hp, dep] of m.res) {
    const o = addRes(RK[ki], x, y, c);
    o.hp = hp;
    o.dep = dep;
  }
  for (const [k, x, y, o, fz] of m.structs) addStruct(k, x, y, o || undefined, fz || undefined);
  loots = (m.loots || []).map(([id, x, y, bag, g]) => ({ id, x, y, bag, g: g || undefined }));
  if (m.seen) unpackSeen(m.seen);
  seeCells(fogPend);
  fogPend = [];
  day = m.day;
  dayT = m.dt;
  flags.summoned = m.fs;
  flags.boss = m.fb;
  ready = true;
  setupIntro();
}
// data: a furnace's contents (fz) or a chest's (box)
function addStruct(k, x, y, o, data) {
  if (isWallK(k)) return addWall(k, x, y, o);
  const c = ci(x, y);
  if (c < 0) return;
  if (resGrid[c]) resGrid[c] = null;
  const s = { k, x, y, cell: c, anim: Math.random() * 9 };
  if (k === 'furnace') s.fz = normFz(data);
  if (k === 'chest') s.box = normBox(data);
  if (k === 'plot') s.crop = normCrop(data);
  structs.push(s);
  structGrid[c] = s;
  return s;
}
// a plot's crop: k = what grows, g = seconds left until it is ripe; null = empty
function normCrop(c) {
  return c && CROPS[c.k] ? { k: c.k, g: Math.max(0, +c.g || 0) } : null;
}
function normBox(b) {
  const o = {};
  for (const k in b || {}) {
    const n = Math.floor(b[k]);
    if (ITEM[k] && n > 0) o[k] = n;
  }
  return o;
}
// furnace contents: q = ore waiting, fuel = coal waiting, out = ingots ready, burn = seconds left on the lit coal, prog = seconds into the current ore
function normFz(f) {
  f = f || {};
  return {
    q: Object.assign({}, f.q),
    fuel: f.fuel || 0,
    out: Object.assign({}, f.out),
    burn: f.burn || 0,
    prog: f.prog || 0
  };
}
// 牆（木牆、石牆）貼在格子的邊上：o='h' 在格子的上緣，o='v' 在格子的左緣，記在 wallH/wallV[該格]
function wallCell(o, x, y) {
  const i = o === 'v' ? Math.round(x / CELL) : Math.floor(x / CELL),
    j = o === 'v' ? Math.floor(y / CELL) : Math.round(y / CELL);
  return i < 0 || j < 0 || i >= COLS || j >= ROWS ? -1 : j * COLS + i;
}
function snapWall(o, x, y) {
  const c = wallCell(o, x, y),
    i = c % COLS,
    j = Math.floor(c / COLS);
  return o === 'v' ? { x: i * CELL, y: (j + 0.5) * CELL, c, o } : { x: (i + 0.5) * CELL, y: j * CELL, c, o };
}
function addWall(k, x, y, o) {
  if (o !== 'v') o = 'h';
  const g = snapWall(o, x, y),
    grid = o === 'v' ? wallV : wallH;
  if (g.c < 0 || grid[g.c]) return;
  const s = { k, x: g.x, y: g.y, o, cell: g.c, anim: 0 };
  structs.push(s);
  grid[g.c] = s;
  return s;
}

/* ---------- collision ---------- */
const SOLID_S = {
    wall: 21,
    swall: 21,
    bench: 17,
    bed: 16,
    fire: 11,
    furnace: 17,
    lamp: 9,
    chest: 13,
    anvil: 12,
    rack: 14,
    pot: 11,
    plot: 0,
    chair: 9,
    rug: 0,
    banner: 6
  },
  WALL_T = 6;
function wallHit(w, x, y, r) {
  const T = WALL_T + r,
    L = CELL / 2 + r;
  return w.o === 'v' ? Math.abs(x - w.x) < T && Math.abs(y - w.y) < L : Math.abs(y - w.y) < T && Math.abs(x - w.x) < L;
}
function blocked(x, y, r, e) {
  if (e && e.boat)
    return !(
      isSea(x, y) &&
      isSea(x + r * 0.7, y) &&
      isSea(x - r * 0.7, y) &&
      isSea(x, y + r * 0.7) &&
      isSea(x, y - r * 0.7)
    ); // on a boat: only open sea
  if (
    isWater(x, y) ||
    isWater(x + r * 0.7, y) ||
    isWater(x - r * 0.7, y) ||
    isWater(x, y + r * 0.7) ||
    isWater(x, y - r * 0.7)
  )
    return true;
  const i0 = Math.floor(x / CELL),
    j0 = Math.floor(y / CELL),
    sp = r > 20 ? 2 : 1;
  for (let j = j0 - sp; j <= j0 + sp; j++)
    for (let i = i0 - sp; i <= i0 + sp; i++) {
      if (i < 0 || j < 0 || i >= COLS || j >= ROWS) continue;
      const c = j * COLS + i;
      const o = resGrid[c];
      if (o) {
        const s = RES[o.k].solid;
        if (s && Math.hypot(o.x - x, o.y - y) < s * o.sz + r) return true;
      }
      const st = structGrid[c];
      if (st) {
        const s = SOLID_S[st.k];
        if (s && Math.hypot(st.x - x, st.y - y) < s + r) return true;
      }
      if ((wallH[c] && wallHit(wallH[c], x, y, r)) || (wallV[c] && wallHit(wallV[c], x, y, r))) return true;
    }
  if (Math.hypot(altar.x - x, altar.y - y) < 26 + r) return true;
  return false;
}
function move(e, dx, dy) {
  if (biomeAt(e.x, e.y) === B_SWAMP) {
    dx *= SWAMP_K;
    dy *= SWAMP_K;
  }
  if (dx && !blocked(e.x + dx, e.y, e.r, e)) e.x += dx;
  if (dy && !blocked(e.x, e.y + dy, e.r, e)) e.y += dy;
}
