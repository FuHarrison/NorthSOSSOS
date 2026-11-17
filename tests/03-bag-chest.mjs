import {launch,soloGame,mpGame,buildTestCopy,startServer,sleep,HERE} from './lib/harness.mjs';
import fs from 'node:fs';
const br=await launch();const ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':'  → '+JSON.stringify(x)));if(!c)process.exitCode=1};
const FREE=`(()=>{for(let r=2;r<8;r++)for(let a=0;a<16;a++){const x=P.x+Math.cos(a/16*6.28)*r*40,y=P.y+Math.sin(a/16*6.28)*r*40,c=ci(x,y);if(c>=0&&biome[c]>=1&&biome[c]!==7&&!structGrid[c]&&!resGrid[c]&&c!==altar.cell)return[(c%COLS+.5)*CELL,(Math.floor(c/COLS)+.5)*CELL]}})()`;
let sv;
try{
  const pg=await soloGame(br,HERE+'/03-bag-chest');
  ok(await pg.g(`inv={木頭:1550,狼牙劍:1};slotsOf(inv)`)===32,'格數：1550 木頭 31 格＋劍 1 格');
  ok(await pg.g(`roomFor(inv,'木頭',BAG_SLOTS)`)===0,'滿了 roomFor=0');
  ok(await pg.g(`inv={木頭:1530};roomFor(inv,'木頭',BAG_SLOTS)`)===70,'1530 木頭：還能放 20+50',await pg.g(`roomFor(inv,'木頭',BAG_SLOTS)`));
  const L0=await pg.g('loots.length');
  await pg.g(`give('石頭',60)`);
  ok(await pg.g(`inv['石頭']`)===50,'放得下的 50 個進背包',await pg.g(`inv['石頭']`));
  ok(await pg.g('loots.length')===L0+1&&await pg.g(`loots.at(-1).bag['石頭']`)===10,'放不下的 10 個掉在腳邊');
  // 滿了不能撿小東西
  await pg.g(`inv={木頭:1600}`);
  const pick=await pg.g(`(()=>{let o=null;for(const r of resGrid)if(r&&r.k==='pebble'){o=r;break}const before=JSON.stringify(inv);hitRes(o);return before===JSON.stringify(inv)&&!!resGrid[o.cell]})()`);
  ok(pick,'背包滿了撿不起小石頭');
  // 滿了不能做東西，材料不會少
  await pg.g(`craft(RECIPES.find(r=>r.id==='木棒'),1)`);
  ok(await pg.g(`!inv['木棒']&&inv['木頭']===1600`),'背包滿了做不出木棒、材料退回');
  await pg.g(`inv={木頭:1550}`);await pg.g(`craft(RECIPES.find(r=>r.id==='木棒'),1)`);
  ok(await pg.g(`inv['木棒']===1`),'空出一格就能做');
  // 箱子
  const [cx,cy]=await pg.g(FREE);
  await pg.g(`inv={木頭:120,石頭:30,燧石:7,狼牙劍:1};act({t:'build',k:'chest',x:${cx},y:${cy},cost:{}})`);
  ok(await pg.g(`structGrid[ci(${cx},${cy})]?.k`)==='chest','蓋好箱子');
  await pg.g(`P.x=${cx};P.y=${cy}+34;doUse()`);await sleep(150);
  ok(await pg.g(`panelTab`)==='chest'&&!(await pg.ev(`document.getElementById('panel').hidden`)),'E 打開箱子');
  await pg.shot(HERE+'/t3-chest0.png');
  await pg.clickSel('[data-pk="木頭"]');await sleep(100);
  ok(await pg.g(`structGrid[chestC].box['木頭']===50&&inv['木頭']===70`),'點一下：一疊 50 個木頭放進箱子',await pg.g('[structGrid[chestC].box,inv]'));
  await pg.clickSel('#chPut');await sleep(100);
  ok(await pg.g(`Object.keys(inv).filter(k=>inv[k]>0).length===0`),'全部放進去：背包清空',await pg.g('inv'));
  ok(await pg.g(`hot.every(k=>!k)`),'放進箱子後快捷欄的劍也拿掉了');
  await pg.clickSel('[data-ck="狼牙劍"]');await sleep(100);
  ok(await pg.g(`inv['狼牙劍']===1&&!structGrid[chestC].box['狼牙劍']`),'點一下拿回劍');
  await pg.clickSel('#chTake');await sleep(100);
  ok(await pg.g(`inv['木頭']===120&&inv['石頭']===30&&inv['燧石']===7&&!Object.keys(structGrid[chestC].box).length`),'全部拿出來',await pg.g('inv'));
  // 箱子滿了
  await pg.g(`inv={木頭:1300}`);await pg.clickSel('#chPut');await sleep(100);
  ok(await pg.g(`structGrid[chestC].box['木頭']===1200&&inv['木頭']===100`),'箱子 24 格裝滿 1200，剩 100 留在背包',await pg.g('[structGrid[chestC].box,inv]'));
  ok((await pg.ev(`document.getElementById('chMsg').textContent`)).includes('箱子滿了'),'顯示箱子滿了');
  await pg.shot(HERE+'/t3-chest1.png');
  await pg.key('Escape');await sleep(100);
  // 存檔：箱子內容保留
  await pg.g('writeSave()');await pg.ev('location.reload()');await sleep(1500);
  await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`);await pg.ev(`document.getElementById('go').click()`);await sleep(200);
  ok(await pg.g(`structGrid[ci(${cx},${cy})]?.box['木頭']`)===1200,'重新整理後箱子內容還在');
  // 拆箱子：材料＋內容退回（背包放不下的掉在地上）
  await pg.g(`inv={}`);const L1=await pg.g('loots.length');
  await pg.g(`act({t:'demo',k:'chest',x:${cx},y:${cy}})`);await sleep(100);
  const after=await pg.g(`[inv['木頭'],loots.length]`);
  ok(after[0]===1210&&!(await pg.g(`structGrid[ci(${cx},${cy})]`)),'拆箱子：箱子 10＋內容 1200 退回，共 1210',after);
  ok(after[1]===L1,'剛好放得下，沒有掉東西',after);
  // 背包頁顯示格數
  await pg.g(`inv={木頭:120,狼牙劍:1}`);await pg.key('Tab');await pg.clickSel('[data-tab="inv"]');await sleep(150);
  ok((await pg.ev(`document.querySelector('#panelBody .photh b').textContent`)).includes('4 / 32'),'背包頁顯示 4 / 32 格');
  ok(await pg.ev(`document.querySelectorAll('#panelBody .bag .bs').length`)===32,'背包頁固定 32 格');
  await pg.shot(HERE+'/t3-bag.png');
  console.log('solo logs',pg.logs);pg.close();

  // 多人：甲放進箱子，乙看得到、拿得出來
  const dir=HERE+'/03-bag-chestmp';fs.rmSync(dir,{recursive:true,force:true});buildTestCopy(dir);
  sv=await startServer(dir,18192);
  const a=await mpGame(br,18192,'甲');const b=await mpGame(br,18192,'乙');await sleep(400);
  const [mx,my]=await a.g(FREE);
  await a.g(`act({t:'build',k:'chest',x:${mx},y:${my},cost:{}})`);await sleep(500);
  ok(await b.g(`structGrid[ci(${mx},${my})]?.k`)==='chest','多人：乙看到箱子');
  await a.g(`inv={木頭:30,燧石:5};chestC=ci(${mx},${my});chestMove('cput',{木頭:30,燧石:5})`);await sleep(500);
  ok(await b.g(`JSON.stringify(structGrid[ci(${mx},${my})].box)`)==='{"木頭":30,"燧石":5}','多人：乙看到箱子內容');
  await b.g(`inv={};chestC=ci(${mx},${my});chestMove('cget',{木頭:30})`);await sleep(600);
  ok(await b.g(`inv['木頭']`)===30,'多人：乙拿到木頭');
  ok(await a.g(`JSON.stringify(structGrid[ci(${mx},${my})].box)`)==='{"燧石":5}','多人：甲看到木頭被拿走');
  // 同時拿同一樣：只有一個人拿得到
  await Promise.all([a.g(`chestMove('cget',{燧石:5})`),b.g(`chestMove('cget',{燧石:5})`)]);await sleep(600);
  const fa=await a.g(`inv['燧石']||0`),fb=await b.g(`inv['燧石']||0`);
  ok(fa+fb===5,'多人：兩人同時拿，總共只拿出 5 個（不會複製）',[fa,fb]);
  await sleep(9000);
  const wj=JSON.parse(fs.readFileSync(dir+'/saves/world.json','utf8'));
  ok(wj.structs.some(s=>s.k==='chest'),'多人：world.json 有存箱子');
  console.log('mp logs',a.logs,b.logs,sv.out.match(/錯|失敗/g));
}finally{br.close();sv&&sv.close()}
