import {launch,soloGame,sleep,HERE} from './lib/harness.mjs';
const br=await launch();const ok=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':'  → '+JSON.stringify(x)));if(!c)process.exitCode=1};
try{
  const pg=await soloGame(br,HERE+'/08-craft-empty-category');
  await pg.g(`inv={燧石斧:1,木頭:5};dur={燧石斧:30};known=new Set(['木頭','燧石斧'])`);
  await pg.key('Tab');await pg.clickSel('[data-tab="craft"]');await pg.clickSel('[data-cat="mat"]');await sleep(150);
  ok((await pg.ev(`document.querySelector('#panelBody .note')?.textContent||''`)).includes('還沒有材料配方'),'材料分類是空的');
  ok(await pg.ev(`!!document.getElementById('repairBtn')&&!!document.querySelector('.benchlv')`),'空分類也有修理按鈕和工作台等級');
  await pg.clickSel('[data-cat="gear"]');await sleep(100);
  ok(await pg.ev(`!!document.querySelector('#panelBody .ci')`),'空分類裡的分類按鈕可以切回裝備');
  console.log('logs',pg.logs);
}finally{br.close()}
