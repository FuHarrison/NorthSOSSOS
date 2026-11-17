import {launch,soloGame,mpGame,buildTestCopy,startServer,sleep,HERE} from './lib/harness.mjs';
import fs from 'node:fs';
const br=await launch();const ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':'  → '+JSON.stringify(x)));if(!c)process.exitCode=1};
let sv;
try{
  const pg=await soloGame(br,HERE+'/09-block-parry');
  await pg.g(`P.x=spawnPt.x;P.y=spawnPt.y;mobs.length=0`);
  // 右鍵按住 → 格擋
  await pg.move(800,400);await pg.send('Input.dispatchMouseEvent',{type:'mousePressed',x:800,y:400,button:'right',buttons:2,clickCount:1});await sleep(150);
  ok(await pg.g('P.blocking'),'按住右鍵：格擋中');
  ok(await pg.g('P.roll<=0'),'右鍵不再翻滾');
  await pg.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:800,y:400,button:'right',buttons:0,clickCount:1});await sleep(150);
  ok(!(await pg.g('P.blocking')),'放開右鍵：不再格擋');
  // 以下直接設定狀態，避開每一幀的時間差
  const FRONT=`{x:P.x+Math.cos(P.face)*20,y:P.y+Math.sin(P.face)*20}`,BACK=`{x:P.x-Math.cos(P.face)*20,y:P.y-Math.sin(P.face)*20}`;
  // 招架
  const mid=await pg.g(`(()=>{const m=spawnMob('boar',P.x+Math.cos(P.face)*30,P.y+Math.sin(P.face)*30);return m.id})()`);
  await pg.g(`paused=true;eq.off=null;P.hp=25;P.inv=0;P.blocking=true;P.blockT=.1;hitPlayer(10,Object.assign(${FRONT},{id:${mid}}))`);
  ok(await pg.g('P.hp')===25,'招架：不受傷');
  ok(await pg.g(`mobs.find(m=>m.id===${mid}).stun`)===2,'招架：野豬暈眩 2 秒');
  const hp0=await pg.g(`mobs.find(m=>m.id===${mid}).hp`);await pg.g(`hitMob(mobs.find(m=>m.id===${mid}),10,ME,P.x,P.y)`);
  ok(hp0-await pg.g(`mobs.find(m=>m.id===${mid}).hp`)===15,'暈眩中多吃 50% 傷害');
  // 暈眩的怪不動
  const pos0=await pg.g(`(()=>{const m=mobs.find(m=>m.id===${mid});m.hp=99;m.kx=m.ky=0;m.aggro=10;return[m.x,m.y]})()`);
  await pg.g(`(()=>{const m=mobs.find(m=>m.id===${mid});TG=[P];for(let i=0;i<10;i++)updateMob(m,.05)})()`);
  ok(JSON.stringify(await pg.g(`(()=>{const m=mobs.find(m=>m.id===${mid});return[m.x,m.y]})()`))===JSON.stringify(pos0),'暈眩中不會動');
  // 格擋（不是招架）：用盾擋
  await pg.g(`inv['木盾']=1;eq.off='木盾';P.hp=25;P.st=50;P.inv=0;P.blocking=true;P.blockT=1;hitPlayer(8,${FRONT})`);
  ok(await pg.g('P.hp')===25&&Math.abs(await pg.g('P.st')-(50-9.6))<.01,'木盾擋 8：不扣血，耐力 -9.6',await pg.g('[P.hp,P.st]'));
  ok(await pg.g(`durOf('木盾')`)===79,'格擋時盾牌磨損');
  await pg.g(`P.hp=25;P.st=50;P.inv=0;hitPlayer(15,${FRONT})`);
  ok(Math.abs(await pg.g('P.hp')-20)<.01,'擋 15：擋掉 10，吃 5',await pg.g('P.hp'));
  await pg.g(`P.hp=25;P.st=50;P.inv=0;hitPlayer(8,${BACK})`);
  ok(Math.abs(await pg.g('P.hp')-17)<.01,'背後被打：擋不到',await pg.g('P.hp'));
  await pg.g(`P.hp=25;P.st=2;P.inv=0;P.stag=0;hitPlayer(8,${FRONT})`);
  ok(await pg.g('P.st===0&&P.stag>0&&P.hp<25'),'耐力不夠：防禦被打破、硬直、受傷',await pg.g('[P.st,P.stag,P.hp]'));
  // 空手格擋只擋 4
  await pg.g(`eq.off=null;P.hp=25;P.st=50;P.inv=0;P.stag=0;hitPlayer(8,${FRONT})`);
  ok(Math.abs(await pg.g('P.hp')-21)<.01,'沒盾：只擋 4',await pg.g('P.hp'));
  // 格擋時不能攻擊
  await pg.g(`paused=false;mobs.length=0`);
  await pg.send('Input.dispatchMouseEvent',{type:'mousePressed',x:800,y:400,button:'right',buttons:2,clickCount:1});await sleep(120);
  await pg.g(`atkHeld=true;P.cd=0`);await sleep(150);
  ok(await pg.g('P.swing<=0'),'格擋中按左鍵不會揮');
  await pg.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:800,y:400,button:'right',buttons:0,clickCount:1});await pg.g('atkHeld=false');
  // 做盾：自動拿上副手
  await pg.g(`eq.off=null;delete inv['木盾'];inv['木頭']=20;inv['皮革']=4;known.add('木頭');known.add('皮革');act({t:'build',k:'bench',x:P.x+80,y:P.y+80,cost:{}});P.x=P.x+40`);
  await pg.g(`craft(RECIPES.find(r=>r.id==='木盾'))`);
  ok(await pg.g(`eq.off`)==='木盾'||!(await pg.g('nearBench()')),'做出木盾：自動拿上副手',await pg.g('[eq.off,nearBench()]'));
  await pg.key('Tab');await pg.clickSel('[data-tab="inv"]');await sleep(150);
  ok(await pg.ev(`document.querySelectorAll('.eqsec [data-ek]').length`)===4,'穿戴欄有副手');
  await pg.key('Escape');
  await pg.g(`P.blocking=P.block=true;blockHeld=true`);await sleep(100);await pg.shot(HERE+'/t9-block.png');await pg.g('blockHeld=false');
  console.log('solo logs',pg.logs);pg.close();
  // 多人：乙看到甲舉盾；招架讓主機上的怪暈眩
  const dir=HERE+'/09-block-parrymp';fs.rmSync(dir,{recursive:true,force:true});buildTestCopy(dir);
  sv=await startServer(dir,18199);
  const a=await mpGame(br,18199,'甲');const b=await mpGame(br,18199,'乙');
  await a.send('Page.bringToFront');await a.g(`inv['鐵盾']=1;eq.off='鐵盾';blockHeld=true`);await sleep(800);
  ok(JSON.stringify(await b.g(`(()=>{const o=[...others.values()].find(o=>o.n==='甲');return o&&[o.block,o.sh]})()`))==='[true,"鐵盾"]','多人：乙看到甲舉著鐵盾');
  const id=await a.g(`mobs.length?mobs[0].id:0`);
  await a.g(`act({t:'parry',id:${id}})`);await sleep(500);
  ok(await b.g(`(mobs.find(m=>m.id===${id})||{}).stun>0`),'多人：招架後大家都看到怪暈眩');
  console.log('mp logs',a.logs,b.logs);
}finally{br.close();sv&&sv.close()}
