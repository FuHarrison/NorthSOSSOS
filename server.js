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
  send(p,{t:'hello',id:p.id,role:host===p?'host':'client',hostReady:!!host,ips:lanIps(),port:PORT});
  if(host===p){console.log('主機已開啟世界');for(const q of peers.values())if(q!==p)send(q,{t:'host'})}
  else{console.log(`玩家 #${p.id} 連線（${p.addr}）`);if(host)send(host,{t:'peer',id:p.id})}}
function onMsg(p,s){let m;try{m=JSON.parse(s)}catch(e){return}
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
