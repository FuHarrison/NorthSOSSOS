import { launch, soloGame, mpGame, buildTestCopy, startServer, sleep, HERE } from './lib/harness.mjs';
import fs from 'node:fs';
const br = await launch();
const ok = (c, m, x) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : '  → ' + JSON.stringify(x)));
  if (!c) process.exitCode = 1;
};
let sv;
try {
  const pg = await soloGame(br, HERE + '/15-emotes');
  await pg.g(`mobs.length=0`);
  await pg.key('KeyZ');
  await sleep(100);
  ok(!(await pg.ev(`document.getElementById('emoteMenu').hidden`)), 'Z 打開表情選單');
  ok((await pg.ev(`document.querySelectorAll('#emoteMenu [data-em]').length`)) === 8, '8 種表情');
  await pg.shot(HERE + '/t15-menu.png');
  const hs = await pg.g('hotSel');
  await pg.key('Digit2');
  await sleep(100);
  ok(
    (await pg.g('P.em')) === 1 && (await pg.ev(`document.getElementById('emoteMenu').hidden`)),
    '按 2：比讚，選單關掉'
  );
  ok((await pg.g('hotSel')) === hs, '選表情時不會切換快捷欄');
  await sleep(200);
  await pg.shot(HERE + '/t15-bubble.png');
  await sleep(3000);
  ok((await pg.g('P.em')) === -1, '3 秒後泡泡消失');
  // 跳舞：一動就停
  await pg.key('KeyZ');
  await pg.clickSel('[data-em="7"]');
  await sleep(300);
  ok((await pg.g('P.em')) === 7, '點選跳舞');
  await pg.shot(HERE + '/t15-dance.png');
  await pg.keyDown('KeyD');
  await sleep(250);
  await pg.keyUp('KeyD');
  ok((await pg.g('P.em')) === -1, '跳舞時移動就停');
  // Esc 先關表情選單
  await pg.key('KeyZ');
  await pg.key('Escape');
  await sleep(100);
  ok(
    await pg.ev(`document.getElementById('emoteMenu').hidden&&document.getElementById('settings').hidden`),
    'Esc 只關表情選單'
  );
  console.log('solo logs', pg.logs);
  pg.close();
  const dir = HERE + '/15-emotesmp';
  fs.rmSync(dir, { recursive: true, force: true });
  buildTestCopy(dir);
  sv = await startServer(dir, 18202);
  const a = await mpGame(br, 18202, '甲');
  const b = await mpGame(br, 18202, '乙');
  await a.send('Page.bringToFront');
  await a.g('setEmote(4)');
  await sleep(700);
  ok((await b.g(`[...others.values()].find(o=>o.n==='甲')?.em`)) === 4, '多人：乙看到甲的愛心');
  await sleep(3200);
  ok((await b.g(`[...others.values()].find(o=>o.n==='甲')?.em`)) === -1, '多人：時間到了也會消失');
  console.log('mp logs', a.logs, b.logs);
} finally {
  br.close();
  sv && sv.close();
}
