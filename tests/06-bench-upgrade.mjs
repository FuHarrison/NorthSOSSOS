import {launch,soloGame,sleep,HERE} from './lib/harness.mjs';
const br=await launch();const ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':'  → '+JSON.stringify(x)));if(!c)process.exitCode=1};
// 在某點附近找 n 格空地
const FREE=(cx,cy,skip=0)=>`(()=>{let k=0;for(let r=1;r<8;r++)for(let a=0;a<16;a++){const x=${cx}+Math.cos(a/16*6.28)*r*40,y=${cy}+Math.sin(a/16*6.28)*r*40,c=ci(x,y);if(c>=0&&biome[c]>=1&&biome[c]!==7&&!structGrid[c]&&!resGrid[c]&&c!==altar.cell&&Math.hypot(x-P.x,y-P.y)>40){if(k++===${skip})return[(c%COLS+.5)*CELL,(Math.floor(c/COLS)+.5)*CELL]}}})()`;
try{
  const pg=await soloGame(br,HERE+'/06-bench-upgrade');
  await pg.g(`P.x=spawnPt.x;P.y=spawnPt.y`);
  const [bx,by]=await pg.g(FREE('P.x','P.y'));
  await pg.g(`act({t:'build',k:'bench',x:${bx},y:${by},cost:{}})`);
  ok(await pg.g('benchLv()')===1,'只有工作台：Lv1');
  await pg.g(`P.x=spawnPt.x+2000`);ok(await pg.g('benchLv()')===0,'離開工作台：0');await pg.g(`P.x=spawnPt.x`);
  // 銅鎬要 Lv2
  await pg.g(`inv={銅錠:10,木頭:30,石頭:20,鐵錠:5,皮革:6};known=new Set(Object.keys(inv))`);
  await pg.g(`craft(RECIPES.find(r=>r.id==='銅鎬'))`);
  ok(!(await pg.g(`has('銅鎬')`)),'Lv1 做不出銅鎬');
  await pg.key('Tab');await pg.clickSel('[data-tab="craft"]');await pg.clickSel('[data-cat="gear"]');await pg.clickSel('[data-pick="銅鎬"]');await sleep(150);
  ok((await pg.ev(`document.querySelector('.cwhy')?.textContent||''`)).includes('要 Lv2 工作台：在工作台旁邊蓋砧台'),'說明要蓋砧台',await pg.ev(`document.querySelector('.cwhy')?.textContent||''`));
  ok((await pg.ev(`document.querySelector('.benchlv').textContent`)).includes('Lv1'),'顯示工作台 Lv1');
  await pg.shot(HERE+'/t6-lv1.png');
  await pg.key('Escape');
  // 砧台要蓋在工作台旁：遠處的不行
  await pg.g(`startPlace(RECIPES.find(r=>r.id==='anvil'))`);
  const far=await pg.g(FREE(`${bx}+380`,`${by}`));
  await pg.g(`P.x=${bx}+200;P.y=${by};mouse.on=true;const _w=${JSON.stringify(far)};worldMouse=()=>({x:_w[0],y:_w[1]});tryPlace()`);
  ok(!(await pg.g(`structs.some(s=>s.k==='anvil')`)),'離工作台太遠：砧台蓋不了');
  ok((await pg.ev(`document.getElementById('toast').textContent`)).includes('要蓋在工作台旁邊'),'提示要蓋在工作台旁邊');
  // 工作台旁：可以
  const near=await pg.g(FREE(bx,by,1));
  await pg.g(`P.x=${bx};P.y=${by}+60;const _n=${JSON.stringify(near)};worldMouse=()=>({x:_n[0],y:_n[1]});tryPlace();stopPlace()`);
  ok(await pg.g(`structs.some(s=>s.k==='anvil')`),'工作台旁蓋好砧台');
  ok(await pg.g('benchLv()')===2,'工作台 Lv2');
  await pg.g(`craft(RECIPES.find(r=>r.id==='銅鎬'))`);
  ok(await pg.g(`has('銅鎬')`),'Lv2 做得出銅鎬');
  // 修理看等級：樹精法杖（Lv3）壞了，Lv2 修不了
  await pg.g(`inv['樹精法杖']=1;inv['燧石斧']=1;dur['樹精法杖']=10;dur['燧石斧']=10`);
  await pg.key('Tab');await pg.clickSel('[data-tab="craft"]');await sleep(150);
  ok((await pg.ev(`document.getElementById('repairBtn').textContent`)).includes('修理 1 件'),'Lv2：只能修 1 件',await pg.ev(`document.getElementById('repairBtn').textContent`));
  await pg.clickSel('#repairBtn');await sleep(100);
  ok(await pg.g(`durOf('燧石斧')===120&&durOf('樹精法杖')===10`),'修好燧石斧，法杖沒修');
  ok((await pg.ev(`document.getElementById('repairBtn').textContent`)).includes('要 Lv3'),'剩下的提示要 Lv3',await pg.ev(`document.getElementById('repairBtn').textContent`));
  await pg.key('Escape');
  // 工具架 → Lv3
  const near2=await pg.g(FREE(bx,by,2));
  await pg.g(`act({t:'build',k:'rack',x:${near2[0]},y:${near2[1]},cost:{}})`);
  ok(await pg.g('benchLv()')===3,'加工具架：Lv3');
  await pg.shot(HERE+'/t6-world.png');
  // 拆掉砧台 → 等級掉回去
  const an=await pg.g(`(()=>{const s=structs.find(s=>s.k==='anvil');return[s.x,s.y]})()`);
  await pg.g(`act({t:'demo',k:'anvil',x:${an[0]},y:${an[1]}})`);
  ok(await pg.g('benchLv()')===2,'拆掉砧台：剩 Lv2（工具架還在）');
  console.log('logs',pg.logs);
}finally{br.close()}
