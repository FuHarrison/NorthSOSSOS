import {launch,soloGame,sleep,HERE} from './lib/harness.mjs';
const br=await launch();const ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':'  → '+JSON.stringify(x)));if(!c)process.exitCode=1};
// 站到某個東西旁邊、面向它、揮一下
const SWING=(sel)=>`(()=>{const o=${sel};P.x=o.x-30;P.y=o.y;P.face=0;P.cd=0;P.roll=0;P.st=50;attack();return true})()`;
try{
  const pg=await soloGame(br,HERE+'/04-durability');
  await pg.g(`inv={燧石斧:1,木棒:2};hotDefault();hotSelect(hot.indexOf('木棒'),true)`);
  await pg.g(SWING(`[...resGrid].find(r=>r&&r.k==='tree')`));
  ok(await pg.g(`durOf('燧石斧')`)===119,'砍樹：斧頭耐久 -1',await pg.g(`durOf('燧石斧')`));
  ok(await pg.g(`durOf('木棒')`)===50,'砍樹不扣手上的木棒');
  await pg.g(`P.x=10;P.y=10;P.cd=0;P.st=50;attack()`);
  ok(await pg.g(`durOf('燧石斧')===119&&durOf('木棒')===50`),'揮空不扣耐久');
  // 打野豬
  await pg.g(`mobs=mobs.filter(m=>m.k!=='boar');spawnMob('boar',P.x+30,P.y)`);
  const mb=await pg.g(`(()=>{const m=mobs.find(m=>m.k==='boar');P.x=m.x-25;P.y=m.y;P.face=0;P.cd=0;P.st=50;attack();return durOf('木棒')})()`);
  ok(mb===49,'打野豬：手上木棒 -1',mb);
  // 壞掉：還有一把就換下一把
  await pg.g(`dur['木棒']=1`);
  await pg.g(`(()=>{const m=mobs.find(m=>m.k==='boar')||spawnMob('boar',P.x+25,P.y);m.hp=999;P.x=m.x-25;P.y=m.y;P.face=0;P.cd=0;P.st=50;attack()})()`);
  ok(await pg.g(`inv['木棒']===1&&durOf('木棒')===50`),'耐久用完：壞一把，下一把是新的',await pg.g(`[inv['木棒'],durOf('木棒')]`));
  ok(await pg.g(`P.weapon`)==='木棒','還拿著木棒');
  await pg.g(`dur['木棒']=1`);
  await pg.g(`(()=>{const m=mobs.find(m=>m.k==='boar');P.x=m.x-25;P.y=m.y;P.face=0;P.cd=0;P.st=50;attack()})()`);
  ok(await pg.g(`!has('木棒')&&!hot.includes('木棒')&&P.weapon==='none'`),'最後一把壞了：從快捷欄消失、空手');
  // 快捷欄耐久條
  await pg.g(`dur['燧石斧']=30;hotSig=''`);await sleep(250);
  ok(await pg.ev(`!!document.querySelector('#hotbar .dur')`),'快捷欄顯示耐久條');
  // 修理：不在工作台旁不能修
  await pg.key('Tab');await pg.clickSel('[data-tab="craft"]');await sleep(150);
  ok(await pg.ev(`document.getElementById('repairBtn').disabled`),'不在工作台旁：修理鈕不能按');
  ok((await pg.ev(`document.getElementById('repairBtn').textContent`)).includes('工作台'),'提示要在工作台旁');
  await pg.key('Escape');
  const FREE=`(()=>{for(let r=2;r<8;r++)for(let a=0;a<16;a++){const x=P.x+Math.cos(a/16*6.28)*r*40,y=P.y+Math.sin(a/16*6.28)*r*40,c=ci(x,y);if(c>=0&&biome[c]>=1&&biome[c]!==7&&!structGrid[c]&&!resGrid[c]&&c!==altar.cell)return[(c%COLS+.5)*CELL,(Math.floor(c/COLS)+.5)*CELL]}})()`;
  await pg.g(`P.x=spawnPt.x;P.y=spawnPt.y`);const [bx,by]=await pg.g(FREE);await pg.g(`act({t:'build',k:'bench',x:${bx},y:${by},cost:{}})`);
  ok(await pg.g('nearBench()'),'蓋了工作台');
  await pg.key('Tab');await pg.clickSel('[data-tab="craft"]');await sleep(150);
  ok((await pg.ev(`document.getElementById('repairBtn').textContent`)).includes('修理 1 件'),'工作台旁：修理 1 件',await pg.ev(`document.getElementById('repairBtn').textContent`));
  await pg.shot(HERE+'/t4-repair.png');
  await pg.clickSel('#repairBtn');await sleep(100);
  ok(await pg.g(`durOf('燧石斧')`)===120,'修好了');
  await pg.key('Escape');
  // 存檔
  await pg.g(`dur['燧石斧']=77;writeSave()`);await pg.ev('location.reload()');await sleep(1500);
  await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`);
  ok(await pg.g(`durOf('燧石斧')`)===77,'重新整理後耐久保留');
  console.log('logs',pg.logs);
}finally{br.close()}
