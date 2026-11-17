// 北境求生 · data.js：遊戲資料：物品、圖示、食物、武器、護甲、配方、寵物；世界數值（CFG）
// 由 北境求生.html 的 <script src> 依序載入（頂層宣告在檔案之間共用）；server.js 也照同樣順序在 Node 裡執行
'use strict';
/* ---------- data ---------- */
const ITEM={木頭:'#a0703f',石頭:'#8d918c',燧石:'#45586b',樹脂:'#d89a2c',皮革:'#9b6a46',生肉:'#c95b5b',烤肉:'#8a4a2b',莓果:'#b8324a',蘑菇:'#d98a3d',獠牙:'#e8e0c8',狼王之牙:'#cfe3ef',木棒:'#7b5634',燧石斧:'#56697c',燧石鎬:'#5c6670',燧石矛:'#6b7f92',皮甲:'#8a5b3a',狼牙劍:'#b9d4e4',煤炭:'#2e2c2b',銅礦:'#b5703a',錫礦:'#a9b4b8',鐵礦:'#8a5a4a',銅錠:'#d4863f',錫錠:'#cfd6da',鐵錠:'#9aa3ab',銅鎬:'#c47a3c',古樹種子:'#8fb257',樹精核心:'#9dffb0',堅硬樹皮:'#6b4e34',古老樹枝:'#8a6a44',自然精華:'#7fd98a',樹精法杖:'#7fd98a',樹精裝備:'#5a6e3a',魔力水晶:'#9b7bff',發光蘑菇:'#6fe0ff',
  皮帽:'#8a5b3a',皮褲:'#7a4f30',青銅錠:'#c08a3e',青銅盔:'#b07a36',青銅甲:'#b07a36',青銅護腿:'#9c6a2e',鐵盔:'#8a939b',鐵甲:'#8a939b',鐵護腿:'#757e86',
  木盾:'#8f6a3e',青銅盾:'#b07a36',鐵盾:'#8a939b',
  胡蘿蔔:'#e07a2a',胡蘿蔔種子:'#b59a5a',蘑菇湯:'#c98a4a',胡蘿蔔湯:'#e09a3a',燉肉:'#8a4a2b',
  狼王的心臟:'#d0485a',長老年輪:'#c9a26a'};
// 背包與箱子都算格子：材料一格疊 50、食物 20，武器、工具、護甲一格一個
let BAG_SLOTS=32;const CHEST_SLOTS=24; // BAG_SLOTS: CFG.bagSlots
/* ---------- world settings (admin page, phase 3) ---------- */
// every world has its own, saved in world.json (cfg). The server-run world owns them and sends them to everyone (world message, evt cfg);
// solo always uses the defaults. Numbers: [default, min, max]
const CFG_DEF={mobHp:[1,.5,3],mobDmg:[1,.25,3],mobCount:[1,.25,3],nightMobs:[1,0,3],bossHp:[1,.5,5],drops:[1,.5,5],cropSpeed:[1,.5,10],smeltSpeed:[1,.5,10],
  dayMin:[6,2,30],bagSlots:[32,16,64],wear:[1,0,3],skillRate:[1,.5,5],skillLoss:[5,0,50]};
const CFG_BOOL={passive:false,freeBuild:false},CFG_DEATH=['keep','bag','all'];
let CFG={};
function normCfg(c){c=c&&typeof c==='object'?c:{};const o={};
  for(const k in CFG_DEF){const[d,lo,hi]=CFG_DEF[k],v=Number(c[k]);o[k]=c[k]!==undefined&&c[k]!==null&&c[k]!==''&&isFinite(v)?Math.min(hi,Math.max(lo,v)):d}
  o.bagSlots=Math.round(o.bagSlots);for(const k in CFG_BOOL)o[k]=typeof c[k]==='boolean'?c[k]:CFG_BOOL[k];o.death=CFG_DEATH.includes(c.death)?c.death:'bag';return o}
// live: the settings changed while playing, so redraw what shows them
function applyCfg(c,live){CFG=normCfg(c);BAG_SLOTS=CFG.bagSlots;DAY_LEN=CFG.dayMin*60;if(live&&!HEADLESS){hotSig='';if(!$('panel').hidden)renderPanel()}}
applyCfg();
// loot from the world (chopping, mining, kills, bosses, harvests) is scaled by CFG.drops; refunds and chests are not
const dropN=(a,b)=>Math.max(1,Math.round(ri(a,b)*CFG.drops));
function lootTo(from,k,n,x,y){giveTo(from,k,Math.max(1,Math.round(n*CFG.drops)),x,y)}
function lootAll(k,n,x,y){giveAll(k,Math.max(1,Math.round(n*CFG.drops)),x,y)}
// free build: buildings cost nothing (equipment still does)
const freeB=r=>CFG.freeBuild&&r.build,canPay=r=>freeB(r)||afford(r.cost);
/* ---------- icons ---------- */
// 24×24 SVG icons for items (by name) and buildings (by recipe id); anything without one falls back to a colour swatch
const meat=(c,l)=>`<rect x="4.5" y="13" width="9" height="3" rx="1.5" transform="rotate(-45 9 14.5)" fill="#eee4d0"/><circle cx="4.6" cy="17.6" r="2" fill="#eee4d0"/><circle cx="6.4" cy="19.4" r="2" fill="#eee4d0"/><ellipse cx="15" cy="9" rx="6.5" ry="5" transform="rotate(-45 15 9)" fill="${c}"/><ellipse cx="13.6" cy="7.6" rx="2.2" ry="1.2" transform="rotate(-45 13.6 7.6)" fill="${l}"/>`;
const ore=(b,o)=>`<path d="M3 18l2-7 6-5 7 2 3 10-8 3z" fill="${b}"/><path d="M5 11l6-5 7 2-6 3z" fill="#ffffff22"/><circle cx="9" cy="14" r="2" fill="${o}"/><circle cx="14.5" cy="11" r="1.6" fill="${o}"/><circle cx="15" cy="16.5" r="1.8" fill="${o}"/><circle cx="10.5" cy="9" r="1.1" fill="${o}"/>`;
const ingot=(c,l,d)=>`<path d="M2.5 18l3.5-8h12l3.5 8z" fill="${c}"/><path d="M6 10h12l-1.4 3H7.4z" fill="${l}"/><path d="M2.5 18h19v2h-19z" fill="${d}"/>`;
const handle=(x1,y1,x2,y2)=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#7b5634" stroke-width="2.6" stroke-linecap="round"/>`;
const pick=c=>handle(6,21,15,7)+`<path d="M3.5 9.5Q12 1 21 8Q12 5 3.5 9.5z" fill="${c}"/>`;
// armour pieces: helmet, body, legs, in a base colour c and a light trim l
const helm=(c,l)=>`<path d="M4 15a8 8 0 0 1 16 0v3H4z" fill="${c}"/><path d="M4 15h16v3H4z" fill="${l}"/><path d="M12 7v8" stroke="${l}" stroke-width="1.6"/><rect x="10.5" y="15" width="3" height="5" fill="${c}"/>`;
const bodyA=(c,l)=>`<path d="M8 3l4 3 4-3 4.5 3.5-2.5 5V21H6V11.5L3.5 6.5z" fill="${c}"/><path d="M12 6v15M7 12h10" stroke="${l}" stroke-width="1"/><circle cx="12" cy="9" r=".9" fill="${l}"/>`;
const shieldI=(c,l)=>`<path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-6z" fill="${c}"/><path d="M12 3v18M5 9h14" stroke="${l}" stroke-width="1.2"/><circle cx="12" cy="9" r="2.2" fill="${l}"/>`;
const bowl=(c,l)=>`<path d="M3 11h18a9 7 0 0 1-18 0z" fill="#8a6236"/><path d="M3 11h18" stroke="#5a3d22" stroke-width="1.4"/><ellipse cx="12" cy="11" rx="8" ry="2" fill="${c}"/><circle cx="9" cy="10.6" r="1.2" fill="${l}"/><circle cx="14" cy="11.2" r="1" fill="${l}"/><path d="M9 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4" stroke="#ffffff66" stroke-width="1" fill="none"/>`;
const legsA=(c,l)=>`<path d="M5 3h14v5l-1.5 13h-4L12 10l-1.5 11h-4L5 8z" fill="${c}"/><path d="M5 6h14" stroke="${l}" stroke-width="1.6"/><path d="M7 15h3M14 15h3" stroke="${l}" stroke-width="1"/>`;
const ICON={
  木頭:'<rect x="2" y="12" width="17" height="7" rx="3.5" fill="#7a4f2a"/><ellipse cx="19" cy="15.5" rx="2.6" ry="3.5" fill="#d9b07a"/><circle cx="19" cy="15.5" r="1.1" fill="#a0703f"/><rect x="4" y="5" width="16" height="7" rx="3.5" fill="#8f6236"/><ellipse cx="20" cy="8.5" rx="2.6" ry="3.5" fill="#e3bf8a"/><circle cx="20" cy="8.5" r="1.1" fill="#a0703f"/>',
  石頭:'<path d="M3 18l2-8 6-5 7 3 3 10-8 3z" fill="#8d918c"/><path d="M5 10l6-5 7 3-6 3z" fill="#b4b8b1"/>',
  燧石:'<path d="M6 19l2-11 7-5 4 6-3 10z" fill="#45586b"/><path d="M8 8l7-5 2 3-7 4z" fill="#7d93a8"/><path d="M10 12l4 1" stroke="#7d93a8" stroke-width="1"/>',
  樹脂:'<path d="M12 3c3 5 6.5 8 6.5 12a6.5 6.5 0 0 1-13 0c0-4 3.5-7 6.5-12z" fill="#d89a2c"/><ellipse cx="9.6" cy="14.5" rx="1.6" ry="2.6" fill="#f3c86a"/>',
  皮革:'<path d="M5 5l3 1.5 4-2 4 2 3-1.5-1 5.5 2.5 4-3 1.2-.8 4.3H8.3l-.8-4.3-3-1.2L7 10.5z" fill="#9b6a46"/><path d="M9 11h6M9 15h6" stroke="#6e4528" stroke-width="1" stroke-dasharray="1.5 1.5"/>',
  生肉:meat('#c95b5b','#e89a9a'),
  烤肉:meat('#8a4a2b','#c07a4a'),
  莓果:'<path d="M12 9V6" stroke="#4f8a3a" stroke-width="1.5"/><path d="M12 6c2-3 5-3 6-2-2 1-4 2-6 2z" fill="#4f8a3a"/><circle cx="8.5" cy="13" r="4" fill="#b8324a"/><circle cx="15.5" cy="13" r="4" fill="#c93d56"/><circle cx="12" cy="18" r="4" fill="#a82a42"/><circle cx="7.4" cy="11.8" r="1.1" fill="#f08aa0"/><circle cx="14.4" cy="11.8" r="1.1" fill="#f08aa0"/>',
  蘑菇:'<rect x="10" y="12" width="4" height="8.5" rx="1.6" fill="#e8dcc0"/><path d="M3 13.5a9 8.5 0 0 1 18 0z" fill="#d9782f"/><circle cx="8" cy="9.5" r="1.4" fill="#f3e4c8"/><circle cx="13.5" cy="7.5" r="1.2" fill="#f3e4c8"/><circle cx="16.8" cy="11.2" r="1" fill="#f3e4c8"/>',
  獠牙:'<path d="M5.5 20.5c0-9 5-14.5 14-17-4.5 4.5-6.5 9.5-6.5 17z" fill="#e8e0c8"/><path d="M5.5 20.5H13" stroke="#b8ab88" stroke-width="2"/>',
  狼王之牙:'<path d="M7.5 21c-1-9.5 3.5-15.5 12.5-18.5-3.5 5.5-4.5 11.5-3.5 18.5z" fill="#cfe3ef"/><path d="M10.5 18c.2-6 2.2-10 6.5-13" stroke="#fff" stroke-width="1" fill="none" opacity=".75"/><path d="M6.5 21H18" stroke="#7fa6bd" stroke-width="2"/>',
  木棒:handle(5,20,12,13)+'<rect x="10.5" y="2.5" width="6.5" height="12" rx="3.2" transform="rotate(45 13.75 8.5)" fill="#8a6236"/><circle cx="14.5" cy="7" r=".9" fill="#5a3d22"/>',
  燧石斧:handle(6,21,16,6)+'<path d="M12.5 4.5l7.5 1.5-1 7.5-5.5-2.5z" fill="#56697c"/><path d="M19.5 6.5l-1 6.5" stroke="#9fb3c6" stroke-width="1.2"/>',
  燧石鎬:pick('#5c6670'),
  銅鎬:pick('#c47a3c'),
  燧石矛:'<path d="M3.5 20.5L15 9" stroke="#7b5634" stroke-width="2.2" stroke-linecap="round"/><path d="M13.5 10.5L15.5 4.5 21 3 19.5 8.5z" fill="#6b7f92"/><path d="M12.5 9.5l2 2" stroke="#3d2a17" stroke-width="1.5"/>',
  狼牙劍:'<path d="M7 15L18 4h2v2L9 17z" fill="#b9d4e4"/><path d="M9.5 13.5L19 4" stroke="#fff" stroke-width=".8" opacity=".7"/><path d="M4.5 13.5l6 6" stroke="#8a6236" stroke-width="2.5" stroke-linecap="round"/><path d="M3 21l3.5-3.5" stroke="#5a3d22" stroke-width="2.6" stroke-linecap="round"/>',
  皮甲:'<path d="M8 3l4 3 4-3 4.5 3.5-2.5 5V21H6V11.5L3.5 6.5z" fill="#8a5b3a"/><path d="M12 6v15" stroke="#5e3c24" stroke-width="1"/><circle cx="12" cy="11" r=".9" fill="#d9b07a"/><circle cx="12" cy="15" r=".9" fill="#d9b07a"/>',
  狼王的心臟:'<path d="M12 21C6 16.5 3 13 3 9a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1c0 4-3 7.5-9 12z" fill="#a8323f"/><path d="M12 20C7.5 16.2 5 13.2 5 9.8" stroke="#e86a78" stroke-width="1.2" fill="none"/><path d="M8 7.5l2 2 1.5-2.5 1.5 3 2-2" stroke="#cfe3ef" stroke-width="1.1" fill="none"/>',
  長老年輪:'<circle cx="12" cy="12" r="9.5" fill="#6b4e34"/><circle cx="12" cy="12" r="7.5" fill="#c9a26a"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#8a6a44" stroke-width="1"/><circle cx="12" cy="12" r="3.3" fill="none" stroke="#8a6a44" stroke-width="1"/><circle cx="12" cy="12" r="1.3" fill="#9dffb0"/>',
  古樹種子:'<path d="M12 21c-4.5 0-7-3-7-6.5C5 10 9 6 12 3c3 3 7 7 7 11.5 0 3.5-2.5 6.5-7 6.5z" fill="#6b4e34"/><path d="M12 5v15" stroke="#3f2c1b" stroke-width="1"/><path d="M12 8c2.5-2.5 5-3 7-2.5-.8 2.5-3.5 4-7 4z" fill="#8fb257"/><circle cx="9" cy="15" r="1.2" fill="#9dffb0"/>',
  樹精核心:'<path d="M12 2l7 6-2 10-5 4-5-4-2-10z" fill="#3d7a4a"/><path d="M12 2l7 6-7 3-7-3z" fill="#9dffb0"/><path d="M12 11v11" stroke="#d8ffe0" stroke-width="1" opacity=".7"/><circle cx="12" cy="11" r="2.4" fill="#eafff0"/>',
  堅硬樹皮:'<path d="M5 3h13l2 5-2 6 1 7H6l-2-7 2-5z" fill="#6b4e34"/><path d="M8 5l-1 6 1 8M12 4l1 7-1 8M16 5l-1 7 1 7" stroke="#3a2818" stroke-width="1.4" fill="none"/><circle cx="17" cy="16" r="2" fill="#6f9a4a"/>',
  古老樹枝:'<path d="M4 21C8 15 11 12 19 4" stroke="#6b4e34" stroke-width="3.2" stroke-linecap="round" fill="none"/><path d="M10 14L5 9M14 10l6 2" stroke="#6b4e34" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="4.5" cy="8" rx="2.6" ry="1.6" fill="#7ea64a"/><ellipse cx="21" cy="12.5" rx="2.4" ry="1.5" fill="#7ea64a"/>',
  自然精華:'<path d="M12 2c4 6 7 9 7 13.5a7 7 0 0 1-14 0C5 11 8 8 12 2z" fill="#7fd98a"/><path d="M12 8c2 3 3.5 5 3.5 7.5a3.5 3.5 0 0 1-7 0c0-2.5 1.500-4.500 3.500-7.500z" fill="#d8ffe0"/>',
  樹精法杖:'<path d="M4 21L17 8" stroke="#6b4e34" stroke-width="3" stroke-linecap="round"/><path d="M15 10c-3-1-4-3-4-6M15 10c1 3 3 4 6 4" stroke="#6b4e34" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="18" cy="6" r="3.8" fill="#7fd98a"/><circle cx="17" cy="5" r="1.4" fill="#eafff0"/>',
  樹精裝備:'<path d="M8 3l4 3 4-3 4.500 3.500-2.500 5V21H6V11.500L3.500 6.500z" fill="#5a6e3a"/><path d="M12 6v15M7 12l5 2 5-2M7 17l5 2 5-2" stroke="#3a2818" stroke-width="1.100" fill="none"/><circle cx="6" cy="6.500" r="1.800" fill="#9dbf62"/><circle cx="18" cy="6.500" r="1.800" fill="#9dbf62"/>',
  煤炭:'<path d="M3.5 17.5l3-6.5 5.5-2.5 4.5 3 4 6-6.5 3z" fill="#2e2c2b" stroke="#7a7772" stroke-width=".8"/><path d="M6.5 11l5.5-2.5 4.5 3-4.5 1.5z" fill="#6b6966"/><path d="M14 6l3-1 2 3-3 1z" fill="#3b3936" stroke="#7a7772" stroke-width=".8"/><path d="M9 16l3-1" stroke="#8a8781" stroke-width=".8"/>',
  銅礦:ore('#77736c','#d0813f'),
  錫礦:ore('#77736c','#dfe6ea'),
  鐵礦:ore('#6a625d','#a0503a'),
  銅錠:ingot('#d4863f','#f0b070','#9c5a26'),
  青銅錠:ingot('#c08a3e','#e6b468','#87602a'),
  皮帽:helm('#8a5b3a','#d9b07a'),皮褲:legsA('#7a4f30','#d9b07a'),
  青銅盔:helm('#b07a36','#e6b468'),青銅甲:bodyA('#b07a36','#e6b468'),青銅護腿:legsA('#9c6a2e','#e6b468'),
  胡蘿蔔:'<path d="M15 6L4 20c-.6.6.2 1.4.8.8L19 10z" fill="#e07a2a"/><path d="M9 14l2 1M11.5 11l2 1M7 17l1.5.8" stroke="#a8501a" stroke-width="1"/><path d="M16 7c1-3 3-4 5-4-1 2-2 3-4 4M17 8c2-1 4 0 5 1-2 .5-3 .5-5-1" fill="#5f9a3a"/>',
  胡蘿蔔種子:'<ellipse cx="8" cy="12" rx="2.2" ry="3.2" fill="#b59a5a" transform="rotate(-20 8 12)"/><ellipse cx="14" cy="9" rx="2.2" ry="3.2" fill="#c8ad6a" transform="rotate(15 14 9)"/><ellipse cx="15" cy="16" rx="2.2" ry="3.2" fill="#a88a4a" transform="rotate(35 15 16)"/>',
  蘑菇湯:bowl('#c98a4a','#e8dcc0'),胡蘿蔔湯:bowl('#e09a3a','#f0c070'),燉肉:bowl('#8a4a2b','#e07a2a'),
  pot:'<path d="M4 10h16v4a8 6 0 0 1-16 0z" fill="#3d403b"/><path d="M3 10h18" stroke="#6d716b" stroke-width="2"/><path d="M6 19l-1.5 3M18 19l1.5 3" stroke="#3d403b" stroke-width="1.6"/><path d="M9 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4" stroke="#c8d6e2" stroke-width="1" fill="none"/>',
  chair:'<rect x="6" y="3" width="3" height="18" fill="#6b4a2b"/><rect x="6" y="11" width="12" height="3" fill="#8f6a3e"/><rect x="15" y="14" width="3" height="7" fill="#6b4a2b"/><rect x="6" y="4" width="3" height="7" fill="#a87d4a"/>',
  rug:'<ellipse cx="12" cy="13" rx="10" ry="6.5" fill="#8a6a4a"/><ellipse cx="12" cy="13" rx="7" ry="4" fill="#a8845a"/><path d="M3 10l-1-2M5 18l-1 2M19 18l1 2M21 10l1-2" stroke="#6b4e34" stroke-width="1.4"/>',
  banner:'<rect x="5" y="2" width="2" height="20" fill="#6b4a2b"/><path d="M7 4h12v11l-6-3-6 3z" fill="#a83a32"/><circle cx="13" cy="8.5" r="2.2" fill="#e0a646"/>',
  plot:'<rect x="2" y="7" width="20" height="12" rx="1.5" fill="#5a3d22"/><path d="M4 10h16M4 13h16M4 16h16" stroke="#3d2a17" stroke-width="1.2"/><path d="M7 10V7M12 13V9.5M17 10V7" stroke="#6fae3e" stroke-width="1.6"/>',
  木盾:shieldI('#8f6a3e','#d9b07a'),青銅盾:shieldI('#b07a36','#e6b468'),鐵盾:shieldI('#8a939b','#c8cfd5'),
  鐵盔:helm('#8a939b','#c8cfd5'),鐵甲:bodyA('#8a939b','#c8cfd5'),鐵護腿:legsA('#757e86','#c8cfd5'),
  錫錠:ingot('#cfd6da','#f2f6f8','#98a3a8'),
  鐵錠:ingot('#9aa3ab','#c8cfd5','#646c73'),
  bench:'<rect x="3" y="9" width="18" height="4" rx="1" fill="#a87d4a"/><rect x="5" y="13" width="2.5" height="7" fill="#6b4a2b"/><rect x="16.5" y="13" width="2.5" height="7" fill="#6b4a2b"/><rect x="6" y="6" width="5" height="3" fill="#56697c"/><rect x="14" y="4.5" width="3" height="4.5" fill="#c8c2b2"/>',
  fire:'<ellipse cx="12" cy="19.5" rx="8" ry="2.5" fill="#6f6f6a"/><path d="M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-3 2-4 3-7 1 2 2 3 3 3 0-2-1-4 0-6z" fill="#ff7a2a"/><path d="M12 9c2 2 3 4 3 6a3 3 0 0 1-6 0c0-2 2-3 3-6z" fill="#ffd27a"/>',
  wall:'<path d="M2.5 21V8l2-3 2 3v13zM7.5 21V8l2-3 2 3v13zM12.5 21V8l2-3 2 3v13zM17.5 21V8l2-3 2 3v13z" fill="#8a6236"/><rect x="2.5" y="11" width="19" height="2" fill="#3d2a17"/>',
  swall:'<rect x="2" y="5" width="20" height="16" rx="1" fill="#6d716b"/><path d="M3 6h8v4H3zM12 6h9v4h-9zM3 11h4v4H3zM8 11h8v4H8zM17 11h4v4h-4zM3 16h8v4H3zM12 16h9v4h-9z" fill="#9a9e98"/>',
  furnace:'<path d="M4 21V12a8 8 0 0 1 16 0v9z" fill="#6d716b"/><rect x="14.5" y="2" width="3.5" height="6" fill="#5a5e58"/><path d="M8 21v-5a4 4 0 0 1 8 0v5z" fill="#1b1512"/><path d="M9 21c0-2 1.5-3 3-5 1.5 2 3 3 3 5z" fill="#ff8a3a"/>',
  anvil:'<path d="M3 7h13c2.500 0 5 1 5 3h-6l-1 3H8L7 10H4z" fill="#8a8e88"/><path d="M3 7h13c2.500 0 5 1 5 3h-6" fill="none" stroke="#b4b8b1" stroke-width="1"/><path d="M8 13h6l1 4H7z" fill="#6d716b"/><rect x="5" y="17" width="12" height="3.500" rx="1" fill="#5a5e58"/>',
  rack:'<rect x="3" y="4" width="2.500" height="17" fill="#6b4a2b"/><rect x="18.500" y="4" width="2.500" height="17" fill="#6b4a2b"/><rect x="3" y="6" width="18" height="2" fill="#8f6a3e"/><rect x="3" y="15" width="18" height="2" fill="#8f6a3e"/><path d="M8 8v6M12 8v7M16 8v5" stroke="#9aa3ab" stroke-width="1.600"/><path d="M6.500 13.500h3M14.500 12.500h3" stroke="#c8cfd5" stroke-width="2"/>',
  chest:'<rect x="3" y="9" width="18" height="11" rx="1.5" fill="#6b4a2b"/><path d="M3 10a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2H3z" fill="#8f6a3e"/><rect x="3" y="12" width="18" height="1.6" fill="#3d2a17"/><rect x="10.5" y="11" width="3" height="4" rx=".6" fill="#d9b85a"/><rect x="3" y="7" width="2" height="13" fill="#4a3020"/><rect x="19" y="7" width="2" height="13" fill="#4a3020"/>',
  bed:'<rect x="2" y="12" width="20" height="5" rx="1" fill="#8f6a3e"/><rect x="2" y="8" width="4" height="12" rx="1" fill="#6b4a2b"/><rect x="18.5" y="13" width="3.5" height="7" rx="1" fill="#6b4a2b"/><rect x="6.5" y="9.5" width="15" height="4" rx="1.5" fill="#c95b5b"/><rect x="6.5" y="9.5" width="4.5" height="3" rx="1" fill="#f0e6d2"/>',
  demolish:'<path d="M5 20L13.5 11.5" stroke="#7b5634" stroke-width="2.6" stroke-linecap="round"/><path d="M10.5 5.5l4-2.5 6 6-2.5 4-3-3-2 .5z" fill="#8d918c"/><circle cx="18" cy="18" r="4.5" fill="#c95b5b"/><path d="M16 16l4 4M20 16l-4 4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'
};
const icon=k=>ICON[k]?`<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`:`<span class="sw" style="background:${ITEM[k]||MAPCOL[k]||'#888'}"></span>`;
const FOODS={莓果:{hp:12,st:25,t:200,col:'#b8324a'},蘑菇:{hp:8,st:38,t:220,col:'#d98a3d'},烤肉:{hp:32,st:14,t:320,col:'#8a4a2b'},發光蘑菇:{hp:6,st:60,t:240,col:'#6fe0ff'},
  胡蘿蔔:{hp:8,st:24,t:240,col:'#e07a2a'},蘑菇湯:{hp:18,st:40,t:360,col:'#c98a4a'},胡蘿蔔湯:{hp:26,st:46,t:420,col:'#e09a3a'},燉肉:{hp:46,st:26,t:480,col:'#a0582e'}};
// 菜圃：E 種下種子，t 秒後成熟，收成 give；種子在採莓果時有 SEED_P 的機率拿到
const CROPS={胡蘿蔔:{seed:'胡蘿蔔種子',t:240,give:[['胡蘿蔔',2,3],['胡蘿蔔種子',1,2]]}},SEED_P=.25;
const WEAPONS={
  none:{name:'拳頭',dmg:5,range:34,arc:1.0,cd:.38,st:4,len:0},
  木棒:{name:'木棒',dmg:11,range:44,arc:1.1,cd:.5,st:6,len:22},
  燧石斧:{name:'燧石斧',dmg:10,range:44,arc:1.0,cd:.55,st:7,len:22},
  燧石鎬:{name:'燧石鎬',dmg:8,range:44,arc:1.0,cd:.6,st:8,len:22},
  銅鎬:{name:'銅鎬',dmg:11,range:46,arc:1.0,cd:.55,st:7,len:24},
  燧石矛:{name:'燧石矛',dmg:20,range:66,arc:.55,cd:.55,st:8,len:40},
  狼牙劍:{name:'狼牙劍',dmg:38,range:52,arc:1.25,cd:.45,st:8,len:30},
  樹精法杖:{name:'樹精法杖',dmg:24,range:340,arc:.12,cd:.6,st:9,len:30,proj:true}
};
// armour goes in three slots (eq); damage taken is multiplied by ARM_K / (ARM_K + total armour)
const EQ_SLOTS=[['head','頭'],['body','身體'],['legs','腿'],['off','副手']],ARM_K=40;
const noEq=()=>Object.fromEntries(EQ_SLOTS.map(([sl])=>[sl,null]));
// blocking (hold right mouse): a hit from the front is soaked up to the block power for stamina; raised less than PARRY_T ago = parry (no damage, the attacker is stunned)
const PARRY_T=.25,BARE_BLOCK=4;
const ARMOR={皮帽:{slot:'head',arm:4},皮甲:{slot:'body',arm:8},皮褲:{slot:'legs',arm:6},
  青銅盔:{slot:'head',arm:8},青銅甲:{slot:'body',arm:14},青銅護腿:{slot:'legs',arm:10},
  鐵盔:{slot:'head',arm:12},鐵甲:{slot:'body',arm:20},鐵護腿:{slot:'legs',arm:16},
  樹精裝備:{slot:'body',arm:18,regen:.6},
  木盾:{slot:'off',arm:0,blk:10},青銅盾:{slot:'off',arm:0,blk:18},鐵盾:{slot:'off',arm:0,blk:26}};
// 耐久：打中東西才扣 1；用完就壞掉。在工作台旁免費修理
const DUR_MAX={木棒:50,燧石斧:120,燧石鎬:120,燧石矛:100,銅鎬:200,狼牙劍:250,樹精法杖:200,
  皮帽:80,皮甲:100,皮褲:90,青銅盔:150,青銅甲:180,青銅護腿:160,鐵盔:220,鐵甲:260,鐵護腿:240,樹精裝備:240,木盾:80,青銅盾:150,鐵盾:220};
// upgrades: each kind of gear has a level 1..Q_MAX for you (q). Per level: damage / tool power +20%, armour +30%, durability +50%
const Q_MAX=3;
// skills: practise by doing; level 0..SK_MAX (a float: the fraction is progress), each level +1% to its effect; dying takes 5% off every skill
const SKILLS={melee:['近戰','近戰打中怪','近戰傷害'],ranged:['遠程','法杖打中怪','遠程傷害'],chop:['砍樹','砍中樹','砍樹力道'],mine:['挖礦','挖中石頭和礦','挖礦力道'],
  block:['格擋','擋下攻擊（招架算 3 次）','格擋值提高、格擋耗的耐力減少'],run:['奔跑','衝刺','衝刺耗的耐力減少'],roll:['閃避','翻滾','翻滾耗的耐力減少']};
const SK_MAX=50;
// what a level does, in numbers (the stamina skills cut costs by .5% / .6% a level)
const skEff=(k,lv)=>k==='block'?`格擋值 +${lv}%、格擋耗的耐力 -${Math.round(lv*.5)}%`:k==='run'?`衝刺耗的耐力 -${Math.round(lv*.6)}%`:k==='roll'?`翻滾耗的耐力 -${Math.round(lv*.6)}%`:`${SKILLS[k][2]} +${lv}%`;
const CHOP={none:3,木棒:5,燧石斧:16,燧石鎬:3,銅鎬:4,燧石矛:3,狼牙劍:8};
// 鎬的等級：大石頭、煤、銅、錫要 1 級（燧石鎬），鐵要 2 級（銅鎬）
const MINE={燧石鎬:16,銅鎬:26},PICK_TIER={燧石鎬:1,銅鎬:2};
const RES={
  tree:{hp:28,solid:9,drop:[['木頭',3,4]]},
  pine:{hp:40,solid:10,drop:[['木頭',4,6],['樹脂',0,1]]},
  rock:{hp:60,solid:18,mine:true,tier:1,name:'大石頭',drop:[['石頭',5,8],['燧石',0,2]]},
  pebble:{hp:1,pick:true,drop:[['石頭',1,2]]},
  flint:{hp:1,pick:true,drop:[['燧石',1,2]]},
  bush:{hp:1,pick:true,keep:true,drop:[['莓果',2,3]]},
  shroom:{hp:1,pick:true,drop:[['蘑菇',1,1]]},
  mtree:{hp:32,solid:9,drop:[['木頭',3,4],['魔力水晶',0,1]]},
  crystal:{hp:50,solid:12,mine:true,tier:1,name:'魔力水晶',drop:[['魔力水晶',2,3]]},
  glowshroom:{hp:1,pick:true,drop:[['發光蘑菇',1,1]]},
  coal:{hp:70,solid:16,mine:true,tier:1,name:'煤礦',base:'#55534f',ore:'#1c1b1a',drop:[['煤炭',3,5],['石頭',1,2]]},
  copper:{hp:80,solid:16,mine:true,tier:1,name:'銅礦',base:'#77736c',ore:'#d0813f',drop:[['銅礦',3,4],['石頭',1,2]]},
  etree:{hp:12,solid:9,drop:[['木頭',1,1]]}, // the Treant Elder's tree wall: never regrows, withers after ETREE_LIFE
  tin:{hp:80,solid:16,mine:true,tier:1,name:'錫礦',base:'#77736c',ore:'#dfe6ea',drop:[['錫礦',3,4],['石頭',1,2]]},
  iron:{hp:110,solid:16,mine:true,tier:2,name:'鐵礦',base:'#6a625d',ore:'#a0503a',drop:[['鐵礦',3,4],['石頭',1,2]]}
};
// 熔爐：每塊礦石燒 SMELT_T 秒，一塊煤炭燒 COAL_T 秒
const SMELT={銅礦:'銅錠',錫礦:'錫錠',鐵礦:'鐵錠'},SMELT_T=6,COAL_T=20;
const isWallK=k=>k==='wall'||k==='swall';
// a recipe shows up once you have had every material it needs (known); the treant's gear also needs the treant beaten
const recipeOpen=r=>Object.keys(r.cost).every(k=>known.has(k))&&(!r.lock||treantDown);
// called from hud(): anything new in the bag is remembered, and recipes it opens up are announced
function learn(){const add=Object.keys(inv).filter(k=>inv[k]>0&&!known.has(k));if(!add.length)return;
  const before=new Set(RECIPES.filter(recipeOpen));for(const k of add)known.add(k);
  const fresh=RECIPES.filter(r=>recipeOpen(r)&&!before.has(r));
  if(fresh.length){toast(`新配方：${fresh.map(r=>r.name).join('、')}`);if(!$('panel').hidden&&panelTab==='craft')renderPanel()}}
const RECIPES=[
  {id:'bench',name:'工作台',cost:{木頭:10},build:true,desc:'製作的中心。站在附近才能做工具與武器。'},
  {id:'fire',name:'營火',cost:{石頭:5,木頭:3},build:true,desc:'夜裡的光。可烤肉，靠近一會兒獲得「休息」。'},
  {id:'wall',name:'木牆',cost:{木頭:3},build:true,bench:true,desc:'擋住野豬與苔精。按 R 轉向，可以連續放置。'},
  {id:'swall',name:'石牆',cost:{石頭:4},build:true,bench:true,desc:'石頭砌的牆，跟木牆一樣貼著格子邊。按 R 轉向，可以連續放置。'},
  {id:'furnace',name:'熔爐',cost:{石頭:12,煤炭:3,木頭:6},build:true,bench:true,desc:'放入礦石和煤炭，把銅、錫、鐵礦燒成金屬錠。煤炭會隨時間燒完。'},
  {id:'bed',name:'床',cost:{木頭:8,皮革:2},build:true,bench:true,desc:'重生點。夜裡睡覺直接到天亮。'},
  {id:'anvil',name:'砧台',cost:{石頭:8,銅錠:4},build:true,bench:true,up:true,desc:'工作台擴充件：蓋在工作台旁邊，工作台升一級。銅鎬、狼牙劍要 Lv2 工作台。'},
  {id:'rack',name:'工具架',cost:{木頭:10,鐵錠:3,皮革:4},build:true,bench:true,up:true,desc:'工作台擴充件：蓋在工作台旁邊，工作台再升一級。樹精法杖、樹精裝備要 Lv3 工作台。'},
  {id:'pot',name:'料理鍋',cost:{石頭:6,銅錠:2},build:true,bench:true,desc:'放在營火旁邊（2 格內）才能煮東西。按 E 打開料理清單。'},
  {id:'plot',name:'菜圃',cost:{木頭:4,石頭:2},build:true,desc:'按 E 種下種子，過一陣子就能收成。走得過去，不會擋路。'},
  {id:'chair',name:'椅子',cost:{木頭:6},build:true,bench:true,desc:'家具，舒適度 +1。在營火旁休息時，附近每多一種家具，「休息」就維持更久。'},
  {id:'rug',name:'毛皮地毯',cost:{皮革:4},build:true,bench:true,desc:'家具，舒適度 +1。走得過去，不會擋路。'},
  {id:'banner',name:'旗幟',cost:{木頭:4,皮革:2,莓果:2},build:true,bench:true,desc:'家具，舒適度 +1。'},
  {id:'chest',name:'箱子',cost:{木頭:10},build:true,bench:true,desc:`存放東西用，可以放 ${CHEST_SLOTS} 格。拆掉時裡面的東西會退回給你。`},
  {id:'boat',name:'船',cost:{木頭:20,樹脂:4},build:true,bench:true,desc:'放在岸邊的水面上。按 E 上船就能出海，靠岸再按 E 下船，船會停在原地。'},
  {id:'lamp',name:'水晶燈',cost:{魔力水晶:3,石頭:4},build:true,bench:true,desc:'用魔法森林的魔力水晶做的燈，整夜照亮周圍。'},
  {id:'木棒',name:'木棒',cost:{木頭:5},desc:'比拳頭有力的第一把武器。'},
  {id:'燧石斧',name:'燧石斧',cost:{木頭:5,燧石:4},bench:true,desc:'砍樹快五倍。擁有後砍樹自動使用。'},
  {id:'燧石鎬',name:'燧石鎬',cost:{木頭:6,燧石:6},bench:true,desc:'能敲碎大石頭，挖煤、銅、錫礦。擁有後採礦自動使用。'},
  {id:'銅鎬',name:'銅鎬',cost:{銅錠:3,木頭:4},bench:true,lv:2,desc:'挖得更快，也能挖鐵礦。'},
  {id:'燧石矛',name:'燧石矛',cost:{木頭:8,燧石:6,皮革:2},bench:true,desc:'攻擊距離最長，適合邊退邊打。'},
  {id:'皮帽',name:'皮帽',cost:{皮革:3},bench:true,desc:'頭部護甲。'},
  {id:'皮甲',name:'皮甲',cost:{皮革:6},bench:true,desc:'身體護甲。'},
  {id:'皮褲',name:'皮褲',cost:{皮革:4},bench:true,desc:'腿部護甲。'},
  {id:'青銅錠',name:'青銅錠',cost:{銅錠:2,錫錠:1},bench:true,lv:2,desc:'銅和錫熔成的合金，用來打造青銅護甲。'},
  {id:'青銅盔',name:'青銅盔',cost:{青銅錠:4,皮革:2},bench:true,lv:2,desc:'頭部護甲。'},
  {id:'青銅甲',name:'青銅甲',cost:{青銅錠:8,皮革:3},bench:true,lv:2,desc:'身體護甲。'},
  {id:'青銅護腿',name:'青銅護腿',cost:{青銅錠:6,皮革:2},bench:true,lv:2,desc:'腿部護甲。'},
  {id:'鐵盔',name:'鐵盔',cost:{鐵錠:5,皮革:2},bench:true,lv:3,desc:'頭部護甲。'},
  {id:'鐵甲',name:'鐵甲',cost:{鐵錠:10,皮革:3},bench:true,lv:3,desc:'身體護甲。'},
  {id:'鐵護腿',name:'鐵護腿',cost:{鐵錠:8,皮革:2},bench:true,lv:3,desc:'腿部護甲。'},
  {id:'蘑菇湯',name:'蘑菇湯',cost:{蘑菇:3},pot:true,desc:'在料理鍋煮。耐力上限加很多。'},
  {id:'胡蘿蔔湯',name:'胡蘿蔔湯',cost:{胡蘿蔔:2,蘑菇:1},pot:true,desc:'在料理鍋煮。血量和耐力都加。'},
  {id:'燉肉',name:'燉肉',cost:{生肉:2,胡蘿蔔:1,蘑菇:1},pot:true,desc:'在料理鍋煮。血量上限加最多，維持最久。'},
  {id:'木盾',name:'木盾',cost:{木頭:10,皮革:2},bench:true,desc:'拿在副手。按住右鍵格擋，剛舉起的瞬間被打中就是招架。'},
  {id:'青銅盾',name:'青銅盾',cost:{青銅錠:4,木頭:4},bench:true,lv:2,desc:'拿在副手，擋得比木盾多。'},
  {id:'鐵盾',name:'鐵盾',cost:{鐵錠:5,木頭:4},bench:true,lv:3,desc:'拿在副手，擋得最多。'},
  {id:'狼牙劍',name:'狼牙劍',cost:{狼王之牙:1,木頭:6,燧石:4},bench:true,lv:2,desc:'用狼王的牙磨成的劍。'},
  {id:'古樹種子',name:'古樹種子',cost:{狼王之牙:1,木頭:20,樹脂:8,蘑菇:5},bench:true,desc:'和狼王的心臟一起帶到石祭壇（心臟拿在手上），就會喚醒樹精長老。種子會用掉，心臟不會。'},
  {id:'樹精法杖',name:'樹精法杖',cost:{樹精核心:1,古老樹枝:3,自然精華:2},bench:true,lv:3,lock:true,desc:'朝游標方向射出一發自然能量。打倒樹精長老後解鎖。'},
  {id:'樹精裝備',name:'樹精裝備',cost:{堅硬樹皮:8,古老樹枝:2,自然精華:2},bench:true,lv:3,lock:true,desc:'身體護甲，穿著時血量恢復變快。打倒樹精長老後解鎖。'}
];

// pets: boar = tamed by feeding berries, gathers; wolf = pup from the Wolf King, fights
const PETS={
  boar:{name:'野豬',role:'採集',hp:60,dmg:4,spd:120,r:12,cd:1.0,gather:true},
  wolf:{name:'狼崽',role:'戰鬥',hp:40,dmg:14,spd:175,r:11,cd:.7,gather:false},
  frog:{name:'奶蛙',role:'耐打',hp:90,dmg:7,spd:130,r:15,cd:.9,gather:false}
};
const TAME_FOOD={boar:'莓果',frog:'蘑菇'};
const TAME_N=5,PET_DOWN=60,PET_LEASH=300;
