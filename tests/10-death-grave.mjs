import { launch, soloGame, mpGame, buildTestCopy, startServer, sleep, HERE } from './lib/harness.mjs';
import fs from 'node:fs';
const br = await launch();
const ok = (c, m, x) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : '  → ' + JSON.stringify(x)));
  if (!c) process.exitCode = 1;
};
let sv;
try {
  const pg = await soloGame(br, HERE + '/10-death-grave');
  await pg.g(
    `P.x=spawnPt.x+300;P.y=spawnPt.y;mobs.length=0;inv={木頭:80,石頭:12,狼牙劍:1,皮甲:1,烤肉:5};eq.body='皮甲';hot=[null,null,null,null,null,null,null,null];hot[0]='狼牙劍';hot[1]='烤肉';syncHeld()`
  );
  const L0 = await pg.g('loots.length');
  const dx = await pg.g('Math.round(P.x)');
  await pg.g(`P.hp=0;die()`);
  await sleep(150);
  ok((await pg.g(`loots.length`)) === L0 + 1, '倒下：留下一個墓碑');
  const gr = await pg.g(`loots.at(-1)`);
  ok(
    gr.g === (await pg.g('myName')) &&
      gr.bag['木頭'] === 80 &&
      gr.bag['石頭'] === 12 &&
      !gr.bag['狼牙劍'] &&
      !gr.bag['皮甲'] &&
      !gr.bag['烤肉'],
    '墓碑裡有木頭、石頭；劍（快捷欄）、皮甲（穿著）、烤肉（快捷欄）不在裡面',
    gr
  );
  ok(await pg.g(`inv['狼牙劍']===1&&inv['皮甲']===1&&inv['烤肉']===5&&!inv['木頭']`), '身上留下快捷欄和穿著的東西');
  ok((await pg.ev(`document.getElementById('deadMsg').textContent`)).includes('墓碑'), '倒下畫面說明墓碑');
  await pg.shot(HERE + '/t10-dead.png');
  await pg.clickSel('#respawn');
  await sleep(200);
  // 回到墓碑
  await pg.g(`P.x=${gr.x}+20;P.y=${gr.y}`);
  await sleep(150);
  ok(
    (await pg.g(`useLabel(nearestUse())`)) === '拿回遺物',
    '墓碑旁顯示「拿回遺物」',
    await pg.g(`useLabel(nearestUse())`)
  );
  await pg.shot(HERE + '/t10-grave.png');
  await pg.g('doUse()');
  await sleep(150);
  ok(await pg.g(`inv['木頭']===80&&inv['石頭']===12&&!loots.some(l=>l.g)`), '按 E 拿回全部，墓碑消失');
  // 背包空：不留墓碑
  await pg.g(`inv={狼牙劍:1};hot[0]='狼牙劍';P.hp=0;die()`);
  await sleep(100);
  ok(!(await pg.g(`loots.some(l=>l.g)`)), '背包空的：不留墓碑');
  await pg.clickSel('#respawn');
  // 存檔保留地上的袋子與墓碑
  await pg.g(`act({t:'drop',x:P.x,y:P.y,bag:{燧石:3},g:myName})`);
  await pg.g('writeSave()');
  await pg.ev('location.reload()');
  await sleep(1500);
  await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`);
  ok(await pg.g(`loots.some(l=>l.g&&l.bag['燧石']===3)`), '重新整理後墓碑還在');
  await pg.ev(`document.getElementById('go').click()`);
  await sleep(150);
  const gr2 = await pg.g(`loots.find(l=>l.g)`);
  await pg.g(`inv={};P.x=${gr2.x}+20;P.y=${gr2.y}`);
  await sleep(100);
  ok(
    (await pg.g(`useLabel(nearestUse())`)) === '拿回遺物',
    '重新整理後（名字換了）還是能拿回自己的墓碑',
    await pg.g(`[useLabel(nearestUse()),myName]`)
  );
  await pg.g('doUse()');
  await sleep(100);
  ok(await pg.g(`inv['燧石']===3`), '拿回來了');
  console.log('solo logs', pg.logs);
  pg.close();
  // 多人：乙撿不起甲的墓碑；主機重開後墓碑還在
  const dir = HERE + '/10-death-gravemp';
  fs.rmSync(dir, { recursive: true, force: true });
  buildTestCopy(dir);
  sv = await startServer(dir, 18200);
  let a = await mpGame(br, 18200, '甲');
  let b = await mpGame(br, 18200, '乙');
  await a.g(`inv={木頭:30};hot=Array(8).fill(null);P.hp=0;die()`);
  await sleep(600);
  const id = await b.g(`(loots.find(l=>l.g==='甲')||{}).id`);
  ok(!!id, '多人：乙看到甲的墓碑');
  await b.g(`act({t:'pick',id:${id}})`);
  await sleep(500);
  ok(await b.g(`!inv['木頭']&&loots.some(l=>l.id===${id})`), '多人：乙撿不起甲的墓碑');
  ok(
    (await b.ev(`document.getElementById('toast').textContent`)).includes('甲的墓碑'),
    '乙看到提示',
    await b.ev(`document.getElementById('toast').textContent`)
  );
  await sleep(9000);
  await sv.close();
  await sleep(800);
  sv = await startServer(dir, 18200);
  await sleep(1500);
  a = await mpGame(br, 18200, '甲');
  ok(await a.g(`loots.some(l=>l.g==='甲'&&l.bag['木頭']===30)`), '多人：主機重開後墓碑還在');
  await a.g(`act({t:'pick',id:${id}})`);
  await sleep(600);
  ok(await a.g(`inv['木頭']===30`), '多人：甲拿回自己的墓碑');
  console.log('mp logs', a.logs, b.logs);
} finally {
  br.close();
  sv && sv.close();
}
