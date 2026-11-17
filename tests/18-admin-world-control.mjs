import {launch,openPage,mpGame,buildTestCopy,startServer,sleep,HERE} from './lib/harness.mjs';
import fs from 'node:fs';
const br=await launch();const ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':'  → '+JSON.stringify(x)));if(!c)process.exitCode=1};
const PORT=18211,B=`http://localhost:${PORT}`;
const get=async n=>(await fetch(`${B}/api/admin/${n}`)).json();
const cmd=async(c,v)=>{const r=await fetch(`${B}/api/admin/world`,{method:'POST',headers:{'Content-Type':'application/json','X-North-Admin':'1'},body:JSON.stringify({c,v})});return{code:r.status,d:await r.json()}};
let sv;
try{
  const dir=HERE+'/18-admin-world-control';fs.rmSync(dir,{recursive:true,force:true});buildTestCopy(dir);
  sv=await startServer(dir,PORT);
  const a=await mpGame(br,PORT,'甲','1111');await a.send('Page.bringToFront');await sleep(500);
  // 暫停
  let r=await cmd('pause');ok(r.code===200&&r.d.world.paused===true,'暫停世界');await sleep(500);
  ok(await a.g('worldPaused&&paused')&&!(await a.ev(`document.getElementById('pauseNote').hidden`)),'玩家：世界暫停、不能操作、上方顯示提示');
  const t0=(await get('status')).world.dayT;await sleep(1500);const t1=(await get('status')).world.dayT;
  ok(t0===t1,'暫停時世界時間不走',[t0,t1]);
  const x0=await a.g('P.x');await a.keyDown('KeyD');await sleep(400);await a.keyUp('KeyD');
  ok(await a.g('P.x')===x0,'暫停時玩家走不動');
  const b=await mpGame(br,PORT,'乙','2222');await sleep(600);
  ok(await b.g('worldPaused'),'暫停中才加入的人也是暫停');
  await a.send('Page.bringToFront');
  r=await cmd('resume');ok(r.code===200&&r.d.world.paused===false,'繼續世界');await sleep(500);
  ok(!(await a.g('worldPaused'))&&!(await a.g('paused'))&&await a.ev(`document.getElementById('pauseNote').hidden`),'玩家：恢復、提示消失');
  // 時間
  r=await cmd('time','night');ok(r.code===200&&Math.abs(r.d.world.dayT-.72)<.01,'跳到夜晚');await sleep(400);
  ok(await a.g('isNight()'),'玩家那邊也是夜晚');
  ok((await cmd('time','tomorrow')).code===400,'不認得的時間：錯誤');
  // 清怪
  ok((await get('status')).world.mobs>0,'清怪前有怪');
  r=await cmd('clearMobs');ok(r.code===200&&r.d.world.mobs===0,'清除怪物：0 隻',r.d.world&&r.d.world.mobs);await sleep(400);
  ok(await a.g('mobs.length')===0,'玩家那邊也清掉了');
  // 結束王戰
  ok((await cmd('endBoss')).d.err==='現在沒有王醒著','沒有王時：提示沒有王');
  await a.g(`act({t:'summon'})`);await sleep(500);
  ok((await get('status')).world.boss==='灰鬃狼王','叫出狼王');
  r=await cmd('clearMobs');ok(r.d.world.boss==='灰鬃狼王'&&r.d.world.mobs===1,'清怪不會清掉王');
  r=await cmd('endBoss');ok(r.code===200&&r.d.world.boss===null&&r.d.world.mobs===0,'結束王戰：王不見了');await sleep(500);
  ok(await a.g('!boss')&&(await a.ev(`document.getElementById('banner').textContent`)).includes('灰鬃狼王離開了'),'玩家看到王離開的橫幅');
  ok(!(await a.g(`has('狼王之牙')`)),'結束王戰不會掉東西');
  // 公告
  r=await cmd('announce','中午一起打王！<b>x</b>');await sleep(400);
  ok(r.code===200&&(await b.ev(`document.getElementById('banner').textContent`)).includes('中午一起打王！<b>x</b>'),'公告：乙看到，特殊字元照原樣顯示（沒有被當成網頁標籤）');
  ok(!(await b.ev(`!!document.querySelector('#banner b')`)),'公告裡的 <b> 沒有變成粗體');
  ok((await cmd('announce','   ')).code===400,'空白公告：錯誤');
  ok((await cmd('rm -rf')).code===400,'不存在的指令：錯誤');
  // 後台畫面：自動更新不會清掉打到一半的公告
  const ad=await openPage(br,`${B}/admin`);await sleep(1000);
  await ad.ev(`document.getElementById('annIn').value='打到一半'`);await sleep(3500);
  ok(await ad.ev(`document.getElementById('annIn').value`)==='打到一半','總覽自動更新：公告輸入框的字還在');
  ok(await ad.ev(`document.getElementById('bossBtn').disabled`),'沒有王時：結束王戰按鈕不能按');
  await ad.clickSel('#pauseBtn');await sleep(800);
  ok((await ad.ev(`document.getElementById('pauseBtn').textContent`))==='繼續世界'&&(await get('status')).world.paused,'後台按暫停：按鈕變成「繼續世界」');
  await ad.shot(HERE+'/t18-admin.png');
  await ad.clickSel('#pauseBtn');await sleep(800);
  ok(!(await get('status')).world.paused,'後台按繼續');
  console.log('logs',a.logs,b.logs,ad.logs,'server:',sv.out.split('\n').filter(l=>l.includes('後台')).join(' | '));
}finally{br.close();sv&&sv.close()}
