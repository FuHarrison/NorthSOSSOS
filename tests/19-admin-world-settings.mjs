import {
  launch,
  soloGame,
  openPage,
  mpGame,
  buildTestCopy,
  startServer,
  sleep,
  HERE,
  noPoolFetch
} from './lib/harness.mjs';
import fs from 'node:fs';
const br = await launch();
const ok = (c, m, x) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : '  → ' + JSON.stringify(x)));
  if (!c) process.exitCode = 1;
};
const PORT = 18212,
  B = `http://localhost:${PORT}`;
const get = async n => {
  const r = await noPoolFetch(`${B}/api/admin/${n}`);
  return r.json();
};
const post = async (n, b) => {
  const r = await noPoolFetch(`${B}/api/admin/${n}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-North-Admin': '1' },
    body: JSON.stringify(b)
  });
  return { code: r.status, d: await r.json() };
};
const FREE = `(()=>{for(let r=2;r<8;r++)for(let a=0;a<16;a++){const x=P.x+Math.cos(a/16*6.28)*r*40,y=P.y+Math.sin(a/16*6.28)*r*40,c=ci(x,y);if(c>=0&&biome[c]>=1&&biome[c]!==7&&!structGrid[c]&&!resGrid[c]&&c!==altar.cell)return[(c%COLS+.5)*CELL,(Math.floor(c/COLS)+.5)*CELL]}})()`;
let sv;
try {
  // ---------- 單人：每項數值的效果（同一套程式碼，直接改 CFG） ----------
  const pg = await soloGame(br, HERE + '/19-admin-world-settings');
  ok(
    JSON.stringify(await pg.g('[CFG.bagSlots,DAY_LEN,CFG.death,CFG.passive,CFG.freeBuild]')) ===
      '[32,360,"bag",false,false]',
    '單人：預設值'
  );
  await pg.g(`P.x=spawnPt.x;P.y=spawnPt.y;mobs.length=0;applyCfg({mobHp:2,bossHp:3,mobDmg:2})`);
  ok((await pg.g(`spawnMob('boar',P.x+300,P.y).max`)) === 52, '怪物血量 ×2：野豬 26 → 52');
  ok(
    (await pg.g(`(()=>{const m=spawnMob('boss',P.x+600,P.y);const h=m.max;mobs.pop();return h})()`)) === 1440,
    '王的血量 ×3：狼王 480 → 1440'
  );
  await pg.g(`P.hp=25;P.inv=0;P.roll=0;P.blocking=false;eq=noEq();hurt(P,5,{x:P.x+20,y:P.y})`);
  ok(Math.abs((await pg.g('P.hp')) - 15) < 0.01, '怪物傷害 ×2：5 → 10', await pg.g('P.hp'));
  // 不主動攻擊：苔精貼在玩家旁邊（攻擊距離內），看玩家有沒有被打。先暫停遊戲自己的世界更新，免得主迴圈也去推這隻苔精
  const bite = passive =>
    pg.g(
      `paused=true;applyCfg({passive:${passive}});mobs.length=0;dayT=.2;TG=[P];P.hp=25;P.inv=0;P.roll=0;P.blocking=false;eq=noEq();` +
        `window.__m=spawnMob('moss',P.x+18,P.y);__m.aggro=0;__m.acd=0;for(let i=0;i<10;i++)updateMob(__m,.05);P.hp`
    );
  ok((await bite(true)) === 25, '不主動攻擊：苔精貼在旁邊也不會咬人');
  ok((await bite(false)) === 20, '預設：苔精貼在旁邊會咬人（-5）');
  // 晚上的怪物數量 0
  const moss = async nm =>
    pg.g(
      `(()=>{applyCfg({nightMobs:${nm}});mobs=mobs.filter(m=>m.k!=='moss');dayT=.75;for(let i=0;i<12;i++){spawnT=0;updateWorld(.01)}return mobs.filter(m=>m.k==='moss').length})()`
    );
  ok((await moss(0)) === 0, '晚上怪物 ×0：夜裡不冒苔精');
  ok((await moss(1)) > 0, '晚上怪物 ×1：會冒苔精');
  // 作物、一天長度
  await pg.g(`applyCfg({cropSpeed:10,smeltSpeed:10,dayMin:2});dayT=.2`);
  ok((await pg.g('DAY_LEN')) === 120, '一天長度 2 分鐘');
  const [gx, gy] = await pg.g(FREE);
  await pg.g(
    `act({t:'build',k:'plot',x:${gx},y:${gy},cost:{}});act({t:'plant',c:ci(${gx},${gy}),k:'胡蘿蔔'});updateWorld(25)`
  );
  ok((await pg.g(`structGrid[ci(${gx},${gy})].crop.g`)) === 0, '作物 ×10：25 秒成熟（原本 240）');
  // 熔爐
  const [fx, fy] = await pg.g(FREE);
  await pg.g(
    `act({t:'build',k:'furnace',x:${fx},y:${fy},cost:{}});const s=structGrid[ci(${fx},${fy})];s.fz.q={銅礦:3};s.fz.fuel=1;for(let i=0;i<10;i++)tickFurnaces(.2)`
  );
  ok((await pg.g(`structGrid[ci(${fx},${fy})].fz.out['銅錠']`)) >= 1, '熔爐 ×10：2 秒就燒出銅錠（原本 6 秒）');
  // 熟練度
  await pg.g(`applyCfg({skillRate:5});sk={};skXP('chop',2)`);
  ok((await pg.g(`skLv('chop')`)) === 1, '熟練度成長 ×5：2 次就升級');
  // 耐久
  await pg.g(`applyCfg({wear:0});inv={燧石斧:1};dur={};wear('燧石斧')`);
  ok((await pg.g(`durOf('燧石斧')`)) === 120, '耐久 ×0：不會磨損');
  await pg.g(`applyCfg({wear:.5});wear('燧石斧')`);
  ok((await pg.g(`durOf('燧石斧')`)) === 119.5, '耐久 ×0.5：一次扣 0.5');
  // 死亡
  await pg.g(
    `applyCfg({death:'keep',skillLoss:0});sk={melee:10};inv={木頭:30};hot=Array(8).fill(null);syncHeld();window.__L=loots.length;P.hp=0;die()`
  );
  ok(await pg.g(`loots.length===__L&&inv['木頭']===30&&sk.melee===10`), '死亡：全部保留、熟練度不掉');
  ok((await pg.ev(`document.getElementById('deadMsg').textContent`)).includes('不會掉東西'), '倒下畫面說明全部保留');
  await pg.clickSel('#respawn');
  await pg.g(
    `applyCfg({death:'all'});inv={木頭:30,狼牙劍:1,皮甲:1};hot=Array(8).fill(null);hot[0]='狼牙劍';eq=noEq();eq.body='皮甲';syncHeld();P.hp=0;die()`
  );
  ok(
    await pg.g(
      `(()=>{const l=loots.at(-1);return l.bag['木頭']===30&&l.bag['狼牙劍']===1&&l.bag['皮甲']===1&&!inv['狼牙劍']&&!eq.body&&!hot[0]})()`
    ),
    '死亡：全部留在墓碑（含快捷欄和裝備）'
  );
  await pg.clickSel('#respawn');
  // 建造不耗材料、拆除不退
  await pg.g(`applyCfg({freeBuild:true});inv={};known=new Set(['木頭']);P.x=spawnPt.x;P.y=spawnPt.y`);
  const [bx, by] = await pg.g(FREE);
  await pg.g(
    `startPlace(RECIPES.find(r=>r.id==='bench'));const _b=${JSON.stringify([bx, by])};P.x=_b[0]-60;P.y=_b[1];mouse.on=true;worldMouse=()=>({x:_b[0],y:_b[1]});tryPlace();stopPlace()`
  );
  ok((await pg.g(`structGrid[ci(${bx},${by})]?.k`)) === 'bench', '建造不耗材料：空背包也蓋得出工作台');
  ok(!(await pg.g(`(()=>{inv={};craft(RECIPES.find(r=>r.id==='木棒'));return has('木棒')})()`)), '裝備照樣要材料');
  await pg.g(`act({t:'demo',k:'bench',x:${bx},y:${by}})`);
  ok(!(await pg.g(`has('木頭')`)), '拆除不退材料');
  console.log('solo logs', pg.logs);
  pg.close();

  // ---------- 多人＋後台 ----------
  const dir = HERE + '/19-admin-world-settingsmp';
  fs.rmSync(dir, { recursive: true, force: true });
  buildTestCopy(dir);
  sv = await startServer(dir, PORT);
  const a = await mpGame(br, PORT, '甲', '1111');
  await a.send('Page.bringToFront');
  let c = await get('cfg');
  ok(c.cfg.bagSlots === 32 && c.def.num.bagSlots[2] === 64, '後台讀到預設值與範圍');
  let r = await post('cfg', { v: { bagSlots: 48, dayMin: 3, drops: 2, wear: 0, freeBuild: true } });
  ok(r.code === 200, '後台改 5 項');
  await sleep(500);
  ok(
    JSON.stringify(await a.g('[BAG_SLOTS,DAY_LEN,CFG.drops,CFG.wear,CFG.freeBuild]')) === '[48,180,2,0,true]',
    '玩家馬上收到新的數值'
  );
  ok((await a.ev(`document.getElementById('toast').textContent`)).includes('調整了世界數值'), '玩家看到提示');
  await a.g(`inv={};const o=[...resGrid].find(r=>r&&r.k==='pebble');act({t:'res',c:o.cell,dmg:0})`);
  await sleep(500);
  ok((await a.g(`inv['石頭']`)) >= 2, '掉落量 ×2：小石頭至少 2 個（主機那邊算）', await a.g(`inv['石頭']`));
  r = await post('cfg', { v: { bagSlots: 999, mobHp: -5, death: 'kill' } });
  c = await get('cfg');
  ok(c.cfg.bagSlots === 64 && c.cfg.mobHp === 0.5 && c.cfg.death === 'bag', '超出範圍的值會被限制', c.cfg);
  await sleep(300);
  const wj = JSON.parse(fs.readFileSync(dir + '/saves/world.json', 'utf8'));
  ok(wj.cfg && wj.cfg.drops === 2 && wj.cfg.bagSlots === 64, '設定存進 world.json');
  await sv.close();
  await sleep(800);
  sv = await startServer(dir, PORT);
  await sleep(1500);
  c = await get('cfg');
  ok(c.cfg.drops === 2 && c.cfg.freeBuild === true, '伺服器重開：設定還在');
  r = await post('newWorld', {});
  await sleep(2500);
  c = await get('cfg');
  ok(c.cfg.drops === 1 && c.cfg.freeBuild === false, '新世界：用預設值');
  r = await post('switchWorld', { file: (await get('worlds')).archived[0].file });
  await sleep(2500);
  c = await get('cfg');
  ok(c.cfg.drops === 2, '切回舊世界：設定跟著回來');
  r = await post('cfg', { reset: true });
  c = await get('cfg');
  ok(c.cfg.drops === 1 && c.cfg.bagSlots === 32, '全部恢復預設');
  // 後台介面
  const ad = await openPage(br, `${B}/admin`);
  await sleep(800);
  await ad.clickSel('[data-p="cfg"]');
  await sleep(800);
  ok((await ad.ev(`document.querySelectorAll('.cr').length`)) === 16, '世界數值分頁：16 項');
  ok(await ad.ev(`document.getElementById('cfgSave').disabled`), '沒改東西：儲存鈕不能按');
  await ad.ev(
    `(()=>{const e=document.querySelector('[data-k="dayMin"]');e.value=10;e.dispatchEvent(new Event('input'))})()`
  );
  await ad.ev(`document.querySelector('.sw2[data-k="passive"]').click()`);
  await sleep(100);
  ok((await ad.ev(`document.getElementById('dirty').textContent`)).includes('改了 2 項'), '顯示改了 2 項');
  await ad.shot(HERE + '/t19-cfg.png');
  await ad.clickSel('#cfgSave');
  await sleep(800);
  c = await get('cfg');
  ok(c.cfg.dayMin === 10 && c.cfg.passive === true, '按儲存：套用到世界');
  console.log(
    'admin logs',
    ad.logs,
    'server:',
    sv.out
      .split('\n')
      .filter(l => l.includes('後台：'))
      .join(' | ')
  );
} catch (e) {
  // 出錯時把 server 最後的輸出印出來，比較好查
  console.log('SERVER OUT:\n' + (sv ? sv.out.split('\n').slice(-25).join('\n') : '(沒有 server)'));
  throw e;
} finally {
  br.close();
  sv && sv.close();
}
