// 北境求生 · core.js：畫布、$、HEADLESS、畫面大小；雜訊函式
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- setup ---------- */
const cv=document.getElementById('game'),ctx=cv.getContext('2d');
const dark=document.createElement('canvas'),dctx=dark.getContext('2d');
const $=id=>document.getElementById(id);
// server.js runs this same script in Node as the multiplayer host (simulates the world, draws nothing): see startSim in server.js
const HEADLESS=!!globalThis.__NORTH_HEADLESS__;
const TOUCH=matchMedia('(pointer:coarse)').matches;
if(TOUCH)document.body.classList.add('touch');
let DPR=1,VW=0,VH=0,SCALE=1;
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);VW=innerWidth;VH=innerHeight;cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR);dark.width=Math.ceil(VW/2);dark.height=Math.ceil(VH/2);SCALE=Math.max(.72,Math.min(1.25,Math.sqrt(VW*VH)/700));}
addEventListener('resize',resize);resize();

let DAY_LEN=360; // seconds in a day: CFG.dayMin
const SKEY='northland-save-v1',WKEY='northland-mp-world-v1';
function loadKey(k){try{const s=localStorage.getItem(k);return s?JSON.parse(s):null}catch(e){return null}}
// each world keeps the size it was made with: saves from before the bigger map have no mapW and stay OLD_MAP, new worlds get NEW_MAP.
// Everything is sized once at load, so a tab that finds out it has the wrong size (a client joining, a host starting over) remembers the right one and reloads
// 7200 worlds (MID_MAP) are one big continent; new worlds are 14400 with the same mainland in the middle and three outer continents around it
const OLD_MAP=3200,MID_MAP=7200,NEW_MAP=14400,MAPW_KEY='northland-mapw';
const mapWOf=s=>s?(s.mapW||OLD_MAP):NEW_MAP;
// over http, server.js writes the current world's size into the page as __NORTH_MAPW, so clients start with the right size instead of reloading once
const W=(()=>{const http=location.protocol.startsWith('http');let ov=null;try{ov=http&&sessionStorage.getItem(MAPW_KEY)}catch(e){}return http&&+globalThis.__NORTH_MAPW||+ov||mapWOf(loadKey(http?WKEY:SKEY))})(),H=W,CELL=40,COLS=W/CELL,ROWS=H/CELL;
function wrongMapSize(want){if(want===W)return false;try{sessionStorage.setItem(MAPW_KEY,want)}catch(e){return false}location.reload();return true}
let save=null,seed=0;

/* ---------- noise ---------- */
function hash(x,y,s){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(s|0,1442695041);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296}
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=hash(xi,yi,seed),b=hash(xi+1,yi,seed),c=hash(xi,yi+1,seed),d=hash(xi+1,yi+1,seed);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,y,o){let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){s+=a*vnoise(x*f,y*f);n+=a;f*=2;a*=.5}return s/n}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
