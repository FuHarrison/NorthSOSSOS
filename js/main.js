// 北境求生 · main.js：主迴圈與開始畫面、登入、開機（最後載入）
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- loop ---------- */
let last = performance.now();
// solo pauses everything; in multiplayer the world keeps going while your panel is open or you're down
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (ready) {
    if (!paused) updateLocal(dt);
    if (MODE === 'solo') {
      if (!paused) {
        updateWorld(dt);
        updatePet(dt);
        updateFx(dt);
      } else if (panelTab === 'furnace' && !$('panel').hidden) tickFurnaces(dt);
    } else {
      if (!worldPaused) {
        if (MODE === 'host') updateWorld(dt);
        else tickClient(dt);
        if (started) updatePet(dt);
      }
      tickOthers(dt);
      updateFx(dt);
      netTick(dt);
    }
    if (!HEADLESS) {
      render();
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.1;
        hud();
        refreshFurnacePanel();
      }
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- intro ---------- */
function setupIntro() {
  cam.x = P.x;
  cam.y = P.y;
  $('introCtl').innerHTML = TOUCH
    ? '左半邊拖曳移動（推到底衝刺）・右下按鈕攻擊、翻滾、互動・右上開背包製作'
    : 'WASD 移動・Shift 衝刺・左鍵攻擊・右鍵格擋・空白翻滾・E 互動・1～8／滾輪／Q 快捷欄・Tab 背包・M 地圖・Z 表情・Esc 設定';
  if (MODE === 'solo')
    $('introBtns').innerHTML = save
      ? `<button class="act go" id="go" type="button">繼續（第 ${day} 天）</button><button class="act" id="fresh" type="button">新世界</button>`
      : `<button class="act go" id="go" type="button">開始</button>`;
  else {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    $('introBtns').innerHTML =
      `<input class="namein" id="nameIn" maxlength="10" placeholder="你的名字" aria-label="你的名字" value="${esc(myName)}">` +
      `<input class="namein pinin" id="pinIn" type="password" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="PIN" aria-label="PIN">` +
      `<button class="act go" id="go" type="button">加入（第 ${day} 天）</button>` +
      `<p class="sub" id="loginMsg" style="flex-basis:100%"></p>`;
    const n = $('introNet');
    n.hidden = false;
    n.innerHTML = netInfo.local
      ? `這台電腦是主機。同事在瀏覽器網址列輸入：<br>${netInfo.ips.length ? netInfo.ips.map(ip => `<b>http://${ip}:${netInfo.port}</b>`).join('<br>') : '（找不到區網 IP，請確認這台電腦有接上公司網路）'}<br><small style="color:var(--mute)">世界由黑色的伺服器視窗在跑，這個分頁可以隨時關掉；關掉黑色視窗世界才會停。</small>`
      : '已連上主機，你會跟大家在同一個世界。';
    for (const id of ['nameIn', 'pinIn'])
      $(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') $('go').click();
      });
    $('nameIn').addEventListener('input', pinHint);
    pinHint();
  }
  $('go').addEventListener('click', () => {
    if (MODE === 'solo') {
      begin(!save);
      return;
    }
    if (loggingIn) return;
    myName = ($('nameIn').value.trim() || myName).slice(0, 10);
    try {
      localStorage.setItem('northland-name', myName);
    } catch (e) {}
    loggingIn = true;
    $('go').disabled = true;
    loginMsg('登入中…');
    net({ t: 'login', n: myName, pin: $('pinIn').value.trim(), tok: loadTok()[myName] || '', seed });
  });
  if ($('fresh'))
    $('fresh').addEventListener('click', e => {
      const b = e.currentTarget;
      if (b.dataset.c) resetSave();
      else {
        b.dataset.c = '1';
        b.textContent = '確認刪除存檔？';
      }
    });
}
function begin(fresh) {
  started = true;
  $('intro').hidden = true;
  syncPaused();
  if (fresh) banner(`第 ${day} 天`, '先砍幾棵樹吧');
}
// 登入：名字 + PIN。server 驗證後回傳記號（這台電腦記住，下次免輸入 PIN）和這個人在這個世界的存檔
function loadTok() {
  try {
    return JSON.parse(localStorage.getItem('northland-tok')) || {};
  } catch (e) {
    return {};
  }
}
function loginMsg(t, err) {
  const e = $('loginMsg');
  if (!e) return;
  e.textContent = t;
  e.classList.toggle('err', !!err);
}
function pinHint() {
  const n = $('nameIn').value.trim();
  loginMsg(
    loadTok()[n]
      ? `這台電腦已記住「${n}」，直接按按鈕就好。`
      : '第一次用這個名字時，輸入的 PIN（4～8 位數字）就是你之後的密碼。不要用你的真實密碼。'
  );
}
function onLogin(m) {
  loggingIn = false;
  const g = $('go');
  if (g) g.disabled = false;
  if (!m.ok) {
    loginMsg(m.msg, true);
    return;
  }
  try {
    const t = loadTok();
    t[m.n] = m.tok;
    localStorage.setItem('northland-tok', JSON.stringify(t));
  } catch (e) {}
  myName = m.n;
  let ps = m.d;
  const old = ps ? null : loadKey(pkey()); // server 上沒有 → 把這台瀏覽器的舊存檔搬上去
  ps = ps || old;
  if (ps) applyPersonal(ps);
  cam.x = P.x;
  cam.y = P.y;
  begin(!ps);
  if (old) writeSave('p');
}
if (MODE === 'solo') bootSolo();
else {
  $('introBtns').innerHTML = '<p class="sub">連線中…</p>';
  connect();
}
if (TOUCH) $('touch').hidden = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) writeSave();
});
