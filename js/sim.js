// 北境求生 · sim.js：世界模擬（怪物、王、熔爐、作物）、本地玩家更新、特效更新、寵物
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- update ---------- */
const cam = { x: P.x, y: P.y };
function camY() {
  return cam.y;
}
let spawnT = 0,
  regrowT = 0,
  saveT = 0,
  hudT = 0,
  TG = [];
function nearCount(k, T) {
  let n = 0;
  for (const m of mobs)
    if (m.k === k && (W <= OLD_MAP || (T && Math.abs(m.x - T.x) < 1500 && Math.abs(m.y - T.y) < 1500))) n++;
  return n;
}
function targets() {
  const t = [];
  if (started && !P.dead) t.push(P);
  for (const o of others.values()) if (!o.dead) t.push(o);
  return t;
}
// world simulation: runs in solo and on the host only
function updateWorld(dt) {
  time += dt;
  dayT += dt / DAY_LEN;
  if (dayT >= 1) {
    dayT -= 1;
    day++;
    evt({ t: 'bn', h: `第 ${day} 天` });
  }
  TG = targets();
  // mobs
  for (const m of mobs) updateMob(m, dt);
  // night spawns
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnT = 5;
    const T = TG[Math.floor(Math.random() * TG.length)],
      mossN = nearCount('moss', T);
    const MC = CFG.mobCount,
      NC = CFG.mobCount * CFG.nightMobs;
    if (T && isNight() && mossN < (5 + Math.min(day, 6)) * NC) {
      const s = findSpot(T.x, T.y, 480, 620);
      if (s) spawnMob('moss', s.x, s.y);
    }
    // the magic forest swarms with moss at night: more of them, spawned inside the forest
    if (T && isNight() && biomeAt(T.x, T.y) === B_MAGIC && mossN < (12 + Math.min(day, 6)) * NC)
      for (let n = 0; n < 2; n++) {
        const s = findSpot(T.x, T.y, 380, 620, [B_MAGIC]);
        if (s) spawnMob('moss', s.x, s.y);
      }
    if (T && nearCount('boar', T) < 18 * MC && mobs.length < 220 * Math.max(1, MC)) {
      const s = findSpot(T.x, T.y, 600, 1100, [2]);
      if (s) spawnMob('boar', s.x, s.y);
    }
    if (T && nearCount('frog', T) < 4 * MC && mobs.length < 220 * Math.max(1, MC)) {
      const s = findSpot(T.x, T.y, 600, 1100, [1, 3]);
      if (s) spawnMob('frog', s.x, s.y);
    }
    if (!isNight())
      for (let i = mobs.length - 1; i >= 0; i--) {
        const m = mobs[i];
        if (m.k === 'moss' && TG.every(t => dist(m, t) > 750) && biome[ci(m.x, m.y)] !== 3 && Math.random() < 0.3)
          mobs.splice(i, 1);
      }
  }
  regrowT -= dt;
  if (regrowT <= 0) {
    regrowT = 2;
    for (let i = regrow.length - 1; i >= 0; i--) {
      const g = regrow[i];
      if (
        time >= g.at &&
        !resGrid[g.cell] &&
        !structGrid[g.cell] &&
        TG.every(t => Math.hypot(g.x - t.x, g.y - t.y) > 360)
      ) {
        evt({ t: 'ra', k: g.k, x: g.x, y: g.y, c: g.cell });
        regrow.splice(i, 1);
      }
    }
  }
  for (let i = etrees.length - 1; i >= 0; i--) {
    const e = etrees[i],
      o = resGrid[e.c];
    if (!o || o.k !== 'etree') etrees.splice(i, 1);
    else if (time >= e.at) {
      evt({ t: 'rx', c: e.c });
      etrees.splice(i, 1);
    }
  }
  for (const s of structs) s.anim += dt;
  // treant seeds: positions move in updateFx on every client, hits are decided here
  for (const s of seeds) {
    const h = TG.find(q => dist(s, q) < q.r + 7);
    if (h) {
      hurt(h, SEED_DMG, s);
      evt({ t: 'sx', id: s.id });
    }
  }
  tickFurnaces(dt);
  // crops grow on their own; everyone is told once, when one is ripe (clients count down by themselves in between)
  for (const s of structs)
    if (s.crop && s.crop.g > 0) {
      s.crop.g -= dt * CFG.cropSpeed;
      if (s.crop.g <= 0) {
        s.crop.g = 0;
        evt({ t: 'cp', c: s.cell, cr: s.crop });
      }
    }
}
// solo / host: a lit coal burns down whether or not there is ore; a new coal is lit only when there is ore waiting
function tickFurnaces(dt) {
  for (const s of structs) {
    if (s.k !== 'furnace') continue;
    const f = s.fz,
      busy = Object.values(f.q).some(n => n > 0);
    let ch = false;
    if (busy && f.burn <= 0 && f.fuel > 0) {
      f.fuel--;
      f.burn = COAL_T;
      ch = true;
    }
    if (f.burn > 0) {
      f.burn -= dt * CFG.smeltSpeed;
      if (busy) {
        f.prog += dt * CFG.smeltSpeed;
        if (f.prog >= SMELT_T) {
          f.prog = 0;
          const k = Object.keys(f.q).find(k => f.q[k] > 0);
          if (!--f.q[k]) delete f.q[k];
          f.out[SMELT[k]] = (f.out[SMELT[k]] || 0) + 1;
          ch = true;
        }
      }
      if (f.burn <= 0) {
        f.burn = 0;
        ch = true;
      }
    }
    if (!busy) f.prog = 0;
    if (ch) evt({ t: 'fz', c: s.cell, f });
  }
}
function updateLocal(dt) {
  // input → movement
  let mx = 0,
    my = 0,
    sprint = false;
  if (TOUCH) {
    mx = joy.dx;
    my = joy.dy;
    sprint = Math.hypot(mx, my) > 0.95;
  } else {
    mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    sprint = keys.ShiftLeft || keys.ShiftRight;
  }
  if (P.rooted > 0) {
    P.rooted -= dt;
    mx = my = 0;
    sprint = false;
  }
  if (P.stag > 0) {
    P.stag -= dt;
    mx = my = 0;
    sprint = false;
  } // guard broken
  P.blocking = P.block = blockHeld && !(P.roll > 0) && !P.boat && !(P.stag > 0) && !placing;
  P.blockT = P.blocking ? (P.blockT || 0) + dt : 0;
  const ml = Math.hypot(mx, my);
  if (P.emT > 0) {
    P.emT -= dt;
    if (P.emT <= 0 || (P.em === DANCE && ml > 0.1)) {
      P.em = -1;
      P.emT = 0;
    }
  }
  if (!TOUCH && mouse.on) {
    const w = worldMouse();
    P.face = Math.atan2(w.y - P.y, w.x - P.x);
  } else if (ml > 0.15) P.face = Math.atan2(my, mx);
  if (P.roll > 0) {
    P.roll -= dt;
    move(P, P.rdx * 360 * dt, P.rdy * 360 * dt);
  } else if (ml > 0.1) {
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    let spd = P.blocking ? 60 : 118;
    if (sprint && !P.blocking && P.st > 1) {
      spd = 185;
      P.st -= 11 * dt * (biomeAt(P.x, P.y) === B_SNOW ? SNOW_ST : 1) * skCut('run', 0.006);
      P.stDelay = 0.6;
      if ((P.runT = (P.runT || 0) + dt) >= 2) {
        P.runT = 0;
        skXP('run');
      }
    }
    P.walk += dt * (spd / 14);
    move(P, mx * spd * dt, my * spd * dt);
  }
  // stats
  P.cd -= dt;
  P.swing -= dt;
  P.inv -= dt;
  P.hurt -= dt;
  P.stDelay -= dt;
  if (atkHeld && !placing && !P.blocking && !(P.stag > 0)) attack();
  const MH = maxHp(),
    MS = maxSt();
  if (P.stDelay <= 0) P.st = Math.min(MS, P.st + (P.rest > 0 ? 22 : 14) * (P.blocking ? 0.5 : 1) * dt);
  const regen = EQ_SLOTS.reduce((a, [sl]) => a + ((eq[sl] && ARMOR[eq[sl]].regen) || 0), 0);
  P.hp = Math.min(MH, P.hp + (0.35 + foods.length * 0.45 + regen) * dt);
  P.st = Math.min(P.st, MS);
  for (let i = foods.length - 1; i >= 0; i--) {
    foods[i].t -= dt;
    if (foods[i].t <= 0) {
      toast(foods[i].k + '的效果消退了');
      foods.splice(i, 1);
    }
  }
  if (P.rest > 0) P.rest -= dt;
  if (!P.dead) {
    const was = P.burn > 0;
    if (burnTick(P, dt)) {
      if (!was) toast('踩到熔岩，著火了！');
      P.hp -= BURN_DPS * dt;
      if (P.hp <= 0) {
        P.hp = 0;
        die();
      }
    }
  }
  const nearFire = structs.some(s => s.k === 'fire' && dist(s, P) < 150);
  P.comfort = nearFire ? comfortAt(P.x, P.y) : 0;
  if (nearFire) {
    P.restT += dt;
    const D = restDur(P.comfort);
    if (P.restT > 3 && P.rest < D - 60) {
      if (P.rest <= 0) toast(`獲得「休息」（舒適度 ${P.comfort}）`);
      P.rest = D;
      P.restLv = P.comfort;
    }
  } else P.restT = 0;
}
function updateFx(dt) {
  if (!HEADLESS) sea.update(dt);
  // particles
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.9;
    p.vy *= 0.9;
    if (p.t <= 0) parts.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t -= dt;
    f.y -= 22 * dt;
    if (f.t <= 0) floats.splice(i, 1);
  }
  pingCd -= dt;
  for (let i = pings.length - 1; i >= 0; i--) if ((pings[i].t -= dt) <= 0) pings.splice(i, 1);
  for (let i = slashes.length - 1; i >= 0; i--) if ((slashes[i].t -= dt) <= 0) slashes.splice(i, 1);
  for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].t -= dt) <= 0) rings.splice(i, 1);
  for (let i = tfx.length - 1; i >= 0; i--) if ((tfx[i].t -= dt) <= 0) tfx.splice(i, 1);
  for (let i = seeds.length - 1; i >= 0; i--) {
    const s = seeds[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if ((s.t -= dt) <= 0) seeds.splice(i, 1);
  }
  // staff shots: the shooter's own client decides the hit, the treant's body counts as well as its feet
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    let gone = (s.t -= dt) <= 0;
    if (!gone && s.own)
      for (const m of mobs) {
        const by =
          m.k === 'treant' ? Math.min(Math.abs(s.y - m.y), Math.abs(s.y - (m.y - 60))) : Math.abs(s.y + 12 - m.y);
        if (Math.hypot(s.x - m.x, by) < m.r + 8) {
          skXP('ranged');
          floats.push(
            shielded(m)
              ? { x: m.x, y: m.y - m.r - 8, txt: '無敵', t: 0.8, col: '#9dffb0' }
              : { x: m.x, y: m.y - m.r - 8, txt: String(s.dmg), t: 0.8, col: '#ffe9b8' }
          );
          act({ t: 'hit', id: m.id, dmg: s.dmg, x: s.x, y: s.y });
          gone = true;
          break;
        }
      }
    if (gone) {
      burst(s.x, s.y, '#9dffb0', 6);
      shots.splice(i, 1);
    }
  }
  // the treant leaves roots behind wherever it walks
  for (const m of mobs)
    if (m.k === 'treant') {
      if (m.lrx === undefined || Math.hypot(m.x - m.lrx, m.y - m.lry) > 20) {
        if (m.lrx !== undefined) {
          rootTrail.push({
            x: m.x,
            y: m.y + 2,
            a: Math.atan2(m.y - m.lry, m.x - m.lrx),
            s: hash(rootTrail.length, seedSeq, 7),
            t: 7
          });
          if (rootTrail.length > 70) rootTrail.shift();
        }
        m.lrx = m.x;
        m.lry = m.y;
      }
    }
  for (let i = rootTrail.length - 1; i >= 0; i--) if ((rootTrail[i].t -= dt) <= 0) rootTrail.splice(i, 1);
  // black fog: each client checks its own player; inside it the view shrinks to BLIND_R
  for (let i = fogs.length - 1; i >= 0; i--) if ((fogs[i].t -= dt) <= 0) fogs.splice(i, 1);
  if (
    (MODE === 'solo' || started) &&
    !P.dead &&
    fogs.some(f => FOG_LIFE - f.t > 0.4 && Math.hypot(P.x - f.x, P.y - f.y) < FOG_CR)
  ) {
    if (!(P.blind > 0)) toast('被黑霧籠罩，看不清楚了！');
    P.blind = 1.2;
  }
  P.blind = (P.blind || 0) - dt;
  P.blindK = (P.blindK || 0) + ((P.blind > 0 ? 1 : 0) - (P.blindK || 0)) * Math.min(1, dt * 4);
  // devour: fade the magic in and out, spiral leaves into the elder, leaf sparks behind the recalled saplings
  for (const m of mobs)
    if (m.k === 'treant') {
      m.eatFx = m.state === 'eat' ? Math.min(1, (m.eatFx || 0) + dt * 3) : Math.max(0, (m.eatFx || 0) - dt * 2);
      if (m.state === 'eat' && Math.random() < dt * 28)
        leaves.push({
          cx: m.x,
          cy: m.y - 40,
          a: Math.random() * 6.28,
          r: 110 + Math.random() * 40,
          t: 1.1,
          spin: Math.random() * 6,
          col: LEAF_COL[(Math.random() * 3) | 0]
        });
    } else if (m.k === 'sprout' && m.state === 'recall' && Math.random() < dt * 14)
      parts.push({
        x: m.x + rnd(-6, 6),
        y: m.y - 10 + rnd(-6, 6),
        vx: rnd(-10, 10),
        vy: -30,
        t: 0.7,
        col: Math.random() < 0.5 ? '#9dffb0' : '#6fd06f',
        s: 2.4
      });
  for (let i = leaves.length - 1; i >= 0; i--) {
    const l = leaves[i];
    l.t -= dt;
    l.a += dt * 3.2;
    l.r -= dt * 105;
    l.spin += dt * 9;
    if (l.t <= 0 || l.r < 8) leaves.splice(i, 1);
  }
  shake = Math.max(0, shake - dt * 30);
  cam.x += (P.x - cam.x) * Math.min(1, dt * 8);
  cam.y += (P.y - cam.y) * Math.min(1, dt * 8);
  saveT -= dt;
  if (saveT <= 0) {
    saveT = 8;
    writeSave();
  }
  toastT -= dt;
  if (toastT <= 0) $('toast').classList.remove('on');
  bannerT -= dt;
  if (bannerT <= 0) $('banner').classList.remove('on');
}
// a mob that burns to death drops nothing (nobody hit it), but the bosses still go through killMob so their loot and flags work
function burnMob(m, dt) {
  if (!burnTick(m, dt)) return false;
  if (!shielded(m)) m.hp -= BURN_MOB_DPS * dt;
  if (m.hp > 0) return false;
  if (m.k === 'boss' || m.k === 'treant') {
    killMob(m, ME);
    return true;
  }
  const i = mobs.indexOf(m);
  if (i >= 0) {
    mobs.splice(i, 1);
    evt({ t: 'mk', id: m.id, x: m.x, y: m.y });
  }
  return true;
}
const lavaAhead = (m, dx, dy) => biomeAt(m.x + dx * m.r * 2, m.y + dy * m.r * 2) === B_LAVA;
function updateMob(m, dt) {
  if (burnMob(m, dt)) return;
  if (m.stun > 0) {
    m.stun -= dt;
    m.anim += dt;
    m.flash -= dt;
    return;
  } // parried: frozen, takes extra damage
  m.anim += dt;
  m.acd -= dt;
  m.flash -= dt;
  m.aggro -= dt;
  if (m.kx || m.ky) {
    move(m, m.kx * dt, m.ky * dt);
    m.kx *= 0.82;
    m.ky *= 0.82;
    if (Math.abs(m.kx) < 4) m.kx = 0;
    if (Math.abs(m.ky) < 4) m.ky = 0;
  }
  let T = null,
    d = 1e9;
  if (m.petT && time < m.petT.until) {
    const pt = petOf(m.petT.o);
    if (pt) {
      T = pt;
      d = dist(m, pt);
    }
  }
  if (!T)
    for (const t of TG) {
      const e = dist(m, t);
      if (e < d) {
        d = e;
        T = t;
      }
    }
  const a = T ? Math.atan2(T.y - m.y, T.x - m.x) : 0;
  if (m.k === 'boss') {
    updateBoss(m, dt, d, a, T);
    return;
  }
  if (m.k === 'treant') {
    updateTreant(m, dt, d, a, T);
    return;
  }
  if (m.k === 'frog') {
    updateFrog(m, dt, d, a, T);
    return;
  }
  if (m.state === 'recall') {
    if (boss) {
      const b = Math.atan2(boss.y - m.y, boss.x - m.x);
      m.face = b;
      moveTreant(m, Math.cos(b) * RECALL_SPD * dt, Math.sin(b) * RECALL_SPD * dt);
      return;
    }
    m.state = 'idle';
  }
  const chase =
    T && (m.k === 'boar' ? m.aggro > 0 && d < 520 : (!CFG.passive && d < (isNight() ? 560 : 340)) || m.aggro > 0); // passive: only fights back
  if (chase) {
    m.face = a;
    const spd = m.k === 'boar' ? 108 : m.spd;
    if (d > m.r + T.r + 2) move(m, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt);
    if (d < m.r + T.r + 6 && m.acd <= 0) {
      hurt(T, m.k === 'boar' ? 7 : 5, m);
      m.acd = m.k === 'boar' ? 1.3 : 1.0;
    }
  } else {
    m.wt -= dt;
    if (m.wt <= 0) {
      m.wt = rnd(1.5, 4);
      const go = Math.random() < 0.6;
      m.wx = go ? Math.cos((m.face = Math.random() * 6.28)) : 0;
      m.wy = go ? Math.sin(m.face) : 0;
    }
    if (lavaAhead(m, m.wx, m.wy)) {
      m.wx = m.wy = 0;
      m.wt = 0;
      return;
    } // wandering mobs keep out of lava; chasing ones don't look
    const bx = m.x,
      by = m.y;
    move(m, m.wx * m.spd * 0.6 * dt, m.wy * m.spd * 0.6 * dt);
    if (m.x === bx && m.y === by) m.wt = 0;
  }
}
// nai-frog: gets around in hops, leaves you alone until you hit it
const HOP_T = 0.42;
function updateFrog(m, dt, d, a, T) {
  const chase = T && m.aggro > 0 && d < 520;
  m.t -= dt;
  if (chase && d < m.r + T.r + 6 && m.acd <= 0) {
    hurt(T, 6, m);
    m.acd = 1.2;
  }
  if (m.state === 'hop') {
    const bx = m.x,
      by = m.y;
    move(m, m.wx * dt, m.wy * dt);
    if (m.t <= 0 || (m.x === bx && m.y === by)) {
      m.state = 'idle';
      m.t = chase ? rnd(0.12, 0.3) : rnd(0.8, 2.6);
    }
  } else if (m.t <= 0) {
    if (chase && d < m.r + T.r + 2) {
      m.t = 0.2;
      m.face = a;
      return;
    }
    let go = chase ? a : Math.random() * 6.28;
    if (!chase && lavaAhead(m, Math.cos(go) * 3, Math.sin(go) * 3)) go += Math.PI;
    const s = chase ? 170 : 75;
    m.face = go;
    m.wx = Math.cos(go) * s;
    m.wy = Math.sin(go) * s;
    m.state = 'hop';
    m.t = HOP_T;
  }
}
function hurt(T, dmg, src) {
  dmg *= CFG.mobDmg;
  if (T.isPet) {
    if (T.owner === ME) hurtPet(dmg, src);
    else sendTo(T.owner, { t: 'phurt', dmg, x: src.x, y: src.y });
    return;
  }
  if (T === P) hitPlayer(dmg, src);
  else sendTo(T.id, { t: 'hurt', dmg, x: src.x, y: src.y, id: src.id });
}
// Wolf King claw combo: three short lunges, each ending in a swipe in front of it
const CLAW_LUNGE = 0.14,
  CLAW_SPD = 430,
  CLAW_PAUSE = 0.24,
  CLAW_DMG = 12,
  CLAW_ARC = 1.0;
// roar: green glow in place, then a hit on everyone within ROAR_R around it
const ROAR_R = 180,
  ROAR_DMG = 15,
  ROAR_WIND = 0.9;
function bossRoar(m, T) {
  const L = T && !TG.includes(T) ? [...TG, T] : TG;
  for (const t of L) if (dist(m, t) < ROAR_R + t.r) hurt(t, ROAR_DMG, m);
  evt({ t: 'rr', x: Math.round(m.x), y: Math.round(m.y) });
}
function clawSwipe(m, T) {
  const L = T && !TG.includes(T) ? [...TG, T] : TG;
  for (const t of L)
    if (dist(m, t) < m.r + t.r + 40 && angDiff(Math.atan2(t.y - m.y, t.x - m.x), m.face) < CLAW_ARC)
      hurt(t, CLAW_DMG, m);
  evt({ t: 'cl', x: Math.round(m.x), y: Math.round(m.y), a: Math.round(m.face * 100) / 100, n: m.cn });
}
function updateBoss(m, dt, d, a, T) {
  if (Math.hypot(m.x - altar.x, m.y - altar.y) > 1100 || d > 1000) {
    m.face = Math.atan2(altar.y - m.y, altar.x - m.x);
    move(m, Math.cos(m.face) * m.spd * dt, Math.sin(m.face) * m.spd * dt);
    m.hp = Math.min(m.max, m.hp + 30 * dt);
    return;
  }
  m.howlT -= dt;
  if (m.howlT <= 0) {
    m.howlT = 15;
    if (m.state === 'chase') {
      m.state = 'howl';
      m.t = 0.9;
    }
    for (let i = 0; i < 2; i++) {
      const s = findSpot(m.x, m.y, 60, 140);
      if (s) spawnMob('moss', s.x, s.y).aggro = 30;
    }
    floats.push({ x: m.x, y: m.y - 46, txt: '嗷——', t: 1.2, col: '#cfe3ef' });
    shake = 6;
  }
  if (m.state === 'chase') {
    m.face = a;
    if (d > m.r + T.r) move(m, Math.cos(a) * m.spd * dt, Math.sin(a) * m.spd * dt);
    if (d < m.r + T.r + 8 && m.acd <= 0) {
      hurt(T, 11, m);
      m.acd = 1.2;
    }
    m.atkT -= dt;
    if (m.atkT <= 0 && d < 340) {
      const opts = ['dash'];
      if (d < 170) opts.push('claw');
      if (d < ROAR_R + 20) opts.push('roar');
      const o = opts.length > 1 ? opts.filter(k => k !== m.lastAtk) : opts,
        k = o[Math.floor(Math.random() * o.length)];
      m.lastAtk = k;
      m.face = a;
      if (k === 'claw') {
        m.state = 'cwind';
        m.t = 0.5;
      } else if (k === 'roar') {
        m.state = 'rwind';
        m.t = ROAR_WIND;
      } else {
        m.state = 'wind';
        m.t = 0.7;
      }
    }
  } else if (m.state === 'rwind') {
    m.t -= dt;
    if (m.t <= 0) {
      bossRoar(m, T);
      m.state = 'rrec';
      m.t = 0.45;
    }
  } else if (m.state === 'rrec') {
    m.t -= dt;
    if (m.t <= 0) {
      m.state = 'chase';
      m.atkT = rnd(1.4, 2.4);
    }
  } else if (m.state === 'cwind') {
    m.t -= dt;
    m.face = a;
    if (m.t <= 0) {
      m.state = 'claw';
      m.cn = 0;
      m.cph = 'lunge';
      m.t = CLAW_LUNGE;
    }
  } else if (m.state === 'claw') {
    m.t -= dt;
    if (m.cph === 'lunge') {
      move(m, Math.cos(m.face) * CLAW_SPD * dt, Math.sin(m.face) * CLAW_SPD * dt);
      if (m.t <= 0) {
        clawSwipe(m, T);
        m.cn++;
        if (m.cn >= 3) {
          m.state = 'chase';
          m.atkT = rnd(1.4, 2.4);
        } else {
          m.cph = 'pause';
          m.t = CLAW_PAUSE;
        }
      }
    } else {
      const df = Math.atan2(Math.sin(a - m.face), Math.cos(a - m.face));
      m.face += Math.max(-4 * dt, Math.min(4 * dt, df)); // turns toward you, but not instantly
      if (m.t <= 0) {
        m.cph = 'lunge';
        m.t = CLAW_LUNGE;
      }
    }
  } else if (m.state === 'howl') {
    m.t -= dt;
    if (m.t <= 0) {
      m.state = 'chase';
      m.atkT = Math.max(m.atkT, 0.6);
    }
  } else if (m.state === 'wind') {
    m.t -= dt;
    m.face = a;
    if (m.t <= 0) {
      m.state = 'dash';
      m.t = 0.42;
      m.hitDash = false;
    }
  } else if (m.state === 'dash') {
    m.t -= dt;
    move(m, Math.cos(m.face) * 500 * dt, Math.sin(m.face) * 500 * dt);
    if (!m.hitDash && d < m.r + T.r + 6) {
      hurt(T, 18, m);
      m.hitDash = true;
    }
    if (m.t <= 0) {
      m.state = 'chase';
      m.atkT = rnd(1.4, 2.4);
    }
  }
}

// Treant: slow; every skill stops it and shows a tell first
const TR_SLAM_R = 146,
  TR_SLAM_ARC = 0.95,
  TR_SLAM_DMG = 20,
  ROOT_R = 57,
  ROOT_T = 1.6,
  ROOT_DMG = 6,
  ROOT_MARK = 0.8,
  SEED_N = 5,
  SEED_SPD = 250,
  SEED_DMG = 7,
  SEED_LIFE = 2.2,
  TR_CAST_R = 560;
// Treant Elder: calls saplings, casts black fog (shrinks the view of whoever stands in it), grows a ring of choppable trees around you
const LEAF_COL = ['#7fd98a', '#b6ff9a', '#4f9a3a'],
  FOG_CR = 150,
  FOG_LIFE = 7,
  BLIND_R = 105,
  ETREE_LIFE = 30,
  EAT_T = 15,
  EAT_WAIT = 4,
  EAT_HEAL = 0.1,
  RECALL_SPD = 170,
  TR_SAY = { call: '孩子們，來！', fog: '黑霧…', grow: '森林啊，困住他們' };
// a ring of trees around T with one gap; only on open land, never on anyone
function growWall(T) {
  const i0 = Math.floor(T.x / CELL),
    j0 = Math.floor(T.y / CELL),
    gap = Math.random() * 6.28;
  for (let j = j0 - 4; j <= j0 + 4; j++)
    for (let i = i0 - 4; i <= i0 + 4; i++) {
      if (i < 0 || j < 0 || i >= COLS || j >= ROWS) continue;
      const x = (i + 0.5) * CELL,
        y = (j + 0.5) * CELL,
        r = Math.hypot(x - T.x, y - T.y),
        c = j * COLS + i;
      if (
        r < 92 ||
        r > 132 ||
        angDiff(Math.atan2(y - T.y, x - T.x), gap) < 0.55 ||
        !biome[c] ||
        biome[c] === B_LAVA ||
        resGrid[c] ||
        structGrid[c] ||
        c === altar.cell ||
        TG.some(q => Math.hypot(q.x - x, q.y - y) < q.r + 22)
      )
        continue;
      evt({ t: 'ra', k: 'etree', x: Math.round(x + rnd(-4, 4)), y: Math.round(y + rnd(-4, 4)), c });
      etrees.push({ c, at: time + ETREE_LIFE });
    }
}
// phase 2: saplings still alive EAT_T after a call are called back and eaten, each one heals EAT_HEAL of max hp
function eatSprout(m, s) {
  const i = mobs.indexOf(s);
  if (i < 0) return;
  mobs.splice(i, 1);
  const h = Math.round(m.max * EAT_HEAL);
  m.hp = Math.min(m.max, m.hp + h);
  evt({ t: 'mk', id: s.id, x: s.x, y: s.y });
  evt({ t: 'et', x: Math.round(m.x), y: Math.round(m.y), h });
}
function rootPlayer(dur) {
  if (P.roll > 0 || P.inv > 0 || P.dead) return;
  P.rooted = dur;
  toast('被根鬚纏住了！');
}
// the treant is the forest walking: trees, rocks and walls don't stop it (at its size it could never fit between them); only water does
function moveTreant(m, dx, dy) {
  if (biomeAt(m.x, m.y) === B_SWAMP) {
    dx *= SWAMP_K;
    dy *= SWAMP_K;
  }
  if (!isWater(m.x + dx, m.y)) m.x += dx;
  if (!isWater(m.x, m.y + dy)) m.y += dy;
}
function treantList(T) {
  return T && !TG.includes(T) ? [...TG, T] : TG;
}
function updateTreant(m, dt, d, a, T) {
  if (!m.p2 && m.hp < m.max * 0.5) {
    m.p2 = true;
    evt({ t: 'bn', h: '樹精長老發怒了', s: '小樹精、黑霧和樹牆會來得更頻繁・小樹精 15 秒內沒清光，會被長老吃掉回血' });
  }
  m.callT = (m.callT ?? 6) - dt;
  m.fogT = (m.fogT ?? 9) - dt;
  m.growT = (m.growT ?? 12) - dt;
  if (m.eatT != null) {
    m.eatT -= dt;
    if (m.eatT <= 0 && m.state === 'chase') {
      m.eatT = null;
      const sp = mobs.filter(o => o.k === 'sprout');
      if (sp.length) {
        for (const o of sp) o.state = 'recall';
        m.state = 'eat';
        m.t = EAT_WAIT;
        evt({ t: 'tc', x: Math.round(m.x), y: Math.round(m.y), s: '回來吧，孩子們…' });
      }
    }
  }
  if (Math.hypot(m.x - altar.x, m.y - altar.y) > 1100 || d > 1000) {
    m.state = 'chase';
    m.face = Math.atan2(altar.y - m.y, altar.x - m.x);
    moveTreant(m, Math.cos(m.face) * m.spd * dt, Math.sin(m.face) * m.spd * dt);
    m.hp = Math.min(m.max, m.hp + 30 * dt);
    return;
  }
  m.healT = (m.healT ?? 12) - dt;
  if (m.state === 'chase') {
    m.face = a;
    if (d > m.r + T.r) moveTreant(m, Math.cos(a) * m.spd * dt, Math.sin(a) * m.spd * dt);
    if (d < m.r + T.r + 8 && m.acd <= 0) {
      hurt(T, 12, m);
      m.acd = 1.6;
    }
    m.atkT -= dt;
    if (m.healT <= 0 && m.hp < m.max * 0.85) {
      m.state = 'heal';
      m.t = 2.4;
      m.healT = 14;
      evt({ t: 'tf', x: Math.round(m.x), y: Math.round(m.y) });
    } else if (m.atkT <= 0) {
      const opts = [];
      if (d < TR_SLAM_R + T.r) opts.push('slam');
      if (d < TR_CAST_R) {
        opts.push('root', 'seed');
        if (m.callT <= 0 && !mobs.some(o => o.k === 'sprout')) opts.push('call');
        if (m.fogT <= 0) opts.push('fog');
        if (m.growT <= 0) opts.push('grow');
      }
      if (opts.length) {
        const o = opts.length > 1 ? opts.filter(k => k !== m.lastAtk) : opts,
          k = o[Math.floor(Math.random() * o.length)];
        m.lastAtk = k;
        m.face = a;
        if (k === 'slam') {
          m.state = 'swind';
          m.t = 0.85;
        } else if (k === 'root') {
          m.state = 'rootc';
          m.t = 0.55;
        } else if (TR_SAY[k]) {
          m.state = k + 'c';
          m.t = k === 'grow' ? 0.9 : 0.8;
          evt({ t: 'tc', x: Math.round(m.x), y: Math.round(m.y), s: TR_SAY[k] });
        } else {
          m.state = 'seedc';
          m.t = 0.7;
        }
      }
    }
  } else if (m.state === 'swind') {
    m.t -= dt;
    if (m.t <= 0) {
      for (const q of treantList(T))
        if (dist(m, q) < TR_SLAM_R + q.r && angDiff(Math.atan2(q.y - m.y, q.x - m.x), m.face) < TR_SLAM_ARC)
          hurt(q, TR_SLAM_DMG, m);
      evt({ t: 'ts', x: Math.round(m.x), y: Math.round(m.y), a: Math.round(m.face * 100) / 100 });
      m.state = 'trec';
      m.t = 0.65;
    }
  } else if (m.state === 'rootc') {
    m.t -= dt;
    m.face = a;
    if (m.t <= 0) {
      m.rootAt = { x: T.x, y: T.y, T };
      evt({ t: 'rm', x: Math.round(T.x), y: Math.round(T.y) });
      m.state = 'rootw';
      m.t = ROOT_MARK;
    }
  } else if (m.state === 'rootw') {
    m.t -= dt;
    if (m.t <= 0) {
      const r = m.rootAt,
        q = r.T;
      evt({ t: 'ru', x: Math.round(r.x), y: Math.round(r.y) });
      if (Math.hypot(q.x - r.x, q.y - r.y) < ROOT_R + q.r) {
        if (q === P) rootPlayer(ROOT_T);
        else if (!q.isPet) sendTo(q.id, { t: 'root', d: ROOT_T });
        hurt(q, ROOT_DMG, r);
      }
      m.state = 'trec';
      m.t = 0.5;
    }
  } else if (m.state === 'seedc') {
    m.t -= dt;
    m.face = a;
    if (m.t <= 0) {
      for (let i = 0; i < SEED_N; i++)
        evt({
          t: 'sd',
          id: ++seedSeq,
          x: Math.round(m.x),
          y: Math.round(m.y - 6),
          a: Math.round((a + (i - (SEED_N - 1) / 2) * 0.2) * 100) / 100
        });
      m.state = 'trec';
      m.t = 0.6;
    }
  } else if (m.state === 'callc') {
    m.t -= dt;
    if (m.t <= 0) {
      for (let i = 0, n = (m.p2 ? 4 : 2) * Math.max(1, TG.length); i < n; i++) {
        const s = findSpot(m.x, m.y, 50, 170);
        if (s) {
          spawnMob('sprout', s.x, s.y).aggro = 60;
          evt({ t: 'sp', x: Math.round(s.x), y: Math.round(s.y) });
        }
      }
      m.callT = m.p2 ? 9 : 14;
      if (m.p2) m.eatT = EAT_T;
      m.state = 'trec';
      m.t = 0.5;
    }
  } else if (m.state === 'fogc') {
    m.t -= dt;
    m.face = a;
    if (m.t <= 0) {
      evt({ t: 'fg', x: Math.round(T.x), y: Math.round(T.y) });
      m.fogT = m.p2 ? 8 : 12;
      m.state = 'trec';
      m.t = 0.5;
    }
  } else if (m.state === 'growc') {
    m.t -= dt;
    m.face = a;
    if (m.t <= 0) {
      growWall(T);
      m.growT = m.p2 ? 10 : 15;
      m.state = 'trec';
      m.t = 0.6;
    }
  } else if (m.state === 'eat') {
    m.t -= dt;
    for (const o of mobs.filter(o => o.k === 'sprout' && o.state === 'recall'))
      if (m.t <= 0 || dist(o, m) < m.r + o.r + 6) eatSprout(m, o);
    if (m.t <= 0) {
      m.state = 'trec';
      m.t = 0.4;
    }
  } else if (m.state === 'heal') {
    m.t -= dt;
    m.hp = Math.min(m.max, m.hp + 14 * dt);
    if (m.t <= 0) {
      m.state = 'chase';
      m.atkT = rnd(1, 2);
    }
  } else if (m.state === 'trec') {
    m.t -= dt;
    if (m.t <= 0) {
      m.state = 'chase';
      m.atkT = rnd(1.6, 2.6);
    }
  }
}

/* ---------- pets ---------- */
// each player simulates their own summoned pet locally (like the player); its hits/pickups go through act()
const curPet = () => pets.find(p => p.id === petOut && p.down <= 0) || null;
function petOf(owner) {
  if (owner === ME) {
    const p = curPet();
    return p && !P.dead ? p : null;
  }
  const o = others.get(owner);
  return (o && !o.dead && o.pet) || null;
}
function addPet(k) {
  const n = pets.filter(p => p.k === k).length + 1;
  const p = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    k,
    name: `${PETS[k].name} ${n}`,
    hp: PETS[k].hp,
    bag: {},
    down: 0
  };
  pets.push(p);
  if (!curPet()) summonPet(p.id);
  writeSave();
  if (!$('panel').hidden) renderPanel();
}
function placePet(p, glow) {
  Object.assign(p, {
    isPet: true,
    owner: ME,
    r: PETS[p.k].r,
    face: P.face,
    anim: Math.random() * 9,
    cd: 0,
    gcd: 0,
    flash: 0,
    glow: 0,
    moving: false
  });
  let x = P.x - Math.cos(P.face) * 28,
    y = P.y - Math.sin(P.face) * 28;
  for (let k = 0; k < 20 && blocked(x, y, p.r); k++) {
    x = P.x + rnd(-40, 40);
    y = P.y + rnd(-40, 40);
  }
  if (blocked(x, y, p.r)) {
    x = P.x;
    y = P.y;
  }
  p.x = x;
  p.y = y;
  if (glow) {
    p.glow = 1.4;
    burst(x, y - 8, '#ffe08a', 26);
    burst(x, y - 8, '#fff6d0', 12);
  }
}
function summonPet(id) {
  petOut = id;
  const p = curPet();
  if (p) placePet(p, true);
}
function hurtPet(dmg, src) {
  const p = curPet();
  if (!p) return;
  p.hp -= dmg;
  p.flash = 0.15;
  const a = Math.atan2(p.y - src.y, p.x - src.x);
  move(p, Math.cos(a) * 12, Math.sin(a) * 12);
  floats.push({ x: p.x, y: p.y - 22, txt: '-' + Math.round(dmg), t: 0.8, col: '#ffb0a0' });
  if (p.hp <= 0) petDown(p);
}
function petDown(p) {
  p.hp = 0;
  p.down = PET_DOWN;
  burst(p.x, p.y - 6, '#6a4a3a', 16);
  if (Object.keys(p.bag).length) {
    act({ t: 'drop', x: p.x, y: p.y, bag: p.bag });
    p.bag = {};
  }
  toast(`${p.name}倒下了，${PET_DOWN} 秒後回來`);
  writeSave();
}
function petStep(p, tx, ty, spd, dt) {
  const a = Math.atan2(ty - p.y, tx - p.x);
  p.face = a;
  p.moving = true;
  move(p, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt);
}
function updatePet(dt) {
  for (const p of pets)
    if (p.down > 0) {
      p.down -= dt;
      if (p.down <= 0) {
        p.down = 0;
        p.hp = PETS[p.k].hp;
        if (p.id === petOut) {
          placePet(p, true);
          toast(`${p.name}回來了`);
        }
      }
    }
  const p = curPet();
  if (!p) return;
  const D = PETS[p.k];
  p.anim += dt;
  p.cd -= dt;
  p.gcd -= dt;
  p.flash -= dt;
  p.glow -= dt;
  p.moving = false;
  if (P.dead) return;
  if (burnTick(p, dt)) {
    p.hp -= BURN_DPS * dt;
    if (p.hp <= 0) {
      petDown(p);
      return;
    }
  }
  if (P.boat) return; // waits on the shore while the owner is at sea
  const od = dist(p, P);
  if (od > 500) {
    placePet(p, false);
    return;
  }
  // fight: hostile mobs near the owner (wild boars only once they're angry, so taming isn't interrupted)
  let tgt = null,
    bd = 1e9;
  for (const m of mobs) {
    if ((m.k === 'boar' || m.k === 'frog') && m.aggro <= 0) continue;
    const dm = dist(m, P);
    if (dm < 220) {
      const d = dist(m, p);
      if (d < bd) {
        bd = d;
        tgt = m;
      }
    }
  }
  if (tgt) {
    const reach = p.r + tgt.r + 4;
    if (bd > reach) petStep(p, tgt.x, tgt.y, D.spd * 1.1, dt);
    else p.face = Math.atan2(tgt.y - p.y, tgt.x - p.x);
    if (bd <= reach + 4 && p.cd <= 0) {
      p.cd = D.cd;
      floats.push({
        x: tgt.x,
        y: tgt.y - tgt.r - 8,
        txt: shielded(tgt) ? '無敵' : String(D.dmg),
        t: 0.7,
        col: shielded(tgt) ? '#9dffb0' : '#d8f0b0'
      });
      burst(tgt.x, tgt.y, tgt.k === 'moss' ? '#9fc069' : '#b84a3a', 4);
      act({ t: 'hit', id: tgt.id, dmg: D.dmg, x: p.x, y: p.y, pet: 1 });
    }
    return;
  }
  // gather: loose pickables near the owner
  if (D.gather && p.gcd <= 0) {
    let g = null,
      gd = 1e9;
    forCells(P.x, P.y, 4, o => {
      const R = RES[o.k];
      if (!R.pick || (o.k === 'bush' && o.dep > 0)) return;
      if (dist(o, P) > 160) return;
      const d = dist(o, p);
      if (d < gd) {
        gd = d;
        g = o;
      }
    });
    if (g) {
      if (gd > 16) petStep(p, g.x, g.y, D.spd, dt);
      else {
        p.gcd = 1.2;
        act({ t: 'res', c: g.cell, dmg: 0, pet: 1 });
      }
      return;
    }
  }
  // follow
  if (od > 56) petStep(p, P.x, P.y, od > 200 ? D.spd * 1.4 : D.spd, dt);
}
