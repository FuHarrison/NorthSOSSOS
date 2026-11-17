// 北境求生 · player.js：玩家數值與背包、提示、輸入、設定、音效、快捷欄、戰鬥、採集、耐久
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- player stats ---------- */
function foodVal(f, key) {
  const d = FOODS[f.k];
  return d[key] * Math.min(1, f.t / (d.t * 0.4));
}
function maxHp() {
  return 25 + foods.reduce((s, f) => s + foodVal(f, 'hp'), 0);
}
function maxSt() {
  return 50 + foods.reduce((s, f) => s + foodVal(f, 'st'), 0);
}
const has = k => (inv[k] || 0) > 0;
const stackOf = k => (WEAPONS[k] || ARMOR[k] ? 1 : FOODS[k] ? 20 : 50);
const skLv = k => Math.floor(sk[k] || 0),
  skMul = k => 1 + 0.01 * skLv(k),
  skCut = (k, per) => 1 - per * skLv(k);
const skNeed = lv => 8 + lv * 2; // practice needed for the next level
function skXP(k, n = 1) {
  const lv0 = skLv(k);
  if (lv0 >= SK_MAX) return;
  let v = sk[k] || 0;
  for (let i = 0; i < n; i++) v += CFG.skillRate / skNeed(Math.floor(v));
  sk[k] = Math.min(SK_MAX, v);
  if (skLv(k) > lv0) {
    sfx('level');
    toast(`${SKILLS[k][0]}熟練度升到 ${skLv(k)}`);
    floats.push({ x: P.x, y: P.y - 40, txt: `${SKILLS[k][0]} Lv${skLv(k)}`, t: 1.4, col: '#8fc0d8' });
  }
}
const qOf = k => q[k] || 1,
  qMul = (k, step) => 1 + step * (qOf(k) - 1);
const wDmg = k => Math.round(WEAPONS[k].dmg * qMul(k, 0.2)),
  toolPow = (T, k) => Math.round(T[k] * qMul(k, 0.2)),
  armOf = k => Math.round(ARMOR[k].arm * qMul(k, 0.3)),
  blkOf = k => Math.round(ARMOR[k].blk * qMul(k, 0.2));
const blockPow = () => (eq.off ? blkOf(eq.off) : BARE_BLOCK);
const durMax = k => DUR_MAX[k] && Math.round(DUR_MAX[k] * qMul(k, 0.5));
const armorTotal = () => EQ_SLOTS.reduce((a, [sl]) => a + (eq[sl] ? armOf(eq[sl]) : 0), 0);
const armorCut = () => Math.round((1 - ARM_K / (ARM_K + armorTotal())) * 100);
// how other players draw you: 2 = treant armour, 1 = any armour, 0 = none
const armorLook = () => (eq.body === '樹精裝備' ? 2 : eq.head || eq.body || eq.legs ? 1 : 0);
function toggleEq(k) {
  const sl = ARMOR[k] && ARMOR[k].slot;
  if (!sl || !has(k)) return;
  eq[sl] = eq[sl] === k ? null : k;
}
// a bag (yours, a chest's) as stacks: [[item, count], ...]; how many slots it takes; how many more of k still fit in cap slots
function stacks(b) {
  const o = [];
  for (const k in b) {
    let n = b[k];
    const s = stackOf(k);
    while (n > 0) {
      o.push([k, Math.min(n, s)]);
      n -= s;
    }
  }
  return o;
}
function slotsOf(b) {
  let n = 0;
  for (const k in b) if (b[k] > 0) n += Math.ceil(b[k] / stackOf(k));
  return n;
}
function roomFor(b, k, cap) {
  const s = stackOf(k),
    have = b[k] || 0;
  return Math.max(0, (have % s ? s - (have % s) : 0) + (cap - slotsOf(b)) * s);
}
const bagFull = () => slotsOf(inv) >= BAG_SLOTS;
// what doesn't fit in the bag falls on the ground as a sack (the server-run world has no bag of its own)
function give(k, n, x, y, toPet) {
  if (n <= 0 || MODE === 'host') return;
  const cp = toPet && curPet();
  if (cp) {
    cp.bag[k] = (cp.bag[k] || 0) + n;
    floats.push({ x: x ?? cp.x, y: (y ?? cp.y) - 18, txt: `+${n} ${k}`, t: 1.2, col: '#bfe3a0' });
    return;
  }
  const fit = Math.min(n, roomFor(inv, k, BAG_SLOTS));
  if (fit > 0) {
    inv[k] = (inv[k] || 0) + fit;
    hotAdd(k);
    floats.push({ x: x ?? P.x, y: (y ?? P.y) - 18, txt: `+${fit} ${k}`, t: 1.4, col: ITEM[k] || '#fff' });
  }
  if (n > fit) {
    act({ t: 'drop', x: P.x + rnd(-14, 14), y: P.y + rnd(6, 18), bag: { [k]: n - fit } });
    toast(`背包滿了，${k} ×${n - fit} 掉在腳邊`);
  }
}
function take(cost) {
  for (const k in cost) inv[k] -= cost[k];
}
function afford(cost) {
  for (const k in cost) if ((inv[k] || 0) < cost[k]) return false;
  return true;
}
// a pot cooks only with a campfire right next to it
const potLit = s => structs.some(f => f.k === 'fire' && dist(f, s) < 100);
function nearPot() {
  return structs.some(s => s.k === 'pot' && dist(s, P) < 200 && potLit(s));
}
function nearBench() {
  return structs.some(s => s.k === 'bench' && dist(s, P) < 240);
}
// bench level: 1, plus one for each kind of add-on (anvil, rack) built within BENCH_UP_R of it; the best bench near you counts
const BENCH_UPS = ['anvil', 'rack'],
  BENCH_UP_R = 200;
function benchLvOf(b) {
  return 1 + BENCH_UPS.filter(k => structs.some(s => s.k === k && dist(s, b) < BENCH_UP_R)).length;
}
function benchLv() {
  let lv = 0;
  for (const s of structs) if (s.k === 'bench' && dist(s, P) < 240) lv = Math.max(lv, benchLvOf(s));
  return lv;
}
const recipeLv = k => {
  const r = RECIPES.find(r => r.id === k);
  return (r && r.lv) || 1;
};
const upNames = lv =>
  BENCH_UPS.slice(0, lv - 1)
    .map(k => RECIPES.find(r => r.id === k).name)
    .join('、');
// comfort: 1 + each kind of furniture within COMFORT_R; resting by a fire lasts restDur(comfort) seconds
const COMFORT = ['bed', 'chair', 'rug', 'banner', 'lamp'],
  COMFORT_R = 220;
const comfortAt = (x, y) =>
  1 + COMFORT.filter(k => structs.some(s => s.k === k && Math.hypot(s.x - x, s.y - y) < COMFORT_R)).length;
const restDur = lv => 120 + 60 * lv;
function isNight() {
  return dayT > 0.66;
}
function darkness() {
  const t = dayT;
  if (t < 0.58) return 0;
  if (t < 0.68) return ((t - 0.58) / 0.1) * 0.74;
  if (t < 0.94) return 0.74;
  return (1 - (t - 0.94) / 0.06) * 0.74;
}

/* ---------- toast & banner ---------- */
let toastT = 0,
  bannerT = 0;
function toast(s) {
  $('toast').textContent = s;
  $('toast').classList.add('on');
  toastT = 2.2;
}
function banner(h, sub) {
  $('banner').innerHTML = h + (sub ? `<small>${sub}</small>` : '');
  $('banner').classList.add('on');
  bannerT = 4;
}

/* ---------- input ---------- */
const keys = {};
let mouse = { x: 0, y: 0, on: false },
  atkHeld = false,
  blockHeld = false,
  joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Tab' || e.key === 'i' || e.key === 'I') {
    e.preventDefault();
    if (!$('intro').hidden) return;
    togglePanel();
    return;
  }
  if (e.key === 'Escape' && !$('emoteMenu').hidden) {
    toggleEmotes(false);
    return;
  }
  if (e.key === 'Escape') {
    if (!$('settings').hidden) toggleSettings(false);
    else if (!$('bigmap').hidden) toggleMap(false);
    else if (!$('panel').hidden) togglePanel(false);
    else if (placing) stopPlace();
    else if ($('intro').hidden) toggleSettings(true);
    return;
  }
  if (e.code === 'KeyM') {
    toggleMap();
    return;
  }
  if (e.code === 'KeyG') {
    toggleGray();
    return;
  }
  if (paused) return;
  if (e.code === 'KeyR' && placing) {
    rotPlace();
    return;
  }
  if (e.code === 'KeyB') {
    toggleBuild();
    return;
  }
  if (e.code === 'KeyT') {
    const w = !TOUCH && mouse.on ? worldMouse() : { x: P.x + Math.cos(P.face) * 80, y: P.y + Math.sin(P.face) * 80 };
    sendPing(w.x, w.y);
    return;
  }
  keys[e.code] = true;
  if (e.code === 'Space') {
    e.preventDefault();
    doRoll();
  }
  if (e.code === 'KeyE') doUse();
  if (e.code === 'KeyQ') {
    if (placing) selectBuild(buildSel + 1);
    else hotNext();
  }
  if (e.code === 'KeyZ' && !placing) {
    toggleEmotes();
    return;
  }
  if (/^Digit[1-8]$/.test(e.code) && !$('emoteMenu').hidden) {
    setEmote(+e.code[5] - 1);
    return;
  }
  if (/^Digit[1-8]$/.test(e.code)) {
    if (placing) selectBuild(+e.code[5] - 1);
    else hotSelect(+e.code[5] - 1);
  }
});
addEventListener('keyup', e => {
  keys[e.code] = false;
});
addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  atkHeld = false;
  blockHeld = false;
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  if (paused) return;
  if (e.pointerType === 'mouse') {
    mouse.on = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (e.button === 1) {
      e.preventDefault();
      const w = worldMouse();
      sendPing(w.x, w.y);
      return;
    }
    if (e.button === 2) {
      if (placing) doDemolish();
      else blockHeld = true;
      return;
    }
    if (placing) {
      tryPlace();
      return;
    }
    if (useHeld()) return;
    atkHeld = true;
    return;
  }
  if (joy.id === null && e.clientX < VW * 0.55) {
    joy.id = e.pointerId;
    joy.ox = e.clientX;
    joy.oy = e.clientY;
    joy.dx = joy.dy = 0;
    const s = $('stick');
    s.style.display = 'block';
    s.style.left = joy.ox + 'px';
    s.style.top = joy.oy + 'px';
    s.firstElementChild.style.transform = '';
    cv.setPointerCapture(e.pointerId);
  }
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') {
    mouse.on = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!(e.buttons & 2)) blockHeld = false;
    else if (!placing && !paused) blockHeld = true;
    return;
  }
  if (e.pointerId === joy.id) {
    let dx = e.clientX - joy.ox,
      dy = e.clientY - joy.oy;
    const l = Math.hypot(dx, dy),
      m = 52;
    if (l > m) {
      dx = (dx / l) * m;
      dy = (dy / l) * m;
    }
    joy.dx = dx / m;
    joy.dy = dy / m;
    $('stick').firstElementChild.style.transform = `translate(${dx}px,${dy}px)`;
  }
});
function endPtr(e) {
  if (e.pointerType === 'mouse') {
    if (!(e.buttons & 1)) atkHeld = false;
    if (!(e.buttons & 2)) blockHeld = false;
    return;
  }
  if (e.pointerId === joy.id) {
    joy.id = null;
    joy.dx = joy.dy = 0;
    $('stick').style.display = 'none';
  }
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
function tbtn(id, down, up) {
  const b = $(id);
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    b.classList.add('down');
    if (!paused) down();
  });
  const u = e => {
    b.classList.remove('down');
    up && up();
  };
  b.addEventListener('pointerup', u);
  b.addEventListener('pointercancel', u);
  b.addEventListener('pointerleave', u);
}
tbtn(
  'bAtk',
  () => {
    if (placing) tryPlace();
    else if (!useHeld()) atkHeld = true;
  },
  () => {
    atkHeld = false;
  }
);
tbtn('bRoll', doRoll);
tbtn(
  'bBlock',
  () => {
    blockHeld = true;
  },
  () => {
    blockHeld = false;
  }
);
tbtn('bUse', doUse);
tbtn('bSwap', hotNext);
cv.addEventListener(
  'wheel',
  e => {
    if (paused) return;
    e.preventDefault();
    const d = e.deltaY > 0 ? 1 : -1;
    if (placing) selectBuild(buildSel + d);
    else hotSelect(hotSel + d);
  },
  { passive: false }
);
$('hotbar').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-hs]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  if (paused) return;
  if (placing) selectBuild(+b.dataset.hs);
  else hotSelect(+b.dataset.hs);
});
/* ---------- settings ---------- */
// 每台電腦各自一份，存在 localStorage（northland-settings）；舊版只有黑白濾鏡，存在 northland-gray
const SET = (() => {
  const d = { gray: false, shake: true, sound: false, vol: 60 };
  try {
    const s = JSON.parse(localStorage.getItem('northland-settings'));
    if (s) Object.assign(d, s);
    else if (localStorage.getItem('northland-gray')) d.gray = true;
  } catch (e) {}
  return d;
})();
function applySet() {
  document.documentElement.classList.toggle('gray', !!SET.gray);
}
applySet();
function saveSet() {
  try {
    localStorage.setItem('northland-settings', JSON.stringify(SET));
  } catch (e) {}
}
function setOpt(k) {
  SET[k] = !SET[k];
  saveSet();
  applySet();
  if (k === 'sound' && SET.sound) sfx('pick');
  if (!$('settings').hidden) renderSettings();
}
const toggleGray = () => setOpt('gray');
/* ---------- sound ---------- */
// every sound is synthesised with WebAudio (no files); off by default. The context is made on first use, which is always a click or a key
let AC = null,
  MASTER = null;
function audio() {
  if (!SET.sound || HEADLESS) return null;
  try {
    if (!AC) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      AC = new C();
      MASTER = AC.createGain();
      MASTER.connect(AC.destination);
    }
    if (AC.state === 'suspended') AC.resume();
    MASTER.gain.value = SET.vol / 100;
    return AC;
  } catch (e) {
    return null;
  }
}
function tone(f, d, type, v, f2) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime,
    o = a.createOscillator(),
    g = a.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g);
  g.connect(MASTER);
  o.start(t);
  o.stop(t + d + 0.02);
}
function noise(d, v, fq, q) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime,
    n = Math.max(1, Math.floor(a.sampleRate * d)),
    b = a.createBuffer(1, n, a.sampleRate),
    c = b.getChannelData(0);
  for (let i = 0; i < n; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource(),
    fl = a.createBiquadFilter(),
    g = a.createGain();
  src.buffer = b;
  fl.type = 'bandpass';
  fl.frequency.value = fq || 1200;
  fl.Q.value = q || 1;
  g.gain.value = v || 0.2;
  src.connect(fl);
  fl.connect(g);
  g.connect(MASTER);
  src.start(t);
}
const later = (ms, f) => setTimeout(f, ms);
const SFX = {
  swing: () => noise(0.12, 0.1, 2400, 0.8),
  hit: () => {
    noise(0.08, 0.3, 900);
    tone(160, 0.1, 'square', 0.08, 80);
  },
  chop: () => {
    noise(0.1, 0.25, 500, 2);
    tone(220, 0.08, 'triangle', 0.1, 140);
  },
  mine: () => {
    tone(1400, 0.12, 'square', 0.05, 900);
    noise(0.06, 0.2, 3000, 3);
  },
  pick: () => tone(880, 0.08, 'sine', 0.12, 1320),
  craft: () => {
    tone(523, 0.08, 'triangle', 0.15);
    later(70, () => tone(784, 0.12, 'triangle', 0.15));
  },
  build: () => {
    noise(0.08, 0.25, 400, 1.5);
    tone(180, 0.1, 'triangle', 0.12, 120);
  },
  hurt: () => {
    tone(220, 0.18, 'sawtooth', 0.1, 90);
    noise(0.1, 0.2, 600);
  },
  block: () => {
    tone(300, 0.08, 'square', 0.08, 200);
    noise(0.06, 0.2, 1800, 2);
  },
  parry: () => {
    tone(1200, 0.25, 'triangle', 0.16, 1800);
    tone(1800, 0.2, 'sine', 0.07);
  },
  roll: () => noise(0.18, 0.1, 700, 0.7),
  eat: () => {
    noise(0.06, 0.15, 1500, 4);
    later(110, () => noise(0.06, 0.15, 1300, 4));
  },
  level: () => [523, 659, 784, 1047].forEach((f, i) => later(i * 80, () => tone(f, 0.15, 'triangle', 0.13))),
  ping: () => {
    tone(1320, 0.12, 'sine', 0.14);
    later(110, () => tone(1760, 0.18, 'sine', 0.1));
  },
  break: () => {
    noise(0.2, 0.3, 2500, 1);
    tone(400, 0.2, 'square', 0.05, 100);
  },
  die: () => tone(330, 0.8, 'sawtooth', 0.1, 80)
};
function sfx(k) {
  if (SET.sound && !HEADLESS && SFX[k])
    try {
      SFX[k]();
    } catch (e) {}
}
const SET_OPTS = [
  ['gray', '黑白畫面', TOUCH ? '整個畫面變黑白' : '整個畫面變黑白，按 G 也能切換'],
  ['shake', '畫面震動', '打到東西、被打的時候畫面會晃']
];
const KEY_HELP = [
  ['WASD／方向鍵', '移動'],
  ['Shift', '衝刺'],
  ['左鍵', '攻擊・吃手上的食物'],
  ['右鍵（按住）', '格擋；剛舉起時被打中＝招架'],
  ['空白鍵', '翻滾'],
  ['E', '互動'],
  ['1～8／滾輪／Q', '切換快捷欄'],
  ['Tab', '背包・製作'],
  ['B', '建造模式（R 轉向）'],
  ['M', '大地圖（加標記、發信號）'],
  ['T／滑鼠中鍵', '對準游標發信號給大家'],
  ['G', '黑白畫面'],
  ['Z', '表情動作（再按 1～8）'],
  ['Esc', '設定・關閉視窗']
];
function renderSettings() {
  const wipe = MODE === 'solo' || (netInfo && netInfo.local);
  const sw = ([k, t, d]) =>
    `<div class="setrow"><span>${t}<small>${d}</small></span><button type="button" class="sw2" role="switch" aria-checked="${!!SET[k]}" aria-label="${t}" data-set="${k}"></button></div>`;
  $('setBody').innerHTML =
    `<div class="sets"><section><h4>畫面</h4>${SET_OPTS.map(sw).join('')}</section>` +
    `<section><h4>聲音</h4>${sw(['sound', '音效', '預設關閉；在辦公室玩記得戴耳機'])}<div class="setrow"><span>音量</span><input type="range" id="volIn" min="0" max="100" step="5" value="${SET.vol}" aria-label="音量"><output id="volOut">${SET.vol}</output></div></section>` +
    (TOUCH
      ? ''
      : `<section><h4>按鍵</h4><div class="keys">${KEY_HELP.map(([a, b]) => `<kbd>${a}</kbd><b>${b}</b>`).join('')}</div></section>`) +
    (wipe
      ? `<section><h4>世界</h4>${MODE !== 'solo' ? '<p class="note">存檔、帳號（重設 PIN、踢人）都在 <a href="/admin" target="_blank" rel="noopener" style="color:var(--accent)">後台管理</a>（只有這台電腦打得開）。</p>' : ''}<button class="danger" id="wipe" type="button">${MODE === 'solo' ? '開始新世界（刪除存檔）' : '開始新世界（目前的世界會改名保留，大家會重新連線）'}</button></section>`
      : '') +
    '</div>';
  $('setBody')
    .querySelectorAll('[data-set]')
    .forEach(x => x.addEventListener('click', () => setOpt(x.dataset.set)));
  const vi = $('volIn');
  vi.addEventListener('input', () => {
    SET.vol = +vi.value;
    $('volOut').textContent = SET.vol;
    if (MASTER) MASTER.gain.value = SET.vol / 100;
  });
  vi.addEventListener('change', () => {
    saveSet();
    sfx('pick');
  });
  const w = $('wipe');
  if (w)
    w.addEventListener('click', () => {
      if (w.dataset.c) {
        resetSave();
      } else {
        w.dataset.c = '1';
        w.textContent = '再按一次確認刪除';
      }
    });
}
function toggleSettings(on) {
  const m = $('settings');
  on = on === undefined ? m.hidden : on;
  if (on) {
    closeBagMenu();
    $('panel').hidden = true;
    $('bigmap').hidden = true;
    atkHeld = false;
    renderSettings();
  }
  m.hidden = !on;
  syncPaused();
  if (!on) writeSave();
}
// any open window pauses your own input (and the whole world in solo)
function syncPaused() {
  paused = worldPaused || ['intro', 'dead', 'panel', 'bigmap', 'settings'].some(id => !$(id).hidden);
}
$('btnSet').addEventListener('click', () => toggleSettings());
$('setX').addEventListener('click', () => toggleSettings(false));
$('settings').addEventListener('pointerdown', e => {
  if (e.target.id === 'settings') toggleSettings(false);
});
$('btnBuild').addEventListener('click', () => {
  if (!paused) toggleBuild();
});
$('btnPanel').addEventListener('click', () => togglePanel());
$('panelX').addEventListener('click', () => togglePanel(false));
document.querySelectorAll('.tab').forEach(t =>
  t.addEventListener('click', () => {
    panelTab = t.dataset.tab;
    renderPanel();
  })
);
$('panel').addEventListener('pointerdown', e => {
  if (e.target.id === 'panel') togglePanel(false);
});

/* ---------- actions ---------- */
function worldMouse() {
  return { x: (mouse.x - VW / 2) / SCALE + cam.x, y: (mouse.y - VH / 2) / SCALE + cam.y };
}
function doRoll() {
  const cost = (biomeAt(P.x, P.y) === B_SNOW ? 14 * SNOW_ST : 14) * skCut('roll', 0.006);
  if (P.roll > 0 || P.st < cost || placing || P.rooted > 0 || P.boat) return;
  P.st -= cost;
  P.stDelay = 0.9;
  P.roll = 0.32;
  skXP('roll');
  sfx('roll');
  let dx = 0,
    dy = 0;
  if (TOUCH) {
    dx = joy.dx;
    dy = joy.dy;
  } else {
    dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    dy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  }
  if (!dx && !dy) {
    dx = Math.cos(P.face);
    dy = Math.sin(P.face);
  }
  const l = Math.hypot(dx, dy);
  P.rdx = dx / l;
  P.rdy = dy / l;
}
/* ---------- hotbar ---------- */
// 8 slots; the selected slot is what you hold. Weapons and tools set P.weapon, food in the selected slot is eaten on attack
const HOT_N = 8;
let hot = new Array(HOT_N).fill(null),
  hotSel = 0,
  hotSig = '';
function hotAdd(k) {
  if (!(WEAPONS[k] || FOODS[k]) || hot.includes(k)) return;
  const i = hot.indexOf(null);
  if (i >= 0) hot[i] = k;
} // new weapons/food fill the first empty slot
function hotPut(k) {
  const i = hot.indexOf(k);
  if (i >= 0) hot[i] = null;
  hot[hotSel] = k;
  syncHeld();
} // bag button: into the selected slot
const held = () => hot[hotSel];
function syncHeld() {
  for (let i = 0; i < HOT_N; i++) if (hot[i] && !has(hot[i])) hot[i] = null;
  for (const [sl] of EQ_SLOTS) if (eq[sl] && !has(eq[sl])) eq[sl] = null;
  const k = hot[hotSel];
  P.weapon = WEAPONS[k] ? k : 'none';
}
function hotSelect(i, quiet) {
  hotSel = (i + HOT_N) % HOT_N;
  syncHeld();
  if (!quiet) toast(`${hotSel + 1}：${held() || '空手'}`);
}
function hotNext() {
  for (let d = 1; d <= HOT_N; d++) {
    const i = (hotSel + d) % HOT_N;
    if (hot[i]) {
      hotSelect(i);
      return;
    }
  }
  toast('快捷欄是空的');
}
function useHeld() {
  const k = held();
  if (!FOODS[k]) return false;
  eat(k);
  syncHeld();
  return true;
}
function hotDefault() {
  hot = new Array(HOT_N).fill(null);
  for (const k of [...Object.keys(WEAPONS), ...Object.keys(FOODS)]) if (k !== 'none' && has(k)) hotAdd(k);
}
function renderHot() {
  const hb = $('hotbar');
  // build mode: each slot shows how many more you can build; the place bar shows what the selected one needs and what you have left
  if (placing) {
    const L = buildList(),
      ns = L.map(r => (r === DEMOLISH ? -1 : buildN(r))),
      pc = placing === DEMOLISH ? '' : placeCostHtml(placing),
      sig = JSON.stringify(['b', buildSel, ns, pc]);
    if (sig === hotSig) return;
    hotSig = sig;
    hb.classList.add('build');
    $('placeCost').innerHTML = pc;
    hb.innerHTML = L.map(
      (r, i) =>
        `<button type="button" class="hs${r === placing ? ' on' : ''}${ns[i] === 0 ? ' no' : ''}" data-hs="${i}" title="${r.name}"><kbd>${i + 1}</kbd>${ns[i] >= 0 ? `<small>${ns[i]}</small>` : ''}${icon(r.id)}<span class="hn">${r.name}</span></button>`
    ).join('');
    return;
  }
  hb.classList.remove('build');
  const sig = JSON.stringify([hot, hotSel, hot.map(k => k && inv[k]), hot.map(k => k && durOf(k))]);
  if (sig === hotSig) return;
  hotSig = sig;
  $('hotbar').innerHTML = hot
    .map(
      (k, i) =>
        `<button type="button" class="hs${i === hotSel ? ' on' : ''}" data-hs="${i}" title="${k ? k + (statsText(k) ? '：' + statsText(k) : '') : '空'}"><kbd>${i + 1}</kbd>${k ? `${icon(k)}<span class="hn">${k}</span>${WEAPONS[k] ? '' : `<small>${inv[k]}</small>`}${durBar(k)}` : ''}</button>`
    )
    .join('');
}
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 6.2832;
  while (d < -Math.PI) d += 6.2832;
  return Math.abs(d);
}
function attack() {
  const w = WEAPONS[P.weapon];
  if (P.cd > 0 || P.roll > 0) return;
  if (P.st < w.st) {
    P.stDelay = Math.max(P.stDelay, 0.4);
    return;
  }
  // touch auto-aim
  if (TOUCH) {
    let best = null,
      bd = w.range + 60;
    for (const m of mobs) {
      const d = dist(m, P) - m.r;
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (!best) {
      forCells(P.x, P.y, 2, o => {
        const d = dist(o, P);
        if (d < bd && !(o.k === 'bush' && o.dep > 0)) {
          bd = d;
          best = o;
        }
      });
    }
    if (best) P.face = Math.atan2(best.y - P.y, best.x - P.x);
  }
  P.cd = w.cd;
  P.swing = 0.24;
  P.st -= w.st;
  P.stDelay = 0.9;
  sfx('swing');
  if (w.proj) {
    wear(P.weapon);
    act({
      t: 'shot',
      x: Math.round(P.x),
      y: Math.round(P.y),
      a: Math.round(P.face * 100) / 100,
      dmg: Math.round(wDmg(P.weapon) * (P.rest > 0 ? 1.1 : 1) * skMul('ranged'))
    });
    return;
  } // ranged: the shot does its own hit test
  let hit = false;
  for (const m of [...mobs]) {
    const d = dist(m, P);
    if (d < w.range + m.r && angDiff(Math.atan2(m.y - P.y, m.x - P.x), P.face) < w.arc) {
      const dmg = Math.round(wDmg(P.weapon) * (P.rest > 0 ? 1.1 : 1) * skMul('melee'));
      floats.push(
        shielded(m)
          ? { x: m.x, y: m.y - m.r - 8, txt: '無敵', t: 0.8, col: '#9dffb0' }
          : { x: m.x, y: m.y - m.r - 8, txt: String(dmg), t: 0.8, col: '#ffe9b8' }
      );
      if (!hit) sfx('hit');
      burst(m.x, m.y, m.k === 'moss' || m.k === 'treant' || m.k === 'sprout' ? '#9fc069' : '#b84a3a', 6);
      shake = Math.max(shake, 3);
      act({ t: 'hit', id: m.id, dmg, x: P.x, y: P.y });
      hit = true;
    }
  }
  // 範圍攻擊：揮擊範圍內的樹、石頭、礦全部一起打；什麼都沒打到才撿最近的小東西
  const inArc = o => {
    const d = dist(o, P) - (RES[o.k].solid || 6) * o.sz;
    return d < w.range - 4 && angDiff(Math.atan2(o.y - P.y, o.x - P.x), P.face) < w.arc + 0.3 ? d : -1;
  };
  const big = [];
  let best = null,
    bd = 1e9;
  forCells(P.x, P.y, 2, o => {
    const d = inArc(o);
    if (d < 0) return;
    if (!RES[o.k].pick) big.push(o);
    else if (d < bd) {
      bd = d;
      best = o;
    }
  });
  // wear: the weapon in hand if a mob was hit, and each tool that did the chopping or mining (once per swing)
  const used = new Set();
  if (hit) {
    used.add(P.weapon);
    skXP('melee');
  }
  if (big.length) {
    for (const o of big) used.add(hitRes(o));
  } else if (!hit && best) hitRes(best);
  for (const k of used) wear(k);
}
// durability of the one in use (you can carry more than one of a kind: the next one starts fresh)
const durOf = k => (has(k) && dur[k] !== undefined ? dur[k] : durMax(k));
function wear(k) {
  const M = durMax(k);
  if (!M || !has(k) || !CFG.wear) return;
  const was = durOf(k),
    d = was - CFG.wear,
    th = Math.ceil(M * 0.15);
  if (d > 0) {
    dur[k] = d;
    if (was > th && d <= th) toast(`${k}快壞了，到工作台旁修理`);
    return;
  }
  inv[k]--;
  delete dur[k];
  syncHeld();
  sfx('break');
  burst(P.x, P.y - 14, '#c8c2b2', 12);
  toast(has(k) ? `${k}壞了，換上下一把` : `${k}壞了`);
}
const damaged = () => Object.keys(dur).filter(k => has(k) && dur[k] < durMax(k));
function durBar(k) {
  const M = durMax(k);
  if (!M || !has(k) || durOf(k) >= M) return '';
  const f = durOf(k) / M;
  return `<span class="dur"><i style="width:${Math.round(f * 100)}%;background:${f > 0.5 ? '#7fb069' : f > 0.15 ? '#e2c14d' : '#d06a5a'}"></i></span>`;
}
function forCells(x, y, sp, fn) {
  const i0 = Math.floor(x / CELL),
    j0 = Math.floor(y / CELL);
  for (let j = j0 - sp; j <= j0 + sp; j++)
    for (let i = i0 - sp; i <= i0 + sp; i++) {
      if (i < 0 || j < 0 || i >= COLS || j >= ROWS) continue;
      const o = resGrid[j * COLS + i];
      if (o) fn(o);
    }
}
function bestTool(table) {
  let b = 0,
    k = null;
  for (const n in table) {
    if ((n === 'none' || has(n)) && toolPow(table, n) > b) {
      b = toolPow(table, n);
      k = n;
    }
  }
  return [b, k];
}
// local intent: tool checks use this player's bag, the world change itself goes through act()
function hitRes(o) {
  const d = RES[o.k];
  let dmg = 0;
  if (d.pick) {
    if (o.k === 'bush' && o.dep > 0) {
      toast('莓果還沒長回來');
      return;
    }
    if (!d.drop.some(([k]) => roomFor(inv, k, BAG_SLOTS) > 0)) {
      toast('背包滿了');
      return;
    }
  }
  let tool = null;
  if (d.pick) {
  } else if (d.mine) {
    const need = d.tier || 1;
    let m = 0;
    for (const n in MINE)
      if (has(n) && PICK_TIER[n] >= need && toolPow(MINE, n) > m) {
        m = toolPow(MINE, n);
        tool = n;
      }
    if (!m) {
      toast(need > 1 ? `需要銅鎬才能挖${d.name}` : `需要燧石鎬才能挖${d.name}`);
      o.flash = 0.15;
      return;
    }
    dmg = Math.round(m * skMul('mine'));
    skXP('mine');
    shake = Math.max(shake, 2);
  } else {
    [dmg, tool] = bestTool(CHOP);
    dmg = Math.round(dmg * skMul('chop'));
    skXP('chop');
    shake = Math.max(shake, 2);
  }
  sfx(d.pick ? 'pick' : d.mine ? 'mine' : 'chop');
  act({ t: 'res', c: o.cell, dmg });
  return tool;
}
// world side (solo / host)
function worldRes(c, dmg, from, toPet) {
  const o = resGrid[c];
  if (!o) return;
  const d = RES[o.k];
  if (d.pick) {
    if (o.k === 'bush') {
      if (o.dep > 0) return;
      evt({ t: 'bd', c });
      if (Math.random() < SEED_P) giveTo(from, '胡蘿蔔種子', 1, o.x, o.y - 14, toPet);
    } else removeRes(o);
    for (const [k, a, b] of d.drop) giveTo(from, k, dropN(a, b), o.x, o.y, toPet);
    return;
  }
  if (toPet) return;
  evt({ t: 'rh', c, hp: o.hp - dmg });
  if (o.hp <= 0) {
    for (const [k, a, b] of d.drop) giveTo(from, k, dropN(a, b), o.x, o.y);
    removeRes(o);
  }
}
function removeRes(o) {
  evt({ t: 'rx', c: o.cell });
  if (o.k === 'etree') return;
  regrow.push({
    k: o.k,
    x: o.x,
    y: o.y,
    cell: o.cell,
    at: time + (o.k === 'rock' ? 400 : RES[o.k].ore ? 600 : o.k.length < 5 ? 260 : 200)
  });
}
// the Treant Elder takes no damage while it devours its saplings
function shielded(m) {
  return m.k === 'treant' && m.state === 'eat';
}
function hitMob(m, dmg, from, ax, ay, byPet) {
  if (shielded(m)) return;
  m.hp -= m.stun > 0 ? dmg * 1.5 : dmg;
  m.flash = 0.15;
  const a = Math.atan2(m.y - ay, m.x - ax),
    kb = m.k === 'boss' ? 60 : m.k === 'treant' ? 20 : 220;
  m.kx = Math.cos(a) * kb;
  m.ky = Math.sin(a) * kb;
  m.aggro = 12;
  m.petT = byPet ? { o: from, until: time + 8 } : null; // mobs only turn on a pet that hit them
  if (m.hp <= 0) killMob(m, from);
}
function killMob(m, from) {
  const i = mobs.indexOf(m);
  if (i < 0) return;
  mobs.splice(i, 1);
  evt({ t: 'mk', id: m.id, x: m.x, y: m.y });
  if (m.k === 'boar') {
    lootTo(from, '生肉', ri(1, 2), m.x, m.y);
    if (Math.random() < 0.8) lootTo(from, '皮革', ri(1, 2), m.x, m.y - 14);
    if (Math.random() < 0.4) lootTo(from, '獠牙', 1, m.x, m.y - 28);
  }
  if (m.k === 'frog') {
    lootTo(from, '生肉', 1, m.x, m.y);
    if (Math.random() < 0.35) lootTo(from, '蘑菇', 1, m.x, m.y - 14);
  }
  if (m.k === 'moss') {
    lootTo(from, '樹脂', ri(1, 2), m.x, m.y);
    if (Math.random() < 0.25) lootTo(from, '燧石', 1, m.x, m.y - 14);
  }
  if (m.k === 'sprout') lootTo(from, '木頭', ri(1, 2), m.x, m.y);
  if (m.k === 'treant') {
    boss = null;
    lootAll('堅硬樹皮', ri(3, 5), m.x, m.y);
    lootAll('古老樹枝', ri(2, 3), m.x, m.y - 14);
    lootAll('自然精華', ri(3, 4), m.x, m.y - 28);
    for (const s of mobs.filter(o => o.k === 'sprout')) {
      mobs.splice(mobs.indexOf(s), 1);
      evt({ t: 'mk', id: s.id, x: s.x, y: s.y });
    }
    for (const e of etrees) e.at = 0; // its saplings and tree walls go with it
    toAll({ t: 'tdown', x: m.x, y: m.y });
    evt({
      t: 'bn',
      h: '樹精長老倒下了',
      s: '第一次打倒樹精長老會得到長老年輪，並解鎖樹精法杖與樹精裝備，到工作台製作'
    });
    writeSave();
  }
  if (m.k === 'boss') {
    boss = null;
    flags.boss = true;
    lootAll('狼王之牙', 1, m.x, m.y);
    lootAll('皮革', 6, m.x, m.y - 14);
    toAll({ t: 'pup' });
    evt({ t: 'bn', h: '狼王倒下了', s: '第一次打倒狼王的人會得到一隻狼崽和狼王的心臟・到工作台用狼王之牙打造狼牙劍' });
    writeSave();
  }
}
function hitPlayer(dmg, src) {
  if (P.roll > 0 || P.inv > 0 || P.dead) return;
  if (P.blocking && angDiff(Math.atan2(src.y - P.y, src.x - P.x), P.face) < 1.6) {
    if (P.blockT < PARRY_T) {
      sfx('parry');
      floats.push({ x: P.x, y: P.y - 30, txt: '招架！', t: 1, col: '#ffe08a' });
      burst(P.x + Math.cos(P.face) * 14, P.y - 10 + Math.sin(P.face) * 14, '#fff2b0', 14);
      shake = Math.max(shake, 5);
      if (src.id) act({ t: 'parry', id: src.id });
      skXP('block', 3);
      if (eq.off) wear(eq.off);
      P.inv = 0.3;
      return;
    }
    const bp = Math.round(blockPow() * skMul('block')),
      cost = Math.min(dmg, bp) * 1.2 * skCut('block', 0.005);
    skXP('block');
    if (P.st >= cost) {
      P.st -= cost;
      P.stDelay = Math.max(P.stDelay, 0.6);
      if (eq.off) wear(eq.off);
      burst(P.x + Math.cos(P.face) * 14, P.y - 10 + Math.sin(P.face) * 14, '#c8c2b2', 6);
      sfx('block');
      if (dmg <= bp) {
        floats.push({ x: P.x, y: P.y - 30, txt: '格擋', t: 0.8, col: '#c8d6e2' });
        P.inv = 0.3;
        return;
      }
      dmg -= bp;
    } else {
      P.st = 0;
      P.stag = 0.8;
      floats.push({ x: P.x, y: P.y - 30, txt: '防禦被打破', t: 1, col: '#ff8a7a' });
    }
  }
  sfx('hurt');
  dmg *= ARM_K / (ARM_K + armorTotal());
  for (const [sl] of EQ_SLOTS) if (eq[sl] && sl !== 'off') wear(eq[sl]);
  P.hp -= dmg;
  P.inv = 0.45;
  P.hurt = 0.25;
  shake = 7;
  const a = Math.atan2(P.y - src.y, P.x - src.x);
  move(P, Math.cos(a) * 14, Math.sin(a) * 14);
  floats.push({ x: P.x, y: P.y - 26, txt: '-' + Math.round(dmg), t: 0.9, col: '#ff8a7a' });
  if (P.hp <= 0) {
    P.hp = 0;
    die();
  }
}
// dying leaves the bag in a grave where you fell; what is on the hotbar and what you wear stays with you
function die() {
  sfx('die');
  if (P.boat) {
    P.boat = false;
    act({ t: 'unboard', x: P.x, y: P.y });
  }
  P.burn = 0;
  // CFG.death: keep = nothing is left behind, bag = the bag (not the hotbar or what you wear), all = everything
  const keep = CFG.death === 'all' ? new Set() : new Set([...hot, ...Object.values(eq)].filter(Boolean)),
    bag = {};
  if (CFG.death !== 'keep')
    for (const k in inv)
      if (inv[k] > 0 && !keep.has(k)) {
        bag[k] = inv[k];
        inv[k] = 0;
      }
  syncHeld();
  if (Object.keys(bag).length) act({ t: 'drop', x: Math.round(P.x), y: Math.round(P.y), bag, g: myName });
  for (const k in sk) sk[k] *= 1 - CFG.skillLoss / 100;
  $('deadMsg').textContent =
    CFG.death === 'keep'
      ? '這個世界倒下不會掉東西。'
      : !Object.keys(bag).length
        ? '背包是空的，沒有留下東西。'
        : CFG.death === 'all'
          ? '身上所有東西（包含快捷欄和穿著的）都留在倒下的地方的墓碑裡。地圖上有標記，回去按 E 拿回來。'
          : '背包裡的東西留在倒下的地方的墓碑裡（快捷欄和身上穿的還在）。地圖上有標記，回去按 E 拿回來。';
  $('deadNote').textContent =
    `食物效果消失${CFG.skillLoss ? `，每種熟練度掉 ${CFG.skillLoss}%` : ''}。你會在床邊（或出生點）醒來。`;
  P.dead = true;
  paused = true;
  $('dead').hidden = false;
  $('bigmap').hidden = true;
  atkHeld = false;
}
$('respawn').addEventListener('click', () => {
  P.rooted = 0;
  foods = [];
  P.hp = 25;
  P.st = 50;
  P.rest = 0;
  P.dead = false;
  const bed = MODE === 'solo' && structs.find(s => s.k === 'bed');
  const sp = bed ? { x: bed.x, y: bed.y + 34 } : spawnPt;
  P.x = sp.x;
  P.y = sp.y;
  for (let k = 0; k < 20 && blocked(P.x, P.y, P.r); k++) {
    P.x += rnd(-30, 30);
    P.y += rnd(-30, 30);
  }
  for (const m of mobs) if (m.k !== 'boss' && m.k !== 'treant' && dist(m, P) < 400) m.x += 600;
  $('dead').hidden = true;
  syncPaused();
  writeSave();
});
function eat(k) {
  if (!FOODS[k] || !has(k)) return;
  if (foods.some(f => f.k === k)) {
    toast('同一種食物還在消化中');
    return;
  }
  if (foods.length >= 3) {
    toast('肚子已經裝不下了');
    return;
  }
  sfx('eat');
  inv[k]--;
  foods.push({ k, t: FOODS[k].t });
  P.hp = Math.min(maxHp(), P.hp + 8);
  if (k === '烤肉') ate = true;
  toast(`吃了${k}：血量上限 +${FOODS[k].hp}，耐力上限 +${FOODS[k].st}`);
}

function nearestUse() {
  let best = null,
    bd = 1e9;
  if (P.boat) {
    const l = landSpot();
    return l ? { land: l } : null;
  }
  for (const s of [...structs, altar]) {
    const d = dist(s, P),
      lim = s.k === 'altar' ? 84 : 62;
    if (d < lim && d < bd && !isWallK(s.k)) {
      best = { s };
      bd = d;
    }
  }
  if (best) return best;
  for (const l of loots) {
    const d = dist(l, P);
    if (d < 46 && d < bd) {
      bd = d;
      best = { l };
    }
  }
  for (const m of mobs)
    if (TAME_FOOD[m.k] && has(TAME_FOOD[m.k]) && m.aggro <= 0) {
      const d = dist(m, P) - m.r;
      if (d < 40 && d < bd) {
        bd = d;
        best = { m };
      }
    }
  if (best) return best;
  forCells(P.x, P.y, 1, o => {
    if (RES[o.k].pick && !(o.k === 'bush' && o.dep > 0)) {
      const d = dist(o, P);
      if (d < 46 && d < bd) {
        bd = d;
        best = { o };
      }
    }
  });
  return best;
}
// from a boat: the closest open ground within reach of the shore
function landSpot() {
  let best = null,
    bd = 1e9;
  for (let r = 30; r <= 62; r += 16)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * 6.2832,
        x = P.x + Math.cos(a) * r,
        y = P.y + Math.sin(a) * r;
      if (!blocked(x, y, P.r) && biomeAt(x, y) !== B_LAVA && r < bd) {
        bd = r;
        best = { x, y };
      }
    }
  return best;
}
function useLabel(u) {
  if (!u) return null;
  if (u.land) return '下船';
  if (u.l && u.l.g) return myGrave(u.l) ? '拿回遺物' : `${u.l.g}的墓碑`;
  if (u.o || u.l) return '撿起';
  if (u.m) return '餵' + TAME_FOOD[u.m.k];
  const s = u.s;
  if (s.k === 'fire') return has('生肉') ? '烤肉' : '取暖';
  if (s.k === 'bed') return isNight() ? '睡覺' : '設為重生點';
  if (s.k === 'bench') return '製作';
  if (s.k === 'furnace') return '熔爐';
  if (s.k === 'chest') return '開箱子';
  if (s.k === 'pot') return potLit(s) ? '料理' : '料理鍋（要放在營火旁）';
  if (s.k === 'plot') {
    const c = s.crop;
    if (c) return c.g <= 0 ? '收成' : `${c.k}生長中 ${Math.floor((1 - c.g / CROPS[c.k].t) * 100)}%`;
    const sd = Object.keys(CROPS).find(k => has(CROPS[k].seed));
    return sd ? `種${sd}` : '菜圃（需要種子）';
  }
  if (s.k === 'boat') return '上船';
  if (s.k === 'altar')
    return boss
      ? boss.k === 'treant'
        ? '樹精長老已醒'
        : '狼王已醒'
      : hot[hotSel] === '狼王的心臟' || hot[hotSel] === '古樹種子'
        ? '獻上心臟與古樹種子'
        : '獻上祭品';
  return null;
}
function doUse() {
  if (placing) return;
  const u = nearestUse();
  if (!u) {
    toast('附近沒有可互動的東西');
    return;
  }
  if (u.land) {
    const bx = P.x,
      by = P.y;
    P.boat = false;
    P.x = u.land.x;
    P.y = u.land.y;
    act({ t: 'unboard', x: bx, y: by });
    toast('下船了');
    writeSave();
    return;
  }
  if (u.o) {
    hitRes(u.o);
    return;
  }
  if (u.l) {
    if (u.l.g && !myGrave(u.l)) {
      toast(`這是${u.l.g}的墓碑`);
      return;
    }
    if (!Object.keys(u.l.bag).some(k => roomFor(inv, k, BAG_SLOTS) > 0)) {
      toast('背包滿了');
      return;
    }
    act({ t: 'pick', id: u.l.id });
    return;
  }
  if (u.m) {
    const food = TAME_FOOD[u.m.k];
    inv[food]--;
    act({ t: 'feed', id: u.m.id, f: food });
    return;
  }
  const s = u.s;
  if (s.k === 'fire') {
    if (has('生肉')) {
      const n = inv['生肉'];
      inv['生肉'] = 0;
      give('烤肉', n, s.x, s.y);
      burst(s.x, s.y - 10, '#ffb347', 12);
    } else toast('靠近營火一會兒就能獲得「休息」');
  } else if (s.k === 'bench') togglePanel(true, 'craft');
  else if (s.k === 'furnace') {
    furnaceC = s.cell;
    togglePanel(true, 'furnace');
  } else if (s.k === 'chest') {
    chestC = s.cell;
    chMsg = '';
    togglePanel(true, 'chest');
  } else if (s.k === 'pot') {
    if (!potLit(s)) {
      toast('料理鍋要放在營火旁邊才能煮');
      return;
    }
    craftTab = 'food';
    togglePanel(true, 'craft');
  } else if (s.k === 'plot') {
    const c = s.crop;
    if (c) {
      if (c.g > 0) {
        toast(`還要 ${Math.ceil(c.g)} 秒才成熟`);
        return;
      }
      act({ t: 'harv', c: s.cell });
      return;
    }
    const k = Object.keys(CROPS).find(k => has(CROPS[k].seed));
    if (!k) {
      toast('需要種子：採莓果有機會拿到胡蘿蔔種子');
      return;
    }
    inv[CROPS[k].seed]--;
    act({ t: 'plant', c: s.cell, k });
  } else if (s.k === 'boat') act({ t: 'board', x: s.x, y: s.y });
  else if (s.k === 'bed') {
    spawnPt = { x: s.x, y: s.y + 34 };
    if (isNight()) {
      P.hp = maxHp();
      P.restLv = comfortAt(s.x, s.y);
      P.rest = restDur(P.restLv);
      act({ t: 'sleep', x: P.x, y: P.y, n: myName });
    } else toast('重生點已設在這張床');
    writeSave();
  } else if (s.k === 'altar') {
    if (boss) return;
    // each boss's keepsake, held in hand, wakes the next boss and is not used up
    if (hot[hotSel] === '狼王的心臟' || hot[hotSel] === '古樹種子') {
      if (!has('狼王的心臟') || !has('古樹種子')) {
        toast(`喚醒樹精長老需要：狼王的心臟 ${has('狼王的心臟') ? 1 : 0}/1、古樹種子 ${inv['古樹種子'] || 0}/1`);
        return;
      }
      inv['古樹種子']--;
      syncHeld();
      act({ t: 'summont' });
      shake = 12;
      return;
    }
    if ((inv['獠牙'] || 0) >= 3 && (inv['樹脂'] || 0) >= 5) {
      inv['獠牙'] -= 3;
      inv['樹脂'] -= 5;
      act({ t: 'summon' });
      shake = 12;
    } else
      toast(
        has('狼王的心臟')
          ? '手上拿著狼王的心臟、帶著古樹種子，可以喚醒樹精長老・狼王要獠牙 3、樹脂 5'
          : `祭壇需要：獠牙 ${inv['獠牙'] || 0}/3、樹脂 ${inv['樹脂'] || 0}/5`
      );
  }
}
