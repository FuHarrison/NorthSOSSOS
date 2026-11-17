// 北境求生 · net.js：多人連線：act / handleAct / evt、快照、後台指令、連線
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- network ---------- */
function net(o) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(o));
}
function sendTo(id, o) {
  o.to = id;
  net(o);
}
function evt(o) {
  applyEvt(o);
  if (MODE === 'host') net(o);
} // world change: apply here, mirror to clients
function act(o) {
  if (MODE === 'client') net(o);
  else handleAct(o, ME);
} // player intent: host/solo decide
function giveTo(from, k, n, x, y, toPet) {
  if (n <= 0) return;
  if (from === ME) give(k, n, x, y, toPet);
  else sendTo(from, { t: 'give', k, n, x, y, p: toPet ? 1 : 0 });
}
function toPlayer(from, o) {
  if (from === ME) onPrivate(o);
  else sendTo(from, o);
}
function toAll(o) {
  onPrivate(o);
  for (const id of others.keys()) sendTo(id, Object.assign({}, o));
}
// messages meant for one player only (taming progress, new pets)
function onPrivate(m) {
  switch (m.t) {
    case 'love':
      floats.push({ x: m.x, y: m.y - 24, txt: `♥ ${m.n}/${TAME_N}`, t: 1.2, col: '#ff9fb8' });
      break;
    case 'tame': {
      const k = m.k || 'boar';
      addPet(k);
      banner('馴服了' + PETS[k].name, '打開背包的「寵物」分頁可以召喚或收回');
      break;
    }
    case 'tdown': {
      const first = !treantDown;
      treantDown = true;
      if (!has('長老年輪')) give('長老年輪', 1, m.x, m.y - 56);
      if (first || Math.random() < 0.3) give('樹精核心', 1, m.x, m.y - 42);
      if (first) toast('解鎖配方：樹精法杖、樹精裝備');
      writeSave();
      if (!$('panel').hidden) renderPanel();
      break;
    } // the rare core is rolled per player; a first kill always gets one
    case 'pup':
      if (!pets.some(p => p.k === 'wolf')) addPet('wolf');
      if (!has('狼王的心臟')) {
        give('狼王的心臟', 1, P.x, P.y - 20);
        toast('得到狼王的心臟・拿在手上、帶著古樹種子到石祭壇可以喚醒樹精長老，心臟不會用掉');
        writeSave();
      }
      break;
    case 'board':
      P.boat = true;
      P.x = m.x;
      P.y = m.y;
      P.roll = 0;
      toast('上船了・靠岸按 E 下船');
      break; // each player's first Wolf King only; pets can't be released, so owning a pup means this one's used
  }
}
function giveAll(k, n, x, y) {
  giveTo(ME, k, n, x, y);
  for (const id of others.keys()) giveTo(id, k, n, x, y);
}
const nameOf = id => (id === ME ? myName : (others.get(id) || {}).n);
// a grave is yours if your name is on it; solo has one player (whose name is not kept between visits), so every grave is yours
const myGrave = l => !!l.g && (MODE === 'solo' || l.g === myName);
function refund(from, cost, msg) {
  if (from === ME) {
    for (const k in cost) inv[k] = (inv[k] || 0) + cost[k];
    toast(msg);
  } else sendTo(from, { t: 'refund', cost, msg });
}
function handleAct(m, from) {
  switch (m.t) {
    case 'hit': {
      const mob = mobs.find(o => o.id === m.id);
      if (mob) hitMob(mob, m.dmg, from, m.x, m.y, m.pet);
      break;
    }
    case 'res':
      worldRes(m.c, m.dmg, from, m.pet);
      break;
    case 'feed': {
      const b = mobs.find(o => o.id === m.id);
      if (!b || !TAME_FOOD[b.k] || b.aggro > 0) {
        refund(from, { [m.f || '莓果']: 1 }, '牠現在不肯吃');
        break;
      }
      b.love = (b.love || 0) + 1;
      b.wt = 2;
      b.wx = b.wy = 0;
      if (b.k === 'frog') {
        b.state = 'idle';
        b.t = 2;
      }
      if (b.love >= TAME_N) {
        mobs.splice(mobs.indexOf(b), 1);
        evt({ t: 'tm', id: b.id, x: b.x, y: b.y });
        toPlayer(from, { t: 'tame', k: b.k });
      } else toPlayer(from, { t: 'love', n: b.love, x: b.x, y: b.y });
      break;
    }
    case 'drop': {
      const bag = normBox(m.bag);
      if (Object.keys(bag).length)
        evt({ t: 'ld', id: ++lootSeq, x: m.x, y: m.y, bag, g: m.g ? String(m.g).slice(0, 10) : undefined });
      break;
    }
    case 'fput': {
      const s = structGrid[m.c],
        n = Math.floor(m.n);
      if (!s || s.k !== 'furnace' || !(n > 0) || (m.k !== '煤炭' && !SMELT[m.k])) {
        if (n > 0) refund(from, { [m.k]: n }, '熔爐不見了，材料退回');
        break;
      }
      const f = s.fz;
      if (m.k === '煤炭') f.fuel += n;
      else f.q[m.k] = (f.q[m.k] || 0) + n;
      evt({ t: 'fz', c: m.c, f });
      break;
    }
    case 'fout': {
      const s = structGrid[m.c];
      if (!s || s.k !== 'furnace') break;
      const f = s.fz;
      for (const k in f.out) giveTo(from, k, f.out[k], s.x, s.y - 20);
      f.out = {};
      evt({ t: 'fz', c: m.c, f });
      break;
    }
    // chests: cput = a player puts items in (already taken from their bag), cget = takes them out. What doesn't fit goes back
    case 'cput': {
      const s = structGrid[m.c],
        bag = normBox(m.bag);
      if (!s || s.k !== 'chest') {
        if (Object.keys(bag).length) refund(from, bag, '箱子不見了，東西退回');
        break;
      }
      const back = {};
      for (const k in bag) {
        const n = Math.min(bag[k], roomFor(s.box, k, CHEST_SLOTS));
        if (n > 0) s.box[k] = (s.box[k] || 0) + n;
        if (bag[k] > n) back[k] = bag[k] - n;
      }
      evt({ t: 'cb', c: m.c, b: s.box });
      if (Object.keys(back).length) refund(from, back, '箱子滿了，放不下的退回');
      break;
    }
    case 'cget': {
      const s = structGrid[m.c],
        bag = normBox(m.bag);
      if (!s || s.k !== 'chest') break;
      let dy = 0;
      for (const k in bag) {
        const n = Math.min(bag[k], s.box[k] || 0);
        if (!(n > 0)) continue;
        if (!(s.box[k] -= n)) delete s.box[k];
        giveTo(from, k, n, s.x, s.y - 20 - dy);
        dy += 14;
      }
      evt({ t: 'cb', c: m.c, b: s.box });
      break;
    }
    case 'pick': {
      const l = loots.find(o => o.id === m.id);
      if (!l) break;
      if (l.g && MODE !== 'solo' && l.g !== nameOf(from)) {
        refund(from, {}, `這是${l.g}的墓碑`);
        break;
      }
      evt({ t: 'lr', id: l.id });
      for (const k in l.bag) giveTo(from, k, l.bag[k], l.x, l.y);
      break;
    }
    case 'build': {
      if (isWallK(m.k)) {
        const g = snapWall(m.o === 'v' ? 'v' : 'h', m.x, m.y);
        if (g.c < 0 || biome[g.c] === 0 || (g.o === 'v' ? wallV : wallH)[g.c])
          refund(from, m.cost, '那個位置被別人佔走了，材料退回');
        else evt({ t: 'sa', k: m.k, x: g.x, y: g.y, o: g.o });
        break;
      }
      const c = ci(m.x, m.y);
      if (
        m.k === 'boat'
          ? !boatSpotOk(c)
          : c < 0 || biome[c] === 0 || biome[c] === B_LAVA || structGrid[c] || c === altar.cell || !(m.k in SOLID_S)
      )
        refund(from, m.cost, '那個位置被別人佔走了，材料退回');
      else evt({ t: 'sa', k: m.k, x: m.x, y: m.y });
      break;
    }
    case 'demo': {
      const s = isWallK(m.k)
        ? (m.o === 'v' ? wallV : wallH)[snapWall(m.o === 'v' ? 'v' : 'h', m.x, m.y).c]
        : structGrid[ci(m.x, m.y)];
      if (!s || s.k !== m.k) break;
      evt({ t: 'sr', k: s.k, x: s.x, y: s.y, o: s.o });
      const back = {},
        add = (k, n) => {
          if (n > 0) back[k] = (back[k] || 0) + n;
        },
        r = RECIPES.find(r => r.id === s.k);
      if (r && !CFG.freeBuild) for (const k in r.cost) add(k, r.cost[k]);
      if (s.box) for (const k in s.box) add(k, s.box[k]);
      if (s.fz) {
        for (const k in s.fz.q) add(k, s.fz.q[k]);
        add('煤炭', s.fz.fuel);
        for (const k in s.fz.out) add(k, s.fz.out[k]);
      }
      let dy = 0;
      for (const k in back) {
        giveTo(from, k, back[k], s.x, s.y - dy);
        dy += 14;
      }
      break;
    }
    case 'board': {
      const s = structGrid[ci(m.x, m.y)];
      if (!s || s.k !== 'boat') break;
      evt({ t: 'sr', k: 'boat', x: s.x, y: s.y });
      toPlayer(from, { t: 'board', x: s.x, y: s.y });
      break;
    }
    // leaving the boat: it stays on the nearest free sea cell; with nowhere to park it, the player gets the materials back
    case 'unboard': {
      const c0 = ci(m.x, m.y),
        i0 = c0 % COLS,
        j0 = Math.floor(c0 / COLS);
      let c = -1;
      for (let r = 0; r <= 2 && c < 0; r++)
        for (let j = j0 - r; j <= j0 + r && c < 0; j++)
          for (let i = i0 - r; i <= i0 + r; i++) {
            if (i < 0 || j < 0 || i >= COLS || j >= ROWS) continue;
            const k = j * COLS + i;
            if (biome[k] === 0 && !structGrid[k]) {
              c = k;
              break;
            }
          }
      if (c < 0) {
        refund(from, RECIPES.find(r => r.id === 'boat').cost, '船沒地方停，拆回材料了');
        break;
      }
      evt({ t: 'sa', k: 'boat', x: ((c % COLS) + 0.5) * CELL, y: (Math.floor(c / COLS) + 0.5) * CELL });
      break;
    }
    case 'sleep':
      if (!isNight()) break;
      dayT = 0.02;
      day++;
      evt({ t: 'bn', h: `第 ${day} 天`, s: MODE === 'solo' ? '一夜好眠，獲得「休息」' : `${m.n} 睡了一覺，天亮了` });
      for (let i = mobs.length - 1; i >= 0; i--)
        if (mobs[i].k === 'moss' && Math.hypot(mobs[i].x - m.x, mobs[i].y - m.y) < 700) mobs.splice(i, 1);
      break;
    case 'summont': {
      if (boss) {
        refund(from, { 古樹種子: 1 }, '已經有王醒著了');
        break;
      }
      const sp = findSpot(altar.x, altar.y, 140, 200, [1, 2, 3]) || { x: altar.x, y: altar.y - 160 };
      boss = spawnMob('treant', sp.x, sp.y);
      evt({
        t: 'bn',
        h: '樹精長老',
        s: '紅色扇形：樹枝重擊・綠圈：根鬚纏繞・舉手發光：種子投擲・綠光：正在恢復・小樹精：長老的幫手・黑霧：看不清楚，快走出去・樹牆：可以砍掉'
      });
      break;
    }
    case 'plant': {
      const s = structGrid[m.c],
        cr = CROPS[m.k];
      if (!cr) break;
      if (!s || s.k !== 'plot' || s.crop) {
        refund(from, { [cr.seed]: 1 }, '這塊菜圃不能種，種子退回');
        break;
      }
      s.crop = { k: m.k, g: cr.t };
      evt({ t: 'cp', c: m.c, cr: s.crop });
      break;
    }
    case 'harv': {
      const s = structGrid[m.c];
      if (!s || s.k !== 'plot' || !s.crop || s.crop.g > 0) break;
      const cr = CROPS[s.crop.k];
      s.crop = null;
      evt({ t: 'cp', c: m.c, cr: null });
      let dy = 0;
      for (const [k, a, b] of cr.give) {
        giveTo(from, k, dropN(a, b), s.x, s.y - 14 - dy);
        dy += 14;
      }
      break;
    }
    case 'parry': {
      const mob = mobs.find(o => o.id === m.id);
      if (!mob) break;
      mob.stun = mob.k === 'boss' || mob.k === 'treant' ? 1 : 2;
      evt({ t: 'pr', x: mob.x, y: mob.y });
      break;
    }
    case 'shot':
      evt({ t: 'sh', x: m.x, y: m.y, a: m.a, dmg: m.dmg, o: from });
      break;
    case 'summon': {
      if (boss) {
        refund(from, { 獠牙: 3, 樹脂: 5 }, '已經有王醒著了');
        break;
      }
      flags.summoned = true;
      const sp = findSpot(altar.x, altar.y, 140, 200, [1, 2, 3]) || { x: altar.x, y: altar.y - 160 };
      boss = spawnMob('boss', sp.x, sp.y);
      evt({
        t: 'bn',
        h: '灰鬃狼王',
        s: '紅光：衝刺撲擊・橘光：往前三連抓・綠光：原地怒吼，周圍一大圈都會受傷，快跑出圈外或翻滾'
      });
      break;
    }
  }
}
function applyEvt(m) {
  switch (m.t) {
    case 'rh': {
      const o = resGrid[m.c];
      if (!o) break;
      o.hp = m.hp;
      o.flash = 0.15;
      burst(o.x, o.y - 8, RES[o.k].mine ? '#9a9d98' : '#c9a26a', 5);
      break;
    }
    case 'rx': {
      const o = resGrid[m.c];
      if (!o) break;
      const d = RES[o.k];
      resGrid[m.c] = null;
      if (d.pick) burst(o.x, o.y, ITEM[d.drop[0][0]], 6);
      else burst(o.x, o.y - 10, d.mine ? '#8d918c' : '#5d7f3a', 16);
      break;
    }
    case 'ra': {
      const o = addRes(m.k, m.x, m.y, m.c);
      if (m.k === 'etree') {
        o.g = 0;
        burst(m.x, m.y - 6, '#3b4d2a', 10);
      }
      break;
    }
    case 'sp':
      burst(m.x, m.y - 6, '#6f9a4a', 14);
      break;
    case 'et':
      tfx.push({ k: 'bloom', x: m.x, y: m.y - 50, t: 0.8, T: 0.8 });
      floats.push({ x: m.x, y: m.y - 120, txt: `吞食 +${m.h}`, t: 1.2, col: '#9dffb0' });
      burst(m.x, m.y - 60, '#9dffb0', 14);
      break;
    case 'tc':
      floats.push({ x: m.x, y: m.y - 140, txt: m.s, t: 1.4, col: '#c9b6ff' });
      break;
    case 'fg':
      fogs.push({ x: m.x, y: m.y, t: FOG_LIFE });
      burst(m.x, m.y, '#2a1d3a', 18);
      break;
    case 'bd': {
      const o = resGrid[m.c];
      if (o) {
        o.dep = 150;
        burst(o.x, o.y, ITEM['莓果'], 6);
      }
      break;
    }
    case 'sa':
      if ((isWallK(m.k) || !structGrid[ci(m.x, m.y)]) && addStruct(m.k, m.x, m.y, m.o))
        burst(m.x, m.y, m.k === 'swall' || m.k === 'furnace' ? '#9a9d98' : '#c9a26a', 10);
      break;
    case 'bn':
      banner(m.h, m.s);
      break;
    case 'pr':
      burst(m.x, m.y - 14, '#ffe08a', 10);
      break;
    case 'sh':
      shots.push({
        x: m.x,
        y: m.y - 12,
        vx: Math.cos(m.a) * 520,
        vy: Math.sin(m.a) * 520,
        t: WEAPONS['樹精法杖'].range / 520,
        own: m.o === (MODE === 'client' ? myId : ME),
        dmg: m.dmg
      });
      break;
    case 'sd':
      seeds.push({
        id: m.id,
        x: m.x,
        y: m.y,
        vx: Math.cos(m.a) * SEED_SPD,
        vy: Math.sin(m.a) * SEED_SPD,
        t: SEED_LIFE
      });
      break;
    case 'sx': {
      const i = seeds.findIndex(s => s.id === m.id);
      if (i >= 0) {
        burst(seeds[i].x, seeds[i].y - 10, '#8a6a44', 5);
        seeds.splice(i, 1);
      }
      break;
    }
    case 'ts':
      tfx.push({ k: 'slam', x: m.x, y: m.y, a: m.a, t: 0.35, T: 0.35 });
      shake = Math.max(shake, 9);
      burst(m.x + Math.cos(m.a) * 90, m.y + Math.sin(m.a) * 90, '#8a6a44', 16);
      break;
    case 'rm':
      tfx.push({ k: 'mark', x: m.x, y: m.y, t: ROOT_MARK, T: ROOT_MARK });
      break;
    case 'ru':
      tfx.push({ k: 'burst', x: m.x, y: m.y, t: 0.6, T: 0.6 });
      burst(m.x, m.y, '#6f9a4a', 12);
      shake = Math.max(shake, 4);
      break;
    case 'tf':
      floats.push({ x: m.x, y: m.y - 135, txt: '自然恢復', t: 1.4, col: '#9dffb0' });
      burst(m.x, m.y - 60, '#9dffb0', 16);
      break;
    case 'cl':
      slashes.push({ x: m.x, y: m.y, a: m.a, n: m.n, t: 0.3 });
      shake = Math.max(shake, 4);
      break;
    case 'rr':
      rings.push({ x: m.x, y: m.y, t: 0.55 });
      shake = Math.max(shake, 11);
      floats.push({ x: m.x, y: m.y - 56, txt: '吼——！', t: 1, col: '#9dff9a' });
      burst(m.x, m.y, '#9dff9a', 24);
      break;
    case 'mk':
      burst(m.x, m.y, '#6a4a3a', 18);
      if (MODE === 'client') mobs = mobs.filter(o => o.id !== m.id);
      break;
    case 'tm':
      burst(m.x, m.y - 8, '#ff9fb8', 22);
      floats.push({ x: m.x, y: m.y - 30, txt: '♥', t: 1.4, col: '#ff9fb8' });
      if (MODE === 'client') mobs = mobs.filter(o => o.id !== m.id);
      break;
    case 'ld':
      loots.push({ id: m.id, x: m.x, y: m.y, bag: m.bag, g: m.g });
      break;
    case 'sr': {
      const grid = isWallK(m.k) ? (m.o === 'v' ? wallV : wallH) : structGrid,
        c = isWallK(m.k) ? snapWall(m.o === 'v' ? 'v' : 'h', m.x, m.y).c : ci(m.x, m.y),
        s = grid[c];
      if (!s || s.k !== m.k) break;
      grid[c] = null;
      structs.splice(structs.indexOf(s), 1);
      burst(
        s.x,
        s.y - 10,
        m.k === 'wall' || m.k === 'bench' || m.k === 'bed' || m.k === 'boat' ? '#a0703f' : '#9a9d98',
        14
      );
      break;
    }
    case 'fz': {
      const s = structGrid[m.c];
      if (s && s.k === 'furnace') s.fz = normFz(m.f);
      break;
    }
    case 'cfg':
      applyCfg(m.c, true);
      if (MODE === 'client') toast('主機調整了世界數值');
      break;
    case 'cb': {
      const s = structGrid[m.c];
      if (s && s.k === 'chest') s.box = normBox(m.b);
      break;
    }
    case 'cp': {
      const s = structGrid[m.c];
      if (s && s.k === 'plot') {
        s.crop = normCrop(m.cr);
        burst(s.x, s.y, m.cr ? '#6fae3e' : '#e07a2a', 8);
      }
      break;
    }
    case 'lr': {
      const l = loots.find(o => o.id === m.id);
      if (l) {
        loots.splice(loots.indexOf(l), 1);
        burst(l.x, l.y, '#a0703f', 8);
      }
      break;
    }
  }
}
function sendWorld(id) {
  const RK = Object.keys(RES),
    res = [];
  for (const o of resGrid) if (o) res.push([o.cell, RK.indexOf(o.k), o.x, o.y, o.hp, Math.max(0, o.dep)]);
  sendTo(id, {
    t: 'world',
    cfg: CFG,
    mapW: W,
    seed,
    day,
    dt: dayT,
    fs: flags.summoned,
    fb: flags.boss,
    structs: structs.map(s =>
      s.fz
        ? [s.k, s.x, s.y, 0, s.fz]
        : s.box
          ? [s.k, s.x, s.y, 0, s.box]
          : s.crop
            ? [s.k, s.x, s.y, 0, s.crop]
            : s.o
              ? [s.k, s.x, s.y, s.o]
              : [s.k, s.x, s.y]
    ),
    res,
    loots: loots.map(l => [l.id, l.x, l.y, l.bag, l.g || 0]),
    seen: packSeen()
  });
}
function sendSnap() {
  net({
    t: 'snap',
    day,
    dt: dayT,
    fs: flags.summoned,
    fb: flags.boss,
    b: boss ? boss.id : 0,
    wp: worldPaused ? 1 : 0,
    m: mobs.map(m => [
      m.id,
      m.k,
      Math.round(m.x),
      Math.round(m.y),
      Math.round(m.face * 100) / 100,
      Math.max(0, Math.round(m.hp)),
      m.max,
      m.flash > 0 ? 1 : 0,
      m.state,
      m.aggro > 0 ? 1 : 0,
      m.stun > 0 ? 1 : 0
    ])
  });
}
function applySnap(s) {
  day = s.day;
  dayT = s.dt;
  flags.summoned = s.fs;
  flags.boss = s.fb;
  const seen = new Set();
  if (!!s.wp !== worldPaused) {
    worldPaused = !!s.wp;
    $('pauseNote').hidden = !worldPaused;
    atkHeld = blockHeld = false;
    syncPaused();
    toast(worldPaused ? '主機暫停了世界' : '世界繼續了');
  }
  for (const [id, k, x, y, f, hp, max, fl, st, ag, sn] of s.m) {
    seen.add(id);
    let m = mobs.find(o => o.id === id);
    if (!m) {
      m = makeMob(k, x, y);
      m.id = id;
      mobs.push(m);
    }
    m.tx = x;
    m.ty = y;
    m.face = f;
    m.hp = hp;
    m.max = max;
    if (fl) m.flash = 0.15;
    m.state = st;
    m.aggro = ag;
    m.stun = sn ? 0.2 : 0;
  }
  mobs = mobs.filter(m => seen.has(m.id));
  boss = mobs.find(m => m.id === s.b) || null;
}
function sendState() {
  net({
    t: 'st',
    all: 1,
    n: myName,
    x: Math.round(P.x),
    y: Math.round(P.y),
    f: Math.round(P.face * 100) / 100,
    w: P.weapon,
    s: P.swing > 0 ? Math.round(P.swing * 100) / 100 : 0,
    r: P.roll > 0 ? 1 : 0,
    h: P.hurt > 0 ? 1 : 0,
    a: armorLook(),
    em: P.em,
    bl: P.blocking ? 1 : 0,
    sh: eq.off || 0,
    ro: P.rooted > 0 ? 1 : 0,
    d: P.dead ? 1 : 0,
    b: P.boat ? 1 : 0,
    ...petState()
  });
}
function petState() {
  const p = curPet();
  return p
    ? {
        pk: p.k,
        px: Math.round(p.x),
        py: Math.round(p.y),
        pf: Math.round(p.face * 100) / 100,
        ph: Math.ceil(p.hp),
        pg: p.glow > 0 ? 1 : 0,
        pw: p.moving ? 1 : 0
      }
    : {};
}
function updateOther(m) {
  let o = others.get(m.from);
  if (!o) {
    o = { id: m.from, x: m.x, y: m.y, r: 12, walk: 0, inv: 0, swing: 0 };
    others.set(m.from, o);
  }
  o.n = String(m.n || '').slice(0, 10);
  o.tx = m.x;
  o.ty = m.y;
  o.face = m.f;
  o.weapon = WEAPONS[m.w] ? m.w : 'none';
  if (m.s) o.swing = m.s;
  o.roll = m.r ? 0.1 : 0;
  o.hurt = m.h ? 0.1 : 0;
  o.armor = m.a | 0;
  o.rooted = m.ro ? 0.1 : 0;
  o.dead = !!m.d;
  o.boat = !!m.b;
  o.block = !!m.bl;
  o.em = Number.isInteger(m.em) && EMOTES[m.em] ? m.em : -1;
  o.sh = ARMOR[m.sh] ? m.sh : null;
  if (PETS[m.pk]) {
    if (!o.pet || o.pet.k !== m.pk)
      o.pet = { isPet: true, owner: m.from, k: m.pk, x: m.px, y: m.py, r: PETS[m.pk].r, anim: 0, flash: 0, glow: 0 };
    Object.assign(o.pet, { tx: m.px, ty: m.py, face: m.pf, hp: m.ph, moving: !!m.pw });
    if (m.pg) o.pet.glow = Math.max(o.pet.glow, 0.3);
  } else o.pet = null;
}
function tickOthers(dt) {
  for (const o of others.values()) {
    const dx = o.tx - o.x,
      dy = o.ty - o.y,
      l = Math.hypot(dx, dy),
      k = Math.min(1, dt * 15);
    if (l > 300) {
      o.x = o.tx;
      o.y = o.ty;
    } else {
      o.x += dx * k;
      o.y += dy * k;
    }
    if (l > 1) o.walk += dt * 9;
    o.swing -= dt;
    burnTick(o, dt);
    const p = o.pet;
    if (p) {
      burnTick(p, dt);
      if (Math.hypot(p.tx - p.x, p.ty - p.y) > 300) {
        p.x = p.tx;
        p.y = p.ty;
      } else {
        p.x += (p.tx - p.x) * k;
        p.y += (p.ty - p.y) * k;
      }
      p.anim += dt;
      p.flash -= dt;
      p.glow -= dt;
    }
  }
}
function tickClient(dt) {
  time += dt;
  dayT = Math.min(0.9999, dayT + dt / DAY_LEN);
  for (const s of structs) if (s.crop && s.crop.g > 0) s.crop.g = Math.max(0.01, s.crop.g - dt * CFG.cropSpeed);
  for (const s of structs)
    if (s.fz && s.fz.burn > 0) {
      s.fz.burn = Math.max(0, s.fz.burn - dt * CFG.smeltSpeed);
      if (Object.keys(s.fz.q).length) s.fz.prog = Math.min(SMELT_T, s.fz.prog + dt * CFG.smeltSpeed);
    }
  for (const m of mobs) {
    m.anim += dt;
    m.flash -= dt;
    burnTick(m, dt);
    const k = Math.min(1, dt * 12);
    m.x += (m.tx - m.x) * k;
    m.y += (m.ty - m.y) * k;
  }
  for (const s of structs) s.anim += dt;
}
let netT = 0,
  snapT = 0,
  bushT = 0,
  fogT = 0;
function netTick(dt) {
  netT -= dt;
  if (netT <= 0 && started) {
    netT = 1 / 15;
    sendState();
  }
  fogT -= dt;
  if (fogT <= 0 && fogNew.length) {
    fogT = 0.25;
    net({ t: 'fog', all: 1, c: fogNew });
    fogNew = [];
  }
  if (MODE === 'host') {
    snapT -= dt;
    if (snapT <= 0) {
      snapT = 0.1;
      sendSnap();
    }
  }
  bushT -= dt;
  if (bushT <= 0) {
    bushT = 1;
    for (const o of resGrid) if (o && o.dep > 0) o.dep -= 1;
  }
}
// admin page commands, run by the server-run world; returns an error message or nothing
const ADMIN_TIME = { morning: 0.02, noon: 0.3, dusk: 0.6, night: 0.72 };
function adminDo(m) {
  switch (m.c) {
    case 'pause':
      worldPaused = true;
      break;
    case 'resume':
      worldPaused = false;
      break;
    case 'time':
      if (!(m.v in ADMIN_TIME)) return '不認得的時間';
      dayT = ADMIN_TIME[m.v];
      break;
    // every mob except the awake boss and its saplings; they come back the usual way
    case 'clearMobs':
      for (const o of mobs.filter(o => o !== boss && !(boss && o.k === 'sprout')))
        evt({ t: 'mk', id: o.id, x: o.x, y: o.y });
      mobs = mobs.filter(o => o === boss || (boss && o.k === 'sprout'));
      break;
    // the boss just leaves (no loot); the treant's saplings and tree walls go with it
    case 'endBoss': {
      if (!boss) return '現在沒有王醒著';
      const k = boss.k;
      mobs = mobs.filter(o => o !== boss && o.k !== 'sprout');
      for (const e of etrees) e.at = 0;
      boss = null;
      flags.summoned = flags.boss;
      evt({ t: 'bn', h: k === 'treant' ? '樹精長老離開了' : '灰鬃狼王離開了', s: '主機結束了這場王戰' });
      break;
    }
    case 'setCfg':
      applyCfg(m.reset ? {} : Object.assign({}, CFG, m.v && typeof m.v === 'object' ? m.v : {}));
      evt({ t: 'cfg', c: CFG });
      writeSave();
      break;
    case 'announce': {
      const t = String(m.v || '')
        .trim()
        .slice(0, 40)
        .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
      if (!t) return '公告是空的';
      evt({ t: 'bn', h: t, s: '主機公告' });
      break;
    }
  }
}
function netMsg(t) {
  $('netTxt').textContent = t;
  $('netbox').hidden = !t;
}
function onNet(m) {
  switch (m.t) {
    case 'hello':
      myId = m.id;
      netInfo = m;
      if (m.role === 'host') {
        MODE = 'host';
        bootHost(m.world);
      } else {
        MODE = 'client';
        if (!m.hostReady) netMsg('等待主機開啟世界…（主機那台電腦要先執行「開主機.bat」）');
      }
      return;
    case 'host':
      if (MODE === 'client') {
        writeSave();
        location.reload();
      }
      return;
    case 'nohost':
      writeSave();
      netMsg('主機離線了。主機回來後會自動重新連上。');
      return;
    case 'leave':
      others.delete(m.id);
      return;
    case 'peer':
      if (MODE === 'host' && ready) sendWorld(m.id);
      return;
    case 'world':
      if (MODE === 'client' && !ready) {
        netMsg('');
        bootClient(m);
      }
      return;
    case 'login':
      onLogin(m);
      return;
    case 'saved':
      try {
        localStorage.removeItem(m.k === 'w' ? WKEY : pkey());
      } catch (e) {}
      return;
    case 'wiped':
      location.reload();
      return;
    case 'kicked':
      kicked = true;
      noSave = true;
      netMsg(m.why || '你的名字在別的分頁或電腦登入了，這裡已經離線。');
      return;
  }
  if (m.t === 'fog') {
    if (Array.isArray(m.c)) ready ? seeCells(m.c) : fogPend.push(...m.c);
    return;
  }
  if (!ready) return;
  // the admin page (server.js /admin) asks the world how it is doing; only the server-run world answers
  if (m.t === 'adm') {
    if (MODE === 'host') {
      const err = adminDo(m);
      net({
        t: 'admr',
        q: m.q,
        d: {
          seed,
          mapW: W,
          day,
          dayT,
          night: isNight(),
          paused: worldPaused,
          mobs: mobs.length,
          boss: boss ? (boss.k === 'treant' ? '樹精長老' : '灰鬃狼王') : null,
          structs: structs.length,
          loots: loots.length,
          cfg: CFG,
          cfgDef: m.c === 'info' ? undefined : { num: CFG_DEF, bool: CFG_BOOL, death: CFG_DEATH },
          err
        }
      });
    }
    return;
  }
  if (m.t === 'st') {
    updateOther(m);
    return;
  }
  if (m.t === 'ping') {
    addPing(m);
    return;
  }
  if (MODE === 'host') {
    handleAct(m, m.from);
    return;
  }
  switch (m.t) {
    case 'snap':
      applySnap(m);
      break;
    case 'give':
      if (started) give(m.k, m.n, m.x, m.y, m.p);
      break;
    case 'refund':
      for (const k in m.cost) inv[k] = (inv[k] || 0) + m.cost[k];
      toast(m.msg);
      break;
    case 'hurt':
      if (started) hitPlayer(m.dmg, m);
      break;
    case 'phurt':
      if (started) hurtPet(m.dmg, m);
      break;
    case 'love':
    case 'tame':
    case 'pup':
    case 'tdown':
    case 'board':
      if (started) onPrivate(m);
      break;
    case 'root':
      if (started) rootPlayer(m.d);
      break;
    default:
      applyEvt(m);
  }
}
function connect() {
  try {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  } catch (e) {
    bootSolo();
    return;
  }
  ws.onmessage = e => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch (_) {
      return;
    }
    onNet(m);
  };
  ws.onclose = () => {
    if (MODE === 'pending') {
      bootSolo();
      return;
    }
    if (kicked) return;
    writeSave();
    netMsg('跟主機的連線斷了，重新連線中…');
    retry();
  };
}
function retry() {
  setTimeout(() => fetch(location.href, { cache: 'no-store' }).then(() => location.reload(), retry), 3000);
}

/* ---------- effects ---------- */
function burst(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28,
      s = rnd(30, 140);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rnd(0.3, 0.7), col, s: rnd(1.5, 3.5) });
  }
}
