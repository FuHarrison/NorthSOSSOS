import {launch,openPage,mpGame,buildTestCopy,startServer,sleep,HERE} from './lib/harness.mjs';
import fs from 'node:fs';import http from 'node:http';import os from 'node:os';
const br=await launch();const ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':'  → '+JSON.stringify(x)));if(!c)process.exitCode=1};
const PORT=18210,B=`http://localhost:${PORT}`;
const get=async n=>(await fetch(`${B}/api/admin/${n}`)).json();
const post=async(n,b,h={'X-North-Admin':'1'})=>{const r=await fetch(`${B}/api/admin/${n}`,{method:'POST',headers:{'Content-Type':'application/json',...h},body:JSON.stringify(b||{})});return{code:r.status,d:await r.json()}};
const raw=(host,hdr={})=>new Promise(r=>{const q=http.request({host,port:PORT,path:'/api/admin/status',headers:hdr},res=>{res.resume();r(res.statusCode)});q.on('error',e=>r('ERR '+e.message));q.end()});
const waitRun=async()=>{for(let i=0;i<60;i++){const s=await get('status');if(s.running&&s.world)return s;await sleep(200)}};
let sv;
try{
  const dir=HERE+'/17-admin-saves-accounts';fs.rmSync(dir,{recursive:true,force:true});buildTestCopy(dir);
  sv=await startServer(dir,PORT);
  // 安全
  ok((await fetch(`${B}/admin`)).status===200,'本機開 /admin：可以');
  const lan=Object.values(os.networkInterfaces()).flat().find(n=>n.family==='IPv4'&&!n.internal).address;
  ok(await raw(lan)===403,`從區網 IP（${lan}）連：拒絕`);
  ok(await raw('127.0.0.1',{Host:'evil.example'})===403,'網址不是 localhost：拒絕');
  ok((await post('kick',{name:'x'},{})).code===403,'沒帶 X-North-Admin 的修改請求：拒絕');
  // 總覽
  const a=await mpGame(br,PORT,'甲','1111');const b=await mpGame(br,PORT,'乙','2222');
  let s=await waitRun();
  ok(s.running&&s.world.day>=1&&s.world.mobs>0,'總覽：世界資料（天數、怪物）',s.world);
  ok(s.online.filter(o=>o.name).map(o=>o.name).sort().join()==='乙,甲','總覽：線上玩家甲、乙');
  // 帳號
  let ac=await get('accounts');ok(ac.list.length===2&&ac.list.every(x=>x.pin&&x.online),'帳號列表：兩個都有 PIN、都在線上');
  ok((await post('resetPin',{name:'甲'})).code===200,'重設甲的 PIN');await sleep(400);
  ok((await a.ev(`document.getElementById('netTxt').textContent`)).includes('重設了你的 PIN'),'甲被請出並看到原因');
  ac=await get('accounts');ok(ac.list.find(x=>x.name==='甲').pin===false,'甲的 PIN 變成待設定');
  a.close();const a2=await mpGame(br,PORT,'甲','9999');
  ok(await a2.g('started'),'甲用新的 PIN 9999 登入');
  ok((await get('accounts')).list.find(x=>x.name==='甲').pin===true,'新 PIN 存起來了');
  ok((await post('kick',{name:'乙'})).code===200,'踢出乙');await sleep(300);
  ok((await b.ev(`document.getElementById('netTxt').textContent`)).includes('請出'),'乙看到被請出');
  ok((await post('kick',{name:'沒有這個人'})).code===400,'踢不在線上的人：錯誤訊息');
  // 玩家假冒後台查詢：不會怎樣
  await a2.g(`net({t:'adm',q:1,c:'info'});net({t:'admr',q:1,d:{}})`);await sleep(300);
  ok((await get('status')).running,'玩家假冒 adm/admr：世界照常');
  // 世界：開新世界、切回來
  await a2.g(`inv={木頭:42};writeSave()`);await sleep(9000);
  const seed1=(await get('worlds')).current.seed;
  ok((await post('newWorld')).code===200,'開新世界');s=await waitRun();
  let w=await get('worlds');ok(w.current.seed!==seed1&&w.archived.length===1&&w.archived[0].seed===seed1,'新世界種子不同，舊世界封存了',[seed1,w.current&&w.current.seed]);
  await sleep(2500);const a3=await mpGame(br,PORT,'甲','9999');
  ok(!(await a3.g(`inv['木頭']`)),'新世界：甲的背包是空的');
  ok((await post('switchWorld',{file:w.archived[0].file})).code===200,'切換回舊世界');await waitRun();await sleep(2500);
  w=await get('worlds');ok(w.current.seed===seed1&&w.archived.length===1,'舊世界回來了，剛剛的新世界被封存');
  const a4=await mpGame(br,PORT,'甲','9999');
  ok(await a4.g(`inv['木頭']`)===42,'切回舊世界：甲的背包回來了（木頭 42）');
  ok((await post('switchWorld',{file:'../accounts.json'})).code===400,'奇怪的檔名：拒絕');
  ok((await post('deleteWorld',{file:w.archived[0].file})).code===200&&(await get('worlds')).archived.length===0,'刪除封存的世界');
  // 備份還原
  const bk=dir+'/saves/backups/20260101';fs.mkdirSync(bk+'/players',{recursive:true});
  const wj=JSON.parse(fs.readFileSync(dir+'/saves/world.json','utf8'));wj.day=77;fs.writeFileSync(bk+'/world.json',JSON.stringify(wj));
  w=await get('worlds');ok(w.backups.some(x=>x.name==='20260101'&&x.world.day===77),'備份列表看得到 1/1 的備份（第 77 天）');
  ok((await post('restoreBackup',{name:'20260101'})).code===200,'還原備份');s=await waitRun();
  ok(s.world.day===77,'還原後是第 77 天',s.world.day);
  ok(fs.readdirSync(dir+'/saves/backups').some(f=>f.startsWith('restore-')),'還原前自動備份了一份');
  ok((await fetch(`${B}/api/admin/download?f=world.json`)).headers.get('content-disposition').includes('attachment'),'下載世界存檔');
  // 刪除帳號
  ok((await post('deleteAccount',{name:'乙'})).code===200&&!(await get('accounts')).list.some(x=>x.name==='乙'),'刪除乙的帳號');
  // 後台畫面
  const ad=await openPage(br,`${B}/admin`);await sleep(1200);await ad.shot(HERE+'/t17-home.png');
  await ad.clickSel('[data-p="worlds"]');await sleep(800);await ad.shot(HERE+'/t17-worlds.png');
  await ad.clickSel('[data-p="accts"]');await sleep(800);await ad.shot(HERE+'/t17-accts.png');
  // 兩段式確認
  await ad.clickSel('[data-pin="甲"]');await sleep(100);
  ok((await ad.ev(`document.querySelector('[data-pin="甲"]').textContent`))==='再按一次確認','危險操作要按兩次');
  console.log('admin logs',ad.logs,'server errors',sv.out.match(/錯誤|出錯|失敗/g));
}finally{br.close();sv&&sv.close()}
