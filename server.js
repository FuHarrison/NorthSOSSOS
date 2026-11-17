// 北境求生 多人主機：提供遊戲網頁、WebSocket 轉發、存檔，並且自己跑世界。不需要 npm install。
// 用法：node server.js [port] [--open]
// 世界由 server 模擬（startSim），瀏覽器分頁全部是玩家；主機那台電腦的分頁也一樣，關掉不影響世界。
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os'),vm=require('vm');
const PORT=+process.argv.slice(2).find(a=>/^\d+$/.test(a))||8080;
const FILE=path.join(__dirname,'北境求生.html'),ADMIN_FILE=path.join(__dirname,'admin.html');
const T0=Date.now();

const server=http.createServer((req,res)=>{
  const u=req.url.split('?')[0];
  if(u==='/admin'||u.startsWith('/api/admin/')){admin(req,res,u);return}
  if(u!=='/'&&u!=='/index.html'){res.writeHead(404);res.end();return}
  fs.readFile(FILE,'utf8',(e,d)=>{
    if(e){res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('找不到 北境求生.html，請把它跟 server.js 放在同一個資料夾');return}
    // 先告訴網頁現在世界的地圖大小，遊戲一開始就用對的大小，不用發現不對再重新載入
    if(mapW)d=d.replace(/\r?\n<script>\r?\n/,s=>`\n<script>window.__NORTH_MAPW=${mapW}</script>`+s);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(d)});
});

/* ---------- saves：多人存檔全部存在這台電腦的 saves/ 資料夾 ---------- */
// world.json：世界（主機存）。accounts.json：每個名字的 PIN 與記住登入的記號（都是雜湊）。
// players/<seed>-<名字>.json：每個人在那個世界的背包、寵物、地圖。
const SAVE_DIR=path.join(__dirname,'saves'),PLAYER_DIR=path.join(SAVE_DIR,'players');
const WORLD_FILE=path.join(SAVE_DIR,'world.json'),ACCT_FILE=path.join(SAVE_DIR,'accounts.json');
fs.mkdirSync(PLAYER_DIR,{recursive:true});
// 每次都從檔案讀（不快取），所以人離線時手動改檔，下次上線就會讀到；主檔壞了就退回 .bak
function loadSave(file){for(const f of[file,file+'.bak']){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){}}return null}
// 先寫暫存檔再改名，寫到一半當機也不會壞；覆蓋前把舊的留一份 .bak
function storeSave(file,data){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));
  if(fs.existsSync(file))fs.copyFileSync(file,file+'.bak');fs.renameSync(tmp,file)}
// 名字裡不能當檔名的字元換成 %xx，其他（含中文）照原樣，檔名才看得懂
const encName=n=>n.replace(/[\\/:*?"<>|%\x00-\x1f]/g,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0'));
const playerFile=(seed,n)=>path.join(PLAYER_DIR,`${seed}-${encName(n)}.json`);
// 本地時間的 YYYYMMDD-HHMMSS（檔名用）
const stamp=(d=new Date())=>{const p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`};
// 每天備份一次到 saves/backups/<日期>/（世界、帳號、所有玩家），只留最近 7 天
const BACKUP_DIR=path.join(SAVE_DIR,'backups'),BACKUP_KEEP=7;
// 把現在的世界、帳號、所有玩家存檔整份複製到 dir
function snapshot(dir){fs.mkdirSync(path.join(dir,'players'),{recursive:true});
  for(const f of[WORLD_FILE,ACCT_FILE])if(fs.existsSync(f))fs.copyFileSync(f,path.join(dir,path.basename(f)));
  for(const f of fs.readdirSync(PLAYER_DIR))if(f.endsWith('.json'))fs.copyFileSync(path.join(PLAYER_DIR,f),path.join(dir,'players',f))}
function dailyBackup(){try{
  const dir=path.join(BACKUP_DIR,stamp().slice(0,8));if(fs.existsSync(dir))return;
  snapshot(dir);
  const old=fs.readdirSync(BACKUP_DIR).filter(f=>/^\d{8}$/.test(f)).sort().slice(0,-BACKUP_KEEP);
  for(const f of old)fs.rmSync(path.join(BACKUP_DIR,f),{recursive:true,force:true});
  console.log(`已備份存檔到 saves/backups/${path.basename(dir)}`)}catch(e){console.error('備份失敗：',e.message)}}
const hashPin=(pin,salt)=>crypto.scryptSync(pin,salt,32).toString('hex');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const fails=new Map(); // 名字 → {n: 連續錯幾次, until: 鎖到什麼時候}

function login(p,m){
  const fail=msg=>send(p,{t:'login',ok:0,msg});
  const n=typeof m.n==='string'?m.n.trim().slice(0,10):'',pin=typeof m.pin==='string'?m.pin:'',tok=typeof m.tok==='string'?m.tok:'';
  if(!n)return fail('請輸入名字');
  if(!Number.isInteger(m.seed))return fail('世界還沒準備好，請重新整理');
  const f=fails.get(n)||{n:0,until:0};
  const accts=loadSave(ACCT_FILE)||{};let a=accts[n],newTok=null;
  if(a&&a.pin){
    // 這台電腦沒記住 → 要 PIN。鎖定只擋輸入 PIN，所以別人亂猜鎖不到本人已記住的電腦
    if(!(tok&&(a.tokens||[]).includes(sha(tok)))){
      if(f.until>Date.now())return fail(`PIN 錯太多次，請 ${Math.ceil((f.until-Date.now())/1000)} 秒後再試`);
      if(!pin)return fail('這個名字已經有人用了。是你的話請輸入 PIN，不是的話請換一個名字。');
      const[salt,h]=a.pin.split(':');
      if(hashPin(pin,salt)!==h){if(++f.n>=5){f.n=0;f.until=Date.now()+60000}fails.set(n,f);return fail('PIN 不對。如果這個名字不是你的，代表已經有人用了，請換一個名字。')}
      newTok=crypto.randomBytes(16).toString('hex')}
  }else{                                                 // 新名字（或主機刪掉了 pin）→ 用這組 PIN 註冊
    if(!/^\d{4,8}$/.test(pin))return fail('第一次用這個名字，請設定 4～8 位數字的 PIN');
    const salt=crypto.randomBytes(8).toString('hex');a=accts[n]={pin:salt+':'+hashPin(pin,salt)};
    newTok=crypto.randomBytes(16).toString('hex')}
  fails.delete(n);
  if(newTok){a.tokens=[...(a.tokens||[]),sha(newTok)].slice(-5);storeSave(ACCT_FILE,accts)}
  // 同一個名字只能有一個連線：驗證過的新登入把舊的踢掉（舊分頁可能只是沒關乾淨）
  for(const q of peers.values())if(q!==p&&q.name===n){send(q,{t:'kicked'});q.name=null;q.sock.end()}
  p.name=n;p.seed=m.seed;console.log(`${n} 登入（玩家 #${p.id}）`);
  send(p,{t:'login',ok:1,n,tok:newTok||tok,d:loadSave(playerFile(m.seed,n))})}

// 這些訊息由 server 自己處理，不轉發
const SRV={
  login,
  psave(p,m){if(!p.name||!m.d||typeof m.d!=='object')return;storeSave(playerFile(p.seed,p.name),m.d);if(m.ack)send(p,{t:'saved',k:'p'})},
  wsave(p,m){if(p!==host||!m.d||typeof m.d!=='object')return;storeSave(WORLD_FILE,m.d);mapW=m.d.mapW||mapW;if(m.ack)send(p,{t:'saved',k:'w'})},
  // 「新世界」：只有主機那台電腦的分頁可以按。停掉世界（不存檔）→ 舊世界改名留著 → 重新開一個世界
  wipe(p){if(!p.local||p.sim)return;
    stopSim(false);archiveWorld();console.log('開了新世界，舊世界已改名保留');send(p,{t:'wiped'});startSim()},
  // 世界回覆後台的查詢（只收主機的）
  admr(p,m){if(p!==host)return;const r=admWait.get(m.q);if(r){admWait.delete(m.q);r(m.d)}}};
// 目前的世界改名成 world-<時間>.json 留著（沒有就算了）
function archiveWorld(){if(fs.existsSync(WORLD_FILE))fs.renameSync(WORLD_FILE,path.join(SAVE_DIR,`world-${stamp()}.json`));fs.rmSync(WORLD_FILE+'.bak',{force:true})}

/* ---------- 世界模擬：server 自己跑世界 ---------- */
// 在 Node 裡執行北境求生.html 裡的同一份遊戲程式，當成主機（MODE='host'）：怪物、資源、熔爐、Boss、日夜和存世界都照原本主機分頁的邏輯，只是不畫畫面。
// 遊戲程式以為自己在瀏覽器裡：DOM、畫布、Path2D 都換成什麼都不做的替身，WebSocket 換成直接接到下面的轉發。
const SIM_FPS=30;
let sim=null,mapW=0; // mapW：現在世界的地圖大小（送網頁時告訴瀏覽器）；新世界第一次存檔前是 0
function noop(){}
const stub=new Proxy(noop,{get:(t,k)=>k===Symbol.toPrimitive?()=>'':k===Symbol.iterator?function*(){}:stub,set:()=>true,apply:()=>stub,construct:()=>stub});
function memStore(init){const d=new Map(Object.entries(init));return{getItem:k=>d.has(k)?d.get(k):null,setItem:(k,v)=>{d.set(k,String(v))},removeItem:k=>{d.delete(k)}}}
function startSim(){
  const code=(fs.readFileSync(FILE,'utf8').match(/\n<script>\r?\n([\s\S]*?)\r?\n<\/script>/)||[])[1];
  if(!code){console.error('北境求生.html 裡找不到遊戲程式，世界沒有啟動');return}
  const world=loadSave(WORLD_FILE),me={alive:true,hidden:false,vis:[],errs:0};
  mapW=world?world.mapW||0:0;
  // 給遊戲程式的訊息延後一拍送，免得在它自己送訊息的途中又被叫進去
  me.peer={id:++nextId,sim:true,local:false,addr:'server',push:s=>setImmediate(()=>{if(me.alive&&me.ws&&me.ws.onmessage)me.ws.onmessage({data:s})})};
  class FakeSocket{constructor(){this.readyState=1;me.ws=this;setImmediate(()=>{if(me.alive)onOpen(me.peer)})}send(s){if(me.alive)onMsg(me.peer,s)}close(){}}
  // 每秒 30 次；某一幀出錯就記下來、下一幀照跑，世界不會因為一個錯誤整個停住
  const raf=cb=>{setTimeout(()=>{if(!me.alive)return;try{cb(performance.now())}catch(e){if(me.errs++%300===0)console.error('世界模擬出錯：',e);raf(cb)}},1000/SIM_FPS)};
  const g={__NORTH_HEADLESS__:true,console,setTimeout,clearTimeout,performance,btoa,atob,
    document:{getElementById:()=>stub,createElement:()=>stub,querySelector:()=>null,querySelectorAll:()=>[],elementFromPoint:()=>null,body:stub,documentElement:stub,
      addEventListener:(t,f)=>{if(t==='visibilitychange')me.vis.push(f)},get hidden(){return me.hidden}},
    addEventListener:noop,matchMedia:()=>({matches:false}),innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    // 遊戲程式一開始從 localStorage 的世界存檔決定地圖大小，所以把 world.json 放進去
    localStorage:memStore(world?{'northland-mp-world-v1':JSON.stringify(world)}:{}),sessionStorage:memStore({}),
    location:{protocol:'http:',host:'server',href:'http://server/',reload:()=>{stopSim(false);startSim()}},
    WebSocket:FakeSocket,fetch:()=>Promise.reject(new Error('offline')),requestAnimationFrame:raf,Path2D:stub,confirm:()=>false};
  g.window=g;sim=me;
  try{vm.runInNewContext(code,g,{filename:'北境求生.html'})}catch(e){console.error('世界啟動失敗：',e);me.alive=false;sim=null}}
// save：跟瀏覽器切走分頁一樣觸發遊戲自己的存檔（同步寫進 world.json），再停掉
function stopSim(save){if(!sim)return;const me=sim;sim=null;
  if(save){me.hidden=true;for(const f of me.vis)try{f()}catch(e){console.error('存世界失敗：',e)}}
  me.alive=false;onClose(me.peer)}

/* ---------- minimal WebSocket (RFC 6455, text frames) ---------- */
function frame(data,op=1){const len=data.length;let h;
  if(len<126)h=Buffer.from([0x80|op,len]);
  else if(len<65536){h=Buffer.alloc(4);h[0]=0x80|op;h[1]=126;h.writeUInt16BE(len,2)}
  else{h=Buffer.alloc(10);h[0]=0x80|op;h[1]=127;h.writeBigUInt64BE(BigInt(len),2)}
  return Buffer.concat([h,data])}
function send(p,obj){p.push(typeof obj==='string'?obj:JSON.stringify(obj))}
function parse(p){
  for(;;){const b=p.buf;if(b.length<2)return;
    const fin=b[0]&0x80,op=b[0]&0x0f,masked=b[1]&0x80;let len=b[1]&0x7f,off=2;
    if(len===126){if(b.length<4)return;len=b.readUInt16BE(2);off=4}
    else if(len===127){if(b.length<10)return;len=Number(b.readBigUInt64BE(2));off=10}
    const mOff=off;if(masked)off+=4;if(b.length<off+len)return;
    let data=Buffer.from(b.subarray(off,off+len));
    if(masked){for(let i=0;i<data.length;i++)data[i]^=b[mOff+(i&3)]}
    p.buf=b.subarray(off+len);
    if(op===8){p.sock.end(frame(Buffer.alloc(0),8));return}
    if(op===9){p.sock.write(frame(data,10));continue}
    if(op===10)continue;
    p.frag.push(data);
    if(fin){const s=Buffer.concat(p.frag).toString('utf8');p.frag=[];onMsg(p,s)}
  }}

/* ---------- routing ---------- */
const peers=new Map();let host=null,nextId=0;
const isLoopback=a=>a==='127.0.0.1'||a==='::1'||a==='::ffff:127.0.0.1';
function lanIps(){const r=[];for(const list of Object.values(os.networkInterfaces()))for(const n of list||[])if(n.family==='IPv4'&&!n.internal)r.push(n.address);return r}

server.on('upgrade',(req,sock)=>{
  if(req.url!=='/ws'||(req.headers.upgrade||'').toLowerCase()!=='websocket'||!req.headers['sec-websocket-key']){sock.destroy();return}
  const acc=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+acc+'\r\n\r\n');
  sock.setNoDelay(true);
  const p={id:++nextId,sock,buf:Buffer.alloc(0),frag:[],local:isLoopback(req.socket.remoteAddress),addr:req.socket.remoteAddress,
    push:s=>{if(!sock.destroyed)sock.write(frame(Buffer.from(s)))}};
  sock.on('data',d=>{p.buf=Buffer.concat([p.buf,d]);parse(p)});
  sock.on('close',()=>onClose(p));sock.on('error',()=>{});
  onOpen(p);
});
// 主機只會是 server 自己跑的世界（p.sim）；local 告訴分頁它在主機那台電腦上（顯示給同事的網址、可以開新世界）
function onOpen(p){peers.set(p.id,p);
  if(p.sim)host=p;
  send(p,{t:'hello',id:p.id,role:p.sim?'host':'client',hostReady:!!host,local:p.local,ips:lanIps(),port:PORT,world:p.sim?loadSave(WORLD_FILE):undefined});
  if(host===p){console.log('世界開始運作');for(const q of peers.values())if(q!==p)send(q,{t:'host'})}
  else{console.log(`玩家 #${p.id} 連線（${p.addr}）`);if(host)send(host,{t:'peer',id:p.id})}}
function onMsg(p,s){let m;try{m=JSON.parse(s)}catch(e){return}
  if(m&&Object.hasOwn(SRV,m.t)){try{SRV[m.t](p,m)}catch(e){console.error('存檔出錯：',e.message)}return}
  if(!m||m.t==='adm'&&!p.sim)return; // 後台查詢只能由 server 自己送給世界
  m.from=p.id;const out=JSON.stringify(m);
  if(m.all){for(const q of peers.values())if(q!==p)send(q,out)}
  else if(p===host){if(m.to){const q=peers.get(m.to);if(q)send(q,out)}else for(const q of peers.values())if(q!==p)send(q,out)}
  else if(host)send(host,out)}
function onClose(p){if(!peers.delete(p.id))return;
  if(p===host){host=null;console.log('世界停止');for(const q of peers.values())send(q,{t:'nohost'})}
  else{console.log(`玩家 #${p.id} 離線`);for(const q of peers.values())send(q,{t:'leave',id:p.id})}}

/* ---------- 後台管理（/admin）：只限主機這台電腦 ---------- */
// 來源必須是本機、網址必須是 localhost；會改東西的請求必須帶 X-North-Admin 標頭（別的網頁不能偷送）
const localReq=req=>isLoopback(req.socket.remoteAddress)&&/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host||'');
const json=(res,code,o)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
const WORLD_RE=/^world(-\d{8}-\d{6})?\.json$/,BACKUP_RE=/^(\d{8}|restore-\d{8}-\d{6})$/,RESTORE_KEEP=5;
// 問正在跑的世界（天數、怪物等）：送 adm 給世界，等它回 admr；1 秒沒回就當沒有
let admSeq=0;const admWait=new Map();
function askSim(c,v,more){return new Promise(r=>{if(!host)return r(null);const q=++admSeq;admWait.set(q,r);send(host,Object.assign({t:'adm',q,c,v},more));setTimeout(()=>{if(admWait.delete(q))r(null)},1000)})}
function worldInfo(file){let st;try{st=fs.statSync(file)}catch(e){return null}const w=loadSave(file)||{};
  const n=w.seed==null?0:fs.readdirSync(PLAYER_DIR).filter(f=>f.startsWith(w.seed+'-')&&f.endsWith('.json')).length;
  return{file:path.basename(file),seed:w.seed??null,mapW:w.mapW||(w.seed==null?null:3200),day:w.day??null,size:st.size,mtime:st.mtimeMs,players:n}}
function backupInfo(name){const dir=path.join(BACKUP_DIR,name),w=worldInfo(path.join(dir,'world.json'));let n=0;try{n=fs.readdirSync(path.join(dir,'players')).filter(f=>f.endsWith('.json')).length}catch(e){}
  return{name,restore:name.startsWith('restore-'),world:w,players:n}}
function kick(name,why){let n=0;for(const q of peers.values())if(!q.sim&&q.name===name){send(q,{t:'kicked',why});q.name=null;q.sock.end();n++}return n}
const accounts=()=>loadSave(ACCT_FILE)||{};
function needWorldFile(f){if(typeof f!=='string'||!WORLD_RE.test(f)||f==='world.json'||!fs.existsSync(path.join(SAVE_DIR,f)))throw new Error('找不到這個封存的世界');return path.join(SAVE_DIR,f)}
function needAccount(n){const a=accounts();if(typeof n!=='string'||!Object.hasOwn(a,n))throw new Error('找不到這個帳號');return a}
const ADMIN_GET={
  // 世界數值與它們的範圍（向世界問）
  async cfg(){const d=await askSim('getCfg');if(!d)throw new Error('世界沒有在跑');return{cfg:d.cfg,def:d.cfgDef}},
  async status(){const online=[...peers.values()].filter(p=>!p.sim);
    return{uptime:Date.now()-T0,port:PORT,ips:lanIps(),running:!!host,world:await askSim('info'),saved:worldInfo(WORLD_FILE),
      online:online.map(p=>({id:p.id,name:p.name||null,addr:p.addr,local:p.local}))}},
  worlds(){const arch=fs.readdirSync(SAVE_DIR).filter(f=>WORLD_RE.test(f)&&f!=='world.json').sort().reverse().map(f=>worldInfo(path.join(SAVE_DIR,f))).filter(Boolean);
    const bk=fs.existsSync(BACKUP_DIR)?fs.readdirSync(BACKUP_DIR).filter(f=>BACKUP_RE.test(f)).sort((a,b)=>b.replace('restore-','')>a.replace('restore-','')?1:-1).map(backupInfo):[];
    return{current:worldInfo(WORLD_FILE),archived:arch,backups:bk}},
  accounts(){const a=accounts(),seed=(loadSave(WORLD_FILE)||{}).seed,files=fs.readdirSync(PLAYER_DIR).filter(f=>f.endsWith('.json'));
    return{seed:seed??null,list:Object.keys(a).sort().map(n=>{const pf=seed==null?null:playerFile(seed,n);let last=null;try{last=fs.statSync(pf).mtimeMs}catch(e){}
      return{name:n,pin:!!a[n].pin,devices:(a[n].tokens||[]).length,online:[...peers.values()].some(p=>!p.sim&&p.name===n),last,worlds:files.filter(f=>f.endsWith(`-${encName(n)}.json`)).length}})}},
  download(q,res){const f=q.get('f');let file;
    if(BACKUP_RE.test(q.get('b')||''))file=path.join(BACKUP_DIR,q.get('b'),'world.json');else if(WORLD_RE.test(f||''))file=path.join(SAVE_DIR,f);
    if(!file||!fs.existsSync(file)){json(res,404,{err:'找不到檔案'});return}
    const nm=q.get('b')?`world-backup-${q.get('b')}.json`:f;
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(nm)}`});fs.createReadStream(file).pipe(res)}};
const SIM_CMDS={pause:'暫停世界',resume:'繼續世界',time:'調整時間',clearMobs:'清除怪物',endBoss:'結束王戰',announce:'發公告'};
const ADMIN_POST={
  // 即時控制世界：交給 server 自己跑的世界去做，回傳世界現在的狀態
  // 世界數值：v 是要改的那幾項（世界會檢查範圍），reset 是全部恢復預設
  async cfg(m){if(!host)throw new Error('世界沒有在跑');const v=m.v&&typeof m.v==='object'&&!Array.isArray(m.v)?m.v:{};
    const d=await askSim('setCfg',undefined,{v,reset:!!m.reset});if(!d)throw new Error('世界沒有回應');if(d.err)throw new Error(d.err);
    console.log(`後台：${m.reset?'世界數值恢復預設':'調整世界數值 '+JSON.stringify(v)}`);return{ok:1,world:d}},
  async world(m){if(!Object.hasOwn(SIM_CMDS,m.c))throw new Error('沒有這個指令');if(!host)throw new Error('世界沒有在跑');
    const d=await askSim(m.c,typeof m.v==='string'?m.v.slice(0,60):undefined);if(!d)throw new Error('世界沒有回應');if(d.err)throw new Error(d.err);
    console.log(`後台：${SIM_CMDS[m.c]}${m.c==='announce'?`「${m.v}」`:m.c==='time'?` → ${m.v}`:''}`);return{ok:1,world:d}},
  // 開新世界：先存好現在的世界再封存（遊戲裡的「新世界」按鈕不存，最多少 8 秒）
  newWorld(){stopSim(true);archiveWorld();console.log('後台：開了新世界，舊世界已改名保留');startSim()},
  // 切換到封存的世界：現在的世界存好、封存，選的那個變成 world.json。玩家存檔跟著世界的種子走，不用搬
  switchWorld(m){const src=needWorldFile(m.file);stopSim(true);archiveWorld();fs.renameSync(src,WORLD_FILE);console.log(`後台：切換到 ${m.file}`);startSim()},
  deleteWorld(m){const src=needWorldFile(m.file);fs.rmSync(src);console.log(`後台：刪除 ${m.file}`)},
  // 還原備份：先把現在的整份存檔再備份到 restore-<時間>，然後換上備份的世界與玩家存檔（帳號不動）
  restoreBackup(m){if(typeof m.name!=='string'||!BACKUP_RE.test(m.name))throw new Error('找不到這個備份');const dir=path.join(BACKUP_DIR,m.name);
    if(!fs.existsSync(path.join(dir,'world.json')))throw new Error('這個備份裡沒有世界');
    stopSim(true);snapshot(path.join(BACKUP_DIR,`restore-${stamp()}`));
    fs.copyFileSync(path.join(dir,'world.json'),WORLD_FILE);fs.rmSync(WORLD_FILE+'.bak',{force:true});
    const pd=path.join(dir,'players');if(fs.existsSync(pd))for(const f of fs.readdirSync(pd))if(f.endsWith('.json'))fs.copyFileSync(path.join(pd,f),path.join(PLAYER_DIR,f));
    const old=fs.readdirSync(BACKUP_DIR).filter(f=>f.startsWith('restore-')).sort().slice(0,-RESTORE_KEEP);for(const f of old)fs.rmSync(path.join(BACKUP_DIR,f),{recursive:true,force:true});
    console.log(`後台：還原備份 ${m.name}（還原前的存檔在 restore-…）`);startSim()},
  // 重設 PIN：拿掉 PIN 和記住的裝置，那個名字下次登入時輸入的 PIN 就是新的
  resetPin(m){const a=needAccount(m.name);delete a[m.name].pin;a[m.name].tokens=[];storeSave(ACCT_FILE,a);kick(m.name,'主機重設了你的 PIN，請重新整理，用新的 PIN 登入。');console.log(`後台：重設 ${m.name} 的 PIN`)},
  kick(m){if(!kick(String(m.name||''),'你被主機請出了遊戲。'))throw new Error('這個人不在線上')},
  // 刪除帳號：名字空出來給別人用；他在各世界的背包存檔留著
  deleteAccount(m){const a=needAccount(m.name);delete a[m.name];storeSave(ACCT_FILE,a);kick(m.name,'主機刪除了你的帳號。');console.log(`後台：刪除帳號 ${m.name}`)}};
function admin(req,res,u){
  if(!localReq(req)){res.writeHead(403,{'Content-Type':'text/plain; charset=utf-8'});res.end('後台只能在主機這台電腦，用 http://localhost 打開。');return}
  if(u==='/admin'){fs.readFile(ADMIN_FILE,(e,d)=>{if(e){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('找不到 admin.html');return}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(d)});return}
  const name=u.slice('/api/admin/'.length),q=new URL(req.url,'http://localhost').searchParams;
  if(req.method==='GET'){if(!Object.hasOwn(ADMIN_GET,name))return json(res,404,{err:'沒有這個功能'});
    Promise.resolve().then(()=>ADMIN_GET[name](q,res)).then(o=>{if(o!==undefined)json(res,200,o)},e=>json(res,500,{err:e.message}));return}
  if(req.method!=='POST'||req.headers['x-north-admin']!=='1')return json(res,403,{err:'拒絕'});
  if(!Object.hasOwn(ADMIN_POST,name))return json(res,404,{err:'沒有這個功能'});
  let body='';req.on('data',d=>{body+=d;if(body.length>1e5)req.destroy()});
  req.on('end',()=>{let m;try{m=JSON.parse(body||'{}')}catch(e){return json(res,400,{err:'格式錯誤'})}
    Promise.resolve().then(()=>ADMIN_POST[name](m)).then(o=>json(res,200,o||{ok:1}),e=>json(res,400,{err:e.message}))})}

// 關掉黑色視窗（Windows 送 SIGHUP）或按 Ctrl+C：先把世界存起來再結束
let closing=false;
function shutdown(){if(closing)return;closing=true;stopSim(true);console.log('世界已存檔，伺服器關閉');process.exit(0)}
for(const sig of['SIGINT','SIGTERM','SIGHUP','SIGBREAK'])process.on(sig,shutdown);

server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`埠 ${PORT} 已被占用，換一個：node server.js 8081`:e.message);process.exit(1)});
startSim();
dailyBackup();setInterval(dailyBackup,60*60*1000); // 每小時檢查一次，換日後的第一次就備份
server.listen(PORT,'0.0.0.0',()=>{
  console.log(`\n北境求生 主機已啟動（埠 ${PORT}）`);
  console.log(`主機這台：在瀏覽器開 http://localhost:${PORT}`);
  console.log(`後台管理：http://localhost:${PORT}/admin（只有這台電腦打得開）`);
  for(const ip of lanIps())console.log(`同事：在瀏覽器開 http://${ip}:${PORT}`);
  console.log('關掉這個視窗就會關閉伺服器。\n');
  if(process.argv.includes('--open')&&process.platform==='win32')require('child_process').exec(`start "" http://localhost:${PORT}`);
});
