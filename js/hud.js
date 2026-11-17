// 北境求生 · hud.js：HUD、小地圖與大地圖、表情、地圖標記與信號
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- HUD ---------- */
function hud(){const MH=maxHp(),MS=maxSt();learn();
  $('hpFill').style.width=(P.hp/MH*100)+'%';$('hpTxt').textContent=`${Math.ceil(P.hp)} / ${Math.round(MH)}`;$('stFill').style.width=(P.st/MS*100)+'%';
  let fh='';for(let i=0;i<3;i++){const f=foods[i];if(f){const d=FOODS[f.k],p=f.t/d.t,C=2*Math.PI*17;fh+=`<div class="food" style="color:${d.col};border-color:${d.col}66" title="${f.k}"><svg viewBox="0 0 38 38"><circle cx="19" cy="19" r="17" fill="none" stroke="${d.col}" stroke-width="2.5" stroke-dasharray="${C*p} ${C}"/></svg><span style="color:var(--ink)">${f.k[0]}</span></div>`}else fh+='<div class="food empty"></div>'}
  $('foods').innerHTML=fh;
  const mmss=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  $('buffs').textContent=[P.rest>0?`休息 Lv${P.restLv||1} ${mmss(P.rest)}`:'',P.comfort?`舒適度 ${P.comfort}`:''].filter(Boolean).join('・');
  const po=pets.find(p=>p.id===petOut);
  $('petHud').textContent=!po?'':po.down>0?`${po.name} 倒下了・${Math.ceil(po.down)} 秒後回來`:`${po.name}  ${Math.ceil(po.hp)}/${PETS[po.k].hp}`+(Object.keys(po.bag).length?`・攜帶 ${Object.values(po.bag).reduce((a,b)=>a+b,0)} 件`:'');
  $('petHud').classList.toggle('down',!!po&&po.down>0);
  const tod=dayT<.58?'白天':dayT<.68?'黃昏':'夜晚';$('clock').textContent=`第 ${day} 天・${tod}`;
  const gi=goalIdx();$('goal').innerHTML=gi<GOALS.length?`<b>目標</b>${GOALS[gi][0]}`:'<b>完成</b>這片草原是你的了';
  syncHeld();renderHot();const hk=held();
  $('weaponTag').innerHTML=`手持 <b>${WEAPONS[hk]?WEAPONS[hk].name:hk||'空手'}</b>（傷害 ${wDmg(P.weapon)}${DUR_MAX[P.weapon]?`・耐久 ${Math.ceil(durOf(P.weapon))}/${durMax(P.weapon)}`:''}）${FOODS[hk]?(TOUCH?'・按攻擊吃':'・左鍵吃'):''}${armorTotal()?`・護甲 ${armorTotal()}（減傷 ${armorCut()}%）`:''}${bagFull()?'・<b style="color:var(--bad)">背包滿了</b>':''}${TOUCH?'':'　<kbd>1</kbd>~<kbd>8</kbd>／滾輪／<kbd>Q</kbd> 切換'}`;
  $('bossBar').hidden=!boss;if(boss)$('bossName').textContent=boss.k==='treant'?'樹精長老':'灰鬃狼王';if(boss)$('bossFill').style.width=(boss.hp/boss.max*100)+'%';
  if(MODE==='solo'||started)reveal(P.x,P.y);
  drawMap($('mini'),P.x,P.y,MINI_SPAN,false);if(!$('bigmap').hidden)drawMap($('bigCv'),W/2,H/2,W,true)}

/* ---------- maps ---------- */
// minimap = MINI_SPAN world units around you (top-left); big map = whole world (M key or click the minimap)
const MINI_SPAN=1200,MAPCOL={fire:'#ff8a3a',bench:'#c9a26a',bed:'#c95b5b',wall:'#3d2a17',swall:'#b8bcb6',furnace:'#d0603a',boat:'#e0c08a',lamp:'#b49cff',chest:'#a87d4a',anvil:'#8a8e88',rack:'#8f6a3e',pot:'#3d403b',plot:'#6fae3e',chair:'#8f6a3e',rug:'#a8845a',banner:'#a83a32'};
function drawMap(cvs,cx,cy,span,big){const g=cvs.getContext('2d'),S=cvs.width,k=S/span,u=big?S/260:S/140;
  g.setTransform(1,0,0,1,0,0);g.fillStyle='#0b1a22';g.fillRect(0,0,S,S);
  g.imageSmoothingEnabled=false;g.setTransform(k,0,0,k,S/2-cx*k,S/2-cy*k);g.drawImage(mapImg,0,0,W,H);
  g.imageSmoothingEnabled=true;g.drawImage(fogImg,0,0,W,H);g.setTransform(1,0,0,1,0,0); // smoothing softens the fog edge
  const at=(x,y)=>[S/2+(x-cx)*k,S/2+(y-cy)*k];
  for(const s of structs){if(!seen[s.cell])continue;const[x,y]=at(s.x,s.y);g.fillStyle=MAPCOL[s.k];
    if(s.o){const L=CELL/2*k,t=.8*u;if(s.o==='v')g.fillRect(x-t,y-L,t*2,L*2);else g.fillRect(x-L,y-t,L*2,t*2)}else{const r=2.6*u;g.fillRect(x-r,y-r,r*2,r*2)}}
  if(seen[altar.cell]){const[x,y]=at(altar.x,altar.y);g.save();g.translate(x,y);g.rotate(Math.PI/4);g.fillStyle='#e0a646';g.strokeStyle='#000';g.lineWidth=u;g.fillRect(-3.5*u,-3.5*u,7*u,7*u);g.strokeRect(-3.5*u,-3.5*u,7*u,7*u);g.restore()}
  for(const l of loots)if(myGrave(l)){const[x,y]=at(l.x,l.y);g.fillStyle='#d8d4c8';g.strokeStyle='#000';g.lineWidth=u;g.fillRect(x-.8*u,y-4*u,1.6*u,8*u);g.fillRect(x-3*u,y-2*u,6*u,1.6*u);g.strokeRect(x-.8*u,y-4*u,1.6*u,8*u);
    if(big){g.font=`600 ${Math.round(4.4*u)}px system-ui,sans-serif`;g.textAlign='center';g.fillStyle='#d8d4c8';g.fillText('墓碑',x,y+8*u)}}
  for(const p of pins){const[x,y]=at(p.x,p.y);g.strokeStyle='#000';g.lineWidth=u*.9;g.beginPath();g.moveTo(x,y);g.lineTo(x,y-7*u);g.stroke();
    g.fillStyle='#ffd23f';g.beginPath();g.moveTo(x,y-7*u);g.lineTo(x+5*u,y-5.2*u);g.lineTo(x,y-3.4*u);g.closePath();g.fill();g.stroke();
    if(big){g.font=`600 ${Math.round(4.6*u)}px system-ui,sans-serif`;g.textAlign='center';g.lineWidth=u*1.2;g.strokeText(p.t,x,y+5*u);g.fillStyle='#ffe9a8';g.fillText(p.t,x,y+5*u)}}
  for(const p of pings){let[x,y]=at(p.x,p.y);const m=5*u;x=Math.max(m,Math.min(S-m,x));y=Math.max(m,Math.min(S-m,y));const k2=(PING_T-p.t)%1;
    g.strokeStyle=`rgba(255,210,63,${1-k2})`;g.lineWidth=1.4*u;g.beginPath();g.arc(x,y,(2+k2*7)*u,0,6.28);g.stroke();g.fillStyle='#ffd23f';g.beginPath();g.arc(x,y,1.6*u,0,6.28);g.fill();
    if(big){g.font=`600 ${Math.round(4.2*u)}px system-ui,sans-serif`;g.textAlign='center';g.strokeStyle='#000';g.lineWidth=u;g.strokeText(p.n,x,y-4*u);g.fillStyle='#ffd23f';g.fillText(p.n,x,y-4*u)}}
  for(const o of others.values())if(!o.dead){const[x,y]=at(o.x,o.y);g.fillStyle=CAPES[o.id%CAPES.length];g.strokeStyle='#fff';g.lineWidth=u;g.beginPath();g.arc(x,y,3.2*u,0,6.28);g.fill();g.stroke()}
  {const[x,y]=at(P.x,P.y);g.save();g.translate(x,y);g.rotate(P.face);g.fillStyle='#ffe08a';g.strokeStyle='#000';g.lineWidth=u;g.beginPath();g.moveTo(6*u,0);g.lineTo(-4*u,-4*u);g.lineTo(-2*u,0);g.lineTo(-4*u,4*u);g.closePath();g.fill();g.stroke();g.restore()}}
function toggleMap(on){const m=$('bigmap');on=on===undefined?m.hidden:on;if(on&&(!$('intro').hidden||!$('dead').hidden))return;if(!on)closePinEdit(false);
  if(on)$('panel').hidden=true;m.hidden=!on;syncPaused();
  if(on){atkHeld=false;drawMap($('bigCv'),W/2,H/2,W,true)}}
$('mini').addEventListener('click',()=>toggleMap(true));
$('mapX').addEventListener('click',()=>toggleMap(false));
$('bigmap').addEventListener('pointerdown',e=>{if(e.target.id==='bigmap')toggleMap(false)});

/* ---------- emotes ---------- */
// Z opens the menu, 1..8 (or a click) picks one: a bubble over your head for a few seconds, everyone sees it (em in sendState). Dancing stops when you move
const EMOTES=[['👋','揮手'],['👍','讚'],['😂','大笑'],['😢','哭哭'],['❤️','愛心'],['❓','疑問'],['❗','注意'],['💃','跳舞']],DANCE=7;
$('emoteMenu').innerHTML=EMOTES.map(([e,n],i)=>`<button type="button" data-em="${i}"><kbd>${i+1}</kbd><span class="em">${e}</span>${n}</button>`).join('');
function toggleEmotes(on){const m=$('emoteMenu');m.hidden=on===undefined?!m.hidden:!on}
function setEmote(i){if(!EMOTES[i]||P.dead)return;P.em=i;P.emT=i===DANCE?4:3;toggleEmotes(false)}
$('emoteMenu').addEventListener('click',e=>{const b=e.target.closest('[data-em]');if(b)setEmote(+b.dataset.em)});
$('btnEmote').addEventListener('click',()=>{if(!paused)toggleEmotes()});
function drawEmote(pl){if(!(pl.em>=0)||!EMOTES[pl.em]||pl.em===DANCE)return;const x=pl.x,y=pl.y-54,t=(pl===P?P.emT:1),pop=Math.min(1,(3-t)*6+.4);
  ctx.save();ctx.translate(x,y);ctx.scale(pop,pop);ctx.fillStyle='#f4efe2';ctx.strokeStyle='#1f1712';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,15,13,0,0,6.28);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-4,11);ctx.lineTo(0,19);ctx.lineTo(4,11);ctx.fill();ctx.font='17px system-ui,"Segoe UI Emoji","Apple Color Emoji",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  const wob=pl.em===0?Math.sin(time*12)*.35:0;ctx.rotate(wob);ctx.fillText(EMOTES[pl.em][0],0,1);ctx.restore();ctx.textBaseline='alphabetic'}

/* ---------- map pins & pings ---------- */
// pins: your own markers on the map, saved with your bag. pings: a signal everyone sees for PING_T seconds (t:'ping', all:1)
let pins=[],pings=[],mapMode='pin',pinEditI=-1,pinNew=false,pingCd=0;
const PIN_MAX=40,PING_T=8;
function sendPing(x,y){if(pingCd>0)return;pingCd=1.5;const m={t:'ping',x:Math.round(Math.max(0,Math.min(W,x))),y:Math.round(Math.max(0,Math.min(H,y))),n:myName};
  addPing(m);if(MODE!=='solo')net(Object.assign({all:1},m))}
function addPing(m){if(!isFinite(m.x)||!isFinite(m.y))return;sfx('ping');const n=String(m.n||'').slice(0,10);pings=pings.filter(p=>p.n!==n);pings.push({x:+m.x,y:+m.y,n,t:PING_T})}
function drawPings(cx,cy,hw,hh){ctx.textAlign='center';ctx.font='600 11px system-ui,sans-serif';
  for(const p of pings){const k2=(PING_T-p.t)%1,fade=Math.min(1,p.t);
    if(Math.abs(p.x-cx)<hw-16&&Math.abs(p.y-cy)<hh-16){ctx.strokeStyle=`rgba(255,210,63,${(1-k2)*fade})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(p.x,p.y,10+k2*44,(10+k2*44)*.6,0,0,6.28);ctx.stroke();
      ctx.fillStyle=`rgba(255,210,63,${fade})`;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-6,p.y-16);ctx.lineTo(p.x+6,p.y-16);ctx.closePath();ctx.fill();
      ctx.fillStyle='#000a';ctx.fillText(p.n,p.x+1,p.y-21);ctx.fillStyle='#ffd23f';ctx.fillText(p.n,p.x,p.y-22);continue}
    // off screen: an arrow on the screen edge pointing at it, with the distance
    const a=Math.atan2(p.y-cy,p.x-cx),c=Math.cos(a),s=Math.sin(a),r=Math.min((hw-34)/Math.abs(c||1e-6),(hh-34)/Math.abs(s||1e-6)),x=cx+c*r,y=cy+s*r;
    ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha=fade;ctx.fillStyle='#ffd23f';ctx.strokeStyle='#000';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-6,-8);ctx.lineTo(-2,0);ctx.lineTo(-6,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    const t=`${p.n} ${Math.round(Math.hypot(p.x-P.x,p.y-P.y)/10)}m`;ctx.globalAlpha=fade;ctx.fillStyle='#000a';ctx.fillText(t,x-c*22+1,y-s*22+4);ctx.fillStyle='#ffd23f';ctx.fillText(t,x-c*22,y-s*22+3);ctx.globalAlpha=1}}
function mapPt(e){const r=$('bigCv').getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H,cx:e.clientX-r.left,cy:e.clientY-r.top,w:r.width}}
// a pin's flag sits above its point, so a click a little above the point still hits it
function pinAt(p){let best=-1,bd=14/p.w*W;pins.forEach((q,i)=>{const d=Math.hypot(q.x-p.x,q.y-(p.y+5/p.w*W));if(d<bd){bd=d;best=i}});return best}
function mapHint(t){$('mapHint').textContent=t||(TOUCH?'標記模式：點地圖加標記，點標記改名或刪除・信號模式：點地圖發信號給大家':'左鍵：加標記，點標記可改名或刪除・右鍵：發信號給大家・遊戲中按 T 或滑鼠中鍵也能發信號')}
mapHint();
function openPinEdit(i,cx,cy,isNew){pinEditI=i;pinNew=isNew;const f=$('pinEdit'),cv2=$('bigCv');f.hidden=false;$('pinDel').hidden=isNew;$('pinName').value=pins[i].t;
  f.style.left=Math.max(4,Math.min(cv2.offsetLeft+cx-60,cv2.offsetLeft+cv2.offsetWidth-f.offsetWidth-4))+'px';f.style.top=(cv2.offsetTop+Math.min(cy+12,cv2.offsetHeight-44))+'px';
  $('pinName').focus();$('pinName').select()}
// ok: keep the name typed; cancelling a pin that was just added removes it
function closePinEdit(ok){if(pinEditI<0)return;const i=pinEditI;pinEditI=-1;$('pinEdit').hidden=true;
  if(ok){const t=$('pinName').value.trim().slice(0,12);if(t)pins[i].t=t}else if(pinNew)pins.splice(i,1);writeSave()}
$('pinOk').addEventListener('click',()=>closePinEdit(true));
$('pinDel').addEventListener('click',()=>{if(pinEditI<0)return;pins.splice(pinEditI,1);pinEditI=-1;$('pinEdit').hidden=true;writeSave()});
$('pinName').addEventListener('keydown',e=>{if(e.key==='Enter')closePinEdit(true);else if(e.key==='Escape')closePinEdit(false)});
document.querySelectorAll('[data-mm]').forEach(b=>b.addEventListener('click',()=>{mapMode=b.dataset.mm;document.querySelectorAll('[data-mm]').forEach(x=>x.classList.toggle('on',x===b));closePinEdit(false)}));
$('bigCv').addEventListener('contextmenu',e=>e.preventDefault());
$('bigCv').addEventListener('pointerdown',e=>{if(e.button===1)return;e.preventDefault();const p=mapPt(e);
  if(e.button===2||mapMode==='ping'){sendPing(p.x,p.y);mapHint('信號已送出，大家的畫面上都看得到');return}
  if(pinEditI>=0){closePinEdit(true);return}
  const i=pinAt(p);if(i>=0){openPinEdit(i,p.cx,p.cy,false);return}
  if(pins.length>=PIN_MAX){mapHint(`標記最多 ${PIN_MAX} 個，先刪掉一些吧`);return}
  pins.push({x:Math.round(p.x),y:Math.round(p.y),t:`標記 ${pins.length+1}`});openPinEdit(pins.length-1,p.cx,p.cy,true)});
