import { launch, soloGame, sleep, HERE } from './lib/harness.mjs';
const br = await launch();
const ok = (c, m, x) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : '  → ' + JSON.stringify(x)));
  if (!c) process.exitCode = 1;
};
try {
  const pg = await soloGame(br, HERE + '/05-recipes');
  ok((await pg.g(`known.size`)) === 0, '新遊戲：什麼都沒拿過');
  await pg.key('Tab');
  await pg.clickSel('[data-tab="craft"]');
  await sleep(150);
  ok(
    (await pg.ev(`document.querySelector('#panelBody .note')?.textContent||''`)).includes('還沒有裝備配方'),
    '製作頁：沒有配方時顯示提示'
  );
  await pg.clickSel('[data-cat="build"]');
  await sleep(100);
  ok(
    (await pg.ev(`document.querySelector('#panelBody .note')?.textContent||''`)).includes('還沒有建築配方'),
    '建築分頁也是空的'
  );
  await pg.shot(HERE + '/t5-empty.png');
  await pg.key('Escape');
  await sleep(100);
  ok(JSON.stringify(await pg.g(`buildList().map(r=>r.id)`)) === '["demolish"]', '建造模式只剩拆除');
  // 拿到木頭 → 木棒、工作台、木牆、箱子
  await pg.g(`give('木頭',3)`);
  await sleep(300);
  const open1 = await pg.g(`RECIPES.filter(recipeOpen).map(r=>r.id)`);
  ok(
    JSON.stringify(open1) === '["bench","wall","chair","chest","木棒"]',
    '拿到木頭：解鎖工作台、木牆、椅子、箱子、木棒',
    open1
  );
  ok(
    (await pg.ev(`document.getElementById('toast').textContent`)).startsWith('新配方：'),
    '跳出新配方提示',
    await pg.ev(`document.getElementById('toast').textContent`)
  );
  // 燧石 → 燧石斧、燧石鎬；矛還要皮革
  await pg.g(`give('燧石',2)`);
  await sleep(300);
  const open2 = await pg.g(`RECIPES.filter(recipeOpen).map(r=>r.id)`);
  ok(
    open2.includes('燧石斧') && open2.includes('燧石鎬') && !open2.includes('燧石矛'),
    '拿到燧石：斧、鎬解鎖，矛還沒（要皮革）',
    open2
  );
  // 用掉材料後配方仍然在
  await pg.g(`inv={}`);
  await sleep(300);
  ok((await pg.g(`RECIPES.filter(recipeOpen).length`)) === open2.length, '材料用完，配方不會消失');
  // 狼牙劍要狼王之牙
  ok(!(await pg.g(`recipeOpen(RECIPES.find(r=>r.id==='狼牙劍'))`)), '沒拿過狼王之牙：沒有狼牙劍');
  await pg.g(`give('狼王之牙',1)`);
  await sleep(300);
  ok(await pg.g(`recipeOpen(RECIPES.find(r=>r.id==='狼牙劍'))`), '拿到狼王之牙：狼牙劍解鎖');
  // 樹精裝備：材料都有但沒打倒樹精
  await pg.g(`give('堅硬樹皮',1);give('古老樹枝',1);give('自然精華',1)`);
  await sleep(300);
  ok(!(await pg.g(`recipeOpen(RECIPES.find(r=>r.id==='樹精裝備'))`)), '沒打倒樹精：樹精裝備還鎖著');
  await pg.g(`treantDown=true`);
  ok(await pg.g(`recipeOpen(RECIPES.find(r=>r.id==='樹精裝備'))`), '打倒樹精後解鎖');
  // 存檔
  await pg.g('writeSave()');
  await pg.ev('location.reload()');
  await sleep(1500);
  await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`);
  ok(await pg.g(`known.has('燧石')&&known.has('狼王之牙')`), '重新整理後記得拿過的東西');
  // 開著製作頁時解鎖會即時刷新
  await pg.ev(`document.getElementById('go').click()`);
  await sleep(200);
  await pg.key('Tab');
  await pg.clickSel('[data-tab="craft"]');
  await pg.clickSel('[data-cat="gear"]');
  await sleep(100);
  const n0 = await pg.ev(`document.querySelectorAll('#panelBody .ci').length`);
  await pg.g(`give('皮革',1)`);
  await sleep(400);
  const n1 = await pg.ev(`document.querySelectorAll('#panelBody .ci').length`);
  ok(n1 > n0, '開著製作頁拿到皮革：清單即時多出燧石矛、皮甲', [n0, n1]);
  console.log('logs', pg.logs);
} finally {
  br.close();
}
