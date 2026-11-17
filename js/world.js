// 北境求生 · world.js：遊戲狀態變數、迷霧、地形與生態域生成、怪物的建立
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- state ---------- */
const biome=new Uint8Array(COLS*ROWS),cellCol=new Array(COLS*ROWS),cellH=new Float32Array(COLS*ROWS);
const resGrid=new Array(COLS*ROWS).fill(null),structGrid=new Array(COLS*ROWS).fill(null),wallH=new Array(COLS*ROWS).fill(null),wallV=new Array(COLS*ROWS).fill(null);
const mapImg=document.createElement('canvas');mapImg.width=COLS;mapImg.height=ROWS;
// fog of war: one flag per cell; fogImg is the matching dark mask (cleared where seen)
// multiplayer: the fog is shared. Newly seen cells collect in fogNew and go to everyone in netTick (t:'fog');
// the host holds the union, sends it with the world and keeps it in world.json
const seen=new Uint8Array(COLS*ROWS),fogImg=document.createElement('canvas');fogImg.width=COLS;fogImg.height=ROWS;
const fctx=fogImg.getContext('2d'),FOG_R=6;let fogNew=[],fogPend=[];
function resetFog(){seen.fill(0);fogNew=[];fctx.fillStyle='#0b1a22';fctx.fillRect(0,0,COLS,ROWS)}
resetFog();
function reveal(x,y){const i0=Math.floor(x/CELL),j0=Math.floor(y/CELL);
  for(let j=j0-FOG_R;j<=j0+FOG_R;j++)for(let i=i0-FOG_R;i<=i0+FOG_R;i++){if(i<0||j<0||i>=COLS||j>=ROWS||(i-i0)**2+(j-j0)**2>FOG_R*FOG_R)continue;
    const c=j*COLS+i;if(!seen[c]){seen[c]=1;fctx.clearRect(i,j,1,1);if(MODE!=='solo')fogNew.push(c)}}}
// cells another player saw
function seeCells(cs){for(const c of cs)if(c>=0&&c<seen.length&&!seen[c]){seen[c]=1;fctx.clearRect(c%COLS,Math.floor(c/COLS),1,1)}}
function packSeen(){let s='';for(let b=0;b<seen.length;b+=8){let v=0;for(let k=0;k<8;k++)if(seen[b+k])v|=1<<k;s+=String.fromCharCode(v)}return btoa(s)}
// merge: add to what is already revealed; in multiplayer, cells new to us are shared on too (a player's fog from older saves)
function unpackSeen(str,merge){if(!merge)resetFog();let s;try{s=atob(str)}catch(e){return}
  for(let b=0;b<s.length;b++){const v=s.charCodeAt(b);for(let k=0;k<8;k++)if(v>>k&1){const c=b*8+k;if(c<seen.length&&!seen[c]){seen[c]=1;fctx.clearRect(c%COLS,Math.floor(c/COLS),1,1);if(merge&&MODE!=='solo')fogNew.push(c)}}}}
let structs=[],mobs=[],parts=[],floats=[],regrow=[],slashes=[],rings=[];
let altar=null,boss=null,treantDown=false,shots=[],seeds=[],seedSeq=0,tfx=[],rootTrail=[],fogs=[],etrees=[],leaves=[]; // boss = whichever boss is awake; only one at a time
let inv={},dur={},q={},sk={},eq=noEq(),known=new Set(),foods=[],ate=false,pets=[],petOut=null,loots=[],lootSeq=0;
let dayT=.05,day=1,flags={summoned:false,boss:false};
let spawnPt={x:W/2,y:H/2};
const P={em:-1,emT:0,x:W/2,y:H/2,r:12,face:0,hp:25,st:50,stDelay:0,cd:0,swing:0,roll:0,rdx:0,rdy:0,inv:0,hurt:0,weapon:'none',rest:0,restT:0,walk:0,dead:false};
let worldPaused=false; // the admin page paused the whole world (multiplayer only); sent to clients in every snapshot
let shake=0,time=0,paused=true,placing=null,placeRot='h',panelTab='craft';
/* multiplayer: solo when opened as a file; over http the first localhost tab is host (simulates the world), others are clients that send intents */
let MODE=location.protocol.startsWith('http')?'pending':'solo',ws=null,myId=0,netInfo=null,ready=false,started=false,mobSeq=0;
let myName;try{myName=localStorage.getItem('northland-name')}catch(e){}myName=myName||'旅人'+(10+Math.floor(Math.random()*90));
const ME=0,others=new Map();

const ci=(x,y)=>{const i=Math.floor(x/CELL),j=Math.floor(y/CELL);return(i<0||j<0||i>=COLS||j>=ROWS)?-1:j*COLS+i};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rnd=(a,b)=>a+Math.random()*(b-a);
const ri=(a,b)=>Math.floor(rnd(a,b+1));
function isWater(x,y){const c=ci(x,y);return c<0||biome[c]===0}
// biomes: 0 sea, 1 sand, 2 grass, 3 forest; big maps also have 4 snow, 5 swamp, 6 volcanic ash, 7 lava, 8 magic forest
const B_SNOW=4,B_SWAMP=5,B_ASH=6,B_LAVA=7,B_MAGIC=8,SWAMP_K=.55,SNOW_ST=2,BURN_T=5,BURN_DPS=2,BURN_MOB_DPS=4;
const biomeAt=(x,y)=>{const c=ci(x,y);return c<0?0:biome[c]};
const isSea=(x,y)=>{const c=ci(x,y);return c>=0&&biome[c]===0}; // unlike isWater, off the map is not sailable
// lava: anything that touches it burns for BURN_T seconds; returns whether e is burning now
function burnTick(e,dt){if(!e.boat&&biomeAt(e.x,e.y)===B_LAVA)e.burn=BURN_T;else if(e.burn>0)e.burn-=dt;return e.burn>0}

/* ---------- world gen ---------- */
// bigger maps break into islands: walk outward from the spawn island and lay a narrow bridge to every island of any size, so all of it can be reached on foot
function connectLand(){const N=COLS*ROWS,lab=new Int32Array(N).fill(-1),comps=[],nb=c=>{const o=[],i=c%COLS;if(i>0)o.push(c-1);if(i<COLS-1)o.push(c+1);if(c>=COLS)o.push(c-COLS);if(c<N-COLS)o.push(c+COLS);return o};
  for(let c=0;c<N;c++){if(!biome[c]||lab[c]>=0)continue;const id=comps.length,cells=[c];lab[c]=id;for(let h=0;h<cells.length;h++)for(const n of nb(cells[h]))if(biome[n]&&lab[n]<0){lab[n]=id;cells.push(n)}comps.push(cells)}
  const main=lab[ci(W/2,H/2)],prev=new Int32Array(N).fill(-2),q=new Int32Array(N);let head=0,tail=0;for(const c of comps[main]){prev[c]=-1;q[tail++]=c}
  while(head<tail){const c=q[head++];for(const n of nb(c)){if(prev[n]!==-2)continue;
    if(biome[n]&&lab[n]>=0&&comps[lab[n]].length>=25){ // lab<0: a bridge laid just now, not an island of its ownfor(let p=c;p>=0;p=prev[p])if(!biome[p]){for(const b of[p,p+1,p+COLS])if(b<N&&!biome[b]){biome[b]=2;cellH[b]=.42}}
      for(const m of comps[lab[n]]){prev[m]=-1;q[tail++]=m}}
    else{prev[n]=c;q[tail++]=n}}}}
// big maps: a few outer continents and small archipelagos out in the sea, kept at least 4 cells off the mainland so you need a boat. Hash and noise only, no R() calls
function addIslands(cont,arch){const N=COLS*ROWS,dl=new Int16Array(N).fill(-1),q=[];
  for(let c=0;c<N;c++)if(biome[c]){dl[c]=0;q.push(c)}
  for(let h=0;h<q.length;h++){const c=q[h],i=c%COLS;for(const n of[i>0?c-1:-1,i<COLS-1?c+1:-1,c-COLS,c+COLS])if(n>=0&&n<N&&dl[n]<0){dl[n]=dl[c]+1;q.push(n)}}
  const room=c=>{const i=c%COLS,j=Math.floor(c/COLS);return Math.min(dl[c]-4,i-2,j-2,COLS-3-i,ROWS-3-j)},blobs=[];
  // the roomiest open-sea spot that keeps clear of the islands already placed
  const pick=(minR,maxR,gap)=>{let best=-1,bs=-1;for(let c=0;c<N;c++){const r=room(c);if(r<minR)continue;const i=c%COLS,j=Math.floor(c/COLS),R=Math.min(r,maxR);
      if(blobs.some(b=>Math.hypot(b.i-i,b.j-j)<b.r+R+gap))continue;const s=R+hash(c,21,seed)*3;if(s>bs){bs=s;best=c}}
    if(best<0)return null;const b={i:best%COLS,j:Math.floor(best/COLS),r:Math.min(room(best),maxR)};blobs.push(b);return b};
  const paint=(ci0,cj0,R,k,rough)=>{for(let j=Math.max(2,Math.floor(cj0-R*1.5));j<=Math.min(ROWS-3,Math.ceil(cj0+R*1.5));j++)for(let i=Math.max(2,Math.floor(ci0-R*1.5));i<=Math.min(COLS-3,Math.ceil(ci0+R*1.5));i++){
    const c=j*COLS+i;if(biome[c]||dl[c]<4)continue;const dx=i+.5-ci0,dy=j+.5-cj0,qd=Math.hypot(dx,dy)/R,a=Math.atan2(dy,dx);
    const edge=.75+.45*fbm(Math.cos(a)*1.6+k*13.1,Math.sin(a)*1.6+k*7.7,2)+(rough?(fbm(i/6+k*5.3,j/6+k*3.1,2)-.5)*.6:0);if(qd>=edge)continue;
    const x=(i+.5)*CELL,y=(j+.5)*CELL;biome[c]=fbm(x/330+71.3,y/330+19.7,3)>.53?3:2;cellH[c]=.42+(1-qd/edge)*.25}};
  if(cont)for(let k=0;k<3;k++){const b=pick(8,13,6);if(!b)break;paint(b.i,b.j,b.r*.85,k,true)}  // outer continents
  for(let k=0;k<arch;k++){const b=pick(4,7,5);if(!b)break;const n=5+Math.floor(hash(k,22,seed)*5);  // archipelagos: 5–9 islets each
    for(let m=0;m<n;m++){const h=k*31+m,a=hash(h,23,seed)*6.2832,d=hash(h,24,seed)*b.r*.9;paint(b.i+Math.cos(a)*d,b.j+Math.sin(a)*d,1.2+hash(h,25,seed)*1.8,10+h,false)}}}
// each special biome is a single blob: a centre picked per biome on its own side of the map, a wobbly edge around it
const ZONES=[B_SNOW,B_SWAMP,B_ASH,B_MAGIC],ZONE_R=.11;
function placeZones(){const R=W*ZONE_R,a0=hash(1,2,seed)*6.2832,zs=[];
  ZONES.forEach((b,k)=>{const a=a0+k*1.5708+(hash(k,3,seed)-.5)*.7;let best=null,bn=-1;
    for(let d=.5;d<=.76;d+=.04){const zx=W/2+Math.cos(a)*d*W/2,zy=H/2+Math.sin(a)*d*H/2;let n=0;
      for(let v=-R;v<=R;v+=CELL*2)for(let u=-R;u<=R;u+=CELL*2){if(u*u+v*v>R*R)continue;const i=Math.floor((zx+u)/CELL),j=Math.floor((zy+v)/CELL);if(i>=0&&j>=0&&i<COLS&&j<ROWS&&biome[j*COLS+i])n++}
      if(n>bn){bn=n;best={b,x:zx,y:zy,k}}}
    zs.push(best)});
  for(const z of zs){const was=new Map(),i0=Math.floor((z.x-R*1.3)/CELL),i1=Math.floor((z.x+R*1.3)/CELL),j0=Math.floor((z.y-R*1.3)/CELL),j1=Math.floor((z.y+R*1.3)/CELL);
    for(let j=Math.max(0,j0);j<=Math.min(ROWS-1,j1);j++)for(let i=Math.max(0,i0);i<=Math.min(COLS-1,i1);i++){const c=j*COLS+i;if(!biome[c])continue;
      const x=(i+.5)*CELL,y=(j+.5)*CELL,dx=x-z.x,dy=y-z.y,q=Math.hypot(dx,dy)/R,ang=Math.atan2(dy,dx);
      // edge wobbles with the angle only, so the zone stays one blob around its centre
      const edge=.8+.45*fbm(Math.cos(ang)*1.6+z.k*31.7,Math.sin(ang)*1.6+z.k*17.3,2);if(q>edge)continue;
      was.set(c,biome[c]);biome[c]=z.b===B_ASH&&q<edge*.75&&biome[c]!==1&&fbm(x/190+43.9,y/190+71.1,2)>.56?B_LAVA:z.b}
    // water can cut off a few cells of the zone: keep the biggest connected piece, the rest goes back to what it was
    let keep=null;const done=new Set();for(const c0 of was.keys()){if(done.has(c0))continue;const part=[c0];done.add(c0);
      for(let h=0;h<part.length;h++){const p=part[h],i=p%COLS;for(const o of[-1,1,-COLS,COLS,-COLS-1,-COLS+1,COLS-1,COLS+1]){const n=p+o;if(Math.abs(n%COLS-i)>1||!was.has(n)||done.has(n))continue;done.add(n);part.push(n)}}
      if(!keep||part.length>keep.length)keep=part}
    const k=new Set(keep);for(const[c,b]of was)if(!k.has(c))biome[c]=b}}
const MR=Math.min(W,MID_MAP)/2,OUTER=[],OC_D=6500,OC_R=2500;
// cells of one land mass (4-neighbour flood fill), starting from the land cell nearest (x,y)
function landMass(x,y,box){let s=-1,bd=1e9;const i0=Math.floor(x/CELL),j0=Math.floor(y/CELL);
  for(let j=Math.max(0,j0-box);j<=Math.min(ROWS-1,j0+box);j++)for(let i=Math.max(0,i0-box);i<=Math.min(COLS-1,i0+box);i++){const c=j*COLS+i,d=(i-i0)**2+(j-j0)**2;if(biome[c]&&d<bd){bd=d;s=c}}
  if(s<0)return[];const seen=new Uint8Array(COLS*ROWS),out=[s];seen[s]=1;
  for(let h=0;h<out.length;h++){const c=out[h],i=c%COLS;for(const n of[i>0?c-1:-1,i<COLS-1?c+1:-1,c-COLS,c+COLS])if(n>=0&&n<COLS*ROWS&&biome[n]&&!seen[n]){seen[n]=1;out.push(n)}}return out}
// new worlds: three outer continents on three of the four diagonals, each at least about half the mainland. A continent that comes out too small is redrawn bigger
function addContinents(){const N=COLS*ROWS,dl=new Int16Array(N).fill(-1),q=[];let main=0;
  for(let c=0;c<N;c++)if(biome[c]){dl[c]=0;q.push(c);main++}
  for(let h=0;h<q.length;h++){const c=q[h],i=c%COLS;for(const n of[i>0?c-1:-1,i<COLS-1?c+1:-1,c-COLS,c+COLS])if(n>=0&&n<N&&dl[n]<0){dl[n]=dl[c]+1;q.push(n)}}
  const skip=Math.floor(hash(5,6,seed)*4);OUTER.length=0;
  for(let s=0;s<4;s++){if(s===skip)continue;const k=OUTER.length,a=.785+s*1.5708+(hash(s,7,seed)-.5)*.3;let R=OC_R,cells,cx,cy;
    for(let t=0;t<8;t++){cells=[];const m=R*1.1+200;cx=Math.min(W-m,Math.max(m,W/2+Math.cos(a)*OC_D));cy=Math.min(H-m,Math.max(m,H/2+Math.sin(a)*OC_D)); /* keep it off the map edge */const i0=Math.max(4,Math.floor((cx-R*1.4)/CELL)),i1=Math.min(COLS-5,Math.floor((cx+R*1.4)/CELL)),j0=Math.max(4,Math.floor((cy-R*1.4)/CELL)),j1=Math.min(ROWS-5,Math.floor((cy+R*1.4)/CELL));
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const c=j*COLS+i;if(dl[c]<5)continue;const x=(i+.5)*CELL,y=(j+.5)*CELL;
        const e=fbm(x/430+k*91.7,y/430+k*53.3,4)+.28-Math.pow(Math.hypot(x-cx,y-cy)/R,4)*.85;if(e>=.37)cells.push(c,e)}
      if(cells.length/2>=main*.53)break;R*=1.06}
    for(let n=0;n<cells.length;n+=2){const c=cells[n],x=(c%COLS+.5)*CELL,y=(Math.floor(c/COLS)+.5)*CELL;biome[c]=fbm(x/330+71.3,y/330+19.7,3)>.53?3:2;cellH[c]=cells[n+1]}
    OUTER.push({x:cx,y:cy,r:R})}}
// new worlds: volcano, snow and magic forest each take a whole outer continent; the swamp is one fifth of the mainland
function placeBigBiomes(){const kinds=[B_ASH,B_SNOW,B_MAGIC],o=Math.floor(hash(3,4,seed)*3);
  OUTER.forEach((z,k)=>{const b=kinds[(k+o)%3],mass=landMass(z.x,z.y,30);
    for(const c of mass){let lava=false;
      if(b===B_ASH){const i=c%COLS,j=Math.floor(c/COLS);let inland=true;for(let v=-3;v<=3&&inland;v++)for(let u=-3;u<=3;u++)if(!biome[(j+v)*COLS+i+u]){inland=false;break}
        lava=inland&&fbm((i+.5)*CELL/190+43.9,(j+.5)*CELL/190+71.1,2)>.56}
      biome[c]=lava?B_LAVA:b}});
  const main=landMass(W/2,H/2,3),a=hash(8,9,seed)*6.2832,sx=W/2+Math.cos(a)*MR*.55,sy=H/2+Math.sin(a)*MR*.55,k=17;
  const score=c=>{const x=(c%COLS+.5)*CELL,y=(Math.floor(c/COLS)+.5)*CELL,ang=Math.atan2(y-sy,x-sx);return Math.hypot(x-sx,y-sy)/(.8+.45*fbm(Math.cos(ang)*1.6+k*31.7,Math.sin(ang)*1.6+k*17.3,2))};
  const pool=main.filter(c=>Math.hypot((c%COLS+.5)*CELL-W/2,(Math.floor(c/COLS)+.5)*CELL-H/2)>600).sort((p,q)=>score(p)-score(q)).slice(0,Math.round(main.length/5));
  // a coastline can split the pool: keep its biggest connected piece
  const inPool=new Set(pool),done=new Set();let keep=[];
  for(const c0 of pool){if(done.has(c0))continue;const part=[c0];done.add(c0);
    for(let h=0;h<part.length;h++){const p=part[h],i=p%COLS;for(const n of[i>0?p-1:-1,i<COLS-1?p+1:-1,p-COLS,p+COLS])if(inPool.has(n)&&!done.has(n)){done.add(n);part.push(n)}}
    if(part.length>keep.length)keep=part}
  for(const c of keep)biome[c]=B_SWAMP}
function genWorld(){
  const R=mulberry(seed);
  for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++){
    const x=(i+.5)*CELL,y=(j+.5)*CELL,dx=(x-W/2)/MR,dy=(y-H/2)/MR,d=Math.hypot(dx,dy);
    let e=fbm(x/430,y/430,4)+.2-Math.pow(d,4)*.85;
    if(d<.1)e=Math.max(e,.55);
    const f=fbm(x/330+71.3,y/330+19.7,3);
    const c=j*COLS+i;cellH[c]=e;
    biome[c]=e<.37?0:(f>.53&&d>.16)?3:2;
  }
  if(W===MID_MAP){connectLand();addIslands(true,5)}
  if(W>MID_MAP){addContinents();addIslands(false,9)} // outer continents and islands are reached by boat
  const sand=[];
  for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++){const c=j*COLS+i;if(biome[c]===0)continue;
    let w=false;for(const[a,b]of[[1,0],[-1,0],[0,1],[0,-1]]){const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=COLS||jj>=ROWS||biome[jj*COLS+ii]===0)w=true}
    if(w)sand.push(c)}
  for(const c of sand)biome[c]=1;
  // big maps only: one region each of snow, swamp, volcano (ash with lava pools) and magic forest, away from spawn. Noise and hash only, no R() calls
  if(W===MID_MAP)placeZones();
  if(W>MID_MAP)placeBigBiomes();
  for(let c=0;c<COLS*ROWS;c++){const v=hash(c,7,seed),b=biome[c];
    cellCol[c]=b===0?`hsl(${200+v*6},${38+v*6}%,${Math.max(13,26-(.37-cellH[c])*70)+v*2}%)`:
      b===1?`hsl(${40+v*6},${30+v*8}%,${52+v*5}%)`:
      b===2?`hsl(${84+v*14},${30+v*10}%,${31+v*6}%)`:b===3?`hsl(${112+v*14},${22+v*8}%,${18+v*4}%)`:
      b===B_SNOW?`hsl(${200+v*12},${18+v*8}%,${84+v*6}%)`:b===B_SWAMP?`hsl(${72+v*16},${24+v*8}%,${21+v*5}%)`:
      b===B_ASH?`hsl(${14+v*12},${7+v*6}%,${21+v*6}%)`:b===B_LAVA?`hsl(${16+v*14},${92}%,${44+v*8}%)`:`hsl(${258+v*22},${30+v*10}%,${20+v*6}%)`;}
  // altar
  for(let k=0;k<400&&!altar;k++){const a=R()*Math.PI*2,rr=MR*2*(.27+R()*.08),x=W/2+Math.cos(a)*rr,y=H/2+Math.sin(a)*rr;
    let ok=true;for(let u=-3;u<=3&&ok;u++)for(let v=-3;v<=3;v++)if(isWater(x+u*CELL,y+v*CELL)){ok=false;break}
    if(ok){const c=ci(x,y);altar={k:'altar',x:(c%COLS+.5)*CELL,y:(Math.floor(c/COLS)+.5)*CELL,cell:c}}}
  if(!altar)altar={k:'altar',x:W/2+600,y:H/2,cell:ci(W/2+600,H/2)};
  // no lava right around the altar (the bosses wake up there)
  for(let c=0;c<COLS*ROWS;c++)if(biome[c]===B_LAVA&&Math.hypot((c%COLS+.5)*CELL-altar.x,(Math.floor(c/COLS)+.5)*CELL-altar.y)<260){biome[c]=B_ASH;const v=hash(c,7,seed);cellCol[c]=`hsl(${14+v*12},${7+v*6}%,${21+v*6}%)`}
  // resources
  for(let j=1;j<ROWS-1;j++)for(let i=1;i<COLS-1;i++){const c=j*COLS+i,b=biome[c];if(b===0)continue;
    const x=(i+.5)*CELL+(R()-.5)*16,y=(j+.5)*CELL+(R()-.5)*16;
    if(Math.hypot(x-W/2,y-H/2)<70||Math.hypot(x-altar.x,y-altar.y)<150)continue;
    const r=R();let k=null;
    if(W>OLD_MAP){const g=fbm(x/230+11.3,y/230+47.9,2),tree=b===1||b===B_ASH||b===B_LAVA?0:g>.58?Math.min(.3,.1+(g-.58)*1.4):.008,s=R();
      if(b===B_LAVA)k=null;
      else if(r<tree)k=b===B_MAGIC?(s<.85?'mtree':'pine'):(b===3||b===B_SNOW?s<.8:s<.15)?'pine':'tree';
      else if(b===B_SNOW)k=s<.04?'rock':s<.08?'pebble':null;
      else if(b===B_SWAMP)k=s<.07?'shroom':s<.09?'bush':s<.12?'pebble':null;
      else if(b===B_ASH)k=s<.05?'rock':s<.075?'coal':s<.12?'flint':s<.16?'pebble':null;
      else if(b===B_MAGIC)k=s<.04?'crystal':s<.1?'glowshroom':s<.13?'pebble':null;
      else if(b===3)k=s<.05?'rock':s<.11?'shroom':s<.14?'pebble':null;
      else if(b===2)k=s<.04?'bush':s<.085?'pebble':s<.105?'rock':s<.115?'flint':null;
      else k=s<.2?'flint':s<.3?'pebble':null;
      if(k)addRes(k,x,y,c);continue}
    if(b===3)k=r<.42?'pine':r<.5?'tree':r<.55?'rock':r<.61?'shroom':r<.64?'pebble':null;
    else if(b===2)k=r<.085?'tree':r<.125?'bush':r<.17?'pebble':r<.19?'rock':r<.2?'flint':null;
    else k=r<.2?'flint':r<.3?'pebble':null;
    if(k)addRes(k,x,y,c);}
  // ore veins: placed with hash/noise only (no R() calls) so the rest of an existing world stays the same; iron only far from spawn
  for(let j=1;j<ROWS-1;j++)for(let i=1;i<COLS-1;i++){const c=j*COLS+i;if(biome[c]<2||biome[c]===B_LAVA||resGrid[c]||c===altar.cell)continue;
    const x=(i+.5)*CELL,y=(j+.5)*CELL,d=Math.hypot(x-W/2,y-H/2)/MR;if(d<.2||Math.hypot(x-altar.x,y-altar.y)<150)continue;
    if(vnoise(x/210+33.1,y/210+51.7)<.8||hash(c,11,seed)>.45)continue;
    const t=hash(Math.floor(x/360),Math.floor(y/360),seed+5),k=t<.3?'coal':t<.52?'copper':t<.74?'tin':d>.4?'iron':'coal'; // one ore type per 9×9-cell region
    addRes(k,x+(hash(c,12,seed)-.5)*14,y+(hash(c,13,seed)-.5)*14,c)}
  // guaranteed starter kit near spawn
  const kit=[['flint',4],['pebble',5],['tree',8],['bush',3]];
  for(const[k,n]of kit)for(let m=0;m<n;m++)for(let t=0;t<30;t++){const a=R()*6.28,rr=110+R()*260,x=W/2+Math.cos(a)*rr,y=H/2+Math.sin(a)*rr,c=ci(x,y);if(c>=0&&biome[c]&&!resGrid[c]){addRes(k,x,y,c);break}}
  const oreKit=[['coal',3],['copper',2],['tin',2]];
  for(const[k,n]of oreKit)for(let m=0;m<n;m++)for(let t=0;t<30;t++){const a=R()*6.28,rr=380+R()*320,x=W/2+Math.cos(a)*rr,y=H/2+Math.sin(a)*rr,c=ci(x,y);if(c>=0&&biome[c]>=2&&!resGrid[c]){addRes(k,x,y,c);break}}
  // terrain image for the maps: one pixel per cell
  const g=mapImg.getContext('2d');for(let c=0;c<COLS*ROWS;c++){g.fillStyle=cellCol[c];g.fillRect(c%COLS,Math.floor(c/COLS),1,1)}
}
function addRes(k,x,y,c){const o={k,x,y,cell:c,hp:RES[k].hp,flash:0,dep:0,sz:.85+hash(c,3,seed)*.35};resGrid[c]=o;return o}

/* ---------- mobs ---------- */
function findSpot(cx,cy,minD,maxD,want){for(let t=0;t<40;t++){const a=Math.random()*6.28,r=rnd(minD,maxD),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r,c=ci(x,y);if(c<0)continue;const b=biome[c];if(b===0||b===B_LAVA||resGrid[c]&&RES[resGrid[c].k].solid||structGrid[c])continue;if(want&&!want.includes(b))continue;return{x,y}}return null}
function makeMob(k,x,y){const base={boar:{hp:26,r:13,spd:36},moss:{hp:20,r:11,spd:78},boss:{hp:480,r:30,spd:100},treant:{hp:1700,r:39,spd:42},frog:{hp:30,r:15,spd:60},sprout:{hp:24,r:11,spd:70}}[k];
  return{id:++mobSeq,k,x,y,tx:x,ty:y,hp:base.hp,max:base.hp,r:base.r,spd:base.spd,face:Math.random()*6.28,wt:0,wx:0,wy:0,aggro:0,acd:0,kx:0,ky:0,flash:0,state:'chase',t:0,atkT:2.5,lastAtk:'',howlT:9,cn:0,cph:'',hitDash:false,anim:Math.random()*9}}
function spawnMob(k,x,y){const m=makeMob(k,x,y);m.hp=m.max=Math.round(m.max*(k==='boss'||k==='treant'?CFG.bossHp:CFG.mobHp));mobs.push(m);return m}
function populate(){
  const big=W>OLD_MAP,far=big?W*.47:1500,pop=(big?3.5:1)*CFG.mobCount;
  for(let n=0;n<24*pop;n++){const s=findSpot(W/2,H/2,350,far,[2]);if(s)spawnMob('boar',s.x,s.y)}
  for(let n=0;n<14*pop;n++){const s=findSpot(W/2,H/2,600,far,[3]);if(s)spawnMob('moss',s.x,s.y)}
  for(let n=0;n<8*pop;n++){const s=findSpot(W/2,H/2,250,far,[1,3]);if(s)spawnMob('frog',s.x,s.y)}
}
