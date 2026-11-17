// 北境求生 · render.js：畫面：地面、建築、資源、怪物、王、玩家
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- render ---------- */
function render(){
  const sk=SET.shake?shake:0,sx=sk?rnd(-sk,sk):0,sy=sk?rnd(-sk,sk):0;
  const cx=cam.x+sx/SCALE,cy=cam.y+sy/SCALE;
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#0b1a22';ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(DPR*SCALE,0,0,DPR*SCALE,DPR*(VW/2-cx*SCALE),DPR*(VH/2-cy*SCALE));
  const hw=VW/2/SCALE,hh=VH/2/SCALE;
  const i0=Math.max(0,Math.floor((cx-hw)/CELL)-1),i1=Math.min(COLS-1,Math.floor((cx+hw)/CELL)+1),j0=Math.max(0,Math.floor((cy-hh)/CELL)-1),j1=Math.min(ROWS-1,Math.floor((cy+hh)/CELL)+2);
  // ground
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const c=j*COLS+i;ctx.fillStyle=cellCol[c];ctx.fillRect(i*CELL,j*CELL,CELL+1,CELL+1)}
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const c=j*COLS+i,b=biome[c],h=hash(i,j,seed+11),x=i*CELL,y=j*CELL;
    if(b===0){const s=Math.sin(time*1.6+h*12);if(s>.6){ctx.strokeStyle=`rgba(190,225,240,${(s-.6)*.5})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x+h*24,y+10+h*18);ctx.lineTo(x+h*24+10,y+10+h*18);ctx.stroke()}}
    else if(b===2&&h>.45){ctx.strokeStyle='rgba(30,45,18,.45)';ctx.lineWidth=1.2;ctx.beginPath();const gx=x+h*30,gy=y+(h*97%1)*30+6;ctx.moveTo(gx,gy);ctx.lineTo(gx-2,gy-6);ctx.moveTo(gx+3,gy);ctx.lineTo(gx+4,gy-7);ctx.stroke()}
    else if(b===3&&h>.6){ctx.fillStyle='rgba(10,20,10,.35)';ctx.beginPath();ctx.arc(x+h*34,y+(h*53%1)*34,3+h*3,0,6.28);ctx.fill()}
    else if(b===1&&h>.7){ctx.fillStyle='rgba(120,100,70,.35)';ctx.fillRect(x+h*30,y+(h*71%1)*30,2,2)}
    else if(b===B_SNOW&&h>.55){ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillRect(x+h*32,y+(h*61%1)*32,2,2);ctx.fillStyle='rgba(150,170,190,.25)';ctx.beginPath();ctx.ellipse(x+(h*37%1)*30+5,y+(h*13%1)*30+5,6,2.5,0,0,6.28);ctx.fill()}
    else if(b===B_SWAMP&&h>.5){const px=x+(h*41%1)*24+8,py=y+(h*29%1)*24+8;ctx.fillStyle='rgba(40,60,45,.55)';ctx.beginPath();ctx.ellipse(px,py,9,4.5,0,0,6.28);ctx.fill();const s=(time*.6+h*5)%1;ctx.strokeStyle=`rgba(170,200,150,${.35*(1-s)})`;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(px,py,2+s*7,1+s*3.5,0,0,6.28);ctx.stroke()}
    else if(b===B_ASH&&h>.5){ctx.fillStyle='rgba(15,10,8,.4)';ctx.beginPath();ctx.arc(x+h*30+4,y+(h*47%1)*30+4,2+h*2,0,6.28);ctx.fill()}
    else if(b===B_LAVA){const s=Math.sin(time*1.3+h*9);ctx.fillStyle=`rgba(255,220,110,${.25+s*.2})`;ctx.beginPath();ctx.ellipse(x+h*24+8,y+(h*57%1)*24+8,7+s*2,4+s,0,0,6.28);ctx.fill();if(h>.8&&Math.random()<.02)parts.push({x:x+h*40,y:y+(h*31%1)*40,vx:rnd(-6,6),vy:-28,t:.9,col:'#ffb347',s:1.8})}
    else if(b===B_MAGIC&&h>.55){const tw=.5+Math.sin(time*2.2+h*20)*.5;ctx.fillStyle=`rgba(150,240,255,${.55*tw})`;ctx.fillRect(x+h*34,y+(h*53%1)*34,2,2);ctx.fillStyle=`rgba(200,160,255,${.45*(1-tw)})`;ctx.fillRect(x+(h*17%1)*34,y+(h*89%1)*34,2,2)}}
  sea.draw(cx,cy,hw,hh);
  for(const r of rootTrail)drawRootTrail(r);
  for(const x of tfx)if(x.k==='mark')drawRootMark(x);
  for(const m of mobs)if(m.k==='treant'&&m.eatFx>0)drawEatCircle(m);
  // drawables
  const list=[];
  for(let j=j0;j<=j1+1&&j<ROWS;j++)for(let i=i0;i<=i1;i++){const c=j*COLS+i,o=resGrid[c];if(o)list.push([o.y,0,o]);const s=structGrid[c];if(s)list.push([s.y,1,s]);if(wallH[c])list.push([wallH[c].y,1,wallH[c]]);if(wallV[c])list.push([wallV[c].y,1,wallV[c]])}
  if(Math.abs(altar.x-cx)<hw+80&&Math.abs(altar.y-cy)<hh+80)list.push([altar.y,1,altar]);
  for(const m of mobs)if(Math.abs(m.x-cx)<hw+60&&Math.abs(m.y-cy)<hh+(m.k==='treant'?170:60))list.push([m.y,2,m]);
  if(MODE==='solo'||started)list.push([P.y,3,P]);
  for(const o of others.values()){if(!o.dead)list.push([o.y,3,o]);if(o.pet)list.push([o.pet.y,4,o.pet])}
  const cp=curPet();if(cp)list.push([cp.y,4,cp]);
  for(const l of loots)if(Math.abs(l.x-cx)<hw+40&&Math.abs(l.y-cy)<hh+40)list.push([l.y,5,l]);
  list.sort((a,b)=>a[0]-b[0]);
  for(const[,t,o]of list){if(t===0)drawRes(o);else if(t===1)drawStruct(o);else if(t===2)drawMob(o);else if(t===3){if(o.boat)drawBoat(o.x,o.y+4,o.face,time*1.7);drawPlayer(o)}else if(t===4)drawPet(o);else drawLoot(o);
    if(o.burn>0&&t>=2&&t<=4)drawBurn(o)}
  // ghost
  if(placing===DEMOLISH){const t=demoTarget(),a=aimPt();ctx.strokeStyle='#ff6a5a';ctx.lineWidth=2;ctx.setLineDash([5,4]);
    if(t){if(t.o==='v')ctx.strokeRect(t.x-WALL_T-2,t.y-22,WALL_T*2+4,44);else if(t.o)ctx.strokeRect(t.x-22,t.y-WALL_T-2,44,WALL_T*2+4);else ctx.strokeRect(t.x-22,t.y-22,44,44)}
    ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(a.x-5,a.y-5);ctx.lineTo(a.x+5,a.y+5);ctx.moveTo(a.x+5,a.y-5);ctx.lineTo(a.x-5,a.y+5);ctx.stroke()}
  else if(placing){const g=ghostPos(),ok=ghostOk(g)&&canPay(placing)&&(!placing.bench||nearBench());ctx.globalAlpha=.55;drawStruct({k:placing.id,x:g.x,y:g.y,o:g.o,anim:0});ctx.globalAlpha=1;
    ctx.strokeStyle=ok?'#9fe07a':'#ff6a5a';ctx.lineWidth=2;ctx.setLineDash([5,4]);if(g.o==='v')ctx.strokeRect(g.x-WALL_T,g.y-20,WALL_T*2,40);else if(g.o)ctx.strokeRect(g.x-20,g.y-WALL_T,40,WALL_T*2);else ctx.strokeRect(g.x-20,g.y-20,40,40);ctx.setLineDash([])}
  // roar shockwave: a green ring that grows out to ROAR_R
  for(const r of rings){const k=1-r.t/.55;ctx.strokeStyle=`rgba(150,255,150,${.85*(1-k)})`;ctx.lineWidth=10*(1-k)+2;ctx.beginPath();ctx.ellipse(r.x,r.y,30+(ROAR_R-30)*k,(30+(ROAR_R-30)*k)*.75,0,0,6.28);ctx.stroke()}
  // claw swipes
  for(const c of slashes){const k=c.t/.3,cx=c.x+Math.cos(c.a)*44,cy=c.y-14+Math.sin(c.a)*44;ctx.save();ctx.translate(cx,cy);ctx.rotate(c.a+Math.PI/2+(c.n%2?.45:-.45));
    ctx.lineCap='round';for(let j=-1;j<=1;j++){ctx.beginPath();ctx.moveTo(-34,j*10-7);ctx.quadraticCurveTo(0,j*10+11,34,j*10-7);ctx.strokeStyle=`rgba(255,170,80,${.5*k})`;ctx.lineWidth=10*k+2;ctx.stroke();ctx.strokeStyle=`rgba(255,245,225,${.95*k})`;ctx.lineWidth=4*k+1;ctx.stroke()}
    for(let i=0;i<8;i++){const an=i/8*6.283+c.n,r=10+34*(1-k);ctx.fillStyle=`rgba(255,220,150,${k})`;ctx.fillRect(Math.cos(an)*r-1.5,Math.sin(an)*r*.6-1.5,3,3)}
    ctx.restore()}
  // treant effects and projectiles
  // devour: life streams from the recalled saplings, leaves spiralling in, a shield around the elder
  if(boss&&boss.k==='treant')drawEatFx(boss);
  for(const x of tfx){if(x.k==='slam')drawSlamFx(x);else if(x.k==='burst')drawRootBurst(x);else if(x.k==='bloom')drawBloom(x)}
  for(const s of seeds){ctx.save();ctx.translate(s.x,s.y-12);ctx.rotate(time*12+s.id);ctx.fillStyle='#1f1712';ctx.beginPath();ctx.ellipse(0,0,6,4.2,0,0,6.28);ctx.fill();ctx.fillStyle='#8a6a44';ctx.beginPath();ctx.ellipse(0,0,4.8,3,0,0,6.28);ctx.fill();ctx.fillStyle='#c9a26a';ctx.fillRect(-2,-1.4,2.4,1);ctx.restore()}
  for(const s of shots){const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,13);g.addColorStop(0,'rgba(190,255,200,.9)');g.addColorStop(1,'rgba(90,220,120,0)');ctx.fillStyle=g;ctx.fillRect(s.x-13,s.y-13,26,26);ctx.fillStyle='#eafff0';ctx.beginPath();ctx.arc(s.x,s.y,3.2,0,6.28);ctx.fill()}
  // black fog clouds
  for(const f of fogs){const g=Math.min(1,(FOG_LIFE-f.t)/.5),R=FOG_CR*g;ctx.fillStyle=`rgba(14,8,24,${.3*Math.min(1,f.t)})`;
    for(let k=0;k<9;k++){const an=k/9*6.28+time*.4*(k%2?1:-1);ctx.beginPath();ctx.arc(f.x+Math.cos(an)*R*.55,f.y+Math.sin(an)*R*.4,R*.5,0,6.28);ctx.fill()}
    ctx.beginPath();ctx.ellipse(f.x,f.y,R*.7,R*.5,0,0,6.28);ctx.fill()}
  // particles
  for(const p of parts){ctx.globalAlpha=Math.min(1,p.t*2);ctx.fillStyle=p.col;ctx.fillRect(p.x-p.s/2,p.y-p.s/2,p.s,p.s)}ctx.globalAlpha=1;
  // darkness
  const dk=darkness();
  if(dk>0){dctx.setTransform(1,0,0,1,0,0);dctx.globalCompositeOperation='source-over';dctx.clearRect(0,0,dark.width,dark.height);dctx.fillStyle=`rgba(6,10,28,${dk})`;dctx.fillRect(0,0,dark.width,dark.height);
    dctx.globalCompositeOperation='destination-out';const k=SCALE/2;
    const light=(x,y,r,f)=>{const X=(x-cx)*k+dark.width/2,Y=(y-cy)*k+dark.height/2,R=r*k;if(X<-R||Y<-R||X>dark.width+R||Y>dark.height+R)return;const g=dctx.createRadialGradient(X,Y,0,X,Y,R);g.addColorStop(0,`rgba(0,0,0,${f})`);g.addColorStop(1,'rgba(0,0,0,0)');dctx.fillStyle=g;dctx.fillRect(X-R,Y-R,R*2,R*2)};
    light(P.x,P.y,190,.75);for(const o of others.values())if(!o.dead)light(o.x,o.y,190,.75);for(const s of structs)if(s.k==='furnace'&&s.fz.burn>0)light(s.x,s.y,140,.6);for(const s of structs)if(s.k==='fire')light(s.x,s.y,300+Math.sin(time*9+s.anim)*8,1);
    light(altar.x,altar.y,120,.6);for(const m of mobs)if(m.k==='treant'&&m.eatFx>0)light(m.x,m.y-40,230,.9*m.eatFx);else if(m.k==='sprout'&&m.state==='recall')light(m.x,m.y-8,60,.5);for(const s of structs)if(s.k==='lamp')light(s.x,s.y-30,260,.95);
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const c=j*COLS+i;if(biome[c]===B_LAVA&&(i+j)%2===0)light((i+.5)*CELL,(j+.5)*CELL,75,.55);const o=resGrid[c];if(o&&(o.k==='mtree'||o.k==='crystal'||o.k==='glowshroom'))light(o.x,o.y-(o.k==='mtree'?24:8),o.k==='glowshroom'?50:80,.5)}
    ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(dark,0,0,cv.width,cv.height);
    // warm glow
    ctx.globalCompositeOperation='lighter';ctx.setTransform(DPR*SCALE,0,0,DPR*SCALE,DPR*(VW/2-cx*SCALE),DPR*(VH/2-cy*SCALE));
    for(const s of structs)if(s.k==='lamp'&&Math.abs(s.x-cx)<hw+200&&Math.abs(s.y-cy)<hh+200){const g=ctx.createRadialGradient(s.x,s.y-30,0,s.x,s.y-30,160);g.addColorStop(0,`rgba(150,120,255,${.2*dk})`);g.addColorStop(1,'rgba(120,100,255,0)');ctx.fillStyle=g;ctx.fillRect(s.x-160,s.y-190,320,320)}
    for(const m of mobs)if(m.k==='treant'&&m.eatFx>0){const g=ctx.createRadialGradient(m.x,m.y-40,0,m.x,m.y-40,170);g.addColorStop(0,`rgba(120,255,150,${.25*dk*m.eatFx})`);g.addColorStop(1,'rgba(120,255,150,0)');ctx.fillStyle=g;ctx.fillRect(m.x-170,m.y-210,340,340)}
    for(const s of structs)if(s.k==='fire'&&Math.abs(s.x-cx)<hw+200&&Math.abs(s.y-cy)<hh+200){const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,180);g.addColorStop(0,`rgba(255,150,60,${.22*dk})`);g.addColorStop(1,'rgba(255,120,40,0)');ctx.fillStyle=g;ctx.fillRect(s.x-180,s.y-180,360,360)}
    ctx.globalCompositeOperation='source-over'}
  const dusk=dayT>.5&&dayT<.7?Math.sin((dayT-.5)/.2*Math.PI)*.16:0;if(dusk>0){ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=`rgba(255,120,50,${dusk})`;ctx.fillRect(0,0,cv.width,cv.height)}
  // blinded by the black fog: only a small circle around you stays visible
  if(P.blindK>.01){const X=DPR*(VW/2+(P.x-cx)*SCALE),Y=DPR*(VH/2+(P.y-12-cy)*SCALE),R=BLIND_R*SCALE*DPR+(1-P.blindK)*Math.hypot(cv.width,cv.height);
    ctx.setTransform(1,0,0,1,0,0);const g=ctx.createRadialGradient(X,Y,R*.45,X,Y,R);g.addColorStop(0,'rgba(8,4,14,0)');g.addColorStop(1,`rgba(8,4,14,${.97*P.blindK})`);ctx.fillStyle=g;ctx.fillRect(0,0,cv.width,cv.height)}
  // overlay in world: eyes at night, floats, hint, compass
  ctx.setTransform(DPR*SCALE,0,0,DPR*SCALE,DPR*(VW/2-cx*SCALE),DPR*(VH/2-cy*SCALE));
  if(dk>.3)for(const m of mobs)if(m.eyes){ctx.fillStyle=m.eyeCol;for(const e of m.eyes)ctx.fillRect(e[0]-2,e[1]-1.5,4,3)}else if(m.k!=='boar'&&m.k!=='frog'){const ex=Math.cos(m.face),ey=Math.sin(m.face);ctx.fillStyle=m.k==='boss'?'#bfe8ff':'#ffe37a';const s=m.k==='boss'?2.6:1.7,o=m.k==='boss'?24:7;
      ctx.fillRect(m.x+ex*o-ey*s*2-s/2,m.y+ey*o-8+ex*s*2-s/2,s,s);ctx.fillRect(m.x+ex*o+ey*s*2-s/2,m.y+ey*o-8-ex*s*2-s/2,s,s)}
  ctx.textAlign='center';ctx.font='600 11px system-ui,sans-serif';
  for(const f of floats){ctx.globalAlpha=Math.min(1,f.t*2);ctx.fillStyle='#000a';ctx.fillText(f.txt,f.x+1,f.y+1);ctx.fillStyle=f.col;ctx.fillText(f.txt,f.x,f.y)}ctx.globalAlpha=1;
  if(MODE==='solo'||started)drawEmote(P);for(const o of others.values())if(!o.dead)drawEmote(o);
  ctx.font='600 11px system-ui,sans-serif';ctx.textAlign='center';
  for(const o of others.values())if(!o.dead&&o.n){ctx.fillStyle='#000a';ctx.fillText(o.n,o.x+1,o.y-33);ctx.fillStyle='#ebe5d3';ctx.fillText(o.n,o.x,o.y-34)}
  for(const m of mobs)if(m.stun>0){const h=m.k==='treant'?150:m.k==='boss'?62:m.r*2+10;for(let k=0;k<3;k++){const t=time*5+k*2.09;ctx.fillStyle='#ffe08a';ctx.font='600 11px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText('★',m.x+Math.cos(t)*12,m.y-h+Math.sin(t)*4)}}
  drawPings(cx,cy,hw,hh);
  const u=!placing&&nearestUse(),lab=useLabel(u);
  if(lab){const t=(TOUCH?'':'E  ')+lab;ctx.font='600 11px system-ui,sans-serif';const w=ctx.measureText(t).width+12;ctx.fillStyle='#0d130fcc';ctx.fillRect(P.x-w/2,P.y-46,w,17);ctx.fillStyle='#e0a646';ctx.fillText(t,P.x,P.y-34)}
  if(TOUCH)$('bUse').textContent=lab&&lab.length<=5?lab:'互動';
  const gi=goalIdx();
  if(gi>=4&&!flags.boss){const d=dist(altar,P);if(d>260){const a=Math.atan2(altar.y-P.y,altar.x-P.x),R=44;ctx.save();ctx.translate(P.x+Math.cos(a)*R,P.y+Math.sin(a)*R);ctx.rotate(a);ctx.fillStyle='#e0a646';ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-5,-6);ctx.lineTo(-2,0);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();
    ctx.fillStyle='#e0a646';ctx.font='600 10px system-ui,sans-serif';ctx.fillText(`祭壇 ${Math.round(d/10)}m`,P.x+Math.cos(a)*64,P.y+Math.sin(a)*64+3)}}
}
// boat, bow toward a; bob is the wave phase. Drawn under a sailing player too
function drawBoat(x,y,a,bob){ctx.save();ctx.translate(x,y+Math.sin(bob)*1.2);ctx.rotate(a);
  ctx.fillStyle='rgba(190,225,240,.35)';ctx.beginPath();ctx.ellipse(-2,3,27,11,0,0,6.28);ctx.fill();
  ctx.fillStyle='#5a3d22';ctx.beginPath();ctx.moveTo(24,0);ctx.quadraticCurveTo(14,-12,-20,-10);ctx.lineTo(-22,10);ctx.quadraticCurveTo(14,12,24,0);ctx.closePath();ctx.fill();
  ctx.fillStyle='#8a6236';ctx.beginPath();ctx.moveTo(19,0);ctx.quadraticCurveTo(11,-8,-17,-7);ctx.lineTo(-18,7);ctx.quadraticCurveTo(11,8,19,0);ctx.closePath();ctx.fill();
  ctx.fillStyle='#6b4a2b';ctx.fillRect(-6,-7,3,14);ctx.fillRect(6,-6,3,12);ctx.restore()}
// flames on anything that touched lava
function drawBurn(e){const h=e.k==='treant'?60:e.k==='boss'?26:14;for(let k=0;k<3;k++){const t=time*11+k*2.1+(e.id||0),fx=e.x+Math.sin(t*.7)*6+(k-1)*6,fy=e.y-h*.5,fh=10+Math.sin(t)*4;
  ctx.fillStyle=['rgba(255,110,40,.85)','rgba(255,170,60,.85)','rgba(255,230,140,.9)'][k];ctx.beginPath();ctx.moveTo(fx-4,fy);ctx.quadraticCurveTo(fx-2,fy-fh*.6,fx,fy-fh);ctx.quadraticCurveTo(fx+2,fy-fh*.6,fx+4,fy);ctx.fill()}
  if(Math.random()<.2)parts.push({x:e.x+rnd(-6,6),y:e.y-h*.5-8,vx:rnd(-8,8),vy:-34,t:.6,col:'#ffb347',s:1.6})}
function shadow(x,y,rx,ry){ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,6.28);ctx.fill()}
function drawRes(o){const s=o.sz,f=o.flash>0;o.flash-=1/60;const wob=f?Math.sin(time*60)*1.5:0;
  if(o.dep>0&&MODE==='solo')o.dep-=1/60;
  switch(o.k){
  case'tree':shadow(o.x+4,o.y+4,16*s,7*s);ctx.fillStyle='#d8d2c4';ctx.fillRect(o.x-2.5*s+wob,o.y-14*s,5*s,16*s);ctx.fillStyle='#3a3530';ctx.fillRect(o.x-2.5*s+wob,o.y-8*s,5*s,1.5);
    for(const[dx,dy,r,c]of[[0,-26,16,'#5f8a36'],[-9,-20,11,'#6d9a3e'],[9,-21,11,'#557f30'],[2,-31,10,'#7fae4a']]){ctx.fillStyle=f?'#c9e3a0':c;ctx.beginPath();ctx.arc(o.x+dx*s+wob,o.y+dy*s,r*s,0,6.28);ctx.fill()}break;
  case'etree':{o.g=Math.min(1,(o.g??1)+1/60*2.5);const z=s*(.3+.7*o.g);shadow(o.x+4,o.y+4,15*z,6*z);ctx.strokeStyle=f?'#c9b6a0':'#2a1f17';ctx.lineCap='round';ctx.lineWidth=5*z;ctx.beginPath();ctx.moveTo(o.x,o.y+2);ctx.quadraticCurveTo(o.x-4*z+wob,o.y-10*z,o.x+wob,o.y-20*z);ctx.stroke();
    ctx.lineWidth=2*z;ctx.beginPath();ctx.moveTo(o.x-1+wob,o.y-14*z);ctx.lineTo(o.x-11*z+wob,o.y-24*z);ctx.moveTo(o.x+1+wob,o.y-16*z);ctx.lineTo(o.x+12*z+wob,o.y-27*z);ctx.stroke();
    for(const[dx,dy,r,c]of[[0,-28,12,'#1f2e1c'],[-10,-24,8,'#263821'],[10,-27,8,'#1b2a19'],[1,-36,7,'#2e4426']]){ctx.fillStyle=f?'#9aa88a':c;ctx.beginPath();ctx.arc(o.x+dx*z+wob,o.y+dy*z,r*z,0,6.28);ctx.fill()}
    ctx.fillStyle='#b6ffc4';ctx.fillRect(o.x-3*z+wob,o.y-12*z,2,2);ctx.fillRect(o.x+1.5*z+wob,o.y-12*z,2,2);break}
  case'pine':shadow(o.x+5,o.y+4,17*s,7*s);ctx.fillStyle='#4a3424';ctx.fillRect(o.x-3*s,o.y-8*s,6*s,10*s);
    for(let k=0;k<3;k++){ctx.fillStyle=f?'#7da27a':['#1f3b26','#264730','#2e543a'][k];ctx.beginPath();const yy=o.y-6*s-k*13*s,ww=(19-k*4.5)*s;ctx.moveTo(o.x-ww+wob,yy);ctx.lineTo(o.x+ww+wob,yy);ctx.lineTo(o.x+wob,yy-22*s);ctx.closePath();ctx.fill()}break;
  case'rock':shadow(o.x+3,o.y+5,22*s,8*s);ctx.fillStyle=f?'#c9ccc6':'#7d817c';ctx.beginPath();ctx.moveTo(o.x-21*s+wob,o.y+3);ctx.lineTo(o.x-15*s,o.y-14*s);ctx.lineTo(o.x-2*s,o.y-21*s);ctx.lineTo(o.x+14*s,o.y-15*s);ctx.lineTo(o.x+21*s+wob,o.y);ctx.lineTo(o.x+10*s,o.y+6);ctx.lineTo(o.x-10*s,o.y+6);ctx.closePath();ctx.fill();
    ctx.fillStyle='#989c96';ctx.beginPath();ctx.moveTo(o.x-13*s,o.y-12*s);ctx.lineTo(o.x-2*s,o.y-19*s);ctx.lineTo(o.x+6*s,o.y-10*s);ctx.lineTo(o.x-6*s,o.y-7*s);ctx.closePath();ctx.fill();break;
  case'coal':case'copper':case'tin':case'iron':{const d=RES[o.k];shadow(o.x+3,o.y+5,20*s,8*s);ctx.fillStyle=f?'#c9ccc6':d.base;ctx.beginPath();ctx.moveTo(o.x-19*s+wob,o.y+3);ctx.lineTo(o.x-13*s,o.y-13*s);ctx.lineTo(o.x-1*s,o.y-19*s);ctx.lineTo(o.x+13*s,o.y-12*s);ctx.lineTo(o.x+19*s+wob,o.y);ctx.lineTo(o.x+9*s,o.y+6);ctx.lineTo(o.x-9*s,o.y+6);ctx.closePath();ctx.fill();
    ctx.fillStyle=d.ore;for(const[dx,dy,r]of[[-9,-6,3.4],[2,-12,2.8],[8,-4,3.2],[-2,-1,2.2],[11,-10,2]]){ctx.beginPath();ctx.arc(o.x+dx*s,o.y+dy*s,r*s,0,6.28);ctx.fill()}
    ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(o.x-10*s,o.y-14*s,6*s,2*s);break}
  case'pebble':ctx.fillStyle='#8b8f88';ctx.beginPath();ctx.ellipse(o.x,o.y,5,3.5,.3,0,6.28);ctx.fill();ctx.fillStyle='#a6aaa3';ctx.beginPath();ctx.ellipse(o.x-1,o.y-1,2.5,1.5,.3,0,6.28);ctx.fill();break;
  case'flint':ctx.fillStyle='#3d4d5c';ctx.beginPath();ctx.moveTo(o.x-5,o.y+2);ctx.lineTo(o.x-1,o.y-5);ctx.lineTo(o.x+5,o.y-1);ctx.lineTo(o.x+2,o.y+3);ctx.closePath();ctx.fill();ctx.fillStyle='#7d93a8';ctx.fillRect(o.x-1,o.y-3,2,2);break;
  case'bush':shadow(o.x+2,o.y+3,13,5);ctx.fillStyle='#3f6a2c';ctx.beginPath();ctx.arc(o.x-5,o.y-6,8,0,6.28);ctx.arc(o.x+5,o.y-6,8,0,6.28);ctx.arc(o.x,o.y-11,8,0,6.28);ctx.fill();
    if(o.dep<=0){ctx.fillStyle='#d23a52';for(const[dx,dy]of[[-6,-8],[4,-11],[6,-4],[-1,-4],[0,-14]]){ctx.beginPath();ctx.arc(o.x+dx,o.y+dy,1.8,0,6.28);ctx.fill()}}break;
  case'mtree':{shadow(o.x+4,o.y+4,16*s,7*s);ctx.fillStyle='#cfc6e8';ctx.fillRect(o.x-2.5*s+wob,o.y-14*s,5*s,16*s);const tw=.75+Math.sin(time*2+o.cell)*.25;
    for(const[dx,dy,r,c]of[[0,-26,16,'#5a3f9a'],[-9,-20,11,'#6a4cb0'],[9,-21,11,'#4e3788'],[2,-31,10,'#7d5fd0']]){ctx.fillStyle=f?'#e0d4ff':c;ctx.beginPath();ctx.arc(o.x+dx*s+wob,o.y+dy*s,r*s,0,6.28);ctx.fill()}
    ctx.fillStyle=`rgba(150,240,255,${tw})`;for(const[dx,dy]of[[-8,-24],[6,-30],[9,-18],[-2,-20]])ctx.fillRect(o.x+dx*s-1,o.y+dy*s-1,2.4,2.4);break}
  case'crystal':{shadow(o.x+3,o.y+5,15*s,6*s);const tw=.8+Math.sin(time*2.4+o.cell)*.2;
    for(const[dx,h,w,c]of[[-8,20,6,'#6c4fd6'],[7,16,6,'#7f63e6'],[0,30,8,'#a58bff']]){ctx.fillStyle=f?'#fff':c;ctx.beginPath();ctx.moveTo(o.x+(dx-w)*s+wob,o.y+2);ctx.lineTo(o.x+dx*s+wob,o.y-h*s);ctx.lineTo(o.x+(dx+w)*s+wob,o.y+2);ctx.closePath();ctx.fill()}
    ctx.fillStyle=`rgba(225,215,255,${tw})`;ctx.beginPath();ctx.moveTo(o.x-2*s,o.y-4);ctx.lineTo(o.x,o.y-26*s);ctx.lineTo(o.x+1.5*s,o.y-6);ctx.closePath();ctx.fill();break}
  case'glowshroom':{const tw=.6+Math.sin(time*3+o.cell)*.4;ctx.fillStyle=`rgba(110,224,255,${.18*tw})`;ctx.beginPath();ctx.arc(o.x,o.y-5,10,0,6.28);ctx.fill();
    ctx.fillStyle='#d8f4ff';ctx.fillRect(o.x-1.5,o.y-5,3,5);ctx.fillStyle='#4fc8ef';ctx.beginPath();ctx.arc(o.x,o.y-5,5,Math.PI,0);ctx.fill();ctx.fillStyle='#e8fdff';ctx.fillRect(o.x-2,o.y-8,1.5,1.5);ctx.fillRect(o.x+1.5,o.y-7,1.2,1.2);break}
  case'shroom':ctx.fillStyle='#e8dcc0';ctx.fillRect(o.x-1.5,o.y-5,3,5);ctx.fillStyle='#d9782f';ctx.beginPath();ctx.arc(o.x,o.y-5,5,Math.PI,0);ctx.fill();ctx.fillStyle='#f3e4c8';ctx.fillRect(o.x-2,o.y-8,1.5,1.5);break;
  }}
function drawStruct(s){const x=s.x,y=s.y;
  switch(s.k){
  case'wall':
    if(s.o==='v'){ // 南北向：木樁由北往南疊，看起來是一道薄薄的柵欄
      for(let k=0;k<9;k++){const py=y-20+k*5;ctx.fillStyle=k%2?'#8a6236':'#7a5530';ctx.fillRect(x-4,py-34,8,38);ctx.fillStyle='#5a3d22';ctx.fillRect(x+2,py-34,2,38);ctx.fillStyle='#3d2a17';ctx.beginPath();ctx.moveTo(x-4,py-34);ctx.lineTo(x,py-39);ctx.lineTo(x+4,py-34);ctx.fill()}break}
    ctx.fillStyle='#5a3d22';ctx.fillRect(x-20,y-30,40,36);for(let k=0;k<4;k++){ctx.fillStyle=k%2?'#8a6236':'#7a5530';ctx.fillRect(x-19+k*10,y-34,9,38);ctx.fillStyle='#3d2a17';ctx.beginPath();ctx.moveTo(x-19+k*10,y-34);ctx.lineTo(x-14.5+k*10,y-39);ctx.lineTo(x-10+k*10,y-34);ctx.fill()}ctx.fillStyle='#3d2a17';ctx.fillRect(x-20,y-24,40,3);break;
  case'swall':
    if(s.o==='v'){for(let k=0;k<9;k++){const py=y-20+k*5;ctx.fillStyle=k%2?'#9a9e98':'#8a8e88';ctx.fillRect(x-5,py-28,10,32);ctx.fillStyle='#6d716b';ctx.fillRect(x+3,py-28,2,32);ctx.fillStyle='#b4b8b1';ctx.fillRect(x-5,py-30,10,3)}break}
    ctx.fillStyle='#6d716b';ctx.fillRect(x-20,y-28,40,34);
    for(let r=0;r<4;r++)for(let k=0;k<4;k++){const bx=x-20+k*14-(r%2?7:0),w0=Math.max(x-20,bx),w1=Math.min(x+20,bx+13);if(w1<=w0)continue;ctx.fillStyle=(r+k)%2?'#9a9e98':'#8a8e88';ctx.fillRect(w0,y-27+r*8,w1-w0,7)}
    ctx.fillStyle='#b4b8b1';ctx.fillRect(x-20,y-31,40,4);break;
  case'furnace':{const lit=s.fz&&s.fz.burn>0;shadow(x+2,y+6,20,6);ctx.fillStyle='#6d716b';ctx.fillRect(x-17,y-22,34,28);ctx.beginPath();ctx.arc(x,y-22,17,Math.PI,0);ctx.fill();
    ctx.fillStyle='#8a8e88';for(const[dx,dy]of[[-12,-14],[4,-18],[-4,-4],[9,-6],[-10,-26],[6,-30]])ctx.fillRect(x+dx,y+dy,7,4);
    ctx.fillStyle='#5a5e58';ctx.fillRect(x+6,y-46,8,12);
    ctx.fillStyle='#1b1512';ctx.beginPath();ctx.moveTo(x-8,y+4);ctx.lineTo(x-8,y-8);ctx.arc(x,y-8,8,Math.PI,0);ctx.lineTo(x+8,y+4);ctx.fill();
    if(lit){const t=time*9+s.anim;ctx.fillStyle='#ff7a2a';ctx.fillRect(x-7,y-4+Math.sin(t)*1,14,8);ctx.fillStyle='#ffd27a';ctx.fillRect(x-4,y-1+Math.sin(t*1.3),8,5);
      if(Math.random()<.12)parts.push({x:x+10,y:y-48,vx:rnd(-4,4),vy:-22,t:1.2,col:'rgba(120,120,120,.6)',s:3})}break}
  case'bench':shadow(x+2,y+6,22,6);ctx.fillStyle='#6b4a2b';ctx.fillRect(x-20,y-4,4,10);ctx.fillRect(x+16,y-4,4,10);ctx.fillStyle='#8f6a3e';ctx.fillRect(x-22,y-14,44,12);ctx.fillStyle='#a87d4a';ctx.fillRect(x-22,y-14,44,3);
    ctx.fillStyle='#56697c';ctx.fillRect(x-14,y-20,10,4);ctx.fillStyle='#5a3d22';ctx.fillRect(x+2,y-19,14,2.5);ctx.fillStyle='#c8c2b2';ctx.fillRect(x+10,y-22,5,7);break;
  case'fire':{ctx.fillStyle='#6f6f6a';for(let k=0;k<7;k++){const a=k/7*6.28;ctx.beginPath();ctx.arc(x+Math.cos(a)*11,y+Math.sin(a)*6,3.5,0,6.28);ctx.fill()}ctx.fillStyle='#4a3020';ctx.fillRect(x-7,y-2,14,3);
    const t=time*10+s.anim;for(let k=0;k<3;k++){const h=12+Math.sin(t+k*2)*4;ctx.fillStyle=['#ff7a2a','#ffb347','#ffe08a'][k];ctx.beginPath();ctx.moveTo(x-6+k*2,y);ctx.quadraticCurveTo(x-3+Math.sin(t*.7+k)*3,y-h,x+Math.sin(t+k)*2,y-h-4+k*3);ctx.quadraticCurveTo(x+4,y-h*.6,x+6-k*2,y);ctx.fill()}
    if(Math.random()<.15)parts.push({x:x+rnd(-4,4),y:y-14,vx:rnd(-8,8),vy:-30,t:.8,col:'#ffb347',s:1.6});break}
  case'boat':drawBoat(x,y,0,time*1.7+s.anim);break;
  case'anvil':shadow(x+2,y+6,16,5);ctx.fillStyle='#5a5e58';ctx.fillRect(x-11,y-2,22,7);ctx.fillStyle='#6d716b';ctx.fillRect(x-6,y-10,12,9);
    ctx.fillStyle='#8a8e88';ctx.beginPath();ctx.moveTo(x-15,y-18);ctx.lineTo(x+9,y-18);ctx.quadraticCurveTo(x+18,y-17,x+19,y-13);ctx.lineTo(x+8,y-12);ctx.lineTo(x+6,y-10);ctx.lineTo(x-6,y-10);ctx.lineTo(x-9,y-13);ctx.lineTo(x-15,y-13);ctx.closePath();ctx.fill();
    ctx.fillStyle='#b4b8b1';ctx.fillRect(x-15,y-18,24,2);break;
  case'rack':shadow(x+2,y+6,18,5);ctx.fillStyle='#6b4a2b';ctx.fillRect(x-16,y-34,4,40);ctx.fillRect(x+12,y-34,4,40);ctx.fillStyle='#8f6a3e';ctx.fillRect(x-16,y-30,32,4);ctx.fillRect(x-16,y-10,32,4);
    ctx.strokeStyle='#9aa3ab';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-7,y-26);ctx.lineTo(x-7,y-13);ctx.moveTo(x,y-26);ctx.lineTo(x,y-11);ctx.moveTo(x+7,y-26);ctx.lineTo(x+7,y-14);ctx.stroke();
    ctx.fillStyle='#c8cfd5';ctx.fillRect(x-10,y-15,6,3);ctx.fillRect(x+4,y-16,6,3);break;
  case'pot':{shadow(x+2,y+6,14,5);ctx.strokeStyle='#2a2c28';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-9,y+4);ctx.lineTo(x-11,y+8);ctx.moveTo(x+9,y+4);ctx.lineTo(x+11,y+8);ctx.stroke();
    ctx.fillStyle='#3d403b';ctx.beginPath();ctx.ellipse(x,y-6,13,11,0,0,Math.PI);ctx.lineTo(x-13,y-8);ctx.fill();ctx.fillStyle='#6d716b';ctx.fillRect(x-14,y-10,28,4);
    const lit=potLit(s);ctx.fillStyle=lit?'#c98a4a':'#2a2c28';ctx.beginPath();ctx.ellipse(x,y-10,11,3,0,0,6.28);ctx.fill();
    if(lit&&Math.random()<.08)parts.push({x:x+rnd(-6,6),y:y-14,vx:rnd(-3,3),vy:-18,t:1.4,col:'rgba(220,230,240,.5)',s:3});break}
  case'chair':shadow(x+2,y+6,10,4);ctx.fillStyle='#6b4a2b';ctx.fillRect(x-8,y-4,3,10);ctx.fillRect(x+5,y-4,3,10);ctx.fillStyle='#8f6a3e';ctx.fillRect(x-9,y-8,18,5);
    ctx.fillStyle='#6b4a2b';ctx.fillRect(x-9,y-26,3,19);ctx.fillRect(x+6,y-26,3,19);ctx.fillStyle='#a87d4a';ctx.fillRect(x-9,y-24,18,4);ctx.fillRect(x-9,y-17,18,3);break;
  case'rug':ctx.fillStyle='#6b4e34';ctx.beginPath();ctx.ellipse(x,y,19,12,0,0,6.28);ctx.fill();ctx.fillStyle='#8a6a4a';ctx.beginPath();ctx.ellipse(x,y,17,10,0,0,6.28);ctx.fill();
    ctx.fillStyle='#a8845a';ctx.beginPath();ctx.ellipse(x,y,11,6,0,0,6.28);ctx.fill();ctx.strokeStyle='#6b4e34';ctx.lineWidth=1.4;ctx.beginPath();for(const[a,b]of[[-19,-3],[19,-3],[-14,9],[14,9]]){ctx.moveTo(x+a,y+b);ctx.lineTo(x+a*1.15,y+b*1.3)}ctx.stroke();break;
  case'banner':{shadow(x+2,y+5,8,3);ctx.fillStyle='#6b4a2b';ctx.fillRect(x-7,y-46,3,50);const wv=Math.sin(time*2+s.anim)*1.5;
    ctx.fillStyle='#a83a32';ctx.beginPath();ctx.moveTo(x-4,y-44);ctx.lineTo(x+14,y-44+wv);ctx.lineTo(x+14,y-22+wv);ctx.lineTo(x+5,y-27);ctx.lineTo(x-4,y-22);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e0a646';ctx.beginPath();ctx.arc(x+5,y-36+wv/2,3.5,0,6.28);ctx.fill();break}
  case'plot':{ctx.fillStyle='#4a3020';ctx.fillRect(x-19,y-15,38,30);ctx.strokeStyle='#33200f';ctx.lineWidth=2;for(let k=-1;k<=1;k++){ctx.beginPath();ctx.moveTo(x-17,y+k*9);ctx.lineTo(x+17,y+k*9);ctx.stroke()}
    ctx.strokeStyle='#6b4a2b';ctx.lineWidth=1.5;ctx.strokeRect(x-19,y-15,38,30);
    const c=s.crop;if(c){const pr=Math.min(1,1-c.g/CROPS[c.k].t),h=3+pr*9;for(let k=-1;k<=1;k++)for(const dx of[-10,0,10]){const px=x+dx,py=y+k*9;
      if(c.g<=0){ctx.fillStyle='#e07a2a';ctx.beginPath();ctx.arc(px,py,2.6,0,6.28);ctx.fill()}
      ctx.strokeStyle=c.g<=0?'#7fc04a':'#6fae3e';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-2,py-h);ctx.moveTo(px,py);ctx.lineTo(px+2,py-h*.85);ctx.stroke()}}break}
  case'chest':shadow(x+2,y+6,17,5);ctx.fillStyle='#6b4a2b';ctx.fillRect(x-15,y-14,30,20);ctx.fillStyle='#8f6a3e';ctx.fillRect(x-15,y-21,30,9);ctx.fillStyle='#a87d4a';ctx.fillRect(x-15,y-21,30,2);
    ctx.fillStyle='#3d2a17';ctx.fillRect(x-15,y-12,30,2);ctx.fillStyle='#4a3020';ctx.fillRect(x-15,y-21,3,27);ctx.fillRect(x+12,y-21,3,27);ctx.fillStyle='#d9b85a';ctx.fillRect(x-2.5,y-14,5,6);break;
  case'lamp':{shadow(x+2,y+5,10,4);ctx.fillStyle='#6d716b';ctx.fillRect(x-7,y-4,14,6);ctx.fillStyle='#8a8e88';ctx.fillRect(x-2.5,y-24,5,21);
    const tw=.8+Math.sin(time*3+s.anim)*.2,g=ctx.createRadialGradient(x,y-32,0,x,y-32,20);g.addColorStop(0,`rgba(190,170,255,${.6*tw})`);g.addColorStop(1,'rgba(150,120,255,0)');ctx.fillStyle=g;ctx.fillRect(x-20,y-52,40,40);
    ctx.fillStyle='#a58bff';ctx.beginPath();ctx.moveTo(x-6,y-26);ctx.lineTo(x,y-42);ctx.lineTo(x+6,y-26);ctx.lineTo(x,y-22);ctx.closePath();ctx.fill();ctx.fillStyle='#e6deff';ctx.fillRect(x-1.2,y-37,2.4,9);break}
  case'bed':shadow(x+2,y+8,18,6);ctx.fillStyle='#6b4a2b';ctx.fillRect(x-16,y-18,32,26);ctx.fillStyle='#e6dcc4';ctx.fillRect(x-13,y-15,26,7);ctx.fillStyle='#7a3b33';ctx.fillRect(x-13,y-8,26,13);ctx.fillStyle='#9a5a3e';ctx.fillRect(x-13,y-8,26,2);break;
  case'altar':{shadow(x+3,y+8,32,10);ctx.fillStyle='#55605c';ctx.fillRect(x-30,y-8,60,16);ctx.fillStyle='#6d7873';ctx.fillRect(x-30,y-8,60,4);
    ctx.fillStyle='#5f6a66';ctx.beginPath();ctx.moveTo(x-14,y-6);ctx.lineTo(x-12,y-54);ctx.lineTo(x,y-62);ctx.lineTo(x+12,y-54);ctx.lineTo(x+14,y-6);ctx.closePath();ctx.fill();
    const glow=`rgba(224,166,70,${.6+Math.sin(time*2)*.3})`;ctx.strokeStyle=glow;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-50);ctx.lineTo(x,y-18);ctx.moveTo(x,y-44);ctx.lineTo(x+6,y-36);ctx.moveTo(x,y-34);ctx.lineTo(x-6,y-26);ctx.stroke();
    ctx.fillStyle='#d8d2c4';for(const dx of[-22,22]){ctx.beginPath();ctx.ellipse(x+dx,y-2,4,2.5,0,0,6.28);ctx.fill()}break}
  }}
// boar art, facing +x. Paths are built once so 20-odd boars stay cheap to draw
const BOAR_LEGS=[[-10,-9,1],[-10,9,-1],[7,-10,-1],[7,10,1]];
const BOAR_MANE=(()=>{const p=new Path2D();p.moveTo(10,0);for(let i=0;i<=8;i++)p.lineTo(8-i*2.8,-(i%2?4.6:2.6)*(1-i*.06));p.lineTo(-16,0);for(let i=8;i>=0;i--)p.lineTo(8-i*2.8,(i%2?4.6:2.6)*(1-i*.06));p.closePath();return p})();
const BOAR_FUR_D=(()=>{const p=new Path2D();for(const[x,y]of[[-13,5.5],[-8,6.5],[-3,6.8],[2,7.5],[7,7.5]])for(const s of[-1,1]){p.moveTo(x+3,s*y);p.lineTo(x-1,s*(y+1.8))}return p})();
const BOAR_FUR_L=(()=>{const p=new Path2D();for(const[x,y]of[[-10.5,4.6],[-5.5,5],[-.5,5.2],[4.5,5.6]])for(const s of[-1,1]){p.moveTo(x+2.5,s*y);p.lineTo(x-.5,s*(y+1.4))}return p})();
function drawBoar(m,f){const angry=m.aggro>0,walk=Math.abs(m.x-(m.lx??m.x))+Math.abs(m.y-(m.ly??m.y))>.02;m.lx=m.x;m.ly=m.y;
  const c=k=>f?'#fff':k,el=(x,y,rx,ry,k)=>{ctx.fillStyle=c(k);ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,6.28);ctx.fill()};
  const w=Math.sin(m.anim*12),stride=w*(angry?3.5:walk?2.4:0);
  shadow(m.x,m.y+6,17,7);ctx.save();ctx.translate(m.x,m.y-6+w*(angry?1.5:.6));ctx.rotate(m.face);ctx.lineCap='round';ctx.lineJoin='round';
  // legs and hooves step in diagonal pairs
  for(const[lx,ly,s]of BOAR_LEGS){const x=lx+stride*s;el(x,ly,4.2,2.7,'#3a271d');el(x+2.3,ly,1.7,2,'#1c1310')}
  // curly tail
  const tw=Math.sin(m.anim*(angry?16:7))*2;ctx.strokeStyle=c('#2f1f17');ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(-15,0);ctx.bezierCurveTo(-19,-3+tw,-23,1+tw,-19,3+tw);ctx.stroke();
  // body: dark rim first, then rump and heavier shoulders
  el(-6,0,11,10,'#33221a');el(0,0,11,10.6,'#33221a');el(5,0,10,11,'#33221a');el(-6,0,10,9,'#5e4232');el(0,0,10,9.6,'#614534');el(5,0,9,10,'#664a38');
  ctx.lineWidth=1.1;ctx.strokeStyle=c('#3e2a1f');ctx.stroke(BOAR_FUR_D);ctx.strokeStyle=c('#735644');ctx.stroke(BOAR_FUR_L);
  // spine bristles stand up when angry
  ctx.save();if(angry)ctx.scale(1,1.35);ctx.fillStyle=c('#2a1a13');ctx.fill(BOAR_MANE);ctx.strokeStyle=c('#4a3225');ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-13,0);ctx.stroke();ctx.restore();
  // ears (pinned back when angry), head, snout
  const et=angry?[3.5,8.5]:[5.5,11];
  for(const s of[-1,1]){ctx.fillStyle=c('#3e2a1f');ctx.beginPath();ctx.moveTo(10,s*4.5);ctx.lineTo(13,s*6.5);ctx.lineTo(et[0],s*et[1]);ctx.closePath();ctx.fill();
    ctx.fillStyle=c('#a07762');ctx.beginPath();ctx.moveTo(9.8,s*5.6);ctx.lineTo(11.3,s*6.4);ctx.lineTo(et[0]+2,s*(et[1]-1.7));ctx.closePath();ctx.fill()}
  el(13,0,7.5,7,'#6e5040');el(11,0,4.8,3.4,'#4f3728');el(19,0,3.9,4.3,'#8b6a56');
  // tusks curve up and out of the snout
  ctx.strokeStyle=c('#efe7d0');ctx.lineWidth=1.7;ctx.beginPath();for(const s of[-1,1]){ctx.moveTo(18.5,s*3.4);ctx.quadraticCurveTo(21.5,s*4,21.8,s*6.2)}ctx.stroke();
  // nose disc, nostrils, eyes (red when angry)
  el(21.6,0,1.8,3.1,'#2b1c16');el(22.1,-1.2,.6,.7,'#0d0806');el(22.1,1.2,.6,.7,'#0d0806');
  for(const s of[-1,1]){el(15,s*4.1,1.5,1.5,angry?'#d13c2a':'#1a1210');ctx.fillStyle='#fff';ctx.fillRect(15.2,s*4.1-.7,.7,.7)}
  ctx.restore()}
function drawMob(m){const f=m.flash>0,a=m.face,c=Math.cos(a),sn=Math.sin(a);
  if(m.k==='boar')drawBoar(m,f);
  else if(m.k==='moss')drawMoss(m,f,c,sn);
  else if(m.k==='treant')drawTreant(m,f);
  else if(m.k==='frog')drawFrog(m,f);
  else if(m.k==='sprout')drawSprout(m,f);
  else{const rw=m.state==='rwind';if(rw){const p=.5+Math.sin(time*18)*.5;ctx.fillStyle=`rgba(120,255,140,${.14+p*.12})`;ctx.strokeStyle=`rgba(170,255,175,${.65+p*.35})`;ctx.lineWidth=3;ctx.setLineDash([8,6]);ctx.beginPath();ctx.ellipse(m.x,m.y,ROAR_R,ROAR_R*.75,0,0,6.28);ctx.fill();ctx.stroke();ctx.setLineDash([])}
    const wind=m.state==='wind',cw=m.state==='cwind';ctx.save();ctx.translate(m.x,m.y);ctx.rotate(a);
    if(wind){ctx.fillStyle=`rgba(255,80,60,${.35+Math.sin(time*30)*.2})`;ctx.beginPath();ctx.ellipse(6,0,46,26,0,0,6.28);ctx.fill()}
    if(rw){ctx.fillStyle=`rgba(130,255,150,${.55+Math.sin(time*30)*.2})`;ctx.beginPath();ctx.ellipse(-2,0,50,34,0,0,6.28);ctx.fill()}
    if(cw){ctx.fillStyle=`rgba(255,180,70,${.35+Math.sin(time*30)*.2})`;ctx.beginPath();ctx.ellipse(18,0,42,30,0,0,6.28);ctx.fill();
      ctx.strokeStyle='#ffe3a8';ctx.lineWidth=2;for(const sy of[-1,1])for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(22,sy*(14+j*3));ctx.lineTo(32,sy*(18+j*3));ctx.stroke()}}
    ctx.restore();drawWolf(m,f)}
  if(m.hp<m.max&&m.k!=='boss'&&m.k!=='treant'){const w=m.r*2,by=m.k==='frog'?m.y-58:m.y-m.r*2-12;ctx.fillStyle='#000a';ctx.fillRect(m.x-w/2,by,w,3);ctx.fillStyle='#d55a4a';ctx.fillRect(m.x-w/2,by,w*m.hp/m.max,3)}}
// devour magic, under the elder: two glowing rings, petals turning one way and runes the other
const RUNE7=[["...x...","..x.x..",".x...x.","x..x..x",".x...x.","..x.x..","...x..."],["x..x..x",".x.x.x.","..xxx..","...x...","...x...","..x.x..",".x...x."],[".......",".xx.xx.","x..x..x",".......",".xx.xx.","x..x..x","......."],["..xxx..",".x.x.x.","x..x..x","xxxxxxx","x..x..x",".x.x.x.","..xxx.."]];
function drawEatCircle(m){const k=m.eatFx,R=96,p=.75+.25*Math.sin(time*6);ctx.save();ctx.translate(m.x,m.y);ctx.scale(1,.45);ctx.globalAlpha=k;
  ctx.fillStyle=`rgba(90,220,120,${.12*p})`;ctx.beginPath();ctx.arc(0,0,R,0,6.28);ctx.fill();
  ctx.strokeStyle=`rgba(170,255,190,${.85*p})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,R,0,6.28);ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,R*.72,0,6.28);ctx.stroke();
  ctx.save();ctx.rotate(time*.8);ctx.fillStyle=`rgba(120,240,140,${.35*p})`;for(let i=0;i<6;i++){ctx.rotate(1.047);ctx.beginPath();ctx.ellipse(R*.36,0,R*.3,R*.1,0,0,6.28);ctx.fill()}ctx.restore();
  for(let i=0;i<8;i++){const a=i/8*6.28-time*.6,g=RUNE7[i%4],rx=Math.cos(a)*R*.86,ry=Math.sin(a)*R*.86;ctx.fillStyle=`rgba(210,255,215,${.6+.4*Math.sin(time*5+i)})`;
    for(let y=0;y<7;y++)for(let x=0;x<7;x++)if(g[y][x]==='x')ctx.fillRect(rx+(x-3.5)*2,ry+(y-3.5)*4.4,2,4.4)}
  ctx.restore()}
// devour magic, over everything: streams of life with motes flowing to the elder, spiralling leaves, a leaf-green shield
function drawEatFx(m){
  for(const o of mobs){if(o.k!=='sprout'||o.state!=='recall')continue;const x0=o.x,y0=o.y-10,x1=m.x,y1=m.y-60,mx=(x0+x1)/2+Math.sin(time*4+o.id)*30,my=Math.min(y0,y1)-50+Math.cos(time*3+o.id)*12;
    const path=()=>{ctx.beginPath();ctx.moveTo(x0,y0);ctx.quadraticCurveTo(mx,my,x1,y1)};
    ctx.lineCap='round';path();ctx.strokeStyle='rgba(120,255,150,.18)';ctx.lineWidth=9;ctx.stroke();path();ctx.strokeStyle='rgba(200,255,210,.75)';ctx.lineWidth=2;ctx.stroke();
    for(let k=0;k<4;k++){const u=(time*1.4+k/4+o.id*.13)%1,v=1-u,px=v*v*x0+2*v*u*mx+u*u*x1,py=v*v*y0+2*v*u*my+u*u*y1;ctx.fillStyle='rgba(120,255,150,.35)';ctx.beginPath();ctx.arc(px,py,6,0,6.28);ctx.fill();ctx.fillStyle='#eafff0';ctx.beginPath();ctx.arc(px,py,2.6,0,6.28);ctx.fill()}
    ctx.fillStyle=`rgba(140,255,160,${.25+.15*Math.sin(time*10+o.id)})`;ctx.beginPath();ctx.ellipse(o.x,o.y,16,7,0,0,6.28);ctx.fill()}
  for(const l of leaves){ctx.save();ctx.translate(l.cx+Math.cos(l.a)*l.r,l.cy+Math.sin(l.a)*l.r*.6);ctx.rotate(l.spin);ctx.globalAlpha=Math.min(1,l.t*2);ctx.fillStyle=l.col;ctx.beginPath();ctx.ellipse(0,0,4.5,2,0,0,6.28);ctx.fill();ctx.restore()}ctx.globalAlpha=1;
  const k=m.eatFx||0;if(k>0){const p=.7+.3*Math.sin(time*7);ctx.fillStyle=`rgba(110,240,140,${.1*k})`;ctx.strokeStyle=`rgba(190,255,200,${.7*k*p})`;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(m.x,m.y-58,62,86,0,0,6.28);ctx.fill();ctx.stroke();
    ctx.strokeStyle=`rgba(230,255,235,${.6*k})`;ctx.lineWidth=2;for(let i=0;i<3;i++){const a=time*2+i*2.09;ctx.beginPath();ctx.ellipse(m.x,m.y-58,62,86,0,a,a+.7);ctx.stroke()}}}
// a sapling eaten: a ring and petals bursting out of the elder
function drawBloom(x){const k=1-x.t/x.T;ctx.strokeStyle=`rgba(170,255,190,${1-k})`;ctx.lineWidth=4*(1-k)+1;ctx.beginPath();ctx.ellipse(x.x,x.y,20+70*k,(20+70*k)*.6,0,0,6.28);ctx.stroke();
  ctx.fillStyle=`rgba(200,255,210,${.8*(1-k)})`;for(let i=0;i<8;i++){const a=i/8*6.28+k*2,r=10+55*k;ctx.beginPath();ctx.ellipse(x.x+Math.cos(a)*r,x.y+Math.sin(a)*r*.6,5*(1-k)+1,2.2,a,0,6.28);ctx.fill()}}
// sapling the Treant Elder calls: a walking stump with a leaf crown
function drawSprout(m,f){const k=q=>f?'#fff':q,b=Math.abs(Math.sin(m.anim*8))*2.5,sw=Math.sin(m.anim*8),fl=Math.cos(m.face)<0?-1:1;
  shadow(m.x,m.y+5,11,4);ctx.save();ctx.translate(m.x,m.y-b);ctx.scale(fl,1);ctx.lineCap='round';
  ctx.strokeStyle=k('#3b2a1c');ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(-4-sw*2,6+b);ctx.moveTo(3,0);ctx.lineTo(4+sw*2,6+b);ctx.stroke();
  ctx.fillStyle=k('#6b4e34');ctx.beginPath();ctx.ellipse(0,-8,6,9,0,0,6.28);ctx.fill();
  ctx.strokeStyle=k('#4a3424');ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-2,-14);ctx.lineTo(-1,-3);ctx.stroke();
  ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,-9);ctx.lineTo(-11,-14+sw*2);ctx.moveTo(5,-9);ctx.lineTo(11,-13-sw*2);ctx.stroke();
  for(const[x,y,r,c]of[[0,-19,7,'#3f6a2a'],[-5,-16,5,'#4f7d32'],[5,-17,5,'#36592a']]){ctx.fillStyle=k(c);ctx.beginPath();ctx.arc(x,y,r,0,6.28);ctx.fill()}
  ctx.fillStyle='#b6ffc4';ctx.fillRect(0,-11,2,2);ctx.fillRect(3.5,-11,2,2);ctx.restore()}
// moss sprite: lumpy body, sprouting leaf and toadstool, drawn around its own centre
const MOSS_DARK=(()=>{const p=new Path2D();for(const[x,y,r]of[[-5,-5,3.6],[5,2,3.2],[-6,5,2.6],[6,-6,2.2],[0,7,2]]){p.moveTo(x+r,y);p.arc(x,y,r,0,6.28)}return p})();
const MOSS_LIGHT=(()=>{const p=new Path2D();for(const[x,y,r]of[[-2,-9,2.8],[3,-8.5,2],[-8,-3,1.8],[8,-2,1.6],[-3,0,1.2],[2,4,1.1]]){p.moveTo(x+r,y);p.arc(x,y,r,0,6.28)}return p})();
function drawMoss(m,f,c,sn){const k=q=>f?'#fff':q,b=Math.abs(Math.sin(m.anim*9))*3,sw=Math.sin(m.anim*9),el=(x,y,rx,ry,q)=>{ctx.fillStyle=k(q);ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,6.28);ctx.fill()};
  shadow(m.x,m.y+5,12,4);ctx.save();ctx.translate(m.x,m.y-9-b);ctx.lineCap='round';
  // root arms with little forks, roots trailing under the body
  ctx.strokeStyle=k('#3a4d26');ctx.lineWidth=2;ctx.beginPath();for(const s of[-1,1]){const h=7+sw*s*1.5;ctx.moveTo(s*10,1);ctx.quadraticCurveTo(s*14,2,s*15.5,h);ctx.moveTo(s*14,4);ctx.lineTo(s*18,h-1)}
  ctx.moveTo(-5,10);ctx.lineTo(-7,13+b*.6);ctx.moveTo(0,11);ctx.lineTo(0,14+b*.6);ctx.moveTo(5,10);ctx.lineTo(7,13+b*.6);ctx.stroke();
  // body: rim, base, shaded underside, clumps of moss
  el(0,0,11.8,11.8,'#2f4220');el(0,0,11,11,'#5e7a43');el(0,3.5,9.5,7,'#4f6a38');ctx.fillStyle=k('#3f5a2b');ctx.fill(MOSS_DARK);ctx.fillStyle=k('#8aa85a');ctx.fill(MOSS_LIGHT);
  // leaf sprout and toadstool on top
  ctx.strokeStyle=k('#3a4d26');ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(1,-11);ctx.quadraticCurveTo(1+sw,-15,3+sw*2,-17);ctx.stroke();
  ctx.save();ctx.translate(3+sw*2,-17);ctx.rotate(-.5+sw*.2);el(3,0,4,1.8,'#9dbf62');ctx.restore();
  el(-5,-10,1.2,2.4,'#e9e2c8');el(-5,-12,3.6,2.3,'#b5452f');ctx.fillStyle=k('#f2e7cf');ctx.fillRect(-6.8,-13,1.1,1.1);ctx.fillRect(-4.2,-13.3,1.1,1.1);
  // eyes keep their old spot so the night glow lines up; dark sockets and a mouth make the face
  const ex=c*6,ey=sn*4-1,px=-sn*3,py=c*3;el(ex+px,ey+py,2.6,2.6,'#1f2c14');el(ex-px,ey-py,2.6,2.6,'#1f2c14');ctx.fillStyle='#ffe37a';ctx.fillRect(ex+px-1.25,ey+py-1.25,2.5,2.5);ctx.fillRect(ex-px-1.25,ey-py-1.25,2.5,2.5);
  el(c*8,sn*5+3,2.2,1.1,'#1f2c14');ctx.restore()}
// a pointed fur lock added to path p (the player's hair and beard are built from these)
const wolfLock=(p,x,y,len,wid,ang)=>{const c=Math.cos(ang),s=Math.sin(ang);p.moveTo(x-s*wid/2,y+c*wid/2);p.lineTo(x+c*len,y+s*len);p.lineTo(x+s*wid/2,y-c*wid/2);p.closePath()};
// Wolf King (and the pup, drawn smaller): a jointed rig in 3D (x = its right, y = down, z = its forward), seen from one of 8 facings.
// Real wolf build: long legs, deep chest, tucked waist, long neck, small head and long muzzle, upright ears, a bushy tail that hangs.
// Legs are shoulder/elbow/wrist/paw and hip/knee/hock/paw, each one tapering shape, so the joints bend with no seams.
// The camera looks down a little, so nearer parts sit lower on screen (WK_KT)
const WK_INK='#1e2226',WK_FUR='#7b8389',WK_FUR_D='#5f676d',WK_SADDLE='#4d545a',WK_CREAM='#d9dcdd',WK_CREAM_D='#b9bec1',WK_KT=.45,WK_SC=1.35,WK_SW=.38;
const WK_EYES={wind:'#ff5a3a',dash:'#ff5a3a',cwind:'#ffb347',claw:'#ffb347',rwind:'#9dff9a',roar:'#9dff9a'};
let wkC=1,wkS=0,wkFl=false,wkT=0,wkPoseName='idle';
const wkAd=(p,v,l)=>[p[0]+v[0]*l,p[1]+v[1]*l,p[2]+v[2]*l],wkNz=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]},wkMix=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
const wkDep=p=>p[0]*wkS+p[2]*wkC,wkPr=p=>[-p[0]*wkC+p[2]*wkS,p[1]+wkDep(p)*WK_KT],wkCol=c=>wkFl?'#fff':c;
const wkDown=(s,a,l=.04)=>wkNz([s*l,Math.cos(a),Math.sin(a)]); // from straight down, a toward the front
function wkTube(P,Wd,col,ink=true,fill=true){const n=P.length,N=P.map((p,i)=>{const a=P[Math.max(0,i-1)],b=P[Math.min(n-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return[-dy/l,dx/l]});
  const L=P.map((p,i)=>[p[0]+N[i][0]*Wd[i]/2,p[1]+N[i][1]*Wd[i]/2]),R=P.map((p,i)=>[p[0]-N[i][0]*Wd[i]/2,p[1]-N[i][1]*Wd[i]/2]),md=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  // open = no outline across the root, so the limb melts into the body
  const build=open=>{const q=new Path2D();q.moveTo(...(open?md(L[0],L[1]):L[0]));for(let i=1;i<n-1;i++)q.quadraticCurveTo(...L[i],...md(L[i],L[i+1]));q.lineTo(...L[n-1]);
    const an=Math.atan2(N[n-1][1],N[n-1][0]);q.arc(P[n-1][0],P[n-1][1],Wd[n-1]/2,an,an-Math.PI,true);for(let i=n-2;i>=1;i--)q.quadraticCurveTo(...R[i],...md(R[i],R[i-1]));q.lineTo(...(open?md(R[1],R[0]):R[0]));if(!open)q.closePath();return q};
  if(fill){ctx.fillStyle=wkCol(col);ctx.fill(build(false))}if(ink){ctx.strokeStyle=WK_INK;ctx.lineWidth=2.2;ctx.stroke(build(true))}}
// a pose per action; each leg gets extra angles [upper, middle, lower, sideways]. The claw combo follows the game's timing:
// each swipe is a 0.14 s lunge that ends in the hit, then a 0.24 s pause in which the other paw comes up
function wkPose(p,t,stT){const Z=()=>[0,0,0,0];
  const P={run:0,crouch:0,rear:0,stretch:0,sit:0,hp:.15+Math.sin(t*1.5)*.03,jaw:0,tailUp:-1.05,tailSw:.2,ears:0,ruff:0,glow:0,FR:Z(),FL:Z(),RR:Z(),RL:Z(),paw:null,strike:0};
  if(p==='run'){P.run=1;P.hp=-.1;P.tailUp=-.35;P.tailSw=.45;P.ears=.3}
  if(p==='wind'){P.crouch=8;P.hp=-.3;P.jaw=.25;P.ears=1;P.tailUp=-.5;P.tailSw=.05;P.RR=[.3,-.35,.1,0];P.RL=[.3,-.35,.1,0];P.FR=[-.2,.3,0,0];P.FL=[-.2,.3,0,0];P.ruff=.6}
  if(p==='dash'){P.stretch=1;P.crouch=3;P.hp=-.15;P.jaw=.45;P.ears=1;P.tailUp=-.15;P.tailSw=.1;P.FR=[1.1,-.5,.3,0];P.FL=[.95,-.4,.3,0];P.RR=[-1.0,.55,-.3,0];P.RL=[-.85,.5,-.3,0]}
  if(p==='cwind'){P.rear=16;P.hp=.35;P.jaw=.35;P.ears=.6;P.FR=[1.75,-1.3,-.8,.15];P.FL=[.1,0,0,0];P.RR=[.25,-.25,0,0];P.RL=[.25,-.25,0,0];P.tailUp=-.5;P.ruff=.6;P.paw='FR'}
  if(p==='claw'){const n=Math.floor(stT/WK_SW),u=stT-n*WK_SW,e=x=>x*x*(3-2*x);let i=n,ru=1,hu=1;
    if(u<.12)hu=u/.12;else if(u>=.22&&n<2){i=n+1;ru=e(Math.min(1,(u-.22)/.16));hu=0}
    const act=[.1+2.9*ru-3.2*hu,-1.5*ru+1.7*hu,-.9*ru+.9*hu,.15*ru-.75*hu],rest=[.25,-.15,0,0],hh=hu*hu;
    P.rear=16*ru-12*hh;P.stretch=1.3*hh;P.crouch=3*hh;P.hp=.35*ru-.5*hh;P.jaw=.3+.5*hh;P.ears=.8;P.FR=i%2?rest:act;P.FL=i%2?act:rest;P.RR=[.15+.3*hh,-.15-.3*hh,0,0];P.RL=[.15+.3*hh,-.15-.3*hh,0,0];P.tailUp=-.45;P.tailSw=.15;P.ruff=.5;P.paw=i%2?'FL':'FR';P.strike=u<.22?1:0}
  if(p==='rwind'){P.hp=.6;P.jaw=.55;P.crouch=-1;P.glow=1;P.ruff=.8;P.tailUp=-.3}
  if(p==='roar'){P.hp=.05;P.jaw=.95;P.ruff=1;P.glow=.6;P.ears=1;P.crouch=2;P.FR=[.35,-.1,0,0];P.FL=[.35,-.1,0,0];P.tailUp=-.25;P.tailSw=.05}
  if(p==='howl'){P.sit=1;P.hp=1.3;P.jaw=.45;P.tailUp=-1.3;P.tailSw=.05;P.RR=[1.0,-1.2,1.3,0];P.RL=[1.0,-1.2,1.3,0];P.FR=[-.1,0,0,0];P.FL=[-.1,0,0,0]}
  return P}
function wkLeg(root,s,front,P,ex,ph,trail){const ac=P.run*.6*Math.sin(ph),lift=P.run*Math.max(0,Math.cos(ph)),cr=P.crouch,far=wkDep([s,0,0])<-.2,col=far?WK_FUR_D:WK_FUR,pts=[root],sd=.04+(ex[3]||0);let a;
  if(front){a=ac-.08+ex[0]+cr*.03;pts.push(wkAd(root,wkDown(s,a,sd),16));a+=.15+lift*1.1+ex[1]+cr*.05;pts.push(wkAd(pts[1],wkDown(s,a,sd*1.3),19));a=1.35-lift*1.7+ex[2]+(a-.15);pts.push(wkAd(pts[2],wkDown(s,a,sd),7))}
  else{a=ac+.5+ex[0]+cr*.05;pts.push(wkAd(root,wkDown(s,a),17));a+=-1.15-lift*.5+ex[1]-cr*.05;pts.push(wkAd(pts[1],wkDown(s,a),16));a+=.8+ex[2];pts.push(wkAd(pts[2],wkDown(s,a),13));pts.push(wkAd(pts[3],wkDown(s,1.35+(a-.15)*.3),5.5))}
  // grey above, pale below with a tapered start, one outline round both
  const Q=pts.map(wkPr),Wl=front?[13,8,5.6,6.4]:[21,11,6.4,5.4,6.4],k0=front?1:2;wkTube(Q,Wl,col,false);
  wkTube([wkMix(Q[k0-1],Q[k0],.35),...Q.slice(k0)],[1.5,...Wl.slice(k0).map(w=>w-1)],far?WK_CREAM_D:WK_CREAM,false);wkTube(Q,Wl,null,true,false);
  const paw=pts[pts.length-1],pq=Q[Q.length-1];if(trail)trail.push([pq[0],pq[1],time]);const cs=trail?1.8:1;
  ctx.fillStyle=wkFl?'#fff':trail?'#fff4dc':'#5b5248';for(const k of[-1,0,1]){const b=wkAd(paw,[k*1.7,2,2.2],1),tip=wkPr(wkAd(b,[k*.2,.6,1],2.6*cs)),l=wkPr(wkAd(b,[1,0,0],.8)),r=wkPr(wkAd(b,[-1,0,0],.8));ctx.beginPath();ctx.moveTo(...l);ctx.lineTo(...tip);ctx.lineTo(...r);ctx.closePath();ctx.fill()}}
function wkTail(root,P){let p=root,up=P.tailUp;const pts=[p],sw=P.tailSw;for(let i=0;i<4;i++){const side=Math.sin(wkT*(P.run?9:2.5)-i*.7)*sw*(i+1)*.4;p=wkAd(p,wkNz([side,-Math.sin(up),-Math.cos(up)]),9);pts.push(p);up+=.1}
  const Q=pts.map(wkPr);wkTube(Q,[8,12,12,9,3.5],WK_FUR);if(wkFl)return;ctx.strokeStyle=WK_SADDLE;ctx.lineCap='round';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(...wkMix(Q[0],Q[1],.5));ctx.lineTo(...Q[1]);ctx.lineTo(...wkMix(Q[1],Q[2],.6));ctx.stroke();
  ctx.fillStyle='#2e3236';ctx.beginPath();ctx.arc(Q[4][0],Q[4][1],2.6,0,6.28);ctx.arc(...wkMix(Q[3],Q[4],.5),4,0,6.28);ctx.fill()}
// hips, waist, deep chest, withers, neck, skull and muzzle as one silhouette (outline pass, then fill pass), then markings over it
function wkBody(Sp,P){const pts=[],rad=[];for(let i=0;i<Sp.length-1;i++)for(let k=0;k<3;k++){const f=k/3;pts.push(wkMix(Sp[i][0],Sp[i+1][0],f));rad.push(Sp[i][1]+(Sp[i+1][1]-Sp[i][1])*f)}pts.push(Sp[Sp.length-1][0]);rad.push(Sp[Sp.length-1][1]);
  const Q=pts.map(wkPr);for(const pass of[0,1])for(let i=0;i<Q.length-1;i++){ctx.strokeStyle=pass?wkCol(WK_FUR):WK_INK;ctx.lineWidth=rad[i]+rad[i+1]+(pass?0:3.2);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...Q[i]);ctx.lineTo(...Q[i+1]);ctx.stroke()}
  if(wkFl)return;
  const band=(from,to,f,w,col)=>{ctx.strokeStyle=col;ctx.lineCap='round';ctx.beginPath();for(let i=from;i<=to;i++){const q=wkPr([pts[i][0],pts[i][1]+rad[i]*f,pts[i][2]]);i===from?ctx.moveTo(...q):ctx.lineTo(...q)}ctx.lineWidth=w;ctx.stroke()};
  // samples: hips 0, waist 3, chest 6, withers 9, neck 12-15, skull 18, muzzle 21-24
  const under=i=>wkPr([pts[i][0],pts[i][1]+rad[i]*.48,pts[i][2]]);wkTube([3,5,6,7,9,11,13,15,17].map(under),[2,6,9,10,9,8,7.5,7,5],WK_CREAM,false);band(0,9,-.55,7,WK_SADDLE);band(9,16,-.5,6,WK_FUR_D);
  // mane over the shoulders and neck, bristling before an attack
  ctx.fillStyle=WK_SADDLE;for(let k=0;k<7;k++){const i=8+k,p=pts[i],r=rad[i],b=wkPr([p[0],p[1]-r*.8,p[2]]),tip=wkPr([p[0],p[1]-r*.8-3-P.ruff*6,p[2]-3-P.ruff*2]),l=wkPr([p[0],p[1]-r*.75,p[2]+2.5]),rr=wkPr([p[0],p[1]-r*.75,p[2]-2.5]);ctx.beginPath();ctx.moveTo(...l);ctx.lineTo(...tip);ctx.lineTo(...rr);ctx.lineTo(...b);ctx.closePath();ctx.fill()}}
function wkHead(hc,f,up,P,eyes){const at=o=>wkAd(wkAd(wkAd(hc,f,o[2]),up,o[1]),[1,0,0],o[0]),jo=P.jaw*.9,eye=WK_EYES[wkPoseName]||'#bfe8ff';
  if(!wkFl){const mz=[at([0,-2.2,5]),at([0,-2.6,13])].map(wkPr);ctx.strokeStyle=WK_CREAM;ctx.lineCap='round';ctx.lineWidth=5.5;ctx.beginPath();ctx.moveTo(...mz[0]);ctx.lineTo(...mz[1]);ctx.stroke();
    const bz=[at([0,5.5,-3]),at([0,3.6,8])].map(wkPr);ctx.strokeStyle=WK_SADDLE;ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(...bz[0]);ctx.lineTo(...bz[1]);ctx.stroke();
    for(const s of[1,-1]){if(wkDep([s,0,0])<-.1)continue;const c=wkPr(at([s*4.5,-2,1]));ctx.fillStyle=WK_CREAM;ctx.beginPath();ctx.ellipse(c[0],c[1],3.6,2.6,0,0,6.28);ctx.fill()}}
  // jaw: closed it is a line; open it shows the mouth, fangs and the lower jaw
  const jf=wkNz(f.map((v,i)=>v*Math.cos(jo)-up[i]*Math.sin(jo))),jb=at([0,-3.2,1.5]);
  if(jo>.05){const jt=wkAd(jb,jf,12.5);ctx.fillStyle='#5a1f22';ctx.beginPath();ctx.moveTo(...wkPr(jb));ctx.lineTo(...wkPr(at([0,-3,14.5])));ctx.lineTo(...wkPr(jt));ctx.closePath();ctx.fill();
    ctx.fillStyle='#f4f0e2';ctx.strokeStyle=WK_INK;ctx.lineWidth=.6;for(const s of[-1,1]){const a=wkPr(at([s*1.8,-3.4,13])),b=wkPr(at([s*2,-6.5,12.2])),c=wkPr(at([s*1.8,-3.4,11.2]));ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineTo(...c);ctx.closePath();ctx.fill();ctx.stroke()}
    wkTube([wkPr(jb),wkPr(wkAd(jb,jf,7)),wkPr(jt)],[6,4.6,3.2],WK_CREAM)}
  else{ctx.strokeStyle=WK_INK;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...wkPr(at([0,-4,13.5])));ctx.lineTo(...wkPr(at([0,-3.6,5])));ctx.stroke()}
  const ns=wkPr(at([0,-1.4,16.2]));ctx.fillStyle=WK_INK;ctx.beginPath();ctx.ellipse(ns[0],ns[1],2.6,2,0,0,6.28);ctx.fill();
  for(const s of[1,-1]){const v=wkDep([s,0,0])*.85+wkDep(f)*.5;if(v<.12)continue;const ep=wkPr(at([s*4.2,2.2,4])),w=2.3*Math.min(1,v),bk=wkPr(at([s*4.8,3.6,1.5])),fw=wkPr(at([s*3.2,3,6.5])),ang=Math.atan2(fw[1]-bk[1],fw[0]-bk[0])*.5;
    ctx.strokeStyle=WK_INK;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(...bk);ctx.lineTo(...fw);ctx.stroke();ctx.fillStyle=WK_INK;ctx.beginPath();ctx.ellipse(ep[0],ep[1],w+1,1.7,ang,0,6.28);ctx.fill();ctx.fillStyle=eye;ctx.beginPath();ctx.ellipse(ep[0],ep[1],w,.95,ang,0,6.28);ctx.fill();eyes.push(ep)}
  // tall upright ears, laid back when it charges
  const ears=[1,-1].map(s=>{const b=P.ears;return{d:wkDep([s,0,0]),pts:[at([s*1.8,6.4,2.6]),at([s*4.8,6.2+10-b*5,-2-b*8]),at([s*6.8,4.6,-4])].map(wkPr),inn:[at([s*2.8,6.8,1.4]),at([s*4.8,6.2+7.5-b*4,-2.2-b*6]),at([s*5.9,5.4,-3])].map(wkPr)}}).sort((a,b)=>a.d-b.d);
  for(const e of ears){ctx.fillStyle=wkCol(e.d<0?WK_SADDLE:'#596066');ctx.strokeStyle=WK_INK;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(...e.pts[0]);ctx.lineTo(...e.pts[1]);ctx.lineTo(...e.pts[2]);ctx.closePath();ctx.fill();ctx.stroke();if(!wkFl&&wkDep(f)>-.35){ctx.fillStyle=WK_CREAM_D;ctx.beginPath();ctx.moveTo(...e.inn[0]);ctx.lineTo(...e.inn[1]);ctx.lineTo(...e.inn[2]);ctx.closePath();ctx.fill()}}}
function drawWolf(m,f){const st=m.state;
  // rig state lives on the mob (on the pet for the pup), driven only by the synced state and the movement it sees
  const R=m.rg||(m.rg={t:Math.random()*9,phi:Math.PI/2-m.face,px:m.x,py:m.y,spd:0,st,stT:0,lt:time,cur:null,trail:[]}),dt=Math.max(0,Math.min(.05,time-R.lt));R.lt=time;
  if(st!==R.st){R.st=st;R.stT=0}else R.stT+=dt;
  if(dt>0){R.spd+=(Math.hypot(m.x-R.px,m.y-R.py)/dt-R.spd)*Math.min(1,dt*6);R.px=m.x;R.py=m.y}
  const pose=st==='wind'||st==='dash'||st==='cwind'||st==='claw'||st==='rwind'||st==='howl'?st:st==='rrec'?'roar':R.spd>15?'run':'idle';
  R.t+=dt*(pose==='run'?Math.min(1.6,R.spd/100):1);
  const T=wkPose(pose,R.t,R.stT);if(!R.cur)R.cur=JSON.parse(JSON.stringify(T));const k=Math.min(1,dt*(pose==='claw'?40:8));
  for(const key in T){if(Array.isArray(T[key]))T[key].forEach((v,i)=>{const o=R.cur[key][i]||0;R.cur[key][i]=o+(v-o)*k});else if(typeof T[key]==='number')R.cur[key]+=(T[key]-R.cur[key])*k}
  // turn to the nearest of 8 facings: 0 = toward the camera (running down), +90° = running right
  const want=Math.round((Math.PI/2-m.face)/(Math.PI/4))*(Math.PI/4),dp=Math.atan2(Math.sin(want-R.phi),Math.cos(want-R.phi));R.phi+=dp*Math.min(1,dt*9);
  wkC=Math.cos(R.phi);wkS=Math.sin(R.phi);wkFl=f;wkT=R.t;wkPoseName=pose;const P=R.cur,eyes=[];
  R.trail=R.trail.filter(q=>time-q[2]<.16&&q[2]<=time);const trail=T.paw&&(T.strike||pose==='cwind')?R.trail:null;
  ctx.save();ctx.translate(m.x,m.y);ctx.scale(WK_SC,WK_SC);ctx.lineCap='round';ctx.lineJoin='round';
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(0,2,22+Math.abs(wkS)*20,(22+Math.abs(wkC)*20)*WK_KT+4,0,0,6.28);ctx.fill();
  const bob=P.run?-Math.abs(Math.sin(R.t*7))*2.4:Math.sin(R.t*2)*.4,shake=st==='wind'||st==='rrec'?Math.sin(time*60)*.8:0;
  const sit=P.sit,rY=-42+P.crouch+bob+sit*15,cY=-45+P.crouch*.6-P.rear+bob-sit*5+shake,st2=P.stretch;
  const hips=[0,rY,-13-st2*4+sit*5],waist=[0,(rY+cY)/2-2,-1],chest=[0,cY,11+st2*5],withers=[0,cY-3,16+st2*5];
  const na=.8+P.hp*.55+sit*.25,nd=[0,-Math.sin(na),Math.cos(na)],nb=wkAd(withers,nd,6),ntop=wkAd(withers,nd,15),hp=P.hp*.9-.15+sit*.2,fw=[0,-Math.sin(hp),Math.cos(hp)],up=[0,-Math.cos(hp),-Math.sin(hp)],hc=wkAd(ntop,wkNz([0,-.2,1]),4);
  const Sp=[[hips,10.5],[waist,8.3],[chest,12.6],[withers,11.5],[nb,9.6],[ntop,8],[hc,7.4],[wkAd(hc,fw,7),5.6],[wkAd(wkAd(hc,fw,13.5),up,-1.5),3.6]];
  const legs=[[1,true,'FR',0],[-1,true,'FL',Math.PI],[1,false,'RR',Math.PI],[-1,false,'RL',0]].map(([s,fr,key,o])=>{const root=fr?wkAd(chest,[s*.7,.3,-.1],6):wkAd(hips,[s*5,1.5,-3.5],1);return{d:wkDep(root),f:()=>wkLeg(root,s,fr,P,P[key],R.t*7+o,key===T.paw?trail:null)}});
  const tr=wkAd(hips,wkNz([0,-.45,-1]),9),items=[...legs,{d:wkDep(tr),f:()=>wkTail(tr,P)},{d:wkDep(waist)+.01,f:()=>{wkBody(Sp,P);wkHead(hc,fw,up,P,eyes)}}];
  items.sort((a,b)=>a.d-b.d);for(const it of items)it.f();
  if(P.glow>.02&&!wkFl){const c=wkPr(chest),gr=ctx.createRadialGradient(c[0],c[1],0,c[0],c[1],40);gr.addColorStop(0,`rgba(150,255,160,${.45*P.glow*(.7+.3*Math.sin(time*12))})`);gr.addColorStop(1,'rgba(150,255,160,0)');ctx.fillStyle=gr;ctx.fillRect(c[0]-40,c[1]-40,80,80)}
  // the cocked paw glints; the striking paw leaves a ribbon
  if(R.trail.length&&pose==='cwind'){const c=R.trail[R.trail.length-1],p=.5+Math.sin(time*40)*.5;ctx.fillStyle=`rgba(255,180,70,${.25+.35*p})`;ctx.beginPath();ctx.arc(c[0],c[1],7+p*3,0,6.28);ctx.fill()}
  if(pose==='claw'&&R.trail.length>1)for(let i=1;i<R.trail.length;i++){const a=R.trail[i-1],b=R.trail[i],q=1-(time-b[2])/.16;ctx.strokeStyle=`rgba(255,200,120,${.35*q})`;ctx.lineWidth=16*q;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.strokeStyle=`rgba(255,250,235,${.9*q})`;ctx.lineWidth=4*q+1;ctx.stroke()}
  if(pose==='dash'&&!m.pet)for(let k=0;k<4;k++){const a=wkPr([(k-1.5)*7,-38+k*5,-34-k*6]),b=wkPr([(k-1.5)*7,-38+k*5,-60-k*6]);ctx.strokeStyle='rgba(235,240,245,.45)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke()}
  ctx.restore();m.eyes=eyes.map(([x,y])=>[m.x+x*WK_SC,m.y+y*WK_SC]);m.eyeCol=WK_EYES[pose]||'#bfe8ff'}
// Treant Elder: a jointed rig in 3D (x = its right, y = down, z = its forward), seen from one of 8 facings.
// Hips, a three-part trunk, a head with three jointed antler branches, arms (shoulder, elbow, wrist, palm, two-knuckle fingers)
// and legs (hip, knee, ankle, root toes). Each limb is one tapering shape through its joints, so a bend reads as a stretch, not a seam
const TE_INK='#1f1712',TE_EYE='#b6ffc4',TE_LEAF='#8fb257',TE_MOSS='#7ea64a',TE_MOSS_D='#476d2c',TE_BARK='#5f452e',TE_BACK='#4a3424',TE_SC=1.15;
let teC=1,teS=0,tePhi=0,teFl=false,teT=0;
const teAd=(p,v,l)=>[p[0]+v[0]*l,p[1]+v[1]*l,p[2]+v[2]*l],teNz=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]};
const tePr=p=>[-p[0]*teC+p[2]*teS,p[1]],teDep=p=>p[0]*teS+p[2]*teC,teCol=c=>teFl?'#fff':c;
const teSwing=(s,a,b)=>[s*Math.sin(b),Math.cos(b)*Math.cos(a),Math.cos(b)*Math.sin(a)]; // from hanging down: a toward the front/up, b out to the side
function teTube(P,Wd,col,ink=true){const n=P.length,N=P.map((p,i)=>{const a=P[Math.max(0,i-1)],b=P[Math.min(n-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return[-dy/l,dx/l]});
  const L=P.map((p,i)=>[p[0]+N[i][0]*Wd[i]/2,p[1]+N[i][1]*Wd[i]/2]),R=P.map((p,i)=>[p[0]-N[i][0]*Wd[i]/2,p[1]-N[i][1]*Wd[i]/2]),md=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  // open = no outline across the root, so the limb melts into whatever it grows from
  const build=open=>{const q=new Path2D();q.moveTo(...(open?md(L[0],L[1]):L[0]));for(let i=1;i<n-1;i++)q.quadraticCurveTo(...L[i],...md(L[i],L[i+1]));q.lineTo(...L[n-1]);
    const an=Math.atan2(N[n-1][1],N[n-1][0]);q.arc(P[n-1][0],P[n-1][1],Wd[n-1]/2,an,an-Math.PI,true);for(let i=n-2;i>=1;i--)q.quadraticCurveTo(...R[i],...md(R[i],R[i-1]));q.lineTo(...(open?md(R[1],R[0]):R[0]));if(!open)q.closePath();return q};
  ctx.fillStyle=teCol(col);ctx.fill(build(false));if(ink){ctx.strokeStyle=TE_INK;ctx.lineWidth=2.4;ctx.stroke(build(true))}}
function teGlow(p,k,r){if(k<=.02)return;const gr=ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],r);gr.addColorStop(0,`rgba(170,255,190,${.85*k})`);gr.addColorStop(1,'rgba(170,255,190,0)');ctx.fillStyle=gr;ctx.fillRect(p[0]-r,p[1]-r,r*2,r*2)}
// a pose per game action; arms are [swing forward/up, out to the side, elbow, wrist, finger curl]
function tePose(p,t){const s=Math.sin(t*2.4),b=Math.sin(t*1.6)*.05,idle=()=>[.06+b,.28,.25,.1,.35];
  const P={lean:Math.sin(t*1.2)*.03,walk:0,head:0,crown:Math.sin(t*1.7)*.07,R:idle(),L:idle(),gR:0,gL:0};
  if(p==='walk'){P.walk=1;P.lean=.08;P.R[0]=.05-.45*s;P.L[0]=.05+.45*s}
  if(p==='wind'){P.lean=-.2;P.head=-.14;P.R=[3.3,.25,.7,.3,.9];P.L=[-.25,.35,.4,.2,.4]}
  if(p==='slam'){P.lean=.3;P.head=.14;P.R=[1.05,.15,.3,.45,-.4];P.L=[1.05,.15,.3,.45,-.4]}
  if(p==='cast'){P.lean=-.06;P.head=-.1;P.R=[2.05,.25,.25,.3,-.55];P.gR=1}
  if(p==='eat'){P.lean=-.15;P.head=-.28;P.R=[2.55,.75,.35,.3,-.6];P.L=[2.55,.75,.35,.3,-.6];P.gR=P.gL=1}
  return P}
function teArm(sh,s,A,glow){const[a,b,c,d,curl]=A,el=teAd(sh,teSwing(s,a,b),23),wr=teAd(el,teSwing(s,a+c,b*.7),21),hd=teAd(wr,teSwing(s,a+c+d,b*.5),7),col=teDep(sh)<-3?TE_BACK:TE_BARK;
  const P=[sh,el,wr,hd].map(tePr),fing=[];
  for(const sp of[-.5,0,.5]){let f=a+c+d+curl*.4;const side=s*Math.sin(b*.5)+sp*.7,dirF=()=>teNz([side,Math.cos(f),Math.sin(f)]);const k1=teAd(hd,dirF(),9);f+=curl;const k2=teAd(k1,dirF(),7);f+=curl*.6;fing.push([P[3],...[k1,k2,teAd(k2,dirF(),4)].map(tePr)])}
  teTube(P,[12,9.5,8,9],col);for(const q of fing)teTube(q,[5,4,3,1.4],col);
  ctx.fillStyle=teCol(TE_MOSS_D);ctx.beginPath();ctx.arc(P[0][0],P[0][1]-3,5.5,0,6.28);ctx.fill();ctx.fillStyle=teCol(TE_MOSS);ctx.beginPath();ctx.arc(P[0][0]+1.5,P[0][1]-4.5,3.2,0,6.28);ctx.fill();teGlow(P[3],glow,22)}
function teLeg(s,P){const ph=teT*2.4+(s>0?0:Math.PI),a=P.walk*.38*Math.sin(ph)+P.lean*.3,kn=.18+P.walk*.5*Math.max(0,Math.sin(ph+1.57)),hip=[s*12,-46,0],knee=teAd(hip,teNz([s*.08,Math.cos(a),Math.sin(a)]),21),ank=teAd(knee,teNz([s*.05,Math.cos(a-kn),Math.sin(a-kn)]),20),col=teDep(hip)<-3?TE_BACK:TE_BARK;
  const Q=[hip,knee,ank].map(tePr),toes=[];
  for(const tv of[[s*.3,.35,1],[s,.4,.15],[s*.2,.35,-1]]){const d1=teNz(tv),t1=teAd(ank,d1,9),t2=teAd(t1,teNz([d1[0],d1[1]+.6,d1[2]]),7);toes.push([Q[2],tePr(t1),tePr(t2)])}
  teTube(Q,[13,10.5,9],col);for(const q of toes)teTube(q,[6,4.4,2.2],col)}
// trunk: a bark cylinder, wider than deep; grooves and moss sit at fixed angles round it and turn with the facing
function teTrunk(Sp3){const Sp=Sp3.map(tePr),HW=[[21,15],[20,15],[21,16],[15,12]].map(([x,z])=>Math.hypot(x*teC,z*teS)),N=i=>{const a=Sp[Math.min(i,2)],b=Sp[Math.min(i,2)+1],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return[-dy/l,dx/l]};
  const Lp=Sp.map((p,i)=>[p[0]-N(i)[0]*HW[i],p[1]-N(i)[1]*HW[i]]),Rp=Sp.map((p,i)=>[p[0]+N(i)[0]*HW[i],p[1]+N(i)[1]*HW[i]]);
  const body=new Path2D();body.moveTo(Lp[0][0],Lp[0][1]);for(let i=1;i<4;i++)body.lineTo(Lp[i][0],Lp[i][1]);body.quadraticCurveTo(Sp[3][0],Sp[3][1]-8,Rp[3][0],Rp[3][1]);for(let i=2;i>=0;i--)body.lineTo(Rp[i][0],Rp[i][1]);body.quadraticCurveTo(Sp[0][0],Sp[0][1]+8,Lp[0][0],Lp[0][1]);
  ctx.fillStyle=teCol(TE_BARK);ctx.fill(body);ctx.strokeStyle=TE_INK;ctx.lineWidth=2.4;ctx.stroke(body);if(teFl)return;ctx.save();ctx.clip(body);
  for(let k=0;k<11;k++){const th=k/11*6.283+.2,vis=Math.cos(th-tePhi);if(vis<.08)continue;const o=Math.sin(tePhi-th);ctx.strokeStyle=k%4===1?`rgba(125,95,67,${vis})`:`rgba(58,40,24,${vis})`;ctx.lineWidth=k%4===1?1.1:2;ctx.beginPath();
    Sp.forEach((p,i)=>{const n=N(i),x=p[0]+n[0]*HW[i]*o+Math.sin(i*2.1+k)*1.3,y=p[1]+n[1]*HW[i]*o;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
  for(const[i,th,r,c]of[[1,-.9,7,TE_MOSS_D],[1,-.8,4,TE_MOSS],[2,1.0,6,TE_MOSS_D],[2,1.1,3.5,TE_MOSS],[0,.4,5,TE_MOSS_D],[2,2.9,9,TE_MOSS_D],[2,2.8,5,TE_MOSS],[1,3.7,6,TE_MOSS_D]]){const vis=Math.cos(th-tePhi);if(vis<.05)continue;const o=Math.sin(tePhi-th)*.85,n=N(i),p=Sp[i];ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(p[0]+n[0]*HW[i]*o,p[1]+n[1]*HW[i]*o,r*(.4+.6*vis),r,0,0,6.28);ctx.fill()}
  ctx.restore()}
// one antler branch in the plane of "up" and a sideways direction L: three joints and a twig, leaves at the tip
function teBranch(base,L,a0,sd,P){let a=a0+P.crown,p=base;const at=(q,a,l)=>teAd(q,[Math.sin(a)*L[0],-Math.cos(a),Math.sin(a)*L[2]],l),bp=[tePr(p)];let twig=null;
  for(const[l,k]of[[11,0],[9,1],[7,2]]){const q=at(p,a,l);bp.push(tePr(q));if(k===0)twig=[tePr(q),tePr(at(q,a+sd*.85,7))];p=q;a+=sd*(k%2?.32:-.28)}
  teTube(twig,[3.2,1.6],TE_BARK);teTube(bp,[6,5,3.8,2.2],TE_BARK);const tip=bp[3];for(const[dx,dy,r,c]of[[0,-3,5.5,TE_MOSS_D],[-3,-1,4,TE_MOSS],[3,-4,3.5,TE_LEAF]]){ctx.fillStyle=teCol(c);ctx.beginPath();ctx.arc(tip[0]+dx,tip[1]+dy,r,0,6.28);ctx.fill()}
  ctx.fillStyle=teCol(TE_LEAF);ctx.beginPath();ctx.arc(bp[1][0],bp[1][1]-2,3,0,6.28);ctx.fill()}
// head: a bark cylinder; the brow juts out so it reads in profile, and the eyes and mouth turn round with the facing
function teHead(hc3,P,st,eyes){const hc=tePr(hc3),hy=hc[1],R=14,HWd=Math.hypot(15*teC,12*teS),face=(th,r=R)=>hc[0]+r*(HWd/15)*Math.sin(tePhi-th),vis=th=>Math.cos(th-tePhi),fy=P.head*7;
  for(const[x,z,L,a0,sd]of[[-9,0,[-1,0,.2],.6,1],[0,-2,[0,0,-1],.1,-1],[9,0,[1,0,.2],.6,1]])teBranch([hc3[0]+x,hc3[1]-11,hc3[2]+z],L,a0,sd,P);
  const hd=new Path2D();hd.moveTo(hc[0]-HWd,hy-11);hd.quadraticCurveTo(hc[0],hy-16,hc[0]+HWd,hy-11);hd.lineTo(hc[0]+HWd,hy+5);hd.quadraticCurveTo(hc[0]+HWd*.66,hy+14,hc[0],hy+14);hd.quadraticCurveTo(hc[0]-HWd*.66,hy+14,hc[0]-HWd,hy+5);hd.closePath();
  ctx.fillStyle=teCol(TE_BARK);ctx.fill(hd);ctx.strokeStyle=TE_INK;ctx.lineWidth=2.2;ctx.stroke(hd);if(teFl)return;ctx.save();ctx.clip(hd);
  for(let k=0;k<7;k++){const th=k/7*6.283+.45,v=vis(th);if(v<.1)continue;ctx.strokeStyle=`rgba(58,40,24,${v})`;ctx.lineWidth=1.5;ctx.beginPath();const x=face(th);ctx.moveTo(x,hy-10);ctx.quadraticCurveTo(x+1.5,hy+1,x-1,hy+12);ctx.stroke()}
  if(vis(Math.PI)>.05){const v=vis(Math.PI);ctx.fillStyle=TE_MOSS_D;ctx.beginPath();ctx.ellipse(face(Math.PI+.3,10),hy+4,6*(.4+.6*v),6,0,0,6.28);ctx.fill();ctx.fillStyle=TE_MOSS;ctx.beginPath();ctx.arc(face(Math.PI+.2,10),hy+2,3*v,0,6.28);ctx.fill()}
  ctx.restore();
  const top=[],bot=[];for(let u=-1;u<=1.001;u+=.125){const th=u*.75;if(vis(th)<-.15)continue;const r=R+3.5*(1-Math.abs(u));top.push([face(th,r),hy-1-5*Math.abs(u)+fy]);bot.push([face(th,r-1),hy+5-2*Math.abs(u)+fy])}
  if(top.length>1){ctx.fillStyle='#2c1e13';ctx.beginPath();top.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));for(let i=bot.length-1;i>=0;i--)ctx.lineTo(bot[i][0],bot[i][1]);ctx.closePath();ctx.fill()}
  if(vis(0)>0)teGlow([face(0),hy+fy],Math.max(P.gR,P.gL)*.6*vis(0),24);
  ctx.fillStyle=st==='swind'?'#ffd27a':TE_EYE;for(const s of[1,-1]){const th=s*.42,v=vis(th);if(v<.12)continue;const x=face(th,R+1.5),w=3.5*v,inn=Math.sign(face(0)-x)||1;ctx.beginPath();ctx.moveTo(x-w*inn,hy-2+fy);ctx.lineTo(x+w*inn,hy+fy);ctx.lineTo(x-w*inn*.8,hy+2+fy);ctx.closePath();ctx.fill();eyes.push([x,hy+fy])}
  const mo=st==='eat'||st==='heal'?3:0;ctx.strokeStyle='#1a120b';ctx.lineWidth=1.8;ctx.beginPath();let first=true;for(let k=-3;k<=3;k++){const th=k*.15;if(vis(th)<.05)continue;const x=face(th,R+.5),y=hy+9+fy+(k%2?mo+1:0);first?ctx.moveTo(x,y):ctx.lineTo(x,y);first=false}ctx.stroke();
  ctx.fillStyle=TE_MOSS_D;ctx.beginPath();ctx.arc(hc[0]+11,hy-9,4,0,6.28);ctx.fill()}
function drawTreant(m,f){const st=m.state;
  // tells on the ground, in world space
  if(st==='swind'){const p=.5+Math.sin(time*18)*.5;ctx.fillStyle=`rgba(255,80,50,${.16+p*.14})`;ctx.strokeStyle=`rgba(255,150,110,${.6+p*.35})`;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(m.x,m.y);ctx.arc(m.x,m.y,TR_SLAM_R,m.face-TR_SLAM_ARC,m.face+TR_SLAM_ARC);ctx.closePath();ctx.fill();ctx.stroke()}
  if(st==='heal'){const p=.5+Math.sin(time*9)*.5;ctx.strokeStyle=`rgba(150,255,170,${.45+p*.4})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(m.x,m.y,69+p*12,30+p*4,0,0,6.28);ctx.stroke()}
  // rig state lives on the mob and is updated here, so clients animate it from the synced state alone
  const R=m.rg||(m.rg={t:Math.random()*9,phi:Math.PI/2-m.face,px:m.x,py:m.y,spd:0,st,prev:null,lt:time,cur:null}),dt=Math.max(0,Math.min(.05,time-R.lt));R.lt=time;
  if(st!==R.st){R.prev=R.st;R.st=st}
  if(dt>0){R.spd+=(Math.hypot(m.x-R.px,m.y-R.py)/dt-R.spd)*Math.min(1,dt*6);R.px=m.x;R.py=m.y}
  const pose=st==='swind'?'wind':st==='trec'&&R.prev==='swind'?'slam':st==='heal'||st==='eat'?'eat':['rootc','seedc','callc','fogc','growc'].includes(st)?'cast':R.spd>8?'walk':'idle';
  R.t+=dt*(pose==='walk'?Math.min(1.6,R.spd/40):1);
  const T=tePose(pose,R.t);if(!R.cur)R.cur=JSON.parse(JSON.stringify(T));const k=Math.min(1,dt*7);for(const key in T){if(Array.isArray(T[key]))T[key].forEach((v,i)=>R.cur[key][i]+=(v-R.cur[key][i])*k);else R.cur[key]+=(T[key]-R.cur[key])*k}
  // turn to the nearest of 8 facings: 0 = toward the camera (walking down), +90° = walking right
  const want=Math.round((Math.PI/2-m.face)/(Math.PI/4))*(Math.PI/4),dp=Math.atan2(Math.sin(want-R.phi),Math.cos(want-R.phi));R.phi+=dp*Math.min(1,dt*9);
  tePhi=R.phi;teC=Math.cos(tePhi);teS=Math.sin(tePhi);teFl=f;teT=R.t;const P=R.cur,eyes=[];
  ctx.save();ctx.translate(m.x,m.y);ctx.scale(TE_SC,TE_SC);ctx.lineCap='round';ctx.lineJoin='round';
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(0,3,40,9,0,0,6.28);ctx.fill();
  const Sp3=[[0,-48,0]];let lean=0;for(const[i,l]of[[0,16],[1,15],[2,13]]){lean+=P.lean*[.5,.35,.25][i];Sp3.push(teAd(Sp3[i],[0,-Math.cos(lean),Math.sin(lean)],l))}
  const chest=teAd(Sp3[2],[0,-1,0],5),arms=[[[chest[0]+20,chest[1],chest[2]],1,P.R,P.gR],[[chest[0]-20,chest[1],chest[2]],-1,P.L,P.gL]];
  for(const s of[1,-1].sort((a,b)=>teDep([a*12,0,0])-teDep([b*12,0,0])))teLeg(s,P);
  for(const a of arms)if(teDep(a[0])<-3)teArm(...a);
  teTrunk(Sp3);teHead(teAd(Sp3[3],[0,-1,0],14),P,st,eyes);
  for(const a of arms.filter(a=>teDep(a[0])>=-3).sort((a,b)=>teDep(a[0])-teDep(b[0])))teArm(...a);
  ctx.restore();m.eyes=eyes.map(([x,y])=>[m.x+x*TE_SC,m.y+y*TE_SC]);m.eyeCol=st==='swind'?'#ffd27a':TE_EYE}
function drawRootTrail(r){const al=Math.min(1,r.t/2)*.75,c=Math.cos(r.a),s=Math.sin(r.a),n=r.s>.5?1:-1;ctx.globalAlpha=al;ctx.lineCap='round';ctx.strokeStyle='#2a1c12';ctx.lineWidth=3.4;ctx.beginPath();ctx.moveTo(r.x-c*9,r.y-s*9);ctx.quadraticCurveTo(r.x-s*n*4,r.y+c*n*4,r.x+c*9,r.y+s*9);ctx.moveTo(r.x,r.y);ctx.lineTo(r.x-s*n*9+c*3,r.y+c*n*9+s*3);ctx.stroke();
  ctx.strokeStyle='#5a4028';ctx.lineWidth=1.8;ctx.stroke();ctx.globalAlpha=1}
function drawRootMark(x){const p=1-x.t/x.T,a=.35+p*.5;ctx.fillStyle=`rgba(120,230,130,${.12+p*.2})`;ctx.strokeStyle=`rgba(170,255,175,${a})`;ctx.lineWidth=2.5;ctx.setLineDash([6,5]);ctx.beginPath();ctx.ellipse(x.x,x.y,ROOT_R,ROOT_R*.72,0,0,6.28);ctx.fill();ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#5a4028';ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();for(let i=0;i<6;i++){const t=i/6*6.28,bx=x.x+Math.cos(t)*ROOT_R*.7,by=x.y+Math.sin(t)*ROOT_R*.5;ctx.moveTo(bx,by);ctx.lineTo(bx,by-3-p*5)}ctx.stroke()}
function drawRootBurst(x){const p=1-x.t/x.T,h=Math.sin(Math.min(1,p*2.2)*1.57)*(1-p*.45)*44;ctx.lineCap='round';for(let i=0;i<7;i++){const t=i/7*6.28+.3,bx=x.x+Math.cos(t)*ROOT_R*.55,by=x.y+Math.sin(t)*ROOT_R*.34,tx=x.x+Math.cos(t)*9,ty=by-h;for(const[w,q]of[[6.5,'#1f1712'],[4,'#5f452e']]){ctx.strokeStyle=q;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(bx,by);ctx.quadraticCurveTo(bx,by-h*.6,tx,ty);ctx.stroke()}}}
function drawSlamFx(x){const p=x.t/x.T;ctx.fillStyle=`rgba(255,210,150,${.32*p})`;ctx.beginPath();ctx.moveTo(x.x,x.y);ctx.arc(x.x,x.y,TR_SLAM_R,x.a-TR_SLAM_ARC,x.a+TR_SLAM_ARC);ctx.closePath();ctx.fill();ctx.strokeStyle=`rgba(255,230,190,${.8*p})`;ctx.lineWidth=4*p+1;ctx.beginPath();ctx.arc(x.x,x.y,TR_SLAM_R-3,x.a-TR_SLAM_ARC,x.a+TR_SLAM_ARC);ctx.stroke()}
// nai-frog: one big pear of shaggy moss with no neck, a huge cream belly, wide-set bead eyes and a smile right across its face. All the fur is built once as paths
const frogRnd=(i,n)=>{const v=Math.sin(i*12.9898+n*78.233)*43758.5453;return v-Math.floor(v)};
const frogW=y=>{const P=[[-41,1],[-40,6],[-37,11],[-32,14.5],[-26,16.5],[-18,19],[-10,20],[-5,17.5],[-3,13]];for(let i=1;i<P.length;i++)if(y<=P[i][0]){const[a,b]=P[i-1],[c,d]=P[i];return b+(d-b)*(y-a)/(c-a)}return 13};
const frogPoly=L=>{const p=new Path2D();L.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();return p};
const frogLocks=(n,y0,y1,st,wf,o)=>{const L=[];let i=0;for(let y=y0;y<y1-.1;y+=st,i++){const r=frogRnd(i,n),a=wf(y),b=wf(y+st);L.push({y,a,b,st,cx:a+1.2+r*.9,cy:y+st*.5,tx:b+.9+r*1.1,ty:y+st+.5+r*.5})}return L};
const FROG_BODY=(()=>{const p=new Path2D();p.moveTo(0,-41.2);for(let y=-40.5;y<=-37.5;y+=.5)p.lineTo(frogW(y),y);for(const l of frogLocks(1,-37.5,-4.5,2.75,frogW)){p.quadraticCurveTo(l.cx,l.cy,l.tx,l.ty);p.lineTo(l.b-.2,l.y+l.st)}for(let x=13,i=0;x>-13;x-=2.6,i++){p.quadraticCurveTo(x-.5,-1.6-frogRnd(i,3),x-1.3,-1.7-frogRnd(i,4)*.8);p.lineTo(x-2.6,-3.4)}for(const l of frogLocks(2,-37.5,-4.5,2.75,frogW).reverse()){p.lineTo(-l.tx,l.ty);p.quadraticCurveTo(-l.cx,l.cy,-l.a,l.y)}for(let y=-37.5;y>=-40.5;y-=.5)p.lineTo(-frogW(y),y);p.closePath();return p})();
const frogFlicks=(n,seed,len)=>{const p=new Path2D();for(let i=0;i<n;i++){const y=-38+frogRnd(i,seed)*34,s=i%2?1:-1,w=frogW(y),x=s*(w*.45+frogRnd(i,seed+1)*w*.52),l=len*(.7+frogRnd(i,seed+2)*.6);p.moveTo(x,y);p.lineTo(x+s*l*.32,y+l)}return p};
const FROG_FUR_D=frogFlicks(46,11,2.9),FROG_FUR_L=frogFlicks(38,17,2.4);
const frogBlobs=L=>{const p=new Path2D();for(const[x,y,r]of L)for(const s of[-1,1]){const X=s*x+(s<0?.7:0);p.moveTo(X+r,y);p.arc(X,y,r,0,6.28)}return p};
const FROG_MOSS_D=frogBlobs([[15,-23,2.5],[16.5,-14,2.8],[15,-7,2],[10,-38,1.8],[13,-29,1.6]]);
const FROG_MOSS_L=frogBlobs([[13,-19,1.7],[14,-10.5,1.5],[6,-39,1.4],[12.5,-33,1.1]]);
const FROG_BELLY=(()=>{const o=[];for(let i=0;i<30;i++){const t=i/30*6.2832,r=i%2?1:.955,x=Math.cos(t)*15*r,y=-14.3+Math.sin(t)*12.9*r;o.push([x,Math.max(-26.6,y)])}return frogPoly(o)})();
const FROG_BELLY_FUR=(()=>{const p=new Path2D();for(const[x,y,s]of[[-1,-24,1],[5,-21.5,-1],[-6,-19,1],[3,-15,1],[-3,-12,-1],[7,-10,-1],[-8,-11,1],[-7,-6.5,1],[1,-6.5,1],[9,-16,-1],[-10,-17,1]]){p.moveTo(x,y);p.quadraticCurveTo(x+s*.5,y+1.4,x+s*1.8,y+2.1);p.moveTo(x+s*2.2,y-.4);p.lineTo(x+s*3,y+1)}return p})();
const FROG_LEG=frogPoly([[-5.2,-8],[5.6,-8],[6.8,-5],[6,-3],[4.6,-1.7],[3.2,-3],[1.6,-1.4],[0,-3],[-1.6,-1.4],[-3.2,-3],[-4.6,-1.7],[-6,-3.2],[-6.6,-5]]);
const FROG_ARM=(()=>{const w=y=>2.6+(y+8)*.13,p=new Path2D();p.moveTo(-2.4,-8);p.quadraticCurveTo(0,-9.2,w(-8),-8);for(const l of frogLocks(7,-8,6,3.5,w)){p.quadraticCurveTo(l.cx,l.cy,l.tx,l.ty);p.lineTo(l.b-.2,l.y+l.st)}p.lineTo(-3,6.5);p.quadraticCurveTo(-3.8,0,-2.4,-8);p.closePath();return p})();
const FROG_ARM_FUR=(()=>{const p=new Path2D();for(const[x,y]of[[0,-5],[1.8,-2],[-1.2,-1],[.8,2],[-1.5,3.5]]){p.moveTo(x,y);p.lineTo(x+.6,y+2)}return p})();
function drawFrog(m,f){const k=q=>f?'#fff':q,INK='#44471f',flip=Math.cos(m.face)<0?-1:1,el=(x,y,rx,ry,q,r=0)=>{ctx.fillStyle=k(q);ctx.beginPath();ctx.ellipse(x,y,rx,ry,r,0,6.28);ctx.fill()};
  // hop: a jump arc while the state is 'hop', a squash on landing. Timed from the state change so clients see it from snapshots alone; pets just bounce while moving
  if(m.state!==m.fs){m.fs=m.state;m.ft=time}const since=time-(m.ft||0);let lift=0,sq=0;
  if(m.pet){if(m.aggro>0)lift=Math.abs(Math.sin(m.anim*7))*7}
  else if(m.state==='hop'){lift=Math.sin(Math.min(1,since/HOP_T)*3.14)*15}
  else if(m.state==='idle'&&since<.14)sq=1-since/.14;
  const br=Math.sin(m.anim*2.2)*.014;
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(m.x,m.y+1,20*(1-lift*.018),6*(1-lift*.018),0,0,6.28);ctx.fill();
  ctx.save();ctx.translate(m.x,m.y-lift);ctx.scale(flip*(1+sq*.14-br),1-sq*.16+br);ctx.lineCap='round';ctx.lineJoin='round';
  // stubby antlers, then the leaf on its little stem
  const horns=()=>{ctx.beginPath();for(const q of[-1,1]){ctx.moveTo(q*7.5,-38);ctx.lineTo(q*11,-46.5);ctx.moveTo(q*9.3,-43);ctx.lineTo(q*5.2,-47)}ctx.stroke()};ctx.strokeStyle=k(INK);ctx.lineWidth=4.8;horns();ctx.strokeStyle=k('#94704a');ctx.lineWidth=3.5;horns();
  const sway=Math.sin(m.anim*2.6)*.16;ctx.strokeStyle=k('#3f5a22');ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,-40);ctx.lineTo(0,-44);ctx.stroke();ctx.save();ctx.translate(0,-43.5);ctx.rotate(-1.37+sway);ctx.fillStyle=k(INK);ctx.beginPath();ctx.moveTo(-.5,0);ctx.quadraticCurveTo(6,-6.2,13.5,0);ctx.quadraticCurveTo(6,6.2,-.5,0);ctx.fill();ctx.fillStyle=k('#6aa84a');ctx.beginPath();ctx.moveTo(.7,0);ctx.quadraticCurveTo(6,-5,12,0);ctx.quadraticCurveTo(6,5,.7,0);ctx.fill();ctx.strokeStyle=k('#467a30');ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(1,0);ctx.lineTo(11,0);ctx.stroke();ctx.restore();
  // big toed feet, with shaggy legs falling over them
  for(const q of[-1,1]){el(q*10,-.8,8,4,INK);el(q*10,-1,7.1,3.2,'#6e4a2e');ctx.strokeStyle=k('#3f2a18');ctx.lineWidth=.9;ctx.beginPath();for(const d of[2.4,5.6]){ctx.moveTo(q*(9.5+d),-.3);ctx.lineTo(q*(9.5+d),-2)}ctx.stroke();
    ctx.save();ctx.translate(q*9.5,0);ctx.fillStyle=k('#5f7530');ctx.fill(FROG_LEG);ctx.strokeStyle=k(INK);ctx.lineWidth=.9;ctx.stroke(FROG_LEG);ctx.restore()}
  // the shaggy pear itself: moss patches and layered fur, kept inside the outline
  ctx.fillStyle=k('#6e8438');ctx.fill(FROG_BODY);
  if(!f){ctx.save();ctx.clip(FROG_BODY);ctx.fillStyle='#596e2c';ctx.fill(FROG_MOSS_D);ctx.fillStyle='#90a656';ctx.fill(FROG_MOSS_L);ctx.lineWidth=1;ctx.strokeStyle='#54682a';ctx.stroke(FROG_FUR_D);ctx.lineWidth=.8;ctx.strokeStyle='#9bb163';ctx.stroke(FROG_FUR_L);ctx.restore()}
  ctx.strokeStyle=k(INK);ctx.lineWidth=1.05;ctx.stroke(FROG_BODY);
  // the big cream belly with a soft furry edge
  ctx.fillStyle=k('#f3ebd2');ctx.fill(FROG_BELLY);
  if(!f){ctx.save();ctx.clip(FROG_BELLY);ctx.fillStyle='rgba(190,165,115,.22)';ctx.beginPath();ctx.ellipse(0,-5,14,5.5,0,0,6.28);ctx.fill();ctx.restore();ctx.strokeStyle='#d8c9a2';ctx.lineWidth=.8;ctx.stroke(FROG_BELLY_FUR)}
  // face: paler muzzle, round eyes set far apart, and a smile that reaches both cheeks
  const fx=.5;el(fx,-29.5,11.5,4.2,'#8ca050');for(const q of[-1,1]){const ex=fx+q*8.8;el(ex,-34.2,2.1,2.3,'#16140b');if(!f){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+.6,-35,.65,0,6.28);ctx.fill()}}
  ctx.strokeStyle=k(INK);ctx.lineWidth=1.15;ctx.beginPath();ctx.moveTo(fx-12.2,-31);ctx.quadraticCurveTo(fx-6,-25.8,fx,-26.8);ctx.quadraticCurveTo(fx+6,-25.8,fx+12.2,-31);ctx.stroke();
  el(fx-2,-31,.6,.45,'#3f4a1e');el(fx+2,-31,.6,.45,'#3f4a1e');
  // shaggy arms at the sides, brown paws
  const ay=lift>2?-3:0;for(const q of[-1,1]){ctx.save();ctx.translate(q*16.8,-15.5+ay);ctx.scale(q,1);ctx.rotate(-.16);ctx.fillStyle=k('#647a33');ctx.fill(FROG_ARM);ctx.strokeStyle=k(INK);ctx.lineWidth=1;ctx.stroke(FROG_ARM);if(!f){ctx.strokeStyle='#4f6327';ctx.lineWidth=.8;ctx.stroke(FROG_ARM_FUR)}ctx.restore();
    el(q*16.3,-9.2+ay,3.8,3.1,INK);el(q*16.3,-9.3+ay,3.1,2.4,'#6e4a2e');ctx.strokeStyle=k('#3f2a18');ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(q*15.3,-8+ay);ctx.lineTo(q*15.5,-9.6+ay);ctx.moveTo(q*17.3,-7.9+ay);ctx.lineTo(q*17.4,-9.5+ay);ctx.stroke()}
  ctx.restore()}
const CAPES=['#7a3b33','#2f5d7a','#4f6b2a','#8a6a2a','#5f3a7a','#2a6b62'];
// pets reuse the boar / Wolf King art (pup = shrunken wolf), plus a heart in the owner's cape colour and a green hp bar
function drawPet(p){const D=PETS[p.k],wolf=p.k==='wolf';
  if(p.glow>0){const g=ctx.createRadialGradient(p.x,p.y-8,0,p.x,p.y-8,46);g.addColorStop(0,`rgba(255,230,140,${Math.min(1,p.glow)*.75})`);g.addColorStop(1,'rgba(255,220,120,0)');ctx.fillStyle=g;ctx.fillRect(p.x-46,p.y-54,92,92)}
  const m={x:p.x,y:p.y,face:p.face,anim:p.anim,flash:p.flash,aggro:p.moving?1:0,hp:1,max:1,r:p.r,k:wolf?'boss':p.k,state:'chase',pet:1,rg:p.rg};
  if(wolf){ctx.save();ctx.translate(p.x,p.y);ctx.scale(.42,.42);ctx.translate(-p.x,-p.y);drawMob(m);ctx.restore();p.rg=m.rg}else drawMob(m);
  const top=p.y-(wolf?40:p.k==='frog'?58:30),w=24;
  ctx.fillStyle='#000a';ctx.fillRect(p.x-w/2,top,w,3);ctx.fillStyle='#7fb069';ctx.fillRect(p.x-w/2,top,w*Math.max(0,p.hp)/D.hp,3);
  ctx.textAlign='center';ctx.font='700 11px system-ui,sans-serif';ctx.fillStyle='#000a';ctx.fillText('♥',p.x+1,top-3);ctx.fillStyle=CAPES[(p.owner===ME?myId:p.owner)%CAPES.length];ctx.fillText('♥',p.x,top-4)}
function drawLoot(l){
  if(l.g){shadow(l.x+1,l.y+4,11,4);ctx.fillStyle='#6d716b';ctx.beginPath();ctx.moveTo(l.x-9,l.y+3);ctx.lineTo(l.x-9,l.y-14);ctx.arc(l.x,l.y-14,9,Math.PI,0);ctx.lineTo(l.x+9,l.y+3);ctx.closePath();ctx.fill();
    ctx.fillStyle='#8a8e88';ctx.fillRect(l.x-9,l.y-14,3,17);ctx.fillStyle='#3d403b';ctx.fillRect(l.x-1,l.y-18,2,12);ctx.fillRect(l.x-4,l.y-15,8,2);
    ctx.font='600 10px system-ui,sans-serif';ctx.textAlign='center';ctx.fillStyle='#000a';ctx.fillText(l.g,l.x+1,l.y-25);ctx.fillStyle='#d8d4c8';ctx.fillText(l.g,l.x,l.y-26);return}
  shadow(l.x+1,l.y+3,9,4);ctx.fillStyle='#8a6236';ctx.beginPath();ctx.ellipse(l.x,l.y-4,8,7,0,0,6.28);ctx.fill();
  ctx.fillStyle='#5a3d22';ctx.fillRect(l.x-4,l.y-12,8,3);ctx.fillStyle='#e0a646';ctx.fillRect(l.x-1,l.y-6,2,2)}
// player art: shared outline colour and small helpers; hair, beard and cape are built once as paths
const PL_INK='#1f1712';
const plEl=(x,y,rx,ry,r,q)=>{ctx.fillStyle=q;ctx.beginPath();ctx.ellipse(x,y,rx,ry,r,0,6.28);ctx.fill()};
const plHand=(x,y,r)=>{plEl(x,y,r+.9,r+.9,0,PL_INK);plEl(x,y,r,r,0,'#e0b48e')};
const plPoly=pts=>{const p=new Path2D();pts.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();return p};
const PL_HAIR=plPoly([[3,-6.6],[0,-7.4],[-3.5,-6.6],[-4.6,-5.4],[-6.6,-4.6],[-5.6,-2.9],[-7.4,-1.4],[-5.9,0],[-7.4,1.4],[-5.6,2.9],[-6.6,4.6],[-4.6,5.4],[-3.5,6.6],[0,7.4],[3,6.6],[1.2,4.4],[2.6,2.8],[.8,1.4],[2,0],[.8,-1.4],[2.6,-2.8],[1.2,-4.4]]);
const PL_BEARD=plPoly([[6.2,-3.2],[8.2,-2.6],[9.2,-1.6],[11,0],[9.2,1.6],[8.2,2.6],[6.2,3.2],[8,0]]);
const PL_BEARD_D=new Path2D(),PL_HAIR_D=new Path2D(),PL_HAIR_L=new Path2D();
wolfLock(PL_BEARD_D,8.4,-1.5,2,.8,.5);wolfLock(PL_BEARD_D,8.4,1.5,2,.8,-.5);
for(const[x,y,n]of[[-.4,-4.8,4],[-.2,-1.6,4.6],[-.2,1.6,4.6],[-.4,4.8,4],[-3,-3.2,3],[-3,3.2,3]])wolfLock(PL_HAIR_D,x,y,n,1.2,Math.PI-y*.05);
for(const[x,y,n]of[[.4,-3.2,4],[.4,0,4.6],[.4,3.2,4]])wolfLock(PL_HAIR_L,x,y,n,.8,Math.PI-y*.05);
const PL_CAPE=plPoly([[5,-9],[1,-10.4],[-5,-10],[-9,-8],[-11.4,-6],[-10,-4.4],[-12.4,-2.2],[-10.6,-.6],[-12.6,1.4],[-10.6,3],[-12,5.4],[-9.6,6.4],[-8.5,8.6],[-4,10],[1,10.4],[5,9]]);
const PL_CAPE_S=plPoly([[-3,-10],[-5,-10],[-9,-8],[-11.4,-6],[-10,-4.4],[-12.4,-2.2],[-10.6,-.6],[-12.6,1.4],[-10.6,3],[-12,5.4],[-9.6,6.4],[-8.5,8.6],[-4,10],[-3,10],[-7,5],[-8,0],[-7,-5]]);
function drawPlayer(pl){const dance=pl.em===DANCE,x=pl.x,y=pl.y-(dance?Math.abs(Math.sin(time*9))*5:0),a=dance?time*7:pl.face,c=Math.cos(a),s=Math.sin(a);
  if(pl.inv>0&&pl.roll<=0&&Math.floor(time*20)%2)ctx.globalAlpha=.55;
  shadow(x,y+5,12,5);
  const bob=pl.roll>0?0:Math.sin(pl.walk)*1.5;
  const capeCol=CAPES[(pl===P?myId:pl.id)%CAPES.length];
  // rolling: a tucked ball of tunic, cape and hair spinning round
  if(pl.roll>0){const sp=time*22;plEl(x,y-6,14.2,10.2,a,PL_INK);plEl(x,y-6,13,9,a,'#365a7a');
    ctx.fillStyle=capeCol;ctx.beginPath();ctx.moveTo(x,y-6);ctx.arc(x,y-6,8,sp,sp+2.6);ctx.closePath();ctx.fill();ctx.strokeStyle=PL_INK;ctx.lineWidth=1;ctx.stroke();plEl(x+Math.cos(sp+3.6)*5,y-6+Math.sin(sp+3.6)*4,4.2,4.2,0,PL_INK);plEl(x+Math.cos(sp+3.6)*5,y-6+Math.sin(sp+3.6)*4,3.4,3.4,0,'#c98b3a');ctx.globalAlpha=1;return}
  // boots step in turn under the body: ink outline, leather, a lighter toe cap
  const stp=Math.sin(pl.walk)*4;for(const q of[-1,1]){const bx=x+c*stp*q-s*q*5,by=y-1+s*stp*q+c*q*2;plEl(bx,by,5,3.8,a,PL_INK);plEl(bx,by,4,2.9,a,'#3a291b');plEl(bx+c*1.8,by+s*1.8,1.9,1.7,a,'#6a4e36')}
  // cape (colour per player id; solo keeps the original red): tattered hem, shaded rear, sharp folds
  const fold=Math.sin(pl.walk*.5);ctx.save();ctx.translate(x-c*5,y-8-s*5+bob);ctx.rotate(a);ctx.lineJoin='miter';ctx.miterLimit=5;ctx.scale(1+fold*.04,1);ctx.fillStyle=capeCol;ctx.fill(PL_CAPE);ctx.fillStyle='rgba(0,0,0,.26)';ctx.fill(PL_CAPE_S);ctx.strokeStyle=PL_INK;ctx.lineWidth=1.1;ctx.stroke(PL_CAPE);
  ctx.strokeStyle='rgba(0,0,0,.34)';ctx.lineWidth=1;ctx.beginPath();for(const q of[-1,1]){ctx.moveTo(0,q*5);ctx.lineTo(-10,q*(3.4+fold*.6));ctx.moveTo(1,q*1.6);ctx.lineTo(-10.4,q*(.6-fold*.4))}ctx.stroke();ctx.restore();
  // body: outlined tunic, shading and seams; leather armour adds a stitched chest plate and rivets
  const armored=pl===P?armorLook():pl.armor,hit=pl.hurt>0,cx0=x,cy0=y-10+bob;
  plEl(cx0,cy0,11,11,0,PL_INK);plEl(cx0,cy0,10,10,0,hit?'#fff':armored===2?'#566b38':armored?'#7a5236':'#3f6688');
  if(!hit){plEl(cx0,cy0+4,8.6,5,0,armored===2?'#465a2d':armored?'#6a452c':'#35587a');plEl(cx0-1,cy0-5,6.5,3,0,armored===2?'#6d8547':armored?'#8d6444':'#4f7a9e');
    ctx.strokeStyle=armored===2?'#33451f':armored?'#3f2818':'#274660';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(cx0,cy0,8.2,.45,2.69);ctx.moveTo(cx0,cy0+3.4);ctx.lineTo(cx0,cy0+9);ctx.stroke();
    if(armored){ctx.strokeStyle=armored===2?'#b7d67a':'#d9b777';ctx.lineWidth=.8;ctx.setLineDash([1.6,1.6]);ctx.beginPath();ctx.moveTo(cx0-6.5,cy0-3);ctx.quadraticCurveTo(cx0,cy0-.8,cx0+6.5,cy0-3);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#e2c88e';for(const q of[-1,1])ctx.fillRect(cx0+q*5-.7,cy0+5,1.4,1.4)}}
  // shoulder pads and off hand
  for(const q of[-1,1]){const sx=cx0-s*q*9,sy=cy0+c*q*7;plEl(sx,sy,5,4.2,a,PL_INK);plEl(sx,sy,4.1,3.3,a,hit?'#fff':armored===2?'#6b4e34':armored?'#5e3e29':'#2f5270');if(armored&&!hit){ctx.fillStyle=armored===2?'#9dbf62':'#e2c88e';ctx.fillRect(sx-.7,sy-.7,1.4,1.4)}}
  plHand(cx0+Math.cos(a+1.25)*11,cy0+Math.sin(a+1.25)*9,2.3);
  // belt, buckle and a pouch
  ctx.fillStyle=PL_INK;ctx.fillRect(x-10,y-9.8+bob,20,3.8);ctx.fillStyle='#4a3522';ctx.fillRect(x-10,y-9.2+bob,20,2.6);ctx.fillStyle=PL_INK;ctx.fillRect(x-2.5,y-10.2+bob,5,4.6);ctx.fillStyle='#d9b45f';ctx.fillRect(x-1.8,y-9.5+bob,3.6,3.2);ctx.fillStyle='#4a3522';ctx.fillRect(x-.7,y-8.6+bob,1.4,1.4);
  ctx.fillStyle=PL_INK;ctx.fillRect(x+4.2,y-8+bob,5,4.8);ctx.fillStyle='#7b5634';ctx.fillRect(x+4.9,y-7.3+bob,3.6,3.4);
  // weapon
  const w=WEAPONS[pl.weapon],sw=pl.swing>0?(pl.swing/.24-.5)*w.arc*2.2:-.9;const wa=a+sw;
  const hx=x+Math.cos(wa)*9,hy=y-10+bob+Math.sin(wa)*9;
  if(w.len){ctx.strokeStyle='#6b4a2b';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(hx+Math.cos(wa)*w.len,hy+Math.sin(wa)*w.len);ctx.stroke();
    const tx=hx+Math.cos(wa)*w.len,ty=hy+Math.sin(wa)*w.len;ctx.fillStyle=ITEM[pl.weapon];
    if(w.proj){ctx.strokeStyle='#6b4e34';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(tx-Math.cos(wa)*5,ty-Math.sin(wa)*5);ctx.lineTo(tx-Math.sin(wa)*6,ty+Math.cos(wa)*6);ctx.moveTo(tx-Math.cos(wa)*5,ty-Math.sin(wa)*5);ctx.lineTo(tx+Math.sin(wa)*6,ty-Math.cos(wa)*6);ctx.stroke();const orb=ctx.createRadialGradient(tx,ty,0,tx,ty,10);orb.addColorStop(0,'rgba(190,255,200,.85)');orb.addColorStop(1,'rgba(90,220,120,0)');ctx.fillStyle=orb;ctx.fillRect(tx-10,ty-10,20,20);ctx.fillStyle='#1f1712';ctx.beginPath();ctx.arc(tx,ty,4.2,0,6.28);ctx.fill();ctx.fillStyle='#7fd98a';ctx.beginPath();ctx.arc(tx,ty,3.2,0,6.28);ctx.fill();ctx.fillStyle='#eafff0';ctx.fillRect(tx-1.4,ty-1.6,1.3,1.3)}
    else if(pl.weapon==='燧石矛'){ctx.beginPath();ctx.moveTo(tx+Math.cos(wa)*9,ty+Math.sin(wa)*9);ctx.lineTo(tx-Math.sin(wa)*4,ty+Math.cos(wa)*4);ctx.lineTo(tx+Math.sin(wa)*4,ty-Math.cos(wa)*4);ctx.fill()}
    else if(pl.weapon==='狼牙劍'){ctx.strokeStyle='#d7e9f3';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(hx+Math.cos(wa)*6,hy+Math.sin(wa)*6);ctx.lineTo(tx+Math.cos(wa)*6,ty+Math.sin(wa)*6);ctx.stroke()}
    else if(pl.weapon!=='木棒'){ctx.save();ctx.translate(tx,ty);ctx.rotate(wa);ctx.fillRect(-3,pl.weapon==='燧石鎬'?-8:-2,6,pl.weapon==='燧石鎬'?16:9);ctx.restore()}
    else{ctx.lineWidth=5;ctx.strokeStyle='#7b5634';ctx.beginPath();ctx.moveTo(hx+Math.cos(wa)*12,hy+Math.sin(wa)*12);ctx.lineTo(tx,ty);ctx.stroke()}}
  // the weapon hand: a fist on the grip, or held out when unarmed
  if(w.len)plHand(hx+Math.cos(wa)*3,hy+Math.sin(wa)*3,2.5);else plHand(hx+Math.cos(wa)*4,hy+Math.sin(wa)*4,2.9);
  // shield: held out in front while blocking, at the off hand otherwise
  const shk=pl===P?eq.off:pl.sh;if(shk||pl.block){const fa=pl.block?a:a+1.25,fr=pl.block?13:11,sx=x+Math.cos(fa)*fr,sy=y-10+bob+Math.sin(fa)*(pl.block?13:9);ctx.save();ctx.translate(sx,sy);ctx.rotate(fa);
    if(shk){plEl(0,0,4.6,pl.block?11:8.5,0,PL_INK);plEl(0,0,3.6,pl.block?10:7.5,0,ITEM[shk]);ctx.fillStyle='#e2c88e';ctx.beginPath();ctx.arc(1,0,1.7,0,6.28);ctx.fill()}
    else{ctx.strokeStyle='rgba(220,230,240,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-6,0,10,-.9,.9);ctx.stroke()}ctx.restore()}
  if(pl.swing>0&&!w.proj){const al=Math.min(1,pl.swing/.24);ctx.fillStyle=`rgba(255,240,200,${.14*al})`;ctx.beginPath();ctx.moveTo(x,y-10);ctx.arc(x,y-10,w.range,a-w.arc,a+w.arc);ctx.closePath();ctx.fill();
    ctx.strokeStyle=`rgba(255,240,200,${.45*al})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-10,w.range-4,a-w.arc,a+w.arc);ctx.stroke()}
  // head, in its own frame facing +x: ears, skin, beard, spiky hair with locks, then the face
  ctx.save();ctx.translate(x,y-14+bob);ctx.rotate(a);ctx.lineJoin='miter';ctx.miterLimit=5;
  for(const q of[-1,1]){plEl(2.6,q*6.7,1.9,1.9,0,PL_INK);plEl(2.6,q*6.7,1.2,1.2,0,'#d9a67e')}
  const away=s<=-.35;plEl(2,0,7.2,7.2,0,PL_INK);if(away)plEl(2,0,6.2,6.2,0,'#b77a30');else{plEl(2,0,6.2,6.2,0,'#e0b48e');plEl(4.4,0,2.8,4.8,0,'#ecc4a0');
  ctx.fillStyle='#b77a30';ctx.fill(PL_BEARD);ctx.strokeStyle=PL_INK;ctx.lineWidth=1;ctx.stroke(PL_BEARD);ctx.fillStyle='#8f5d20';ctx.fill(PL_BEARD_D)}ctx.strokeStyle=PL_INK;
  ctx.fillStyle='#c98b3a';ctx.fill(PL_HAIR);ctx.lineWidth=1.1;ctx.stroke(PL_HAIR);ctx.fillStyle='#96601f';ctx.fill(PL_HAIR_D);ctx.fillStyle='#ecbd72';ctx.fill(PL_HAIR_L);
  // eyes and brows, hidden when walking away from the camera
  if(!away){ctx.strokeStyle='#6d4518';ctx.lineWidth=1;ctx.beginPath();for(const q of[-1,1]){ctx.moveTo(4,q*4.3);ctx.lineTo(6,q*1.8)}ctx.stroke();ctx.fillStyle=PL_INK;for(const q of[-1,1])ctx.fillRect(5.3,q*2.9-1,1.9,2);ctx.fillStyle='#fff';for(const q of[-1,1])ctx.fillRect(6.2,q*2.9-.8,.7,.7);ctx.fillStyle='#c48f68';ctx.fillRect(7.1,-.7,1.2,1.4)}
  ctx.restore();
  if(pl.rooted>0){ctx.lineCap='round';for(const[w2,q]of[[5,'#1f1712'],[3,'#5f452e']]){ctx.strokeStyle=q;ctx.lineWidth=w2;ctx.beginPath();for(let i=0;i<5;i++){const t=i/5*6.28,bx=x+Math.cos(t)*13,by=y+1+Math.sin(t)*6;ctx.moveTo(bx,by);ctx.quadraticCurveTo(bx,by-10,x+Math.cos(t)*5,y-13+Math.sin(t)*2)}ctx.stroke()}}
  ctx.globalAlpha=1}
