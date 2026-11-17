// 測試工具：用無頭 Chrome（或 Edge）開遊戲的測試用副本，按鍵、點滑鼠、截圖，並透過 __dbg 讀遊戲內部狀態。
// 不需要 npm install：只用 Node 內建的 fetch / WebSocket（Node 22 以上）。
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const LIB=path.dirname(fileURLToPath(import.meta.url));
export const REPO=process.env.REPO||path.resolve(LIB,'..','..');
// 測試的暫存資料夾（遊戲副本、測試用存檔、截圖），不進 git
export const TMP=path.join(REPO,'tests','.tmp');export const HERE=TMP;
fs.mkdirSync(TMP,{recursive:true});
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const BROWSERS=[process.env.CHROME,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean);

// 測試用副本：複製遊戲檔案，再讓測試讀得到遊戲的變數（__dbg 在遊戲的作用域裡 eval）
// - 遊戲拆成多個 <script src> 時：頂層的 let/const 本來就共用，最後多加一個 <script> 就好
// - 遊戲還是單一 IIFE 時：把 __dbg 塞進 IIFE 結尾前
const SKIP=new Set(['.git','tests','saves','dist','node_modules','docs']);
export function buildTestCopy(dir){
  fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  for(const f of fs.readdirSync(REPO))if(!SKIP.has(f)&&!f.startsWith('.'))fs.cpSync(path.join(REPO,f),path.join(dir,f),{recursive:true});
  const html=path.join(dir,'北境求生.html');let src=fs.readFileSync(html,'utf8');
  if(/<script src=/.test(src))src=src.replace(/(<\/body>|$)/i,'<script>globalThis.__dbg=s=>eval(s)</script>\n$1');
  else{const i=src.lastIndexOf('})();');src=src.slice(0,i)+'globalThis.__dbg=s=>eval(s);\n'+src.slice(i)}
  fs.writeFileSync(html,src);return html}

export async function launch(port=9333){
  const exe=BROWSERS.find(p=>fs.existsSync(p));if(!exe)throw new Error('找不到 Chrome 或 Edge；用 CHROME 環境變數指定路徑');
  const ud=fs.mkdtempSync(path.join(os.tmpdir(),'nchrome-'));
  const p=spawn(exe,['--headless=new',`--remote-debugging-port=${port}`,`--user-data-dir=${ud}`,'--window-size=1280,800','--no-first-run','--disable-gpu','about:blank'],{stdio:'ignore'});
  for(let k=0;k<50;k++){try{const r=await fetch(`http://127.0.0.1:${port}/json/version`);if(r.ok)break}catch(e){}await sleep(200)}
  return {proc:p,port,close(){try{p.kill()}catch(e){}}};
}

export async function openPage(br,url){
  const r=await fetch(`http://127.0.0.1:${br.port}/json/new?${encodeURIComponent(url)}`,{method:'PUT'});
  const t=await r.json();
  const ws=new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(res=>ws.onopen=res);
  let id=0;const pend=new Map(),logs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}
    else if(m.method==='Runtime.exceptionThrown')logs.push('EXC '+(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));
    else if(m.method==='Runtime.consoleAPICalled'&&(m.params.type==='error'||m.params.type==='warning'))logs.push(m.params.type+' '+m.params.args.map(a=>a.value??a.description).join(' '))};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}))});
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  const pg={
    logs,send,
    async ev(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
      if(r.result.exceptionDetails)throw new Error('eval: '+(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)+'\n  in: '+expr.slice(0,200));
      return r.result.result.value},
    // 在遊戲的作用域裡跑程式碼
    async g(code){return pg.ev(`__dbg(${JSON.stringify(code)})`)},
    async key(code,key){const k=key||(/^Key/.test(code)?code.slice(3).toLowerCase():/^Digit/.test(code)?code.slice(5):code==='Space'?' ':code);
      await send('Input.dispatchKeyEvent',{type:'keyDown',code,key:k,windowsVirtualKeyCode:vk(code)});
      await send('Input.dispatchKeyEvent',{type:'keyUp',code,key:k,windowsVirtualKeyCode:vk(code)})},
    async keyDown(code){await send('Input.dispatchKeyEvent',{type:'keyDown',code,key:code,windowsVirtualKeyCode:vk(code)})},
    async keyUp(code){await send('Input.dispatchKeyEvent',{type:'keyUp',code,key:code,windowsVirtualKeyCode:vk(code)})},
    async click(x,y,button='left'){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
      await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button,clickCount:1,buttons:button==='left'?1:button==='right'?2:4});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button,clickCount:1})},
    async move(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y})},
    async clickSel(sel,button='left'){const r=await pg.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();return[b.x+b.width/2,b.y+b.height/2]})()`);
      if(!r)throw new Error('no element '+sel);await pg.click(r[0],r[1],button)},
    async shot(file){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(file,Buffer.from(r.result.data,'base64'));return file},
    async wait(fn,ms=8000){const t0=Date.now();while(Date.now()-t0<ms){try{if(await pg.ev(fn))return true}catch(e){}await sleep(100)}throw new Error('timeout waiting: '+fn)},
    close(){ws.close()}
  };
  return pg;
}
function vk(code){if(/^Key[A-Z]$/.test(code))return code.charCodeAt(3);if(/^Digit\d$/.test(code))return 48+ +code[5];
  return {Escape:27,Tab:9,Space:32,Enter:13,ShiftLeft:16,ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Backquote:192}[code]||0}

// 起一個測試用 server（副本資料夾，saves 也在那裡）
export async function startServer(dir,port){
  const p=spawn(process.execPath,['server.js',String(port)],{cwd:dir,stdio:['ignore','pipe','pipe']});
  let out='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);
  for(let k=0;k<50;k++){if(out.includes('世界開始運作'))break;await sleep(200)}
  return {proc:p,get out(){return out},close(){try{p.kill()}catch(e){}}};
}

// 單人：開 file://，按開始
export async function soloGame(br,dir){
  const f=buildTestCopy(dir);
  const pg=await openPage(br,'file:///'+f.replace(/\\/g,'/'));
  await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`);
  await pg.ev(`document.getElementById('go').click()`);
  await pg.wait(`__dbg('started')`);
  return pg;
}
// 多人：登入
export async function mpGame(br,port,name,pin='1234'){
  const pg=await openPage(br,`http://localhost:${port}/`);
  await pg.wait(`typeof __dbg==='function'&&__dbg('ready')`,15000);
  await pg.ev(`document.getElementById('nameIn').value=${JSON.stringify(name)};document.getElementById('pinIn').value=${JSON.stringify(pin)};document.getElementById('go').click()`);
  await pg.wait(`__dbg('started')`,15000);
  return pg;
}
// 每個測試檔共用：PASS / FAIL 一行一個
export function checker(){return(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':'  → '+JSON.stringify(x)));if(!c)process.exitCode=1}}
