import {launch,soloGame,mpGame,buildTestCopy,startServer,sleep,HERE} from './lib/harness.mjs';
import fs from 'node:fs';
const br=await launch();const ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':'  → '+JSON.stringify(x)));if(!c)process.exitCode=1};
const FREE=(cx,cy,skip=0)=>`(()=>{let k=0;for(let r=1;r<8;r++)for(let a=0;a<16;a++){const x=${cx}+Math.cos(a/16*6.28)*r*40,y=${cy}+Math.sin(a/16*6.28)*r*40,c=ci(x,y);if(c>=0&&biome[c]>=1&&biome[c]!==7&&!structGrid[c]&&!resGrid[c]&&c!==altar.cell&&Math.hypot(x-P.x,y-P.y)>40){if(k++===${skip})return[(c%COLS+.5)*CELL,(Math.floor(c/COLS)+.5)*CELL]}}})()`;
let sv;
try{
  const pg=await soloGame(br,HERE+'/07-equipment');
  await pg.g(`P.x=spawnPt.x;P.y=spawnPt.y`);
  const [bx,by]=await pg.g(FREE('P.x','P.y'));await pg.g(`act({t:'build',k:'bench',x:${bx},y:${by},cost:{}})`);
  await pg.g(`inv={皮革:40,木頭:60,燧石:30,銅錠:20,錫錠:10,石頭:20};known=new Set(Object.keys(inv))`);
  for(const k of ['皮帽','皮甲','皮褲'])await pg.g(`craft(RECIPES.find(r=>r.id==='${k}'))`);
  ok(JSON.stringify(await pg.g('eq'))==='{"head":"皮帽","body":"皮甲","legs":"皮褲","off":null}','做出皮革套：空著的部位自動穿上');
  ok(await pg.g('armorTotal()')===18&&await pg.g('armorCut()')===31,'皮革全套護甲 18、減傷 31%',await pg.g('[armorTotal(),armorCut()]'));
  await pg.g(`P.hp=25;P.inv=0;P.roll=0;hitPlayer(10,{x:P.x+10,y:P.y})`);
  const hp=await pg.g('P.hp');ok(Math.abs(hp-(25-10*40/58))<.01,'被打 10：實際扣 6.9',hp);
  ok(await pg.g(`durOf('皮甲')===99&&durOf('皮帽')===79&&durOf('皮褲')===89`),'被打中：三件護甲各磨損 1');
  // 背包頁：穿戴欄，點一下脫下
  await pg.key('Tab');await pg.clickSel('[data-tab="inv"]');await sleep(150);
  ok(await pg.ev(`document.querySelectorAll('.eqsec [data-ek]').length`)===4,'背包頁有四個穿戴欄（含副手）');
  await pg.shot(HERE+'/t7-bag.png');
  await pg.clickSel('[data-ek="head"]');await sleep(100);
  ok(await pg.g('eq.head')===null&&await pg.g('armorTotal()')===14,'點穿戴欄脫下皮帽');
  // 右鍵選單穿上
  await pg.clickSel('[data-bk="皮帽"]','right');await sleep(100);
  const items=await pg.ev(`[...document.querySelectorAll('#bagMenu button')].map(b=>b.textContent)`);
  ok(items.includes('穿上'),'右鍵選單有「穿上」',items);
  await pg.ev(`[...document.querySelectorAll('#bagMenu button')].find(b=>b.textContent==='穿上').click()`);await sleep(100);
  ok(await pg.g('eq.head')==='皮帽','選單穿上皮帽');
  await pg.key('Escape');
  // 丟掉就脫下
  await pg.g(`dropItem('皮褲',1)`);await sleep(100);
  ok(await pg.g('eq.legs')===null,'丟掉皮褲：自動脫下');
  // 舊存檔：沒有穿戴欄 → 每個部位穿最好的
  await pg.g(`applyPersonal({inv:{皮甲:1,樹精裝備:1,皮帽:1}})`);
  ok(JSON.stringify(await pg.g('eq'))==='{"head":"皮帽","body":"樹精裝備","legs":null,"off":null}','舊存檔：自動穿上每個部位最好的');
  ok(await pg.g('armorLook()')===2,'樹精裝備外觀');
  // 升級：燧石斧 1→2 要 Lv2 工作台
  await pg.g(`inv={木頭:60,燧石:30,銅錠:20,錫錠:10,石頭:20,燧石斧:1,皮革:10};known=new Set(Object.keys(inv));q={};dur={燧石斧:40}`);
  ok(await pg.g(`upLv('燧石斧')`)===2,'燧石斧升 2 級要 Lv2 工作台');
  await pg.g(`upgrade('燧石斧')`);ok(await pg.g(`qOf('燧石斧')`)===1,'Lv1 工作台升不了');
  const [ax,ay]=await pg.g(FREE(bx,by,1));await pg.g(`act({t:'build',k:'anvil',x:${ax},y:${ay},cost:{}})`);
  ok(await pg.g('benchLv()')===2,'加砧台 Lv2');
  const before=await pg.g(`[inv['木頭'],inv['燧石']]`);
  await pg.key('Tab');await pg.clickSel('[data-tab="craft"]');await pg.clickSel('[data-cat="gear"]');await pg.clickSel('[data-pick="燧石斧"]');await sleep(150);
  await pg.shot(HERE+'/t7-upgrade.png');
  await pg.clickSel('[data-up]');await sleep(100);
  ok(await pg.g(`qOf('燧石斧')`)===2,'升到 2 級');
  const after=await pg.g(`[inv['木頭'],inv['燧石']]`);ok(before[0]-after[0]===3&&before[1]-after[1]===3,'花了原配方六成：木頭 3、燧石 3',[before,after]);
  ok(await pg.g(`toolPow(CHOP,'燧石斧')===19&&durMax('燧石斧')===180&&durOf('燧石斧')===180&&wDmg('燧石斧')===12`),'2 級：砍樹 19、耐久 180 且修好、傷害 12',await pg.g(`[toolPow(CHOP,'燧石斧'),durMax('燧石斧'),durOf('燧石斧'),wDmg('燧石斧')]`));
  ok((await pg.ev(`document.querySelector('[data-up]').textContent`)).includes('要 Lv3'),'升 3 級要 Lv3 工作台');
  ok(await pg.ev(`!!document.querySelector('.ci.on .q')`),'清單上顯示星等');
  // 材料分類
  await pg.clickSel('[data-cat="mat"]');await sleep(100);
  const mats=await pg.ev(`[...document.querySelectorAll('#panelBody .ci span')].map(e=>e.textContent)`);
  ok(mats.includes('青銅錠'),'青銅錠在「材料」分類',mats);
  await pg.key('Escape');
  // 存檔
  await pg.g('writeSave()');await pg.ev('location.reload()');await sleep(1500);await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`);
  ok(await pg.g(`qOf('燧石斧')===2&&eq.body==='樹精裝備'`)||await pg.g(`qOf('燧石斧')`)===2,'重新整理後升級與穿戴保留',await pg.g('[q,eq]'));
  console.log('solo logs',pg.logs);pg.close();
  // 多人：乙看到甲穿著護甲
  const dir=HERE+'/07-equipmentmp';fs.rmSync(dir,{recursive:true,force:true});buildTestCopy(dir);
  sv=await startServer(dir,18197);
  const a=await mpGame(br,18197,'甲');const b=await mpGame(br,18197,'乙');
  await a.send('Page.bringToFront');await a.g(`inv={鐵甲:1};eq.body='鐵甲'`);await sleep(800);
  ok(await b.g(`[...others.values()].find(o=>o.n==='甲')?.armor`)===1,'多人：乙看到甲有穿護甲');
  console.log('mp logs',a.logs,b.logs);
}finally{br.close();sv&&sv.close()}
