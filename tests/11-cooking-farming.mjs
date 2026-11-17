import { launch, soloGame, mpGame, buildTestCopy, startServer, sleep, HERE } from './lib/harness.mjs';
import fs from 'node:fs';
const br = await launch();
const ok = (c, m, x) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : '  → ' + JSON.stringify(x)));
  if (!c) process.exitCode = 1;
};
const FREE = (cx, cy, skip = 0) =>
  `(()=>{let k=0;for(let r=1;r<8;r++)for(let a=0;a<16;a++){const x=${cx}+Math.cos(a/16*6.28)*r*40,y=${cy}+Math.sin(a/16*6.28)*r*40,c=ci(x,y);if(c>=0&&biome[c]>=1&&biome[c]!==7&&!structGrid[c]&&!resGrid[c]&&c!==altar.cell&&Math.hypot(x-P.x,y-P.y)>40){if(k++===${skip})return[(c%COLS+.5)*CELL,(Math.floor(c/COLS)+.5)*CELL]}}})()`;
let sv;
try {
  const pg = await soloGame(br, HERE + '/11-cooking-farming');
  await pg.g(`P.x=spawnPt.x;P.y=spawnPt.y;mobs.length=0`);
  const [px, py] = await pg.g(FREE('P.x', 'P.y'));
  await pg.g(`act({t:'build',k:'pot',x:${px},y:${py},cost:{}})`);
  ok((await pg.g(`structGrid[ci(${px},${py})]?.k`)) === 'pot', '蓋好料理鍋');
  await pg.g(`P.x=${px};P.y=${py}+40;inv={蘑菇:9,胡蘿蔔:4,生肉:4};known=new Set(Object.keys(inv))`);
  ok(!(await pg.g('nearPot()')), '旁邊沒營火：不能煮');
  ok(
    (await pg.g(`useLabel(nearestUse())`)).includes('要放在營火旁'),
    '提示要放在營火旁',
    await pg.g(`useLabel(nearestUse())`)
  );
  const [fx, fy] = await pg.g(FREE(px, py, 0));
  await pg.g(`act({t:'build',k:'fire',x:${fx},y:${fy},cost:{}})`);
  ok(
    (await pg.g(`dist(structs.find(s=>s.k==='fire'),structGrid[ci(${px},${py})])<100`)) && (await pg.g('nearPot()')),
    '營火在旁邊：可以煮'
  );
  await pg.g(`P.x=${px};P.y=${py}+40`);
  await pg.g('doUse()');
  await sleep(150);
  ok(await pg.g(`panelTab==='craft'&&craftTab==='food'`), 'E 料理鍋：打開料理分類');
  await pg.shot(HERE + '/t11-cook.png');
  await pg.clickSel('[data-pick="燉肉"]');
  await sleep(80);
  await pg.clickSel('[data-make]');
  await sleep(100);
  ok(await pg.g(`inv['燉肉']===1&&inv['生肉']===2&&inv['胡蘿蔔']===3&&inv['蘑菇']===8`), '煮出燉肉、扣材料');
  await pg.key('Escape');
  await pg.g(`foods=[];eat('燉肉')`);
  ok((await pg.g(`Math.round(maxHp())`)) === 71, '吃燉肉：血量上限 25+46', await pg.g('maxHp()'));
  // 離開料理鍋不能煮
  await pg.g(`P.x+=600;craft(RECIPES.find(r=>r.id==='蘑菇湯'))`);
  ok(!(await pg.g(`has('蘑菇湯')`)), '離開料理鍋：煮不了');
  // 菜圃：不擋路
  await pg.g(`P.x=spawnPt.x;P.y=spawnPt.y`);
  const [gx, gy] = await pg.g(FREE('P.x', 'P.y', 3));
  await pg.g(`act({t:'build',k:'plot',x:${gx},y:${gy},cost:{}})`);
  ok((await pg.g(`structGrid[ci(${gx},${gy})]?.k`)) === 'plot', '蓋好菜圃');
  ok(!(await pg.g(`blocked(${gx},${gy},12)`)), '菜圃走得過去');
  await pg.g(`P.x=${gx}+20;P.y=${gy};inv={}`);
  ok((await pg.g(`useLabel(nearestUse())`)) === '菜圃（需要種子）', '沒種子時的提示');
  await pg.g(`inv['胡蘿蔔種子']=2;doUse()`);
  ok(await pg.g(`structGrid[ci(${gx},${gy})].crop?.k==='胡蘿蔔'&&inv['胡蘿蔔種子']===1`), '種下胡蘿蔔、扣一顆種子');
  await pg.g(`doUse()`);
  ok(await pg.g(`structGrid[ci(${gx},${gy})].crop.g>0&&!has('胡蘿蔔')`), '還沒成熟不能收');
  ok((await pg.g(`useLabel(nearestUse())`)).startsWith('胡蘿蔔生長中'), '顯示生長進度');
  await pg.g(`paused=false;updateWorld(120)`);
  await pg.shot(HERE + '/t11-plot-mid.png');
  await pg.g(`updateWorld(130)`);
  ok((await pg.g(`structGrid[ci(${gx},${gy})].crop.g`)) === 0, '240 秒後成熟');
  await pg.g(`P.x=${gx}+20;P.y=${gy}`);
  await sleep(100);
  await pg.shot(HERE + '/t11-plot.png');
  await pg.g(`doUse()`);
  ok(
    await pg.g(`inv['胡蘿蔔']>=2&&inv['胡蘿蔔']<=3&&inv['胡蘿蔔種子']>=2&&!structGrid[ci(${gx},${gy})].crop`),
    '收成：胡蘿蔔 2～3、種子 1～2，菜圃空了',
    await pg.g('inv')
  );
  // 種子來源：採莓果
  const n = await pg.g(
    `(()=>{let n=0;for(let i=0;i<400;i++){const o=[...resGrid].find(r=>r&&r.k==='bush');o.dep=0;inv={};worldRes(o.cell,0,ME);if(has('胡蘿蔔種子'))n++}return n})()`
  );
  ok(n > 60 && n < 140, '採莓果約 25% 拿到種子', n);
  // 存檔
  await pg.g(`P.x=${gx}+20;P.y=${gy};inv['胡蘿蔔種子']=1;doUse();writeSave()`);
  await pg.ev('location.reload()');
  await sleep(1500);
  await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`);
  ok((await pg.g(`structGrid[ci(${gx},${gy})]?.crop?.k`)) === '胡蘿蔔', '重新整理後作物還在');
  console.log('solo logs', pg.logs);
  pg.close();
  // 多人：主機計時，乙看得到成熟
  const dir = HERE + '/11-cooking-farmingmp';
  fs.rmSync(dir, { recursive: true, force: true });
  buildTestCopy(dir);
  sv = await startServer(dir, 18201);
  const a = await mpGame(br, 18201, '甲');
  const b = await mpGame(br, 18201, '乙');
  const [mx, my] = await a.g(FREE('P.x', 'P.y', 2));
  await a.g(`act({t:'build',k:'plot',x:${mx},y:${my},cost:{}})`);
  await sleep(400);
  await a.g(`inv['胡蘿蔔種子']=1;act({t:'plant',c:ci(${mx},${my}),k:'胡蘿蔔'})`);
  await sleep(500);
  ok((await b.g(`structGrid[ci(${mx},${my})]?.crop?.k`)) === '胡蘿蔔', '多人：乙看到甲種的胡蘿蔔');
  await b.g(`act({t:'harv',c:ci(${mx},${my})})`);
  await sleep(400);
  ok(!(await b.g(`has('胡蘿蔔')`)), '多人：沒成熟收不了');
  console.log('mp logs', a.logs, b.logs);
} finally {
  br.close();
  sv && sv.close();
}
