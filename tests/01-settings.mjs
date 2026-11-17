import {launch,soloGame,openPage,sleep,HERE} from './lib/harness.mjs';
const br=await launch();const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
try{
  const pg=await soloGame(br,HERE+'/01-settings');
  await pg.key('Escape');await sleep(150);
  ok(!(await pg.ev(`document.getElementById('settings').hidden`)),'Esc 開設定');
  ok(await pg.g('paused'),'設定開著時暫停');
  const t0=await pg.g('time');await sleep(400);ok(await pg.g('time')===t0,'單人模式世界時間停止');
  ok(await pg.ev(`!!document.getElementById('wipe')`),'設定裡有開始新世界');
  await pg.shot(HERE+'/t1-settings.png');
  await pg.clickSel('[data-set="gray"]');await sleep(100);
  ok(await pg.ev(`document.documentElement.classList.contains('gray')`),'黑白開關生效');
  ok(await pg.ev(`document.querySelector('[data-set="gray"]').getAttribute('aria-checked')`)==='true','開關狀態更新');
  await pg.clickSel('[data-set="shake"]');await sleep(100);
  ok(await pg.g('SET.shake')===false,'畫面震動關閉');
  await pg.key('Escape');await sleep(150);
  ok(await pg.ev(`document.getElementById('settings').hidden`),'Esc 關設定');
  ok(!(await pg.g('paused')),'關掉後恢復');
  await pg.key('KeyG');await sleep(100);
  ok(!(await pg.ev(`document.documentElement.classList.contains('gray')`)),'G 鍵切回彩色');
  await pg.key('KeyG');
  // 開背包時按 Esc 只關背包，不會開設定
  await pg.key('Tab');await sleep(100);await pg.key('Escape');await sleep(100);
  ok(await pg.ev(`document.getElementById('panel').hidden&&document.getElementById('settings').hidden`),'背包開著時 Esc 只關背包');
  await pg.key('Tab');await pg.clickSel('[data-tab="help"]');await sleep(100);
  ok(await pg.ev(`!document.querySelector('#panelBody #wipe')&&document.querySelector('#panelBody .help')!==null`),'說明頁不再有新世界按鈕');
  await pg.key('Escape');
  // 重新整理：設定保留
  await pg.ev('location.reload()');await sleep(1500);
  await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`);
  ok(await pg.ev(`document.documentElement.classList.contains('gray')`),'重新整理後黑白保留');
  ok(await pg.g('SET.shake')===false,'重新整理後震動設定保留');
  console.log('logs',pg.logs);
}finally{br.close()}
