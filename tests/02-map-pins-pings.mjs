import {launch,soloGame,mpGame,buildTestCopy,startServer,sleep,HERE} from './lib/harness.mjs';
import fs from 'node:fs';
const br=await launch();const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
let sv;
try{
  const pg=await soloGame(br,HERE+'/02-map-pins-pings');
  await pg.key('KeyM');await sleep(200);
  const r=await pg.ev(`(()=>{const b=document.getElementById('bigCv').getBoundingClientRect();return[b.x,b.y,b.width]})()`);
  const [bx,by,bw]=r;
  // 點地圖中間偏右上加標記
  await pg.click(bx+bw*.6,by+bw*.4);await sleep(150);
  ok(await pg.g('pins.length')===1,'點地圖新增標記');
  ok(!(await pg.ev(`document.getElementById('pinEdit').hidden`)),'跳出命名框');
  await pg.ev(`document.getElementById('pinName').value='家'`);await pg.key('Enter','Enter');await sleep(100);
  ok(await pg.g('pins[0].t')==='家','Enter 確認名稱');
  ok(Math.abs(await pg.g('pins[0].x')-14400*.6)<60,'標記位置正確');
  // 新增後取消 → 不留下
  await pg.click(bx+bw*.3,by+bw*.7);await sleep(100);await pg.key('Escape','Escape');await sleep(100);
  ok(await pg.g('pins.length')===1,'新增時按 Esc 取消，不會留下');
  ok(!(await pg.ev(`document.getElementById('bigmap').hidden`)),'取消命名時地圖不會被一起關掉');
  await pg.shot(HERE+'/t2-map.png');
  // 右鍵發信號
  await pg.click(bx+bw*.5,by+bw*.5,'right');await sleep(100);
  ok(await pg.g('pings.length')===1,'右鍵發信號');
  await pg.key('KeyM');await sleep(150);
  // 重新整理：標記保留
  await pg.g('writeSave()');await pg.ev('location.reload()');await sleep(1500);
  await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`);await pg.ev(`document.getElementById('go').click()`);await sleep(300);
  ok(await pg.g('pins.length===1&&pins[0].t==="家"'),'重新整理後標記還在');
  // 點標記 → 刪除
  await pg.key('KeyM');await sleep(200);
  await pg.click(bx+bw*.6,by+bw*.4-4);await sleep(150);
  ok(!(await pg.ev(`document.getElementById('pinDel').hidden`)),'點標記出現刪除鈕');
  await pg.clickSel('#pinDel');await sleep(100);
  ok(await pg.g('pins.length')===0,'刪除標記');
  await pg.key('KeyM');
  // 遊戲中 T 鍵：在畫面外的信號 → 邊緣箭頭
  await pg.move(900,300);await sleep(1600);await pg.key('KeyT');await sleep(100);
  ok(await pg.g('pings.length')>=1,'T 鍵發信號');
  await pg.g(`pings.push({x:P.x+2500,y:P.y-900,n:'測試',t:8})`);await sleep(150);
  await pg.shot(HERE+'/t2-arrow.png');
  console.log('solo logs',pg.logs);pg.close();

  // 多人：A 發信號，B 收到
  const dir=HERE+'/02-map-pins-pingsmp';fs.rmSync(dir,{recursive:true,force:true});buildTestCopy(dir);
  sv=await startServer(dir,18191);
  const a=await mpGame(br,18191,'甲');const b=await mpGame(br,18191,'乙');
  await sleep(500);
  await a.g(`sendPing(P.x+100,P.y)`);await sleep(600);
  ok(await b.g(`pings.some(p=>p.n==='甲')`),'多人：對方收到信號');
  ok(await b.g(`pings.length===1`),'多人：只收到一次');
  console.log('mp logs',a.logs,b.logs);
}finally{br.close();sv&&sv.close()}
