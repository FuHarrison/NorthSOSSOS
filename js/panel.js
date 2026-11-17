// 北境求生 · panel.js：建造模式、背包與製作面板、箱子、熔爐、升級、目標
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- placement ---------- */
// build mode (B): the hotbar lists every building plus a demolish tool; picking one sets `placing`
const DEMOLISH={id:'demolish',name:'拆除',cost:{}};let buildSel=0;
const buildList=()=>[...RECIPES.filter(r=>r.build&&recipeOpen(r)),DEMOLISH];
function startPlace(r){const L=buildList();buildSel=Math.max(0,L.indexOf(r));placing=r;hotSig='';$('placeBar').hidden=false;
  const demo=r===DEMOLISH;$('placeRot').hidden=!isWallK(r.id);$('placeOk').textContent=demo?'拆除':'放置';$('placeOk').classList.toggle('demo',demo);
  $('placeName').textContent=demo?'拆除：對準建築':`建造：${r.name}`;
  $('placeHint').textContent=`1～${L.length}／滾輪／Q 選建築・${isWallK(r.id)?'R 轉向・':''}右鍵拆除・B 離開`;if(!$('panel').hidden)togglePanel(false)}
function stopPlace(){placing=null;hotSig='';$('placeBar').hidden=true}
const buildN=r=>freeB(r)?99:Math.min(...Object.entries(r.cost).map(([k,n])=>Math.floor((inv[k]||0)/n)));
function placeCostHtml(r){if(freeB(r))return'<span class="cost ok">這個世界蓋東西不用材料</span>';return Object.entries(r.cost).map(([k,n])=>`<span class="cost ${(inv[k]||0)>=n?'ok':'no'}">${k} 需 ${n}・剩 ${inv[k]||0}</span>`).join('')+`<span class="cost">還能蓋 ${buildN(r)} 個</span>`}
function selectBuild(i){const L=buildList();startPlace(L[(i%L.length+L.length)%L.length])}
function toggleBuild(){if(placing)stopPlace();else startPlace(buildList()[buildSel]||buildList()[0])}
// what the aim point is on: the closest wall edge or building in the 3×3 cells around it
function demoTarget(){const a=aimPt(),i0=Math.floor(a.x/CELL),j0=Math.floor(a.y/CELL);let best=null,bd=1e9;
  for(let j=j0-1;j<=j0+1;j++)for(let i=i0-1;i<=i0+1;i++){if(i<0||j<0||i>=COLS||j>=ROWS)continue;const c=j*COLS+i,st=structGrid[c];
    if(st){const d=Math.hypot(st.x-a.x,st.y-a.y);if(d<26&&d<bd){best=st;bd=d}}
    for(const w of[wallH[c],wallV[c]])if(w){const v=w.o==='v',d=Math.hypot(Math.abs(v?a.x-w.x:a.y-w.y),Math.max(0,Math.abs(v?a.y-w.y:a.x-w.x)-CELL/2));if(d<=CELL/2&&d<bd){best=w;bd=d}}}
  return best}
function doDemolish(){const t=demoTarget();if(!t){toast('這裡沒有可以拆的建築');return}act({t:'demo',k:t.k,x:t.x,y:t.y,o:t.o})}
function rotPlace(){if(placing&&isWallK(placing.id))placeRot=placeRot==='h'?'v':'h'}
function aimPt(){let x,y;if(!TOUCH&&mouse.on){const w=worldMouse();x=w.x;y=w.y;const d=Math.hypot(x-P.x,y-P.y);if(d>200){x=P.x+(x-P.x)/d*200;y=P.y+(y-P.y)/d*200}}else{x=P.x+Math.cos(P.face)*58;y=P.y+Math.sin(P.face)*58}return{x,y}}
function ghostPos(){const{x,y}=aimPt();
  if(placing&&isWallK(placing.id))return snapWall(placeRot,x,y);
  const c=ci(x,y);return{x:(c%COLS+.5)*CELL,y:(Math.floor(c/COLS)+.5)*CELL,c}}
function ghostOk(g){if(placing&&placing.id==='boat')return boatSpotOk(g.c);if(g.o){if(g.c<0||biome[g.c]===0||biome[g.c]===B_LAVA||(g.o==='v'?wallV:wallH)[g.c]||wallHit(g,P.x,P.y,P.r))return false;for(const m of mobs)if(wallHit(g,m.x,m.y,m.r))return false;return true}
  if(g.c<0||biome[g.c]===0||biome[g.c]===B_LAVA||structGrid[g.c]||g.c===altar.cell)return false;const o=resGrid[g.c];if(o&&RES[o.k].solid)return false;
  if(Math.abs(g.x-P.x)<22+P.r&&Math.abs(g.y-P.y)<22+P.r)return false;for(const m of mobs)if(Math.hypot(m.x-g.x,m.y-g.y)<20+m.r)return false;return true}
// a boat goes on an empty sea cell next to land
function boatSpotOk(c){if(c<0||biome[c]!==0||structGrid[c])return false;const i=c%COLS,j=Math.floor(c/COLS);
  return[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>{const ii=i+a,jj=j+b;return ii>=0&&jj>=0&&ii<COLS&&jj<ROWS&&biome[jj*COLS+ii]!==0})}
function tryPlace(){if(!placing)return;const r=placing;if(r===DEMOLISH){doDemolish();return}if(!canPay(r)){toast('材料不夠了');return}if(r.bench&&!nearBench()){toast('要在工作台附近才能建造');return}
  const g=ghostPos();if(!ghostOk(g)){toast('這裡不能放');return}
  if(r.up&&!structs.some(s=>s.k==='bench'&&dist(s,g)<BENCH_UP_R)){toast(`${r.name}要蓋在工作台旁邊`);return}const free=freeB(r);if(!free)take(r.cost);sfx('build');act({t:'build',k:r.id,x:g.x,y:g.y,o:g.o,cost:free?{}:r.cost});
  if(r.id==='bed')spawnPt={x:g.x,y:g.y+34};
  if(!canPay(r))toast(`${Object.keys(r.cost).find(k=>(inv[k]||0)<r.cost[k])}用完了`);writeSave()}

$('placeOk').addEventListener('click',tryPlace);$('placeRot').addEventListener('click',rotPlace);$('placeCancel').addEventListener('click',stopPlace);

/* ---------- panel ---------- */
function togglePanel(on,tab){closeBagMenu();const p=$('panel');on=on===undefined?p.hidden:on;if(tab)panelTab=tab;p.hidden=!on;if(on)$('bigmap').hidden=true;syncPaused();if(on){atkHeld=false;renderPanel()}else writeSave()}
function costHtml(c){return Object.entries(c).map(([k,n])=>`<span class="cost ${(inv[k]||0)>=n?'ok':'no'}">${k} ${inv[k]||0}/${n}</span>`).join('')}
function renderPanel(){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===panelTab));$('panelTitle').textContent=panelTab==='furnace'?'熔爐':panelTab==='chest'?'箱子':'行囊';const b=$('panelBody');
  // recipes are split into equipment and buildings; pick one on the left, the right side shows it and crafts it
  if(panelTab==='craft'){const nb=nearBench(),blv=benchLv(),shown=RECIPES.filter(recipeOpen),np=nearPot(),canMake=r=>canPay(r)&&(!r.bench||nb&&blv>=(r.lv||1))&&(!r.pot||np);
    const cats=CRAFT_CATS.map(([id,name])=>{const L=shown.filter(r=>craftCat(r)===id);return`<button type="button" class="subtab${id===craftTab?' on':''}" data-cat="${id}">${name}<small>${L.filter(canMake).length}/${L.length}</small></button>`}).join('');
    const L=shown.filter(r=>craftCat(r)===craftTab);let r=L.find(x=>x.id===craftSel[craftTab]);if(!r&&L.length){r=L[0];craftSel[craftTab]=r.id;craftQty=1}
    const dm=damaged(),fix=dm.filter(k=>recipeLv(k)<=blv),hard=dm.filter(k=>recipeLv(k)>blv);
    // the top row (categories, bench level, repair) is on every craft page, an empty category too
    const head=`<div class="subtabs">${cats}<span class="benchlv">${nb?`工作台 <b>Lv${blv}</b>`:'不在工作台旁'}</span><button class="act ${nb&&fix.length?'go':''}" type="button" id="repairBtn" ${nb&&fix.length?'':'disabled'} title="${hard.length?`要更高等級的工作台才能修：${hard.join('、')}`:dm.join('、')}">${!dm.length?'裝備都完好':!nb?'修理要在工作台旁':fix.length?`修理 ${fix.length} 件`:`要 Lv${Math.min(...hard.map(recipeLv))} 才能修`}</button></div>`,bindHead=()=>{b.querySelectorAll('[data-cat]').forEach(x=>x.addEventListener('click',()=>{craftTab=x.dataset.cat;craftQty=1;renderPanel()}));$('repairBtn').addEventListener('click',()=>{const lv=benchLv();if(!lv)return;const L=damaged().filter(k=>recipeLv(k)<=lv);for(const k of L)delete dur[k];toast(`修好了 ${L.length} 件裝備`);writeSave();renderPanel()});};
    if(!r){b.innerHTML=`<div class="craftpage">${head}<p class="note">還沒有${CRAFT_CATS.find(c=>c[0]===craftTab)[1]}配方。拿到新的材料就會解鎖新的配方，先去砍樹、撿石頭和燧石吧。</p></div>`;bindHead();return}
    const max=buildN(r),q=r.build?1:Math.max(1,Math.min(craftQty,Math.max(1,max))),ok=canMake(r)&&max>=q,mats=Object.entries(r.cost);
    const why=r.pot&&!np?'要在營火旁的料理鍋附近才能煮':r.bench&&!nb?'要站在工作台附近才能做':r.bench&&blv<(r.lv||1)?`要 Lv${r.lv} 工作台：在工作台旁邊蓋${upNames(r.lv)}`:'';
    b.innerHTML=`<div class="craftpage">${head}<div class="craftwrap">
      <div class="clist">${L.map(x=>`<button type="button" class="ci${x===r?' on':''}" data-pick="${x.id}">${icon(x.id)}<span>${x.name}</span>${qOf(x.id)>1?`<em class="q">${'★'.repeat(qOf(x.id))}</em>`:''}<i class="${canMake(x)?'ok':''}"></i></button>`).join('')}</div>
      <div class="cinfo"><div class="cbody">
        <div class="chead">${icon(r.id)}<div><h3>${r.name}</h3><em>${r.build?'建築':r.pot?'料理・在料理鍋煮':'裝備'}${r.bench?(r.lv>1?`・需要 Lv${r.lv} 工作台`:'・需要工作台'):''}${!r.build&&has(r.id)?`・背包裡有 ${inv[r.id]} 個`:''}</em></div></div>
        <p>${r.desc}</p>${statsHtml(r.id)}${upHtml(r.id,blv,nb)}
        <h4>需要材料${q>1?`（×${q}）`:''}</h4><div class="mats">${mats.map(([k,n])=>{const need=n*q,have=inv[k]||0;return`<div class="mat ${have>=need?'ok':'no'}">${icon(k)}<span>${k}</span><b>${have} / ${need}</b></div>`}).join('')}</div>
      </div><div class="cfoot">${r.build
        ?`<span class="cmax">材料夠蓋 ${max} 個</span><button class="act ${ok?'go':''}" type="button" data-make ${ok?'':'disabled'}>建造</button>`
        :`<div class="qty"><button type="button" data-q="-1" aria-label="少一個">−</button><input type="number" id="craftQ" min="1" max="${Math.max(1,max)}" value="${q}" aria-label="製作數量"><button type="button" data-q="1" aria-label="多一個">＋</button><button type="button" data-q="max">最大</button></div><button class="act ${ok?'go':''}" type="button" data-make ${ok?'':'disabled'}>${r.pot?'煮':'製作'} ×${q}</button>`}
        ${why?`<small class="cwhy">${why}</small>`:''}</div></div></div></div>`;
    bindHead();
    const ub=b.querySelector('[data-up]');if(ub)ub.addEventListener('click',()=>upgrade(r.id));
    b.querySelectorAll('[data-pick]').forEach(x=>x.addEventListener('click',()=>{craftSel[craftTab]=x.dataset.pick;craftQty=1;renderPanel()}));
    b.querySelectorAll('[data-q]').forEach(x=>x.addEventListener('click',()=>{const v=x.dataset.q;craftQty=v==='max'?Math.max(1,max):Math.max(1,Math.min(Math.max(1,max),q+(+v)));renderPanel()}));
    const qi=$('craftQ');if(qi)qi.addEventListener('change',()=>{craftQty=Math.max(1,Math.floor(+qi.value)||1);renderPanel()});
    b.querySelector('[data-make]').addEventListener('click',()=>craft(r,q))}
  else if(panelTab==='inv'){const st=stacks(inv),used=slotsOf(inv);
    // bag on top (one slot per stack, BAG_SLOTS in all), hotbar pinned at the bottom, each in its own frame
    b.innerHTML=`<div class="bagwrap"><section class="bagsec"><p class="photh">背包<b class="${used>=BAG_SLOTS?'full':''}">${used} / ${BAG_SLOTS} 格</b><span>${st.length?(TOUCH?'點一下物品可以吃、裝備、丟出':'右鍵物品可以吃、裝備、丟出')+'；拖出視窗就丟在地上':'背包是空的，去砍棵樹吧'}</span></p><div class="bag">`+st.map(([k,n],i)=>bagSlot(k,n,!i||st[i-1][0]!==k)).join('')+'<div class="bs empty"></div>'.repeat(Math.max(0,BAG_SLOTS-st.length))+'</div></section>'+
      `<section class="hotsec eqsec"><p class="photh">穿戴<b>護甲 ${armorTotal()}・減傷 ${armorCut()}%</b><span>點一下脫下；背包裡的護甲右鍵選「穿上」</span></p><div class="phot">`+EQ_SLOTS.map(([sl,nm])=>{const k=eq[sl];return`<div class="bs${k?'':' empty'}" data-ek="${sl}" title="${k?k+'・'+statsText(k):nm+'：空'}">${k?`${icon(k)}<span class="hn">${k}</span>${durBar(k)}`:`<span class="hn">${nm}</span>`}</div>`}).join('')+'</div></section>'+
      `<section class="hotsec"><p class="photh">快捷欄<span>拖進來放、拖出去拿掉、拖到別格交換</span></p><div class="phot">`+hot.map((k,i)=>`<div class="bs${i===hotSel?' held':''}${k?'':' empty'}" data-hk="${i}"><kbd>${i+1}</kbd>${k?`${icon(k)}<span class="hn">${k}</span>${WEAPONS[k]?'':`<small>${inv[k]}</small>`}`:''}</div>`).join('')+'</div></section></div>';
    b.querySelectorAll('[data-ek]').forEach(x=>x.addEventListener('click',()=>{const sl=x.dataset.ek;if(!eq[sl])return;eq[sl]=null;writeSave();renderPanel()}))}
  else if(panelTab==='chest'){const s=structGrid[chestC];if(!s||s.k!=='chest'){togglePanel(false);return}chSig=chestSig(s);
    const cs=stacks(s.box),ps=stacks(inv),cu=slotsOf(s.box),pu=slotsOf(inv),slot=(k,n,a)=>`<div class="bs" data-${a}="${k}" data-n="${n}" title="${k} ×${n}">${icon(k)}<span class="hn">${k}</span>${stackOf(k)>1?`<small>${n}</small>`:''}</div>`,pad=n=>'<div class="bs empty"></div>'.repeat(Math.max(0,n));
    b.innerHTML=`<div class="bagwrap chestwrap"><p id="chMsg">${chMsg}</p>
      <section class="bagsec"><p class="photh">箱子<b class="${cu>=CHEST_SLOTS?'full':''}">${cu} / ${CHEST_SLOTS} 格</b><span>點一下拿回背包</span><button class="act" type="button" id="chTake" ${cs.length?'':'disabled'}>全部拿出來</button></p><div class="bag">${cs.map(([k,n])=>slot(k,n,'ck')).join('')+pad(CHEST_SLOTS-cs.length)}</div></section>
      <section class="bagsec"><p class="photh">背包<b class="${pu>=BAG_SLOTS?'full':''}">${pu} / ${BAG_SLOTS} 格</b><span>點一下放進箱子</span><button class="act" type="button" id="chPut" ${ps.length?'':'disabled'}>全部放進去</button></p><div class="bag">${ps.map(([k,n])=>slot(k,n,'pk')).join('')+pad(BAG_SLOTS-ps.length)}</div></section></div>`;
    b.querySelectorAll('[data-ck]').forEach(x=>x.addEventListener('click',()=>chestMove('cget',{[x.dataset.ck]:+x.dataset.n})));
    b.querySelectorAll('[data-pk]').forEach(x=>x.addEventListener('click',()=>chestMove('cput',{[x.dataset.pk]:+x.dataset.n})));
    $('chTake').addEventListener('click',()=>chestMove('cget',Object.assign({},s.box)));
    $('chPut').addEventListener('click',()=>chestMove('cput',Object.assign({},inv)))}
  else if(panelTab==='furnace'){const s=structGrid[furnaceC];if(!s||s.k!=='furnace'){togglePanel(false);return}const f=s.fz;fzSig=furnaceSig(f);
    const ks=['煤炭',...Object.keys(SMELT)].filter(k=>has(k)),outN=Object.values(f.out).reduce((a,b)=>a+b,0);
    b.innerHTML=`<p class="note">放入礦石和煤炭就會開始燒。每 ${SMELT_T} 秒燒好一塊金屬錠，一塊煤炭燒 ${COAL_T} 秒，點著了就會一直燒到完。</p>
      <div id="fzStat">${furnaceStat(f)}</div>
      <div class="costs">${Object.entries(f.q).map(([k,v])=>`<span class="cost">${k} ×${v}</span>`).join('')||'<span class="cost">爐裡沒有礦石</span>'}<span class="cost">煤炭 ×${f.fuel}</span></div>
      <h4 class="fzh">成品</h4><div class="costs">${Object.entries(f.out).map(([k,v])=>`<span class="cost ok">${k} ×${v}</span>`).join('')||'<span class="cost">還沒有</span>'}</div>
      <button class="act ${outN?'go':''}" type="button" id="fzOut" ${outN?'':'disabled'}>取出成品</button>
      <h4 class="fzh">放進熔爐</h4>${ks.length?`<div class="inv fz">`+ks.map(k=>`<div class="slot">${icon(k)}<div class="n">${k}<small>×${inv[k]}</small></div><button type="button" data-fin="${k}" data-n="1">放 1</button><button type="button" data-fin="${k}" data-n="all">全部</button></div>`).join('')+'</div>':'<p class="note">背包裡沒有礦石或煤炭。用鎬去挖礦吧。</p>'}`;
    b.querySelectorAll('[data-fin]').forEach(x=>x.addEventListener('click',()=>{const k=x.dataset.fin,n=x.dataset.n==='all'?inv[k]:1;if(!(n>0)||!has(k))return;inv[k]-=n;act({t:'fput',c:furnaceC,k,n});writeSave();renderPanel()}));
    $('fzOut').addEventListener('click',()=>{act({t:'fout',c:furnaceC});setTimeout(renderPanel,150)})}
  else if(panelTab==='skills'){
    b.innerHTML=`<p class="note">做什麼就練什麼，每種最高 ${SK_MAX} 級。倒下時每種掉 5%。</p><div class="skills">`+Object.entries(SKILLS).map(([k,[n,how,eff]])=>{const lv=skLv(k),fr=(sk[k]||0)-lv;
      return`<div class="sk"><h3>${n}<b>Lv ${lv}</b></h3><div class="fbar"><i style="width:${lv>=SK_MAX?100:Math.round(fr*100)}%"></i></div><p>怎麼練：${how}・效果：${skEff(k,lv)}</p></div>`}).join('')+'</div>'}
  else if(panelTab==='pets'){
    b.innerHTML=pets.length?`<p class="note">一次只能召喚一隻。野豬會幫忙撿東西，狼崽擅長戰鬥，奶蛙最耐打。寵物撿到的東西放在牠身上，倒下時會掉在地上。</p><div class="grid">`+pets.map(p=>{const D=PETS[p.k],out=p.id===petOut,n=Object.values(p.bag).reduce((a,b)=>a+b,0);
      return`<div class="card"><h3>${p.name}<em>${D.name}・${D.role}${out?'・召喚中':''}</em></h3><p>${p.down>0?`倒下了，${Math.ceil(p.down)} 秒後回來`:`血量 ${Math.ceil(p.hp)}/${D.hp}・傷害 ${D.dmg}`}・攜帶 ${n} 件</p>
      <div class="costs">${Object.entries(p.bag).map(([k,v])=>`<span class="cost">${k} ×${v}</span>`).join('')}</div>
      <button class="act ${out?'':'go'}" type="button" data-sum="${p.id}">${out?'收回':'召喚'}</button><button class="act" type="button" data-take="${p.id}" ${n?'':'disabled'}>取出物品</button></div>`}).join('')+`</div>`
      :`<p class="note">還沒有寵物。拿莓果餵沒在生氣的野豬 ${TAME_N} 次就能馴服牠，奶蛙則是餵蘑菇；第一次打倒狼王時，每個人都會得到一隻狼崽。</p>`;
    b.querySelectorAll('[data-sum]').forEach(x=>x.addEventListener('click',()=>{const id=+x.dataset.sum;if(petOut===id)petOut=null;else summonPet(id);writeSave();renderPanel()}));
    b.querySelectorAll('[data-take]').forEach(x=>x.addEventListener('click',()=>{const p=pets.find(q=>q.id===+x.dataset.take);if(!p)return;
      let got=0;for(const k in p.bag){const n=Math.min(p.bag[k],roomFor(inv,k,BAG_SLOTS));if(n>0){inv[k]=(inv[k]||0)+n;hotAdd(k);got+=n;if(!(p.bag[k]-=n))delete p.bag[k]}}
      toast(Object.keys(p.bag).length?`背包滿了，從${p.name}身上取出 ${got} 件，其他的還在牠身上`:`從${p.name}身上取出 ${got} 件物品`);writeSave();renderPanel()}))}
  else{b.innerHTML=`<div class="help">
    <div><h4>操作</h4><ul>${TOUCH?'<li>左半邊螢幕拖曳：移動，推到底會衝刺</li><li>攻擊鈕：揮擊（自動瞄準最近目標，也用來砍樹、採石）</li><li>翻滾：閃避，翻滾中不會受傷</li><li>格擋：按住擋正面的攻擊，剛按下的瞬間被打中就是招架</li><li>互動：撿東西、烤肉、睡覺、獻祭</li><li>右上角「建造」：進入建造模式，點左下角的格子選建築或「拆除」，按攻擊蓋或拆</li><li>快捷欄：點左下角的格子選要拿的東西，「切換」鈕跳到下一格。選到食物時按攻擊就會吃掉</li><li>點左上角的小地圖：開大地圖</li>':'<li>WASD／方向鍵移動，Shift 衝刺</li><li>滑鼠左鍵揮擊（朝游標方向），按住右鍵格擋，空白鍵翻滾</li><li>E 互動，Tab 開背包，M 開大地圖（也可以點左上角的小地圖）</li><li>B 進入建造模式：1～8 或滾輪選建築，左鍵蓋、右鍵拆；拆掉會退回全部材料</li><li>快捷欄：1～8 或滑鼠滾輪選格子，Q 跳到下一個有東西的格子。選到食物時按左鍵就會吃掉</li>'}</ul></div>
    <div><h4>生存</h4><ul><li>不吃東西血量只有 25。吃莓果、蘑菇、烤肉能提高血量與耐力上限，效果會隨時間消退。</li><li>料理鍋（銅錠、石頭）放在營火旁邊，按 E 就能煮湯和燉肉，比烤肉好很多。蓋菜圃種胡蘿蔔：種子在採莓果時有機會拿到，種下約 4 分鐘後收成。</li><li>熟練度：近戰、遠程、砍樹、挖礦、格擋、奔跑、閃避，做什麼就練什麼：傷害、力道、格擋值每級 +1%，耐力消耗每級少 0.5～0.6%，最高 ${SK_MAX} 級。打開背包的「技能」分頁看進度。倒下時每種掉 5%。</li><li>倒下時背包裡的東西會留在原地的墓碑裡，只有你撿得回來；快捷欄上的和身上穿的會跟著你。地圖上會標出墓碑。</li><li>夜裡苔精會從暗處冒出來。蓋營火、做床、圍上木牆。</li><li>靠近營火幾秒獲得「休息」：耐力恢復更快、傷害 +10%。休息維持多久看舒適度：附近每多一種家具（床、椅子、毛皮地毯、旗幟、水晶燈）舒適度 +1，每級多 1 分鐘（3～8 分鐘）。</li><li>護甲穿在頭、身體、腿三個部位，在背包頁的「穿戴」欄看得到；右鍵背包裡的護甲選「穿上」。被打中時護甲會磨損。</li><li>裝備可以在製作頁升級（最多 3 級）：要一部分原本的材料和夠高等級的工作台，升級後順便修好。</li><li>工作台旁邊蓋砧台、工具架，工作台會升級（Lv2、Lv3）。比較好的裝備要高等級的工作台才能做，修理也要工作台等級夠。</li><li>配方要先拿過它需要的每一種材料才會出現。撿到新東西時，畫面上方會提示解鎖了哪些新配方。</li><li>工具會自動使用：有斧頭就用斧頭砍樹，有鎬就用鎬敲石頭。</li><li>背包有 ${BAG_SLOTS} 格：材料一格疊 50 個、食物 20 個，武器、工具、護甲一格一個。滿了就撿不起小東西，打下來的東西會掉在腳邊。在工作台旁蓋箱子（${CHEST_SLOTS} 格）來放東西。</li><li>一次揮擊會打到範圍內所有的敵人、樹和石頭。</li><li>按住右鍵格擋：擋得住正面的攻擊，用耐力抵掉盾牌格擋值以內的傷害，耐力不夠會被打破、硬直一下。剛舉起的 0.25 秒內被打中就是「招架」：完全不痛，對方暈眩，暈眩中多吃 50% 傷害。拿著盾擋得多，空手只擋 4。</li><li>武器和工具有耐久，打中東西才會扣，用完就壞掉。快捷欄底下的細條是耐久；到工作台旁打開「製作」按「修理」，免費全部修好。</li></ul></div>
    <div><h4>挖礦與熔爐</h4><ul><li>燧石鎬能挖煤礦、銅礦、錫礦；鐵礦要銅鎬。鐵礦只在離出生點比較遠的地方。</li><li>熔爐用石頭、煤炭、木頭在工作台旁蓋。放入礦石和煤炭，就會把礦石燒成金屬錠。</li><li>一塊煤炭燒 ${COAL_T} 秒，大約燒好 ${Math.floor(COAL_T/SMELT_T)} 塊錠。</li></ul></div>
    <div><h4>寵物</h4><ul><li>帶著莓果靠近沒在生氣的野豬，按${TOUCH?'互動':' E '}餵牠，餵 ${TAME_N} 次就會跟你走。奶蛙也一樣，但要餵蘑菇。</li><li>第一次打倒狼王時，每個人都會得到一隻狼崽，之後再打就不會再給。</li><li>寵物會幫你打附近的敵人；野豬還會順手撿石頭、燧石、莓果和蘑菇。</li><li>寵物倒下後 ${PET_DOWN} 秒會在你身邊復活，身上的東西會掉在原地。</li></ul></div>
    <div><h4>目標</h4><ul><li>野豬掉落獠牙，苔精掉落樹脂。湊齊 3 獠牙、5 樹脂後，帶到石祭壇喚醒灰鬃狼王。</li><li>第一次打倒狼王會得到狼王的心臟（不會用掉）。用狼王之牙在工作台做古樹種子，把心臟拿在手上、帶著種子到石祭壇喚醒樹精長老。第一次打倒樹精長老會得到長老年輪，並解鎖樹精法杖與樹精裝備。</li></ul></div>
    </div>`}}
const CRAFT_CATS=[['gear','裝備'],['mat','材料'],['food','料理'],['build','建築']],craftCat=r=>r.build?'build':r.pot?'food':WEAPONS[r.id]||ARMOR[r.id]?'gear':'mat';let craftTab='gear',craftQty=1;const craftSel={};
// upgrading gear you own: a share of its recipe, at a bench of level base + current level (at most 3); it comes out repaired
const canUp=k=>!!(DUR_MAX[k]&&RECIPES.some(r=>r.id===k));
const upLv=k=>Math.min(3,recipeLv(k)+qOf(k));
function upCost(k){const r=RECIPES.find(r=>r.id===k),c={};for(const m in r.cost)c[m]=Math.ceil(r.cost[m]*.6);return c}
function upHtml(k,blv,nb){if(!canUp(k)||!has(k))return'';const lv=qOf(k);
  if(lv>=Q_MAX)return`<div class="upg"><h4>升級</h4><p>已經升到最高的 ${Q_MAX} 級了。</p></div>`;
  const c=upCost(k),need=upLv(k),ok=nb&&blv>=need&&afford(c),gain=ARMOR[k]?(ARMOR[k].blk?'格擋 +20%':'護甲 +30%'):WEAPONS[k]?'傷害與工具力道 +20%':'';
  return`<div class="upg"><h4>升級（目前 ${lv} / ${Q_MAX} 級）</h4><p>升到 ${lv+1} 級：${gain}、耐久上限 +50%，順便修好。需要 Lv${need} 工作台。</p>
    <div class="mats">${Object.entries(c).map(([m,n])=>`<div class="mat ${(inv[m]||0)>=n?'ok':'no'}">${icon(m)}<span>${m}</span><b>${inv[m]||0} / ${n}</b></div>`).join('')}</div>
    <button class="act ${ok?'go':''}" type="button" data-up ${ok?'':'disabled'}>${!nb?'升級要在工作台旁':blv<need?`要 Lv${need} 工作台`:`升級到 ${lv+1} 級`}</button></div>`}
function upgrade(k){const c=upCost(k);if(!has(k)||qOf(k)>=Q_MAX||benchLv()<upLv(k)||!afford(c))return;take(c);q[k]=qOf(k)+1;delete dur[k];sfx('level');toast(`${k}升到 ${q[k]} 級`);writeSave();renderPanel()}
let furnaceC=-1,fzSig='',chestC=-1,chSig='',chMsg='';
const chestSig=s=>JSON.stringify([s.box,inv]);
// move items between your bag and the open chest: only what fits is sent; the host checks again (cput / cget)
function chestMove(t,want){const s=structGrid[chestC];if(!s||s.k!=='chest')return;const to=t==='cput'?Object.assign({},s.box):Object.assign({},inv),from=t==='cput'?inv:s.box,cap=t==='cput'?CHEST_SLOTS:BAG_SLOTS,bag={};let left=false;
  for(const k in want){const n=Math.min(Math.floor(want[k]),from[k]||0,roomFor(to,k,cap));if(n<Math.min(want[k],from[k]||0))left=true;if(n>0){bag[k]=n;to[k]=(to[k]||0)+n}}
  chMsg=left?(t==='cput'?'箱子滿了，有些放不進去':'背包滿了，有些拿不出來'):'';
  if(!Object.keys(bag).length){renderPanel();return}
  if(t==='cput'){for(const k in bag)inv[k]-=bag[k];syncHeld()}
  act({t,c:chestC,bag});writeSave();renderPanel()}
function furnaceSig(f){return JSON.stringify([f.q,f.fuel,f.out])}
function furnaceStat(f){const lit=f.burn>0,busy=Object.keys(f.q).length>0;
  return`<p class="note">${lit?`🔥 燃燒中，這塊煤炭還剩 ${Math.ceil(f.burn)} 秒`:busy?'熄火了，放煤炭進去就會點著':'熄火'}</p>${busy?`<div class="fbar"><i style="width:${Math.round(f.prog/SMELT_T*100)}%"></i></div>`:''}`}
// called from hud(): refresh the progress line every tick, rebuild the panel only when the furnace contents change
function refreshFurnacePanel(){if($('panel').hidden)return;
  if(panelTab==='chest'){const c=structGrid[chestC];if(!c||c.k!=='chest')togglePanel(false);else if(chestSig(c)!==chSig)renderPanel();return}
  if(panelTab!=='furnace')return;const s=structGrid[furnaceC];if(!s||s.k!=='furnace'){togglePanel(false);return}
  if(furnaceSig(s.fz)!==fzSig)renderPanel();else{const e=$('fzStat');if(e)e.innerHTML=furnaceStat(s.fz)}}
/* ---------- bag ---------- */
// numbers for weapons, tools and armour: [label, value]
function equipStats(k){const o=[],w=WEAPONS[k],a=ARMOR[k],f=FOODS[k];
  if(f)return[['血量上限','+'+f.hp],['耐力上限','+'+f.st],['持續',Math.round(f.t/60*10)/10+' 分鐘']];if(!w&&!a)return o;
  if(qOf(k)>1)o.push(['等級',`${qOf(k)}/${Q_MAX}`]);
  if(a)o.push(['部位',EQ_SLOTS.find(([sl])=>sl===a.slot)[1]],a.blk?['格擋',blkOf(k)]:['護甲',armOf(k)]);if(a&&a.regen)o.push(['回血','+'+a.regen+'/秒']);
  if(w)o.push(['傷害',wDmg(k)],['距離',w.range],['範圍',w.proj?'遠程單體':Math.round(w.arc*360/Math.PI)+'°'],['攻速',(1/w.cd).toFixed(1)+' 次/秒'],['耐力',w.st]);
  if(CHOP[k]>3)o.push(['砍樹',toolPow(CHOP,k)]);
  if(DUR_MAX[k])o.push(['耐久',has(k)?`${Math.ceil(durOf(k))}/${durMax(k)}`:durMax(k)]);
  if(MINE[k])o.push(['挖礦',toolPow(MINE,k)],['可挖',PICK_TIER[k]>1?'所有礦石':'石頭、煤、銅、錫']);return o}
const statsText=k=>equipStats(k).map(([a,b])=>`${a} ${b}`).join('・');
function statsHtml(k){const o=equipStats(k);return o.length?`<div class="stats">${o.map(([a,b])=>`<span>${a}<b>${b}</b></span>`).join('')}</div>`:''}
function itemSub(k){return FOODS[k]?`血+${FOODS[k].hp} 耐+${FOODS[k].st}`:statsText(k)}
function bagSlot(k,n,first){const hi=hot.indexOf(k),sub=itemSub(k);
  const worn=ARMOR[k]&&eq[ARMOR[k].slot]===k;
  return`<div class="bs${held()===k||worn?' held':''}" data-bk="${k}" title="${k} ×${n}${sub?'・'+sub:''}">${hi>=0?`<em>${hi+1}</em>`:worn&&first?'<em>穿</em>':''}${icon(k)}<span class="hn">${k}</span>${stackOf(k)>1?`<small>${n}</small>`:''}${first?durBar(k):''}</div>`}
// right-click (or tap) menu for one bag item
function closeBagMenu(){const m=$('bagMenu');if(m)m.remove()}
function openBagMenu(k,x,y){closeBagMenu();if(!has(k))return;const n=inv[k],sub=itemSub(k),m=document.createElement('div');m.id='bagMenu';
  const acts=[];if(FOODS[k])acts.push(['吃',()=>eat(k)]);
  if(ARMOR[k])acts.push([eq[ARMOR[k].slot]===k?'脫下':'穿上',()=>toggleEq(k)]);
  else acts.push([held()===k?'手持中':WEAPONS[k]?'裝備':`放快捷欄第 ${hotSel+1} 格`,()=>{if(held()!==k)hotPut(k)}]);
  acts.push(['丟出 1',()=>dropItem(k,1)]);if(n>2)acts.push([`丟出一半（${Math.floor(n/2)}）`,()=>dropItem(k,Math.floor(n/2))]);if(n>1)acts.push([`全部丟出（${n}）`,()=>dropItem(k,n),1]);
  m.innerHTML=`<b>${k} ×${n}</b>${equipStats(k).length?statsHtml(k):sub?`<p>${sub}</p>`:''}`+acts.map(([t,,d],i)=>`<button type="button" data-mi="${i}"${d?' class="danger"':''}>${t}</button>`).join('');
  document.body.appendChild(m);m.style.left=Math.max(8,Math.min(x,innerWidth-m.offsetWidth-8))+'px';m.style.top=Math.max(8,Math.min(y,innerHeight-m.offsetHeight-8))+'px';
  m.addEventListener('click',e=>{const bt=e.target.closest('[data-mi]');if(!bt)return;acts[+bt.dataset.mi][1]();closeBagMenu();writeSave();renderPanel()})}
addEventListener('pointerdown',e=>{const m=$('bagMenu');if(m&&!m.contains(e.target))closeBagMenu()},true);
// drag: from the bag onto a hotbar slot puts it there, out of the window drops the whole stack;
// from a hotbar slot onto another swaps them, anywhere else takes it off the hotbar
let drag=null;
$('panelBody').addEventListener('contextmenu',e=>{const t=e.target.closest('[data-bk]');if(!t)return;e.preventDefault();openBagMenu(t.dataset.bk,e.clientX,e.clientY)});
$('panelBody').addEventListener('pointerdown',e=>{if(e.button)return;const t=e.target.closest('[data-bk],[data-hk]');if(!t)return;
  const k=t.dataset.bk||hot[+t.dataset.hk],fromHot=t.dataset.hk!==undefined?+t.dataset.hk:null;if(fromHot!==null&&!k){hotSelect(fromHot,true);renderPanel();return}
  e.preventDefault();drag={k,fromHot,x0:e.clientX,y0:e.clientY,moved:false,ghost:null,over:null}});
addEventListener('pointermove',e=>{if(!drag)return;
  if(!drag.moved){if(Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)<6)return;drag.moved=true;closeBagMenu();
    const g=document.createElement('div');g.className='bs dragGhost';g.innerHTML=`${icon(drag.k)}<span class="hn">${drag.k}</span>`;document.body.appendChild(g);drag.ghost=g}
  drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';
  const el=document.elementFromPoint(e.clientX,e.clientY),hs=el&&el.closest('[data-hk]');if(drag.over&&drag.over!==hs)drag.over.classList.remove('over');if(hs)hs.classList.add('over');drag.over=hs});
function endDrag(e){if(!drag)return;const d=drag;drag=null;if(d.ghost)d.ghost.remove();
  if(!d.moved){if(d.fromHot!==null){hotSelect(d.fromHot,true);renderPanel()}else openBagMenu(d.k,e.clientX,e.clientY);return}
  const el=document.elementFromPoint(e.clientX,e.clientY),hs=el&&el.closest('[data-hk]'),inSheet=el&&el.closest('#panel .sheet');
  if(hs){const i=+hs.dataset.hk;if(d.fromHot!==null){[hot[i],hot[d.fromHot]]=[hot[d.fromHot],hot[i]]}else{const j=hot.indexOf(d.k);if(j>=0)hot[j]=null;hot[i]=d.k}syncHeld()}
  else if(d.fromHot!==null){hot[d.fromHot]=null;syncHeld()}
  else if(!inSheet&&has(d.k)){dropItem(d.k,inv[d.k]);return}
  writeSave();renderPanel()}
addEventListener('pointerup',endDrag);addEventListener('pointercancel',e=>{if(drag&&drag.ghost)drag.ghost.remove();drag=null});
// drop items as a sack in front of the player; anyone can pick it up with E
function dropItem(k,n){n=Math.floor(+n);if(!(n>0)||!has(k)){renderPanel();return}n=Math.min(n,inv[k]);
  inv[k]-=n;syncHeld();
  act({t:'drop',x:P.x+Math.cos(P.face)*26,y:P.y+Math.sin(P.face)*26,bag:{[k]:n}});
  toast(`丟出 ${k} ×${n}`);writeSave();renderPanel()}
function craft(r,n=1){if(!canPay(r))return;if(r.build){startPlace(r);return}if(r.bench&&benchLv()<(r.lv||1))return;if(r.pot&&!nearPot())return;let made=0;
  // the materials used free their slots first, so check for room after taking them
  while(made<n&&afford(r.cost)){take(r.cost);if(roomFor(inv,r.id,BAG_SLOTS)<1){for(const k in r.cost)inv[k]+=r.cost[k];break}inv[r.id]=(inv[r.id]||0)+1;made++}
  if(!made){toast('背包滿了，空出位置才能做');renderPanel();return}hotAdd(r.id);if(ARMOR[r.id]&&!eq[ARMOR[r.id].slot])eq[ARMOR[r.id].slot]=r.id;
  if(WEAPONS[r.id]&&WEAPONS[r.id].dmg>WEAPONS[P.weapon].dmg&&hot.includes(r.id))hotSelect(hot.indexOf(r.id),true);sfx('craft');toast(`做好了：${r.name}${made>1?' ×'+made:''}`);writeSave();renderPanel()}

/* ---------- goals ---------- */
const GOALS=[
  ['砍樹，收集 10 木頭',()=>(inv['木頭']||0)>=10||structs.some(s=>s.k==='bench')],
  ['打開背包・製作，蓋一座工作台',()=>structs.some(s=>s.k==='bench')],
  ['撿燧石（水邊最多），做一把燧石斧',()=>has('燧石斧')],
  ['獵野豬，蓋營火把肉烤來吃',()=>ate],
  ['收集 3 獠牙（野豬）與 5 樹脂（苔精、松樹）',()=>((inv['獠牙']||0)>=3&&(inv['樹脂']||0)>=5)||flags.summoned||flags.boss],
  ['跟著指針前往石祭壇，獻上祭品',()=>flags.summoned||flags.boss],
  ['擊敗灰鬃狼王',()=>flags.boss],
  ['用狼王之牙打造狼牙劍',()=>has('狼牙劍')],
  ['打倒狼王，拿到狼王的心臟',()=>has('狼王的心臟')||boss&&boss.k==='treant'||treantDown],
  ['用狼王之牙與材料做一顆古樹種子',()=>has('古樹種子')||boss&&boss.k==='treant'||treantDown],
  ['手上拿著狼王的心臟、帶著古樹種子到石祭壇，打倒樹精長老',()=>treantDown],
  ['到工作台製作樹精法杖或樹精裝備',()=>has('樹精法杖')||has('樹精裝備')]
];
function goalIdx(){for(let i=0;i<GOALS.length;i++)if(!GOALS[i][1]())return i;return GOALS.length}
