import { launch, soloGame, sleep, HERE } from './lib/harness.mjs';
const br = await launch();
const ok = (c, m, x) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : '  → ' + JSON.stringify(x)));
  if (!c) process.exitCode = 1;
};
const FREE = (cx, cy, skip = 0) =>
  `(()=>{let k=0;for(let r=1;r<8;r++)for(let a=0;a<16;a++){const x=${cx}+Math.cos(a/16*6.28)*r*40,y=${cy}+Math.sin(a/16*6.28)*r*40,c=ci(x,y);if(c>=0&&biome[c]>=1&&biome[c]!==7&&!structGrid[c]&&!resGrid[c]&&c!==altar.cell&&Math.hypot(x-P.x,y-P.y)>40){if(k++===${skip})return[(c%COLS+.5)*CELL,(Math.floor(c/COLS)+.5)*CELL]}}})()`;
try {
  const pg = await soloGame(br, HERE + '/12-comfort');
  await pg.g(`P.x=spawnPt.x;P.y=spawnPt.y;mobs.length=0;dayT=.2`);
  const [fx, fy] = await pg.g(FREE('P.x', 'P.y'));
  await pg.g(`act({t:'build',k:'fire',x:${fx},y:${fy},cost:{}})`);
  await pg.g(`P.x=${fx}+50;P.y=${fy};P.rest=0;P.restT=0`);
  await sleep(3600);
  ok(
    (await pg.g('P.restLv')) === 1 && Math.abs((await pg.g('P.rest')) - 180) < 3,
    '只有營火：舒適度 1，休息 3 分鐘',
    await pg.g('[P.restLv,P.rest]')
  );
  ok(
    (await pg.ev(`document.getElementById('buffs').textContent`)).includes('休息 Lv1'),
    '左上角顯示休息 Lv1',
    await pg.ev(`document.getElementById('buffs').textContent`)
  );
  for (const [k, i] of [
    ['chair', 1],
    ['rug', 2],
    ['banner', 3],
    ['bed', 4]
  ]) {
    const [x, y] = await pg.g(FREE(fx, fy, i));
    await pg.g(`act({t:'build',k:'${k}',x:${x},y:${y},cost:{}})`);
  }
  ok((await pg.g('comfortAt(P.x,P.y)')) === 5, '椅子＋地毯＋旗幟＋床：舒適度 5', await pg.g('comfortAt(P.x,P.y)'));
  await pg.g(`(()=>{const[x,y]=${FREE(fx, fy, 5)};act({t:'build',k:'chair',x,y,cost:{}})})()`);
  ok((await pg.g('comfortAt(P.x,P.y)')) === 5, '同一種家具不重複算');
  await pg.g(`P.rest=0;P.restT=0`);
  await sleep(3600);
  ok(
    (await pg.g('P.restLv')) === 5 && Math.abs((await pg.g('P.rest')) - 420) < 3,
    '舒適度 5：休息 7 分鐘',
    await pg.g('[P.restLv,P.rest]')
  );
  ok(!(await pg.g(`blocked(structs.find(s=>s.k==='rug').x,structs.find(s=>s.k==='rug').y,12)`)), '地毯走得過去');
  await pg.shot(HERE + '/t12-comfort.png');
  // 離開營火：舒適度不顯示，休息繼續倒數
  await pg.g(`P.x+=800`);
  await sleep(300);
  ok(
    !(await pg.ev(`document.getElementById('buffs').textContent`)).includes('舒適度') &&
      (await pg.ev(`document.getElementById('buffs').textContent`)).includes('休息 Lv5'),
    '離開營火：只剩休息倒數'
  );
  console.log('logs', pg.logs);
} finally {
  br.close();
}
