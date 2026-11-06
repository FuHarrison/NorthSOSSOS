// 北境求生 多人主機：提供遊戲網頁、WebSocket 轉發、存檔，並且自己跑世界。不需要 npm install。
// 用法：node server.js [port] [--open]
// 世界由 server 模擬（startSim），瀏覽器分頁全部是玩家；主機那台電腦的分頁也一樣，關掉不影響世界。
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os'),vm=require('vm');
const PORT=+process.argv.slice(2).find(a=>/^\d+$/.test(a))||8080;
const FILE=path.join(__dirname,'北境求生.html');

const server=http.createServer((req,res)=>{
  const u=req.url.split('?')[0];
  if(u!=='/'&&u!=='/index.html'){res.writeHead(404);res.end();return}
  fs.readFile(FILE,(e,d)=>{
    if(e){res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('找不到 北境求生.html，請把它跟 server.js 放在同一個資料夾');return}
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
const playerFile=(seed,n)=>path.join(PLAYER_DIR,`${seed}-${n.replace(/[\\/:*?"<>|%\x00-\x1f]/g,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0'))}.json`);
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
  wsave(p,m){if(p!==host||!m.d||typeof m.d!=='object')return;storeSave(WORLD_FILE,m.d);if(m.ack)send(p,{t:'saved',k:'w'})},
  // 「新世界」：只有主機那台電腦的分頁可以按。停掉世界（不存檔）→ 舊世界改名留著 → 重新開一個世界
  wipe(p){if(!p.local||p.sim)return;
    stopSim(false);
    if(fs.existsSync(WORLD_FILE)){const ts=new Date().toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,15);fs.renameSync(WORLD_FILE,path.join(SAVE_DIR,`world-${ts}.json`))}
    fs.rmSync(WORLD_FILE+'.bak',{force:true});console.log('開了新世界，舊世界已改名保留');send(p,{t:'wiped'});startSim()}};

/* ---------- 世界模擬：server 自己跑世界 ---------- */
// 在 Node 裡執行北境求生.html 裡的同一份遊戲程式，當成主機（MODE='host'）：怪物、資源、熔爐、Boss、日夜和存世界都照原本主機分頁的邏輯，只是不畫畫面。
// 遊戲程式以為自己在瀏覽器裡：DOM、畫布、Path2D 都換成什麼都不做的替身，WebSocket 換成直接接到下面的轉發。
const SIM_FPS=30;
let sim=null;
function noop(){}
const stub=new Proxy(noop,{get:(t,k)=>k===Symbol.toPrimitive?()=>'':k===Symbol.iterator?function*(){}:stub,set:()=>true,apply:()=>stub,construct:()=>stub});
function memStore(init){const d=new Map(Object.entries(init));return{getItem:k=>d.has(k)?d.get(k):null,setItem:(k,v)=>{d.set(k,String(v))},removeItem:k=>{d.delete(k)}}}
function startSim(){
  const code=(fs.readFileSync(FILE,'utf8').match(/\n<script>\r?\n([\s\S]*?)\r?\n<\/script>/)||[])[1];
  if(!code){console.error('北境求生.html 裡找不到遊戲程式，世界沒有啟動');return}
  const world=loadSave(WORLD_FILE),me={alive:true,hidden:false,vis:[],errs:0};
  // 給遊戲程式的訊息延後一拍送，免得在它自己送訊息的途中又被叫進去
  me.peer={id:++nextId,sim:true,local:false,addr:'server',push:s=>setImmediate(()=>{if(me.alive&&me.ws&&me.ws.onmessage)me.ws.onmessage({data:s})})};
  class FakeSocket{constructor(){this.readyState=1;me.ws=this;setImmediate(()=>{if(me.alive)onOpen(me.peer)})}send(s){if(me.alive)onMsg(me.peer,s)}close(){}}
  // 每秒 30 次；某一幀出錯就記下來、下一幀照跑，世界不會因為一個錯誤整個停住
  const raf=cb=>{setTimeout(()=>{if(!me.alive)return;try{cb(performance.now())}catch(e){if(me.errs++%300===0)console.error('世界模擬出錯：',e);raf(cb)}},1000/SIM_FPS)};
  const g={__NORTH_HEADLESS__:true,console,setTimeout,clearTimeout,performance,btoa,atob,
    document:{getElementById:()=>stub,createElement:()=>stub,querySelector:()=>null,querySelectorAll:()=>[],elementFromPoint:()=>null,body:stub,
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
  m.from=p.id;const out=JSON.stringify(m);
  if(m.all){for(const q of peers.values())if(q!==p)send(q,out)}
  else if(p===host){if(m.to){const q=peers.get(m.to);if(q)send(q,out)}else for(const q of peers.values())if(q!==p)send(q,out)}
  else if(host)send(host,out)}
function onClose(p){if(!peers.delete(p.id))return;
  if(p===host){host=null;console.log('世界停止');for(const q of peers.values())send(q,{t:'nohost'})}
  else{console.log(`玩家 #${p.id} 離線`);for(const q of peers.values())send(q,{t:'leave',id:p.id})}}

// 關掉黑色視窗（Windows 送 SIGHUP）或按 Ctrl+C：先把世界存起來再結束
let closing=false;
function shutdown(){if(closing)return;closing=true;stopSim(true);console.log('世界已存檔，伺服器關閉');process.exit(0)}
for(const sig of['SIGINT','SIGTERM','SIGHUP','SIGBREAK'])process.on(sig,shutdown);

server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`埠 ${PORT} 已被占用，換一個：node server.js 8081`:e.message);process.exit(1)});
startSim();
server.listen(PORT,'0.0.0.0',()=>{
  console.log(`\n北境求生 主機已啟動（埠 ${PORT}）`);
  console.log(`主機這台：在瀏覽器開 http://localhost:${PORT}`);
  for(const ip of lanIps())console.log(`同事：在瀏覽器開 http://${ip}:${PORT}`);
  console.log('關掉這個視窗就會關閉伺服器。\n');
  if(process.argv.includes('--open')&&process.platform==='win32')require('child_process').exec(`start "" http://localhost:${PORT}`);
});
