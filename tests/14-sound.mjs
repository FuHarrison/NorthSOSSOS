import {launch,soloGame,sleep,HERE} from './lib/harness.mjs';
const br=await launch();const ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':'  → '+JSON.stringify(x)));if(!c)process.exitCode=1};
try{
  const pg=await soloGame(br,HERE+'/14-sound');
  ok(await pg.g('SET.sound')===false,'預設關閉');
  await pg.g(`P.x=spawnPt.x;P.y=spawnPt.y;mobs.length=0;P.cd=0;P.st=50;attack()`);
  ok(await pg.g('AC')===null,'關閉時完全不建立音訊（不會發出聲音）');
  await pg.key('Escape');await sleep(100);
  ok(await pg.ev(`!!document.getElementById('volIn')`),'設定裡有音量滑桿');
  await pg.clickSel('[data-set="sound"]');await sleep(150);
  ok(await pg.g('SET.sound===true&&AC!==null'),'打開音效：建立 AudioContext');
  // 計算每個音效實際產生的聲音節點
  await pg.g(`window.__n=0;const o1=AC.createOscillator.bind(AC),o2=AC.createBufferSource.bind(AC);AC.createOscillator=()=>{window.__n++;return o1()};AC.createBufferSource=()=>{window.__n++;return o2()}`);
  const bad=[];for(const k of await pg.g('Object.keys(SFX)')){await pg.g('window.__n=0');await pg.g(`sfx('${k}')`);await sleep(400);if(!(await pg.g('window.__n'))>0)bad.push(k)}
  ok(!bad.length,`16 種音效都會發聲`,bad);
  ok(await pg.g('Object.keys(SFX).length')===16,'共 16 種',await pg.g('Object.keys(SFX).length'));
  // 音量
  await pg.ev(`(()=>{const v=document.getElementById('volIn');v.value=30;v.dispatchEvent(new Event('input'));v.dispatchEvent(new Event('change'))})()`);
  ok(Math.abs(await pg.g('MASTER.gain.value')-.3)<1e-6&&await pg.g('SET.vol')===30,'音量滑桿調到 30');
  await pg.shot(HERE+'/t14-sound.png');
  // 遊戲中的動作會觸發
  await pg.key('Escape');await pg.g('window.__n=0;P.cd=0;P.st=50;P.roll=0;attack()');await sleep(100);
  ok(await pg.g('window.__n')>0,'揮擊有聲音');
  await pg.ev('location.reload()');await sleep(1500);await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`);
  ok(await pg.g('SET.sound===true&&SET.vol===30'),'重新整理後音效設定保留');
  console.log('logs',pg.logs);
}finally{br.close()}
