// 北境求生 多人主機：提供遊戲網頁 + WebSocket 轉發。不需要 npm install。
// 用法：node server.js [port] [--open]
// 第一個從本機（localhost）連進來的分頁是主機，負責模擬整個世界；其他人是玩家。
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os');
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
  // 主機的連線就是整個世界，不能被踢；同名的人換個名字
  if(host&&host!==p&&host.name===n)return fail('主機正在用這個名字，請換一個');
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
  wipe(p){if(p!==host)return;   // 「新世界」：舊世界改名留著，不刪
    if(fs.existsSync(WORLD_FILE)){const ts=new Date().toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,15);fs.renameSync(WORLD_FILE,path.join(SAVE_DIR,`world-${ts}.json`))}
    fs.rmSync(WORLD_FILE+'.bak',{force:true});console.log('主機開了新世界，舊世界已改名保留');send(p,{t:'wiped'})}};

/* ---------- minimal WebSocket (RFC 6455, text frames) ---------- */
function frame(data,op=1){const len=data.length;let h;
  if(len<126)h=Buffer.from([0x80|op,len]);
  else if(len<65536){h=Buffer.alloc(4);h[0]=0x80|op;h[1]=126;h.writeUInt16BE(len,2)}
  else{h=Buffer.alloc(10);h[0]=0x80|op;h[1]=127;h.writeBigUInt64BE(BigInt(len),2)}
  return Buffer.concat([h,data])}
function send(p,obj){if(!p.sock.destroyed)p.sock.write(frame(Buffer.from(typeof obj==='string'?obj:JSON.stringify(obj))))}
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
  const p={id:++nextId,sock,buf:Buffer.alloc(0),frag:[],local:isLoopback(req.socket.remoteAddress),addr:req.socket.remoteAddress};
  sock.on('data',d=>{p.buf=Buffer.concat([p.buf,d]);parse(p)});
  sock.on('close',()=>onClose(p));sock.on('error',()=>{});
  onOpen(p);
});
function onOpen(p){peers.set(p.id,p);
  if(!host&&p.local)host=p;
  send(p,{t:'hello',id:p.id,role:host===p?'host':'client',hostReady:!!host,ips:lanIps(),port:PORT,world:host===p?loadSave(WORLD_FILE):undefined});
  if(host===p){console.log('主機已開啟世界');for(const q of peers.values())if(q!==p)send(q,{t:'host'})}
  else{console.log(`玩家 #${p.id} 連線（${p.addr}）`);if(host)send(host,{t:'peer',id:p.id})}}
function onMsg(p,s){let m;try{m=JSON.parse(s)}catch(e){return}
  if(m&&Object.hasOwn(SRV,m.t)){try{SRV[m.t](p,m)}catch(e){console.error('存檔出錯：',e.message)}return}
  m.from=p.id;const out=JSON.stringify(m);
  if(m.all){for(const q of peers.values())if(q!==p)send(q,out)}
  else if(p===host){if(m.to){const q=peers.get(m.to);if(q)send(q,out)}else for(const q of peers.values())if(q!==p)send(q,out)}
  else if(host)send(host,out)}
function onClose(p){if(!peers.delete(p.id))return;
  if(p===host){host=null;console.log('主機離線');for(const q of peers.values())send(q,{t:'nohost'})}
  else{console.log(`玩家 #${p.id} 離線`);for(const q of peers.values())send(q,{t:'leave',id:p.id})}}

server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`埠 ${PORT} 已被占用，換一個：node server.js 8081`:e.message);process.exit(1)});
server.listen(PORT,'0.0.0.0',()=>{
  console.log(`\n北境求生 主機已啟動（埠 ${PORT}）`);
  console.log(`主機這台：在瀏覽器開 http://localhost:${PORT}`);
  for(const ip of lanIps())console.log(`同事：在瀏覽器開 http://${ip}:${PORT}`);
  console.log('關掉這個視窗就會關閉伺服器。\n');
  if(process.argv.includes('--open')&&process.platform==='win32')require('child_process').exec(`start "" http://localhost:${PORT}`);
});
