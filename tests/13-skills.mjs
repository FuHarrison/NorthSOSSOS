import { launch, soloGame, sleep, HERE } from './lib/harness.mjs';
const br = await launch();
const ok = (c, m, x) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : '  → ' + JSON.stringify(x)));
  if (!c) process.exitCode = 1;
};
try {
  const pg = await soloGame(br, HERE + '/13-skills');
  await pg.g(`P.x=spawnPt.x;P.y=spawnPt.y;mobs.length=0`);
  ok((await pg.g(`skLv('melee')`)) === 0, '一開始都是 0 級');
  // 近戰：打中 8 次升 1 級
  await pg.g(
    `for(let i=0;i<8;i++){const m=spawnMob('boar',P.x+25,P.y);m.hp=999;P.face=0;P.cd=0;P.st=50;P.roll=0;attack();mobs.length=0}`
  );
  ok((await pg.g(`skLv('melee')`)) === 1, '近戰打中 8 次：Lv1', await pg.g(`sk.melee`));
  ok((await pg.ev(`document.getElementById('toast').textContent`)).includes('近戰熟練度升到 1'), '升級提示');
  // 近戰傷害 +1%/級
  await pg.g(`sk.melee=20`);
  const d = await pg.g(
    `(()=>{const m=spawnMob('boar',P.x+25,P.y);m.hp=999;P.face=0;P.cd=0;P.st=50;P.rest=0;inv['狼牙劍']=1;hot[0]='狼牙劍';hotSel=0;syncHeld();attack();const r=999-m.hp;mobs.length=0;return r})()`
  );
  ok(d === Math.round(38 * 1.2), '近戰 Lv20：狼牙劍 38 → 46', d);
  // 砍樹：力道 +1%/級、會練
  await pg.g(`sk.chop=50;inv['燧石斧']=1`);
  const ch = await pg.g(`(()=>{const o=[...resGrid].find(r=>r&&r.k==='tree');const h=o.hp;hitRes(o);return h-o.hp})()`);
  ok(ch === Math.round(16 * 1.5), '砍樹 Lv50：燧石斧 16 → 24', ch);
  const c0 = await pg.g('sk.chop||0');
  await pg.g(`sk.chop=3;(()=>{const o=[...resGrid].find(r=>r&&r.k==='tree');hitRes(o)})()`);
  ok((await pg.g('sk.chop')) > 3, '砍樹會練砍樹');
  // 格擋：格擋值 +1%/級
  await pg.g(
    `sk.block=50;eq.off=null;P.hp=25;P.st=50;P.inv=0;P.blocking=true;P.blockT=1;hitPlayer(6,{x:P.x+Math.cos(P.face)*20,y:P.y+Math.sin(P.face)*20})`
  );
  ok((await pg.g('P.hp')) === 25, '格擋 Lv50：空手擋 4×1.5=6', await pg.g('P.hp'));
  await pg.g('P.blocking=false');
  // 翻滾耗耐力減少
  await pg.g(`sk.roll=50;P.st=50;P.roll=0;P.stDelay=0;doRoll()`);
  ok(Math.abs((await pg.g('P.st')) - (50 - 14 * 0.7)) < 0.01, '閃避 Lv50：翻滾耗耐力 14 → 9.8', await pg.g('P.st'));
  // 技能分頁
  await pg.key('Tab');
  await pg.clickSel('[data-tab="skills"]');
  await sleep(150);
  ok((await pg.ev(`document.querySelectorAll('.sk').length`)) === 7, '技能分頁列出 7 種');
  await pg.shot(HERE + '/t13-skills.png');
  await pg.key('Escape');
  // 倒下掉 5%
  await pg.g(`sk.melee=20;P.hp=0;die()`);
  ok(Math.abs((await pg.g('sk.melee')) - 19) < 1e-9, '倒下：20 → 19', await pg.g('sk.melee'));
  await pg.clickSel('#respawn');
  // 存檔
  await pg.g('writeSave()');
  await pg.ev('location.reload()');
  await sleep(1500);
  await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`);
  ok(
    Math.abs((await pg.g('sk.melee')) - 19) < 1e-9 && (await pg.g('sk.chop')) > 2.9 && (await pg.g('sk.block')) > 0,
    '重新整理後熟練度保留',
    await pg.g('JSON.stringify(sk)')
  );
  console.log('logs', pg.logs);
} finally {
  br.close();
}
