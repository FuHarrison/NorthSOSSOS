import { launch, soloGame, sleep, HERE } from './lib/harness.mjs';
const br = await launch();
const ok = (c, m, x) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : '  → ' + JSON.stringify(x)));
  if (!c) process.exitCode = 1;
};
try {
  const pg = await soloGame(br, HERE + '/16-treant-elder-with-systems');
  // 喚醒樹精長老：手上拿心臟、帶古樹種子
  await pg.g(
    `inv={狼王的心臟:1,古樹種子:1};hot=Array(8).fill(null);hot[0]='狼王的心臟';hotSel=0;syncHeld();P.x=altar.x;P.y=altar.y+60;doUse()`
  );
  await sleep(200);
  ok(await pg.g(`boss&&boss.k==='treant'`), '拿著心臟＋種子：喚醒樹精長老');
  ok(await pg.g(`inv['狼王的心臟']===1&&!inv['古樹種子']`), '心臟不會用掉、種子用掉');
  // 打長老：近戰熟練度、無敵護盾
  await pg.g(`inv['狼牙劍']=1;hot[1]='狼牙劍';hotSel=1;syncHeld()`);
  const r = await pg.g(
    `(()=>{const m=boss;m.state='idle';const h=m.hp;P.x=m.x-40;P.y=m.y;P.face=0;P.cd=0;P.st=50;P.roll=0;attack();const d1=h-m.hp;m.state='eat';const h2=m.hp;P.cd=0;P.st=50;attack();return[d1,h2-m.hp]})()`
  );
  ok(r[0] > 0 && r[1] === 0, '長老：平常打得動，吞食時無敵', r);
  ok(await pg.g(`sk.melee>0`), '打長老會練近戰');
  // 招架長老：暈眩
  await pg.g(`boss.state='idle';P.blocking=true;P.blockT=.1;P.inv=0;hitPlayer(10,{x:P.x+20,y:P.y,id:boss.id})`);
  ok(await pg.g(`boss.stun>0`), '招架長老：暈眩 1 秒');
  // 擊殺：掉落、長老年輪
  await pg.g(`P.blocking=false;boss.stun=0;killMob(boss,ME)`);
  await sleep(200);
  ok(await pg.g(`treantDown&&has('長老年輪')&&has('堅硬樹皮')`), '打倒長老：長老年輪與掉落');
  ok(await pg.g(`recipeOpen(RECIPES.find(r=>r.id==='樹精裝備'))`), '樹精裝備解鎖（配方規則＋打倒長老）');
  ok((await pg.g(`recipeLv('樹精裝備')`)) === 3, '樹精裝備仍要 Lv3 工作台');
  console.log('logs', pg.logs);
} finally {
  br.close();
}
