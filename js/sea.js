// 北境求生 · sea.js：海裡的魚群與鯊魚（純視覺）
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- sea life ---------- */
// 海裡的魚群與鯊魚：純視覺，不影響玩法也不同步，每位玩家各自模擬自己鏡頭附近的海。
// 行為與 ASCII 畫法移植自 ascii-sharks（https://github.com/stackedlol/ascii-sharks），只保留 classic 一種鯊魚：
//   MIT License. Copyright (c) 2026 drewdi
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
//   associated documentation files (the "Software"), to deal in the Software without restriction, including
//   without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//   copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
//   following conditions: The above copyright notice and this permission notice shall be included in all
//   copies or substantial portions of the Software.
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
//   LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
//   EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
//   IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
//   THE USE OR OTHER DEALINGS IN THE SOFTWARE.
const sea = (() => {
  const TAU = Math.PI * 2,
    clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angleDiff = (a, b) => {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const SPECIES = [
    {
      cruise: 36,
      maxSpeed: 64,
      minSpeed: 18,
      weight: 3,
      school: [18, 28],
      spacing: [1.8, 1.1],
      align: 1.6,
      cohesion: 1.6,
      jitter: 40,
      mill: 70,
      vDrag: 0.5
    },
    {
      cruise: 46,
      maxSpeed: 78,
      minSpeed: 22,
      weight: 3,
      school: [20, 32],
      spacing: [1.5, 1],
      align: 3.2,
      cohesion: 0.45,
      jitter: 30,
      mill: 0,
      vDrag: 1.4
    },
    {
      cruise: 40,
      maxSpeed: 70,
      minSpeed: 20,
      weight: 3,
      school: [12, 20],
      spacing: [2, 1.1],
      align: 2.4,
      cohesion: 1.1,
      jitter: 35,
      mill: 0,
      vDrag: 1.6
    },
    {
      cruise: 32,
      maxSpeed: 60,
      minSpeed: 16,
      weight: 2,
      school: [5, 9],
      spacing: [2.6, 1.3],
      align: 2,
      cohesion: 0.9,
      jitter: 25,
      mill: 0,
      vDrag: 2
    },
    {
      cruise: 26,
      maxSpeed: 56,
      minSpeed: 10,
      weight: 1,
      school: [8, 12],
      spacing: [1.4, 1.1],
      align: 0.35,
      cohesion: 1.4,
      jitter: 110,
      mill: 0,
      vDrag: 0.3
    }
  ];
  const pickSpecies = () => {
    let r = Math.random() * 12;
    for (let i = 0; i < SPECIES.length; i++) {
      r -= SPECIES[i].weight;
      if (r <= 0) return i;
    }
    return 0;
  };
  // 字元格大小（顆粒粗細）：每個地形格切成 SX×SY。魚群的行為距離用固定的 SEP_W/SEP_H，不隨顆粒改變
  const SX = 8,
    SY = 5,
    CW = CELL / SX,
    CH = CELL / SY,
    GC = COLS * SX,
    GR = ROWS * SY,
    NCELL = GC * GR,
    SEP_W = 10,
    SEP_H = CELL / 3;
  const BIG_ZONE = 150,
    BODY_CLEAR = 2,
    FISH_N = 180,
    NODES = 20,
    MAX_STEP = 1 / 50,
    SEP_K = 420,
    ALIGN_K = 1.4,
    COH_K = 1,
    FLEE_K = 1100,
    BLIND = -0.6;
  const R = Math.max(SEP_H * 3, SEP_W * 5.5),
    FOREIGN = SEP_W * 3,
    BC = Math.ceil(W / R),
    BR = Math.ceil(H / R);
  const sepX = SPECIES.map(s => s.spacing[0] * SEP_W),
    sepY = SPECIES.map(s => s.spacing[1] * SEP_H);
  const head = new Int32Array(BC * BR),
    count = new Uint16Array(BC * BR),
    next = new Int32Array(FISH_N);
  const energy = new Float32Array(NCELL),
    energyTmp = new Float32Array(NCELL),
    heat = new Float32Array(NCELL);
  let D = null,
    T = 0,
    lastSpawn = -99,
    nextTry = 0;
  const G = { x: 0, y: 0 },
    cur = { x: 0, y: 0 };
  const fish = [];
  for (let i = 0; i < FISH_N; i++)
    fish.push({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      species: 0,
      alarm: 0,
      alive: false,
      respawnAt: 0,
      phase: rnd(0, TAU),
      turn: 0,
      depth: rnd(0.55, 1),
      millDir: 1
    });
  // clear：頭要離岸幾格。身體沿著頭的路徑走，所以離岸距離大於鰭寬，整隻就不會碰到陸地
  const sharks = [370, 310, 255].map((L, i) => ({
    id: i + 1,
    L,
    clear: Math.ceil((L * 0.37) / CELL) + 1,
    nodes: new Float32Array(NODES * 2),
    heading: 0,
    speed: 30,
    phase: rnd(0, TAU),
    turn: 0,
    hunger: rnd(0.25, 0.75),
    wander: 0,
    target: null,
    retargetAt: 0,
    goal: null,
    goalAt: 0,
    depth: L / 370,
    off: true,
    retry: 0
  }));
  sharks.sort((a, b) => a.L - b.L);

  // 每個地形格到最近陸地（或地圖邊緣）的距離，單位是格；陸地為 0
  function init() {
    D = new Uint16Array(COLS * ROWS).fill(65535);
    const q = [];
    for (let c = 0; c < COLS * ROWS; c++) {
      const i = c % COLS,
        j = Math.floor(c / COLS);
      if (biome[c] !== 0) {
        D[c] = 0;
        q.push(c);
      } else if (i === 0 || j === 0 || i === COLS - 1 || j === ROWS - 1) {
        D[c] = 1;
        q.push(c);
      }
    }
    for (let h = 0; h < q.length; h++) {
      const v = q[h],
        i = v % COLS,
        j = Math.floor(v / COLS);
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++) {
          const ii = i + a,
            jj = j + b;
          if (ii < 0 || jj < 0 || ii >= COLS || jj >= ROWS) continue;
          const u = jj * COLS + ii;
          if (D[u] > D[v] + 1) {
            D[u] = D[v] + 1;
            q.push(u);
          }
        }
    }
    // 水域分區：鯊魚依體型能游的深水，連通的算同一區。只在夠大的區生成，也只往同一區的目標游
    const zones = new Map();
    for (const sh of sharks) {
      if (!zones.has(sh.clear)) {
        const lab = new Int32Array(COLS * ROWS),
          size = [0];
        for (let c = 0; c < COLS * ROWS; c++) {
          if (lab[c] || D[c] < sh.clear) continue;
          const id = size.length,
            st = [c];
          lab[c] = id;
          let n = 0;
          while (st.length) {
            const v = st.pop(),
              i = v % COLS,
              j = Math.floor(v / COLS);
            n++;
            for (let a = -1; a <= 1; a++)
              for (let b = -1; b <= 1; b++) {
                const ii = i + a,
                  jj = j + b;
                if (ii < 0 || jj < 0 || ii >= COLS || jj >= ROWS) continue;
                const u = jj * COLS + ii;
                if (!lab[u] && D[u] >= sh.clear) {
                  lab[u] = id;
                  st.push(u);
                }
              }
          }
          size.push(n);
        }
        zones.set(sh.clear, { lab, size });
      }
      sh.zone = zones.get(sh.clear);
    }
  }
  const depth = (x, y) => {
    const c = ci(x, y);
    return c < 0 ? 0 : D[c];
  };
  function grad(x, y) {
    const gx = depth(x + CELL, y) - depth(x - CELL, y),
      gy = depth(x, y + CELL) - depth(x, y - CELL),
      l = Math.hypot(gx, gy);
    G.x = l ? gx / l : 0;
    G.y = l ? gy / l : 0;
    return l > 0;
  }
  const viewR = () => Math.hypot(VW, VH) / 2 / SCALE;
  function spot(minD, r0, r1, ok) {
    for (let t = 0; t < 40; t++) {
      const a = Math.random() * TAU,
        r = rnd(r0, r1),
        x = cam.x + Math.cos(a) * r,
        y = cam.y + Math.sin(a) * r;
      if (depth(x, y) >= minD && (!ok || ok(ci(x, y)))) return { x, y };
    }
    return null;
  }
  function current(x, y, t) {
    const K1 = 1 / 260,
      K2 = 1 / 310,
      K3 = 1 / 190,
      a = x * K1 + t * 0.07,
      b = y * K2 - t * 0.05,
      c = (x + y) * K3 + t * 0.11;
    cur.x = (-K2 * Math.sin(a) * Math.sin(b) + 0.5 * K3 * Math.cos(c)) * 3400;
    cur.y = (-K1 * Math.cos(a) * Math.cos(b) - 0.5 * K3 * Math.cos(c)) * 3400;
  }
  function stamp(field, x, y, radius, amount) {
    const c0 = Math.floor(x / CW),
      r0 = Math.floor(y / CH);
    for (let r = r0 - radius; r <= r0 + radius; r++)
      for (let c = c0 - radius; c <= c0 + radius; c++) {
        if (c < 0 || r < 0 || c >= GC || r >= GR) continue;
        const d = Math.hypot(c - c0, (r - r0) * 1.4);
        if (d > radius + 0.5) continue;
        const i = r * GC + c;
        field[i] = Math.min(1.6, field[i] + amount * (1 - d / (radius + 1)));
      }
  }
  const cellAt = (x, y) => {
    const c = Math.floor(x / CW),
      r = Math.floor(y / CH);
    return c < 0 || r < 0 || c >= GC || r >= GR ? -1 : r * GC + c;
  };
  const bucketOf = (x, y) => clamp(Math.floor(y / R), 0, BR - 1) * BC + clamp(Math.floor(x / R), 0, BC - 1);

  /* 模擬 */
  function rebuildHash() {
    head.fill(-1);
    count.fill(0);
    for (let i = 0; i < FISH_N; i++) {
      const f = fish[i];
      if (!f.alive) continue;
      const b = bucketOf(f.x, f.y);
      next[i] = head[b];
      head[b] = i;
      count[b]++;
    }
  }
  function stepFish(dt) {
    const R2 = R * R,
      calm = Math.exp(-dt * 0.7),
      contagion = Math.min(1, dt * 6),
      scare = !P.dead && (MODE === 'solo' || started);
    for (let i = 0; i < FISH_N; i++) {
      const f = fish[i];
      if (!f.alive) continue;
      const sp = SPECIES[f.species];
      // 受驚的魚會拉開距離：鯊魚經過時魚群散開，威脅消失後再聚回來
      const spread = 1 + 1.8 * f.alarm,
        sx0 = sepX[f.species] * spread,
        sy0 = sepY[f.species] * spread,
        speed = Math.hypot(f.vx, f.vy) || 1,
        hx = f.vx / speed,
        hy = f.vy / speed;
      let ax = 0,
        ay = 0,
        sx = 0,
        sy = 0,
        avx = 0,
        avy = 0,
        cx = 0,
        cy = 0,
        n = 0,
        nAlarm = 0;
      const bc = clamp(Math.floor(f.x / R), 0, BC - 1),
        br = clamp(Math.floor(f.y / R), 0, BR - 1);
      for (let r = Math.max(0, br - 1); r <= Math.min(BR - 1, br + 1); r++)
        for (let c = Math.max(0, bc - 1); c <= Math.min(BC - 1, bc + 1); c++) {
          for (let j = head[r * BC + c]; j !== -1; j = next[j]) {
            if (j === i) continue;
            const o = fish[j],
              dx = o.x - f.x,
              dy = o.y - f.y,
              d2 = dx * dx + dy * dy;
            if (d2 >= R2 || d2 <= 1e-6) continue;
            const d = Math.sqrt(d2);
            if ((dx * hx + dy * hy) / d <= BLIND) continue;
            const qx = dx / sx0,
              qy = dy / sy0,
              q2 = qx * qx + qy * qy;
            if (q2 < 1) {
              const q = Math.sqrt(q2) || 1e-3,
                k = (1 - q) / q;
              sx -= qx * k;
              sy -= qy * k;
            }
            if (o.species === f.species) {
              avx += o.vx;
              avy += o.vy;
              cx += dx;
              cy += dy;
              n++;
            } else if (d < FOREIGN) {
              const k = ((1 - d / FOREIGN) / d) * 0.6;
              sx -= dx * k;
              sy -= dy * k;
            }
            if (o.alarm > nAlarm) nAlarm = o.alarm;
          }
        }
      ax += sx * SEP_K;
      ay += sy * SEP_K;
      if (n > 0) {
        const al = ALIGN_K * sp.align,
          co = COH_K * sp.cohesion * (1 - 0.8 * f.alarm);
        ax += (avx / n - f.vx) * al + (cx / n) * co;
        ay += (avy / n - f.vy) * al + (cy / n) * co;
        if (sp.mill > 0) {
          const cl = Math.hypot(cx, cy) || 1;
          ax += (-cy / cl) * f.millDir * sp.mill * (1 - f.alarm);
          ay += (cx / cl) * f.millDir * sp.mill * (1 - f.alarm);
        }
      }
      // 掠食者：量到鯊魚前半身最近的點，往鯊魚行進路線的兩側逃開
      let fear = 0;
      for (const sh of sharks) {
        if (sh.off) continue;
        const fearR = sh.L * 0.6 + 60;
        let best = Infinity,
          bx = 0,
          by = 0;
        for (let k = 0; k <= 12; k += 3) {
          const nx = sh.nodes[k * 2],
            ny = sh.nodes[k * 2 + 1],
            d2 = (f.x - nx) ** 2 + (f.y - ny) ** 2;
          if (d2 < best) {
            best = d2;
            bx = nx;
            by = ny;
          }
        }
        const d = Math.sqrt(best);
        if (d >= fearR || d < 1e-3) continue;
        let w = 1 - d / fearR;
        w *= w;
        const awayX = (f.x - bx) / d,
          awayY = (f.y - by) / d,
          shx = Math.cos(sh.heading),
          shy = Math.sin(sh.heading),
          side = shx * (f.y - sh.nodes[1]) - shy * (f.x - sh.nodes[0]) >= 0 ? 1 : -1;
        ax += (awayX * 0.7 - shy * side * 0.9) * FLEE_K * w;
        ay += (awayY * 0.7 + shx * side * 0.9) * FLEE_K * w;
        fear = Math.max(fear, Math.sqrt(w));
      }
      // 玩家走到水邊也會嚇到魚（對應原作的滑鼠游標）
      if (scare) {
        const dx = f.x - P.x,
          dy = f.y - P.y,
          d = Math.hypot(dx, dy);
        if (d < 130 && d > 1e-3) {
          const w = (1 - d / 130) ** 2;
          ax += (dx / d) * FLEE_K * w;
          ay += (dy / d) * FLEE_K * w;
          fear = Math.max(fear, Math.sqrt(w) * 0.8);
        }
      }
      let alarm = Math.max(f.alarm * calm, fear);
      const relayed = nAlarm * 0.86;
      if (relayed > alarm) alarm += (relayed - alarm) * contagion;
      f.alarm = alarm;
      // 靠岸就往深水推
      const dep = depth(f.x, f.y);
      if (dep < 3 && grad(f.x, f.y)) {
        const k = (3 - dep) * 90;
        ax += G.x * k;
        ay += G.y * k;
      }
      current(f.x, f.y, T);
      ax += cur.x * 0.5 + (Math.random() - 0.5) * sp.jitter;
      ay += cur.y * 0.5 + (Math.random() - 0.5) * sp.jitter;
      ay -= f.vy * sp.vDrag * (1 - 0.7 * f.alarm);
      const pref = sp.cruise * (1 + 1.3 * f.alarm);
      ax += (pref - speed) * hx * 1.6;
      ay += (pref - speed) * hy * 1.6;
      const before = Math.atan2(f.vy, f.vx);
      f.vx += ax * dt;
      f.vy += ay * dt;
      const maxS = sp.maxSpeed * (1 + 1.8 * f.alarm),
        s = Math.hypot(f.vx, f.vy);
      if (s > maxS) {
        f.vx *= maxS / s;
        f.vy *= maxS / s;
      } else if (s < sp.minSpeed && s > 1e-3) {
        f.vx *= sp.minSpeed / s;
        f.vy *= sp.minSpeed / s;
      }
      f.turn += (angleDiff(before, Math.atan2(f.vy, f.vx)) / dt - f.turn) * Math.min(1, dt * 8);
      f.phase += dt * (7 + Math.hypot(f.vx, f.vy) * 0.12);
      const nx = f.x + f.vx * dt,
        ny = f.y + f.vy * dt;
      if (depth(nx, ny) >= 1) {
        f.x = nx;
        f.y = ny;
      } else {
        grad(f.x, f.y);
        f.vx = G.x * sp.cruise;
        f.vy = G.y * sp.cruise;
      }
    }
  }
  function findPrey(sh) {
    const range = sh.L * 0.9 + 160,
      hx = sh.nodes[0],
      hy = sh.nodes[1],
      fx = Math.cos(sh.heading),
      fy = Math.sin(sh.heading);
    let best = null,
      bestS = Infinity,
      curS = Infinity;
    for (const f of fish) {
      if (!f.alive || depth(f.x, f.y) < sh.clear) continue;
      const dx = f.x - hx,
        dy = f.y - hy,
        d = Math.hypot(dx, dy);
      if (d > range || d < 1e-3) continue;
      const c = (dx * fx + dy * fy) / d;
      if (c < 0.2) continue;
      const score = d * (1 + (1 - c) * 0.8) * (1 + count[bucketOf(f.x, f.y)] * 0.07);
      if (score < bestS) {
        bestS = score;
        best = f;
      }
      if (f === sh.target) curS = score;
    }
    return sh.target && curS < bestS * 1.3 ? sh.target : best;
  }
  // 鯊魚從畫面外的深水朝玩家方向游進來
  function placeShark(sh) {
    const r = viewR();
    let s = null,
      h = 0;
    // 身體往後拉成一直線，整條都要在水裡，否則尾巴一開始就會蓋到陸地
    const big = c => sh.zone.size[sh.zone.lab[c]] >= BIG_ZONE;
    for (let t = 0; t < 8 && !s; t++) {
      const q = spot(sh.clear + 3, r + sh.L * 0.5, r + 900, big);
      if (!q) break;
      h = Math.atan2(cam.y - q.y, cam.x - q.x);
      let ok = true;
      for (let f = 0.25; f <= 1; f += 0.25)
        if (depth(q.x - Math.cos(h) * sh.L * f, q.y - Math.sin(h) * sh.L * f) < sh.clear) ok = false;
      if (ok) s = q;
    }
    if (!s) {
      sh.off = true;
      sh.retry = T + 1;
      return;
    }
    const seg = sh.L / (NODES - 1);
    sh.heading = h;
    for (let n = 0; n < NODES; n++) {
      sh.nodes[n * 2] = s.x - Math.cos(h) * seg * n;
      sh.nodes[n * 2 + 1] = s.y - Math.sin(h) * seg * n;
    }
    sh.off = false;
    sh.goal = null;
    sh.target = null;
    sh.speed = 30;
  }
  function stepSharks(dt) {
    const r = viewR();
    for (const sh of sharks) {
      if (sh.off) {
        if (T >= sh.retry) placeShark(sh);
        continue;
      }
      const L = sh.L,
        nodes = sh.nodes,
        hx = nodes[0],
        hy = nodes[1];
      if (Math.hypot(hx - cam.x, hy - cam.y) > r + L + 900) {
        placeShark(sh);
        continue;
      }
      sh.hunger = Math.min(1, sh.hunger + dt * 0.03);
      let dx = Math.cos(sh.heading),
        dy = Math.sin(sh.heading);
      sh.wander = clamp(sh.wander + (Math.random() - 0.5) * dt * 3.2, -1.1, 1.1);
      dx += Math.cos(sh.heading + sh.wander) * 0.45;
      dy += Math.sin(sh.heading + sh.wander) * 0.45;
      if (T >= sh.retargetAt) {
        sh.target = findPrey(sh);
        sh.retargetAt = T + 0.45;
      }
      const t = sh.target;
      let hunting = false,
        closing = 0;
      if (t && t.alive && sh.hunger > 0.3 && depth(t.x, t.y) >= sh.clear) {
        const tx = t.x + t.vx * 0.35 - hx,
          ty = t.y + t.vy * 0.35 - hy,
          d = Math.hypot(tx, ty) || 1,
          w = 1.4 + 2.6 * sh.hunger;
        dx += (tx / d) * w;
        dy += (ty / d) * w;
        hunting = true;
        closing = clamp(1 - d / (L * 0.9), 0, 1);
      } else {
        // 巡游：在玩家看得到的深水區找個點慢慢游過去
        if (!sh.goal || T >= sh.goalAt || Math.hypot(sh.goal.x - hx, sh.goal.y - hy) < 100) {
          const z = sh.zone.lab[ci(hx, hy)],
            same = c => sh.zone.lab[c] === z,
            g = spot(sh.clear + 1, 0, r * 0.9, same);
          // 這一區到不了玩家看得到的地方：趁牠在畫面外，換到別區
          if (!g && (Math.abs(hx - cam.x) > VW / 2 / SCALE + L || Math.abs(hy - cam.y) > VH / 2 / SCALE + L)) {
            placeShark(sh);
            continue;
          }
          sh.goal = g || spot(sh.clear + 1, 0, r + 900, same);
          sh.goalAt = T + rnd(8, 16);
        }
        if (sh.goal) {
          const tx = sh.goal.x - hx,
            ty = sh.goal.y - hy,
            d = Math.hypot(tx, ty) || 1;
          dx += (tx / d) * 0.55;
          dy += (ty / d) * 0.55;
        }
      }
      for (const o of sharks) {
        if (o === sh || o.off) continue;
        for (let k = 0; k < NODES; k += 4) {
          const ox = hx - o.nodes[k * 2],
            oy = hy - o.nodes[k * 2 + 1],
            d = Math.hypot(ox, oy),
            range = (L + o.L) * 0.45;
          if (d < range && d > 1e-3) {
            const w = (1 - d / range) * 3;
            dx += (ox / d) * w;
            dy += (oy / d) * w;
          }
        }
      }
      // 看前方，離岸還有一段距離就開始轉回深水；頭快到底線時其他力全部不算（追魚、鯊魚互推），只管回游
      const hd = depth(hx, hy),
        px = hx + Math.cos(sh.heading) * L * 0.35,
        py = hy + Math.sin(sh.heading) * L * 0.35,
        near = Math.min(depth(px, py), hd),
        turnAt = sh.clear + 3;
      if (hd <= sh.clear + 1 && grad(hx, hy)) {
        dx = G.x;
        dy = G.y;
        hunting = false;
        closing = 0;
      } else if (near < turnAt && (grad(px, py) || grad(hx, hy))) {
        const w = (turnAt - near) * 2.5;
        dx += G.x * w;
        dy += G.y * w;
      }
      const agility = Math.min(hunting ? 1.7 + closing : 0.8, sh.speed / (L * 0.22)),
        maxTurn = agility * dt,
        turned = clamp(angleDiff(sh.heading, Math.atan2(dy, dx)), -maxTurn, maxTurn);
      sh.heading += turned;
      sh.turn += (turned / dt - sh.turn) * Math.min(1, dt * 3);
      const cruise = 30 + L * 0.04,
        target = hunting ? cruise * (1.45 + closing * 1.5) : cruise;
      sh.speed += (target - sh.speed) * Math.min(1, dt * 1.1);
      sh.phase += dt * (2 + sh.speed / 24);
      const nx = hx + Math.cos(sh.heading) * sh.speed * dt,
        ny = hy + Math.sin(sh.heading) * sh.speed * dt;
      // 不能越過離岸底線；前方被擋就沿岸滑，不要停在原地
      const lim = Math.min(sh.clear, hd);
      if (depth(nx, ny) >= lim) {
        nodes[0] = nx;
        nodes[1] = ny;
      } else if (depth(nx, hy) >= lim) nodes[0] = nx;
      else if (depth(hx, ny) >= lim) nodes[1] = ny;
      // 跟隨式脊椎：每節限制彎曲角度，身體最多彎成 C 字
      const seg = L / (NODES - 1);
      let prev = sh.heading + Math.PI;
      for (let k = 1; k < NODES; k++) {
        const ax = nodes[(k - 1) * 2],
          ay = nodes[(k - 1) * 2 + 1];
        let a = Math.atan2(nodes[k * 2 + 1] - ay, nodes[k * 2] - ax);
        a = prev + clamp(angleDiff(prev, a), -0.16, 0.16);
        // 繞過岬角時身體會往內切：這一節壓到陸地就彎開，不讓尾巴掃過岸上
        if (depth(ax + Math.cos(a) * seg, ay + Math.sin(a) * seg) < BODY_CLEAR)
          for (let t = 1, done = false; t <= 10 && !done; t++)
            for (const sgn of [1, -1]) {
              const b = a + sgn * t * 0.14;
              if (depth(ax + Math.cos(b) * seg, ay + Math.sin(b) * seg) >= BODY_CLEAR) {
                a = b;
                done = true;
                break;
              }
            }
        nodes[k * 2] = ax + Math.cos(a) * seg;
        nodes[k * 2 + 1] = ay + Math.sin(a) * seg;
        prev = a;
      }
      if (sh.hunger > 0.15) {
        const mr = L * 0.05 + 8;
        for (const f of fish) {
          if (!f.alive) continue;
          if ((f.x - nodes[0]) ** 2 + (f.y - nodes[1]) ** 2 < mr * mr) {
            f.alive = false;
            f.respawnAt = T + rnd(3, 8);
            sh.hunger = Math.max(0, sh.hunger - 0.16);
            stamp(heat, f.x, f.y, 3, 1);
            stamp(energy, f.x, f.y, 5, 0.9);
          }
        }
      }
    }
  }
  // 離鏡頭太遠或被吃掉的魚，之後變成新魚群從畫面外游進來
  function respawn() {
    const r = viewR(),
      due = [];
    for (const f of fish) {
      if (f.alive && Math.hypot(f.x - cam.x, f.y - cam.y) > r + 900) {
        f.alive = false;
        f.respawnAt = T;
      }
      if (!f.alive && f.respawnAt <= T) due.push(f);
    }
    if (!due.length || T < nextTry || (due.length < 6 && T - lastSpawn < 9)) return;
    const s = spot(3, r + 40, r + 600);
    if (!s) {
      nextTry = T + 1;
      return;
    }
    lastSpawn = T;
    const species = pickSpecies(),
      sp = SPECIES[species],
      millDir = Math.random() < 0.5 ? 1 : -1,
      inward = Math.atan2(cam.y - s.y, cam.x - s.x) + rnd(-0.5, 0.5);
    for (const f of due.slice(0, sp.school[1])) {
      const x = s.x + rnd(-1, 1) * R,
        y = s.y + rnd(-1, 1) * R,
        ok = depth(x, y) >= 1;
      f.alive = true;
      f.species = species;
      f.alarm = 0;
      f.turn = 0;
      f.millDir = millDir;
      f.x = ok ? x : s.x;
      f.y = ok ? y : s.y;
      f.vx = Math.cos(inward) * sp.cruise * 1.4;
      f.vy = Math.sin(inward) * sp.cruise * 1.4;
    }
  }
  function update(dt) {
    if (!D) init();
    if (dt <= 0) return;
    // 步長跟著這一幀的時間走，每幀移動量才會均勻；掉幀時再切成小步，維持模擬穩定
    const n = Math.max(1, Math.ceil(dt / MAX_STEP)),
      h = dt / n;
    for (let k = 0; k < n; k++) {
      T += h;
      rebuildHash();
      stepFish(h);
      stepSharks(h);
      respawn();
    }
    for (const f of fish) {
      if (!f.alive) continue;
      const i = cellAt(f.x, f.y);
      if (i >= 0) energy[i] = Math.min(1.6, energy[i] + 0.012 + f.alarm * 0.03);
    }
    for (const sh of sharks) {
      if (sh.off) continue;
      for (let k = NODES - 6; k < NODES; k++) {
        const i = cellAt(sh.nodes[k * 2], sh.nodes[k * 2 + 1]);
        if (i >= 0) energy[i] = Math.min(1.6, energy[i] + 0.05 + sh.speed * 0.0012);
      }
    }
    // 水波：模糊加衰減，像漣漪一樣散開後消失。只算鏡頭附近，範圍外圍的一圈歸零，鏡頭移過去時才不會看到舊水波
    const decay = Math.exp(-dt * 1.5),
      hd = Math.exp(-dt * 2.2),
      e = energy,
      o = energyTmp,
      mx = VW / 2 / SCALE + 40,
      my = VH / 2 / SCALE + 40,
      RING = 6;
    const c0 = Math.max(0, Math.floor((cam.x - mx) / CW)),
      c1 = Math.min(GC - 1, Math.floor((cam.x + mx) / CW)),
      r0 = Math.max(0, Math.floor((cam.y - my) / CH)),
      r1 = Math.min(GR - 1, Math.floor((cam.y + my) / CH));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * GC + c,
          v = e[i];
        o[i] =
          (v * 4 +
            (c > 0 ? e[i - 1] : v) +
            (c < GC - 1 ? e[i + 1] : v) +
            (r > 0 ? e[i - GC] : v) +
            (r < GR - 1 ? e[i + GC] : v)) *
          0.125 *
          decay;
        heat[i] *= hd;
      }
    for (let r = r0; r <= r1; r++) e.set(o.subarray(r * GC + c0, r * GC + c1 + 1), r * GC + c0);
    for (let r = Math.max(0, r0 - RING); r <= Math.min(GR - 1, r1 + RING); r++)
      for (let c = Math.max(0, c0 - RING); c <= Math.min(GC - 1, c1 + RING); c++) {
        if (r >= r0 && r <= r1 && c >= c0 && c <= c1) {
          c = c1;
          continue;
        }
        const i = r * GC + c;
        e[i] = 0;
        heat[i] = 0;
      }
  }

  /* ASCII 繪製 */
  const fishStyles = [0.28, 0.42, 0.58, 0.74, 0.9].map(a => `rgba(230,238,255,${a})`),
    fishBuckets = fishStyles.map(() => []);
  const WAKE_LEVELS = 6,
    wakeStyles = [],
    wakeBuckets = [];
  for (let l = 0; l < WAKE_LEVELS; l++) {
    wakeStyles.push(`rgba(110,230,255,${((l + 1) / WAKE_LEVELS).toFixed(3)})`);
    wakeBuckets.push([]);
  }
  const ACCENTS = ['#e0892c', '#e03a32', '#b44ae0', '#33c8cc', '#3cb54a', '#3150e8', '#d9c14a'];
  const SKIN_STYLES = [];
  for (let l = 0; l < 256; l++)
    SKIN_STYLES.push(`rgb(${Math.round(l * 0.92)},${Math.round(l * 0.97)},${Math.min(255, Math.round(l * 1.05 + 4))})`);
  const SKIN = ':;t%SX8#@',
    FIN_G = '%;tS:',
    RIDGE_G = '@8%',
    EDGE_HEAVY = ':;',
    EDGE_LIGHT = ".',`";
  const F_BODY = 1,
    F_EDGE = 2,
    F_FIN = 3,
    F_RIDGE = 4,
    F_EYE = 5,
    SUB = [0.25, 0.3, 0.75, 0.3, 0.25, 0.72, 0.75, 0.72];
  const spine = new Float32Array(NODES * 2),
    arc = new Float32Array(NODES);
  const spanMin = new Int32Array(2048),
    spanMax = new Int32Array(2048);
  let arcTotal = 1,
    tipL = 0,
    tipR = 0,
    hitFlag = 0,
    hitShade = 0,
    hitS = 0,
    hitV = 0,
    hitDist = 0,
    segHint = -1,
    segBest = 0,
    segK = 0,
    segU = 0;
  function halfWidth(s) {
    if (s < 0.13) return 0.09 * Math.pow(Math.sin(((s / 0.13) * Math.PI) / 2), 0.95);
    if (s < 0.3) return 0.09 + 0.016 * smooth(0.13, 0.3, s);
    if (s < 0.84) return 0.019 + 0.087 * Math.pow(1 - (s - 0.3) / 0.54, 1.25);
    const k = (s - 0.84) / 0.16;
    return 0.019 * (1 - k) + 0.012 * Math.sin(k * Math.PI);
  }
  function inTri(px, py, ax, ay, bx, by, cx, cy) {
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by),
      d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy),
      d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  // 判斷一個點落在鯊魚哪個部位：s 是沿脊椎的位置（0 吻端 → 1 尾端），結果寫進 hit*
  function seg(k, px, py) {
    const ax = spine[k * 2],
      ay = spine[k * 2 + 1],
      sx = spine[k * 2 + 2] - ax,
      sy = spine[k * 2 + 3] - ay,
      len2 = sx * sx + sy * sy || 1,
      t = (px - ax) * sx + (py - ay) * sy,
      u = t <= 0 ? 0 : t >= len2 ? 1 : t / len2,
      qx = ax + sx * u - px,
      qy = ay + sy * u - py,
      d2 = qx * qx + qy * qy;
    if (d2 < segBest) {
      segBest = d2;
      segK = k;
      segU = u;
    }
  }
  function sampleShark(px, py, L) {
    segBest = Infinity;
    segK = 0;
    segU = 0;
    // 相鄰格子最近的脊椎段幾乎一樣：從上一格的結果附近找，最近段碰到邊界才往外擴
    if (segHint < 0) for (let k = 0; k < NODES - 1; k++) seg(k, px, py);
    else {
      let lo = segHint > 2 ? segHint - 2 : 0,
        hi = segHint < NODES - 4 ? segHint + 2 : NODES - 2;
      for (let k = lo; k <= hi; k++) seg(k, px, py);
      while (segK === hi && hi < NODES - 2) seg(++hi, px, py);
      while (segK === lo && lo > 0) seg(--lo, px, py);
    }
    segHint = segK;
    const k0 = segK,
      ax0 = spine[k0 * 2],
      ay0 = spine[k0 * 2 + 1],
      sx0 = spine[k0 * 2 + 2] - ax0,
      sy0 = spine[k0 * 2 + 3] - ay0,
      len0 = Math.sqrt(sx0 * sx0 + sy0 * sy0) || 1,
      bS = (arc[k0] + segU * len0) / arcTotal,
      sign = sx0 * (py - ay0) - sy0 * (px - ax0) >= 0 ? 1 : -1,
      bNx = (-sy0 / len0) * sign,
      bNy = (sx0 / len0) * sign,
      best = segBest;
    const a = Math.sqrt(best),
      s = bS,
      u = s * L,
      w = halfWidth(s) * L;
    hitDist = a;
    hitS = s;
    hitV = a * sign;
    if (a <= w) {
      const across = a / (w || 1),
        facing = (bNx * -0.6 + bNy * -0.8) * across;
      let shade = 0.58 - across * across * 0.42 + facing * 0.26,
        flag = F_BODY;
      if (s > 0.33 && s < 0.47 && across < 0.3) {
        flag = F_RIDGE;
        shade = 1;
      } else if (s > 0.71 && s < 0.76 && across < 0.4) shade = Math.max(shade, 0.82);
      else if (s > 0.1 && s < 0.14 && across > 0.6) {
        flag = F_EYE;
        shade = 0;
      } else if (s > 0.19 && s < 0.29 && across > 0.58) {
        if (Math.floor(((s - 0.19) / 0.1) * 5) % 2 === 0) shade *= 0.45;
      } else if (s < 0.05) shade = Math.max(shade, 0.7);
      hitFlag = flag;
      hitShade = shade;
      return true;
    }
    const tip = sign > 0 ? tipR : tipL;
    if (
      inTri(u, a, L * 0.15, 0, L * 0.43, 0, L * 0.55, tip) &&
      !inTri(u, a, L * 0.43, 0, L * (0.43 + 0.12 * 0.33), tip * 0.55, L * 0.55, tip)
    ) {
      hitFlag = F_FIN;
      hitShade = 0.38 + 0.22 * (1 - clamp(a / tip, 0, 1));
      return true;
    }
    if (
      inTri(u, a, L * 0.57, 0, L * 0.65, 0, L * 0.69, L * 0.085) ||
      inTri(u, a, L * 0.86, 0, L * 0.95, 0, L, L * 0.085)
    ) {
      hitFlag = F_FIN;
      hitShade = 0.36;
      return true;
    }
    return false;
  }
  // 脊椎 s 處，身體加上鰭最遠伸多遠（胸鰭從 s≈.13 往後逐漸變寬）
  function reachAt(s, L, tip) {
    let e = halfWidth(s) * L;
    if (s > 0.1 && s < 0.62) e = Math.max(e, tip * clamp((s - 0.1) / 0.4, 0, 1));
    if ((s > 0.5 && s < 0.72) || s > 0.82) e = Math.max(e, L * 0.09);
    return e;
  }
  const isSeaAt = (x, y) => {
    const c = ci(x, y);
    return c >= 0 && biome[c] === 0;
  };
  // 每隻鯊魚有自己的字元格，原點跟著吻端移動：平移時字元貼著身體走，不會一格一格跳
  function drawSharks(x0, x1, y0, y1) {
    for (const sh of sharks) {
      if (sh.off) continue;
      const L = sh.L,
        n = sh.nodes,
        swim = clamp(sh.speed / 60, 0.4, 1.4),
        dim = 0.7 + 0.3 * sh.depth;
      // 身體波動，越靠尾巴越大
      for (let k = 0; k < NODES; k++) {
        const s = k / (NODES - 1),
          a = Math.max(0, k - 1),
          b = Math.min(NODES - 1, k + 1);
        let tx = n[a * 2] - n[b * 2],
          ty = n[a * 2 + 1] - n[b * 2 + 1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const off = L * 0.05 * (0.1 + 0.9 * Math.pow(s, 1.8)) * swim * Math.sin(sh.phase - s * 5.2);
        spine[k * 2] = n[k * 2] - ty * off;
        spine[k * 2 + 1] = n[k * 2 + 1] + tx * off;
      }
      arc[0] = 0;
      for (let k = 1; k < NODES; k++)
        arc[k] = arc[k - 1] + Math.hypot(spine[k * 2] - spine[(k - 1) * 2], spine[k * 2 + 1] - spine[(k - 1) * 2 + 1]);
      arcTotal = arc[NODES - 1] || 1;
      const bank = clamp(sh.turn * 0.45, -0.35, 0.35),
        flex = 1 + 0.06 * Math.sin(sh.phase * 0.5);
      tipR = L * 0.26 * flex * (1 - bank);
      tipL = L * 0.26 * flex * (1 + bank);
      const ox = n[0] - Math.floor(n[0] / CW) * CW,
        oy = n[1] - Math.floor(n[1] / CH) * CH,
        hc = Math.floor(n[0] / CW),
        hr = Math.floor(n[1] / CH);
      const diag = Math.hypot(CW, CH),
        tip = Math.max(tipL, tipR),
        margin = diag + L / (NODES - 1);
      const c0 = Math.floor((x0 - ox) / CW),
        c1 = Math.floor((x1 - ox) / CW),
        r0 = Math.floor((y0 - oy) / CH),
        r1 = Math.floor((y1 - oy) / CH),
        rows = Math.min(spanMin.length, r1 - r0 + 1);
      // 先從脊椎算出每一列可能碰到鯊魚的欄位範圍，範圍外的格子完全不用取樣
      spanMin.fill(1e9, 0, rows);
      spanMax.fill(-1e9, 0, rows);
      for (let k = 0; k < NODES; k++) {
        const e = reachAt(k / (NODES - 1), L, tip) + margin,
          nx = spine[k * 2],
          ny = spine[k * 2 + 1],
          a = Math.floor((nx - e - ox) / CW),
          b = Math.floor((nx + e - ox) / CW);
        for (
          let r = Math.max(r0, Math.floor((ny - e - oy) / CH));
          r <= Math.min(r0 + rows - 1, Math.floor((ny + e - oy) / CH));
          r++
        ) {
          const q = r - r0;
          if (a < spanMin[q]) spanMin[q] = a;
          if (b > spanMax[q]) spanMax[q] = b;
        }
      }
      for (let r = r0; r < r0 + rows; r++) {
        const q = r - r0;
        segHint = -1;
        for (let c = Math.max(c0, spanMin[q]); c <= Math.min(c1, spanMax[q]); c++) {
          const x = ox + c * CW,
            y = oy + r * CH;
          if (!isSeaAt(x + CW / 2, y + CH / 2)) continue;
          const center = sampleShark(x + CW / 2, y + CH / 2, L);
          // 省運算：離身體和鰭夠遠就跳過；身體深處一定整格都在裡面，不用再多點取樣
          if (!center && hitDist > reachAt(hitS, L, tip) + diag) continue;
          const flag = hitFlag,
            shade = hitShade,
            s = hitS,
            v = hitV;
          let hits = center ? 1 : 0;
          if (center && hitDist < halfWidth(s) * L - diag) hits = 5;
          else for (let k = 0; k < SUB.length; k += 2) if (sampleShark(x + SUB[k] * CW, y + SUB[k + 1] * CH, L)) hits++;
          if (!hits) continue;
          const cov = hits / 5,
            key = (hash(Math.round(s * 52), Math.round(v / (CW * 0.9)), sh.id) * 4294967295) >>> 0;
          if (center && cov >= 0.6)
            drawSharkCell(
              x,
              y,
              key,
              clamp(shade + (hash(c - hc, r - hr, Math.floor(T * 6)) - 0.5) * 0.06, 0, 1),
              flag,
              dim
            );
          else drawSharkCell(x, y, key, cov, F_EDGE, dim);
        }
      }
    }
  }
  function drawSharkCell(x, y, key, shade, flag, dim) {
    const roll = hash(key, Math.floor(T * 2.4 + (key % 997) / 97), 7),
      tx = x + CW / 2,
      ty = y + CH / 2 + 0.5;
    if (flag === F_EDGE) {
      const set = shade >= 0.5 ? EDGE_HEAVY : EDGE_LIGHT,
        g = (70 + shade * 80) * dim;
      ctx.fillStyle = roll < 0.07 ? ACCENTS[key % ACCENTS.length] : SKIN_STYLES[Math.round(g)];
      ctx.fillText(set[(key >>> 8) % set.length], tx, ty);
      return;
    }
    let level, glyph;
    if (flag === F_RIDGE) {
      level = 226;
      glyph = RIDGE_G[(key >>> 8) % RIDGE_G.length];
    } else if (flag === F_EYE) {
      level = 12;
      glyph = 'o';
    } else if (flag === F_FIN) {
      level = 40 + shade * 120;
      glyph = FIN_G[(key >>> 8) % FIN_G.length];
    } else {
      level = 46 + shade * 160;
      glyph = SKIN[clamp(Math.floor((1 - shade) * 8.99) + ((key >>> 4) % 3) - 1, 0, SKIN.length - 1)];
    }
    level *= dim;
    ctx.fillStyle = SKIN_STYLES[Math.round(level)];
    ctx.fillRect(x + 0.5, y + 0.5, CW - 0.6, CH - 0.6);
    ctx.fillStyle =
      flag === F_EYE
        ? '#9aa0ad'
        : roll < 0.09
          ? ACCENTS[key % ACCENTS.length]
          : roll < 0.13
            ? '#ffffff'
            : shade > 0.55
              ? '#0e0f13'
              : '#1b1d24';
    ctx.fillText(glyph, tx, ty);
  }
  // 畫在地面之後、其他物件與夜晚遮罩之前，所以天黑時會一起變暗；只畫在海上的字元格
  function draw(cx, cy, hw, hh) {
    if (!D) return;
    const c0 = Math.max(0, Math.floor((cx - hw) / CW) - 1),
      c1 = Math.min(GC - 1, Math.floor((cx + hw) / CW) + 1),
      r0 = Math.max(0, Math.floor((cy - hh) / CH) - 1),
      r1 = Math.min(GR - 1, Math.floor((cy + hh) / CH) + 1);
    if (c0 > c1 || r0 > r1) return;
    // 魚畫在實際位置，不吸附格線；轉向或受驚時比較亮
    for (const b of fishBuckets) b.length = 0;
    for (const f of fish) {
      if (!f.alive || Math.abs(f.x - cx) > hw + 10 || Math.abs(f.y - cy) > hh + 10) continue;
      const v = 0.3 + (0.4 * (f.depth - 0.55)) / 0.45 + 0.3 * Math.max(clamp(Math.abs(f.turn) / 3.5, 0, 1), f.alarm);
      fishBuckets[clamp(Math.floor(v * 5), 0, 4)].push(f);
    }
    for (const b of wakeBuckets) b.length = 0;
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * GC + c,
          e = energy[i];
        if (e > 0.45 && isSeaAt(c * CW, r * CH))
          wakeBuckets[clamp(Math.floor((e - 0.45) * 5), 0, WAKE_LEVELS - 1)].push(i);
      }
    for (let l = 0; l < WAKE_LEVELS; l++) {
      if (!wakeBuckets[l].length) continue;
      ctx.fillStyle = wakeStyles[l];
      for (const i of wakeBuckets[l])
        ctx.fillRect((i % GC) * CW + CW * 0.66 - 1, Math.floor(i / GC) * CH + CH * 0.64 - 1, 2, 2);
    }
    ctx.save();
    ctx.font = `600 ${Math.round(CH * 0.74)}px ui-monospace,Menlo,Consolas,monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * GC + c,
          h = heat[i];
        if (h < 0.08 || !isSeaAt(c * CW, r * CH)) continue;
        ctx.fillStyle = h > 0.5 ? `rgba(255,120,60,${h.toFixed(2)})` : `rgba(220,40,40,${(h * 1.6).toFixed(2)})`;
        ctx.fillText(h > 0.6 ? '*' : '·', c * CW + CW / 2, r * CH + CH / 2 + 0.5);
      }
    const glyphFont = ctx.font;
    ctx.font = '600 10px ui-monospace,Menlo,Consolas,monospace';
    for (let b = 0; b < fishBuckets.length; b++) {
      if (!fishBuckets[b].length) continue;
      ctx.fillStyle = fishStyles[b];
      for (const f of fishBuckets[b]) ctx.fillText('-', f.x, f.y);
    }
    ctx.font = glyphFont;
    drawSharks(cx - hw - CW, cx + hw + CW, cy - hh - CH, cy + hh + CH);
    ctx.restore();
  }
  return { update, draw };
})();
